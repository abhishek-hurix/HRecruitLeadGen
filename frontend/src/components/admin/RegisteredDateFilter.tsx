import type { DatePreset } from '../../utils/candidate-list-ui';
import { isValidDateRange, resolveDatePreset } from '../../utils/candidate-list-ui';

interface RegisteredDateFilterProps {
  preset: DatePreset;
  from: string;
  to: string;
  onChange: (next: { preset: DatePreset; from: string; to: string }) => void;
}

const PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: '', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

export function RegisteredDateFilter({ preset, from, to, onChange }: RegisteredDateFilterProps) {
  const invalid = preset === 'custom' && from && to && !isValidDateRange(from, to);

  return (
    <div className="space-y-2">
      <select
        className="filter-glass w-full"
        aria-label="Registered date preset"
        value={preset}
        onChange={(e) => {
          const next = e.target.value as DatePreset;
          if (!next) {
            onChange({ preset: '', from: '', to: '' });
            return;
          }
          if (next === 'custom') {
            onChange({ preset: 'custom', from, to });
            return;
          }
          const resolved = resolveDatePreset(next);
          onChange({
            preset: next,
            from: resolved?.from || '',
            to: resolved?.to || '',
          });
        }}
      >
        {PRESETS.map((p) => (
          <option key={p.value || 'any'} value={p.value}>{p.label}</option>
        ))}
      </select>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            className="filter-glass"
            style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
            aria-label="Registered from date"
            value={from}
            onChange={(e) => onChange({ preset: 'custom', from: e.target.value, to })}
          />
          <input
            type="date"
            className="filter-glass"
            style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
            aria-label="Registered to date"
            value={to}
            onChange={(e) => onChange({ preset: 'custom', from, to: e.target.value })}
          />
        </div>
      )}
      {invalid && (
        <p className="text-xs text-red-600" role="alert">From date cannot be after To date</p>
      )}
    </div>
  );
}
