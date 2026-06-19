import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AssessmentTokenPayload {
  sub: string;
  email: string;
  jti: string;
  type: 'assessment_link';
  iat?: number;
}

export interface CandidatePortalTokenPayload {
  sub: string;
  email: string;
  type: 'candidate_portal';
  iat?: number;
}

export interface AdminTokenPayload {
  sub: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  type: 'admin';
}

export interface EmailVerificationTokenPayload {
  sub: string;
  email: string;
  jti: string;
  type: 'verification';
}

/** @deprecated Use generateAssessmentToken for candidate flows */
export interface SessionTokenPayload {
  sub: string;
  type: 'assessment';
}

export function generateAssessmentToken(candidateId: string, email: string, jti: string): string {
  return jwt.sign(
    { sub: candidateId, email, jti, type: 'assessment_link' } as AssessmentTokenPayload,
    config.jwt.assessmentSecret,
    { expiresIn: `${config.jwt.assessmentTokenExpiryDays}d` }
  );
}

export function verifyAssessmentToken(token: string): AssessmentTokenPayload {
  const payload = jwt.verify(token, config.jwt.assessmentSecret) as AssessmentTokenPayload;
  if (payload.type !== 'assessment_link') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function generateCandidatePortalToken(candidateId: string, email: string): string {
  return jwt.sign(
    { sub: candidateId, email, type: 'candidate_portal' } as CandidatePortalTokenPayload,
    config.jwt.assessmentSecret,
    { expiresIn: `${config.jwt.candidatePortalExpiryDays}d` }
  );
}

export function verifyCandidatePortalToken(token: string): CandidatePortalTokenPayload {
  const payload = jwt.verify(token, config.jwt.assessmentSecret) as CandidatePortalTokenPayload;
  if (payload.type !== 'candidate_portal') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function generateAdminToken(adminId: string, email: string, role: 'SUPER_ADMIN' | 'ADMIN'): string {
  return jwt.sign(
    { sub: adminId, email, role, type: 'admin' } as AdminTokenPayload,
    config.jwt.adminSecret,
    { expiresIn: `${config.jwt.adminExpiryHours}h` }
  );
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  const payload = jwt.verify(token, config.jwt.adminSecret) as AdminTokenPayload;
  if (payload.type !== 'admin') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function generateEmailVerificationToken(
  candidateId: string,
  email: string,
  jti: string
): string {
  return jwt.sign(
    { sub: candidateId, email, jti, type: 'verification' } as EmailVerificationTokenPayload,
    config.jwt.assessmentSecret,
    { expiresIn: `${config.jwt.emailVerificationExpiryHours}h` }
  );
}

export function verifyEmailVerificationToken(token: string): EmailVerificationTokenPayload {
  const payload = jwt.verify(token, config.jwt.assessmentSecret) as EmailVerificationTokenPayload;
  if (payload.type !== 'verification') {
    throw new Error('Invalid token type');
  }
  return payload;
}
