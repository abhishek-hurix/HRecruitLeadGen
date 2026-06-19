import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ensureVisitorTracked, updateVisitorActivity } from '../utils/visitor';

export function VisitorTracker() {
  const location = useLocation();
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    ensureVisitorTracked().catch(() => {});
  }, []);

  useEffect(() => {
    updateVisitorActivity().catch(() => {});
  }, [location.pathname]);

  return null;
}
