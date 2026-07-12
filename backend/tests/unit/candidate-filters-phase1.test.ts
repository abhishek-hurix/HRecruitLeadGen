import { describe, it, expect } from 'vitest';
import {
  istInclusiveRangeToUtc,
  resolveDatePreset,
  parseYmd,
  getIstYmd,
} from '../../src/utils/ist-dates';
import { resolveCountryIso, parseCountryCodesParam, listIsoCountries } from '../../src/utils/country';
import {
  buildCandidateListWhere,
  buildCandidateListOrderBy,
  normalizeFilterSnapshot,
} from '../../src/services/candidate-selection.service';

describe('IST date filters', () => {
  it('parses YYYY-MM-DD', () => {
    expect(parseYmd('2026-07-15')).toEqual({ y: 2026, m: 6, d: 15 });
    expect(parseYmd('bad')).toBeNull();
  });

  it('uses exclusive next-day IST boundary', () => {
    const { fromUtc, toExclusiveUtc } = istInclusiveRangeToUtc('2026-07-15', '2026-07-15');
    // 15 Jul 2026 00:00 IST = 14 Jul 2026 18:30 UTC
    expect(fromUtc.toISOString()).toBe('2026-07-14T18:30:00.000Z');
    expect(toExclusiveUtc.toISOString()).toBe('2026-07-15T18:30:00.000Z');
  });

  it('rejects from after to', () => {
    expect(() => istInclusiveRangeToUtc('2026-07-16', '2026-07-15')).toThrow(/after/i);
  });

  it('resolves last_7_days preset relative to IST today', () => {
    const fixed = new Date('2026-07-15T10:00:00.000Z'); // afternoon IST
    const range = resolveDatePreset('last_7_days', fixed)!;
    expect(range.toYmd).toBe('2026-07-15');
    expect(range.fromYmd).toBe('2026-07-09');
  });

  it('exposes IST ymd helper', () => {
    const { y } = getIstYmd(new Date('2026-01-01T00:30:00.000Z'));
    expect(y).toBe(2026);
  });
});

describe('country normalization', () => {
  it('maps display names and codes', () => {
    expect(resolveCountryIso('India')).toBe('IN');
    expect(resolveCountryIso('in')).toBe('IN');
    expect(resolveCountryIso('USA')).toBe('US');
    expect(resolveCountryIso('???')).toBeNull();
  });

  it('parses multi country codes param', () => {
    expect(parseCountryCodesParam('IN,us,GB')).toEqual(['IN', 'US', 'GB']);
  });

  it('lists full ISO set', () => {
    expect(listIsoCountries().length).toBeGreaterThan(200);
    expect(listIsoCountries()[0]).toHaveProperty('code');
    expect(listIsoCountries()[0]).toHaveProperty('name');
  });
});

describe('candidate list filters and sort', () => {
  it('filters by multiple ISO country codes', () => {
    const where = buildCandidateListWhere({ countryCodes: ['IN', 'US'] });
    expect(JSON.stringify(where)).toContain('phoneCountryIso');
    expect(JSON.stringify(where)).toContain('IN');
  });

  it('filters role assignment unassigned', () => {
    const where = buildCandidateListWhere({ roleAssignment: 'unassigned' });
    expect(JSON.stringify(where)).toMatch(/selectedRoleId/);
  });

  it('applies registered date range', () => {
    const where = buildCandidateListWhere({
      registeredFrom: '2026-06-01',
      registeredTo: '2026-06-30',
    });
    expect(JSON.stringify(where)).toContain('createdAt');
  });

  it('cycles sort fields with nulls last for score', () => {
    expect(buildCandidateListOrderBy('score', 'asc')[0]).toMatchObject({
      latestScore: { sort: 'asc', nulls: 'last' },
    });
    expect(buildCandidateListOrderBy(null, null)[0]).toEqual({ createdAt: 'desc' });
  });

  it('normalizes countryCodes in snapshot', () => {
    expect(normalizeFilterSnapshot({ countryCodes: ['in', 'US'] }).countryCodes).toEqual(['IN', 'US']);
  });
});
