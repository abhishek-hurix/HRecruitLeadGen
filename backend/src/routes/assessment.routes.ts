import { Router } from 'express';
import { z } from 'zod';
import { authenticateAssessment } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  getReady,
  startAssessment,
  getSession,
  runCode,
  submitAssessment,
  getThankYou,
  listJobRoles,
  assignRole,
  selectRoleAndStart,
} from '../controllers/assessment.controller';

const router = Router();

const startSchema = z.object({
  language: z.enum(['PYTHON', 'JAVASCRIPT']).optional(),
});

const selectRoleSchema = z.object({
  jobRoleId: z.string().uuid(),
});

const runSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string().min(1),
});

const submitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    code: z.string().optional(),
    selectedOptionIndex: z.number().int().min(0).max(3).nullable().optional(),
  })).min(1),
});

router.get('/ready', authenticateAssessment, getReady);
router.get('/job-roles', authenticateAssessment, listJobRoles);
router.post('/assign-role', authenticateAssessment, validateBody(selectRoleSchema), assignRole);
router.post('/select-role', authenticateAssessment, validateBody(selectRoleSchema), selectRoleAndStart);
router.post('/start', authenticateAssessment, validateBody(startSchema), startAssessment);
router.get('/session', authenticateAssessment, getSession);
router.post('/run', authenticateAssessment, validateBody(runSchema), runCode);
router.post('/submit', authenticateAssessment, validateBody(submitSchema), submitAssessment);
router.get('/thank-you', authenticateAssessment, getThankYou);

export default router;
