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
import { assertValidPdfUpload } from '../../src/utils/pdf-validation';
import { applicationIdFromUuid, normalizeEmail } from '../../src/utils/application-id';

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
    expect(() => parseCandidateListQuery({ inactivityDays: '0' })).toThrow(/inactivityDays/i);
    expect(parseCandidateListQuery({ inactivityDays: '14' }).inactivityDays).toBe(14);
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

describe('PDF validation', () => {
  it('accepts valid PDF magic bytes', () => {
    const file = {
      mimetype: 'application/pdf',
      size: 100,
      originalname: 'cv.pdf',
      buffer: Buffer.from('%PDF-1.4 rest'),
    } as Express.Multer.File;
    expect(assertValidPdfUpload(file)?.originalname).toBe('cv.pdf');
  });

  it('rejects non-PDF magic and oversized', () => {
    expect(() =>
      assertValidPdfUpload({
        mimetype: 'application/pdf',
        size: 10,
        originalname: 'x.pdf',
        buffer: Buffer.from('notpdf'),
      } as Express.Multer.File)
    ).toThrow(/Invalid PDF/);

    expect(() =>
      assertValidPdfUpload({
        mimetype: 'application/pdf',
        size: 50 * 1024 * 1024,
        originalname: 'x.pdf',
        buffer: Buffer.from('%PDF-1.4'),
      } as Express.Multer.File)
    ).toThrow(/exceeds maximum size/i);
  });

  it('returns 415 for wrong mime', () => {
    try {
      assertValidPdfUpload({
        mimetype: 'image/png',
        size: 10,
        originalname: 'x.png',
        buffer: Buffer.from('%PDF-1.4'),
      } as Express.Multer.File);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(415);
    }
  });
});

describe('application id + email', () => {
  it('derives stable 8-char application id from uuid', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(applicationIdFromUuid(id)).toBe('A1B2C3D4');
  });

  it('normalizes email canonically', () => {
    expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com');
  });
});

describe('AppError request contract helpers', () => {
  it('carries optional details for 409 payloads', () => {
    const err = new AppError(409, 'dup', undefined, { existing: { id: 'x' } });
    expect(err.details).toEqual({ existing: { id: 'x' } });
  });
});
