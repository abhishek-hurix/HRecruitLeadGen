import { Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { AppError } from '../utils/errors';
import { Permission, PermissionKey, hasPermission } from '../config/permissions';
import { AuthRequest } from './auth';

/** Authenticated Admin or Super Admin (any valid admin role). */
export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.adminId || !req.adminRole) {
    return next(new AppError(401, 'Authentication required'));
  }
  if (req.adminRole !== AdminRole.ADMIN && req.adminRole !== AdminRole.SUPER_ADMIN) {
    return next(new AppError(403, 'Access denied'));
  }
  next();
}

/** Super Admin only. */
export function requireSuperAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.adminId || !req.adminRole) {
    return next(new AppError(401, 'Authentication required'));
  }
  if (req.adminRole !== AdminRole.SUPER_ADMIN) {
    return next(new AppError(403, 'Access denied'));
  }
  next();
}

export function requireRole(...roles: AdminRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.adminRole || !roles.includes(req.adminRole)) {
      return next(new AppError(403, 'Access denied'));
    }
    next();
  };
}

export function requirePermission(...permissions: PermissionKey[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.adminRole) {
      return next(new AppError(403, 'Access denied'));
    }
    const allowed = permissions.every((p) => hasPermission(req.adminRole!, p));
    if (!allowed) {
      return next(new AppError(403, 'Access denied'));
    }
    next();
  };
}

export { Permission };
