import { AdminRole } from '@prisma/client';

export const Permission = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_CANDIDATES: 'view_candidates',
  VIEW_RESUMES: 'view_resumes',
  VIEW_ASSESSMENTS: 'view_assessments',
  CALL_CANDIDATE: 'call_candidate',
  EXPORT_CANDIDATES: 'export_candidates',
  MANAGE_QUESTIONS: 'manage_questions',
  MANAGE_JOB_ROLES: 'manage_job_roles',
  VIEW_JOB_ROLES: 'view_job_roles',
  MANAGE_ADMINS: 'manage_admins',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_ANALYTICS: 'view_analytics',
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

const SUPER_ADMIN_PERMISSIONS: PermissionKey[] = Object.values(Permission);

const ADMIN_PERMISSIONS: PermissionKey[] = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_CANDIDATES,
  Permission.VIEW_RESUMES,
  Permission.VIEW_ASSESSMENTS,
  Permission.CALL_CANDIDATE,
  Permission.VIEW_JOB_ROLES,
];

export function getPermissionsForRole(role: AdminRole): PermissionKey[] {
  if (role === AdminRole.SUPER_ADMIN) return SUPER_ADMIN_PERMISSIONS;
  return ADMIN_PERMISSIONS;
}

export function hasPermission(role: AdminRole, permission: PermissionKey): boolean {
  return getPermissionsForRole(role).includes(permission);
}
