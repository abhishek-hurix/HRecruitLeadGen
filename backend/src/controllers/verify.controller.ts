import { Response, NextFunction } from 'express';
import { verifyService } from '../services/verify.service';
import { AuthRequest } from '../middleware/auth';

export async function verifyAssessmentLink(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = (req.query.token as string) || req.body?.token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const result = await verifyService.verifyToken(token);
    res.json({
      success: true,
      token: result.token,
      candidateName: result.candidateName,
      email: result.email,
    });
  } catch (error) {
    next(error);
  }
}
