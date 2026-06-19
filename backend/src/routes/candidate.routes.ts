import { Router } from 'express';
import { authenticateCandidatePortal } from '../middleware/auth';
import { getCandidateDashboard, getCandidateJobRoles } from '../controllers/candidate-portal.controller';
import { getAssessmentAccess } from '../controllers/candidate-auth.controller';
import {
  getVerificationStatus,
  resendVerificationEmail,
} from '../controllers/email-verification.controller';

const router = Router();

router.use(authenticateCandidatePortal);
router.get('/dashboard', getCandidateDashboard);
router.get('/job-roles', getCandidateJobRoles);
router.get('/assessment-token', getAssessmentAccess);
router.get('/verification-status', getVerificationStatus);
router.post('/resend-verification', resendVerificationEmail);

export default router;
