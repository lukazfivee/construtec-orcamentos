import { useEffect, useState } from 'react';

// Mesmo corte do mobile-responsive.css.
const MOBILE_QUERY = '(max-width: 767px)';

export const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

export function useIsMobile() {
  const [mobile, setMobile] = useState(isMobileViewport);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}
