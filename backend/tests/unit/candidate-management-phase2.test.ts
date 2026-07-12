import { describe, it, expect } from 'vitest';
import {
  parseCandidateListQuery,
  assertValidIsoCountryCodes,
  reportUnmappedCountryValue,
} from '../../src/utils/candidate-list-query';
import { istInclusiveRangeToUtc, resolveDatePreset } from '../../src/utils/ist-dates';
import { resolveCountryIso } from '../../src/utils/country';
import { buildCandidateListOrderBy, buildCandidateListWhere } from '../../src/services/candidate-selection.service';
import { AppError } from '../../src/utils/errors';

describe('candidate list query validation', () => {
  it('rejects invalid country codes', () => {
    expect(() => assertValidIsoCountryCodes(['ZZ'])).toThrow(AppError);
    expect(assertValidIsoCountryCodes(['in', 'US'])).toEqual(['IN', 'US']);
  });

  it('validates sort allowlist and order', () => {
    expect(() => parseCandidateListQuery({ sortBy: 'hacked' })).toThrow(/sortBy/i);
    expect(() => parseCandidateListQuery({ sortOrder: 'asc' })).toThrow(/sortOrder requires sortBy/i);
    const ok = parseCandidateListQuery({ sortBy: 'experience', sortOrder: 'asc' });
    expect(ok.sortBy).toBe('experience');
    expect(ok.sortOrder).toBe('asc');
  });

  it('validates date format and ordering', () => {
    expect(() => parseCandidateListQuery({ registeredFrom: '07-01-2026' })).toThrow(/YYYY-MM-DD/);
    expect(() =>
      parseCandidateListQuery({ registeredFrom: '2026-07-10', registeredTo: '2026-07-01' })
    ).toThrow(/after/);
  });

  it('validates inactivity and role assignment', () => {
    expect(() => parseCandidateListQuery({ inactivityDays: '14' })).toThrow(/7, 30, or 90/);
    expect(parseCandidateListQuery({ inactivityDays: '30' }).inactivityDays).toBe(30);
    expect(() => parseCandidateListQuery({ roleAssignment: 'nope' })).toThrow(/roleAssignment/);
    expect(parseCandidateListQuery({ roleAssignment: 'unassigned' }).roleAssignment).toBe('unassigned');
  });

  it('parses multi-country and owner filter', () => {
    const parsed = parseCandidateListQuery({
      countryCodes: 'IN,US',
      ownerId: 'unassigned',
      page: '2',
      pageSize: '50',
    });
    expect(parsed.countryCodes).toEqual(['IN', 'US']);
    expect(parsed.ownerId).toBe('unassigned');
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(50);
  });
});

describe('IST boundaries extended', () => {
  it('handles month and year boundaries', () => {
    const june = istInclusiveRangeToUtc('2026-06-30', '2026-07-01');
    expect(june.fromUtc.toISOString()).toBe('2026-06-29T18:30:00.000Z');
    expect(june.toExclusiveUtc.toISOString()).toBe('2026-07-01T18:30:00.000Z');

    const nye = istInclusiveRangeToUtc('2025-12-31', '2026-01-01');
    expect(nye.fromUtc.toISOString()).toBe('2025-12-30T18:30:00.000Z');
    expect(nye.toExclusiveUtc.toISOString()).toBe('2026-01-01T18:30:00.000Z');
  });

  it('handles leap day 2024', () => {
    const leap = istInclusiveRangeToUtc('2024-02-29', '2024-02-29');
    expect(leap.fromUtc.toISOString()).toBe('2024-02-28T18:30:00.000Z');
    expect(leap.toExclusiveUtc.toISOString()).toBe('2024-02-29T18:30:00.000Z');
  });

  it('resolves today preset', () => {
    const fixed = new Date('2026-07-12T20:00:00.000Z'); // IST Jul 13 morning
    const range = resolveDatePreset('today', fixed)!;
    expect(range.fromYmd).toBe(range.toYmd);
    expect(range.toYmd).toBe('2026-07-13');
  });
});

describe('sorting allowlist', () => {
  const fields = [
    'name',
    'score',
    'registeredAt',
    'experience',
    'country',
    'assessmentStatus',
    'assignedRole',
    'lastActivity',
  ] as const;

  it.each(fields)('orders by %s with stable secondary id', (field) => {
    const order = buildCandidateListOrderBy(field, 'asc');
    expect(order[order.length - 1]).toEqual({ id: 'desc' });
  });

  it('defaults registeredAt desc', () => {
    expect(buildCandidateListOrderBy(null, null)[0]).toEqual({ createdAt: 'desc' });
  });

  it('uses numeric nulls-last for experience and score', () => {
    expect(buildCandidateListOrderBy('experience', 'desc')[0]).toMatchObject({
      yearsOfExperience: { sort: 'desc', nulls: 'last' },
    });
  });

  it('rejects arbitrary sort via switch default', () => {
    expect(() => buildCandidateListOrderBy('password' as never, 'asc')).toThrow(/Invalid sortBy/);
  });
});

describe('inactivity filter', () => {
  it('composes inactivity with active scope', () => {
    const where = buildCandidateListWhere({ inactivityDays: 7 });
    expect(JSON.stringify(where)).toMatch(/lastActivityAt/);
    expect(JSON.stringify(where)).toMatch(/deletedAt/);
  });
});

describe('country normalization', () => {
  it('normalizes whitespace and case', () => {
    expect(resolveCountryIso('  india  ')).toBe('IN');
    expect(resolveCountryIso('Gb')).toBe('GB');
  });

  it('reports unmapped values', () => {
    expect(reportUnmappedCountryValue('Narnia')).toEqual({ raw: 'Narnia', resolved: null });
  });
});
