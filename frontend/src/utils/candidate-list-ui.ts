export type DatePreset =
  | ''
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_month'
  | 'custom';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIstYmd(now = new Date()): { y: number; m: number; d: number } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), d: ist.getUTCDate() };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatYmd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function resolveDatePreset(preset: DatePreset, now = new Date()): { from: string; to: string } | null {
  if (!preset || preset === 'custom') return null;
  const { y, m, d } = getIstYmd(now);
  const today = formatYmd(y, m, d);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'this_month') return { from: formatYmd(y, m, 1), to: today };
  const back = preset === 'last_7_days' ? 6 : preset === 'last_30_days' ? 29 : 89;
  const start = new Date(Date.UTC(y, m, d - back));
  return {
    from: formatYmd(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    to: today,
  };
}

export function isValidDateRange(from: string, to: string): boolean {
  if (!from || !to) return false;
  return from <= to;
}

export type SortDirection = 'asc' | 'desc' | null;

export function cycleSort(
  currentBy: string | null,
  currentDir: SortDirection,
  nextBy: string
): { sortBy: string | null; sortOrder: SortDirection } {
  if (currentBy !== nextBy) return { sortBy: nextBy, sortOrder: 'asc' };
  if (currentDir === 'asc') return { sortBy: nextBy, sortOrder: 'desc' };
  return { sortBy: null, sortOrder: null };
}
