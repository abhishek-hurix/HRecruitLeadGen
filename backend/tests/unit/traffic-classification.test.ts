import { describe, it, expect } from 'vitest';
import {
  isInternalLandingPage,
  isTestVisitorId,
  classifyVisitorTraffic,
} from '../../src/utils/traffic-classification';

describe('Traffic classification', () => {
  it('flags localhost as internal', () => {
    expect(isInternalLandingPage('http://localhost:5173/register')).toBe(true);
    expect(isInternalLandingPage('http://127.0.0.1:4000/')).toBe(true);
    expect(isInternalLandingPage('https://talent.hurix.com/')).toBe(false);
  });

  it('detects test visitor IDs', () => {
    expect(isTestVisitorId('test_abc123')).toBe(true);
    expect(isTestVisitorId('organic_123')).toBe(true);
    expect(isTestVisitorId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('classifies traffic with explicit and implicit test flags', () => {
    const internal = classifyVisitorTraffic('real-id', 'http://localhost:5173');
    expect(internal.isInternal).toBe(true);

    const test = classifyVisitorTraffic('test_123', 'https://talent.hurix.com', true);
    expect(test.isTest).toBe(true);
    expect(test.isInternal).toBe(false);
  });
});
