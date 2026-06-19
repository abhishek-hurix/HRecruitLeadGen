import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse';
import { prisma } from '../config/database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { storage } from './storage/storage.service';

type OriginalityRisk = 'LOW' | 'MEDIUM' | 'HIGH';

interface AiReview {
  overallSummary: string;
  codeQualityScore: number;
  cheatingRiskScore: number;
  originalityRisk: OriginalityRisk;
  originalityConfidence: number;
  finalRecommendation: string;
  strengths: string[];
  concerns: string[];
  perQuestion: Array<{
    questionTitle: string;
    codeQualityNotes: string;
    patternObservations: string[];
    originalityRisk: OriginalityRisk;
  }>;
}

function truncate(value: string, maxLength = 6000): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[TRUNCATED]`;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeRisk(value: unknown): OriginalityRisk {
  return value === 'HIGH' || value === 'MEDIUM' || value === 'LOW' ? value : 'MEDIUM';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').slice(0, 8);
}

function normalizeReview(value: unknown): AiReview {
  const review = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const perQuestionInput = Array.isArray(review.perQuestion) ? review.perQuestion : [];

  return {
    overallSummary: typeof review.overallSummary === 'string' ? review.overallSummary : 'AI review completed.',
    codeQualityScore: clampNumber(review.codeQualityScore, 0, 10, 0),
    cheatingRiskScore: clampNumber(review.cheatingRiskScore, 0, 10, 0),
    originalityRisk: normalizeRisk(review.originalityRisk),
    originalityConfidence: clampNumber(review.originalityConfidence, 0, 100, 0),
    finalRecommendation: typeof review.finalRecommendation === 'string' ? review.finalRecommendation : 'Review manually.',
    strengths: asStringArray(review.strengths),
    concerns: asStringArray(review.concerns),
    perQuestion: perQuestionInput.slice(0, 20).map((item) => {
      const question = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        questionTitle: typeof question.questionTitle === 'string' ? question.questionTitle : 'Question',
        codeQualityNotes: typeof question.codeQualityNotes === 'string' ? question.codeQualityNotes : '',
        patternObservations: asStringArray(question.patternObservations),
        originalityRisk: normalizeRisk(question.originalityRisk),
      };
    }),
  };
}

export class AiAssessmentService {
  async reviewSubmission(submissionId: string, roleApplied = 'Software Engineer'): Promise<void> {
    if (!config.ai.openaiApiKey) {
      await this.markSkipped(submissionId, 'OPENAI_API_KEY is not configured.');
      return;
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assessment: true,
        candidate: { include: { user: true } },
        answers: { include: { question: true } },
      },
    });

    if (!submission) return;

    try {
      const effectiveRole = roleApplied || submission.candidate.appliedRole || 'Software Engineer';
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          aiReviewStatus: 'IN_PROGRESS',
          aiReviewError: null,
        },
      });

      const resumeText = await this.getResumeText(submission.candidate.resumePath);
      const promptPayload = {
        candidate: {
          name: submission.candidate.fullName,
          email: submission.candidate.user.email,
          roleApplied: effectiveRole,
          resumeText: truncate(resumeText, 6000),
        },
        assessment: {
          language: submission.assessment.language,
          testcaseScore: Number(submission.score),
          passedQuestions: submission.passedQuestions,
          totalQuestions: submission.totalQuestions,
          submittedAt: submission.submittedAt,
        },
        answers: submission.answers.map((answer) => ({
          questionTitle: answer.question.title,
          topic: answer.question.topic,
          difficulty: answer.question.difficulty,
          prompt: truncate(answer.question.description, 1800),
          passedTests: answer.passedTests,
          failedTests: answer.failedTests,
          isFullyPassed: answer.isFullyPassed,
          executionTimeMs: answer.executionTimeMs,
          code: truncate(answer.code),
        })),
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ai.scoringModel,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a senior technical hiring evaluator. Review coding assessment submissions only when explicitly requested by an admin after final submission. Use testcase score, candidate resume, applied role, and code answers as evidence. Do not claim cheating or plagiarism with certainty; estimate risk from code patterns and resume/role fit. Return strict JSON.',
            },
            {
              role: 'user',
              content: `Assess this candidate submission for role fit, code quality, and possible copy/cheating signals. Return JSON with keys: overallSummary (string), codeQualityScore (0-10 number), cheatingRiskScore (0-10 number where 0 means no cheating signals and 10 means very strong cheating/copy signals), originalityRisk (LOW|MEDIUM|HIGH), originalityConfidence (0-100 number), finalRecommendation (string), strengths (string[]), concerns (string[]), perQuestion (array of {questionTitle, codeQualityNotes, patternObservations, originalityRisk}). The cheatingRiskScore is an estimate only; do not present it as proof of cheating.\n\nSubmission:\n${JSON.stringify(promptPayload)}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI request failed (${response.status}): ${truncate(errorText, 500)}`);
      }

      const completion = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = completion.choices?.[0]?.message?.content;
      if (!content) throw new Error('OpenAI returned an empty review.');

      const review = normalizeReview(JSON.parse(content));
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          aiReviewStatus: 'COMPLETED',
          aiReview: review as unknown as Prisma.InputJsonValue,
          aiReviewError: null,
          aiReviewedAt: new Date(),
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'AI review failed.';
      logger.error('AI assessment review failed', { submissionId, message });
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          aiReviewStatus: 'FAILED',
          aiReviewError: truncate(message, 2000),
        },
      }).catch(() => {});
    }
  }

  private async markSkipped(submissionId: string, reason: string) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        aiReviewStatus: 'SKIPPED',
        aiReviewError: reason,
      },
    }).catch(() => {});
  }

  private async getResumeText(resumePath: string): Promise<string> {
    try {
      const buffer = await storage.get(resumePath);
      const parsed = await pdfParse(buffer);
      return parsed.text.trim();
    } catch (error) {
      logger.warn('Unable to parse resume for AI assessment review', {
        resumePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return '';
    }
  }
}

export const aiAssessmentService = new AiAssessmentService();
