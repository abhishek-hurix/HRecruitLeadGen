/**
 * Application ID helpers — persisted unique CHAR(8), derived from UUID hex.
 * Concurrent creates: generate from new UUID; on unique violation, regenerate once.
 */
export function applicationIdFromUuid(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
