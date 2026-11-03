import { IndianRupee, ShieldCheck, CalendarCheck, Truck } from 'lucide-react';

const items = [
  { Icon: IndianRupee, label: 'Zero Machine Cost' },
  { Icon: ShieldCheck, label: 'Lifetime free maintenance' },
  { Icon: CalendarCheck, label: '7-day risk-free trial' },
  { Icon: Truck, label: 'Free Relocation' },
];

export default function BenefitsMarquee() {
  const loop = [...items, ...items];

  return (
    <div
      style={{
        background: 'var(--primary)',
        color: '#ffffff',
        padding: '10px 0',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div className="bm-track">
        {loop.map(({ Icon, label }, i) => (
          <div key={i} className="bm-item">
            <Icon className="bm-icon" strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <style>{`
        .bm-track {
          display: flex;
          width: max-content;
          animation: bmScroll 30s linear infinite;
        }
        .bm-track:hover { animation-play-state: paused; }
        .bm-item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0 20px;
          font-size: 12px;
          font-weight: 700;
          color: #ffffff;
          border-right: 1px solid rgba(255,255,255,0.25);
          white-space: nowrap;
        }
        .bm-icon { width: 22px; height: 22px; }

        @media (min-width: 768px) {
          .bm-item {
            padding: 0 40px;
            font-size: 15px;
          }
          .bm-icon { width: 28px; height: 28px; }
        }

        @keyframes bmScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bm-track { animation: none; justify-content: center; flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
