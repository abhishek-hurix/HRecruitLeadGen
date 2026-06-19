import { AssessmentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { assessmentTokenService } from './assessment-token.service';
import { getExperienceLabel } from '../utils/experience';

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
        resumeUploaded: Boolean(candidate.resumePath),
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
}

export const candidatePortalService = new CandidatePortalService();
