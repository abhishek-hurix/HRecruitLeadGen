import bcrypt from 'bcryptjs';
import pdfParse from 'pdf-parse';
import { randomUUID } from 'crypto';
import {
  AuthProvider,
  CandidateActivityType,
  CandidateCreationSource,
  ExperienceCategory,
} from '@prisma/client';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { prisma } from '../config/database';
import { storage, storagePathOf } from './storage/storage.service';
import { assessmentTokenService } from './assessment-token.service';
import { emailVerificationService } from './email-verification.service';
import { candidateStatusService } from './candidate-status.service';
import { visitorService } from './visitor.service';
import { AppError, isValidEmail, isValidLinkedInUrl } from '../utils/errors';
import { parseAndValidatePhone } from '../utils/phone';
import { getExperienceYears, parseExperienceCategory } from '../utils/experience';
import { applicationIdFromUuid, normalizeEmail } from '../utils/application-id';
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

function normalizeResumeText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[|•·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLinkedInUrl(text: string) {
  const compactText = text
    .replace(/\s*([/:.?=&_-])\s*/g, '$1')
    .replace(/\s+/g, ' ');
  const match = compactText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub)\/[a-z0-9._-]+\/?/i);
  if (!match) return '';

  const url = match[0].replace(/[),.;]+$/g, '');
  return url.startsWith('http') ? url : `https://${url}`;
}

function extractPhone(text: string): { phoneCountryIso?: CountryCode; phoneNumber: string } {
  const matches = text.match(/(?:\+?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){10,14}/g) || [];

  for (const candidate of matches) {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) continue;

    const internationalDigits = digits.startsWith('91') && digits.length === 12
      ? `+${digits}`
      : candidate.trim().startsWith('+')
        ? `+${digits}`
        : null;

    const parsed = internationalDigits
      ? parsePhoneNumberFromString(internationalDigits)
      : parsePhoneNumberFromString(digits.slice(-10), 'IN');

    if (parsed?.isValid() && parsed.country) {
      return {
        phoneCountryIso: parsed.country,
        phoneNumber: parsed.nationalNumber,
      };
    }
  }

  return { phoneNumber: '' };
}

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
    const normalizedText = normalizeResumeText(text);
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const email = normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
    const linkedinUrl = extractLinkedInUrl(text);
    const { phoneCountryIso, phoneNumber } = extractPhone(text);

    const experienceText = normalizedText.match(/(\d{1,2})(?:\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/i)?.[1];
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

    const linkedinUrl = (data.linkedinUrl || '').trim();
    if (linkedinUrl && !isValidLinkedInUrl(linkedinUrl)) {
      throw new AppError(400, 'Invalid LinkedIn URL');
    }
    if (data.fullName.trim().length < 2) {
      throw new AppError(400, 'Full name is required');
    }
    if (!data.password || data.password.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters');
    }

    const email = normalizeEmail(data.email);
    const appliedRole = data.appliedRole?.trim() || DEFAULT_APPLIED_ROLE;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { normalizedEmail: email }],
      },
      include: { candidateProfiles: { where: { deletedAt: null } } },
    });

    const pendingInviteProfile = existingUser?.candidateProfiles
      .filter(
        (profile) =>
          profile.creationSource === CandidateCreationSource.ADMIN_CREATED &&
          !profile.resumePath &&
          !profile.deletedAt
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (
      !pendingInviteProfile &&
      existingUser?.candidateProfiles.some(
        (profile) => profile.appliedRole.toLowerCase() === appliedRole.toLowerCase()
      )
    ) {
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

    const resumeSaved = await storage.save(resumeFile, 'resumes');
    const resumePath = storagePathOf(resumeSaved);
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

      const profileId = pendingInviteProfile?.id || randomUUID();
      const now = new Date();
      const candidateProfileData = {
        id: profileId,
        applicationId: pendingInviteProfile?.applicationId || applicationIdFromUuid(profileId),
        fullName: data.fullName.trim(),
        phone: parsedPhone.phoneNumber,
        countryCode: parsedPhone.countryCode,
        phoneNumber: parsedPhone.phoneNumber,
        fullPhone: parsedPhone.fullPhone,
        phoneCountry: parsedPhone.phoneCountry,
        phoneCountryIso: parsedPhone.iso,
        experienceCategory,
        yearsOfExperience: getExperienceYears(experienceCategory),
        linkedinUrl: linkedinUrl || '',
        resumePath,
        appliedRole,
        referralCode: data.referralCode || null,
        creationSource: pendingInviteProfile
          ? CandidateCreationSource.ADMIN_CREATED
          : CandidateCreationSource.SELF_REGISTERED,
        lastActivityAt: now,
        lastActivityType: CandidateActivityType.REGISTERED,
        resumes: {
          create: {
            fileName: resumeFile.originalname || `${data.fullName.trim().replace(/\s+/g, '_')}_resume.pdf`,
            filePath: resumePath,
            storagePath: resumePath,
            mimeType: resumeFile.mimetype || 'application/pdf',
            sizeBytes: resumeFile.size || null,
            uploadedAt: now,
            isPrimary: true,
          },
        },
        activities: {
          create: {
            id: randomUUID(),
            type: CandidateActivityType.REGISTERED,
            occurredAt: now,
            metadata: {
              source: pendingInviteProfile ? 'admin_invite_registration_complete' : 'self_registration',
            },
          },
        },
      };

      let registeredEmail = email;

      if (pendingInviteProfile) {
        const updated = await prisma.user.update({
          where: { id: existingUser!.id },
          data: {
            passwordHash,
            supabaseUserId,
            authProvider: existingUser!.authProvider,
            normalizedEmail: email,
            candidateProfiles: {
              update: {
                where: { id: pendingInviteProfile.id },
                data: {
                  fullName: candidateProfileData.fullName,
                  phone: candidateProfileData.phone,
                  countryCode: candidateProfileData.countryCode,
                  phoneNumber: candidateProfileData.phoneNumber,
                  fullPhone: candidateProfileData.fullPhone,
                  phoneCountry: candidateProfileData.phoneCountry,
                  phoneCountryIso: candidateProfileData.phoneCountryIso,
                  experienceCategory: candidateProfileData.experienceCategory,
                  yearsOfExperience: candidateProfileData.yearsOfExperience,
                  linkedinUrl: candidateProfileData.linkedinUrl,
                  resumePath: candidateProfileData.resumePath,
                  referralCode: candidateProfileData.referralCode,
                  lastActivityAt: now,
                  lastActivityType: CandidateActivityType.REGISTERED,
                  resumes: candidateProfileData.resumes,
                  activities: candidateProfileData.activities,
                },
              },
            },
          },
          include: { candidateProfiles: { where: { id: pendingInviteProfile.id } } },
        });
        candidateId = updated.candidateProfiles[0]!.id;
        registeredEmail = updated.email;
        createdLocalUser = false;
      } else {
        const user = existingUser
          ? await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                passwordHash: existingUser.passwordHash || passwordHash,
                supabaseUserId,
                authProvider: existingUser.authProvider,
                normalizedEmail: email,
                candidateProfiles: {
                  create: candidateProfileData,
                },
              },
              include: { candidateProfiles: { orderBy: { createdAt: 'desc' }, take: 1 } },
            })
          : await prisma.user.create({
              data: {
                email,
                normalizedEmail: email,
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
        registeredEmail = user.email;
      }

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
        email: registeredEmail,
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
