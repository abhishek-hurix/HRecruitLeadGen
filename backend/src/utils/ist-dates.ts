/**
 * IST (Asia/Kolkata) calendar-date helpers for admin filters.
 * DB timestamps stay UTC; filter bounds are computed from IST midnights.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type DatePreset =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_month'
  | 'custom';

/** Instant representing 00:00:00.000 IST on the given calendar day, as UTC Date. */
export function istStartOfDayUtc(year: number, monthIndex0: number, day: number): Date {
  // IST midnight = UTC previous day 18:30
  return new Date(Date.UTC(year, monthIndex0, day, 0, 0, 0, 0) - IST_OFFSET_MS);
}

export function getIstYmd(now = new Date()): { y: number; m: number; d: number } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    y: ist.getUTCFullYear(),
    m: ist.getUTCMonth(),
    d: ist.getUTCDate(),
  };
}

export function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  if (!y || month < 1 || month > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, month - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m: month - 1, d };
}

/**
 * Inclusive calendar range in IST → UTC half-open interval [fromUtc, toExclusiveUtc).
 */
export function istInclusiveRangeToUtc(
  fromYmd: string,
  toYmd: string
): { fromUtc: Date; toExclusiveUtc: Date } {
  const from = parseYmd(fromYmd);
  const to = parseYmd(toYmd);
  if (!from || !to) {
    throw new Error('Invalid date format; expected YYYY-MM-DD');
  }
  const fromUtc = istStartOfDayUtc(from.y, from.m, from.d);
  // exclusive start of next day after `to`
  const toNext = new Date(Date.UTC(to.y, to.m, to.d + 1));
  const toExclusiveUtc = istStartOfDayUtc(
    toNext.getUTCFullYear(),
    toNext.getUTCMonth(),
    toNext.getUTCDate()
  );
  if (fromUtc.getTime() > toExclusiveUtc.getTime() - 1) {
    throw new Error('From date cannot be after To date');
  }
  return { fromUtc, toExclusiveUtc };
}

export function resolveDatePreset(
  preset: DatePreset,
  now = new Date()
): { fromYmd: string; toYmd: string } | null {
  const { y, m, d } = getIstYmd(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (yy: number, mm: number, dd: number) => `${yy}-${pad(mm + 1)}-${pad(dd)}`;
  const today = fmt(y, m, d);

  if (preset === 'today') return { fromYmd: today, toYmd: today };

  if (preset === 'this_month') {
    return { fromYmd: fmt(y, m, 1), toYmd: today };
  }

  const daysBack = preset === 'last_7_days' ? 6 : preset === 'last_30_days' ? 29 : preset === 'last_90_days' ? 89 : null;
  if (daysBack == null) return null;

  const start = new Date(Date.UTC(y, m, d - daysBack));
  return {
    fromYmd: fmt(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    toYmd: today,
  };
}
