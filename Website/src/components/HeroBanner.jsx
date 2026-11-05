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
      aria-label="Aqua Imperial RO on rent"
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
            alt="Aqua Imperial RO water purifiers on rent"
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
            1–12 month plans <span className="hb-pipe">|</span> Filters &amp; service included <span className="hb-pipe">|</span> 48-hour installation
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
        }

        @media (min-width: 1280px) {
          .hb-overlay { left: 3%; max-width: 46%; }
        }
      `}</style>
    </section>
  );
}
