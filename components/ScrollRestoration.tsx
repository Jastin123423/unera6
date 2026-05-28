// components/ScrollRestoration.tsx
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollRestoration() {
  const { pathname, search } = useLocation();
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const isBackNavigation = useRef(false);

  useEffect(() => {
    // Listen for popstate (back/forward buttons)
    const handlePopState = () => {
      isBackNavigation.current = true;
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    // Save current scroll position before navigating away
    const saveCurrentScroll = () => {
      const key = `${pathname}${search}`;
      scrollPositions.current.set(key, window.scrollY);
    };

    // Save on beforeunload (page refresh/close)
    window.addEventListener('beforeunload', saveCurrentScroll);
    
    // Save on scroll (throttled)
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const key = `${pathname}${search}`;
          scrollPositions.current.set(key, window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Restore scroll position
    const key = `${pathname}${search}`;
    const savedPosition = scrollPositions.current.get(key);
    
    if (isBackNavigation.current && savedPosition !== undefined) {
      // Restore position for back/forward navigation
      setTimeout(() => {
        window.scrollTo({
          top: savedPosition,
          behavior: 'instant'
        });
      }, 0);
      isBackNavigation.current = false;
    } else if (!savedPosition) {
      // New page - scroll to top
      window.scrollTo(0, 0);
    } else {
      // Existing page with saved position (rare)
      setTimeout(() => {
        window.scrollTo({
          top: savedPosition,
          behavior: 'instant'
        });
      }, 0);
    }

    return () => {
      window.removeEventListener('beforeunload', saveCurrentScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname, search]);

  return null;
}
