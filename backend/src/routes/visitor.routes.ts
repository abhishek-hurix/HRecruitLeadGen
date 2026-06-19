import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { trackVisitor } from '../controllers/visitor.controller';

const router = Router();

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, message: 'Too many tracking requests.' },
});

const trackSchema = z.object({
  visitorId: z.string().min(8).max(64),
  landingPage: z.string().max(2048).optional(),
  referrer: z.string().max(2048).optional().nullable(),
  deviceType: z.enum(['DESKTOP', 'TABLET', 'MOBILE']).optional(),
  utm_source: z.string().max(255).optional(),
  utm_medium: z.string().max(255).optional(),
  utm_campaign: z.string().max(255).optional(),
  utm_term: z.string().max(255).optional(),
  utm_content: z.string().max(255).optional(),
  heartbeat: z.boolean().optional(),
  is_test: z.boolean().optional(),
}).refine(
  (data) => data.heartbeat === true || (data.landingPage && data.landingPage.length > 0),
  { message: 'Landing page URL is required for initial tracking' }
);

router.post('/track', trackLimiter, validateBody(trackSchema), trackVisitor);

export default router;
