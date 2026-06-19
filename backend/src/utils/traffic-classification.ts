export function isInternalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.endsWith('.local')
  );
}

export function isInternalLandingPage(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return isInternalHostname(parsed.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|\[::1\]/i.test(url);
  }
}

export function isTestVisitorId(visitorId: string): boolean {
  return /^(test_|organic_|dedup_)/i.test(visitorId);
}

export function classifyVisitorTraffic(visitorId: string, landingPage: string, explicitTest = false) {
  return {
    isTest: explicitTest || isTestVisitorId(visitorId),
    isInternal: isInternalLandingPage(landingPage),
  };
}
