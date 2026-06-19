import { isMobilePhone, isTablet } from './device';
import { parseUtmFromUrl } from './utm';
import { trackVisitor } from '../api/visitor';

const VISITOR_ID_KEY = 'hurix_visitor_id';
const VISITOR_CREATED_KEY = 'hurix_visitor_created';
const DEVICE_TYPE_KEY = 'hurix_device_type';
const FIRST_TOUCH_KEY = 'hurix_first_touch';

export type DeviceCategory = 'DESKTOP' | 'TABLET' | 'MOBILE';

let cachedVisitorId: string | null = null;
let cachedDeviceType: DeviceCategory | null = null;
let initialTrackPromise: Promise<void> | null = null;
let lastHeartbeatAt = 0;

const HEARTBEAT_MIN_INTERVAL_MS = 30_000;

function generateVisitorId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function readStoredVisitorId(): string | null {
  try {
    return localStorage.getItem(VISITOR_ID_KEY) || sessionStorage.getItem(VISITOR_ID_KEY);
  } catch {
    return sessionStorage.getItem(VISITOR_ID_KEY);
  }
}

function persistVisitorId(id: string): void {
  try {
    localStorage.setItem(VISITOR_ID_KEY, id);
  } catch {
    // localStorage may be blocked; sessionStorage is the fallback
  }
  sessionStorage.setItem(VISITOR_ID_KEY, id);
}

/** Call synchronously before React renders to guarantee a stable ID. */
export function initVisitorId(): string {
  if (cachedVisitorId) return cachedVisitorId;

  const stored = readStoredVisitorId();
  if (stored) {
    cachedVisitorId = stored;
    persistVisitorId(stored);
    return stored;
  }

  const id = generateVisitorId();
  cachedVisitorId = id;
  persistVisitorId(id);
  return id;
}

export function getVisitorId(): string {
  return cachedVisitorId || initVisitorId();
}

function detectDeviceCategory(): DeviceCategory {
  if (isMobilePhone()) return 'MOBILE';
  if (isTablet()) return 'TABLET';
  return 'DESKTOP';
}

/** Device type is locked on first detection and never changes for this browser. */
export function getLockedDeviceCategory(): DeviceCategory {
  if (cachedDeviceType) return cachedDeviceType;

  try {
    const stored = localStorage.getItem(DEVICE_TYPE_KEY) as DeviceCategory | null;
    if (stored === 'DESKTOP' || stored === 'TABLET' || stored === 'MOBILE') {
      cachedDeviceType = stored;
      return stored;
    }
  } catch {
    // ignore
  }

  const detected = detectDeviceCategory();
  cachedDeviceType = detected;
  try {
    localStorage.setItem(DEVICE_TYPE_KEY, detected);
  } catch {
    // ignore
  }
  return detected;
}

function isVisitorCreated(): boolean {
  try {
    return localStorage.getItem(VISITOR_CREATED_KEY) === '1';
  } catch {
    return sessionStorage.getItem(VISITOR_CREATED_KEY) === '1';
  }
}

function markVisitorCreated(): void {
  try {
    localStorage.setItem(VISITOR_CREATED_KEY, '1');
  } catch {
    // ignore
  }
  sessionStorage.setItem(VISITOR_CREATED_KEY, '1');
}

export function shouldTrackPath(pathname: string): boolean {
  return !pathname.startsWith('/admin');
}

function storeFirstTouch(): void {
  if (sessionStorage.getItem(FIRST_TOUCH_KEY)) return;
  const utm = parseUtmFromUrl();
  sessionStorage.setItem(
    FIRST_TOUCH_KEY,
    JSON.stringify({
      ...utm,
      landingPage: window.location.href,
      referrer: document.referrer || null,
      deviceType: getLockedDeviceCategory(),
      timestamp: new Date().toISOString(),
    })
  );
}

async function createVisitorRecord(): Promise<void> {
  const visitorId = getVisitorId();
  storeFirstTouch();
  const utm = parseUtmFromUrl();

  await trackVisitor({
    visitorId,
    landingPage: window.location.href,
    referrer: document.referrer || null,
    deviceType: getLockedDeviceCategory(),
    ...utm,
    heartbeat: false,
  });

  markVisitorCreated();
}

/** First visit only — creates the single visitor record. */
export async function ensureVisitorTracked(): Promise<void> {
  if (!shouldTrackPath(window.location.pathname)) return;

  if (!initialTrackPromise) {
    initialTrackPromise = (async () => {
      if (isVisitorCreated()) return;
      await createVisitorRecord();
    })();
  }

  await initialTrackPromise;
}

/** Subsequent visits — only bumps lastVisitedAt, never creates a record. */
export async function updateVisitorActivity(): Promise<void> {
  if (!shouldTrackPath(window.location.pathname)) return;
  if (!isVisitorCreated()) return;

  const now = Date.now();
  if (now - lastHeartbeatAt < HEARTBEAT_MIN_INTERVAL_MS) return;
  lastHeartbeatAt = now;

  await trackVisitor({
    visitorId: getVisitorId(),
    landingPage: window.location.href,
    heartbeat: true,
  });
}
