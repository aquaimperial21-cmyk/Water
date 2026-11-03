import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const highlights = [
  { text: 'No upfront cost', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#22C55E" strokeWidth="1.5"/><path d="M5 8L7 10L11 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { text: 'Lifetime free maintenance', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#22C55E" strokeWidth="1.5"/><path d="M5 8L7 10L11 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { text: 'Easy monthly subscription', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#22C55E" strokeWidth="1.5"/><path d="M5 8L7 10L11 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
];

const waterTypes = [
  { label: 'RO Purified', color: '#0891B2' },
  { label: 'Mineral Rich', color: '#22C55E' },
  { label: 'Alkaline', color: '#8B5CF6' },
  { label: 'Copper Infused', color: '#F59E0B' },
];

function Bubble({ size, left, delay, duration }) {
  return (
    <motion.div
      initial={{ y: '110vh', opacity: 0, scale: 0 }}
      animate={{ y: '-10vh', opacity: [0, 0.5, 0.3, 0], scale: [0, 1, 1.1, 0.9] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        left: `${left}%`,
        bottom: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(34,211,238,0.15)',
        border: '1px solid rgba(34,211,238,0.3)',
      }}
    />
  );
}

const bubbles = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  size: `${10 + Math.random() * 25}px`,
  left: Math.random() * 100,
  delay: Math.random() * 8,
  duration: 7 + Math.random() * 6,
}));

export default function Hero() {
  const [activeType, setActiveType] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setActiveType(p => (p + 1) % waterTypes.length), 2500);
    return () => clearInterval(t);
  }, []);

  const handleEnquiry = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePlans = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="home"
      ref={heroRef}
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F172A 0%, #164E63 50%, #0891B2 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Gradient orbs */}
      <div style={{
        position: 'absolute', top: '5%', right: '5%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.2) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '5%',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(8,145,178,0.2) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      {/* Wave at bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden', lineHeight: 0 }}>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: '200%', height: '120px', animation: 'waveAnim 10s linear infinite' }}>
          <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" fill="rgba(255,255,255,0.04)" />
        </svg>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, width: '100%', height: '80px' }}>
          <path d="M0,40 C360,80 720,0 1080,40 C1200,60 1320,20 1440,40 L1440,80 L0,80 Z" fill="#ffffff" />
        </svg>
      </div>

      {/* Bubbles */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {bubbles.map(b => <Bubble key={b.id} {...b} />)}
      </div>

      {/* Grid lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
      }} />

      {/* Main content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '120px 24px 100px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '60px',
        alignItems: 'center',
        width: '100%',
        position: 'relative',
        zIndex: 2,
      }}
        className="hero-grid"
      >
        {/* Left: Text */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(34,211,238,0.12)',
              border: '1px solid rgba(34,211,238,0.3)',
              borderRadius: '25px',
              padding: '6px 16px',
              marginBottom: '24px',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22D3EE', animation: 'pulse-glow 2s infinite' }} />
            <span style={{ color: '#67E8F9', fontSize: '13px', fontWeight: 600 }}>Smart Water Purifier on Rent</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 'clamp(36px, 5vw, 62px)',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.1,
              marginBottom: '12px',
              letterSpacing: '-1.5px',
            }}
          >
            AQUA IMPERIAL<br />
            <span style={{ background: 'linear-gradient(90deg, #22D3EE, #0891B2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              RO ON RENT
            </span>
          </motion.h1>

          {/* Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}
          >
            {highlights.map(h => (
              <div key={h.text} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500,
              }}>
                {h.icon}
                {h.text}
              </div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 'clamp(15px, 2vw, 17px)',
              lineHeight: 1.7,
              marginBottom: '36px',
              maxWidth: '500px',
            }}
          >
            Experience next-generation RO water purification with real-time monitoring, 
            IoT-connectivity, and hassle-free monthly subscription. Pure water for your family — always.
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            style={{ display: 'flex', gap: '32px', marginBottom: '36px', flexWrap: 'wrap' }}
          >
            {[
              { value: '10K+', label: 'Happy Families' },
              { value: '7-Stage', label: 'Purification' },
              { value: '99.9%', label: 'Pure Water' },
            ].map((stat) => (
              <div key={stat.label}>
                <div style={{ color: '#22D3EE', fontWeight: 800, fontSize: '24px', fontFamily: "'DM Sans', sans-serif" }}>{stat.value}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 500 }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 8px 32px rgba(34,197,94,0.6)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEnquiry}
              style={{
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                color: 'white',
                border: 'none',
                padding: '16px 36px',
                borderRadius: '12px',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700,
                fontSize: '16px',
                cursor: 'pointer',
                boxShadow: '0 8px 28px rgba(34,197,94,0.4)',
              }}
            >
              Subscribe Now
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.12)' }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePlans}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                border: '1.5px solid rgba(34,211,238,0.4)',
                padding: '16px 36px',
                borderRadius: '12px',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
              }}
            >
              View Plans
            </motion.button>
          </motion.div>
        </div>

        {/* Right: Purifier Graphic */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: 60 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}
        >
          {/* Rotating rings */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute',
              width: '340px', height: '340px', borderRadius: '50%',
              border: '2px solid transparent',
              background: 'linear-gradient(90deg, rgba(8,145,178,0.4), transparent, rgba(34,211,238,0.4), transparent) border-box',
              WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'destination-out',
            }}
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute',
              width: '280px', height: '280px', borderRadius: '50%',
              border: '1px dashed rgba(34,211,238,0.2)',
            }}
          />

          {/* Purifier body */}
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'relative', zIndex: 2 }}
          >
            <div style={{
              width: '200px',
              background: 'linear-gradient(160deg, #e8f8fa 0%, #cceef4 40%, #a8e0ec 100%)',
              borderRadius: '28px 28px 20px 20px',
              padding: '28px 18px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.3), 0 0 40px rgba(8,145,178,0.2), inset 0 1px 0 rgba(255,255,255,0.8)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Shimmer */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s infinite',
              }} />

              {/* Water Type Cycling */}
              <div style={{ marginBottom: '14px', textAlign: 'center' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeType}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      background: `${waterTypes[activeType].color}15`,
                      border: `1.5px solid ${waterTypes[activeType].color}40`,
                      borderRadius: '10px',
                      padding: '8px 12px',
                      display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                    }}
                  >
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: waterTypes[activeType].color,
                      boxShadow: `0 0 8px ${waterTypes[activeType].color}`,
                    }} />
                    <span style={{ color: waterTypes[activeType].color, fontSize: '12px', fontWeight: 700 }}>
                      {waterTypes[activeType].label}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Filter stages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {['Sediment', 'Carbon', 'RO Membrane', 'UV', 'Mineral'].map((stage, i) => (
                  <motion.div
                    key={stage}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'rgba(8,145,178,0.08)',
                      borderRadius: '6px', padding: '5px 8px',
                    }}
                  >
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: `hsl(${180 + i * 12}, 75%, 45%)`,
                      boxShadow: `0 0 6px hsl(${180 + i * 12}, 75%, 45%)`,
                    }} />
                    <span style={{ color: '#164E63', fontSize: '10px', fontWeight: 600 }}>{stage}</span>
                    <div style={{ marginLeft: 'auto' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" fill="#22C55E" opacity="0.2" />
                        <path d="M3.5 6L5 7.5L8.5 4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Brand badge */}
              <div style={{
                marginTop: '14px', textAlign: 'center',
                fontFamily: "'DM Sans', sans-serif", fontWeight: 800,
                fontSize: '14px', color: '#155E75', letterSpacing: '0.5px',
              }}>
                Aqua <span style={{ color: '#0891B2' }}>Imperial</span>
              </div>

              {/* Water tap */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                <div style={{
                  width: '28px', height: '18px',
                  background: 'linear-gradient(180deg, #94a3b8, #64748b)',
                  borderRadius: '4px 4px 2px 2px',
                  position: 'relative',
                }}>
                  <motion.div
                    animate={{ height: ['0px', '22px', '0px'] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                    style={{
                      position: 'absolute', bottom: '-22px', left: '50%', transform: 'translateX(-50%)',
                      width: '4px',
                      background: 'linear-gradient(180deg, #67E8F9, #0891B2)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Shadow pool */}
            <motion.div
              animate={{ scaleX: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: '170px', height: '18px',
                background: 'radial-gradient(ellipse at 50% 50%, rgba(8,145,178,0.5) 0%, transparent 70%)',
                borderRadius: '50%', margin: '0 auto', filter: 'blur(8px)',
              }}
            />
          </motion.div>

          {/* Floating badges */}
          {[
            { text: 'IoT Connected', top: '5%', right: '-10%' },
            { text: '99.9% Pure', bottom: '20%', left: '-18%' },
            { text: 'BIS Certified', top: '40%', right: '-22%' },
          ].map((badge) => (
            <motion.div
              key={badge.text}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: Math.random() * 2 }}
              style={{
                position: 'absolute',
                ...Object.fromEntries(['top','bottom','left','right'].filter(k => badge[k]).map(k => [k, badge[k]])),
                background: 'rgba(15,23,42,0.85)',
                border: '1px solid rgba(34,211,238,0.3)',
                borderRadius: '12px',
                padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: '8px',
                backdropFilter: 'blur(10px)',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill="#22C55E" opacity="0.2"/>
                <path d="M4 7L6 9L10 5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>{badge.text}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <style>{`
        @keyframes pulseSmall {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.5); }
        }
        @media (max-width: 768px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .hero-grid > div:first-child {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>
    </section>
  );
}
