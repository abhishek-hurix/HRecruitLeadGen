/** First letter uppercase, remaining letters lowercase for each name part. */
export function formatPersonName(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function personNamesMatch(a: string, b: string): boolean {
  return formatPersonName(a).toLowerCase() === formatPersonName(b).toLowerCase();
}
