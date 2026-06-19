import { Router } from 'express';
import registerRoutes from './register.routes';
import verifyRoutes from './verify.routes';
import verifyEmailRoutes from './verify-email.routes';
import authRoutes from './auth.routes';
import candidateRoutes from './candidate.routes';
import assessmentRoutes from './assessment.routes';
import adminRoutes from './admin.routes';
import visitorRoutes from './visitor.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/register', registerRoutes);
router.use('/verify', verifyRoutes);
router.use('/verify-email', verifyEmailRoutes);
router.use('/auth', authRoutes);
router.use('/candidate', candidateRoutes);
router.use('/assessment', assessmentRoutes);
router.use('/admin', adminRoutes);
router.use('/visitors', visitorRoutes);
router.use('/', healthRoutes);

export default router;
