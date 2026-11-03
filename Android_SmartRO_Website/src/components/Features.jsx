import { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const comparisonData = [
  {
    feature: 'Monthly Cost',
    waterCan: '₹800–1200',
    otherPurifier: '₹1500+ EMI',
    aquaImperial: '₹349/mo',
    highlight: true,
  },
  {
    feature: 'Upfront Cost',
    waterCan: 'None',
    otherPurifier: '₹8,000–25,000',
    aquaImperial: '₹0',
    highlight: true,
  },
  {
    feature: 'Maintenance',
    waterCan: 'N/A',
    otherPurifier: '₹2,000–4,000/yr',
    aquaImperial: 'Free for Life',
    highlight: true,
  },
  {
    feature: 'Water Purity',
    waterCan: 'Inconsistent',
    otherPurifier: 'Good',
    aquaImperial: '99.9% Pure',
    highlight: false,
  },
  {
    feature: 'Installation',
    waterCan: 'None needed',
    otherPurifier: '₹500–1500',
    aquaImperial: 'Free',
    highlight: false,
  },
  {
    feature: 'Filter Replacement',
    waterCan: 'N/A',
    otherPurifier: 'Self-arranged',
    aquaImperial: 'Auto-scheduled',
    highlight: false,
  },
  {
    feature: 'Smart Monitoring',
    waterCan: false,
    otherPurifier: false,
    aquaImperial: true,
    isBool: true,
  },
  {
    feature: '24/7 Support',
    waterCan: false,
    otherPurifier: false,
    aquaImperial: true,
    isBool: true,
  },
];

const features = [
  {
    title: '7-Stage Purification',
    desc: 'Sediment, carbon, RO membrane, UV sterilization, UF, and mineral boost — every sip is medically pure.',
    stat: '99.9%',
    statLabel: 'pure water',
    accent: '#0891B2',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="f1body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0F7FA"/>
            <stop offset="100%" stopColor="#BAE6FD"/>
          </linearGradient>
          <linearGradient id="f1stage" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22D3EE"/>
            <stop offset="100%" stopColor="#0891B2"/>
          </linearGradient>
        </defs>
        {/* drop above */}
        <path d="M40 8C40 8 34 16 34 21C34 24.31 36.69 27 40 27C43.31 27 46 24.31 46 21C46 16 40 8 40 8Z" fill="#67E8F9"/>
        {/* cylinder body */}
        <rect x="22" y="28" width="36" height="44" rx="8" fill="url(#f1body)" stroke="#0891B2" strokeWidth="1.4"/>
        {/* 7 layers */}
        {Array.from({ length: 7 }).map((_, i) => (
          <rect key={i} x="26" y={32 + i * 5} width="28" height="3" rx="1.5" fill="url(#f1stage)" opacity={0.35 + i * 0.085}/>
        ))}
        {/* clean drop output */}
        <circle cx="40" cy="76" r="3.5" fill="#22D3EE"/>
        <path d="M40 72L40 78" stroke="#22D3EE" strokeWidth="1.6" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
  },
  {
    title: 'Smart TDS Monitor',
    desc: 'Real-time digital display shows live TDS, pH levels, and water quality score. Know what you drink.',
    stat: 'Live',
    statLabel: 'TDS · pH',
    accent: '#0E7490',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="f2dev" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#155E75"/>
            <stop offset="100%" stopColor="#0E7490"/>
          </linearGradient>
        </defs>
        <rect x="10" y="14" width="60" height="52" rx="8" fill="url(#f2dev)"/>
        <rect x="14" y="18" width="52" height="32" rx="4" fill="#0a2540"/>
        {/* readout */}
        <text x="40" y="34" fill="#22D3EE" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="DM Sans">42</text>
        <text x="40" y="44" fill="#67E8F9" fontSize="6" fontWeight="600" textAnchor="middle" fontFamily="DM Sans" opacity="0.85">PPM TDS</text>
        {/* bar */}
        <rect x="18" y="48" width="44" height="3" rx="1.5" fill="#0891B2" opacity="0.3"/>
        <rect x="18" y="48" width="22" height="3" rx="1.5" fill="#22C55E"/>
        {/* led indicators */}
        <circle cx="20" cy="58" r="2.5" fill="#22C55E"/>
        <circle cx="30" cy="58" r="2.5" fill="#FCD34D" opacity="0.5"/>
        <circle cx="40" cy="58" r="2.5" fill="#FCD34D" opacity="0.5"/>
        <text x="56" y="61" fill="#67E8F9" fontSize="5.5" fontWeight="700" textAnchor="end" fontFamily="DM Sans" opacity="0.85">SAFE</text>
      </svg>
    ),
  },
  {
    title: 'IoT & App Control',
    desc: 'Monitor filter life, water usage, and quality from your smartphone. Get alerts & reminders instantly.',
    stat: 'iOS · Android',
    statLabel: 'app',
    accent: '#22D3EE',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="f3p" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#67E8F9"/>
            <stop offset="100%" stopColor="#155E75"/>
          </linearGradient>
        </defs>
        {/* phone */}
        <rect x="22" y="10" width="36" height="60" rx="6" fill="url(#f3p)" stroke="#0a2540" strokeWidth="1.5"/>
        <rect x="26" y="16" width="28" height="38" rx="3" fill="#0a2540"/>
        {/* drop on screen */}
        <path d="M40 22C40 22 35 28 35 32C35 34.76 37.24 37 40 37C42.76 37 45 34.76 45 32C45 28 40 22 40 22Z" fill="#22D3EE"/>
        {/* bars */}
        <rect x="29" y="42" width="3" height="6" rx="1" fill="#22D3EE" opacity="0.5"/>
        <rect x="34" y="40" width="3" height="8" rx="1" fill="#22D3EE" opacity="0.7"/>
        <rect x="39" y="44" width="3" height="4" rx="1" fill="#22D3EE" opacity="0.5"/>
        <rect x="44" y="38" width="3" height="10" rx="1" fill="#22D3EE"/>
        <rect x="49" y="41" width="3" height="7" rx="1" fill="#22D3EE" opacity="0.7"/>
        {/* home button */}
        <rect x="36" y="60" width="8" height="2.5" rx="1.2" fill="#67E8F9" opacity="0.5"/>
        {/* wifi waves */}
        <path d="M64 24 Q70 28 64 36" stroke="#22D3EE" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.45"/>
        <path d="M68 22 Q76 28 68 38" stroke="#22D3EE" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.3"/>
        <circle cx="62" cy="20" r="2" fill="#22C55E"/>
      </svg>
    ),
  },
  {
    title: 'BIS & WHO Certified',
    desc: 'Fully certified by Bureau of Indian Standards and WHO water quality standards. Safe for infants.',
    stat: '2 Certifications',
    statLabel: 'BIS · WHO',
    accent: '#155E75',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="f4s" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0891B2"/>
            <stop offset="100%" stopColor="#155E75"/>
          </linearGradient>
        </defs>
        {/* shield */}
        <path d="M40 8L14 18V36C14 52 25 64 40 70C55 64 66 52 66 36V18L40 8Z" fill="url(#f4s)" stroke="#0a2540" strokeWidth="1.4"/>
        {/* tick */}
        <path d="M28 38L36 46L52 30" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* rosette ribbons */}
        <circle cx="22" cy="58" r="6" fill="#FCD34D" stroke="#0a2540" strokeWidth="1"/>
        <text x="22" y="61" fill="#0a2540" fontSize="5.5" fontWeight="800" textAnchor="middle" fontFamily="DM Sans">BIS</text>
        <circle cx="58" cy="58" r="6" fill="#22C55E" stroke="#0a2540" strokeWidth="1"/>
        <text x="58" y="61" fill="#ffffff" fontSize="5" fontWeight="800" textAnchor="middle" fontFamily="DM Sans">WHO</text>
      </svg>
    ),
  },
  {
    title: 'Auto Filter Alerts',
    desc: 'Smart sensor tracks filter usage and sends timely replacement reminders — no guesswork needed.',
    stat: '0 missed',
    statLabel: 'reminders',
    accent: '#F59E0B',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="f5b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCD34D"/>
            <stop offset="100%" stopColor="#D97706"/>
          </linearGradient>
        </defs>
        {/* bell */}
        <path
          d="M40 14C32 14 26 20 26 28V40L20 50H60L54 40V28C54 20 48 14 40 14Z"
          fill="url(#f5b)" stroke="#0a2540" strokeWidth="1.4" strokeLinejoin="round"
        />
        <circle cx="40" cy="11" r="3" fill="#0a2540"/>
        <path d="M34 56C34 59.31 36.69 62 40 62C43.31 62 46 59.31 46 56" stroke="#0a2540" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        {/* pulse */}
        <circle cx="58" cy="20" r="6" fill="#EF4444"/>
        <text x="58" y="23.5" fill="white" fontSize="8" fontWeight="800" textAnchor="middle" fontFamily="DM Sans">!</text>
        <circle cx="58" cy="20" r="9" stroke="#EF4444" strokeWidth="1.2" fill="none" opacity="0.45"/>
        <circle cx="58" cy="20" r="12" stroke="#EF4444" strokeWidth="1" fill="none" opacity="0.25"/>
        {/* sound waves */}
        <path d="M16 28C12 32 12 38 16 42" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
        <path d="M64 28C68 32 68 38 64 42" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
      </svg>
    ),
  },
  {
    title: '24×7 Support',
    desc: 'Dedicated service engineers, free installation, and annual maintenance. We\'re always just a call away.',
    stat: '< 30 min',
    statLabel: 'response',
    accent: '#22C55E',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="f6h" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22D3EE"/>
            <stop offset="100%" stopColor="#0E7490"/>
          </linearGradient>
        </defs>
        {/* headset band */}
        <path d="M16 44V36C16 22 27 12 40 12C53 12 64 22 64 36V44" stroke="url(#f6h)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        {/* ear cups */}
        <rect x="10" y="40" width="14" height="20" rx="5" fill="url(#f6h)"/>
        <rect x="56" y="40" width="14" height="20" rx="5" fill="url(#f6h)"/>
        {/* mic */}
        <path d="M62 56V62C62 64.21 60.21 66 58 66H42" stroke="url(#f6h)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <circle cx="40" cy="66" r="3.5" fill="#22C55E" stroke="#0a2540" strokeWidth="1"/>
        {/* chat bubble */}
        <path d="M36 32H58C59.66 32 61 33.34 61 35V44C61 45.66 59.66 47 58 47H44L40 51L40 47H36C34.34 47 33 45.66 33 44V35C33 33.34 34.34 32 36 32Z" fill="#22C55E" stroke="#0a2540" strokeWidth="1.2"/>
        <circle cx="42" cy="40" r="1.5" fill="white"/>
        <circle cx="48" cy="40" r="1.5" fill="white"/>
        <circle cx="54" cy="40" r="1.5" fill="white"/>
      </svg>
    ),
  },
];

function FeatureCard({ feature, index }) {
  const [ref, inView] = useInView({ threshold: 0.2, triggerOnce: true });

  return (
    <motion.div
      ref={ref}
      className="feat-card"
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      style={{ '--accent': feature.accent }}
    >
      <span className="feat-corner" aria-hidden="true" />
      <span className="feat-glow" aria-hidden="true" />

      <div className="feat-icon-wrap">
        <div className="feat-icon-bg" aria-hidden="true" />
        <div className="feat-icon">{feature.icon}</div>
      </div>

      <div className="feat-stat">
        <span className="feat-stat-num">{feature.stat}</span>
        <span className="feat-stat-label">{feature.statLabel}</span>
      </div>

      <h3 className="feat-title">{feature.title}</h3>
      <p className="feat-desc">{feature.desc}</p>

      <span className="feat-arrow" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </motion.div>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8" fill="#22C55E" opacity="0.15"/>
      <path d="M5.5 9L7.5 11L12.5 6" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8" fill="#EF4444" opacity="0.1"/>
      <path d="M6.5 6.5L11.5 11.5M11.5 6.5L6.5 11.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function Features() {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [compRef, compInView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <section id="features" style={{ padding: '100px 0', background: '#ffffff', position: 'relative', overflow: 'hidden' }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: '-100px', right: '-100px',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(8,145,178,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        {/* Section Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '64px' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.15)',
            borderRadius: '25px', padding: '6px 16px', marginBottom: '16px',
          }}>
            <span style={{ color: '#0891B2', fontSize: '13px', fontWeight: 600 }}>The Aqua Imperial Advantage</span>
          </div>
          <h2 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 800,
            color: '#0F172A',
            marginBottom: '16px',
            letterSpacing: '-0.5px',
          }}>
            Next-Gen Water Purification at Best Costs
          </h2>
          <p style={{ color: '#64748B', fontSize: '17px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            Experience the smartest water purification solutions with Aqua Imperial. 
            See how we compare against traditional options.
          </p>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          ref={compRef}
          initial={{ opacity: 0, y: 40 }}
          animate={compInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            border: '1px solid rgba(8,145,178,0.12)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            marginBottom: '80px',
          }}
        >
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
            gap: '0',
            background: '#F8FFFE',
            borderBottom: '1px solid rgba(8,145,178,0.1)',
          }}
            className="comparison-grid"
          >
            <div style={{ padding: '20px 28px', fontWeight: 700, color: '#334155', fontSize: '14px' }}>Feature</div>
            <div style={{ padding: '20px 20px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#94A3B8', fontSize: '13px' }}>Water Can</div>
            </div>
            <div style={{ padding: '20px 20px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#94A3B8', fontSize: '13px' }}>Other Purifiers</div>
            </div>
            <div style={{ padding: '20px 20px', textAlign: 'center', background: 'rgba(8,145,178,0.06)' }}>
              <div style={{ fontWeight: 800, color: '#0891B2', fontSize: '13px' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                  <path d="M7 1C7 1 3 6 3 9C3 11.761 4.791 14 7 14C9.209 14 11 11.761 11 9C11 6 7 1 7 1Z" fill="#0891B2"/>
                </svg>
                Aqua Imperial
              </div>
            </div>
          </div>

          {/* Table rows */}
          {comparisonData.map((row, i) => (
            <div key={row.feature} style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
              gap: '0',
              borderBottom: i < comparisonData.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
              transition: 'background 0.2s',
            }}
              className="comparison-grid"
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(8,145,178,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ padding: '16px 28px', fontWeight: 600, color: '#334155', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                {row.feature}
              </div>
              <div style={{ padding: '16px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {row.isBool ? (row.waterCan ? <CheckIcon /> : <CrossIcon />) : row.waterCan}
              </div>
              <div style={{ padding: '16px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {row.isBool ? (row.otherPurifier ? <CheckIcon /> : <CrossIcon />) : row.otherPurifier}
              </div>
              <div style={{
                padding: '16px 20px', textAlign: 'center',
                background: 'rgba(8,145,178,0.03)',
                color: row.highlight ? '#0891B2' : '#164E63',
                fontWeight: row.highlight ? 700 : 600,
                fontSize: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {row.isBool ? (row.aquaImperial ? <CheckIcon /> : <CrossIcon />) : row.aquaImperial}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Feature cards header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ textAlign: 'center', marginBottom: '48px' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(8,145,178,0.07)', border: '1px solid rgba(8,145,178,0.18)',
            borderRadius: '999px', padding: '6px 16px', marginBottom: '16px',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1V15M1 8H15" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="3" fill="#22D3EE"/>
            </svg>
            <span style={{ color: '#0891B2', fontSize: '12px', fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase' }}>Smart Technology</span>
          </div>
          <h3 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(24px, 3.4vw, 36px)',
            fontWeight: 800,
            color: '#0F172A',
            marginBottom: '12px',
            letterSpacing: '-0.5px',
          }}>
            Technology That <span style={{
              background: 'linear-gradient(90deg, #0891B2, #22D3EE)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Cares for Your Health</span>
          </h3>
          <p style={{ color: '#64748B', fontSize: '16px', maxWidth: '540px', margin: '0 auto', lineHeight: 1.7 }}>
            Cutting-edge filtration, real-time monitoring, and an app that keeps every drop in check.
          </p>
        </motion.div>

        {/* Feature cards bento grid */}
        <div className="feat-grid">
          {features.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .comparison-grid { grid-template-columns: 1.2fr 0.8fr 0.8fr 1fr !important; font-size: 12px !important; }
        }
        @media (max-width: 480px) {
          .comparison-grid { grid-template-columns: 1fr 1fr !important; }
          .comparison-grid > div:nth-child(4n+2),
          .comparison-grid > div:nth-child(4n+3) { display: none !important; }
        }

        .feat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        @media (max-width: 900px) {
          .feat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .feat-grid { grid-template-columns: 1fr; }
        }

        .feat-card {
          --accent: #0891B2;
          position: relative;
          padding: 28px 26px 24px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 22px;
          overflow: hidden;
          isolation: isolate;
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.4s, box-shadow 0.4s;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02), 0 8px 24px rgba(15, 23, 42, 0.04);
        }
        .feat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--accent) 30%, var(--accent) 70%, transparent);
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .feat-card:hover {
          transform: translateY(-6px);
          border-color: color-mix(in oklab, var(--accent) 35%, transparent);
          box-shadow: 0 24px 60px rgba(8, 23, 42, 0.12), 0 4px 14px rgba(8, 145, 178, 0.08);
        }
        .feat-card:hover::before { opacity: 1; }

        .feat-glow {
          position: absolute;
          top: -40%;
          right: -30%;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, color-mix(in oklab, var(--accent) 18%, transparent), transparent 70%);
          filter: blur(40px);
          z-index: -1;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }
        .feat-card:hover .feat-glow { opacity: 0.9; }

        .feat-corner {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 22px;
          height: 22px;
          border-top: 1.5px solid var(--accent);
          border-right: 1.5px solid var(--accent);
          border-radius: 0 8px 0 0;
          opacity: 0.25;
          transition: opacity 0.3s, width 0.3s, height 0.3s;
        }
        .feat-card:hover .feat-corner { opacity: 0.85; width: 28px; height: 28px; }

        .feat-icon-wrap {
          position: relative;
          width: 80px;
          height: 80px;
          margin-bottom: 22px;
        }
        .feat-icon-bg {
          position: absolute;
          inset: 0;
          border-radius: 22px;
          background: linear-gradient(160deg, color-mix(in oklab, var(--accent) 12%, transparent), color-mix(in oklab, var(--accent) 4%, transparent));
          border: 1px solid color-mix(in oklab, var(--accent) 18%, transparent);
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .feat-card:hover .feat-icon-bg { transform: rotate(-6deg) scale(1.04); }
        .feat-icon {
          position: relative;
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .feat-icon svg { width: 60px; height: 60px; }
        .feat-card:hover .feat-icon { transform: scale(1.08); }

        .feat-stat {
          position: absolute;
          top: 24px;
          right: 50px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1px;
        }
        .feat-stat-num {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.2px;
          color: var(--accent);
          line-height: 1;
        }
        .feat-stat-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.4px;
          color: #94A3B8;
          text-transform: uppercase;
        }

        .feat-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 17px;
          font-weight: 700;
          color: #0F172A;
          margin: 0 0 10px;
          letter-spacing: -0.2px;
        }
        .feat-desc {
          color: #64748B;
          font-size: 13.5px;
          line-height: 1.65;
          margin: 0 0 14px;
        }

        .feat-arrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: color-mix(in oklab, var(--accent) 8%, transparent);
          color: var(--accent);
          transition: background 0.25s, transform 0.25s, color 0.25s;
        }
        .feat-card:hover .feat-arrow {
          background: var(--accent);
          color: #ffffff;
          transform: translateX(3px);
        }
      `}</style>
    </section>
  );
}
