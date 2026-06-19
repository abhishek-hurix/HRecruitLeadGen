import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { candidateAuthService } from '../services/candidate-auth.service';
import { AuthRequest } from '../middleware/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const googleSchema = z.object({
  credential: z.string().min(1),
});

const supabaseSchema = z.object({
  accessToken: z.string().min(1),
});

export async function candidateLogin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await candidateAuthService.loginWithPassword(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function candidateGoogleLogin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { credential } = googleSchema.parse(req.body);
    const result = await candidateAuthService.loginWithGoogle(credential);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function candidateSupabaseLogin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { accessToken } = supabaseSchema.parse(req.body);
    const result = await candidateAuthService.loginWithSupabase(accessToken);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getAssessmentAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await candidateAuthService.getAssessmentAccessToken(req.candidateId!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}
