import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analyticsService } from '../../src/services/analytics.service';
import {
  hasTestDatabase,
  getTestPrisma,
  resetTestData,
  disconnectTestDb,
} from '../helpers/db';
import { createTestVisitor, createTestCandidate } from '../helpers/factories';
import { CandidateAssessmentStatus, CandidateStatus, SelectionStatus } from '@prisma/client';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('AnalyticsService', () => {
  beforeAll(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('excludes test and internal traffic by default', async () => {
    await createTestVisitor({ source: 'youtube', isTest: false, isInternal: false });
    await createTestVisitor({ source: 'facebook', isTest: true, isInternal: true });

    const overview = await analyticsService.getOverview({});
    expect(overview.visitors).toBe(1);
  });

  it('includes test traffic when flag enabled', async () => {
    const overview = await analyticsService.getOverview({ includeTest: true, includeInternal: true });
    expect(overview.visitors).toBeGreaterThanOrEqual(2);
  });

  it('calculates conversion rates', async () => {
    await resetTestData();
    const visitor = await createTestVisitor({ source: 'google', campaign: 'hiring' });
    const user = await createTestCandidate();
    const candidateId = user.candidateProfile!.id;

    await (await getTestPrisma()).visitor.update({
      where: { id: visitor.id },
      data: { candidateId, registeredAt: new Date() },
    });
    await (await getTestPrisma()).candidateProfile.update({
      where: { id: candidateId },
      data: {
        candidateStatus: CandidateStatus.SUBMITTED,
        assessmentStatus: CandidateAssessmentStatus.SUBMITTED,
        selectionStatus: SelectionStatus.SELECTED,
      },
    });

    const sources = await analyticsService.getSourceMetrics({});
    const google = sources.find((s) => s.source === 'google');
    expect(google?.registrations).toBe(1);
    expect(google?.submitted).toBe(1);
    expect(google?.selected).toBe(1);
    expect(google?.registrationRate).toBe('100.0%');
  });

  it('reports source-level funnel', async () => {
    const sources = await analyticsService.getSourceMetrics({ includeTest: true, includeInternal: true });
    expect(sources[0]).toHaveProperty('shortlisted');
    expect(sources[0]).toHaveProperty('interviewed');
  });

  it('aggregates campaign metrics and filters unknown', async () => {
    await resetTestData();
    await createTestVisitor({ source: 'google', campaign: 'spring_hire' });
    await createTestVisitor({ source: 'linkedin', campaign: 'spring_hire' });
    const campaigns = await analyticsService.getCampaignMetrics({});
    expect(campaigns.some((c) => c.campaign === 'spring_hire')).toBe(true);
    expect(campaigns.every((c) => c.campaign !== 'unknown')).toBe(true);
  });

  it('aggregates device metrics', async () => {
    const devices = await analyticsService.getDeviceMetrics({ includeTest: true, includeInternal: true });
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0]).toHaveProperty('device');
    expect(devices[0]).toHaveProperty('registrationRate');
  });

  it('filters by date range', async () => {
    await resetTestData();
    await createTestVisitor({ source: 'twitter' });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const overview = await analyticsService.getOverview({
      dateFrom: tomorrow.toISOString().slice(0, 10),
    });
    expect(overview.visitors).toBe(0);
  });

  it('returns filter options', async () => {
    await createTestVisitor({ source: 'bing', campaign: 'brand' });
    const options = await analyticsService.getFilterOptions({ includeTest: true, includeInternal: true });
    expect(options.sources.length).toBeGreaterThan(0);
    expect(options.devices).toContain('DESKTOP');
  });

  it('drills down by source', async () => {
    const drill = await analyticsService.getSourceDrilldown('google', {
      includeTest: true,
      includeInternal: true,
    });
    expect(Array.isArray(drill)).toBe(true);
  });

  it('exports analytics CSV', async () => {
    const csv = await analyticsService.exportAnalyticsCSV({ includeTest: true, includeInternal: true });
    expect(csv).toContain('Hurix Marketing Analytics Report');
    expect(csv).toContain('Source Funnel');
    expect(csv).toContain('Campaign Performance');
  });

  it('exports candidate attribution CSV with BOM', async () => {
    await resetTestData();
    const visitor = await createTestVisitor({ source: 'google', isTest: false, isInternal: false });
    const user = await createTestCandidate();
    const prisma = await getTestPrisma();
    await prisma.candidateProfile.update({
      where: { id: user.candidateProfile!.id },
      data: { visitorId: visitor.visitorId },
    });
    await prisma.visitor.update({
      where: { id: visitor.id },
      data: { candidateId: user.candidateProfile!.id },
    });
    const csv = await analyticsService.exportCandidatesAttributionCSV({});
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Full Name');
    expect(csv).toContain(user.email);
  });
});
