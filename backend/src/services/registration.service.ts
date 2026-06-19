import bcrypt from 'bcryptjs';
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

export interface RegistrationData {
  fullName: string;
  email: string;
  phoneCountryIso: string;
  phoneNumber: string;
  linkedinUrl: string;
  appliedRole: string;
  referralCode?: string;
  password: string;
  visitorId?: string;
  experienceCategory: string;
}

export class RegistrationService {
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
    if (!data.appliedRole || data.appliedRole.trim().length < 2) {
      throw new AppError(400, 'Applied role is required');
    }
    if (!data.password || data.password.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters');
    }

    const email = data.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { candidateProfiles: true },
    });
    if (existingUser?.candidateProfiles.some((profile) => profile.appliedRole.toLowerCase() === data.appliedRole.trim().toLowerCase())) {
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
        appliedRole: data.appliedRole.trim(),
        referralCode: data.referralCode || null,
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

      logger.error('Registration email delivery failed', { email, candidateId });
      throw new AppError(
        503,
        'We were unable to send the verification email. Please try again later.'
      );
    }
  }
}

export const registrationService = new RegistrationService();
