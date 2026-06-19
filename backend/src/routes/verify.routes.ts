import { Router } from 'express';
import { verifyAssessmentLink } from '../controllers/verify.controller';

const router = Router();

router.get('/', verifyAssessmentLink);

export default router;
