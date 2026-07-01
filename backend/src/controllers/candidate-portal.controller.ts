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

export async function updateCandidatePhone(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const phone = String(req.body.phone || '');
    const data = await candidatePortalService.updatePhone(req.candidateId!, phone);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function uploadCandidateResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const resume = req.file;
    if (!resume) {
      return res.status(400).json({ success: false, message: 'Resume PDF is required' });
    }

    const data = await candidatePortalService.uploadResume(req.candidateId!, resume);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function setPrimaryCandidateResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const resumeId = String(req.body.resumeId || '');
    if (!resumeId) {
      return res.status(400).json({ success: false, message: 'Resume is required' });
    }

    const data = await candidatePortalService.setPrimaryResume(req.candidateId!, resumeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function downloadCandidateResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { buffer, filename } = await candidatePortalService.getResume(
      req.candidateId!,
      String(req.params.resumeId)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function deleteCandidateResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await candidatePortalService.deleteResume(req.candidateId!, String(req.params.resumeId));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
