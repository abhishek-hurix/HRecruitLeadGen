import { describe, it, expect, vi } from 'vitest';
import { AdminRole } from '@prisma/client';
import { requireAdmin, requireSuperAdmin, requirePermission } from '../../src/middleware/authorize';
import { Permission } from '../../src/config/permissions';
import { AppError } from '../../src/utils/errors';

function runGuard(guard: (req: any, res: any, next: any) => void, req: object) {
  return new Promise<Error | undefined>((resolve) => {
    guard(req as any, {} as any, (err?: unknown) => resolve(err as Error | undefined));
  });
}

describe('authorize middleware', () => {
  it('requireAdmin allows ADMIN and SUPER_ADMIN', async () => {
    expect(await runGuard(requireAdmin, { adminId: '1', adminRole: AdminRole.ADMIN })).toBeUndefined();
    expect(await runGuard(requireAdmin, { adminId: '1', adminRole: AdminRole.SUPER_ADMIN })).toBeUndefined();
  });

  it('requireAdmin rejects unauthenticated', async () => {
    const err = await runGuard(requireAdmin, {});
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
  });

  it('requireSuperAdmin blocks ADMIN', async () => {
    const err = await runGuard(requireSuperAdmin, { adminId: '1', adminRole: AdminRole.ADMIN });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  it('requirePermission enforces manage_candidates', async () => {
    const allow = requirePermission(Permission.MANAGE_CANDIDATES);
    expect(await runGuard(allow, { adminRole: AdminRole.ADMIN })).toBeUndefined();

    const deny = requirePermission(Permission.VIEW_DELETED_CANDIDATES);
    const err = await runGuard(deny, { adminRole: AdminRole.ADMIN });
    expect((err as AppError).statusCode).toBe(403);
  });
});

describe('audit service secret stripping', () => {
  it('does not throw when writing sanitized metadata', async () => {
    vi.mock('../../src/config/database', () => ({
      prisma: {
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: '1' }),
        },
      },
    }));
    const { auditService } = await import('../../src/services/audit.service');
    await expect(
      auditService.write({
        adminUserId: 'admin-1',
        action: 'REMINDER_SENT',
        metadata: { smtpPassword: 'secret', operationId: 'op-1' },
      })
    ).resolves.toBeUndefined();
  });
});
