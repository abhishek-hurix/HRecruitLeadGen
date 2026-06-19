import { Response, NextFunction } from 'express';
import { assessmentService } from '../services/assessment.service';
import { AuthRequest } from '../middleware/auth';

export async function getReady(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const info = await assessmentService.getReadyInfo(req.candidateId!);
    res.json(info);
  } catch (error) {
    next(error);
  }
}

export async function startAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { language } = req.body;
    const result = await assessmentService.startAssessment(req.candidateId!, language);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSession(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await assessmentService.getActiveSession(req.candidateId!);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function runCode(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { questionId, code } = req.body;
    const result = await assessmentService.runCode(req.candidateId!, questionId, code);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function submitAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { answers } = req.body;
    const result = await assessmentService.submitAssessment(req.candidateId!, answers);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getThankYou(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const info = await assessmentService.getThankYouInfo(req.candidateId!);
    res.json(info);
  } catch (error) {
    next(error);
  }
}

export async function listJobRoles(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roles = await assessmentService.listJobRoles();
    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
}

export async function selectRoleAndStart(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { jobRoleId } = req.body;
    const result = await assessmentService.selectRoleAndStart(req.candidateId!, jobRoleId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
