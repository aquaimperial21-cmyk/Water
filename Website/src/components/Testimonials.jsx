import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const testimonials = [
  {
    id: 1,
    name: 'Priya Sharma',
    location: 'Pune, Maharashtra',
    rating: 5,
    text: 'We installed Aqua Imperial 8 months ago. The water quality is absolutely amazing — TDS has dropped from 480 to just 28. The app alerts are super helpful and the after-service is excellent!',
    avatar: 'PS',
    color: '#0891B2',
    title: 'Homemaker',
  },
  {
    id: 2,
    name: 'Rajesh Kulkarni',
    location: 'Nashik, Maharashtra',
    rating: 5,
    text: "Best decision of the year! My daughter's health has improved significantly since we switched to Aqua Imperial. The 7-stage filtration gives us total peace of mind. Highly recommend!",
    avatar: 'RK',
    color: '#0E7490',
    title: 'Software Engineer',
  },
  {
    id: 3,
    name: 'Sunita Desai',
    location: 'Aurangabad, Maharashtra',
    rating: 5,
    text: 'Installation was done in just 2 hours. The engineer was professional and explained everything clearly. The IoT connectivity feature is genius — I get alerts on my phone instantly.',
    avatar: 'SD',
    color: '#22D3EE',
    title: 'Teacher',
  },
  {
    id: 4,
    name: 'Amit Joshi',
    location: 'Nagpur, Maharashtra',
    rating: 5,
    text: 'Switched from another brand and I can clearly taste the difference. Aqua Imperial handles our 5-member family effortlessly. The subscription model makes it so affordable!',
    avatar: 'AJ',
    color: '#0891B2',
    title: 'Business Owner',
  },
  {
    id: 5,
    name: 'Meena Patil',
    location: 'Kolhapur, Maharashtra',
    rating: 5,
    text: 'The free demo really convinced me. Within a week of installation, we noticed the water tastes so much better. Kids love it! The monthly recharge plan is very convenient.',
    avatar: 'MP',
    color: '#0E7490',
    title: 'Doctor',
  },
];

function StarRating({ rating }) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 16 16" fill={i < rating ? '#F59E0B' : 'rgba(245,158,11,0.2)'}>
          <path d="M8 1l1.854 3.756L14 5.763l-3 2.923.708 4.13L8 10.777l-3.708 2.039L5 8.686 2 5.763l4.146-.007z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % testimonials.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="testimonials"
      style={{
        padding: '100px 0',
        background: 'linear-gradient(135deg, #ECFEFF 0%, #F0FDFA 50%, #ECFEFF 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', bottom: '-50px', right: '-50px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(8,145,178,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
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
            <span style={{ color: '#0891B2', fontSize: '13px', fontWeight: 600 }}>Customer Stories</span>
          </div>
          <h2 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 800,
            color: '#0F172A',
            marginBottom: '16px',
          }}>
            Real Stories from Real Families
          </h2>
          <p style={{ color: '#64748B', fontSize: '17px', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
            Our happy customers understand the impact of pure drinking water on health and wellness.
          </p>
        </motion.div>

        {/* Featured review */}
        <div style={{ maxWidth: '780px', margin: '0 auto 60px', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.97 }}
              transition={{ duration: 0.5 }}
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '48px 48px',
                border: '1px solid rgba(8,145,178,0.1)',
                boxShadow: '0 20px 60px rgba(8,145,178,0.08)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Quote mark */}
              <div style={{
                position: 'absolute', top: '20px', right: '32px',
                fontSize: '100px', color: 'rgba(8,145,178,0.06)',
                fontFamily: 'Georgia, serif', lineHeight: 1, userSelect: 'none',
              }}>
                "
              </div>

              <div style={{ marginBottom: '20px' }}>
                <StarRating rating={testimonials[current].rating} />
              </div>

              <p style={{
                color: '#1E293B',
                fontSize: '18px',
                lineHeight: 1.8,
                fontStyle: 'italic',
                marginBottom: '32px',
                position: 'relative', zIndex: 1,
              }}>
                "{testimonials[current].text}"
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '52px', height: '52px',
                  borderRadius: '14px',
                  background: `linear-gradient(135deg, ${testimonials[current].color}, #155E75)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: '18px',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: `0 6px 16px ${testimonials[current].color}35`,
                }}>
                  {testimonials[current].avatar}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '16px', fontFamily: "'DM Sans', sans-serif" }}>
                    {testimonials[current].name}
                  </div>
                  <div style={{ color: '#64748B', fontSize: '13px' }}>
                    {testimonials[current].title} · {testimonials[current].location}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                style={{
                  width: current === i ? '28px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: current === i ? '#0891B2' : 'rgba(8,145,178,0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
