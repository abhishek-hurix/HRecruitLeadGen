import { Router } from 'express';
import { requirePermission } from '../middleware/authorize';
import { Permission } from '../config/permissions';
import {
  getAnalyticsOverview,
  getAnalyticsSources,
  getAnalyticsCampaigns,
  getAnalyticsDevices,
  getAnalyticsSourceDrilldown,
  getAnalyticsFilterOptions,
  exportAnalyticsCSV,
  exportCandidatesAttributionCSV,
} from '../controllers/analytics.controller';

const router = Router();

router.get('/overview', requirePermission(Permission.VIEW_ANALYTICS), getAnalyticsOverview);
router.get('/sources', requirePermission(Permission.VIEW_ANALYTICS), getAnalyticsSources);
router.get('/sources/:source', requirePermission(Permission.VIEW_ANALYTICS), getAnalyticsSourceDrilldown);
router.get('/campaigns', requirePermission(Permission.VIEW_ANALYTICS), getAnalyticsCampaigns);
router.get('/devices', requirePermission(Permission.VIEW_ANALYTICS), getAnalyticsDevices);
router.get('/filters', requirePermission(Permission.VIEW_ANALYTICS), getAnalyticsFilterOptions);
router.get('/export', requirePermission(Permission.VIEW_ANALYTICS), exportAnalyticsCSV);
router.get('/export/candidates', requirePermission(Permission.VIEW_ANALYTICS), exportCandidatesAttributionCSV);

export default router;
