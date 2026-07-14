import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = startOfDay(new Date(y, m - 1, d));
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, or "18 Jul 2026" / "Sat, 18 Jul". */
function parseTypedDate(raw: string, fallbackYear: number): Date | null {
  const text = raw.trim();
  if (!text) return null;

  const iso = parseIsoDate(text);
  if (iso) return iso;

  const slash = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    const y = Number(slash[3]);
    const date = startOfDay(new Date(y, m - 1, d));
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
  }

  const named = text.match(
    /^(?:[A-Za-z]{3},?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?$/
  );
  if (named) {
    const day = Number(named[1]);
    const monthName = named[2];
    const y = named[3] ? Number(named[3]) : fallbackYear;
    const probe = new Date(`${monthName} 1, ${y}`);
    if (!Number.isNaN(probe.getTime())) {
      const date = startOfDay(new Date(y, probe.getMonth(), day));
      if (date.getMonth() === probe.getMonth() && date.getDate() === day) return date;
    }
  }

  return null;
}

function formatChip(iso: string) {
  const d = parseIsoDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonthGrid(viewYear: number, viewMonth: number) {
  const first = new Date(viewYear, viewMonth, 1);
  const startPad = first.getDay();
  const daysCount = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= daysCount; day++) {
    cells.push(new Date(viewYear, viewMonth, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface DateRangeCalendarFilterProps {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  minDate?: Date;
}

export function DateRangeCalendarFilter({
  from,
  to,
  onChange,
  minDate,
}: DateRangeCalendarFilterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const year = new Date().getFullYear();
  const defaultMin = useMemo(() => startOfDay(new Date(year, 6, 1)), [year]);
  const min = minDate ? startOfDay(minDate) : defaultMin;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(min.getFullYear());
  const [viewMonth, setViewMonth] = useState(min.getMonth());
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [picking, setPicking] = useState<'from' | 'to'>('from');
  const [fromText, setFromText] = useState(formatChip(from));
  const [toText, setToText] = useState(formatChip(to));
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    setFromText(formatChip(from));
    setToText(formatChip(to));
  }, [from, to]);

  const updatePopupPos = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopupPos({
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePopupPos();
    const onScroll = () => updatePopupPos();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      const popup = document.getElementById('date-range-calendar-popup');
      if (popup?.contains(target)) return;
      clearCloseTimer();
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const openCalendar = () => {
    clearCloseTimer();
    setDraftFrom(from);
    setDraftTo(to);
    setPicking(from && !to ? 'to' : 'from');
    setViewYear(min.getFullYear());
    setViewMonth(min.getMonth());
    setOpen(true);
  };

  const commitRange = (nextFrom: string, nextTo: string) => {
    onChange({ from: nextFrom, to: nextTo });
    setFromText(formatChip(nextFrom));
    setToText(formatChip(nextTo));
  };

  const scheduleClose = (nextFrom: string, nextTo: string) => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      commitRange(nextFrom, nextTo);
      setOpen(false);
      closeTimerRef.current = null;
    }, 2000);
  };

  const onDayClick = (day: Date) => {
    if (day < min) return;
    clearCloseTimer();
    const iso = toIsoDate(day);

    if (picking === 'from' || !draftFrom) {
      setDraftFrom(iso);
      setDraftTo('');
      setFromText(formatChip(iso));
      setToText('');
      setPicking('to');
      return;
    }

    const fromDate = parseIsoDate(draftFrom);
    if (!fromDate) {
      setDraftFrom(iso);
      setDraftTo('');
      setFromText(formatChip(iso));
      setToText('');
      setPicking('to');
      return;
    }

    if (day < fromDate) {
      setDraftFrom(iso);
      setDraftTo('');
      setFromText(formatChip(iso));
      setToText('');
      setPicking('to');
      return;
    }

    setDraftTo(iso);
    setToText(formatChip(iso));
    setPicking('from');
    scheduleClose(draftFrom, iso);
  };

  const applyTyped = (which: 'from' | 'to', text: string) => {
    const parsed = parseTypedDate(text, min.getFullYear());
    if (!parsed) {
      setFromText(formatChip(from));
      setToText(formatChip(to));
      return;
    }
    if (parsed < min) {
      setFromText(formatChip(from));
      setToText(formatChip(to));
      return;
    }

    const iso = toIsoDate(parsed);
    if (which === 'from') {
      const currentTo = parseIsoDate(to);
      if (currentTo && parsed > currentTo) {
        commitRange(iso, '');
        setDraftFrom(iso);
        setDraftTo('');
        setPicking('to');
        return;
      }
      commitRange(iso, to);
      setDraftFrom(iso);
      return;
    }

    const currentFrom = parseIsoDate(from);
    if (currentFrom && parsed < currentFrom) {
      commitRange(iso, '');
      setDraftFrom(iso);
      setDraftTo('');
      setPicking('to');
      return;
    }
    if (!from) {
      commitRange(iso, '');
      setDraftFrom(iso);
      setDraftTo('');
      setPicking('to');
      return;
    }
    commitRange(from, iso);
    setDraftFrom(from);
    setDraftTo(iso);
  };

  const fromDate = parseIsoDate(draftFrom);
  const toDate = parseIsoDate(draftTo);
  const cells = daysInMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
  const canPrev =
    viewYear > min.getFullYear() || (viewYear === min.getFullYear() && viewMonth > min.getMonth());

  const chipClass =
    'inline-flex h-8 min-w-[7.5rem] items-center gap-1.5 rounded-lg border border-neutral-600/90 bg-neutral-900 px-2 text-[11px] font-medium text-neutral-100 shadow-sm';

  const popup = open
    ? createPortal(
        <div
          id="date-range-calendar-popup"
          className="fixed z-[200] w-[210px] rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-neutral-100 shadow-2xl"
          style={{ top: popupPos.top, left: popupPos.left, transform: 'translateX(-50%)' }}
          role="dialog"
          aria-label="Date range calendar"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
              disabled={!canPrev}
              onClick={() => {
                if (viewMonth === 0) {
                  setViewYear((y) => y - 1);
                  setViewMonth(11);
                } else setViewMonth((m) => m - 1);
              }}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <p className="text-[11px] font-semibold tracking-tight">{monthLabel}</p>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-300 hover:bg-neutral-800"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewYear((y) => y + 1);
                  setViewMonth(0);
                } else setViewMonth((m) => m + 1);
              }}
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="mb-0.5 grid grid-cols-7 gap-px">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-0.5 text-center text-[9px] font-medium text-neutral-500">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="h-6" />;
              const disabled = day < min;
              const iso = toIsoDate(day);
              const isFrom = fromDate ? sameDay(day, fromDate) : false;
              const isTo = toDate ? sameDay(day, toDate) : false;
              const inRange = Boolean(fromDate && toDate && day > fromDate && day < toDate);
              const isEndpoint = isFrom || isTo;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => onDayClick(day)}
                  className={[
                    'relative h-6 text-[10px] font-medium transition-colors',
                    disabled ? 'cursor-not-allowed text-neutral-600' : 'text-neutral-200 hover:bg-neutral-800',
                    inRange ? 'bg-blue-600/35 text-white' : '',
                    isEndpoint ? 'bg-blue-600 text-white hover:bg-blue-500' : '',
                    isFrom && toDate ? 'rounded-l' : '',
                    isTo && fromDate ? 'rounded-r' : '',
                    isEndpoint && !(isFrom && toDate) && !(isTo && fromDate) ? 'rounded' : '',
                    !isEndpoint && !inRange ? 'rounded' : '',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <p className="mt-1.5 text-[9px] text-neutral-500">
            {picking === 'from' || !draftFrom
              ? 'Select start date'
              : draftTo
                ? 'Closing…'
                : 'Select end date'}
          </p>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <div className="inline-flex items-center gap-1.5">
        <label className={chipClass}>
          <button
            type="button"
            onClick={openCalendar}
            className="shrink-0 text-neutral-400 hover:text-neutral-200"
            aria-label="Open from calendar"
            tabIndex={-1}
          >
            <CalendarIcon size={13} />
          </button>
          <input
            value={fromText}
            onChange={(e) => setFromText(e.target.value)}
            onFocus={openCalendar}
            onBlur={() => applyTyped('from', fromText)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="From"
            aria-label="From date"
            className="w-[4.6rem] bg-transparent text-[11px] font-medium text-neutral-100 placeholder:text-neutral-500 outline-none tabular-nums"
          />
        </label>

        <label className={chipClass}>
          <button
            type="button"
            onClick={openCalendar}
            className="shrink-0 text-neutral-400 hover:text-neutral-200"
            aria-label="Open to calendar"
            tabIndex={-1}
          >
            <CalendarIcon size={13} />
          </button>
          <input
            value={toText}
            onChange={(e) => setToText(e.target.value)}
            onFocus={openCalendar}
            onBlur={() => applyTyped('to', toText)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="To"
            aria-label="To date"
            className="w-[4.6rem] bg-transparent text-[11px] font-medium text-neutral-100 placeholder:text-neutral-500 outline-none tabular-nums"
          />
        </label>
      </div>
      {popup}
    </div>
  );
}
