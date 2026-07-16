import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  AdminRole,
  AuthProvider,
  CandidateActivityType,
  CandidateCreationSource,
  ExperienceCategory,
  JobRoleStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/database';
import { storage, storagePathOf } from './storage/storage.service';
import { assessmentTokenService } from './assessment-token.service';
import { emailService } from './email.service';
import { candidateStatusService } from './candidate-status.service';
import { AppError, isValidEmail, isValidLinkedInUrl } from '../utils/errors';
import { parseAndValidatePhone } from '../utils/phone';
import { getExperienceYears, parseExperienceCategory } from '../utils/experience';
import { applicationIdFromUuid, normalizeEmail } from '../utils/application-id';
import { resolveCountryIso, countryDisplayName } from '../utils/country';
import { assertValidPdfUpload } from '../utils/pdf-validation';
import { beginIdempotentOperation } from '../utils/idempotency';
import { writeAuditLog } from '../utils/admin-safety';
import { activeCandidateWhere, mergeCandidateWhere } from '../utils/candidate-scope';
import { logger } from '../utils/logger';
import { config } from '../config';
import { reminderService } from './reminder.service';
import { formatPersonName, personNamesMatch } from '../utils/person-name';

const MAX_TEXT = 200;
const NAME_MISMATCH_MESSAGE =
  'This email is already registered with a different name. The same email must always use the same candidate name.';
const MAX_LONG = 2000;

export interface ManualCandidateInput {
  fullName: string;
  email: string;
  phoneCountryIso: string;
  phoneNumber: string;
  experienceCategory: string;
  jobRoleId: string;
  linkedinUrl?: string | null;
  currentCompany?: string | null;
  currentDesignation?: string | null;
  noticePeriod?: string | null;
  expectedSalaryAmount?: number | string | null;
  expectedSalaryCurrency?: string | null;
  sourceType?: string | null;
  sourceDetail?: string | null;
  skills?: string[] | null;
  allowDuplicateOverride?: boolean;
  duplicateOverrideReason?: string | null;
  sendInvitation?: boolean;
}

export interface InviteCandidateInput {
  fullName: string;
  email: string;
  jobRoleId: string;
  subject?: string | null;
  bodyHtml?: string | null;
  allowDuplicateOverride?: boolean;
  duplicateOverrideReason?: string | null;
}

function sanitizeText(value: unknown, field: string, max = MAX_TEXT): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > max) throw new AppError(400, `${field} exceeds maximum length`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) {
    throw new AppError(400, `${field} contains invalid characters`);
  }
  return s;
}

function safeExistingSummary(profile: {
  id: string;
  applicationId: string | null;
  fullName: string;
  assessmentStatus: string;
  selectedRoleName: string | null;
  createdAt: Date;
  user: { email: string };
}) {
  return {
    id: profile.id,
    applicationId: profile.applicationId || applicationIdFromUuid(profile.id),
    fullName: profile.fullName,
    email: profile.user.email,
    assessmentStatus: profile.assessmentStatus,
    assignedRole: profile.selectedRoleName,
    registeredAt: profile.createdAt,
  };
}

export async function getCanonicalNameForEmail(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: normalized }, { normalizedEmail: normalized }] },
    include: {
      candidateProfiles: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { fullName: true, resumePath: true },
      },
    },
  });
  if (!user?.candidateProfiles.length) return null;
  const withResume = user.candidateProfiles.find((profile) => profile.resumePath);
  const source = withResume || user.candidateProfiles[0];
  return formatPersonName(source.fullName);
}

function resolveFormattedPersonName(rawName: unknown, field = 'fullName'): string {
  const sanitized = sanitizeText(rawName, field, 120);
  if (!sanitized || sanitized.length < 2) throw new AppError(400, 'Full name is required');
  return formatPersonName(sanitized);
}

function assertEmailNameAllowed(email: string, proposedName: string, canonicalName: string | null) {
  if (!canonicalName || personNamesMatch(proposedName, canonicalName)) return;
  throw new AppError(409, NAME_MISMATCH_MESSAGE, undefined, {
    canonicalName,
    nameMismatch: true,
  });
}

export async function findActiveDuplicateByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return prisma.candidateProfile.findFirst({
    where: mergeCandidateWhere(activeCandidateWhere(), {
      user: {
        OR: [{ email: normalized }, { normalizedEmail: normalized }],
      },
    }),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      applicationId: true,
      fullName: true,
      assessmentStatus: true,
      selectedRoleName: true,
      createdAt: true,
      user: { select: { id: true, email: true } },
    },
  });
}

export async function createManualCandidate(params: {
  input: ManualCandidateInput;
  resumeFile?: Express.Multer.File | null;
  adminUserId: string;
  adminRole: AdminRole;
  idempotencyKey: string;
}) {
  const { input, adminUserId, adminRole, idempotencyKey } = params;

  return beginIdempotentOperation({
    adminUserId,
    operationType: 'MANUAL_CANDIDATE_CREATE',
    key: idempotencyKey,
    requestPayload: {
      email: normalizeEmail(input.email || ''),
      fullName: input.fullName,
      jobRoleId: input.jobRoleId,
      phoneNumber: input.phoneNumber,
      phoneCountryIso: input.phoneCountryIso,
      experienceCategory: input.experienceCategory,
      allowDuplicateOverride: Boolean(input.allowDuplicateOverride),
      resumeName: params.resumeFile?.originalname || null,
      resumeSize: params.resumeFile?.size || null,
    },
    execute: async () => {
      const body = await createManualCandidateCore({
        input,
        resumeFile: params.resumeFile,
        adminUserId,
        adminRole,
      });
      return { status: 201, body };
    },
  });
}

async function createManualCandidateCore(params: {
  input: ManualCandidateInput;
  resumeFile?: Express.Multer.File | null;
  adminUserId: string;
  adminRole: AdminRole;
}) {
  const { input, adminUserId, adminRole } = params;

  const fullName = resolveFormattedPersonName(input.fullName);

  if (!isValidEmail(input.email || '')) throw new AppError(400, 'Invalid email format');
  const email = normalizeEmail(input.email);
  const canonicalName = await getCanonicalNameForEmail(email);
  assertEmailNameAllowed(email, fullName, canonicalName);

  const iso = resolveCountryIso(input.phoneCountryIso);
  if (!iso) throw new AppError(400, 'Invalid country code');

  const parsedPhone = parseAndValidatePhone(iso, String(input.phoneNumber || ''));

  const experienceCategory = parseExperienceCategory(String(input.experienceCategory || ''));
  if (!experienceCategory) throw new AppError(400, 'Valid experience is required');

  if (!input.jobRoleId) throw new AppError(400, 'Job role is required');
  const jobRole = await prisma.jobRole.findUnique({ where: { id: input.jobRoleId } });
  if (!jobRole || jobRole.status !== JobRoleStatus.ACTIVE) {
    throw new AppError(400, 'Job role not found or inactive');
  }

  let linkedinUrl = sanitizeText(input.linkedinUrl, 'linkedinUrl', 300) || '';
  if (linkedinUrl && !isValidLinkedInUrl(linkedinUrl)) {
    throw new AppError(400, 'Invalid LinkedIn URL');
  }

  const currentCompany = sanitizeText(input.currentCompany, 'currentCompany');
  const currentDesignation = sanitizeText(input.currentDesignation, 'currentDesignation');
  const noticePeriod = sanitizeText(input.noticePeriod, 'noticePeriod', 80);
  const sourceType = sanitizeText(input.sourceType, 'sourceType', 80);
  const sourceDetail = sanitizeText(input.sourceDetail, 'sourceDetail', MAX_LONG);
  const currency = sanitizeText(input.expectedSalaryCurrency, 'expectedSalaryCurrency', 3);
  let expectedSalaryAmount: Prisma.Decimal | null = null;
  if (input.expectedSalaryAmount != null && input.expectedSalaryAmount !== '') {
    const n = Number(input.expectedSalaryAmount);
    if (!Number.isFinite(n) || n < 0) throw new AppError(400, 'Invalid expected salary');
    expectedSalaryAmount = new Prisma.Decimal(n);
  }

  let skills: string[] | undefined;
  if (input.skills != null) {
    if (!Array.isArray(input.skills)) throw new AppError(400, 'skills must be an array');
    skills = input.skills
      .map((s) => sanitizeText(s, 'skill', 60))
      .filter((s): s is string => Boolean(s))
      .slice(0, 40);
  }

  const resumeFile = assertValidPdfUpload(params.resumeFile, { required: false });

  const duplicate = await findActiveDuplicateByEmail(email);
  if (duplicate) {
    const reason = sanitizeText(input.duplicateOverrideReason, 'duplicateOverrideReason', 500);
    const allowOverride =
      adminRole === AdminRole.SUPER_ADMIN && Boolean(input.allowDuplicateOverride) && Boolean(reason);

    if (!allowOverride) {
      if (adminRole === AdminRole.SUPER_ADMIN && input.allowDuplicateOverride && !reason) {
        throw new AppError(400, 'duplicateOverrideReason is required for override');
      }
      throw new AppError(409, 'A candidate with this email already exists', undefined, {
        existing: safeExistingSummary(duplicate),
        dataModelNote:
          'User email is unique. CandidateProfile is the application unit. Super Admin may override to create another application on the same User.',
      });
    }
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { normalizedEmail: email }] },
  });

  let uploadedPath: string | null = null;
  let storageBucket: string | null = null;
  let storagePath: string | null = null;
  let candidateId: string | null = null;
  let applicationId = '';

  try {
    const profileId = randomUUID();
    applicationId = applicationIdFromUuid(profileId);

    if (resumeFile) {
      const saved = await storage.save(resumeFile, `candidates/${profileId}`);
      uploadedPath = storagePathOf(saved);
      if (typeof saved !== 'string') {
        storageBucket = saved.bucket || null;
        storagePath = saved.path;
      } else {
        storagePath = saved;
      }
    }

    const now = new Date();
    const compensation =
      jobRole.compensationType === 'HOURLY' && jobRole.hourlyRate != null
        ? `${jobRole.currency} ${jobRole.hourlyRate}/hr`
        : jobRole.monthlySalary != null
          ? `${jobRole.currency} ${jobRole.monthlySalary}/mo`
          : jobRole.currency;

    const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 12);

    const createProfile = async (appId: string) => {
      const profileData: Prisma.CandidateProfileCreateWithoutUserInput = {
        id: profileId,
        applicationId: appId,
        fullName,
        phone: parsedPhone.phoneNumber,
        countryCode: parsedPhone.countryCode,
        phoneNumber: parsedPhone.phoneNumber,
        fullPhone: parsedPhone.fullPhone,
        phoneCountry: parsedPhone.phoneCountry,
        phoneCountryIso: parsedPhone.iso,
        experienceCategory,
        yearsOfExperience: getExperienceYears(experienceCategory),
        linkedinUrl: linkedinUrl || '',
        // Admin creates and emails the candidate directly, so the address is trusted.
        // This lets the assessment link (and portal login) work without a separate verify step.
        emailVerified: true,
        emailVerifiedAt: now,
        resumePath: uploadedPath || '',
        appliedRole: jobRole.title,
        selectedRole: { connect: { id: jobRole.id } },
        selectedRoleName: jobRole.title,
        selectedCountry: jobRole.country,
        selectedCompensation: compensation,
        selectedSkills: (skills || jobRole.skills) as Prisma.InputJsonValue,
        roleSelectedAt: now,
        currentCompany,
        currentDesignation,
        noticePeriod,
        expectedSalaryAmount,
        expectedSalaryCurrency: currency?.toUpperCase() || null,
        sourceType,
        sourceDetail,
        creationSource: CandidateCreationSource.ADMIN_CREATED,
        createdByAdmin: { connect: { id: adminUserId } },
        lastActivityAt: now,
        lastActivityType: CandidateActivityType.REGISTERED,
        activities: {
          create: {
            id: randomUUID(),
            type: CandidateActivityType.REGISTERED,
            actorAdminId: adminUserId,
            occurredAt: now,
            metadata: {
              source: 'admin_manual_create',
              duplicateOverride: Boolean(duplicate),
            },
          },
        },
        ...(uploadedPath
          ? {
              resumes: {
                create: {
                  fileName: resumeFile!.originalname,
                  filePath: uploadedPath,
                  storageBucket,
                  storagePath: storagePath || uploadedPath,
                  mimeType: 'application/pdf',
                  sizeBytes: resumeFile!.size,
                  uploadedByAdminId: adminUserId,
                  uploadedAt: now,
                  isPrimary: true,
                },
              },
            }
          : {}),
      };

      if (existingUser) {
        const updated = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            normalizedEmail: email,
            candidateProfiles: { create: profileData },
          },
          include: { candidateProfiles: { where: { id: profileId } } },
        });
        return { userId: updated.id, candidateId: updated.candidateProfiles[0]?.id || profileId };
      }

      const created = await prisma.user.create({
        data: {
          email,
          normalizedEmail: email,
          passwordHash,
          authProvider: AuthProvider.LOCAL,
          candidateProfiles: { create: profileData },
        },
        include: { candidateProfiles: { where: { id: profileId } } },
      });
      return { userId: created.id, candidateId: created.candidateProfiles[0]?.id || profileId };
    };

    let userId: string;
    try {
      const created = await createProfile(applicationId);
      userId = created.userId;
      candidateId = created.candidateId;
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'P2002') {
        applicationId = applicationIdFromUuid(randomUUID());
        const retry = await createProfile(applicationId);
        userId = retry.userId;
        candidateId = retry.candidateId;
      } else {
        throw e;
      }
    }

    await prisma.jobRole.update({
      where: { id: jobRole.id },
      data: { applicationsReceived: { increment: 1 } },
    });

    await writeAuditLog({
      adminUserId,
      action: duplicate ? 'CANDIDATE_MANUAL_CREATE_OVERRIDE' : 'CANDIDATE_MANUAL_CREATE',
      entityType: 'candidate',
      entityId: candidateId!,
      metadata: {
        email,
        jobRoleId: jobRole.id,
        duplicateOverride: Boolean(duplicate),
        overrideReason: duplicate
          ? sanitizeText(input.duplicateOverrideReason, 'duplicateOverrideReason', 500)
          : null,
        userId,
      },
    });

    let invitationSent = false;
    let invitationError: string | null = null;
    const sendInvitation = input.sendInvitation !== false;

    if (sendInvitation) {
      try {
        const { token, jti, expiresAt } = await assessmentTokenService.createToken(
          candidateId!,
          email
        );
        const assessmentUrl = `${config.frontendUrl}/ready?token=${encodeURIComponent(token)}`;
        await emailService.sendAssessmentLink({
          to: email,
          candidateName: fullName,
          assessmentUrl,
          expiresAt,
        });
        await assessmentTokenService.markEmailSent(jti);
        await candidateStatusService.markEmailSent(candidateId!);
        invitationSent = true;
      } catch (e) {
        invitationError = 'Invitation email failed; candidate was created';
        logger.error('Manual candidate invitation failed', {
          candidateId,
          error: e instanceof Error ? e.message : e,
        });
      }
    }

    return {
      success: true,
      candidateCreated: true,
      invitationSent,
      invitationError,
      candidate: {
        id: candidateId,
        applicationId,
        fullName,
        email,
        countryCode: parsedPhone.iso,
        countryName: countryDisplayName(parsedPhone.iso, parsedPhone.phoneCountry),
        dialCode: parsedPhone.countryCode,
        phone: parsedPhone.fullPhone,
        experienceCategory,
        yearsOfExperience: getExperienceYears(experienceCategory as ExperienceCategory),
        assignedRole: jobRole.title,
        jobRoleId: jobRole.id,
      },
      dataModelNote:
        'User email is unique; CandidateProfile is the application. Override reuses the User and creates a new CandidateProfile.',
    };
  } catch (error) {
    if (uploadedPath) {
      await storage.delete(uploadedPath).catch((cleanupErr) => {
        logger.warn('Resume cleanup failed after create error', {
          path: uploadedPath,
          error: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
        });
      });
    }
    throw error;
  }
}

export async function checkCandidateDuplicate(email: string, proposedName?: string) {
  if (!isValidEmail(email || '')) throw new AppError(400, 'Invalid email format');
  const existing = await findActiveDuplicateByEmail(email);
  const canonicalName = await getCanonicalNameForEmail(email);
  const formattedProposed = proposedName ? formatPersonName(proposedName) : null;
  const nameMismatch = Boolean(
    canonicalName && formattedProposed && !personNamesMatch(formattedProposed, canonicalName)
  );
  return {
    duplicate: Boolean(existing),
    existing: existing ? safeExistingSummary(existing) : null,
    canonicalName,
    nameMismatch,
  };
}

function buildRegistrationUrl() {
  return 'https://candidates.hurixsystems.com/';
}

export async function createInviteCandidate(params: {
  input: InviteCandidateInput;
  adminUserId: string;
  adminRole: AdminRole;
  idempotencyKey: string;
}) {
  const { input, adminUserId, idempotencyKey } = params;

  return beginIdempotentOperation({
    adminUserId,
    operationType: 'MANUAL_CANDIDATE_CREATE',
    key: idempotencyKey,
    requestPayload: {
      email: normalizeEmail(input.email || ''),
      fullName: input.fullName,
      jobRoleId: input.jobRoleId,
      inviteOnly: true,
      allowDuplicateOverride: Boolean(input.allowDuplicateOverride),
    },
    execute: async () => {
      const body = await createInviteCandidateCore({
        input,
        adminUserId: params.adminUserId,
        adminRole: params.adminRole,
      });
      return { status: 201, body };
    },
  });
}

async function createInviteCandidateCore(params: {
  input: InviteCandidateInput;
  adminUserId: string;
  adminRole: AdminRole;
}) {
  const { input, adminUserId, adminRole } = params;

  const fullName = resolveFormattedPersonName(input.fullName);

  if (!isValidEmail(input.email || '')) throw new AppError(400, 'Invalid email format');
  const email = normalizeEmail(input.email);
  const canonicalName = await getCanonicalNameForEmail(email);
  assertEmailNameAllowed(email, fullName, canonicalName);

  if (!input.jobRoleId) throw new AppError(400, 'Job role is required');
  const jobRole = await prisma.jobRole.findUnique({ where: { id: input.jobRoleId } });
  if (!jobRole || jobRole.status !== JobRoleStatus.ACTIVE) {
    throw new AppError(400, 'Job role not found or inactive');
  }

  const duplicate = await findActiveDuplicateByEmail(email);
  if (duplicate) {
    const reason = sanitizeText(input.duplicateOverrideReason, 'duplicateOverrideReason', 500);
    const allowOverride =
      adminRole === AdminRole.SUPER_ADMIN && Boolean(input.allowDuplicateOverride) && Boolean(reason);

    if (!allowOverride) {
      if (adminRole === AdminRole.SUPER_ADMIN && input.allowDuplicateOverride && !reason) {
        throw new AppError(400, 'duplicateOverrideReason is required for override');
      }
      throw new AppError(409, 'A candidate with this email already exists', undefined, {
        existing: safeExistingSummary(duplicate),
        dataModelNote:
          'User email is unique. CandidateProfile is the application unit. Super Admin may override to create another application on the same User.',
      });
    }
  }

  const parsedPhone = parseAndValidatePhone('IN', '9876543210');
  const experienceCategory = ExperienceCategory.FRESHER;

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { normalizedEmail: email }] },
  });

  const profileId = randomUUID();
  const applicationId = applicationIdFromUuid(profileId);
  const now = new Date();
  const compensation =
    jobRole.compensationType === 'HOURLY' && jobRole.hourlyRate != null
      ? `${jobRole.currency} ${jobRole.hourlyRate}/hr`
      : jobRole.monthlySalary != null
        ? `${jobRole.currency} ${jobRole.monthlySalary}/mo`
        : jobRole.currency;

  const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 12);

  const profileData: Prisma.CandidateProfileCreateWithoutUserInput = {
    id: profileId,
    applicationId,
    fullName,
    phone: parsedPhone.phoneNumber,
    countryCode: parsedPhone.countryCode,
    phoneNumber: parsedPhone.phoneNumber,
    fullPhone: parsedPhone.fullPhone,
    phoneCountry: parsedPhone.phoneCountry,
    phoneCountryIso: parsedPhone.iso,
    experienceCategory,
    yearsOfExperience: getExperienceYears(experienceCategory),
    linkedinUrl: '',
    emailVerified: false,
    resumePath: '',
    appliedRole: jobRole.title,
    selectedRole: { connect: { id: jobRole.id } },
    selectedRoleName: jobRole.title,
    selectedCountry: jobRole.country,
    selectedCompensation: compensation,
    selectedSkills: jobRole.skills as Prisma.InputJsonValue,
    roleSelectedAt: now,
    creationSource: CandidateCreationSource.ADMIN_CREATED,
    createdByAdmin: { connect: { id: adminUserId } },
    lastActivityAt: now,
    lastActivityType: CandidateActivityType.REMINDER_SENT,
    activities: {
      create: {
        id: randomUUID(),
        type: CandidateActivityType.REMINDER_SENT,
        actorAdminId: adminUserId,
        occurredAt: now,
        metadata: {
          source: 'admin_registration_invite',
          duplicateOverride: Boolean(duplicate),
        },
      },
    },
  };

  let candidateId: string;
  let userId: string;

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        normalizedEmail: email,
        candidateProfiles: { create: profileData },
      },
      include: { candidateProfiles: { where: { id: profileId } } },
    });
    userId = updated.id;
    candidateId = updated.candidateProfiles[0]?.id || profileId;
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        normalizedEmail: email,
        passwordHash,
        authProvider: AuthProvider.LOCAL,
        candidateProfiles: { create: profileData },
      },
      include: { candidateProfiles: { where: { id: profileId } } },
    });
    userId = created.id;
    candidateId = created.candidateProfiles[0]?.id || profileId;
  }

  await prisma.jobRole.update({
    where: { id: jobRole.id },
    data: { applicationsReceived: { increment: 1 } },
  });

  await writeAuditLog({
    adminUserId,
    action: duplicate ? 'CANDIDATE_MANUAL_CREATE_OVERRIDE' : 'CANDIDATE_REGISTRATION_INVITE',
    entityType: 'candidate',
    entityId: candidateId,
    metadata: {
      email,
      jobRoleId: jobRole.id,
      duplicateOverride: Boolean(duplicate),
      overrideReason: duplicate
        ? sanitizeText(input.duplicateOverrideReason, 'duplicateOverrideReason', 500)
        : null,
      userId,
      inviteOnly: true,
    },
  });

  const registrationUrl = buildRegistrationUrl();
  const templateVars = {
    candidateName: fullName,
    assignedRole: jobRole.title,
    registrationUrl,
  };

  let invitationSent = false;
  let invitationError: string | null = null;

  try {
    const rendered = await reminderService.previewRegistrationInvite(
      adminUserId,
      templateVars,
      {
        subject: input.subject || undefined,
        bodyHtml: input.bodyHtml || undefined,
      }
    );
    await emailService.sendCustomEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.bodyHtml,
    });
    await candidateStatusService.markEmailSent(candidateId);
    invitationSent = true;
  } catch (e) {
    invitationError = 'Registration invitation email failed; candidate was created';
    logger.error('Registration invite email failed', {
      candidateId,
      error: e instanceof Error ? e.message : e,
    });
  }

  return {
    success: true,
    candidateCreated: true,
    invitationSent,
    invitationError,
    candidate: {
      id: candidateId,
      applicationId,
      fullName,
      email,
      assignedRole: jobRole.title,
      jobRoleId: jobRole.id,
    },
    registrationUrl,
    dataModelNote:
      'Invite-only candidate created. Candidate must complete self-registration before assessment.',
  };
}
