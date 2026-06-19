import { TokenStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { verifyAssessmentToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { assessmentTokenService } from './assessment-token.service';

export class VerifyService {
  async verifyToken(tokenString: string) {
    let payload;
    try {
      payload = verifyAssessmentToken(tokenString);
    } catch {
      throw new AppError(401, 'Invalid or expired assessment link');
    }

    const tokenRecord = await prisma.assessmentToken.findUnique({
      where: { jti: payload.jti },
      include: {
        candidate: { include: { user: true, submissions: true } },
      },
    });

    if (!tokenRecord || tokenRecord.isRevoked) {
      throw new AppError(401, 'Invalid or expired assessment link');
    }

    if (tokenRecord.expiresAt < new Date()) {
      await assessmentTokenService.markExpired(payload.jti);
      throw new AppError(401, 'Assessment link has expired');
    }

    if (tokenRecord.status === TokenStatus.SUBMITTED || tokenRecord.candidate.submissions.length > 0) {
      throw new AppError(403, 'You have already completed this assessment.');
    }

    if (tokenRecord.status === TokenStatus.EXPIRED) {
      throw new AppError(401, 'Assessment link has expired');
    }

    if (!tokenRecord.candidate.emailVerified) {
      await assessmentTokenService.markVerified(payload.jti);
    } else if (
      tokenRecord.status === TokenStatus.EMAIL_SENT ||
      tokenRecord.status === TokenStatus.CREATED
    ) {
      await assessmentTokenService.markVerified(payload.jti);
    }

    return {
      token: tokenString,
      candidateId: tokenRecord.candidateId,
      candidateName: tokenRecord.candidate.fullName,
      email: tokenRecord.candidate.user.email,
    };
  }
}

export const verifyService = new VerifyService();
