import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Plans', href: '#products' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'Contact', href: '#contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState('#home');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (href) => {
    setActiveLink(href);
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: scrolled ? '8px 0' : '16px 0',
          background: scrolled
            ? 'rgba(255, 255, 255, 0.95)'
            : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.08)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(8,145,178,0.1)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => handleNavClick('#home')}
          >
            <div style={{
              width: '42px', height: '42px',
              background: 'linear-gradient(135deg, #0891B2, #22D3EE)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(8,145,178,0.3)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C12 2 5 10 5 15C5 18.866 8.134 22 12 22C15.866 22 19 18.866 19 15C19 10 12 2 12 2Z" fill="white" />
                <path d="M12 8C12 8 8.5 13 8.5 16C8.5 17.933 10.067 19.5 12 19.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 800,
                fontSize: '20px',
                color: scrolled ? '#0F172A' : '#ffffff',
                letterSpacing: '-0.5px',
                lineHeight: 1.1,
                transition: 'color 0.3s',
              }}>
                Aqua <span style={{ color: '#0891B2' }}>Imperial</span>
              </div>
              <div style={{
                fontSize: '8px',
                color: scrolled ? 'rgba(8,145,178,0.8)' : 'rgba(255,255,255,0.7)',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                lineHeight: 1,
                fontWeight: 500,
                transition: 'color 0.3s',
              }}>
                Pure Water Solutions
              </div>
            </div>
          </motion.div>

          {/* Desktop Nav */}
          <ul style={{
            display: 'flex',
            gap: '4px',
            listStyle: 'none',
            alignItems: 'center',
          }}
            className="desktop-nav"
          >
            {navLinks.map((link) => (
              <li key={link.href}>
                <button
                  onClick={() => handleNavClick(link.href)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: activeLink === link.href
                      ? '#0891B2'
                      : scrolled ? '#334155' : 'rgba(255,255,255,0.9)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '14px',
                    fontWeight: activeLink === link.href ? 600 : 500,
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: activeLink === link.href
                      ? (scrolled ? 'rgba(8,145,178,0.08)' : 'rgba(255,255,255,0.12)')
                      : 'transparent',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#0891B2';
                    e.currentTarget.style.background = scrolled ? 'rgba(8,145,178,0.06)' : 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = activeLink === link.href
                      ? '#0891B2'
                      : scrolled ? '#334155' : 'rgba(255,255,255,0.9)';
                    e.currentTarget.style.background = activeLink === link.href
                      ? (scrolled ? 'rgba(8,145,178,0.08)' : 'rgba(255,255,255,0.12)')
                      : 'transparent';
                  }}
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>

          {/* CTA Button Desktop */}
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 8px 28px rgba(34,197,94,0.5)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleNavClick('#contact')}
            style={{
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '10px',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(34,197,94,0.35)',
              whiteSpace: 'nowrap',
            }}
            className="desktop-cta"
          >
            Subscribe Now
          </motion.button>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            style={{
              background: 'none',
              border: `1.5px solid ${scrolled ? 'rgba(8,145,178,0.3)' : 'rgba(255,255,255,0.3)'}`,
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              alignItems: 'center',
              transition: 'border-color 0.3s',
            }}
            className="hamburger"
          >
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: '22px', height: '2px',
                background: scrolled ? '#0891B2' : '#fff',
                borderRadius: '2px',
                transition: 'all 0.3s',
                transform: menuOpen
                  ? i === 0 ? 'rotate(45deg) translate(5px, 5px)'
                  : i === 1 ? 'opacity: 0'
                  : 'rotate(-45deg) translate(5px, -5px)'
                  : 'none',
                opacity: menuOpen && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              top: '70px',
              left: 0,
              right: 0,
              zIndex: 999,
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(8,145,178,0.1)',
              padding: '20px 24px 30px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            }}
          >
            {navLinks.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => handleNavClick(link.href)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    color: activeLink === link.href ? '#0891B2' : '#334155',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '16px',
                    fontWeight: 500,
                    padding: '14px 0',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                  }}
                >
                  {link.label}
                </button>
              </motion.div>
            ))}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              onClick={() => handleNavClick('#contact')}
              style={{
                marginTop: '20px',
                width: '100%',
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                color: 'white',
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
              }}
            >
              Subscribe Now
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .desktop-cta { display: none !important; }
          .hamburger { display: flex !important; }
        }
        @media (min-width: 901px) {
          .hamburger { display: none !important; }
        }
        .desktop-nav { display: flex; }
        .desktop-cta { display: block; }
      `}</style>
    </>
  );
}
