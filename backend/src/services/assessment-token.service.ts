import { v4 as uuidv4 } from 'uuid';
import { TokenStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config';
import { generateAssessmentToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { candidateStatusService } from './candidate-status.service';

export type JourneyStatus =
  | 'REGISTERED'
  | 'EMAIL_SENT'
  | 'VERIFIED'
  | 'STARTED'
  | 'SUBMITTED'
  | 'EXPIRED';

export class AssessmentTokenService {
  async createToken(candidateId: string, email: string) {
    const jti = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.jwt.assessmentTokenExpiryDays);

    const token = generateAssessmentToken(candidateId, email, jti);

    await prisma.assessmentToken.create({
      data: {
        candidateId,
        jti,
        email: email.toLowerCase(),
        expiresAt,
        status: TokenStatus.CREATED,
      },
    });

    return { token, jti, expiresAt };
  }

  async markEmailSent(jti: string) {
    await prisma.assessmentToken.update({
      where: { jti },
      data: { status: TokenStatus.EMAIL_SENT },
    });
  }

  async markVerified(jti: string) {
    const record = await prisma.assessmentToken.findUnique({ where: { jti } });
    if (!record) throw new AppError(401, 'Invalid assessment token');

    await prisma.$transaction([
      prisma.assessmentToken.update({
        where: { jti },
        data: { status: TokenStatus.VERIFIED, usedAt: new Date() },
      }),
      prisma.candidateProfile.update({
        where: { id: record.candidateId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
    ]);
    await candidateStatusService.markVerified(record.candidateId);
  }

  async markStarted(candidateId: string) {
    const token = await prisma.assessmentToken.findFirst({
      where: { candidateId, isRevoked: false },
      orderBy: { createdAt: 'desc' },
    });
    if (token && token.status !== TokenStatus.SUBMITTED) {
      await prisma.assessmentToken.update({
        where: { id: token.id },
        data: { status: TokenStatus.STARTED },
      });
    }
  }

  async markSubmitted(candidateId: string) {
    const token = await prisma.assessmentToken.findFirst({
      where: { candidateId, isRevoked: false },
      orderBy: { createdAt: 'desc' },
    });
    if (token) {
      await prisma.assessmentToken.update({
        where: { id: token.id },
        data: { status: TokenStatus.SUBMITTED, usedAt: new Date() },
      });
    }
  }

  async markExpired(jti: string) {
    await prisma.assessmentToken.updateMany({
      where: { jti, status: { not: TokenStatus.SUBMITTED } },
      data: { status: TokenStatus.EXPIRED },
    });
  }

  resolveJourneyStatus(params: {
    emailVerified: boolean;
    tokenStatus?: TokenStatus | null;
    tokenExpiresAt?: Date | null;
    hasSubmission: boolean;
    assessmentInProgress: boolean;
  }): JourneyStatus {
    if (params.hasSubmission) return 'SUBMITTED';
    if (params.assessmentInProgress) return 'STARTED';
    if (params.tokenExpiresAt && params.tokenExpiresAt < new Date() && !params.hasSubmission) {
      return 'EXPIRED';
    }
    if (params.tokenStatus === TokenStatus.EXPIRED) return 'EXPIRED';
    if (params.emailVerified || params.tokenStatus === TokenStatus.VERIFIED) return 'VERIFIED';
    if (params.tokenStatus === TokenStatus.EMAIL_SENT) return 'EMAIL_SENT';
    if (params.tokenStatus === TokenStatus.STARTED) return 'STARTED';
    return 'REGISTERED';
  }
}

export const assessmentTokenService = new AssessmentTokenService();
