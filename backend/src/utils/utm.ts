import { DeviceType } from '@prisma/client';

export interface UtmParams {
  source: string;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
}

export function parseUtmFromQuery(query: Record<string, string | undefined>): UtmParams | null {
  const source = query.utm_source?.trim();
  const medium = query.utm_medium?.trim() || null;
  const campaign = query.utm_campaign?.trim() || null;
  const term = query.utm_term?.trim() || null;
  const content = query.utm_content?.trim() || null;

  const hasAnyUtm = !!(source || medium || campaign || term || content);
  if (!hasAnyUtm) return null;

  return {
    source: (source || 'ORGANIC').toLowerCase(),
    medium: medium?.toLowerCase() || null,
    campaign: campaign?.toLowerCase() || null,
    term: term?.toLowerCase() || null,
    content: content?.toLowerCase() || null,
  };
}

export function defaultOrganicUtm(): UtmParams {
  return {
    source: 'ORGANIC',
    medium: 'organic',
    campaign: null,
    term: null,
    content: null,
  };
}

export function normalizeDeviceType(device?: string): DeviceType {
  const d = (device || 'DESKTOP').toUpperCase();
  if (d === 'MOBILE' || d === 'TABLET' || d === 'DESKTOP') return d as DeviceType;
  return DeviceType.DESKTOP;
}

export function formatSourceLabel(source: string): string {
  if (!source || source === 'ORGANIC') return 'Organic';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function conversionRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}
