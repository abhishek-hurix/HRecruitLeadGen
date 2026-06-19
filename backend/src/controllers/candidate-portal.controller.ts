import { Response, NextFunction } from 'express';
import { candidatePortalService } from '../services/candidate-portal.service';
import { assessmentService } from '../services/assessment.service';
import { AuthRequest } from '../middleware/auth';

export async function getCandidateDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await candidatePortalService.getDashboard(req.candidateId!);
    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getCandidateJobRoles(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roles = await assessmentService.listJobRoles();
    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
}
