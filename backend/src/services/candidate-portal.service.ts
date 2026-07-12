import { AssessmentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { assessmentTokenService } from './assessment-token.service';
import { getExperienceLabel } from '../utils/experience';
import { storage } from './storage/storage.service';
import { getCountryIsoByName, getPhoneValidationErrorMessage, parseAndValidatePhone, parseAndValidatePhoneInput } from '../utils/phone';

export class CandidatePortalService {
  async getDashboard(candidateId: string) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: {
        user: true,
        assessmentTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
        assessments: {
          orderBy: { createdAt: 'desc' },
          include: {
            submission: {
              include: {
                answers: true,
              },
            },
          },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          include: {
            assessment: { include: { jobRole: { select: { id: true, title: true, skills: true } } } },
            answers: true,
          },
        },
        resumes: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
      },
    });

    if (!candidate) throw new AppError(404, 'Candidate not found');

    const candidateProfiles = await prisma.candidateProfile.findMany({
      where: { userId: candidate.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        assessments: {
          orderBy: { createdAt: 'desc' },
          include: {
            submission: {
              include: {
                answers: true,
              },
            },
          },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
          include: {
            assessment: { include: { jobRole: { select: { id: true, title: true, skills: true } } } },
            answers: true,
          },
        },
      },
    });

    const allSubmissions = candidateProfiles
      .flatMap((profile) => profile.submissions)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    const allAssessments = candidateProfiles.flatMap((profile) => profile.assessments);
    const selectedProfile = candidateProfiles.find((profile) => profile.selectedRoleId) || candidate;
    const appliedPositions = candidateProfiles
      .filter((profile) => profile.selectedRoleId)
      .filter((profile, index, profiles) =>
        profiles.findIndex((item) => item.selectedRoleId === profile.selectedRoleId) === index
      )
      .map((profile) => ({
        roleId: profile.selectedRoleId,
        roleName: profile.selectedRoleName,
        country: profile.selectedCountry,
        compensation: profile.selectedCompensation,
        skills: Array.isArray(profile.selectedSkills)
          ? (profile.selectedSkills as string[])
          : [],
        selectedAt: profile.roleSelectedAt,
      }));

    const latestToken = candidate.assessmentTokens[0];
    const journeyStatus = assessmentTokenService.resolveJourneyStatus({
      emailVerified: candidate.emailVerified,
      tokenStatus: latestToken?.status,
      tokenExpiresAt: latestToken?.expiresAt,
      hasSubmission: allSubmissions.length > 0,
      assessmentInProgress: allAssessments.some((a) => a.status === AssessmentStatus.IN_PROGRESS),
    });

    const latestSubmission = allSubmissions[0];
    const inProgressAssessment = allAssessments.find((a) => a.status === AssessmentStatus.IN_PROGRESS);

    const passedTests = latestSubmission?.answers.reduce((sum, a) => sum + a.passedTests, 0) ?? 0;
    const failedTests = latestSubmission?.answers.reduce((sum, a) => sum + a.failedTests, 0) ?? 0;

    const timeline = {
      registered: true,
      emailVerified: candidate.emailVerified,
      assessmentStarted:
        journeyStatus === 'STARTED' ||
        journeyStatus === 'SUBMITTED' ||
        candidate.assessmentStatus === 'IN_PROGRESS' ||
        candidate.assessmentStatus === 'SUBMITTED',
      assessmentSubmitted: allSubmissions.length > 0 || journeyStatus === 'SUBMITTED',
    };

    const history = allSubmissions.map((s) => ({
      id: s.id,
      jobRoleId: s.assessment.jobRoleId,
      roleName:
        s.assessment.jobRole?.title ||
        candidateProfiles.find((profile) => profile.id === s.candidateId)?.selectedRoleName ||
        null,
      skills: Array.isArray(s.assessment.jobRole?.skills)
        ? (s.assessment.jobRole.skills as string[])
        : (() => {
            const profile = candidateProfiles.find((item) => item.id === s.candidateId);
            return Array.isArray(profile?.selectedSkills) ? (profile.selectedSkills as string[]) : [];
          })(),
      language: s.assessment.language,
      score: Number(s.score),
      passedQuestions: s.passedQuestions,
      totalQuestions: s.totalQuestions,
      submittedAt: s.submittedAt,
      result: Number(s.score) >= 5 ? 'Passed' : 'Needs Review',
    }));

    const resumes = candidate.resumes.length > 0
      ? candidate.resumes
      : candidate.resumePath
        ? [{
            id: 'legacy-primary-resume',
            candidateId: candidate.id,
            fileName: `${candidate.fullName.replace(/\s+/g, '_')}_resume.pdf`,
            filePath: candidate.resumePath,
            isPrimary: true,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt,
          }]
        : [];

    return {
      profile: {
        fullName: candidate.fullName,
        email: candidate.user.email,
        phone: candidate.fullPhone || candidate.phone,
        countryCode: candidate.countryCode,
        phoneCountry: candidate.phoneCountry,
        phoneNumber: candidate.phoneNumber || candidate.phone,
        yearsOfExperience: candidate.yearsOfExperience,
        experienceCategory: candidate.experienceCategory,
        experienceLabel: getExperienceLabel(candidate.experienceCategory),
        linkedinUrl: candidate.linkedinUrl,
        referralCode: candidate.referralCode,
        resumeUploaded: resumes.length > 0,
        resumes: resumes.map((resume) => ({
          id: resume.id,
          fileName: resume.fileName,
          isPrimary: resume.isPrimary,
          uploadedAt: resume.createdAt,
        })),
      },
      appliedPosition: selectedProfile.selectedRoleId
        ? {
            roleId: selectedProfile.selectedRoleId,
            roleName: selectedProfile.selectedRoleName,
            country: selectedProfile.selectedCountry,
            compensation: selectedProfile.selectedCompensation,
            skills: Array.isArray(selectedProfile.selectedSkills)
              ? (selectedProfile.selectedSkills as string[])
              : [],
            selectedAt: selectedProfile.roleSelectedAt,
          }
        : null,
      appliedPositions,
      verification: {
        emailVerified: candidate.emailVerified,
        verifiedAt: candidate.emailVerifiedAt,
        verificationSentAt: candidate.verificationSentAt,
        resendsRemaining: Math.max(
          0,
          3 -
            (() => {
              const windowStart = candidate.verificationAttemptsWindowStart;
              const now = Date.now();
              if (!windowStart || now - windowStart.getTime() >= 60 * 60 * 1000) {
                return 0;
              }
              return candidate.verificationAttempts;
            })()
        ),
        canResend: !candidate.emailVerified,
      },
      timeline,
      assessment: {
        status: inProgressAssessment
          ? 'IN_PROGRESS'
          : allSubmissions.length > 0
            ? 'SUBMITTED'
            : candidate.assessmentStatus,
        date: inProgressAssessment?.startedAt || latestSubmission?.submittedAt || candidate.assessmentDate,
        score: latestSubmission ? Number(latestSubmission.score) : null,
        passedTests,
        failedTests,
        hasCompleted: allSubmissions.length > 0,
        hasInProgress: Boolean(inProgressAssessment),
      },
      journeyStatus,
      history,
    };
  }

  async updatePhone(
    candidateId: string,
    input: { phoneCountryIso?: string; phoneNumber?: string; phone?: string }
  ) {
    const candidate = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new AppError(404, 'Candidate not found');

    let parsedPhone;
    if (input.phoneCountryIso && input.phoneNumber) {
      const countryIso = input.phoneCountryIso.toUpperCase();
      const validationError = getPhoneValidationErrorMessage(countryIso, input.phoneNumber);
      if (validationError) {
        throw new AppError(400, validationError);
      }
      parsedPhone = parseAndValidatePhone(countryIso, input.phoneNumber);
    } else {
      const countryIso = getCountryIsoByName(candidate.phoneCountry) || 'IN';
      parsedPhone = parseAndValidatePhoneInput(countryIso, input.phone || '');
    }

    const updated = await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        phone: parsedPhone.phoneNumber,
        countryCode: parsedPhone.countryCode,
        phoneNumber: parsedPhone.phoneNumber,
        fullPhone: parsedPhone.fullPhone,
        phoneCountry: parsedPhone.phoneCountry,
      },
    });

    return {
      phone: updated.fullPhone || updated.phone,
      phoneNumber: updated.phoneNumber || updated.phone,
      countryCode: updated.countryCode,
      phoneCountry: updated.phoneCountry,
    };
  }

  async uploadResume(candidateId: string, resumeFile: Express.Multer.File) {
    const candidate = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      include: { resumes: true },
    });
    if (!candidate) throw new AppError(404, 'Candidate not found');

    const saved = await storage.save(resumeFile, 'resumes');
    const filePath = typeof saved === 'string' ? saved : saved.path;
    const shouldBePrimary = candidate.resumes.length === 0 && !candidate.resumePath;

    try {
      const resume = await prisma.$transaction(async (tx) => {
        const created = await tx.candidateResume.create({
          data: {
            candidateId,
            fileName: resumeFile.originalname || 'resume.pdf',
            filePath,
            storagePath: filePath,
            mimeType: resumeFile.mimetype || 'application/pdf',
            sizeBytes: resumeFile.size || null,
            uploadedAt: new Date(),
            isPrimary: shouldBePrimary,
          },
        });

        if (shouldBePrimary) {
          await tx.candidateProfile.update({
            where: { id: candidateId },
            data: { resumePath: filePath },
          });
        }

        return created;
      });

      return {
        id: resume.id,
        fileName: resume.fileName,
        isPrimary: resume.isPrimary,
        uploadedAt: resume.createdAt,
      };
    } catch (error) {
      await storage.delete(filePath).catch(() => {});
      throw error;
    }
  }

  async setPrimaryResume(candidateId: string, resumeId: string) {
    const resume = await prisma.candidateResume.findFirst({
      where: { id: resumeId, candidateId },
    });
    if (!resume) throw new AppError(404, 'Resume not found');

    await prisma.$transaction(async (tx) => {
      await tx.candidateResume.updateMany({
        where: { candidateId },
        data: { isPrimary: false },
      });
      await tx.candidateResume.update({
        where: { id: resume.id },
        data: { isPrimary: true },
      });
      await tx.candidateProfile.update({
        where: { id: candidateId },
        data: { resumePath: resume.filePath },
      });
    });

    return { resumeId: resume.id };
  }

  async getResume(candidateId: string, resumeId: string) {
    const resume = await prisma.candidateResume.findFirst({
      where: { id: resumeId, candidateId },
    });
    if (!resume) throw new AppError(404, 'Resume not found');

    const buffer = await storage.get(resume.filePath);
    return { buffer, filename: resume.fileName };
  }

  async deleteResume(candidateId: string, resumeId: string) {
    const resumes = await prisma.candidateResume.findMany({
      where: { candidateId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
    const resume = resumes.find((item) => item.id === resumeId);
    if (!resume) throw new AppError(404, 'Resume not found');
    if (resumes.length <= 1) {
      throw new AppError(400, 'At least one resume is required.');
    }

    const nextPrimary = resume.isPrimary
      ? resumes.find((item) => item.id !== resumeId)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.candidateResume.delete({ where: { id: resume.id } });

      if (nextPrimary) {
        await tx.candidateResume.updateMany({
          where: { candidateId },
          data: { isPrimary: false },
        });
        await tx.candidateResume.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });
        await tx.candidateProfile.update({
          where: { id: candidateId },
          data: { resumePath: nextPrimary.filePath },
        });
      }
    });

    await storage.delete(resume.filePath).catch(() => {});
    return { deletedResumeId: resume.id, primaryResumeId: nextPrimary?.id || resumes.find((item) => item.isPrimary)?.id || null };
  }
}

export const candidatePortalService = new CandidatePortalService();
