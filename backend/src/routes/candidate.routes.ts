import { Router } from 'express';
import { authenticateCandidatePortal } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';
import {
  deleteCandidateResume,
  downloadCandidateResume,
  getCandidateDashboard,
  getCandidateJobRoles,
  setPrimaryCandidateResume,
  updateCandidatePhone,
  uploadCandidateResume,
} from '../controllers/candidate-portal.controller';
import { getAssessmentAccess } from '../controllers/candidate-auth.controller';
import {
  getVerificationStatus,
  resendVerificationEmail,
} from '../controllers/email-verification.controller';
import {
  requestMobileOtp,
  verifyMobileOtp,
} from '../controllers/mobile-verification.controller';

const router = Router();

router.use(authenticateCandidatePortal);
router.get('/dashboard', getCandidateDashboard);
router.get('/job-roles', getCandidateJobRoles);
router.patch('/phone', updateCandidatePhone);
router.post('/resumes', uploadResume.single('resume'), uploadCandidateResume);
router.patch('/resumes/primary', setPrimaryCandidateResume);
router.get('/resumes/:resumeId', downloadCandidateResume);
router.delete('/resumes/:resumeId', deleteCandidateResume);
router.get('/assessment-token', getAssessmentAccess);
router.get('/verification-status', getVerificationStatus);
router.post('/resend-verification', resendVerificationEmail);
router.post('/mobile/request-otp', requestMobileOtp);
router.post('/mobile/verify-otp', verifyMobileOtp);

export default router;
