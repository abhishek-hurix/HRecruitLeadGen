import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AdminRole } from '@prisma/client';
import { authenticateAdmin } from '../middleware/auth';
import { requirePermission, requireRole } from '../middleware/authorize';
import { Permission } from '../config/permissions';
import { validateBody } from '../middleware/validate';
import {
  login,
  getMe,
  getDashboard,
  getCandidates,
  getCountriesList,
  getCandidateById,
  getScoreBreakdown,
  getCandidateActivity,
  assignOwner,
  listOwners,
  downloadCandidateResume,
  downloadResume,
  exportCSV,
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getSubmission,
  getSubmissionMarkdown,
  runSubmissionAiReview,
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getSettings,
  updateSettings,
  getJobRoles,
  getJobRoleById,
  createJobRole,
  updateJobRole,
  deleteJobRole,
  setJobRoleStatus,
  generateJobRoleQuestions,
} from '../controllers/admin.controller';
import {
  bulkChangeStatus,
  bulkReject,
  bulkAssignRole,
  bulkSoftDelete,
  bulkSendReminders,
  listReminderTemplates,
  previewReminder,
  exportCandidates,
  listDeletedCandidates,
  getDeletedCandidate,
  restoreCandidate,
  permanentDeleteCandidate,
  scheduleInterview,
  getCalendarStatus,
} from '../controllers/candidate-management.controller';
import analyticsRoutes from './analytics.routes';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts.' },
});

const bulkActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many bulk operations. Please wait and try again.' },
});

const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many export requests. Please wait and try again.' },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SUPER_ADMIN', 'ADMIN']).default('ADMIN'),
});

const updateAdminSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN']).optional(),
  password: z.string().min(8).optional(),
});

const settingsSchema = z.object({
  assessment_question_count: z.string().optional(),
  assessment_duration_minutes: z.string().optional(),
});

const aiReviewSchema = z.object({
  roleApplied: z.string().trim().min(2).max(120).optional(),
});

const jobRoleSchema = z.object({
  title: z.string().min(2),
  country: z.string().min(2),
  compensationType: z.enum(['HOURLY', 'MONTHLY', 'ANNUAL']),
  hourlyRate: z.coerce.number().nullable().optional(),
  monthlySalary: z.coerce.number().nullable().optional(),
  currency: z.string().min(1),
  skills: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
  openPositions: z.coerce.number().int().min(1),
  closingDate: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  assessmentLanguages: z.array(z.enum(['PYTHON', 'JAVASCRIPT'])).min(1),
});

const jobRoleStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
});

router.post('/login', loginLimiter, validateBody(loginSchema), login);

router.use(authenticateAdmin);

router.get('/me', getMe);
router.get('/dashboard', requirePermission(Permission.VIEW_DASHBOARD), getDashboard);
router.get('/countries', requirePermission(Permission.VIEW_CANDIDATES), getCountriesList);
router.get('/candidate-owners', requirePermission(Permission.VIEW_CANDIDATES), listOwners);
router.get('/candidates', requirePermission(Permission.VIEW_CANDIDATES), getCandidates);
router.get('/candidates/export', requirePermission(Permission.EXPORT_CANDIDATES), exportCSV);
router.post('/candidates/export', exportLimiter, requirePermission(Permission.EXPORT_CANDIDATES), exportCandidates);
router.post('/candidates/bulk/status', bulkActionLimiter, requirePermission(Permission.MANAGE_CANDIDATES), bulkChangeStatus);
router.post('/candidates/bulk/reminders', bulkActionLimiter, requirePermission(Permission.MANAGE_CANDIDATES), bulkSendReminders);
router.post('/candidates/bulk/assign-role', bulkActionLimiter, requirePermission(Permission.MANAGE_CANDIDATES), bulkAssignRole);
router.post('/candidates/bulk/reject', bulkActionLimiter, requirePermission(Permission.MANAGE_CANDIDATES), bulkReject);
router.post('/candidates/bulk/delete', bulkActionLimiter, requirePermission(Permission.MANAGE_CANDIDATES), bulkSoftDelete);
router.post('/candidates/bulk/schedule-interview', bulkActionLimiter, requirePermission(Permission.MANAGE_CANDIDATES), scheduleInterview);
router.get('/reminder-templates', requirePermission(Permission.MANAGE_CANDIDATES), listReminderTemplates);
router.post('/reminder-templates/preview', requirePermission(Permission.MANAGE_CANDIDATES), previewReminder);
router.get('/calendar/status', requirePermission(Permission.MANAGE_CANDIDATES), getCalendarStatus);

router.get('/deleted-candidates', requirePermission(Permission.VIEW_DELETED_CANDIDATES), listDeletedCandidates);
router.get(
  '/deleted-candidates/:candidateId',
  requirePermission(Permission.VIEW_DELETED_CANDIDATES),
  getDeletedCandidate
);
router.post('/deleted-candidates/:candidateId/restore', requirePermission(Permission.VIEW_DELETED_CANDIDATES), restoreCandidate);
router.delete(
  '/deleted-candidates/:candidateId/permanent',
  requirePermission(Permission.PERMANENTLY_DELETE_CANDIDATES),
  permanentDeleteCandidate
);

router.get('/candidates/:id/score-breakdown', requirePermission(Permission.VIEW_CANDIDATES), getScoreBreakdown);
router.get('/candidates/:id/activity', requirePermission(Permission.VIEW_CANDIDATES), getCandidateActivity);
router.patch('/candidates/:id/owner', requireRole(AdminRole.SUPER_ADMIN), assignOwner);
router.get('/candidates/:id', requirePermission(Permission.VIEW_CANDIDATES), getCandidateById);
router.get('/candidates/:id/resume', requirePermission(Permission.VIEW_RESUMES), downloadResume);
router.get('/candidates/:id/resumes/:resumeId', requirePermission(Permission.VIEW_RESUMES), downloadCandidateResume);
router.get('/questions', requirePermission(Permission.MANAGE_QUESTIONS), getQuestions);
router.post('/questions', requirePermission(Permission.MANAGE_QUESTIONS), createQuestion);
router.put('/questions/:id', requirePermission(Permission.MANAGE_QUESTIONS), updateQuestion);
router.delete('/questions/:id', requirePermission(Permission.MANAGE_QUESTIONS), deleteQuestion);
router.get('/submissions/:id', requirePermission(Permission.VIEW_ASSESSMENTS), getSubmission);
router.get('/submissions/:id/markdown', requirePermission(Permission.VIEW_ASSESSMENTS), getSubmissionMarkdown);
router.post('/submissions/:id/ai-review', requirePermission(Permission.VIEW_ASSESSMENTS), validateBody(aiReviewSchema), runSubmissionAiReview);

router.get('/users', requireRole(AdminRole.SUPER_ADMIN), listAdmins);
router.post('/users', requireRole(AdminRole.SUPER_ADMIN), validateBody(createAdminSchema), createAdmin);
router.put('/users/:id', requireRole(AdminRole.SUPER_ADMIN), validateBody(updateAdminSchema), updateAdmin);
router.delete('/users/:id', requireRole(AdminRole.SUPER_ADMIN), deleteAdmin);

router.get('/settings', requirePermission(Permission.MANAGE_SETTINGS), getSettings);
router.put('/settings', requirePermission(Permission.MANAGE_SETTINGS), validateBody(settingsSchema), updateSettings);

router.get('/job-roles', requirePermission(Permission.VIEW_JOB_ROLES), getJobRoles);
router.get('/job-roles/:id', requirePermission(Permission.VIEW_JOB_ROLES), getJobRoleById);
router.post('/job-roles', requirePermission(Permission.MANAGE_JOB_ROLES), validateBody(jobRoleSchema), createJobRole);
router.put('/job-roles/:id', requirePermission(Permission.MANAGE_JOB_ROLES), validateBody(jobRoleSchema.partial()), updateJobRole);
router.patch('/job-roles/:id/status', requirePermission(Permission.MANAGE_JOB_ROLES), validateBody(jobRoleStatusSchema), setJobRoleStatus);
router.post('/job-roles/:id/generate-questions', requirePermission(Permission.MANAGE_JOB_ROLES), generateJobRoleQuestions);
router.delete('/job-roles/:id', requirePermission(Permission.MANAGE_JOB_ROLES), deleteJobRole);

router.use('/analytics', analyticsRoutes);

export default router;
