import { Response, NextFunction } from 'express';
import { visitorService } from '../services/visitor.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../utils/errors';

export async function trackVisitor(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const {
      visitorId,
      landingPage,
      referrer,
      deviceType,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      heartbeat,
      is_test,
    } = req.body;

    if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 8 || visitorId.length > 64) {
      throw new AppError(400, 'Invalid visitor ID');
    }
    if (!heartbeat && (!landingPage || typeof landingPage !== 'string')) {
      throw new AppError(400, 'Landing page URL is required');
    }

    const result = await visitorService.track({
      visitorId,
      landingPage: landingPage || '',
      referrer: referrer || null,
      deviceType,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      heartbeat: heartbeat === true,
      is_test: is_test === true,
    });

    res.json({ success: true, isNew: result.isNew });
  } catch (error) {
    next(error);
  }
}
