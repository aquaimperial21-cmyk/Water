import { useId, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { formatRupees, planTerms, useCatalog } from '../api';
import { cardPrice, liveCards, priceCities, staticCards } from '../catalog';
import { whatsappLink } from '../siteInfo';

const DEFAULT_CITY = 'pune';

const scrollToContact = (e) => {
  e.stopPropagation();
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
};

export default function Products() {
  const [planType, setPlanType] = useState('long');
  const [hoveredId, setHoveredId] = useState(null);
  const [chosenCity, setChosenCity] = useState(null);
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const catalog = useCatalog();
  const ready = catalog.status === 'ready';

  // The site's own cards show straight away; the live catalog replaces them
  // when it arrives. If it never does, the static cards stay, without prices.
  const cards = useMemo(
    () => (ready ? liveCards(catalog.products) : staticCards()),
    [ready, catalog.products],
  );
  const cities = useMemo(() => (ready ? priceCities(catalog.products) : []), [ready, catalog.products]);
  const city =
    cities.find((c) => c.id === chosenCity) ??
    cities.find((c) => c.name.toLowerCase() === DEFAULT_CITY) ??
    cities[0] ??
    null;
  const longestTerm = ready ? planTerms(catalog).at(-1) : null;

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
            <ToggleButton active={planType === 'short'} onClick={() => setPlanType('short')}>
              Short-term Plans
            </ToggleButton>
            <ToggleButton active={planType === 'long'} onClick={() => setPlanType('long')}>
              Long-term Plans
            </ToggleButton>
          </div>
          <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '10px' }}>
            {planType === 'short'
              ? 'The 1-month plan: the shortest lock-in'
              : `Our longest plan${longestTerm ? ` (${longestTerm} months)` : ''}: the lowest monthly rate`}
          </div>

          {/* City switch: the row keeps its height while prices load or if they cannot */}
          <div style={{
            minHeight: '34px', marginTop: '14px',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            {ready && cities.length > 0 ? (
              <>
                <span style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Prices for</span>
                {cities.map((c) => {
                  const active = city?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChosenCity(c.id)}
                      aria-pressed={active}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: `1.5px solid ${active ? '#0891B2' : 'rgba(8,145,178,0.15)'}`,
                        background: active ? 'rgba(8,145,178,0.06)' : '#ffffff',
                        color: active ? '#0891B2' : '#64748B',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '13px',
                        fontWeight: active ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </>
            ) : (
              <span style={{ color: '#94A3B8', fontSize: '13px' }}>
                {catalog.status === 'loading'
                  ? 'Loading today’s prices…'
                  : 'Prices differ by city. Ask us, or see them in the app.'}
              </span>
            )}
          </div>
        </motion.div>

        {/* Product cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}>
          {cards.map((product, i) => {
            const isHovered = hoveredId === product.id;
            const price = product.live && city ? cardPrice(product.live, city.id, planType) : null;
            const priceState = price ? 'price' : catalog.status === 'loading' ? 'loading' : 'ask';

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
                    <DropIcon {...product.drop} />
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

                {/* Price: every state takes the same height, so nothing moves when prices arrive */}
                <div style={{
                  background: isHovered ? 'rgba(255,255,255,0.06)' : `${product.color}06`,
                  border: `1px solid ${isHovered ? 'rgba(255,255,255,0.08)' : product.color + '12'}`,
                  borderRadius: '14px', padding: '16px',
                  textAlign: 'center', marginBottom: '16px',
                  transition: 'all 0.3s',
                }}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`${priceState}-${planType}-${city?.id ?? ''}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div style={{
                        fontFamily: "'DM Sans', sans-serif",
                        height: '36px', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isHovered ? '#67E8F9' : product.color,
                        transition: 'color 0.3s',
                      }}>
                        {priceState === 'price' && (
                          <span style={{ fontSize: '36px', fontWeight: 800 }}>
                            {formatRupees(price.paise)}
                            <span style={{ fontSize: '14px', fontWeight: 500, color: isHovered ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>/mo</span>
                          </span>
                        )}
                        {priceState === 'loading' && (
                          <motion.span
                            animate={{ opacity: [0.35, 0.7, 0.35] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                              width: '110px', height: '28px', borderRadius: '8px',
                              background: isHovered ? 'rgba(255,255,255,0.12)' : `${product.color}1A`,
                            }}
                          />
                        )}
                        {priceState === 'ask' && (
                          <span style={{ fontSize: '24px', fontWeight: 800 }}>See plans</span>
                        )}
                      </div>
                      <div style={{
                        color: isHovered ? 'rgba(255,255,255,0.4)' : '#94A3B8',
                        fontSize: '11px', fontWeight: 600, marginTop: '6px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        transition: 'color 0.3s',
                      }}>
                        {priceState === 'price'
                          ? price.months === 1 ? '1-month plan' : `on a ${price.months}-month plan`
                          : priceState === 'loading'
                            ? 'Fetching price'
                            : product.live && city ? `Ask us for ${city.name}` : 'Ask us for your city'}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  <div style={{
                    color: isHovered ? 'rgba(255,255,255,0.4)' : '#94A3B8',
                    fontSize: '11px', marginTop: '4px',
                    transition: 'color 0.3s',
                  }}>
                    Lock-in: your first plan term
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={scrollToContact}
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
                    {priceState === 'ask' ? 'Enquire' : 'Know more'}
                  </button>
                  <button
                    onClick={(e) => {
                      if (priceState !== 'ask') return scrollToContact(e);
                      e.stopPropagation();
                      const where = product.live && city ? ` in ${city.name}` : '';
                      window.open(
                        whatsappLink(`Hi Aqua Imperial! Please share the plans and prices for ${product.name}${where}.`),
                        '_blank',
                      );
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
                    {priceState === 'ask' ? 'WhatsApp' : 'Subscribe'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p style={{ color: '#64748B', fontSize: '13px', maxWidth: '760px', margin: '28px auto 0', lineHeight: 1.7, textAlign: 'center' }}>
          Prices shown are the monthly rate. You pay upfront, online through Razorpay: the rent for the whole plan
          term plus a refundable security deposit. Cancel within 7 days of payment for a full refund. Final prices
          are shown in the app before you pay and can differ by purifier, plan length and city.
        </p>

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
            { text: 'Installation Included', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L2 6V13L9 17L16 13V6L9 2Z" fill="#0891B2" opacity="0.15"/><path d="M6 9L8 11L12 7" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/></svg> },
            { text: 'Filters & Servicing Included', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" fill="#0891B2" opacity="0.15"/><path d="M6 9L8 11L12 7" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/></svg> },
            { text: '7-Day Trial, Full Refund', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" fill="#0891B2" opacity="0.15"/><path d="M9 5V9L12 11" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/></svg> },
            { text: 'Free Water-Quality Test', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2C9 2 4 8 4 12C4 14.761 6.239 17 9 17C11.761 17 14 14.761 14 12C14 8 9 2 9 2Z" fill="#0891B2" opacity="0.15"/><path d="M7 11C7 11 8 9.5 9 9" stroke="#0891B2" strokeWidth="1.2" strokeLinecap="round"/></svg> },
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

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 24px',
        borderRadius: '10px',
        border: 'none',
        background: active ? 'linear-gradient(135deg, #0891B2, #0E7490)' : 'transparent',
        color: active ? 'white' : '#64748B',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.25s',
      }}
    >
      {children}
    </button>
  );
}

// The water-drop icon on each card: a gradient drop with a small mark on it.
function DropIcon({ from, to, mark }) {
  const id = `drop${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
      <path d="M24 2C24 2 6 20 6 34C6 43.941 14.059 52 24 52C33.941 52 42 43.941 42 34C42 20 24 2 24 2Z" fill={`url(#${id})`}/>
      {mark === 'shine' && (
        <path d="M16 32C16 32 18 28 24 26" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      )}
      {mark === 'check' && (
        <>
          <circle cx="24" cy="34" r="6" fill="rgba(255,255,255,0.2)"/>
          <path d="M21 34L23 36L27 32" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </>
      )}
      {mark === 'smile' && (
        <path d="M20 40C20 40 22 43 24 43C26 43 28 40 28 40" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      )}
      <defs><linearGradient id={id} x1="24" y1="2" x2="24" y2="52"><stop stopColor={from}/><stop offset="1" stopColor={to}/></linearGradient></defs>
    </svg>
  );
}
