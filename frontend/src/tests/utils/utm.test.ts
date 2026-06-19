import { describe, it, expect } from 'vitest';
import { parseUtmFromUrl, formatSourceLabel, hasUtmParams } from '../../utils/utm';

describe('frontend UTM utils', () => {
  it('parses UTM from URL string', () => {
    const utm = parseUtmFromUrl(
      'https://talent.hurix.com/?utm_source=youtube&utm_campaign=test'
    );
    expect(utm.utm_source).toBe('youtube');
    expect(utm.utm_campaign).toBe('test');
  });

  it('detects UTM presence', () => {
    expect(hasUtmParams({ utm_source: 'google' })).toBe(true);
    expect(hasUtmParams({})).toBe(false);
  });

  it('formats source labels', () => {
    expect(formatSourceLabel('ORGANIC')).toBe('Organic');
  });
});
