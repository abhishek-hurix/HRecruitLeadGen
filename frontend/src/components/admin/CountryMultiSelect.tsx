import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { filterCountries, type IsoCountry } from '../../utils/iso-countries';

interface CountryMultiSelectProps {
  countries: IsoCountry[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

export function CountryMultiSelect({ countries, value, onChange, disabled }: CountryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterCountries(countries, query), [countries, query]);
  const selected = countries.filter((c) => value.includes(c.code));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else onChange([...value, code]);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        className="filter-glass-btn w-full text-left flex items-center justify-between gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">
          {selected.length === 0
            ? 'All countries'
            : selected.length <= 2
              ? selected.map((c) => c.name).join(', ')
              : `${selected.length} countries`}
        </span>
        <ChevronDown size={14} strokeWidth={2.25} className="shrink-0 text-neutral-800 opacity-70" />
      </button>
      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((c) => (
            <span
              key={c.code}
              className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/60 px-2 py-0.5 text-[11px] font-medium text-neutral-800 backdrop-blur-md"
            >
              {c.code}
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                className="text-neutral-500 hover:text-neutral-950"
                onClick={() => toggle(c.code)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="text-[11px] font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-950"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      )}
      {open && (
        <div
          className="filter-glass-panel absolute z-[60] mt-1.5 w-full max-h-64 overflow-auto p-2"
          role="listbox"
          aria-multiselectable
        >
          <input
            className="filter-glass w-full mb-2 text-sm"
            style={{ backgroundImage: 'none', paddingRight: '0.875rem' }}
            placeholder="Search country or code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search countries"
            autoFocus
          />
          {filtered.length === 0 ? (
            <p className="text-xs text-neutral-500 p-2">No countries match</p>
          ) : (
            filtered.map((c) => (
              <label
                key={c.code}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-900 hover:bg-black/[0.04] rounded-xl cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={value.includes(c.code)}
                  onChange={() => toggle(c.code)}
                />
                <span className="font-mono text-xs w-6 text-neutral-600">{c.code}</span>
                <span className="truncate">{c.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
