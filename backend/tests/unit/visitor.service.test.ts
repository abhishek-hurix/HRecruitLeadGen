import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { visitorService } from '../../src/services/visitor.service';
import { hasTestDatabase, getTestPrisma, resetTestData, disconnectTestDb } from '../helpers/db';
import { randomUUID } from 'crypto';

const describeIfDb = hasTestDatabase() ? describe : describe.skip;

describeIfDb('VisitorService', () => {
  beforeAll(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('creates visitor on first track', async () => {
    const visitorId = randomUUID();
    const result = await visitorService.track({
      visitorId,
      landingPage: 'https://talent.hurix.com/?utm_source=youtube&utm_medium=video&utm_campaign=test',
      utm_source: 'youtube',
      utm_medium: 'video',
      utm_campaign: 'test',
      deviceType: 'DESKTOP',
    });
    expect(result.isNew).toBe(true);
    expect(result.visitor?.firstTouchSource).toBe('youtube');
  });

  it('reuses visitor without duplicate records', async () => {
    const visitorId = randomUUID();
    await visitorService.track({
      visitorId,
      landingPage: 'https://talent.hurix.com/',
      deviceType: 'DESKTOP',
    });
    const second = await visitorService.track({
      visitorId,
      landingPage: 'https://talent.hurix.com/register',
      utm_source: 'facebook',
      deviceType: 'DESKTOP',
    });
    expect(second.isNew).toBe(false);
    expect(second.visitor?.lastTouchSource).toBe('facebook');

    const count = await (await getTestPrisma()).visitor.count({ where: { visitorId } });
    expect(count).toBe(1);
  });

  it('heartbeat only updates lastVisitedAt', async () => {
    const visitorId = randomUUID();
    await visitorService.track({
      visitorId,
      landingPage: 'https://talent.hurix.com/',
      utm_source: 'linkedin',
      utm_campaign: 'camp',
    });
    const before = await (await getTestPrisma()).visitor.findUnique({ where: { visitorId } });
    await new Promise((r) => setTimeout(r, 50));
    await visitorService.track({ visitorId, landingPage: '', heartbeat: true });
    const after = await (await getTestPrisma()).visitor.findUnique({ where: { visitorId } });
    expect(after!.lastTouchCampaign).toBe(before!.lastTouchCampaign);
    expect(after!.lastVisitedAt.getTime()).toBeGreaterThanOrEqual(before!.lastVisitedAt.getTime());
  });

  it('classifies organic when no UTM', async () => {
    const visitorId = randomUUID();
    const result = await visitorService.track({
      visitorId,
      landingPage: 'https://talent.hurix.com/',
    });
    expect(result.visitor?.firstTouchSource).toBe('ORGANIC');
  });

  it('flags localhost as internal', async () => {
    const visitorId = randomUUID();
    const result = await visitorService.track({
      visitorId,
      landingPage: 'http://localhost:5173/',
      is_test: true,
    });
    expect(result.visitor?.isInternal).toBe(true);
    expect(result.visitor?.isTest).toBe(true);
  });

  it('heartbeat returns null when visitor does not exist', async () => {
    const result = await visitorService.track({
      visitorId: randomUUID(),
      landingPage: '',
      heartbeat: true,
    });
    expect(result.visitor).toBeNull();
    expect(result.isNew).toBe(false);
  });

  it('links visitor attribution to candidate on registration', async () => {
    const visitorId = randomUUID();
    await visitorService.track({
      visitorId,
      landingPage: 'https://talent.hurix.com/?utm_source=referral',
      utm_source: 'referral',
      utm_campaign: 'employee',
    });
    const user = await (await import('../helpers/factories')).createTestCandidate();
    const candidateId = user.candidateProfile!.id;
    const linked = await visitorService.linkToCandidate(visitorId, candidateId);
    expect(linked).not.toBeNull();

    const prisma = await getTestPrisma();
    const profile = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
    expect(profile?.utmSource).toBe('referral');
    expect(profile?.firstTouchSource).toBe('referral');
    expect(profile?.attributionLandingPage).toContain('talent.hurix.com');
  });

  it('returns null when linking unknown visitor', async () => {
    const user = await (await import('../helpers/factories')).createTestCandidate();
    const result = await visitorService.linkToCandidate(randomUUID(), user.candidateProfile!.id);
    expect(result).toBeNull();
  });
});
