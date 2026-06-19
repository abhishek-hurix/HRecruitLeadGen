import { AnswerMode, Assessment, Language } from '@prisma/client';
import { prisma } from '../config/database';
import { executionService } from './execution.service';

interface AnswerInput {
  questionId: string;
  code: string;
  selectedOptionIndex?: number | null;
}

export class EvaluationService {
  async evaluateSubmission(assessment: Assessment, answers: AnswerInput[]) {
    const questionIds = assessment.questionIds as string[];
    const evaluatedAnswers = [];
    let passedQuestions = 0;

    for (const answer of answers) {
      const question = await prisma.question.findUnique({ where: { id: answer.questionId } });
      const language = (question?.language ?? assessment.language) as Language;

      if (question?.answerMode === AnswerMode.MCQ) {
        const selected = answer.selectedOptionIndex;
        const isFullyPassed =
          typeof selected === 'number' &&
          typeof question.correctOptionIndex === 'number' &&
          selected === question.correctOptionIndex;
        if (isFullyPassed) passedQuestions++;

        evaluatedAnswers.push({
          questionId: answer.questionId,
          code: selected == null ? '' : String(selected),
          selectedOptionIndex: selected ?? null,
          passedTests: isFullyPassed ? 1 : 0,
          failedTests: isFullyPassed ? 0 : 1,
          executionTimeMs: 0,
          memoryKb: 0,
          testResults: [{
            selectedOptionIndex: selected ?? null,
            correctOptionIndex: question.correctOptionIndex,
            passed: isFullyPassed,
          }],
          isFullyPassed,
        });
        continue;
      }

      if (question?.answerMode === AnswerMode.COMPREHENSIVE) {
        evaluatedAnswers.push({
          questionId: answer.questionId,
          code: answer.code,
          selectedOptionIndex: null,
          passedTests: 0,
          failedTests: 0,
          executionTimeMs: 0,
          memoryKb: 0,
          testResults: [],
          isFullyPassed: false,
        });
        continue;
      }

      const testCases = await prisma.questionTestCase.findMany({
        where: { questionId: answer.questionId },
        orderBy: { sortOrder: 'asc' },
      });

      const result = await executionService.runAgainstTestCases(
        language,
        answer.code,
        testCases.map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput }))
      );

      const isFullyPassed = result.passedCount === result.totalCount && result.totalCount > 0;
      if (isFullyPassed) passedQuestions++;

      evaluatedAnswers.push({
        questionId: answer.questionId,
        code: answer.code,
        selectedOptionIndex: null,
        passedTests: result.passedCount,
        failedTests: result.totalCount - result.passedCount,
        executionTimeMs: result.executionTimeMs,
        memoryKb: 64,
        testResults: result.results,
        isFullyPassed,
      });
    }

    const totalQuestions = questionIds.length;
    const score = totalQuestions > 0 ? (passedQuestions / totalQuestions) * 10 : 0;

    return {
      score,
      passedQuestions,
      totalQuestions,
      answers: evaluatedAnswers,
    };
  }
}

export const evaluationService = new EvaluationService();
