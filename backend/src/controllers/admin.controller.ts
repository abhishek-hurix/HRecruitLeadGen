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
    const { parseCandidateListQuery } = await import('../utils/candidate-list-query');
    const parsed = parseCandidateListQuery(req.query as Record<string, unknown>);

    if (parsed.ownerId && parsed.ownerId !== 'unassigned' && parsed.ownerId !== 'all') {
      const owner = await adminService.assertActiveAdminOwner(parsed.ownerId);
      if (!owner) {
        const { AppError } = await import('../utils/errors');
        throw new AppError(400, 'Owner admin not found or inactive');
      }
    }

    const result = await adminService.getCandidates({
      search: parsed.search || undefined,
      status: parsed.status || undefined,
      experience: parsed.experience || undefined,
      country: parsed.country || undefined,
      countryCodes: parsed.countryCodes,
      role: parsed.role || undefined,
      roleAssignment: parsed.roleAssignment,
      registeredFrom: parsed.registeredFrom,
      registeredTo: parsed.registeredTo,
      datePreset: parsed.datePreset,
      ownerId: parsed.ownerId,
      inactivityDays: parsed.inactivityDays,
      minScore: parsed.minScore ?? undefined,
      isTestUser: parsed.isTestUser,
      creationSource: parsed.creationSource,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
      page: parsed.page,
      pageSize: parsed.pageSize,
      viewerRole: req.adminRole,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCountriesList(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { listIsoCountries } = await import('../utils/country');
    res.json({ success: true, data: listIsoCountries() });
  } catch (error) {
    next(error);
  }
}

export async function getScoreBreakdown(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { getScoreBreakdown: load } = await import('../services/candidate-insight.service');
    const data = await load(String(req.params.id));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCandidateActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { getCandidateActivityTimeline } = await import('../services/candidate-insight.service');
    const data = await getCandidateActivityTimeline(String(req.params.id));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function assignOwner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { assignCandidateOwner } = await import('../services/candidate-insight.service');
    const data = await assignCandidateOwner({
      candidateId: String(req.params.id),
      ownerAdminId: req.body.ownerAdminId ?? null,
      actorAdminId: req.adminId!,
      actorRole: req.adminRole!,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listOwners(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { listCandidateOwners } = await import('../services/candidate-insight.service');
    const data = await listCandidateOwners();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCandidateById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const candidate = await adminService.getCandidateById(
      String(req.params.id),
      req.adminRole as AdminRole
    );
    res.json(candidate);
  } catch (error) {
    next(error);
  }
}

export async function globalSearch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { globalAdminSearch } = await import('../services/admin-search.service');
    const q = String(req.query.q ?? req.query.query ?? '');
    const data = await globalAdminSearch(q);
    res.json({ success: true, data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

export async function checkDuplicateCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { checkCandidateDuplicate } = await import('../services/admin-candidate-create.service');
    const email = String(req.query.email ?? req.body?.email ?? '');
    const data = await checkCandidateDuplicate(email);
    res.json({ success: true, data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
}

export async function createCandidate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { createManualCandidate } = await import('../services/admin-candidate-create.service');
    const idempotencyKey =
      String(req.headers['idempotency-key'] || req.body?.idempotencyKey || '').trim();
    if (!idempotencyKey || idempotencyKey.length < 8) {
      const { AppError } = await import('../utils/errors');
      throw new AppError(400, 'Idempotency-Key header is required (min 8 characters)');
    }

    let skills = req.body.skills;
    if (typeof skills === 'string') {
      try {
        skills = JSON.parse(skills);
      } catch {
        skills = skills.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }

    const allowDuplicateOverride =
      req.body.allowDuplicateOverride === true ||
      req.body.allowDuplicateOverride === 'true' ||
      req.body.allowDuplicateOverride === '1';

    const sendInvitation =
      req.body.sendInvitation === undefined
        ? true
        : !(req.body.sendInvitation === false || req.body.sendInvitation === 'false');

    const data = await createManualCandidate({
      input: {
        fullName: req.body.fullName,
        email: req.body.email,
        phoneCountryIso: req.body.phoneCountryIso || req.body.countryCode,
        phoneNumber: req.body.phoneNumber || req.body.phone,
        experienceCategory: req.body.experienceCategory || req.body.experience,
        jobRoleId: req.body.jobRoleId,
        linkedinUrl: req.body.linkedinUrl,
        currentCompany: req.body.currentCompany,
        currentDesignation: req.body.currentDesignation,
        noticePeriod: req.body.noticePeriod,
        expectedSalaryAmount: req.body.expectedSalaryAmount,
        expectedSalaryCurrency: req.body.expectedSalaryCurrency,
        sourceType: req.body.sourceType,
        sourceDetail: req.body.sourceDetail || req.body.referralCode,
        skills,
        allowDuplicateOverride,
        duplicateOverrideReason: req.body.duplicateOverrideReason,
        sendInvitation,
      },
      resumeFile: req.file || null,
      adminUserId: req.adminId!,
      adminRole: req.adminRole!,
      idempotencyKey,
    });

    res.status(201).json({ ...data, requestId: req.requestId });
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

export async function exportCSV(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const csv = await adminService.exportCandidatesCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="candidates.csv"');
    res.send(csv);
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
