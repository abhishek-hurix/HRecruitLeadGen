import { getCountries, CountryCode } from 'libphonenumber-js';
import { getCountryName } from './phone';

export type IsoCountry = { code: string; name: string };

let cachedList: IsoCountry[] | null = null;
let nameToIso: Map<string, string> | null = null;

export function listIsoCountries(): IsoCountry[] {
  if (cachedList) return cachedList;
  cachedList = getCountries()
    .map((code) => ({ code, name: getCountryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cachedList;
}

function buildNameIndex(): Map<string, string> {
  if (nameToIso) return nameToIso;
  const map = new Map<string, string>();
  for (const { code, name } of listIsoCountries()) {
    map.set(code.toLowerCase(), code);
    map.set(name.toLowerCase(), code);
  }
  // Common aliases (unambiguous only)
  const aliases: Record<string, string> = {
    usa: 'US',
    uk: 'GB',
    uae: 'AE',
    'united states of america': 'US',
    'great britain': 'GB',
    korea: 'KR',
    'south korea': 'KR',
  };
  for (const [k, v] of Object.entries(aliases)) {
    if (!map.has(k)) map.set(k, v);
  }
  nameToIso = map;
  return map;
}

/**
 * Map a free-text country value to ISO alpha-2.
 * Returns null for empty or ambiguous/unrecognized values (never invents).
 */
export function resolveCountryIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    const known = listIsoCountries().some((c) => c.code === upper);
    return known ? upper : null;
  }
  return buildNameIndex().get(trimmed.toLowerCase()) || null;
}

export function countryDisplayName(iso: string | null | undefined, fallback?: string | null): string {
  if (iso && /^[A-Z]{2}$/.test(iso)) return getCountryName(iso as CountryCode);
  return fallback?.trim() || '—';
}

export function parseCountryCodesParam(raw: unknown): string[] {
  if (raw == null || raw === '') return [];
  const parts = Array.isArray(raw)
    ? raw.flatMap((v) => String(v).split(','))
    : String(raw).split(',');
  const codes = parts
    .map((p) => p.trim().toUpperCase())
    .filter((p) => /^[A-Z]{2}$/.test(p));
  return [...new Set(codes)];
}
