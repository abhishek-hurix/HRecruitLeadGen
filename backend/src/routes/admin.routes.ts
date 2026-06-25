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
  getCandidateById,
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
  markTestUser,
  unmarkTestUser,
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
import analyticsRoutes from './analytics.routes';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts.' },
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
router.get('/candidates', requirePermission(Permission.VIEW_CANDIDATES), getCandidates);
router.get('/candidates/export', requirePermission(Permission.EXPORT_CANDIDATES), exportCSV);
router.get('/candidates/:id', requirePermission(Permission.VIEW_CANDIDATES), getCandidateById);
router.post('/candidates/:id/mark-test-user', requireRole(AdminRole.SUPER_ADMIN), markTestUser);
router.post('/candidates/:id/unmark-test-user', requireRole(AdminRole.SUPER_ADMIN), unmarkTestUser);
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
