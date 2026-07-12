import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { logger } from './utils/logger';
import { emailService } from './services/email.service';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));

  app.use(requestIdMiddleware);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', routes);

  app.use(errorHandler);

  return app;
}


export function startServer() {
  const app = createApp();
  app.listen(config.port, async () => {
    logger.info(`Hurix Talent API running on port ${config.port}`);
    if (config.email.smtp.host && config.email.smtp.user) {
      const ok = await emailService.verifyConnection();
      if (!ok) {
        logger.warn('SMTP not verified — assessment emails may fail until credentials are fixed');
      }
    } else {
      logger.warn('SMTP not configured — set EMAIL_FROM, SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    }
  });
  return app;
}
