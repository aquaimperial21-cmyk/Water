import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const products = [
  {
    id: 1,
    name: 'Aqua Imperial RO',
    tagline: 'Best for renters and budget-friendly plans',
    specs: ['Storage Tank of 6.5L Capacity', 'Essential minerals', 'Wall-mount or countertop'],
    shortTermPrice: '₹399',
    longTermPrice: '₹349',
    lockIn: '3 Months Lock-In',
    badge: null,
    color: '#0891B2',
    icon: (
      <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
        <path d="M24 2C24 2 6 20 6 34C6 43.941 14.059 52 24 52C33.941 52 42 43.941 42 34C42 20 24 2 24 2Z" fill="url(#p1)"/>
        <path d="M16 32C16 32 18 28 24 26" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <defs><linearGradient id="p1" x1="24" y1="2" x2="24" y2="52"><stop stopColor="#67E8F9"/><stop offset="1" stopColor="#0891B2"/></linearGradient></defs>
      </svg>
    ),
  },
  {
    id: 2,
    name: 'Aqua Imperial Copper',
    tagline: 'For those chasing the extra immunity boost',
    specs: ['Storage Tank of 8L Capacity', 'Essential minerals & Copper', 'Wall-mount or countertop'],
    shortTermPrice: '₹449',
    longTermPrice: '₹404',
    lockIn: '3 Months Lock-In',
    badge: 'BESTSELLER',
    color: '#F59E0B',
    icon: (
      <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
        <path d="M24 2C24 2 6 20 6 34C6 43.941 14.059 52 24 52C33.941 52 42 43.941 42 34C42 20 24 2 24 2Z" fill="url(#p2)"/>
        <circle cx="24" cy="34" r="6" fill="rgba(255,255,255,0.2)"/>
        <path d="M21 34L23 36L27 32" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <defs><linearGradient id="p2" x1="24" y1="2" x2="24" y2="52"><stop stopColor="#FCD34D"/><stop offset="1" stopColor="#D97706"/></linearGradient></defs>
      </svg>
    ),
  },
  {
    id: 3,
    name: 'Aqua Imperial Alkaline',
    tagline: 'For those seeking premium health & hydration',
    specs: ['Storage Tank of 8L Capacity', 'Essential minerals & PH Booster', 'Wall-mount or countertop'],
    shortTermPrice: '₹549',
    longTermPrice: '₹495',
    lockIn: '3 Months Lock-In',
    badge: 'BEST VALUE',
    color: '#8B5CF6',
    icon: (
      <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
        <path d="M24 2C24 2 6 20 6 34C6 43.941 14.059 52 24 52C33.941 52 42 43.941 42 34C42 20 24 2 24 2Z" fill="url(#p3)"/>
        <path d="M20 40C20 40 22 43 24 43C26 43 28 40 28 40" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
        <defs><linearGradient id="p3" x1="24" y1="2" x2="24" y2="52"><stop stopColor="#C4B5FD"/><stop offset="1" stopColor="#7C3AED"/></linearGradient></defs>
      </svg>
    ),
  },
  {
    id: 4,
    name: 'Aqua Imperial Mineral+',
    tagline: 'Made for low-TDS municipal water',
    specs: ['Storage Tank of 6.5L Capacity', 'Essential minerals & Copper', 'Wall-mount or countertop'],
    shortTermPrice: '₹499',
    longTermPrice: '₹449',
    lockIn: '3 Months Lock-In',
    badge: null,
    color: '#22C55E',
    icon: (
      <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
        <path d="M24 2C24 2 6 20 6 34C6 43.941 14.059 52 24 52C33.941 52 42 43.941 42 34C42 20 24 2 24 2Z" fill="url(#p4)"/>
        <path d="M16 32C16 32 18 28 24 26" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <defs><linearGradient id="p4" x1="24" y1="2" x2="24" y2="52"><stop stopColor="#86EFAC"/><stop offset="1" stopColor="#16A34A"/></linearGradient></defs>
      </svg>
    ),
  },
];

export default function Products() {
  const [planType, setPlanType] = useState('long');
  const [hoveredId, setHoveredId] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <section
      id="products"
      style={{ padding: '100px 0', background: '#F8FFFE', position: 'relative', overflow: 'hidden' }}
    >
      {/* BG orbs */}
      <div style={{
        position: 'absolute', top: '10%', left: '-80px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(8,145,178,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '-80px',
        width: '350px', height: '350px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '48px' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.15)',
            borderRadius: '25px', padding: '6px 16px', marginBottom: '16px',
          }}>
            <span style={{ color: '#0891B2', fontSize: '13px', fontWeight: 600 }}>Our Products</span>
          </div>
          <h2 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 800, color: '#0F172A', marginBottom: '16px',
            letterSpacing: '-0.5px',
          }}>
            Products That Fit Every Lifestyle & Budget
          </h2>
          <p style={{ color: '#64748B', fontSize: '17px', maxWidth: '600px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            Each of our smart water purifiers comes with advanced multi-stage purification and IoT technology.
          </p>

          {/* Plan toggle */}
          <div style={{
            display: 'inline-flex',
            background: '#ffffff',
            borderRadius: '14px',
            padding: '4px',
            border: '1px solid rgba(8,145,178,0.12)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <button
              onClick={() => setPlanType('short')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: planType === 'short' ? 'linear-gradient(135deg, #0891B2, #0E7490)' : 'transparent',
                color: planType === 'short' ? 'white' : '#64748B',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.25s',
              }}
            >
              Flexible Short-term Plans
            </button>
            <button
              onClick={() => setPlanType('long')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: planType === 'long' ? 'linear-gradient(135deg, #0891B2, #0E7490)' : 'transparent',
                color: planType === 'long' ? 'white' : '#64748B',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.25s',
              }}
            >
              Long-term Value Plans
            </button>
          </div>
          <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '10px' }}>
            {planType === 'short' ? 'Flexible plans suitable for renters on-the-go (28/90/180 days)' : 'Save more with annual subscriptions — best value for families'}
          </div>
        </motion.div>

        {/* Product cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}>
          {products.map((product, i) => {
            const isHovered = hoveredId === product.id;
            const price = planType === 'short' ? product.shortTermPrice : product.longTermPrice;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 50 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                onMouseEnter={() => setHoveredId(product.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: isHovered
                    ? 'linear-gradient(155deg, #0F172A 0%, #164E63 100%)'
                    : '#ffffff',
                  borderRadius: '24px',
                  padding: '32px 24px',
                  border: `1.5px solid ${isHovered ? product.color + '60' : 'rgba(8,145,178,0.1)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.35s ease',
                  boxShadow: isHovered
                    ? `0 20px 50px ${product.color}25, 0 0 0 1px ${product.color}30`
                    : '0 2px 16px rgba(0,0,0,0.04)',
                  transform: isHovered ? 'translateY(-8px)' : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Badge */}
                {product.badge && (
                  <div style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: `linear-gradient(135deg, ${product.color}, ${product.color}CC)`,
                    color: 'white', fontSize: '9px', fontWeight: 800,
                    padding: '4px 12px', borderRadius: '20px',
                    letterSpacing: '1px',
                    boxShadow: `0 4px 12px ${product.color}40`,
                  }}>
                    {product.badge}
                  </div>
                )}

                {/* Water drop icon */}
                <div style={{
                  display: 'flex', justifyContent: 'center', marginBottom: '18px',
                }}>
                  <motion.div
                    animate={isHovered ? { y: [0, -8, 0] } : {}}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: '80px', height: '80px', borderRadius: '50%',
                      background: isHovered
                        ? `${product.color}20`
                        : `${product.color}08`,
                      border: `1.5px solid ${isHovered ? product.color + '40' : product.color + '15'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.3s',
                    }}
                  >
                    {product.icon}
                  </motion.div>
                </div>

                {/* Name */}
                <h3 style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '18px', fontWeight: 700, textAlign: 'center',
                  color: isHovered ? '#ffffff' : '#0F172A',
                  marginBottom: '4px',
                  transition: 'color 0.3s',
                }}>
                  {product.name}
                </h3>
                <p style={{
                  color: isHovered ? 'rgba(255,255,255,0.6)' : '#94A3B8',
                  fontSize: '12px', fontWeight: 500, textAlign: 'center',
                  marginBottom: '20px', lineHeight: 1.4,
                  transition: 'color 0.3s',
                }}>
                  {product.tagline}
                </p>

                {/* Specs */}
                <div style={{ marginBottom: '20px' }}>
                  {product.specs.map((spec) => (
                    <div key={spec} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      marginBottom: '8px',
                      color: isHovered ? 'rgba(255,255,255,0.75)' : '#475569',
                      fontSize: '13px',
                      transition: 'color 0.3s',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="7" cy="7" r="6" fill={product.color} opacity="0.15"/>
                        <path d="M4.5 7L6 8.5L9.5 5" stroke={product.color} strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      {spec}
                    </div>
                  ))}
                </div>

                {/* Price */}
                <div style={{
                  background: isHovered ? 'rgba(255,255,255,0.06)' : `${product.color}06`,
                  border: `1px solid ${isHovered ? 'rgba(255,255,255,0.08)' : product.color + '12'}`,
                  borderRadius: '14px', padding: '16px',
                  textAlign: 'center', marginBottom: '16px',
                  transition: 'all 0.3s',
                }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={planType}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '36px', fontWeight: 800, lineHeight: 1,
                        color: isHovered ? '#67E8F9' : product.color,
                        transition: 'color 0.3s',
                      }}>
                        {price}
                        <span style={{ fontSize: '14px', fontWeight: 500, color: isHovered ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>/mo</span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  <div style={{
                    color: isHovered ? 'rgba(255,255,255,0.4)' : '#94A3B8',
                    fontSize: '11px', fontWeight: 600, marginTop: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    transition: 'color 0.3s',
                  }}>
                    {product.lockIn}
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      color: isHovered ? 'rgba(255,255,255,0.8)' : '#64748B',
                      border: `1.5px solid ${isHovered ? 'rgba(255,255,255,0.15)' : 'rgba(8,145,178,0.15)'}`,
                      padding: '10px',
                      borderRadius: '10px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 600, fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                    }}
                  >
                    Know more
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      flex: 1,
                      background: isHovered
                        ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                        : `linear-gradient(135deg, ${product.color}, ${product.color}CC)`,
                      color: 'white',
                      border: 'none',
                      padding: '10px',
                      borderRadius: '10px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700, fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: isHovered ? '0 4px 16px rgba(34,197,94,0.4)' : `0 4px 12px ${product.color}30`,
                      transition: 'all 0.25s',
                    }}
                  >
                    Subscribe
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{
            textAlign: 'center', marginTop: '48px',
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '32px',
          }}
        >
          {[
            { text: 'Free Installation', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L2 6V13L9 17L16 13V6L9 2Z" fill="#0891B2" opacity="0.15"/><path d="M6 9L8 11L12 7" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/></svg> },
            { text: 'No Maintenance Charges', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" fill="#0891B2" opacity="0.15"/><path d="M6 9L8 11L12 7" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/></svg> },
            { text: '24/7 Support', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" fill="#0891B2" opacity="0.15"/><path d="M9 5V9L12 11" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/></svg> },
            { text: '99.9% Pure Water', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2C9 2 4 8 4 12C4 14.761 6.239 17 9 17C11.761 17 14 14.761 14 12C14 8 9 2 9 2Z" fill="#0891B2" opacity="0.15"/><path d="M7 11C7 11 8 9.5 9 9" stroke="#0891B2" strokeWidth="1.2" strokeLinecap="round"/></svg> },
          ].map((item) => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '14px', fontWeight: 500 }}>
              {item.icon}
              {item.text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
