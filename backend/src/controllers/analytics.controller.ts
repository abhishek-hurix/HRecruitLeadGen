import { Response, NextFunction } from 'express';
import { DeviceType } from '@prisma/client';
import { analyticsService } from '../services/analytics.service';
import { AuthRequest } from '../middleware/auth';

function parseFilters(req: AuthRequest) {
  const { dateFrom, dateTo, source, campaign, medium, deviceType, includeTest, includeInternal, includeTestCandidates } = req.query;
  return {
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
    source: source ? String(source) : undefined,
    campaign: campaign ? String(campaign) : undefined,
    medium: medium ? String(medium) : undefined,
    deviceType: deviceType ? (String(deviceType).toUpperCase() as DeviceType) : undefined,
    includeTest: includeTest === 'true',
    includeInternal: includeInternal === 'true',
    includeTestCandidates: includeTestCandidates === 'true',
  };
}

export async function getAnalyticsOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getOverview(parseFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAnalyticsSources(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getSourceMetrics(parseFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAnalyticsCampaigns(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getCampaignMetrics(parseFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAnalyticsDevices(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getDeviceMetrics(parseFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAnalyticsSourceDrilldown(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const source = String(req.params.source);
    const data = await analyticsService.getSourceDrilldown(source, parseFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAnalyticsFilterOptions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getFilterOptions(parseFilters(req));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function exportAnalyticsCSV(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const csv = await analyticsService.exportAnalyticsCSV(parseFilters(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="marketing-analytics.csv"');
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
}

export async function exportCandidatesAttributionCSV(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const csv = await analyticsService.exportCandidatesAttributionCSV(parseFilters(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="candidates-attribution.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}
