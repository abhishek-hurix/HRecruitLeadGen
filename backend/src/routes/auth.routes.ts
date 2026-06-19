import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { candidateLogin, candidateGoogleLogin, candidateSupabaseLogin } from '../controllers/candidate-auth.controller';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

router.post('/login', authLimiter, candidateLogin);
router.post('/google', authLimiter, candidateGoogleLogin);
router.post('/supabase', authLimiter, candidateSupabaseLogin);

export default router;
