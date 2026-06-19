export function isMobilePhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  const isPhone =
    /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua);
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
  const isTablet =
    /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && window.innerWidth >= 768);

  return isPhone && isSmallScreen && !isTablet;
}

export function isTablet(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth < 1200)
  );
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}
