import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId;

  const multerErr = err as Error & { code?: string; name?: string };
  if (multerErr.name === 'MulterError' && multerErr.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Resume file is too large',
      requestId,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      ...(err.details || {}),
      requestId,
    });
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack, requestId });
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    requestId,
  });
}
