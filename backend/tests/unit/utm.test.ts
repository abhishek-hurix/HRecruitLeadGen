import { describe, it, expect } from 'vitest';
import {
  parseUtmFromQuery,
  defaultOrganicUtm,
  conversionRate,
  formatSourceLabel,
  normalizeDeviceType,
} from '../../src/utils/utm';

describe('UTM parser', () => {
  it('parses all UTM parameters', () => {
    const utm = parseUtmFromQuery({
      utm_source: 'YouTube',
      utm_medium: 'Video',
      utm_campaign: 'AI_Hiring_2026',
      utm_term: 'GenAI',
      utm_content: 'Shorts',
    });
    expect(utm).toEqual({
      source: 'youtube',
      medium: 'video',
      campaign: 'ai_hiring_2026',
      term: 'genai',
      content: 'shorts',
    });
  });

  it('returns null when no UTM params', () => {
    expect(parseUtmFromQuery({})).toBeNull();
  });

  it('defaults organic UTM', () => {
    expect(defaultOrganicUtm().source).toBe('ORGANIC');
  });

  it('calculates conversion rates', () => {
    expect(conversionRate(25, 100)).toBe('25.0%');
    expect(conversionRate(0, 0)).toBe('0.0%');
  });

  it('formats source labels', () => {
    expect(formatSourceLabel('ORGANIC')).toBe('Organic');
    expect(formatSourceLabel('youtube')).toBe('Youtube');
  });

  it('normalizes device types', () => {
    expect(normalizeDeviceType('mobile')).toBe('MOBILE');
    expect(normalizeDeviceType('invalid')).toBe('DESKTOP');
  });
});
