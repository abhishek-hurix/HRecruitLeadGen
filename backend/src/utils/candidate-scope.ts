import { Prisma } from '@prisma/client';

/** Active (non-soft-deleted) candidates only. */
export function activeCandidateWhere(): Prisma.CandidateProfileWhereInput {
  return { deletedAt: null };
}

/** Soft-deleted candidates only. */
export function deletedCandidateWhere(): Prisma.CandidateProfileWhereInput {
  return { deletedAt: { not: null } };
}

/** Combine scopes safely. */
export function mergeCandidateWhere(
  ...parts: Array<Prisma.CandidateProfileWhereInput | undefined>
): Prisma.CandidateProfileWhereInput {
  const cleaned = parts.filter(Boolean) as Prisma.CandidateProfileWhereInput[];
  if (cleaned.length === 0) return {};
  if (cleaned.length === 1) return cleaned[0];
  return { AND: cleaned };
}
