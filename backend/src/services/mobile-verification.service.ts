import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const MAX_RESENDS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;
const OTP_EXPIRY_MINUTES = 10;

export class MobileVerificationService {
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
    const candidate = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new AppError(404, 'Candidate not found');

    const { attempts } = this.resetRateLimitWindowIfNeeded(
      candidate.phoneVerificationAttempts,
      candidate.phoneVerificationAttemptsWindowStart
    );

    return {
      phoneVerified: candidate.phoneVerified,
      verifiedAt: candidate.phoneVerifiedAt,
      otpSentAt: candidate.phoneOtpSentAt,
      resendsRemaining: Math.max(0, MAX_RESENDS_PER_HOUR - attempts),
      canResend: !candidate.phoneVerified && attempts < MAX_RESENDS_PER_HOUR,
    };
  }

  async requestOtp(candidateId: string) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new AppError(404, 'Candidate not found');

    if (candidate.phoneVerified) {
      throw new AppError(400, 'Your mobile number is already verified.');
    }

    const { attempts, windowStart } = this.resetRateLimitWindowIfNeeded(
      candidate.phoneVerificationAttempts,
      candidate.phoneVerificationAttemptsWindowStart
    );

    if (attempts >= MAX_RESENDS_PER_HOUR) {
      throw new AppError(429, 'Too many OTP requests. Please try again later.');
    }

    const otp = String(randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const phone = candidate.fullPhone || `${candidate.countryCode}${candidate.phoneNumber || candidate.phone}`;

    await prisma.$transaction([
      prisma.mobileVerificationOtp.updateMany({
        where: { candidateId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.mobileVerificationOtp.create({
        data: { candidateId, otpHash, phone, expiresAt },
      }),
      prisma.candidateProfile.update({
        where: { id: candidateId },
        data: {
          phoneOtpSentAt: new Date(),
          phoneVerificationAttempts: attempts + 1,
          phoneVerificationAttemptsWindowStart: windowStart,
        },
      }),
    ]);

    logger.info('Mobile verification OTP generated', {
      candidateId,
      phone,
      devOtp: config.nodeEnv === 'production' ? undefined : otp,
    });

    return {
      message: 'OTP sent successfully.',
      otpSentAt: new Date(),
      resendsRemaining: Math.max(0, MAX_RESENDS_PER_HOUR - attempts - 1),
      devOtp: config.nodeEnv === 'production' ? undefined : otp,
    };
  }

  async verifyOtp(candidateId: string, otp: string) {
    const normalizedOtp = otp.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      throw new AppError(400, 'Please enter a valid 6-digit OTP.');
    }

    const candidate = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new AppError(404, 'Candidate not found');
    if (candidate.phoneVerified) throw new AppError(400, 'Your mobile number is already verified.');

    const tokens = await prisma.mobileVerificationOtp.findMany({
      where: {
        candidateId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    for (const token of tokens) {
      const matches = await bcrypt.compare(normalizedOtp, token.otpHash);
      if (!matches) continue;

      await prisma.$transaction([
        prisma.mobileVerificationOtp.update({
          where: { id: token.id },
          data: { usedAt: new Date() },
        }),
        prisma.candidateProfile.update({
          where: { id: candidateId },
          data: {
            phoneVerified: true,
            phoneVerifiedAt: new Date(),
          },
        }),
      ]);

      return {
        phoneVerified: true,
        verifiedAt: new Date(),
      };
    }

    throw new AppError(400, 'Invalid or expired OTP.');
  }
}

export const mobileVerificationService = new MobileVerificationService();
