import { Router } from 'express';
import { verifyEmailLink } from '../controllers/email-verification.controller';

const router = Router();

router.get('/', verifyEmailLink);

export default router;
