import { describe, it, expect } from 'vitest';
import { AdminRole } from '@prisma/client';
import { Permission, getPermissionsForRole, hasPermission } from '../../src/config/permissions';

describe('RBAC permissions', () => {
  it('grants all permissions to SUPER_ADMIN', () => {
    const perms = getPermissionsForRole(AdminRole.SUPER_ADMIN);
    expect(perms).toContain(Permission.VIEW_ANALYTICS);
    expect(perms).toContain(Permission.MANAGE_ADMINS);
    expect(perms.length).toBe(Object.values(Permission).length);
  });

  it('restricts ADMIN role permissions', () => {
    const perms = getPermissionsForRole(AdminRole.ADMIN);
    expect(perms).toContain(Permission.VIEW_CANDIDATES);
    expect(perms).not.toContain(Permission.MANAGE_ADMINS);
    expect(perms).not.toContain(Permission.VIEW_ANALYTICS);
  });

  it('checks individual permissions', () => {
    expect(hasPermission(AdminRole.SUPER_ADMIN, Permission.EXPORT_CANDIDATES)).toBe(true);
    expect(hasPermission(AdminRole.ADMIN, Permission.EXPORT_CANDIDATES)).toBe(false);
    expect(hasPermission(AdminRole.ADMIN, Permission.CALL_CANDIDATE)).toBe(true);
  });
});
