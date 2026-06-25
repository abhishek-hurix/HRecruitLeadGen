import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Filter,
  X,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  getAnalyticsOverview,
  getAnalyticsSources,
  getAnalyticsCampaigns,
  getAnalyticsDevices,
  getAnalyticsFilterOptions,
  exportAnalyticsReport,
  exportCandidatesAttribution,
  type AnalyticsFilters,
  type SourceMetric,
} from '../../api/analytics';
import { formatSourceLabel } from '../../utils/utm';

const SOURCE_COLORS = [
  'bg-hurix-blue',
  'bg-hurix-cyan',
  'bg-hurix-purple',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
];

function BarChart({
  items,
  labelKey,
  valueKey,
  maxValue,
}: {
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  maxValue: number;
}) {
  if (!items.length) return <p className="text-sm text-hurix-gray">No data for selected filters.</p>;

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const value = Number(item[valueKey]);
        const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const label = String(item[labelKey]);
        return (
          <div key={label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-hurix-charcoal truncate pr-2">
                {labelKey === 'source' ? formatSourceLabel(label) : label}
              </span>
              <span className="text-hurix-gray shrink-0">{value}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${SOURCE_COLORS[i % SOURCE_COLORS.length]}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MarketingAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [includeTest, setIncludeTest] = useState(false);
  const [includeInternal, setIncludeInternal] = useState(false);
  const [includeTestCandidates, setIncludeTestCandidates] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilters: AnalyticsFilters = {
    ...filters,
    includeTest,
    includeInternal,
    includeTestCandidates,
    ...(selectedSource ? { source: selectedSource } : {}),
  };

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics-overview', activeFilters],
    queryFn: () => getAnalyticsOverview(activeFilters),
  });

  const { data: sources = [], isLoading: loadingSources } = useQuery({
    queryKey: ['analytics-sources', activeFilters],
    queryFn: () => getAnalyticsSources(activeFilters),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['analytics-campaigns', activeFilters],
    queryFn: () => getAnalyticsCampaigns(activeFilters),
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['analytics-devices', activeFilters],
    queryFn: () => getAnalyticsDevices(activeFilters),
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['analytics-filters', includeTest, includeInternal, includeTestCandidates],
    queryFn: () => getAnalyticsFilterOptions({ includeTest, includeInternal }),
  });

  const maxSourceVisitors = Math.max(...sources.map((s) => s.visitors), 1);
  const maxCampaignVisitors = Math.max(...campaigns.map((c) => c.visitors), 1);
  const maxDeviceVisitors = Math.max(...devices.map((d) => d.visitors), 1);

  const selectedSourceData = selectedSource
    ? sources.find((s) => s.source === selectedSource)
    : null;

  const updateFilter = (key: keyof AnalyticsFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    if (key === 'source') setSelectedSource(null);
  };

  const clearFilters = () => {
    setFilters({});
    setSelectedSource(null);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean) || selectedSource;

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-hurix-charcoal flex items-center gap-2">
            <BarChart3 className="text-hurix-blue" size={28} />
            Marketing Analytics
          </h1>
          <p className="text-sm text-hurix-gray mt-1">Production UTM attribution — test and internal traffic excluded by default</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm text-hurix-charcoal bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="rounded border-slate-300"
            />
            Include Test Traffic
          </label>
          <label className="flex items-center gap-2 text-sm text-hurix-charcoal bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInternal}
              onChange={(e) => setIncludeInternal(e.target.checked)}
              className="rounded border-slate-300"
            />
            Include Internal Traffic
          </label>
          <label className="flex items-center gap-2 text-sm text-hurix-charcoal bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTestCandidates}
              onChange={(e) => setIncludeTestCandidates(e.target.checked)}
              className="rounded border-slate-300"
            />
            Include Test Candidates
          </label>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Filter size={16} />
            Filters
          </button>
          <button
            type="button"
            onClick={() => exportAnalyticsReport(activeFilters)}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Download size={16} />
            Export Analytics
          </button>
          <button
            type="button"
            onClick={() => exportCandidatesAttribution(activeFilters)}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Download size={16} />
            Export Candidates
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card-premium mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-hurix-gray block mb-1">Date From</label>
            <input
              type="date"
              className="input-field w-full text-sm"
              value={filters.dateFrom || ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-hurix-gray block mb-1">Date To</label>
            <input
              type="date"
              className="input-field w-full text-sm"
              value={filters.dateTo || ''}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-hurix-gray block mb-1">Source</label>
            <select
              className="input-field w-full text-sm"
              value={filters.source || ''}
              onChange={(e) => updateFilter('source', e.target.value)}
            >
              <option value="">All sources</option>
              {filterOptions?.sources.map((s) => (
                <option key={s} value={s}>{formatSourceLabel(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-hurix-gray block mb-1">Campaign</label>
            <select
              className="input-field w-full text-sm"
              value={filters.campaign || ''}
              onChange={(e) => updateFilter('campaign', e.target.value)}
            >
              <option value="">All campaigns</option>
              {filterOptions?.campaigns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-hurix-gray block mb-1">Medium / Device</label>
            <div className="flex gap-2">
              <select
                className="input-field flex-1 text-sm"
                value={filters.medium || ''}
                onChange={(e) => updateFilter('medium', e.target.value)}
              >
                <option value="">Medium</option>
                {filterOptions?.mediums.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                className="input-field flex-1 text-sm"
                value={filters.deviceType || ''}
                onChange={(e) => updateFilter('deviceType', e.target.value)}
              >
                <option value="">Device</option>
                {filterOptions?.devices.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="sm:col-span-2 lg:col-span-5">
              <button type="button" onClick={clearFilters} className="text-sm text-hurix-blue hover:underline flex items-center gap-1">
                <X size={14} /> Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {loadingOverview ? (
        <p className="text-hurix-gray">Loading analytics...</p>
      ) : overview && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <RealMetricCard label="Real Visitors" value={overview.visitors} />
            <RealMetricCard label="Real Registrations" value={overview.registrations} sub={overview.registrationRate} />
            <RealMetricCard label="Real Assessment Starts" value={overview.started} sub={overview.startRate} />
            <RealMetricCard label="Real Assessment Submissions" value={overview.submitted} sub={overview.submitRate} />
          </div>

        </>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="card-premium">
          <h2 className="font-semibold text-lg mb-4">Traffic by Source</h2>
          {loadingSources ? (
            <p className="text-sm text-hurix-gray">Loading...</p>
          ) : (
            <BarChart
              items={sources.map((s) => ({ source: s.source, visitors: s.visitors }))}
              labelKey="source"
              valueKey="visitors"
              maxValue={maxSourceVisitors}
            />
          )}
        </div>
        <div className="card-premium">
          <h2 className="font-semibold text-lg mb-4">Traffic by Campaign</h2>
          <BarChart
            items={campaigns.map((c) => ({ campaign: c.campaign, visitors: c.visitors }))}
            labelKey="campaign"
            valueKey="visitors"
            maxValue={maxCampaignVisitors}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 card-premium">
          <h2 className="font-semibold text-lg mb-4">Traffic Sources</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sources.map((s) => (
              <SourceCard
                key={s.source}
                metric={s}
                selected={selectedSource === s.source}
                onClick={() => setSelectedSource(selectedSource === s.source ? null : s.source)}
              />
            ))}
            {!sources.length && <p className="text-sm text-hurix-gray col-span-full">No visitor data yet.</p>}
          </div>
        </div>
        <div className="card-premium">
          <h2 className="font-semibold text-lg mb-4">Traffic by Device</h2>
          <BarChart
            items={devices.map((d) => ({ device: d.device, visitors: d.visitors }))}
            labelKey="device"
            valueKey="visitors"
            maxValue={maxDeviceVisitors}
          />
        </div>
      </div>

      {selectedSourceData && (
        <div className="card-premium mb-8 border-2 border-hurix-cyan/30">
          <h2 className="font-semibold text-lg mb-4">
            Source Funnel: {formatSourceLabel(selectedSourceData.source)}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <MetricBox label="Visitors" value={selectedSourceData.visitors} />
            <MetricBox label="Registrations" value={selectedSourceData.registrations} sub={selectedSourceData.registrationRate} />
            <MetricBox label="Started" value={selectedSourceData.started} />
            <MetricBox label="Submitted" value={selectedSourceData.submitted} />
            <MetricBox label="Shortlisted" value={selectedSourceData.shortlisted} />
            <MetricBox label="Interviewed" value={selectedSourceData.interviewed} />
            <MetricBox label="Selected" value={selectedSourceData.selected} />
            <MetricBox label="Rejected" value={selectedSourceData.rejected} />
          </div>
        </div>
      )}

      <div className="card-premium overflow-x-auto mb-8">
        <h2 className="font-semibold text-lg mb-4">Source-Level Funnel</h2>
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-hurix-gray border-b">
              <th className="pb-3 pr-3">Source</th>
              <th className="pb-3 pr-3">Visitors</th>
              <th className="pb-3 pr-3">Registrations</th>
              <th className="pb-3 pr-3">Started</th>
              <th className="pb-3 pr-3">Submitted</th>
              <th className="pb-3 pr-3">Shortlisted</th>
              <th className="pb-3 pr-3">Interviewed</th>
              <th className="pb-3 pr-3">Selected</th>
              <th className="pb-3">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 pr-3 font-medium">{formatSourceLabel(s.source)}</td>
                <td className="py-3 pr-3">{s.visitors}</td>
                <td className="py-3 pr-3">{s.registrations}</td>
                <td className="py-3 pr-3">{s.started}</td>
                <td className="py-3 pr-3">{s.submitted}</td>
                <td className="py-3 pr-3">{s.shortlisted}</td>
                <td className="py-3 pr-3">{s.interviewed}</td>
                <td className="py-3 pr-3">{s.selected}</td>
                <td className="py-3">{s.rejected}</td>
              </tr>
            ))}
            {!sources.length && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-hurix-gray">No production visitor data yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card-premium overflow-x-auto">
        <h2 className="font-semibold text-lg mb-4">Campaign Performance</h2>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-hurix-gray border-b">
              <th className="pb-3 pr-4">Campaign</th>
              <th className="pb-3 pr-4">Visitors</th>
              <th className="pb-3 pr-4">Registrations</th>
              <th className="pb-3 pr-4">Started</th>
              <th className="pb-3 pr-4">Submitted</th>
              <th className="pb-3">Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.campaign} className="border-b border-slate-100">
                <td className="py-3 pr-4 font-medium">{c.campaign}</td>
                <td className="py-3 pr-4">{c.visitors}</td>
                <td className="py-3 pr-4">{c.registrations}</td>
                <td className="py-3 pr-4">{c.started}</td>
                <td className="py-3 pr-4">{c.submitted}</td>
                <td className="py-3">{c.registrationRate}</td>
              </tr>
            ))}
            {!campaigns.length && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-hurix-gray">No campaign data yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function RealMetricCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card-premium">
      <p className="text-xs text-hurix-gray uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-hurix-charcoal mt-2">{value}</p>
      {sub && <p className="text-xs text-hurix-cyan font-medium mt-1">{sub}</p>}
    </div>
  );
}

function SourceCard({
  metric,
  selected,
  onClick,
}: {
  metric: SourceMetric;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-all ${
        selected ? 'border-hurix-cyan bg-hurix-cyan/5 ring-2 ring-hurix-cyan/20' : 'border-slate-200 hover:border-hurix-blue/40'
      }`}
    >
      <p className="font-semibold text-hurix-charcoal">{formatSourceLabel(metric.source)}</p>
      <p className="text-2xl font-bold text-hurix-blue mt-1">{metric.visitors}</p>
      <p className="text-xs text-hurix-gray mt-1">
        {metric.registrations} reg · {metric.registrationRate}
      </p>
    </button>
  );
}

function MetricBox({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-hurix-charcoal">{value}</p>
      <p className="text-xs text-hurix-gray mt-1">{label}</p>
      {sub && <p className="text-xs text-hurix-cyan font-medium mt-1">{sub}</p>}
    </div>
  );
}
