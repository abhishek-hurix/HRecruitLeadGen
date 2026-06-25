import { Prisma } from '@prisma/client';

/** Default reporting scope: exclude candidates marked as internal test users. */
export function realCandidateWhere(includeTestUsers = false): Prisma.CandidateProfileWhereInput {
  if (includeTestUsers) return {};
  return { isTestUser: false };
}

export function shouldExcludeTestCandidate(
  isTestUser: boolean | undefined,
  includeTestCandidates: boolean | undefined
): boolean {
  return Boolean(isTestUser && !includeTestCandidates);
}
