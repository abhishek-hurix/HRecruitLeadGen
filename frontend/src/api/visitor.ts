import { api } from './client';

export interface TrackVisitorPayload {
  visitorId: string;
  landingPage: string;
  referrer?: string | null;
  deviceType?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  heartbeat?: boolean;
}

export async function trackVisitor(payload: TrackVisitorPayload) {
  const { data } = await api.post('/visitors/track', payload);
  return data;
}
