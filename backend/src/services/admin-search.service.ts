import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { activeCandidateWhere, mergeCandidateWhere } from '../utils/candidate-scope';
import { applicationIdFromUuid } from '../utils/application-id';
import { countryDisplayName } from '../utils/country';
import type { Prisma } from '@prisma/client';

const MIN_Q = 2;
const MAX_Q = 100;
const PER_GROUP = 8;

export async function globalAdminSearch(rawQuery: string) {
  const q = (rawQuery || '').trim();
  if (q.length < MIN_Q) {
    throw new AppError(400, `Search query must be at least ${MIN_Q} characters`);
  }
  if (q.length > MAX_Q) {
    throw new AppError(400, `Search query must be at most ${MAX_Q} characters`);
  }

  const candidateOr: Prisma.CandidateProfileWhereInput[] = [
    { fullName: { contains: q, mode: 'insensitive' } },
    { user: { email: { contains: q, mode: 'insensitive' } } },
    { user: { normalizedEmail: { contains: q.toLowerCase(), mode: 'insensitive' } } },
  ];

  if (q.length >= 2) {
    candidateOr.push({ applicationId: { contains: q.toUpperCase(), mode: 'insensitive' } });
  }

  const candidateWhere = mergeCandidateWhere(activeCandidateWhere(), {
    OR: candidateOr,
  });

  const [candidates, jobRoles, assessments] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: candidateWhere,
      take: PER_GROUP,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        applicationId: true,
        fullName: true,
        phoneCountryIso: true,
        phoneCountry: true,
        assessmentStatus: true,
        createdAt: true,
        user: { select: { email: true } },
        selectedRoleName: true,
      },
    }),
    prisma.jobRole.findMany({
      where: {
        status: 'ACTIVE',
        title: { contains: q, mode: 'insensitive' },
      },
      take: PER_GROUP,
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        country: true,
        status: true,
        openPositions: true,
      },
    }),
    prisma.submission.findMany({
      where: {
        candidate: activeCandidateWhere(),
        OR: [
          { assessment: { jobRole: { title: { contains: q, mode: 'insensitive' } } } },
          { candidate: { fullName: { contains: q, mode: 'insensitive' } } },
          { candidate: { applicationId: { contains: q.toUpperCase(), mode: 'insensitive' } } },
          { candidate: { user: { email: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      take: PER_GROUP,
      orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        score: true,
        submittedAt: true,
        candidate: {
          select: {
            id: true,
            applicationId: true,
            fullName: true,
            user: { select: { email: true } },
          },
        },
        assessment: {
          select: {
            id: true,
            jobRole: { select: { id: true, title: true } },
          },
        },
      },
    }),
  ]);

  return {
    query: q,
    limits: { perGroup: PER_GROUP, minLength: MIN_Q, maxLength: MAX_Q },
    candidates: candidates.map((c) => ({
      type: 'candidate' as const,
      id: c.id,
      applicationId: c.applicationId || applicationIdFromUuid(c.id),
      fullName: c.fullName,
      email: c.user.email,
      countryCode: c.phoneCountryIso,
      countryName: countryDisplayName(c.phoneCountryIso, c.phoneCountry),
      assessmentStatus: c.assessmentStatus,
      assignedRole: c.selectedRoleName,
      registeredAt: c.createdAt,
    })),
    jobRoles: jobRoles.map((r) => ({
      type: 'jobRole' as const,
      id: r.id,
      name: r.title,
      country: r.country,
      status: r.status,
      openPositions: r.openPositions,
    })),
    assessments: assessments.map((s) => ({
      type: 'assessment' as const,
      submissionId: s.id,
      assessmentId: s.assessment.id,
      assessmentName: s.assessment.jobRole?.title || null,
      jobRoleId: s.assessment.jobRole?.id || null,
      score: Number(s.score),
      submittedAt: s.submittedAt,
      candidateId: s.candidate.id,
      applicationId: s.candidate.applicationId || applicationIdFromUuid(s.candidate.id),
      candidateName: s.candidate.fullName,
      email: s.candidate.user.email,
    })),
  };
}
