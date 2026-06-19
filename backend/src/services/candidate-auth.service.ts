import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { AuthProvider } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { generateCandidatePortalToken } from '../utils/jwt';
import { assessmentTokenService } from './assessment-token.service';
import { supabaseAuthService } from './supabase-auth.service';

const googleClient = new OAuth2Client(config.google.clientId);
const latestCandidateProfileInclude = {
  candidateProfiles: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

export class CandidateAuthService {
  private async issueSession(userId: string, candidateId: string, email: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    const token = generateCandidatePortalToken(candidateId, email);
    const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    if (!profile) throw new AppError(404, 'Candidate profile not found');

    return {
      token,
      candidate: {
        id: candidateId,
        fullName: profile.fullName,
        email,
      },
    };
  }

  async loginWithPassword(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: latestCandidateProfileInclude,
    });
    const candidateProfile = user?.candidateProfiles[0];

    if (!user || !candidateProfile) {
      throw new AppError(401, 'Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new AppError(401, 'Password not set. Please sign in with Google or contact support.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Invalid email or password');
    }

    return this.issueSession(user.id, candidateProfile.id, user.email);
  }

  async loginWithGoogle(credential: string) {
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AppError(401, 'Invalid Google sign-in');
    }

    if (!payload?.email || !payload.sub) {
      throw new AppError(401, 'Google account email not available');
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;

    const user = await prisma.user.findUnique({
      where: { email },
      include: latestCandidateProfileInclude,
    });
    const candidateProfile = user?.candidateProfiles[0];

    if (!user || !candidateProfile) {
      throw new AppError(
        404,
        'No application found for this email. Please register first before signing in.'
      );
    }

    if (user.googleId && user.googleId !== googleId) {
      throw new AppError(409, 'This email is linked to a different Google account.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId,
        authProvider: user.passwordHash ? AuthProvider.BOTH : AuthProvider.GOOGLE,
      },
    });

    return this.issueSession(user.id, candidateProfile.id, email);
  }

  async loginWithSupabase(accessToken: string) {
    const supabaseUser = await supabaseAuthService.verifyAccessToken(accessToken);
    const email = supabaseUser.email!.toLowerCase();
    const provider = typeof supabaseUser.app_metadata?.provider === 'string'
      ? supabaseUser.app_metadata.provider
      : 'supabase';

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { supabaseUserId: supabaseUser.id },
          { email },
        ],
      },
      include: latestCandidateProfileInclude,
    });
    let candidateProfile = user?.candidateProfiles[0];

    if (!user || !candidateProfile) {
      if (user) {
        if (!user.supabaseUserId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { supabaseUserId: supabaseUser.id },
            include: latestCandidateProfileInclude,
          });
          candidateProfile = user.candidateProfiles[0];
        }
      } else {
        user = await prisma.user.create({
          data: {
            email,
            supabaseUserId: supabaseUser.id,
            authProvider: provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.LOCAL,
          },
          include: latestCandidateProfileInclude,
        });
        candidateProfile = user.candidateProfiles[0];
      }

      if (!candidateProfile) return {
        token: null,
        requiresRegistration: true,
        candidate: null,
        email,
      };
    }

    if (!user.supabaseUserId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { supabaseUserId: supabaseUser.id },
        include: latestCandidateProfileInclude,
      });
      candidateProfile = user.candidateProfiles[0];
    }

    return this.issueSession(user.id, candidateProfile.id, user.email);
  }

  async getAssessmentAccessToken(candidateId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        user: true,
        assessmentTokens: { where: { isRevoked: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!candidate) throw new AppError(404, 'Candidate not found');
    if (!candidate.emailVerified) {
      throw new AppError(403, 'Please verify your email before starting the assessment.');
    }

    const existing = candidate.assessmentTokens[0];
    if (existing && existing.expiresAt > new Date() && existing.status !== 'SUBMITTED') {
      const { generateAssessmentToken } = await import('../utils/jwt');
      return {
        token: generateAssessmentToken(candidateId, candidate.user.email, existing.jti),
      };
    }

    const { token } = await assessmentTokenService.createToken(candidateId, candidate.user.email);
    return { token };
  }
}

export const candidateAuthService = new CandidateAuthService();
