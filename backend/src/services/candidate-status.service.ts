import { CandidateStatus, CandidateAssessmentStatus, AssessmentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { assessmentTokenService } from './assessment-token.service';

export class CandidateStatusService {
  async syncCandidateStatus(candidateId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        assessmentTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
        assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
        submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      },
    });

    if (!candidate) return;

    const latestToken = candidate.assessmentTokens[0];
    const journeyStatus = assessmentTokenService.resolveJourneyStatus({
      emailVerified: candidate.emailVerified,
      tokenStatus: latestToken?.status,
      tokenExpiresAt: latestToken?.expiresAt,
      hasSubmission: candidate.submissions.length > 0,
      assessmentInProgress: candidate.assessments[0]?.status === AssessmentStatus.IN_PROGRESS,
    });

    let assessmentStatus: CandidateAssessmentStatus = CandidateAssessmentStatus.NOT_STARTED;
    if (candidate.submissions.length > 0) {
      assessmentStatus = CandidateAssessmentStatus.SUBMITTED;
    } else if (candidate.assessments[0]?.status === AssessmentStatus.IN_PROGRESS) {
      assessmentStatus = CandidateAssessmentStatus.IN_PROGRESS;
    }

    const assessmentDate =
      candidate.submissions[0]?.submittedAt ||
      candidate.assessments[0]?.startedAt ||
      candidate.assessmentDate;

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        candidateStatus: journeyStatus as CandidateStatus,
        assessmentStatus,
        assessmentDate,
      },
    });
  }

  async markEmailSent(candidateId: string) {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: { candidateStatus: CandidateStatus.EMAIL_SENT },
    });
  }

  async markVerified(candidateId: string) {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        candidateStatus: CandidateStatus.VERIFIED,
      },
    });
  }

  async markStarted(candidateId: string) {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        candidateStatus: CandidateStatus.STARTED,
        assessmentStatus: CandidateAssessmentStatus.IN_PROGRESS,
        assessmentDate: new Date(),
      },
    });
  }

  async markSubmitted(candidateId: string) {
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        candidateStatus: CandidateStatus.SUBMITTED,
        assessmentStatus: CandidateAssessmentStatus.SUBMITTED,
        assessmentDate: new Date(),
      },
    });
  }
}

export const candidateStatusService = new CandidateStatusService();
