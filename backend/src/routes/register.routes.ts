import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { uploadResume } from '../middleware/upload';
import { parseResume, register } from '../controllers/register.controller';

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});

router.post('/parse-resume', registerLimiter, uploadResume.single('resume'), parseResume);
router.post('/', registerLimiter, uploadResume.single('resume'), register);

export default router;
