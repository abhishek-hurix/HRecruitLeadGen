import { Request, Response, NextFunction } from 'express';
import { AdminRole, CandidateCreationSource, TokenStatus } from '@prisma/client';
import { verifyAssessmentToken, verifyCandidatePortalToken, verifyAdminToken } from '../utils/jwt';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { assessmentTokenService } from '../services/assessment-token.service';

export interface AuthRequest extends Request {
  candidateId?: string;
  adminId?: string;
  adminEmail?: string;
  adminRole?: AdminRole;
  tokenJti?: string;
}

export async function authenticateAssessment(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token as string);

    if (!token) {
      throw new AppError(401, 'Assessment token required');
    }

    let payload;
    try {
      payload = verifyAssessmentToken(token);
    } catch {
      throw new AppError(401, 'Invalid or expired assessment link');
    }

    const tokenRecord = await prisma.assessmentToken.findUnique({
      where: { jti: payload.jti },
      include: { candidate: { include: { submissions: true } } },
    });

    if (!tokenRecord || tokenRecord.isRevoked) {
      throw new AppError(401, 'Invalid or expired assessment link');
    }

    if (tokenRecord.expiresAt < new Date()) {
      await assessmentTokenService.markExpired(payload.jti);
      throw new AppError(401, 'Assessment link has expired');
    }

    if (tokenRecord.status === TokenStatus.EXPIRED) {
      throw new AppError(401, 'Assessment link has expired');
    }

    if (tokenRecord.status === TokenStatus.SUBMITTED) {
      const isThankYou = req.path.endsWith('/thank-you');
      const isReady = req.path.endsWith('/ready');
      const isRoleSelection = req.path.endsWith('/select-role');
      if (!isThankYou && !isReady && !isRoleSelection) {
        throw new AppError(403, 'You have already completed this assessment.');
      }
    }

    // Admin-created candidates are trusted (admin emails them the link directly),
    // so they don't need the separate email-verification step.
    const isAdminCreated =
      tokenRecord.candidate.creationSource === CandidateCreationSource.ADMIN_CREATED;
    if (!tokenRecord.candidate.emailVerified && !isAdminCreated) {
      throw new AppError(401, 'Email verification required. Please use your assessment link.');
    }

    req.candidateId = payload.sub;
    req.tokenJti = payload.jti;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError(401, 'Invalid or expired assessment link'));
  }
}

export async function authenticateAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Admin authentication required');
    }

    const token = authHeader.slice(7);

    try {
      verifyCandidatePortalToken(token);
      throw new AppError(403, 'Candidate credentials cannot access admin resources');
    } catch (err) {
      if (err instanceof AppError) throw err;
    }

    try {
      verifyAssessmentToken(token);
      throw new AppError(403, 'Assessment credentials cannot access admin resources');
    } catch (err) {
      if (err instanceof AppError) throw err;
    }

    let payload;
    try {
      payload = verifyAdminToken(token);
    } catch {
      throw new AppError(401, 'Invalid or expired admin session');
    }

    if (payload.role !== AdminRole.SUPER_ADMIN && payload.role !== AdminRole.ADMIN) {
      throw new AppError(403, 'Access denied');
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin || admin.email !== payload.email) {
      throw new AppError(401, 'Invalid admin credentials');
    }

    if (admin.role !== payload.role) {
      throw new AppError(401, 'Invalid or expired admin session');
    }

    req.adminId = admin.id;
    req.adminEmail = admin.email;
    req.adminRole = admin.role;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError(401, 'Invalid or expired admin session'));
  }
}

export async function authenticateCandidatePortal(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Candidate authentication required');
    }

    const token = authHeader.slice(7);

    try {
      verifyAdminToken(token);
      throw new AppError(403, 'Admin credentials cannot access candidate resources');
    } catch (err) {
      if (err instanceof AppError) throw err;
    }

    let payload;
    try {
      payload = verifyCandidatePortalToken(token);
    } catch {
      throw new AppError(401, 'Invalid or expired session');
    }

    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: payload.sub },
      include: { user: true },
    });

    if (!candidate || candidate.user.email !== payload.email) {
      throw new AppError(401, 'Invalid session');
    }

    req.candidateId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    next(new AppError(401, 'Invalid or expired session'));
  }
}

export const authenticateSession = authenticateAssessment;
