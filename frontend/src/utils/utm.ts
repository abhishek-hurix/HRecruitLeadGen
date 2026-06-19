export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export function parseUtmFromUrl(url?: string): UtmParams {
  const search = url
    ? new URL(url, window.location.origin).searchParams
    : new URLSearchParams(window.location.search);

  const get = (key: string) => search.get(key)?.trim() || undefined;

  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_term: get('utm_term'),
    utm_content: get('utm_content'),
  };
}

export function hasUtmParams(utm: UtmParams): boolean {
  return !!(utm.utm_source || utm.utm_medium || utm.utm_campaign || utm.utm_term || utm.utm_content);
}

export function formatSourceLabel(source?: string | null): string {
  if (!source || source === 'ORGANIC') return 'Organic';
  return source.charAt(0).toUpperCase() + source.slice(1);
}
