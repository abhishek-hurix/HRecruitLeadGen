import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../src/utils/errors';
import {
  buildCandidateListWhere,
  normalizeFilterSnapshot,
  resolveCandidateIds,
} from '../../src/services/candidate-selection.service';

vi.mock('../../src/config/database', () => ({
  prisma: {
    candidateProfile: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database';

describe('candidate-selection.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes filter snapshots for audit', () => {
    expect(
      normalizeFilterSnapshot({
        search: '  alice  ',
        status: 'VERIFIED',
        role: 'role-1',
      })
    ).toMatchObject({
      search: 'alice',
      journeyStatus: 'VERIFIED',
      jobRoleId: 'role-1',
    });
    expect(normalizeFilterSnapshot({ search: '  alice  ', status: 'VERIFIED', role: 'role-1' })).not.toHaveProperty(
      'candidateType'
    );
  });

  it('builds active-only where by default', () => {
    const where = buildCandidateListWhere({ search: 'bob' });
    expect(where).toMatchObject({
      AND: expect.arrayContaining([
        { deletedAt: null },
        expect.objectContaining({ OR: expect.any(Array) }),
      ]),
    });
  });

  it('excludes rejected and shortlisted candidates from the main list by default', () => {
    const where = buildCandidateListWhere({});
    expect(where).toMatchObject({
      AND: expect.arrayContaining([
        { selectionStatus: { notIn: ['REJECTED', 'SHORTLISTED'] } },
        { isTestUser: false },
      ]),
    });
  });

  it('lists only test users when isTestUser is true', () => {
    const where = buildCandidateListWhere({ isTestUser: true });
    expect(where).toMatchObject({
      AND: expect.arrayContaining([{ isTestUser: true }]),
    });
    expect(JSON.stringify(where)).not.toContain('"not":"REJECTED"');
  });

  it('includes only rejected candidates when status is REJECTED', () => {
    const where = buildCandidateListWhere({ status: 'REJECTED' });
    expect(where).toMatchObject({
      AND: expect.arrayContaining([{ selectionStatus: 'REJECTED' }]),
    });
    expect(JSON.stringify(where)).not.toContain('"not":"REJECTED"');
  });

  it('rejects empty IDS selection', async () => {
    await expect(resolveCandidateIds({ mode: 'IDS', candidateIds: [] })).rejects.toBeInstanceOf(AppError);
  });

  it('deduplicates IDS and resolves only active matches', async () => {
    vi.mocked(prisma.candidateProfile.findMany).mockResolvedValueOnce([
      { id: 'a', createdAt: new Date('2026-01-02') },
      { id: 'b', createdAt: new Date('2026-01-01') },
    ] as never);

    const result = await resolveCandidateIds({
      mode: 'IDS',
      candidateIds: ['a', 'a', 'b'],
    });
    expect(result.count).toBe(2);
    expect(result.ids).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('applies exclusions for ALL_MATCHING', async () => {
    vi.mocked(prisma.candidateProfile.findMany).mockResolvedValueOnce([
      { id: 'keep', createdAt: new Date('2026-01-02') },
      { id: 'drop', createdAt: new Date('2026-01-01') },
    ] as never);
    vi.mocked(prisma.candidateProfile.findMany).mockResolvedValueOnce([] as never);

    const result = await resolveCandidateIds({
      mode: 'ALL_MATCHING',
      filters: { search: 'Test' },
      excludedCandidateIds: ['drop'],
    });
    expect(result.ids).toEqual(['keep']);
    expect(result.filterSnapshot?.search).toBe('Test');
  });

  it('rejects search that is too long', () => {
    expect(() => buildCandidateListWhere({ search: 'x'.repeat(201) })).toThrow(AppError);
  });
});
