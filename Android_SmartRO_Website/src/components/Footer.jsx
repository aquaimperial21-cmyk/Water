import { motion } from 'framer-motion';

const PHONE = '+919595190024';
const EMAIL = 'aquaimperial21@gmail.com';
const WHATSAPP = '+919595190024';

export default function Footer() {
  const handleNav = (href) => {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer style={{
      background: 'linear-gradient(180deg, #0F172A 0%, #0A0F1A 100%)',
      color: 'rgba(255,255,255,0.7)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top wave */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', lineHeight: 0 }}>
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ width: '100%', height: '60px' }}>
          <path d="M0,40 C360,80 720,0 1080,40 C1200,60 1320,20 1440,40 L1440,0 L0,0 Z" fill="#ECFEFF" />
        </svg>
      </div>

      {/* Floating particles */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -16, 0], opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: i * 0.6 }}
            style={{
              position: 'absolute',
              left: `${(i * 11) % 100}%`,
              top: `${25 + (i * 7) % 55}%`,
              width: '4px', height: '4px',
              borderRadius: '50%',
              background: 'rgba(34,211,238,0.5)',
            }}
          />
        ))}
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px 40px', position: 'relative', zIndex: 1 }}>
        {/* Top grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
          gap: '48px',
          marginBottom: '56px',
        }}
          className="footer-grid"
        >
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #0891B2, #22D3EE)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 16px rgba(8,145,178,0.35)',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C12 2 5 10 5 15C5 18.866 8.134 22 12 22C15.866 22 19 18.866 19 15C19 10 12 2 12 2Z" fill="white" />
                  <path d="M12 8C12 8 8.5 13 8.5 16C8.5 17.933 10.067 19.5 12 19.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: '20px', color: 'white', lineHeight: 1.1 }}>
                  Aqua <span style={{ color: '#22D3EE' }}>Imperial</span>
                </div>
                <div style={{ fontSize: '8px', color: 'rgba(34,211,238,0.7)', letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 500 }}>Pure Water Solutions</div>
              </div>
            </div>
            <p style={{ fontSize: '14px', lineHeight: 1.8, marginBottom: '20px', maxWidth: '280px', color: 'rgba(255,255,255,0.55)' }}>
              Smart Purifiers on Rent. Free Maintenance for Life. Your trusted partner for clean, safe drinking water at home.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { label: 'Facebook', color: '#1877F2', path: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z' },
                { label: 'Instagram', color: '#E4405F', path: 'M16 4H8a4 4 0 00-4 4v8a4 4 0 004 4h8a4 4 0 004-4V8a4 4 0 00-4-4zm-4 11a3 3 0 110-6 3 3 0 010 6zm3.5-6.5a.75.75 0 110-1.5.75.75 0 010 1.5z' },
                { label: 'YouTube', color: '#FF0000', path: 'M23 7s-.3-2-1.2-2.8C20.7 3.2 19.5 3 12 3S3.3 3.2 2.2 4.2C1.3 5 1 7 1 7s-.3 2-.3 4v2c0 2 .3 4 .3 4s.3 2 1.2 2.8c1.1 1 2.3 1.2 9.8 1.2s8.7-.2 9.8-1.2c.9-.8 1.2-2.8 1.2-2.8s.3-2 .3-4v-2c0-2-.3-4-.3-4zM10 15V9l6 3-6 3z' },
              ].map((social) => (
                <motion.a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  whileHover={{ scale: 1.1, y: -2 }}
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: `${social.color}18`,
                    border: `1px solid ${social.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', textDecoration: 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={social.color}>
                    <path d={social.path}/>
                  </svg>
                </motion.a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '14px', color: 'white', marginBottom: '18px' }}>
              Quick Links
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Home', href: '#home' },
                { label: 'Features', href: '#features' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Plans', href: '#products' },
                { label: 'Testimonials', href: '#testimonials' },
              ].map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => handleNav(link.href)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.5)',
                      fontFamily: "'DM Sans', sans-serif", fontSize: '14px',
                      padding: 0, display: 'flex', alignItems: 'center', gap: '6px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#22D3EE'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  >
                    <span style={{ color: '#22D3EE', fontSize: '10px' }}>›</span>
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Products */}
          <div>
            <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '14px', color: 'white', marginBottom: '18px' }}>
              Our Products
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Aqua Imperial RO', 'Aqua Imperial Copper', 'Aqua Imperial Alkaline', 'Aqua Imperial Mineral+', 'Service & AMC'].map((item) => (
                <li key={item}>
                  <button
                    onClick={() => handleNav('#products')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.5)',
                      fontFamily: "'DM Sans', sans-serif", fontSize: '14px',
                      padding: 0, display: 'flex', alignItems: 'center', gap: '6px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#22D3EE'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  >
                    <span style={{ color: '#22D3EE', fontSize: '10px' }}>›</span>
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '14px', color: 'white', marginBottom: '18px' }}>
              Contact Us
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {[
                {
                  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="#22D3EE"><path d="M4.41 7.19c.98 1.93 2.56 3.5 4.49 4.49l1.5-1.5c.18-.18.45-.24.69-.16.76.25 1.59.39 2.43.39.37 0 .67.3.67.67v2.38c0 .37-.3.67-.67.67C6.35 14.13 1.87 9.65 1.87 4.09c0-.37.3-.67.67-.67h2.39c.37 0 .67.3.67.67 0 .85.14 1.67.39 2.43.07.24.01.5-.16.68L4.41 7.19z"/></svg>,
                  text: '+91 95951 90024',
                  href: `tel:${PHONE}`,
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="#22D3EE" strokeWidth="1.3"/><path d="M2 6l6 4 6-4" stroke="#22D3EE" strokeWidth="1.3" strokeLinecap="round"/></svg>,
                  text: EMAIL,
                  href: `mailto:${EMAIL}`,
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="#22D3EE"><path d="M8 1C5.239 1 3 3.239 3 6C3 9.5 8 15 8 15C8 15 13 9.5 13 6C13 3.239 10.761 1 8 1ZM8 8C6.895 8 6 7.105 6 6C6 4.895 6.895 4 8 4C9.105 4 10 4.895 10 6C10 7.105 9.105 8 8 8Z"/></svg>,
                  text: 'Maharashtra, India',
                  href: '#',
                },
              ].map((item, i) => (
                <a key={i} href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none', fontSize: '13px',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#22D3EE'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                >
                  {item.icon}
                  {item.text}
                </a>
              ))}
            </div>

            {/* WhatsApp CTA */}
            <motion.a
              whileHover={{ scale: 1.02 }}
              href={`https://wa.me/${WHATSAPP.replace('+', '')}?text=Hi Aqua Imperial! I want to know more about your water purifiers on rent.`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(37,211,102,0.12)',
                border: '1px solid rgba(37,211,102,0.25)',
                borderRadius: '10px', padding: '10px 14px',
                textDecoration: 'none', color: '#25D366',
                fontSize: '13px', fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
              </svg>
              Chat with Us on WhatsApp
            </motion.a>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '28px' }} />

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            © 2025 Aqua Imperial. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Privacy Policy', 'Terms of Service', 'Warranty'].map((item) => (
              <a key={item} href="#"
                style={{
                  color: 'rgba(255,255,255,0.35)',
                  textDecoration: 'none', fontSize: '13px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#22D3EE'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
