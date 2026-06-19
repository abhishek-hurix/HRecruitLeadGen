import { CandidateAssessmentStatus, CandidateStatus, DeviceType, Prisma, SelectionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { conversionRate } from '../utils/utm';

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  source?: string;
  campaign?: string;
  medium?: string;
  deviceType?: DeviceType;
  includeTest?: boolean;
  includeInternal?: boolean;
}

export interface FunnelCounts {
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

export interface SourceMetricRow extends FunnelCounts {
  source: string;
}

type CandidateSnapshot = {
  candidateStatus: CandidateStatus;
  assessmentStatus: CandidateAssessmentStatus;
  selectionStatus: SelectionStatus;
};

function buildVisitorWhere(filters: AnalyticsFilters): Prisma.VisitorWhereInput {
  const where: Prisma.VisitorWhereInput = {};

  if (filters.dateFrom || filters.dateTo) {
    where.firstVisitedAt = {};
    if (filters.dateFrom) where.firstVisitedAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      where.firstVisitedAt.lte = end;
    }
  }

  if (filters.source) where.lastTouchSource = filters.source.toLowerCase();
  if (filters.campaign) where.lastTouchCampaign = filters.campaign.toLowerCase();
  if (filters.medium) where.lastTouchMedium = filters.medium.toLowerCase();
  if (filters.deviceType) where.deviceType = filters.deviceType;

  if (!filters.includeTest) where.isTest = false;
  if (!filters.includeInternal) where.isInternal = false;

  return where;
}

function isStarted(status: CandidateStatus, assessmentStatus: CandidateAssessmentStatus): boolean {
  return (
    status === CandidateStatus.STARTED ||
    status === CandidateStatus.SUBMITTED ||
    assessmentStatus === CandidateAssessmentStatus.IN_PROGRESS ||
    assessmentStatus === CandidateAssessmentStatus.SUBMITTED
  );
}

function isSubmitted(status: CandidateStatus, assessmentStatus: CandidateAssessmentStatus): boolean {
  return status === CandidateStatus.SUBMITTED || assessmentStatus === CandidateAssessmentStatus.SUBMITTED;
}

function isShortlisted(selectionStatus: SelectionStatus): boolean {
  return (
    selectionStatus === SelectionStatus.SHORTLISTED ||
    selectionStatus === SelectionStatus.INTERVIEWED ||
    selectionStatus === SelectionStatus.SELECTED
  );
}

function isInterviewed(selectionStatus: SelectionStatus): boolean {
  return selectionStatus === SelectionStatus.INTERVIEWED || selectionStatus === SelectionStatus.SELECTED;
}

function emptyBucket(): Omit<FunnelCounts, 'registrationRate' | 'startRate' | 'submitRate'> {
  return {
    visitors: 0,
    registrations: 0,
    started: 0,
    submitted: 0,
    shortlisted: 0,
    interviewed: 0,
    selected: 0,
    rejected: 0,
  };
}

function accumulateCandidate(bucket: ReturnType<typeof emptyBucket>, candidate: CandidateSnapshot) {
  bucket.registrations += 1;
  if (isStarted(candidate.candidateStatus, candidate.assessmentStatus)) bucket.started += 1;
  if (isSubmitted(candidate.candidateStatus, candidate.assessmentStatus)) bucket.submitted += 1;
  if (isShortlisted(candidate.selectionStatus)) bucket.shortlisted += 1;
  if (isInterviewed(candidate.selectionStatus)) bucket.interviewed += 1;
  if (candidate.selectionStatus === SelectionStatus.SELECTED) bucket.selected += 1;
  if (candidate.selectionStatus === SelectionStatus.REJECTED) bucket.rejected += 1;
}

function toFunnelCounts(bucket: ReturnType<typeof emptyBucket>): FunnelCounts {
  return {
    ...bucket,
    registrationRate: conversionRate(bucket.registrations, bucket.visitors),
    startRate: conversionRate(bucket.started, bucket.registrations),
    submitRate: conversionRate(bucket.submitted, bucket.started),
  };
}

export class AnalyticsService {
  private async loadVisitors(filters: AnalyticsFilters) {
    return prisma.visitor.findMany({
      where: buildVisitorWhere(filters),
      include: {
        candidate: {
          select: {
            candidateStatus: true,
            assessmentStatus: true,
            selectionStatus: true,
          },
        },
      },
    });
  }

  private aggregateByField(
    visitors: Awaited<ReturnType<typeof this.loadVisitors>>,
    field: 'lastTouchSource' | 'lastTouchCampaign' | 'deviceType'
  ) {
    const buckets = new Map<string, ReturnType<typeof emptyBucket>>();

    for (const v of visitors) {
      const key =
        field === 'deviceType'
          ? v.deviceType
          : ((v[field] as string | null) || (field === 'lastTouchSource' ? 'ORGANIC' : 'unknown'));

      const bucket = buckets.get(key) || emptyBucket();
      bucket.visitors += 1;

      if (v.candidateId && v.candidate) {
        accumulateCandidate(bucket, v.candidate);
      }

      buckets.set(key, bucket);
    }

    return Array.from(buckets.entries())
      .map(([key, bucket]) => ({ key, ...toFunnelCounts(bucket) }))
      .sort((a, b) => b.visitors - a.visitors);
  }

  async getOverview(filters: AnalyticsFilters): Promise<FunnelCounts> {
    const visitors = await this.loadVisitors(filters);
    const bucket = emptyBucket();
    bucket.visitors = visitors.length;

    for (const v of visitors) {
      if (v.candidateId && v.candidate) {
        accumulateCandidate(bucket, v.candidate);
      }
    }

    return toFunnelCounts(bucket);
  }

  async getSourceMetrics(filters: AnalyticsFilters): Promise<SourceMetricRow[]> {
    const visitors = await this.loadVisitors(filters);
    return this.aggregateByField(visitors, 'lastTouchSource').map((r) => ({
      source: r.key,
      visitors: r.visitors,
      registrations: r.registrations,
      started: r.started,
      submitted: r.submitted,
      shortlisted: r.shortlisted,
      interviewed: r.interviewed,
      selected: r.selected,
      rejected: r.rejected,
      registrationRate: r.registrationRate,
      startRate: r.startRate,
      submitRate: r.submitRate,
    }));
  }

  async getCampaignMetrics(filters: AnalyticsFilters) {
    const visitors = await this.loadVisitors(filters);
    return this.aggregateByField(visitors, 'lastTouchCampaign')
      .filter((r) => r.key !== 'unknown')
      .map((r) => ({
        campaign: r.key,
        visitors: r.visitors,
        registrations: r.registrations,
        started: r.started,
        submitted: r.submitted,
        shortlisted: r.shortlisted,
        interviewed: r.interviewed,
        selected: r.selected,
        rejected: r.rejected,
        registrationRate: r.registrationRate,
        startRate: r.startRate,
        submitRate: r.submitRate,
      }));
  }

  async getDeviceMetrics(filters: AnalyticsFilters) {
    const visitors = await this.loadVisitors(filters);
    return this.aggregateByField(visitors, 'deviceType').map((r) => ({
      device: r.key,
      visitors: r.visitors,
      registrations: r.registrations,
      started: r.started,
      submitted: r.submitted,
      shortlisted: r.shortlisted,
      interviewed: r.interviewed,
      selected: r.selected,
      rejected: r.rejected,
      registrationRate: r.registrationRate,
    }));
  }

  async getSourceDrilldown(source: string, filters: AnalyticsFilters) {
    return this.getSourceMetrics({ ...filters, source });
  }

  async getFilterOptions(filters: AnalyticsFilters = {}) {
    const where = buildVisitorWhere(filters);
    const [sources, campaigns, mediums] = await Promise.all([
      prisma.visitor.findMany({ where, select: { lastTouchSource: true }, distinct: ['lastTouchSource'] }),
      prisma.visitor.findMany({
        where: { ...where, lastTouchCampaign: { not: null } },
        select: { lastTouchCampaign: true },
        distinct: ['lastTouchCampaign'],
      }),
      prisma.visitor.findMany({
        where: { ...where, lastTouchMedium: { not: null } },
        select: { lastTouchMedium: true },
        distinct: ['lastTouchMedium'],
      }),
    ]);

    return {
      sources: sources.map((s) => s.lastTouchSource).sort(),
      campaigns: campaigns.map((c) => c.lastTouchCampaign!).filter(Boolean).sort(),
      mediums: mediums.map((m) => m.lastTouchMedium!).filter(Boolean).sort(),
      devices: Object.values(DeviceType),
    };
  }

  async exportAnalyticsCSV(filters: AnalyticsFilters) {
    const [sources, campaigns, overview] = await Promise.all([
      this.getSourceMetrics(filters),
      this.getCampaignMetrics(filters),
      this.getOverview(filters),
    ]);

    const lines: string[][] = [
      ['Hurix Marketing Analytics Report'],
      [`Generated: ${new Date().toISOString()}`],
      [`Include Test: ${filters.includeTest ? 'yes' : 'no'}`],
      [`Include Internal: ${filters.includeInternal ? 'yes' : 'no'}`],
      [],
      ['Real Traffic Overview'],
      ['Visitors', String(overview.visitors)],
      ['Registrations', String(overview.registrations)],
      ['Assessment Started', String(overview.started)],
      ['Assessment Submitted', String(overview.submitted)],
      ['Shortlisted', String(overview.shortlisted)],
      ['Interviewed', String(overview.interviewed)],
      ['Selected', String(overview.selected)],
      ['Rejected', String(overview.rejected)],
      [],
      ['Source Funnel'],
      ['Source', 'Visitors', 'Registrations', 'Started', 'Submitted', 'Shortlisted', 'Interviewed', 'Selected', 'Rejected'],
      ...sources.map((s) => [
        s.source,
        String(s.visitors),
        String(s.registrations),
        String(s.started),
        String(s.submitted),
        String(s.shortlisted),
        String(s.interviewed),
        String(s.selected),
        String(s.rejected),
      ]),
      [],
      ['Campaign Performance'],
      ['Campaign', 'Visitors', 'Registrations', 'Started', 'Submitted', 'Selected'],
      ...campaigns.map((c) => [
        c.campaign,
        String(c.visitors),
        String(c.registrations),
        String(c.started),
        String(c.submitted),
        String(c.selected),
      ]),
    ];

    return lines.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  async exportCandidatesAttributionCSV(filters: AnalyticsFilters = {}) {
    const hygieneWhere: Prisma.CandidateProfileWhereInput = {};
    if (!filters.includeTest || !filters.includeInternal) {
      hygieneWhere.visitor = {
        ...(!filters.includeTest ? { isTest: false } : {}),
        ...(!filters.includeInternal ? { isInternal: false } : {}),
      };
    }

    const candidates = await prisma.candidateProfile.findMany({
      where: hygieneWhere,
      include: { user: true, visitor: true },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Full Name',
      'Email',
      'Source',
      'Medium',
      'Campaign',
      'First Touch Source',
      'Last Touch Source',
      'Landing Page',
      'Device',
      'Is Test',
      'Is Internal',
      'Registered At',
      'Assessment Status',
      'Selection Status',
    ];

    const rows = candidates.map((c) => [
      c.fullName,
      c.user.email,
      c.utmSource || '',
      c.utmMedium || '',
      c.utmCampaign || '',
      c.firstTouchSource || '',
      c.lastTouchSource || '',
      c.attributionLandingPage || '',
      c.attributionDevice || '',
      c.visitor?.isTest ? 'yes' : 'no',
      c.visitor?.isInternal ? 'yes' : 'no',
      c.createdAt.toISOString(),
      c.assessmentStatus,
      c.selectionStatus,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return '\uFEFF' + csv;
  }
}

export const analyticsService = new AnalyticsService();
