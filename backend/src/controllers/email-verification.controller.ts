import { Response, NextFunction } from 'express';
import { emailVerificationService } from '../services/email-verification.service';
import { AuthRequest } from '../middleware/auth';

export async function getVerificationStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await emailVerificationService.getVerificationStatus(req.candidateId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function resendVerificationEmail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await emailVerificationService.resendVerificationEmail(req.candidateId!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailLink(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = (req.query.token as string) || req.body?.token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const result = await emailVerificationService.verifyEmail(token);
    res.json({
      success: true,
      candidateName: result.candidateName,
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
}
