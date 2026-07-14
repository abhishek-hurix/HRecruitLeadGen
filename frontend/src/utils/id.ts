/** UUID for HTTP EC2 hosts too — `crypto.randomUUID()` throws outside secure contexts. */
export function createClientId(prefix = 'id'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // insecure context (http://EC2_IP) — fall through
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
