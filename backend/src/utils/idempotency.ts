import { createHash } from 'crypto';
import { prisma } from '../config/database';
import { AppError } from './errors';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function hashIdempotencyRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function beginIdempotentOperation<T>(params: {
  adminUserId: string;
  operationType: string;
  key: string;
  requestPayload: unknown;
  ttlMs?: number;
  execute: () => Promise<{ status: number; body: T }>;
}): Promise<T> {
  const requestHash = hashIdempotencyRequest(params.requestPayload);
  const existing = await prisma.idempotencyRecord.findUnique({
    where: {
      adminUserId_operationType_key: {
        adminUserId: params.adminUserId,
        operationType: params.operationType,
        key: params.key,
      },
    },
  });

  if (existing) {
    if (existing.expiresAt.getTime() < Date.now()) {
      await prisma.idempotencyRecord.delete({ where: { id: existing.id } });
    } else if (existing.requestHash !== requestHash) {
      throw new AppError(409, 'Idempotency key reused with a different request payload');
    } else {
      return existing.responseBody as T;
    }
  }

  const result = await params.execute();
  await prisma.idempotencyRecord.create({
    data: {
      key: params.key,
      adminUserId: params.adminUserId,
      operationType: params.operationType,
      requestHash,
      responseStatus: result.status,
      responseBody: result.body as object,
      expiresAt: new Date(Date.now() + (params.ttlMs || DEFAULT_TTL_MS)),
    },
  });
  return result.body;
}

export function candidateReferenceFromId(candidateId: string): string {
  return candidateId.replace(/-/g, '').slice(0, 8).toUpperCase();
}
