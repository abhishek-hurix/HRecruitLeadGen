import { prisma } from '../config/database';
import { parseUtmFromQuery, normalizeDeviceType, defaultOrganicUtm } from '../utils/utm';
import { classifyVisitorTraffic } from '../utils/traffic-classification';

export interface TrackVisitorInput {
  visitorId: string;
  landingPage: string;
  referrer?: string | null;
  deviceType?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  heartbeat?: boolean;
  is_test?: boolean;
}

export class VisitorService {
  async track(input: TrackVisitorInput) {
    const now = new Date();

    if (input.heartbeat) {
      const existing = await prisma.visitor.findUnique({
        where: { visitorId: input.visitorId },
      });
      if (!existing) {
        return { visitor: null, isNew: false };
      }

      const updated = await prisma.visitor.update({
        where: { visitorId: input.visitorId },
        data: { lastVisitedAt: now },
      });
      return { visitor: updated, isNew: false };
    }

    const utmFromVisit = parseUtmFromQuery({
      utm_source: input.utm_source,
      utm_medium: input.utm_medium,
      utm_campaign: input.utm_campaign,
      utm_term: input.utm_term,
      utm_content: input.utm_content,
    });
    const deviceType = normalizeDeviceType(input.deviceType);
    const utm = utmFromVisit || defaultOrganicUtm();
    const traffic = classifyVisitorTraffic(input.visitorId, input.landingPage, input.is_test === true);

    const existing = await prisma.visitor.findUnique({
      where: { visitorId: input.visitorId },
    });

    const visitor = await prisma.visitor.upsert({
      where: { visitorId: input.visitorId },
      create: {
        visitorId: input.visitorId,
        firstTouchSource: utm.source,
        firstTouchMedium: utm.medium,
        firstTouchCampaign: utm.campaign,
        firstTouchTerm: utm.term,
        firstTouchContent: utm.content,
        lastTouchSource: utm.source,
        lastTouchMedium: utm.medium,
        lastTouchCampaign: utm.campaign,
        lastTouchTerm: utm.term,
        lastTouchContent: utm.content,
        landingPage: input.landingPage,
        referrer: input.referrer || null,
        deviceType,
        isTest: traffic.isTest,
        isInternal: traffic.isInternal,
        firstVisitedAt: now,
        lastVisitedAt: now,
      },
      update: {
        ...(utmFromVisit
          ? {
              lastTouchSource: utm.source,
              lastTouchMedium: utm.medium,
              lastTouchCampaign: utm.campaign,
              lastTouchTerm: utm.term,
              lastTouchContent: utm.content,
            }
          : {}),
        landingPage: input.landingPage,
        ...(input.referrer ? { referrer: input.referrer } : {}),
        lastVisitedAt: now,
      },
    });

    return { visitor, isNew: !existing };
  }

  async linkToCandidate(visitorId: string, candidateId: string) {
    const visitor = await prisma.visitor.findUnique({ where: { visitorId } });
    if (!visitor) return null;

    const now = new Date();

    await prisma.$transaction([
      prisma.visitor.update({
        where: { visitorId },
        data: { candidateId, registeredAt: now },
      }),
      prisma.candidateProfile.update({
        where: { id: candidateId },
        data: {
          visitorId,
          utmSource: visitor.lastTouchSource,
          utmMedium: visitor.lastTouchMedium,
          utmCampaign: visitor.lastTouchCampaign,
          utmTerm: visitor.lastTouchTerm,
          utmContent: visitor.lastTouchContent,
          firstTouchSource: visitor.firstTouchSource,
          lastTouchSource: visitor.lastTouchSource,
          attributionLandingPage: visitor.landingPage,
          attributionReferrer: visitor.referrer,
          attributionDevice: visitor.deviceType,
        },
      }),
    ]);

    return visitor;
  }
}

export const visitorService = new VisitorService();
