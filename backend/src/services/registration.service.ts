import bcrypt from 'bcryptjs';
import pdfParse from 'pdf-parse';
import { AuthProvider, ExperienceCategory } from '@prisma/client';
import { prisma } from '../config/database';
import { storage } from './storage/storage.service';
import { assessmentTokenService } from './assessment-token.service';
import { emailVerificationService } from './email-verification.service';
import { candidateStatusService } from './candidate-status.service';
import { visitorService } from './visitor.service';
import { AppError, isValidEmail, isValidLinkedInUrl } from '../utils/errors';
import { parseAndValidatePhone } from '../utils/phone';
import { getExperienceYears, parseExperienceCategory } from '../utils/experience';
import { logger } from '../utils/logger';
import { supabaseAuthService } from './supabase-auth.service';

const DEFAULT_APPLIED_ROLE = 'General Application';

const EXPERIENCE_BY_YEARS: Record<number, ExperienceCategory> = {
  0: ExperienceCategory.FRESHER,
  1: ExperienceCategory.ONE_YEAR,
  2: ExperienceCategory.TWO_YEARS,
  3: ExperienceCategory.THREE_YEARS,
  4: ExperienceCategory.FOUR_YEARS,
  5: ExperienceCategory.FIVE_YEARS,
  6: ExperienceCategory.SIX_YEARS,
  7: ExperienceCategory.SEVEN_YEARS,
  8: ExperienceCategory.EIGHT_YEARS,
  9: ExperienceCategory.NINE_YEARS,
  10: ExperienceCategory.TEN_YEARS,
};

export interface RegistrationData {
  fullName: string;
  email: string;
  phoneCountryIso: string;
  phoneNumber: string;
  linkedinUrl: string;
  appliedRole?: string;
  referralCode?: string;
  password: string;
  visitorId?: string;
  experienceCategory: string;
}

export class RegistrationService {
  async parseResume(resumeFile: Express.Multer.File) {
    const parsed = await pdfParse(resumeFile.buffer);
    const text = parsed.text.replace(/\r/g, '\n');
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
    const linkedinUrl = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[^\s)]+/i)?.[0] || '';
    const phoneMatch = text.match(/(?:\+?91[\s-]?)?[6-9]\d[\d\s-]{8,12}/);
    const rawPhone = phoneMatch?.[0]?.replace(/[^\d+]/g, '') || '';
    const phoneCountryIso = rawPhone.startsWith('+91') || rawPhone.startsWith('91') ? 'IN' : undefined;
    const phoneNumber = rawPhone.replace(/^\+?91/, '').replace(/\D/g, '').slice(-10);

    const experienceText = text.match(/(\d{1,2})(?:\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/i)?.[1];
    const years = experienceText ? Math.min(parseInt(experienceText, 10), 10) : null;
    const experienceCategory = years === null
      ? (/\bfresher\b/i.test(text) ? ExperienceCategory.FRESHER : '')
      : EXPERIENCE_BY_YEARS[years] || ExperienceCategory.TEN_PLUS;

    const fullName = lines.find((line) => (
      line.length >= 2 &&
      line.length <= 60 &&
      !line.includes('@') &&
      !/https?:\/\//i.test(line) &&
      !/\d{4,}/.test(line) &&
      /^[a-z .'-]+$/i.test(line)
    )) || '';

    return {
      fullName,
      email,
      phoneCountryIso,
      phoneNumber,
      linkedinUrl,
      experienceCategory,
    };
  }

  async register(data: RegistrationData, resumeFile: Express.Multer.File) {
    if (!isValidEmail(data.email)) {
      throw new AppError(400, 'Invalid email format');
    }

    const experienceCategory = parseExperienceCategory(data.experienceCategory);
    if (!experienceCategory) {
      throw new AppError(400, 'Years of experience is required');
    }

    const parsedPhone = parseAndValidatePhone(data.phoneCountryIso, data.phoneNumber);

    if (!isValidLinkedInUrl(data.linkedinUrl)) {
      throw new AppError(400, 'Invalid LinkedIn URL');
    }
    if (data.fullName.trim().length < 2) {
      throw new AppError(400, 'Full name is required');
    }
    if (!data.password || data.password.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters');
    }

    const email = data.email.toLowerCase();
    const appliedRole = data.appliedRole?.trim() || DEFAULT_APPLIED_ROLE;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { candidateProfiles: true },
    });
    if (existingUser?.candidateProfiles.some((profile) => profile.appliedRole.toLowerCase() === appliedRole.toLowerCase())) {
      throw new AppError(409, 'An application with this email and role already exists.');
    }

    if (data.referralCode) {
      const referral = await prisma.referral.findUnique({
        where: { employeeId: data.referralCode },
      });
      if (!referral || !referral.isActive) {
        throw new AppError(400, 'Invalid referral code');
      }
    }

    const resumePath = await storage.save(resumeFile, 'resumes');
    let candidateId: string | null = null;
    let createdSupabaseUserId: string | null = null;
    let createdLocalUser = false;
    const passwordHash = await bcrypt.hash(data.password, 12);

    try {
      let supabaseUserId = existingUser?.supabaseUserId || null;
      if (supabaseUserId) {
        try {
          await supabaseAuthService.updateUserPassword(supabaseUserId, data.password);
        } catch (error) {
          if (!(error instanceof AppError) || !error.message.toLowerCase().includes('user not found')) {
            throw error;
          }

          const existingSupabaseUser = await supabaseAuthService.findUserByEmail(email);
          const supabaseUser = existingSupabaseUser || await supabaseAuthService.createEmailPasswordUser(email, data.password);
          supabaseUserId = supabaseUser?.id || null;
          createdSupabaseUserId = existingSupabaseUser ? null : supabaseUserId;
        }
      } else {
        const existingSupabaseUser = await supabaseAuthService.findUserByEmail(email);
        const supabaseUser = existingSupabaseUser || await supabaseAuthService.createEmailPasswordUser(email, data.password);
        supabaseUserId = supabaseUser?.id || null;
        createdSupabaseUserId = existingSupabaseUser ? null : supabaseUserId;
      }

      const candidateProfileData = {
        fullName: data.fullName.trim(),
        phone: parsedPhone.phoneNumber,
        countryCode: parsedPhone.countryCode,
        phoneNumber: parsedPhone.phoneNumber,
        fullPhone: parsedPhone.fullPhone,
        phoneCountry: parsedPhone.phoneCountry,
        experienceCategory,
        yearsOfExperience: getExperienceYears(experienceCategory),
        linkedinUrl: data.linkedinUrl.trim(),
        resumePath,
        appliedRole,
        referralCode: data.referralCode || null,
        resumes: {
          create: {
            fileName: resumeFile.originalname || `${data.fullName.trim().replace(/\s+/g, '_')}_resume.pdf`,
            filePath: resumePath,
            isPrimary: true,
          },
        },
      };

      const user = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash: existingUser.passwordHash || passwordHash,
              supabaseUserId,
              authProvider: existingUser.authProvider,
              candidateProfiles: {
                create: candidateProfileData,
              },
            },
            include: { candidateProfiles: { orderBy: { createdAt: 'desc' }, take: 1 } },
          })
        : await prisma.user.create({
            data: {
              email,
              passwordHash,
              supabaseUserId: createdSupabaseUserId,
              authProvider: AuthProvider.LOCAL,
              candidateProfiles: {
                create: candidateProfileData,
              },
            },
            include: { candidateProfiles: { orderBy: { createdAt: 'desc' }, take: 1 } },
          });
      createdLocalUser = !existingUser;

      candidateId = user.candidateProfiles[0]!.id;

      const { jti } = await assessmentTokenService.createToken(
        candidateId,
        email
      );

      await emailVerificationService.sendInitialVerificationEmail(
        candidateId,
        email,
        data.fullName.trim()
      );

      await assessmentTokenService.markEmailSent(jti);
      await candidateStatusService.markEmailSent(candidateId);

      if (data.visitorId) {
        await visitorService.linkToCandidate(data.visitorId, candidateId).catch(() => {});
      }

      return {
        candidateId,
        candidateName: data.fullName.trim(),
        email: user.email,
      };
    } catch (error) {
      if (candidateId) {
        const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
        if (profile) {
          await storage.delete(profile.resumePath).catch(() => {});
          if (createdLocalUser) {
            await prisma.user.delete({ where: { email } }).catch(() => {});
          } else {
            await prisma.candidateProfile.delete({ where: { id: candidateId } }).catch(() => {});
          }
        }
      } else {
        await storage.delete(resumePath).catch(() => {});
      }

      if (createdSupabaseUserId) {
        await supabaseAuthService.deleteUser(createdSupabaseUserId);
      }

      if (error instanceof AppError) throw error;

      const err = error as { code?: string; message?: string };
      const isEmailError = Boolean(
        err.code?.startsWith('E') ||
        err.message?.toLowerCase().includes('smtp') ||
        err.message?.toLowerCase().includes('mail') ||
        err.message?.toLowerCase().includes('recipient')
      );

      if (!isEmailError) {
        logger.error('Registration failed', {
          email,
          candidateId,
          code: err.code,
          message: err.message,
        });
        throw error;
      }

      logger.error('Registration email delivery failed', { email, candidateId });
      throw new AppError(
        503,
        'We were unable to send the verification email. Please try again later.'
      );
    }
  }
}

export const registrationService = new RegistrationService();
