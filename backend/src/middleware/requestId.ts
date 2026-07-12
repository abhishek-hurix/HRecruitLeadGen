import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header(REQUEST_ID_HEADER)?.trim();
  const requestId =
    incoming && /^[A-Za-z0-9_-]{8,64}$/.test(incoming)
      ? incoming
      : `req_${randomBytes(8).toString('hex')}`;
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
