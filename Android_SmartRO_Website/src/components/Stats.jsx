import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

function AnimatedCounter({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView({ threshold: 0.5, triggerOnce: true });

  useEffect(() => {
    if (!inView) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const stats = [
  {
    value: 10000, suffix: '+', label: 'Happy Families',
    sub: 'across India',
    accent: '#FCD34D',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="s1g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FEF3C7"/>
            <stop offset="100%" stopColor="#FCD34D"/>
          </linearGradient>
        </defs>
        {/* heart with families */}
        <path d="M28 50C28 50 6 38 6 22C6 14.27 12.27 8 20 8C23.61 8 26.93 9.43 29.42 11.83C31.85 9.43 35.18 8 38.78 8C46.51 8 52.78 14.27 52.78 22C52.78 29 46 36 39 41" fill="url(#s1g)" stroke="#0a2540" strokeWidth="1.6" strokeLinejoin="round"/>
        <circle cx="20" cy="22" r="3" fill="#ffffff"/>
        <circle cx="36" cy="22" r="3" fill="#ffffff"/>
        <path d="M20 32 Q28 38 36 32" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: 99.9, suffix: '%', label: 'Purity Guarantee', decimal: true,
    sub: 'every single drop',
    accent: '#67E8F9',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="s2g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#67E8F9"/>
            <stop offset="100%" stopColor="#0E7490"/>
          </linearGradient>
        </defs>
        {/* shield with droplet inside */}
        <path d="M28 6L8 14V28C8 39 16 48 28 52C40 48 48 39 48 28V14L28 6Z" fill="url(#s2g)" stroke="#0a2540" strokeWidth="1.4"/>
        <path d="M28 18C28 18 22 26 22 30C22 33.31 24.69 36 28 36C31.31 36 34 33.31 34 30C34 26 28 18 28 18Z" fill="#ffffff"/>
        <path d="M25 30C25 30 26 28 28 27.5" stroke="#0891B2" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="42" cy="42" r="6" fill="#22C55E" stroke="#0a2540" strokeWidth="1"/>
        <path d="M39 42L41.5 44.5L46 39.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    value: 5, suffix: '+', label: 'Cities Served',
    sub: 'and growing fast',
    accent: '#A7F3D0',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="s3g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#86EFAC"/>
            <stop offset="100%" stopColor="#16A34A"/>
          </linearGradient>
        </defs>
        {/* map pin with pulses */}
        <circle cx="28" cy="38" r="14" fill="#0a2540" opacity="0.18"/>
        <circle cx="28" cy="38" r="9" fill="#0a2540" opacity="0.18"/>
        <path d="M28 6C20.27 6 14 12.27 14 20C14 30 28 48 28 48C28 48 42 30 42 20C42 12.27 35.73 6 28 6Z" fill="url(#s3g)" stroke="#0a2540" strokeWidth="1.4"/>
        <circle cx="28" cy="20" r="5" fill="#ffffff"/>
        <circle cx="28" cy="20" r="2" fill="#16A34A"/>
        {/* satellite dots */}
        <circle cx="10" cy="14" r="2" fill="#86EFAC"/>
        <circle cx="48" cy="10" r="2" fill="#86EFAC"/>
        <circle cx="48" cy="44" r="2" fill="#86EFAC" opacity="0.7"/>
      </svg>
    ),
  },
  {
    value: 24, suffix: '/7', label: 'Customer Support',
    sub: 'real humans, fast replies',
    accent: '#C4B5FD',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="s4g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DDD6FE"/>
            <stop offset="100%" stopColor="#7C3AED"/>
          </linearGradient>
        </defs>
        {/* clock */}
        <circle cx="28" cy="28" r="22" fill="url(#s4g)" stroke="#0a2540" strokeWidth="1.4"/>
        <circle cx="28" cy="28" r="22" fill="none" stroke="#ffffff" strokeWidth="1" strokeDasharray="2 4" opacity="0.4"/>
        <path d="M28 14V28L36 32" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round"/>
        <circle cx="28" cy="28" r="2" fill="#ffffff"/>
        {/* tick markers */}
        <circle cx="28" cy="8" r="1.5" fill="#ffffff"/>
        <circle cx="48" cy="28" r="1.5" fill="#ffffff"/>
        <circle cx="28" cy="48" r="1.5" fill="#ffffff"/>
        <circle cx="8" cy="28" r="1.5" fill="#ffffff"/>
      </svg>
    ),
  },
];

export default function Stats() {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });

  return (
    <section style={{
      padding: '110px 0 120px',
      background: 'linear-gradient(135deg, #0E7490 0%, #0891B2 50%, #155E75 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative bubbles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -30, 0],
            opacity: [0.15, 0.4, 0.15],
          }}
          transition={{
            duration: 6 + i * 0.7,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: `${8 + i * 15}%`,
            bottom: `${10 + (i % 3) * 18}%`,
            width: `${20 + i * 8}px`,
            height: `${20 + i * 8}px`,
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(2px)',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Subtle radial accents */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 18% 30%, rgba(34,211,238,0.18) 0%, transparent 45%), radial-gradient(circle at 82% 70%, rgba(252,211,77,0.1) 0%, transparent 45%)',
      }} />

      {/* Soft wave divider — top */}
      <svg
        viewBox="0 0 1440 60" preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50px', opacity: 0.12 }}
      >
        <path d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,15 1440,30 L1440,0 L0,0 Z" fill="#ffffff"/>
      </svg>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '64px' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: '999px',
            padding: '7px 18px',
            marginBottom: '18px',
            backdropFilter: 'blur(10px)',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5L8.6 4.85L12.25 5.4L9.6 8L10.25 11.6L7 9.85L3.75 11.6L4.4 8L1.75 5.4L5.4 4.85L7 1.5Z" fill="#FCD34D"/>
            </svg>
            <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase' }}>By the Numbers</span>
          </div>
          <h2 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
            marginBottom: '14px',
          }}>
            A Thriving Community of <br/>
            <span style={{
              background: 'linear-gradient(90deg, #FCD34D, #67E8F9)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Happy Families</span>
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: '16px',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.7,
          }}>
            Real numbers from real homes — measurable trust we've earned, one drop at a time.
          </p>
        </motion.div>

        <div
          ref={ref}
          className="stats-grid"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="stat-card"
              initial={{ opacity: 0, y: 30, scale: 0.94 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              style={{ '--accent': stat.accent }}
            >
              <span className="stat-corner" aria-hidden="true" />
              <div className="stat-icon">{stat.icon}</div>

              <div className="stat-value">
                {stat.decimal ? (
                  <>{stat.value}{stat.suffix}</>
                ) : (
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                )}
              </div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-sub">{stat.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Soft wave divider — bottom */}
      <svg
        viewBox="0 0 1440 60" preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '50px', opacity: 0.12 }}
      >
        <path d="M0,30 C360,0 720,60 1080,30 C1260,15 1380,45 1440,30 L1440,60 L0,60 Z" fill="#ffffff"/>
      </svg>

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
        }

        .stat-card {
          --accent: #FCD34D;
          position: relative;
          padding: 28px 22px 26px;
          background: linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 100%);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 20px;
          text-align: center;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          overflow: hidden;
          isolation: isolate;
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.4s, background 0.4s;
        }
        .stat-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(180px 140px at 50% 0%, color-mix(in oklab, var(--accent) 32%, transparent), transparent 70%);
          opacity: 0;
          transition: opacity 0.4s ease;
          z-index: -1;
        }
        .stat-card:hover {
          transform: translateY(-6px);
          border-color: color-mix(in oklab, var(--accent) 60%, rgba(255,255,255,0.18));
          background: linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 100%);
        }
        .stat-card:hover::before { opacity: 0.85; }

        .stat-corner {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 22px;
          height: 22px;
          border-top: 1.5px solid var(--accent);
          border-right: 1.5px solid var(--accent);
          border-radius: 0 8px 0 0;
          opacity: 0.4;
          transition: opacity 0.3s, width 0.3s, height 0.3s;
        }
        .stat-card:hover .stat-corner { opacity: 1; width: 28px; height: 28px; }

        .stat-icon {
          width: 76px;
          height: 76px;
          border-radius: 22px;
          background: linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04));
          border: 1px solid rgba(255,255,255,0.18);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
          box-shadow: 0 12px 28px rgba(8, 23, 42, 0.22), inset 0 1px 0 rgba(255,255,255,0.18);
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .stat-card:hover .stat-icon { transform: rotate(-4deg) scale(1.06); }
        .stat-icon svg { width: 56px; height: 56px; }

        .stat-value {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(34px, 4.6vw, 50px);
          font-weight: 800;
          color: #ffffff;
          line-height: 1;
          letter-spacing: -0.6px;
          margin-bottom: 6px;
          background: linear-gradient(180deg, #ffffff 0%, color-mix(in oklab, var(--accent) 50%, #ffffff) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .stat-label {
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.1px;
          margin-bottom: 4px;
        }
        .stat-sub {
          color: rgba(255,255,255,0.65);
          font-size: 12px;
          font-weight: 500;
        }
      `}</style>
    </section>
  );
}
