import winston from 'winston';
import { config } from '../config';

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'hurix-talent-api' },
  transports: [new winston.transports.Console()],
});
