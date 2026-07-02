import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  buildCountryList,
  DEFAULT_COUNTRY_ISO,
  isValidNationalPhone,
  type CountryOption,
} from '../../utils/countries';
import type { CountryCode } from 'libphonenumber-js';

interface CountryPhoneInputProps {
  countryIso: CountryCode;
  phoneNumber: string;
  onCountryChange: (iso: CountryCode) => void;
  onPhoneChange: (value: string) => void;
  error?: string;
  variant?: 'default' | 'profile';
  hideLabel?: boolean;
}

export function CountryPhoneInput({
  countryIso,
  phoneNumber,
  onCountryChange,
  onPhoneChange,
  error,
  variant = 'default',
  hideLabel = false,
}: CountryPhoneInputProps) {
  const countries = useMemo(() => buildCountryList(), []);
  const selected = countries.find((c) => c.iso === countryIso) ||
    countries.find((c) => c.iso === DEFAULT_COUNTRY_ISO)!;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.iso.toLowerCase().includes(q)
    );
  }, [countries, search]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handlePhoneInput = (value: string) => {
    onPhoneChange(value.replace(/[^\d\s-]/g, ''));
  };

  const isProfile = variant === 'profile';
  const countryButtonClass = isProfile
    ? 'flex min-w-[118px] items-center justify-between gap-2 border-0 border-b border-slate-200 bg-transparent px-0 py-1 text-sm font-medium text-hurix-blue outline-none'
    : 'input-field flex items-center gap-2 min-w-[140px] sm:min-w-[160px] justify-between px-3';
  const phoneInputClass = isProfile
    ? 'min-w-0 flex-1 border-0 border-b border-slate-200 bg-transparent px-0 py-1 text-sm font-medium text-hurix-blue outline-none focus:border-hurix-blue'
    : 'input-field flex-1 min-w-0';

  return (
    <div ref={containerRef}>
      {!hideLabel && (
        <label className="block text-sm font-medium mb-1">Phone Number *</label>
      )}
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={countryButtonClass}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 truncate text-sm">
              <span>{selected.flag}</span>
              <span className="truncate">{selected.dialCode}</span>
            </span>
            <ChevronDown size={16} className="text-hurix-gray shrink-0" />
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-72 max-w-[90vw] bg-white border border-slate-200 rounded-lg shadow-lg">
              <div className="p-2 border-b border-slate-100">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hurix-gray" />
                  <input
                    type="text"
                    className="input-field pl-9 text-sm"
                    placeholder="Search country..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
                {filtered.map((c: CountryOption) => (
                  <li key={c.iso}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={c.iso === countryIso}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                        c.iso === countryIso ? 'bg-hurix-blue/5 text-hurix-blue' : ''
                      }`}
                      onClick={() => {
                        onCountryChange(c.iso);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <span>{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-hurix-gray shrink-0">{c.dialCode}</span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-4 text-sm text-hurix-gray text-center">No countries found</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <input
          type="tel"
          inputMode="numeric"
          className={phoneInputClass}
          value={phoneNumber}
          onChange={(e) => handlePhoneInput(e.target.value)}
          placeholder={countryIso === 'IN' ? '9876543210' : 'Phone number'}
          aria-label="Phone number"
        />
      </div>
      {!isProfile && (
        <p className="text-xs text-hurix-gray mt-1">
          {selected.flag} {selected.name} ({selected.dialCode})
        </p>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {phoneNumber && !isValidNationalPhone(countryIso, phoneNumber) && !error && !isProfile && (
        <p className="text-amber-600 text-xs mt-1">Enter a valid number for {selected.name}</p>
      )}
    </div>
  );
}

export { DEFAULT_COUNTRY_ISO, isValidNationalPhone };
