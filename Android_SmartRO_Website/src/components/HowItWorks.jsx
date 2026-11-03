import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const steps = [
  {
    num: '01',
    title: 'Choose Your Product',
    desc: 'Browse RO, Copper, Alkaline or Mineral+ — pick what suits your family best.',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.45)',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="step1g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
        </defs>
        <rect x="10" y="6" width="14" height="22" rx="3" fill="url(#step1g)" opacity="0.35"/>
        <rect x="32" y="6" width="14" height="22" rx="3" fill="url(#step1g)" opacity="0.55"/>
        <rect x="21" y="22" width="14" height="26" rx="3" fill="url(#step1g)"/>
        <path d="M28 28C28 28 24 32 24 36C24 38.21 25.79 40 28 40C30.21 40 32 38.21 32 36C32 32 28 28 28 28Z" fill="#ffffff"/>
        <circle cx="44" cy="14" r="6" fill="#22C55E"/>
        <path d="M41 14L43 16L47 12" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Select a Plan',
    desc: 'Flexible 28/90/180-day plans or long-term value plans — your choice.',
    color: '#06B6D4',
    glow: 'rgba(6,182,212,0.45)',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="step2g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#0E7490" />
          </linearGradient>
        </defs>
        <rect x="6" y="14" width="14" height="32" rx="3" fill="url(#step2g)" opacity="0.45"/>
        <rect x="22" y="6" width="14" height="40" rx="3" fill="url(#step2g)"/>
        <rect x="38" y="20" width="14" height="26" rx="3" fill="url(#step2g)" opacity="0.55"/>
        <text x="29" y="30" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="DM Sans">₹</text>
        <circle cx="29" cy="38" r="2" fill="#FCD34D"/>
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Submit Details',
    desc: 'Drop your name and address — our team verifies and confirms in minutes.',
    color: '#0EA5E9',
    glow: 'rgba(14,165,233,0.45)',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="step3g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67E8F9" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
        </defs>
        <rect x="10" y="8" width="32" height="40" rx="4" fill="url(#step3g)" opacity="0.2" stroke="url(#step3g)" strokeWidth="1.6"/>
        <rect x="16" y="16" width="20" height="2" rx="1" fill="#67E8F9"/>
        <rect x="16" y="22" width="14" height="2" rx="1" fill="#67E8F9" opacity="0.7"/>
        <rect x="16" y="28" width="18" height="2" rx="1" fill="#67E8F9" opacity="0.55"/>
        <path d="M30 38L42 26L46 30L34 42L28 42L30 38Z" fill="#FCD34D" stroke="#0a2540" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    num: '04',
    title: 'Make Payment',
    desc: 'Pay securely via UPI, cards or net banking — encrypted end-to-end.',
    color: '#22C55E',
    glow: 'rgba(34,197,94,0.45)',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="step4g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#86EFAC" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
        </defs>
        <rect x="6" y="14" width="40" height="26" rx="4" fill="url(#step4g)"/>
        <rect x="6" y="20" width="40" height="4" fill="#0a2540" opacity="0.35"/>
        <rect x="12" y="30" width="14" height="3" rx="1" fill="#ffffff" opacity="0.6"/>
        <rect x="30" y="30" width="10" height="3" rx="1" fill="#ffffff" opacity="0.6"/>
        <circle cx="44" cy="44" r="9" fill="#0a2540"/>
        <path d="M40 44L43 47L48 41" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    num: '05',
    title: 'Installation in 48hrs',
    desc: 'Certified engineer installs at your home — fast, neat, completely free.',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.45)',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="step5g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
        <path d="M14 38L8 44L12 48L18 42L40 20C42 18, 42 14, 40 12C38 10, 34 10, 32 12L14 30L14 38Z" fill="url(#step5g)" stroke="#0a2540" strokeWidth="1.2" strokeLinejoin="round"/>
        <circle cx="36" cy="16" r="2" fill="#0a2540"/>
        <path d="M28 8L32 4L36 8L34 12L30 12L28 8Z" fill="#0a2540" opacity="0.85"/>
        <circle cx="44" cy="40" r="9" fill="#ffffff" stroke="url(#step5g)" strokeWidth="2"/>
        <path d="M44 36V40L47 42" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    num: '06',
    title: 'Connect & Enjoy',
    desc: 'Pair with the Aqua Imperial app — track quality, recharge, and relax.',
    color: '#A855F7',
    glow: 'rgba(168,85,247,0.45)',
    icon: (
      <svg viewBox="0 0 56 56" fill="none">
        <defs>
          <linearGradient id="step6g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C4B5FD" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <rect x="14" y="6" width="22" height="38" rx="4" fill="url(#step6g)" stroke="#0a2540" strokeWidth="1.4"/>
        <rect x="17" y="11" width="16" height="22" rx="2" fill="#0a2540"/>
        <circle cx="25" cy="38" r="1.6" fill="#ffffff" opacity="0.6"/>
        <path d="M25 18C25 18 22 21 22 23C22 24.66 23.34 26 25 26C26.66 26 28 24.66 28 23C28 21 25 18 25 18Z" fill="#67E8F9"/>
        <circle cx="42" cy="14" r="4" fill="#22C55E"/>
        <path d="M40 14L41.5 15.5L44 13" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M38 24Q43 24 43 30" stroke="#A855F7" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.6"/>
        <path d="M38 24Q46 24 46 32" stroke="#A855F7" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <section
      id="how-it-works"
      style={{
        padding: '110px 0 120px',
        background: 'radial-gradient(1200px 600px at 80% 0%, rgba(34,211,238,0.08), transparent), linear-gradient(180deg, #0F172A 0%, #0a1a2b 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle dotted grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(103,232,249,0.08) 1px, transparent 1.5px)',
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse at 50% 40%, #000 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, #000 30%, transparent 75%)',
      }} />

      {/* Floating orbs */}
      <motion.div
        animate={{ y: [0, -20, 0], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '12%', left: '6%',
          width: '180px', height: '180px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%)',
          filter: 'blur(24px)', pointerEvents: 'none',
        }}
      />
      <motion.div
        animate={{ y: [0, 24, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        style={{
          position: 'absolute', bottom: '10%', right: '8%',
          width: '220px', height: '220px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)',
          filter: 'blur(28px)', pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '60px' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.28)',
            borderRadius: '999px', padding: '7px 18px', marginBottom: '18px',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10 6L15 6L11 9L13 14L8 11L3 14L5 9L1 6L6 6L8 1Z" fill="#67E8F9"/>
            </svg>
            <span style={{ color: '#67E8F9', fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>How It Works</span>
          </div>
          <h2 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 800, color: '#ffffff',
            marginBottom: '14px', letterSpacing: '-0.5px',
          }}>
            Get Started in <span style={{
              background: 'linear-gradient(90deg, #FCD34D, #67E8F9)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>6 Simple Steps</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            From browsing plans to enjoying pure water — every step is designed to be effortless.
          </p>
        </motion.div>

        {/* Steps row */}
        <div className="hiw-row">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              className="hiw-card"
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              style={{ '--accent': step.color, '--glow': step.glow }}
            >
              {/* Connector arrow on desktop */}
              {i < steps.length - 1 && (
                <div className="hiw-connector" aria-hidden="true">
                  <svg viewBox="0 0 28 12" fill="none">
                    <path
                      d="M0 6 L24 6"
                      stroke="url(#connGrad)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <path d="M22 2 L26 6 L22 10" stroke={step.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <defs>
                      <linearGradient id="connGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={step.color} stopOpacity="0.2"/>
                        <stop offset="100%" stopColor={step.color} stopOpacity="0.7"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              )}

              {/* Step number ribbon */}
              <span className="hiw-num">STEP {step.num}</span>

              {/* Big icon tile */}
              <div className="hiw-icon-wrap">
                <div className="hiw-icon-glow" />
                <div className="hiw-icon">
                  {step.icon}
                </div>
              </div>

              <h3 className="hiw-title">{step.title}</h3>
              <p className="hiw-desc">{step.desc}</p>

              <span className="hiw-corner" aria-hidden="true" />
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          style={{ textAlign: 'center', marginTop: '64px' }}
        >
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 14px 38px rgba(34,197,94,0.5)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              color: 'white', border: 'none',
              padding: '16px 44px',
              borderRadius: '12px',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700, fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(34,197,94,0.35)',
              display: 'inline-flex', alignItems: 'center', gap: '10px',
            }}
          >
            Start Your Free Trial
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.button>
        </motion.div>
      </div>

      <style>{`
        .hiw-row {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          position: relative;
        }
        .hiw-card {
          position: relative;
          padding: 24px 16px 22px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015));
          border: 1px solid rgba(103,232,249,0.12);
          border-radius: 18px;
          overflow: hidden;
          transition: transform 0.35s ease, border-color 0.35s ease, background 0.35s ease;
          isolation: isolate;
        }
        .hiw-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(140px 140px at 50% 0%, var(--glow), transparent 65%);
          opacity: 0;
          transition: opacity 0.4s ease;
          z-index: -1;
        }
        .hiw-card:hover {
          transform: translateY(-6px);
          border-color: var(--accent);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
        }
        .hiw-card:hover::before { opacity: 0.5; }

        .hiw-connector {
          position: absolute;
          top: 70px;
          right: -14px;
          width: 28px;
          height: 12px;
          z-index: 2;
          pointer-events: none;
        }
        .hiw-connector svg { width: 100%; height: 100%; }

        .hiw-num {
          display: inline-block;
          font-family: 'DM Sans', sans-serif;
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 2px;
          color: var(--accent);
          background: color-mix(in oklab, var(--accent) 14%, transparent);
          padding: 4px 10px;
          border-radius: 999px;
          margin-bottom: 14px;
        }

        .hiw-icon-wrap {
          position: relative;
          width: 84px;
          height: 84px;
          margin: 0 auto 16px;
        }
        .hiw-icon-glow {
          position: absolute;
          inset: -8px;
          border-radius: 22px;
          background: radial-gradient(circle, var(--glow), transparent 70%);
          filter: blur(10px);
          opacity: 0.5;
          transition: opacity 0.4s ease;
        }
        .hiw-card:hover .hiw-icon-glow { opacity: 0.95; }
        .hiw-icon {
          position: relative;
          width: 84px;
          height: 84px;
          border-radius: 20px;
          background: linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          overflow: hidden;
          transition: transform 0.4s ease;
        }
        .hiw-icon svg { width: 56px; height: 56px; }
        .hiw-card:hover .hiw-icon { transform: scale(1.06) rotate(-2deg); }

        .hiw-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 8px;
          line-height: 1.25;
          text-align: center;
        }
        .hiw-desc {
          color: rgba(255,255,255,0.6);
          font-size: 12px;
          line-height: 1.55;
          text-align: center;
          margin: 0;
        }

        .hiw-corner {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 22px;
          height: 22px;
          border-top: 1.5px solid var(--accent);
          border-right: 1.5px solid var(--accent);
          border-radius: 0 8px 0 0;
          opacity: 0.35;
          transition: opacity 0.3s, width 0.3s, height 0.3s;
        }
        .hiw-card:hover .hiw-corner { opacity: 0.9; width: 28px; height: 28px; }

        /* Tablet — 3 columns x 2 rows */
        @media (max-width: 900px) {
          .hiw-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .hiw-connector { display: none; }
        }

        /* Mobile — single column */
        @media (max-width: 600px) {
          .hiw-row { grid-template-columns: 1fr; gap: 14px; }
        }
      `}</style>
    </section>
  );
}
