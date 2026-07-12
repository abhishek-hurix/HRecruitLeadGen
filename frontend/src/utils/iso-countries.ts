/** Client-side ISO country list helpers (display). Server remains source of filter truth. */

export type IsoCountry = { code: string; name: string };

/** Minimal embedded list used if API has not loaded; full list comes from GET /admin/countries. */
export const FALLBACK_COUNTRIES: IsoCountry[] = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SG', name: 'Singapore' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'PH', name: 'Philippines' },
];

export function filterCountries(list: IsoCountry[], query: string): IsoCountry[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
  );
}
