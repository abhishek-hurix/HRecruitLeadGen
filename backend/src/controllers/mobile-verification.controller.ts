import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { mobileVerificationService } from '../services/mobile-verification.service';

export async function requestMobileOtp(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await mobileVerificationService.requestOtp(req.candidateId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function verifyMobileOtp(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const otp = String(req.body.otp || '');
    const data = await mobileVerificationService.verifyOtp(req.candidateId!, otp);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
