import { Response, NextFunction } from 'express';
import { Language, Difficulty, AdminRole, CompensationType, JobRoleStatus } from '@prisma/client';
import { adminService } from '../services/admin.service';
import { jobRoleService } from '../services/job-role.service';
import { AuthRequest } from '../middleware/auth';

export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await adminService.login(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getMe(req.adminId!);
    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getDashboard(req.adminRole!);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function getCandidates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { search, status, experience, country, role, minScore, candidateType, page, limit } = req.query;
    const parsedMinScore = minScore !== undefined && minScore !== ''
      ? Number(minScore)
      : undefined;
    const result = await adminService.getCandidates({
      search: search as string,
      status: status as string,
      experience: experience as string,
      country: country as string,
      role: role as string,
      minScore: Number.isFinite(parsedMinScore) ? parsedMinScore : undefined,
      candidateType: (candidateType as 'real' | 'test' | 'all') || 'real',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const candidate = await adminService.getCandidateById(String(req.params.id));
    res.json(candidate);
  } catch (error) {
    next(error);
  }
}

export async function downloadResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { buffer, filename } = await adminService.getResume(String(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function downloadCandidateResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { buffer, filename } = await adminService.getCandidateResume(
      String(req.params.id),
      String(req.params.resumeId)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function exportCSV(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const includeTestUsers = req.query.includeTestUsers === 'true' && req.adminRole === AdminRole.SUPER_ADMIN;
    const csv = await adminService.exportCandidatesCSV(includeTestUsers);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="candidates.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function markTestUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await adminService.markTestUser(String(req.params.id), req.adminId!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function unmarkTestUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await adminService.unmarkTestUser(String(req.params.id), req.adminId!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getQuestions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { language, page, limit, jobRoleId } = req.query;
    const result = await adminService.getQuestions(
      language as Language | undefined,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20,
      jobRoleId as string | undefined
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createQuestion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const question = await adminService.createQuestion(req.body, req.adminId!);
    res.status(201).json(question);
  } catch (error) {
    next(error);
  }
}

export async function updateQuestion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const question = await adminService.updateQuestion(String(req.params.id), req.body, req.adminId!);
    res.json(question);
  } catch (error) {
    next(error);
  }
}

export async function deleteQuestion(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await adminService.deleteQuestion(String(req.params.id), req.adminId!);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function getSubmission(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const submission = await adminService.getSubmission(String(req.params.id));
    res.json(submission);
  } catch (error) {
    next(error);
  }
}

export async function getSubmissionMarkdown(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { markdown, filename } = await adminService.getSubmissionMarkdown(String(req.params.id));
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(markdown);
  } catch (error) {
    next(error);
  }
}

export async function runSubmissionAiReview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const submission = await adminService.runAiReview(String(req.params.id), req.body.roleApplied);
    res.json(submission);
  } catch (error) {
    next(error);
  }
}

export async function listAdmins(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const admins = await adminService.listAdmins();
    res.json({ data: admins });
  } catch (error) {
    next(error);
  }
}

export async function createAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const admin = await adminService.createAdmin(req.body, req.adminId!);
    res.status(201).json(admin);
  } catch (error) {
    next(error);
  }
}

export async function updateAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const admin = await adminService.updateAdmin(String(req.params.id), req.body, req.adminId!);
    res.json(admin);
  } catch (error) {
    next(error);
  }
}

export async function deleteAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await adminService.deleteAdmin(String(req.params.id), req.adminId!);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function getSettings(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const settings = await adminService.getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const settings = await adminService.updateSettings(req.body, req.adminId!);
    res.json(settings);
  } catch (error) {
    next(error);
  }
}

export async function getJobRoles(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roles = await jobRoleService.listAllRoles();
    res.json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
}

export async function getJobRoleById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const role = await jobRoleService.getRoleById(String(req.params.id));
    res.json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
}

function parseJobRoleDate(value: unknown) {
  if (!value) return null;
  if (typeof value !== 'string') return value as Date;
  const ddMmYyyy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (ddMmYyyy) {
    return new Date(`${ddMmYyyy[3]}-${ddMmYyyy[2]}-${ddMmYyyy[1]}T00:00:00.000Z`);
  }
  return new Date(value);
}

export async function createJobRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = {
      ...req.body,
      closingDate: parseJobRoleDate(req.body.closingDate),
    };
    const role = await jobRoleService.createRole(body, req.adminId!);
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
}

export async function updateJobRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = {
      ...req.body,
      ...(req.body.closingDate !== undefined
        ? { closingDate: parseJobRoleDate(req.body.closingDate) }
        : {}),
    };
    const role = await jobRoleService.updateRole(String(req.params.id), body, req.adminId!);
    res.json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
}

export async function deleteJobRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await jobRoleService.deleteRole(String(req.params.id), req.adminId!);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function setJobRoleStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { status } = req.body as { status: JobRoleStatus };
    const role = await jobRoleService.setRoleStatus(String(req.params.id), status, req.adminId!);
    res.json({ success: true, data: role });
  } catch (error) {
    next(error);
  }
}

export async function generateJobRoleQuestions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await jobRoleService.generateQuestionsForRole(String(req.params.id), req.adminId!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}
