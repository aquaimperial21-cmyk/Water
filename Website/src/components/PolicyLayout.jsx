import { useEffect } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

// Shared shell for the legal pages: the site's Navbar over a dark header band
// (so the transparent navbar reads the same as on the home page), a readable
// white text card, then the Footer. `extra` renders full width after the card.
export default function PolicyLayout({ title, updated, intro, extra, children }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Aqua Imperial`;
    return () => { document.title = previous; };
  }, [title]);

  return (
    <>
      <Navbar />

      <header className="policy-hero">
        <div className="policy-hero-inner">
          <div className="policy-eyebrow">Aqua Imperial · Mahesh Enterprises</div>
          <h1>{title}</h1>
          {updated && <p className="policy-updated">Last updated: {updated}</p>}
          {intro && <p className="policy-intro">{intro}</p>}
        </div>
      </header>

      <main id="main" className={`policy-main${extra ? ' has-extra' : ''}`}>
        <article className="policy-card policy-prose">
          {children}
        </article>
      </main>

      {extra}

      <Footer />

      <style>{`
        .policy-hero {
          background: linear-gradient(135deg, #0F172A 0%, #164E63 50%, #0891B2 100%);
          padding: 140px 24px 72px;
          text-align: center;
          color: #ffffff;
        }
        .policy-hero-inner { max-width: 820px; margin: 0 auto; }
        .policy-eyebrow {
          display: inline-block;
          background: rgba(34,211,238,0.12);
          border: 1px solid rgba(34,211,238,0.3);
          color: #67E8F9;
          border-radius: 25px;
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 18px;
        }
        .policy-hero h1 {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(30px, 5vw, 46px);
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1.15;
          color: #ffffff;
        }
        .policy-updated { margin-top: 14px; font-size: 14px; color: rgba(255,255,255,0.7); }
        .policy-intro {
          margin: 14px auto 0;
          max-width: 620px;
          font-size: 16px;
          line-height: 1.7;
          color: rgba(255,255,255,0.8);
        }

        .policy-main {
          background: linear-gradient(180deg, #F8FFFE 0%, #ECFEFF 100%);
          padding: 0 16px 120px;
        }
        .policy-main.has-extra { padding-bottom: 24px; background: #ECFEFF; }
        .policy-card {
          position: relative;
          top: -32px;
          max-width: 820px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid rgba(8,145,178,0.1);
          border-radius: 24px;
          box-shadow: 0 8px 30px rgba(8,145,178,0.08);
          padding: clamp(24px, 5vw, 56px);
        }

        .policy-prose { color: #334155; font-size: 16px; line-height: 1.75; }
        .policy-prose > :first-child { margin-top: 0; }
        .policy-prose h2 {
          font-family: 'DM Sans', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #0F172A;
          margin: 36px 0 10px;
          line-height: 1.3;
        }
        .policy-prose h3 {
          font-size: 17px;
          font-weight: 700;
          color: #0E7490;
          margin: 24px 0 8px;
        }
        .policy-prose p { margin: 0 0 14px; }
        .policy-prose ul { margin: 0 0 16px; padding-left: 22px; }
        .policy-prose li { margin: 6px 0; padding-left: 4px; }
        .policy-prose li::marker { color: #0891B2; }
        .policy-prose strong { color: #0F172A; }
        .policy-prose a {
          color: #0891B2;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 2px;
          word-break: break-word;
        }
        .policy-prose a:hover { color: #0E7490; }
        .policy-prose address { font-style: normal; }
        .policy-prose dl {
          display: grid;
          grid-template-columns: 170px 1fr;
          gap: 10px 20px;
          margin: 0 0 18px;
        }
        .policy-prose dt { font-weight: 700; color: #0F172A; }
        .policy-prose dd { margin: 0; }
        @media (max-width: 560px) {
          .policy-prose dl { grid-template-columns: 1fr; gap: 2px; }
          .policy-prose dd { margin-bottom: 10px; }
        }
      `}</style>
    </>
  );
}
