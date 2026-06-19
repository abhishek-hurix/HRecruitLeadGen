import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { generateEmailVerificationToken, verifyEmailVerificationToken } from '../utils/jwt';
import { emailService } from './email.service';
import { candidateStatusService } from './candidate-status.service';

const MAX_RESENDS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;

export class EmailVerificationService {
  private resetRateLimitWindowIfNeeded(
    attempts: number,
    windowStart: Date | null
  ): { attempts: number; windowStart: Date } {
    const now = new Date();
    if (!windowStart || now.getTime() - windowStart.getTime() >= HOUR_MS) {
      return { attempts: 0, windowStart: now };
    }
    return { attempts, windowStart };
  }

  async getVerificationStatus(candidateId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: { user: true },
    });
    if (!candidate) throw new AppError(404, 'Candidate not found');

    const { attempts } = this.resetRateLimitWindowIfNeeded(
      candidate.verificationAttempts,
      candidate.verificationAttemptsWindowStart
    );

    return {
      emailVerified: candidate.emailVerified,
      verifiedAt: candidate.emailVerifiedAt,
      verificationSentAt: candidate.verificationSentAt,
      resendsRemaining: Math.max(0, MAX_RESENDS_PER_HOUR - attempts),
      canResend: !candidate.emailVerified && attempts < MAX_RESENDS_PER_HOUR,
    };
  }

  async resendVerificationEmail(candidateId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: { user: true },
    });
    if (!candidate) throw new AppError(404, 'Candidate not found');

    if (candidate.emailVerified) {
      throw new AppError(400, 'Your email is already verified.');
    }

    const { attempts, windowStart } = this.resetRateLimitWindowIfNeeded(
      candidate.verificationAttempts,
      candidate.verificationAttemptsWindowStart
    );

    if (attempts >= MAX_RESENDS_PER_HOUR) {
      throw new AppError(
        429,
        'Too many verification requests. Please try again later.'
      );
    }

    await this.createAndSendToken(candidate.id, candidate.user.email, candidate.fullName);

    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        verificationSentAt: new Date(),
        verificationAttempts: attempts + 1,
        verificationAttemptsWindowStart: windowStart,
      },
    });

    return { message: 'Verification email sent successfully.' };
  }

  /** Used on registration and resend — does not increment rate-limit counter on registration. */
  async sendInitialVerificationEmail(candidateId: string, email: string, fullName: string) {
    await this.createAndSendToken(candidateId, email, fullName);
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        verificationSentAt: new Date(),
        verificationAttempts: 1,
        verificationAttemptsWindowStart: new Date(),
      },
    });
  }

  private async createAndSendToken(candidateId: string, email: string, fullName: string) {
    const jti = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.jwt.emailVerificationExpiryHours);

    const token = generateEmailVerificationToken(candidateId, email, jti);

    await prisma.emailVerificationToken.create({
      data: {
        candidateId,
        jti,
        email: email.toLowerCase(),
        expiresAt,
      },
    });

    const verifyUrl = `${config.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    await emailService.sendVerificationEmail({
      to: email,
      candidateName: fullName,
      verifyUrl,
      expiresAt,
    });
  }

  async verifyEmail(tokenString: string) {
    let payload;
    try {
      payload = verifyEmailVerificationToken(tokenString);
    } catch {
      throw new AppError(401, 'Invalid or expired verification link');
    }

    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { jti: payload.jti },
      include: { candidate: { include: { user: true } } },
    });

    if (!tokenRecord) {
      throw new AppError(401, 'Invalid or expired verification link');
    }

    if (tokenRecord.usedAt) {
      throw new AppError(400, 'This verification link has already been used.');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError(401, 'Verification link has expired');
    }

    if (tokenRecord.candidate.user.email !== payload.email) {
      throw new AppError(401, 'Invalid verification link');
    }

    if (tokenRecord.candidate.emailVerified) {
      await prisma.emailVerificationToken.update({
        where: { jti: payload.jti },
        data: { usedAt: new Date() },
      });
      throw new AppError(400, 'Your email is already verified.');
    }

    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { jti: payload.jti },
        data: { usedAt: new Date() },
      }),
      prisma.candidateProfile.update({
        where: { id: tokenRecord.candidateId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
    ]);

    await candidateStatusService.markVerified(tokenRecord.candidateId);

    return {
      candidateId: tokenRecord.candidateId,
      candidateName: tokenRecord.candidate.fullName,
      email: tokenRecord.candidate.user.email,
    };
  }
}

export const emailVerificationService = new EmailVerificationService();
