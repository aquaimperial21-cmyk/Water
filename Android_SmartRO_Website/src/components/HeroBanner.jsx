import { motion } from 'framer-motion';

const HERO_DESKTOP = '/hero-desktop.jpg';
const HERO_MOBILE = '/hero-mobile.jpg';

export default function HeroBanner() {
  const handleBookNow = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="home"
      className="hb-root"
      aria-label="Aqua Imperial RO on rent — Summer Sale"
    >
      <div className="hb-nav-spacer" aria-hidden="true" />

      <div className="hb-stage">
        <motion.picture
          className="hb-pic"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <source media="(min-width: 900px)" srcSet={HERO_DESKTOP} />
          <img
            src={HERO_MOBILE}
            alt="Aqua Imperial Alkaline RO water purifier — Summer Sale plan starts at ₹417"
            className="hb-img"
            loading="eager"
            fetchPriority="high"
          />
        </motion.picture>

        {/* Desktop-only text overlay on the dark-blue left half */}
        <motion.div
          className="hb-overlay"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
        >
          <h1 className="hb-headline">
            AQUA IMPERIAL<br />
            <span className="hb-headline-accent">RO ON RENT</span>
          </h1>
          <p className="hb-sub">
            No Upfront Cost <span className="hb-pipe">|</span> Lifetime free maintenance <span className="hb-pipe">|</span> Easy Monthly Subscription
          </p>
          <motion.button
            type="button"
            className="hb-cta"
            onClick={handleBookNow}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            Book Now
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>

        </motion.div>

        {/* Festive sale block */}
        <motion.div
          className="hb-festive"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
          whileHover={{ scale: 1.04, transition: { duration: 0.25 } }}
        >
          <span className="hb-festive-eyebrow">FESTIVE SALE</span>
          <h2 className="hb-festive-headline">
            PURIFIER <span className="hb-festive-at">@</span> <span className="hb-festive-price">₹599</span>
          </h2>
          <div className="hb-festive-divider" />
          <p className="hb-festive-tagline">
            Lights are up. Prices aren&apos;t.
          </p>
          <p className="hb-festive-sub">
            Imperial Aqua Purifier on a <strong>festive offer</strong>.
          </p>
        </motion.div>
      </div>

      <style>{`
        .hb-root {
          position: relative;
          width: 100%;
          background: #0a2540;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }
        .hb-nav-spacer {
          height: 64px;
          background: #0a2540;
        }
        .hb-stage {
          position: relative;
          width: 100%;
        }
        .hb-pic {
          display: block;
          width: 100%;
          line-height: 0;
        }
        .hb-img {
          display: block;
          width: 100%;
          height: auto;
        }

        /* Mobile — overlay text on the left empty area near navbar */
        .hb-overlay {
          display: block;
          position: absolute;
          top: 24px;
          left: 14px;
          right: auto;
          max-width: 52%;
          color: #ffffff;
          text-align: left;
          z-index: 2;
          text-shadow: 0 2px 14px rgba(0, 0, 0, 0.4);
        }
        .hb-headline {
          margin: 0 0 14px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 800;
          font-size: clamp(20px, 5.6vw, 26px);
          line-height: 1.18;
          letter-spacing: -0.5px;
          text-transform: uppercase;
        }
        .hb-headline-accent {
          background: linear-gradient(90deg, #67E8F9 0%, #22D3EE 60%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hb-sub {
          margin: 0 0 18px;
          font-size: clamp(10px, 2.7vw, 12px);
          line-height: 1.7;
          color: rgba(230, 246, 251, 0.92);
          font-weight: 500;
          word-spacing: 1px;
        }
        .hb-pipe { color: #67E8F9; padding: 0 6px; }
        .hb-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 700;
          color: #0a2540;
          background:
            linear-gradient(#ffffff, #ffffff) padding-box,
            linear-gradient(135deg, #FCD34D 0%, #D4AF37 45%, #B8860B 75%, #F4D58A 100%) border-box;
          border: 2px solid transparent;
          border-radius: 9999px;
          cursor: pointer;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.28), 0 0 0 3px rgba(212, 175, 55, 0.18);
        }
        .hb-cta svg { transition: transform 0.25s ease; }

        .hb-brand {
          display: flex;
          width: fit-content;
          margin: 10px auto 0 0;
          align-items: center;
          gap: 6px;
          padding: 5px 10px 5px 7px;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 100%) padding-box,
            linear-gradient(135deg, #FCD34D 0%, #D4AF37 50%, #B8860B 100%) border-box;
          border: 1.5px solid transparent;
          border-radius: 12px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 10px 28px rgba(8, 23, 42, 0.4);
        }
        .hb-brand-mark {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: linear-gradient(135deg, #0891B2, #22D3EE);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(8, 145, 178, 0.4);
        }
        .hb-brand-mark svg { width: 14px; height: 14px; }
        .hb-brand-text { display: flex; flex-direction: column; line-height: 1; }
        .hb-brand-name {
          font-family: 'DM Sans', sans-serif;
          font-weight: 800;
          font-size: 13px;
          color: #ffffff;
          letter-spacing: -0.2px;
        }
        .hb-brand-name-accent {
          background: linear-gradient(90deg, #67E8F9, #22D3EE);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hb-brand-tag {
          margin-top: 2px;
          font-size: 6.5px;
          font-weight: 600;
          letter-spacing: 1.8px;
          color: rgba(103, 232, 249, 0.85);
        }

        /* Festive sale on mobile — overlaid on right empty area of image */
        .hb-festive {
          display: block;
          position: absolute;
          top: 110px;
          right: 12px;
          left: auto;
          bottom: auto;
          width: max-content;
          padding: 8px 14px 10px;
          text-align: center;
          z-index: 2;
          background:
            linear-gradient(#ffffff, #ffffff) padding-box,
            linear-gradient(135deg, #FCD34D 0%, #D4AF37 45%, #B8860B 70%, #F4D58A 100%) border-box;
          border: 1.5px solid transparent;
          border-radius: 11px;
          box-shadow:
            0 10px 22px rgba(8, 23, 42, 0.4),
            0 0 0 3px rgba(252, 211, 77, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          max-width: 180px;
        }
        .hb-festive::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 9px;
          height: 9px;
          background: linear-gradient(135deg, #FCD34D, #D4AF37);
          border-radius: 2px;
          box-shadow: 0 2px 4px rgba(180, 130, 0, 0.4);
        }
        .hb-festive-eyebrow {
          display: inline-block;
          font-size: 6.5px;
          font-weight: 800;
          letter-spacing: 1.5px;
          color: #ffffff;
          background: linear-gradient(135deg, #B91C1C 0%, #991B1B 100%);
          padding: 2px 7px;
          border-radius: 3px;
          margin-bottom: 5px;
          text-transform: uppercase;
          box-shadow: 0 2px 6px rgba(185, 28, 28, 0.3);
        }
        .hb-festive-headline {
          margin: 0;
          font-family: 'DM Sans', sans-serif;
          font-weight: 800;
          font-size: clamp(12px, 3.6vw, 15px);
          line-height: 1.05;
          letter-spacing: 0.2px;
          text-transform: uppercase;
          color: #0a2540;
          white-space: nowrap;
        }
        .hb-festive-at { color: #94A3B8; font-weight: 700; margin: 0 2px; }
        .hb-festive-price {
          background: linear-gradient(135deg, #D4AF37 0%, #B8860B 50%, #FCD34D 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hb-festive-divider {
          height: 1px;
          width: 50%;
          margin: 5px auto 4px;
          background: linear-gradient(90deg, transparent, rgba(212,175,55,0.7), transparent);
        }
        .hb-festive-tagline {
          margin: 0 0 2px;
          font-size: 7.5px;
          font-weight: 600;
          line-height: 1.3;
          color: #0a2540;
          font-style: italic;
        }
        .hb-festive-sub {
          margin: 0;
          font-size: 6.5px;
          line-height: 1.35;
          color: #475569;
        }
        .hb-festive-sub strong {
          background: linear-gradient(135deg, #B8860B, #D4AF37);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 800;
        }

        @media (min-width: 900px) {
          .hb-nav-spacer { height: 80px; }

          .hb-overlay {
            display: block;
            position: absolute;
            top: 8%;
            left: 2%;
            transform: none;
            max-width: 44%;
            padding: 0;
            text-align: left;
            color: #ffffff;
            z-index: 2;
            text-shadow: 0 2px 24px rgba(0,0,0,0.35);
          }
          .hb-headline {
            margin: 0 0 18px;
            font-family: 'DM Sans', sans-serif;
            font-weight: 800;
            font-size: clamp(36px, 4vw, 60px);
            line-height: 1.02;
            letter-spacing: -1.2px;
            text-transform: uppercase;
          }
          .hb-headline-accent {
            background: linear-gradient(90deg, #67E8F9 0%, #22D3EE 60%, #ffffff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .hb-sub {
            margin: 0 0 26px;
            font-size: clamp(12px, 0.95vw, 15px);
            line-height: 1.55;
            color: rgba(230, 246, 251, 0.92);
            font-weight: 500;
            white-space: nowrap;
          }
          .hb-pipe {
            color: #67E8F9;
            padding: 0 6px;
            font-weight: 400;
          }
          .hb-cta {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-left: 80px;
            padding: 14px 34px;
            font-family: inherit;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.2px;
            color: #0a2540;
            background:
              linear-gradient(#ffffff, #ffffff) padding-box,
              linear-gradient(135deg, #FCD34D 0%, #D4AF37 45%, #B8860B 75%, #F4D58A 100%) border-box;
            border: 2.5px solid transparent;
            border-radius: 9999px;
            cursor: pointer;
            box-shadow:
              0 12px 30px rgba(0, 0, 0, 0.28),
              0 0 0 4px rgba(212, 175, 55, 0.18);
            transition: box-shadow 0.25s ease, transform 0.25s ease;
          }
          .hb-cta:hover {
            box-shadow:
              0 16px 38px rgba(0, 0, 0, 0.34),
              0 0 0 6px rgba(252, 211, 77, 0.32);
          }
          .hb-cta svg { transition: transform 0.25s ease; }
          .hb-cta:hover svg { transform: translateX(3px); }

          /* Brand wordmark */
          .hb-brand {
            display: flex;
            width: fit-content;
            align-items: center;
            gap: 12px;
            margin-top: 125px;
            margin-left: -20px;
            padding: 10px 18px 10px 12px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(103, 232, 249, 0.22);
            border-radius: 14px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
          .hb-brand-mark {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0891B2, #22D3EE);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 22px rgba(8, 145, 178, 0.45);
            flex-shrink: 0;
          }
          .hb-brand-text {
            display: flex;
            flex-direction: column;
            line-height: 1;
          }
          .hb-brand-name {
            font-family: 'DM Sans', sans-serif;
            font-weight: 800;
            font-size: 22px;
            color: #ffffff;
            letter-spacing: -0.4px;
            line-height: 1.05;
          }
          .hb-brand-name-accent {
            background: linear-gradient(90deg, #67E8F9, #22D3EE);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .hb-brand-tag {
            margin-top: 4px;
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 2.6px;
            color: rgba(103, 232, 249, 0.85);
          }

          /* Festive sale badge — right side */
          .hb-festive {
            display: block;
            position: absolute;
            top: 20%;
            right: 5%;
            z-index: 2;
            padding: 20px 28px 22px;
            text-align: center;
            background:
              linear-gradient(#ffffff, #ffffff) padding-box,
              linear-gradient(135deg, #FCD34D 0%, #D4AF37 45%, #B8860B 70%, #F4D58A 100%) border-box;
            border: 3px solid transparent;
            border-radius: 22px;
            box-shadow:
              0 30px 80px rgba(8, 23, 42, 0.42),
              0 0 0 8px rgba(252, 211, 77, 0.18),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
            max-width: 310px;
            cursor: pointer;
            will-change: transform;
          }
          .hb-festive::before {
            content: '';
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
            width: 14px;
            height: 14px;
            background: linear-gradient(135deg, #FCD34D, #D4AF37);
            border-radius: 4px;
            box-shadow: 0 3px 8px rgba(180, 130, 0, 0.45);
          }
          .hb-festive::after {
            content: '';
            position: absolute;
            inset: -4px;
            border-radius: 22px;
            background: radial-gradient(ellipse at 50% 50%, rgba(252, 211, 77, 0.28) 0%, transparent 70%);
            z-index: -1;
            pointer-events: none;
          }
          .hb-festive-eyebrow {
            display: inline-block;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 2.5px;
            color: #ffffff;
            background: linear-gradient(135deg, #B91C1C 0%, #991B1B 100%);
            padding: 4px 12px;
            border-radius: 4px;
            margin-bottom: 10px;
            box-shadow: 0 4px 10px rgba(185, 28, 28, 0.3);
            text-transform: uppercase;
          }
          .hb-festive-headline {
            margin: 0;
            font-family: 'DM Sans', sans-serif;
            font-weight: 800;
            font-size: clamp(22px, 2.2vw, 28px);
            line-height: 1.05;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            white-space: nowrap;
            color: #0a2540;
          }
          .hb-festive-at {
            color: #94A3B8;
            font-weight: 700;
            margin: 0 4px;
          }
          .hb-festive-price {
            background: linear-gradient(135deg, #D4AF37 0%, #B8860B 50%, #FCD34D 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .hb-festive-divider {
            height: 1.5px;
            width: 60%;
            margin: 12px auto 10px;
            background: linear-gradient(90deg, transparent, rgba(212,175,55,0.7), transparent);
          }
          .hb-festive-tagline {
            margin: 0 0 4px;
            font-size: clamp(12px, 0.95vw, 14px);
            font-weight: 600;
            line-height: 1.35;
            color: #0a2540;
            font-style: italic;
          }
          .hb-festive-sub {
            margin: 0;
            font-size: clamp(11px, 0.85vw, 12.5px);
            line-height: 1.4;
            color: #475569;
          }
          .hb-festive-sub strong {
            background: linear-gradient(135deg, #B8860B, #D4AF37);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 800;
          }
        }

        @media (min-width: 1280px) {
          .hb-overlay { left: 3%; max-width: 46%; }
          .hb-festive { right: 6%; top: 22%; max-width: 340px; padding: 22px 32px 24px; }
        }
      `}</style>
    </section>
  );
}
