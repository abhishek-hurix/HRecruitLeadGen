import { api } from './client';

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  source?: string;
  campaign?: string;
  medium?: string;
  deviceType?: string;
  includeTest?: boolean;
  includeInternal?: boolean;
  includeTestCandidates?: boolean;
}

export interface FunnelOverview {
  visitors: number;
  registrations: number;
  started: number;
  submitted: number;
  shortlisted: number;
  interviewed: number;
  selected: number;
  rejected: number;
  registrationRate: string;
  startRate: string;
  submitRate: string;
}

export interface SourceMetric extends FunnelOverview {
  source: string;
}

export interface FilterOptions {
  sources: string[];
  campaigns: string[];
  mediums: string[];
  devices: string[];
}

function buildParams(filters: AnalyticsFilters) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.source) params.set('source', filters.source);
  if (filters.campaign) params.set('campaign', filters.campaign);
  if (filters.medium) params.set('medium', filters.medium);
  if (filters.deviceType) params.set('deviceType', filters.deviceType);
  if (filters.includeTest) params.set('includeTest', 'true');
  if (filters.includeInternal) params.set('includeInternal', 'true');
  if (filters.includeTestCandidates) params.set('includeTestCandidates', 'true');
  return params;
}

export async function getAnalyticsOverview(filters: AnalyticsFilters = {}) {
  const { data } = await api.get('/admin/analytics/overview', { params: buildParams(filters) });
  return data.data as FunnelOverview;
}

export async function getAnalyticsSources(filters: AnalyticsFilters = {}) {
  const { data } = await api.get('/admin/analytics/sources', { params: buildParams(filters) });
  return data.data as SourceMetric[];
}

export async function getAnalyticsCampaigns(filters: AnalyticsFilters = {}) {
  const { data } = await api.get('/admin/analytics/campaigns', { params: buildParams(filters) });
  return data.data as Array<SourceMetric & { campaign: string }>;
}

export async function getAnalyticsDevices(filters: AnalyticsFilters = {}) {
  const { data } = await api.get('/admin/analytics/devices', { params: buildParams(filters) });
  return data.data as Array<SourceMetric & { device: string }>;
}

export async function getAnalyticsFilterOptions(filters: AnalyticsFilters = {}) {
  const { data } = await api.get('/admin/analytics/filters', { params: buildParams(filters) });
  return data.data as FilterOptions;
}

export async function downloadAnalyticsExport(filters: AnalyticsFilters = {}) {
  const response = await api.get('/admin/analytics/export', {
    params: buildParams(filters),
    responseType: 'blob',
  });
  return response.data as Blob;
}

export async function downloadCandidatesAttributionExport(filters: AnalyticsFilters = {}) {
  const response = await api.get('/admin/analytics/export/candidates', {
    params: buildParams(filters),
    responseType: 'blob',
  });
  return response.data as Blob;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAnalyticsReport(filters: AnalyticsFilters = {}) {
  const blob = await downloadAnalyticsExport(filters);
  triggerDownload(blob, 'marketing-analytics.csv');
}

export async function exportCandidatesAttribution(filters: AnalyticsFilters = {}) {
  const blob = await downloadCandidatesAttributionExport(filters);
  triggerDownload(blob, 'candidates-attribution.csv');
}
