import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Returns goToSection('#products'): on the home page it smooth-scrolls to the
// section as before; on any other page it goes to "/#products" and the
// ScrollManager in App.jsx scrolls there once the home page has rendered.
export default function useSectionNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return useCallback((href) => {
    if (pathname === '/') {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(href === '#home' ? '/' : { pathname: '/', hash: href });
    }
  }, [pathname, navigate]);
}
