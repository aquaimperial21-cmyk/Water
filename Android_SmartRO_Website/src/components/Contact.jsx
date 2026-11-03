import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const PHONE = '+919595190024';
const WHATSAPP = '+919595190024';
const EMAIL = 'aquaimperial21@gmail.com';
const FORM_ENDPOINT = `https://formsubmit.co/ajax/${EMAIL}`;

const cities = ['Pune', 'Mumbai', 'Nashik', 'Aurangabad', 'Nagpur', 'Kolhapur', 'Solapur', 'Satara', 'Other'];
const products = ['Aqua Imperial RO', 'Aqua Imperial Copper', 'Aqua Imperial Alkaline', 'Aqua Imperial Mineral+', 'Not Sure (Need Guidance)'];

export default function Contact() {
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', city: '', product: '', message: '', source: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = 'Name is required';
    if (!formData.phone.trim() || !/^[6-9]\d{9}$/.test(formData.phone)) e.phone = 'Valid 10-digit phone required';
    if (!formData.city) e.city = 'Please select your city';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    const submittedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }) + ' IST';
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: 'New Enquiry — Aqua Imperial (Contact form)',
          _template: 'table',
          _captcha: 'false',
          _honey: '',
          ...(formData.email ? { _replyto: formData.email } : {}),
          Name: formData.name,
          Phone: `+91 ${formData.phone}`,
          Email: formData.email || '—',
          City: formData.city,
          'Interested Model': formData.product || '—',
          'Heard From': formData.source || '—',
          Message: formData.message || '—',
          Source: 'Website contact form',
          'Submitted At': submittedAt,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success !== 'true') throw new Error('submit-failed');
      setSubmitted(true);
    } catch (err) {
      setErrors({ submit: 'Could not send. Please call or WhatsApp us.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setFormData(p => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  };

  const handleWhatsApp = () => {
    const msg = `Hi Aqua Imperial! I'm interested in a water purifier subscription. Name: ${formData.name || 'Customer'}, City: ${formData.city || 'N/A'}`;
    window.open(`https://wa.me/${WHATSAPP.replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCall = () => window.open(`tel:${PHONE}`, '_self');
  const handleEmail = () => window.open(`mailto:${EMAIL}?subject=Aqua Imperial Enquiry&body=Hi, I am interested in Aqua Imperial water purifier. Please contact me.`, '_self');

  return (
    <section
      id="contact"
      style={{ padding: '100px 0', background: 'linear-gradient(135deg, #ECFEFF 0%, #F0FDFA 100%)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Floating drops BG */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -20, 0], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.8 }}
            style={{
              position: 'absolute',
              left: `${10 + i * 16}%`,
              top: `${20 + (i % 3) * 20}%`,
              width: '12px', height: '16px',
              background: 'linear-gradient(180deg, #67E8F9, #0891B2)',
              borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
              opacity: 0.2,
            }}
          />
        ))}
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          style={{ textAlign: 'center', marginBottom: '64px' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.15)',
            borderRadius: '25px', padding: '6px 16px', marginBottom: '16px',
          }}>
            <span style={{ color: '#0891B2', fontSize: '13px', fontWeight: 600 }}>Get In Touch</span>
          </div>
          <h2 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 800, color: '#0F172A', marginBottom: '16px',
          }}>
            Start Your Free Trial Today
          </h2>
          <p style={{ color: '#64748B', fontSize: '17px', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
            Leave your details and our expert will contact you within 30 minutes — free of charge, no obligations.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '48px',
          alignItems: 'start',
        }}
          className="contact-grid"
        >
          {/* Left: Contact info */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <h3 style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '24px', fontWeight: 700,
              color: '#0F172A', marginBottom: '8px',
            }}>
              Contact Us Instantly
            </h3>
            <p style={{ color: '#64748B', fontSize: '15px', lineHeight: 1.7, marginBottom: '36px' }}>
              Choose how you'd like to reach us — WhatsApp, phone call, or email. We're available 7 days a week.
            </p>

            {/* Quick contact buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
              <motion.button
                whileHover={{ scale: 1.02, x: 3 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleWhatsApp}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                  color: 'white', border: 'none',
                  padding: '14px 20px', borderRadius: '14px',
                  cursor: 'pointer', width: '100%',
                  boxShadow: '0 6px 20px rgba(37,211,102,0.25)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Chat on WhatsApp</div>
                  <div style={{ fontSize: '12px', opacity: 0.85 }}>Quick response · Available 24/7</div>
                </div>
                <svg style={{ marginLeft: 'auto' }} width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9H14M9 4L14 9L9 14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, x: 3 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCall}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  background: 'linear-gradient(135deg, #0891B2, #155E75)',
                  color: 'white', border: 'none',
                  padding: '14px 20px', borderRadius: '14px',
                  cursor: 'pointer', width: '100%',
                  boxShadow: '0 6px 20px rgba(8,145,178,0.25)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 22 22" fill="white">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Call Us Now</div>
                  <div style={{ fontSize: '12px', opacity: 0.85 }}>+91 95951 90024 · 9AM–8PM</div>
                </div>
                <svg style={{ marginLeft: 'auto' }} width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9H14M9 4L14 9L9 14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, x: 3 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleEmail}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                  color: 'white', border: 'none',
                  padding: '14px 20px', borderRadius: '14px',
                  cursor: 'pointer', width: '100%',
                  boxShadow: '0 6px 20px rgba(99,102,241,0.25)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
                    <rect x="2" y="4" width="18" height="14" rx="2" stroke="white" strokeWidth="1.8"/>
                    <path d="M2 7L11 13L20 7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Send Email</div>
                  <div style={{ fontSize: '12px', opacity: 0.85 }}>aquaimperial21@gmail.com</div>
                </div>
                <svg style={{ marginLeft: 'auto' }} width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9H14M9 4L14 9L9 14" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </motion.button>
            </div>

            {/* Trust badges */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(8,145,178,0.1)',
              boxShadow: '0 2px 12px rgba(8,145,178,0.06)',
            }}>
              <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px', marginBottom: '16px', fontFamily: "'DM Sans', sans-serif" }}>
                Why Trust Aqua Imperial?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  'Free home demo & water testing',
                  'Professional installation by certified engineers',
                  'No hidden charges, transparent pricing',
                  'Annual maintenance & filter service included',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="8" fill="#0891B2" opacity="0.1"/>
                        <path d="M5.5 9L7.5 11L12.5 7" stroke="#0891B2" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span style={{ color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: Enquiry Form */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <div style={{
              background: 'white',
              borderRadius: '24px',
              padding: '36px',
              border: '1px solid rgba(8,145,178,0.1)',
              boxShadow: '0 16px 48px rgba(8,145,178,0.08)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Top gradient bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: 'linear-gradient(90deg, #155E75, #0891B2, #22D3EE, #22C55E)',
              }} />

              <AnimatePresence mode="wait">
                {!submitted ? (
                  <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h3 style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '22px', fontWeight: 700,
                      color: '#0F172A', marginBottom: '8px',
                    }}>
                      Request a Free Trial
                    </h3>
                    <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
                      Fill in your details and our team will contact you within 30 minutes.
                    </p>

                    <form onSubmit={handleSubmit} noValidate>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}
                        className="form-grid">
                        <InputField label="Full Name *" placeholder="Your full name" value={formData.name} onChange={handleChange('name')} error={errors.name} />
                        <InputField label="Phone Number *" placeholder="10-digit mobile" value={formData.phone} onChange={handleChange('phone')} error={errors.phone} type="tel" />
                      </div>

                      <InputField label="Email Address" placeholder="your@email.com (optional)" value={formData.email} onChange={handleChange('email')} type="email" style={{ marginBottom: '14px' }} />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}
                        className="form-grid">
                        <SelectField label="Select City *" value={formData.city} onChange={handleChange('city')} error={errors.city} options={cities} placeholder="Your city" />
                        <SelectField label="Interested Model" value={formData.product} onChange={handleChange('product')} options={products} placeholder="Select model" />
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
                          How did you hear about us?
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {['WhatsApp', 'Google', 'Facebook', 'Friend', 'Other'].map((src) => (
                            <button
                              key={src}
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, source: src }))}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                border: `1.5px solid ${formData.source === src ? '#0891B2' : 'rgba(8,145,178,0.15)'}`,
                                background: formData.source === src ? 'rgba(8,145,178,0.06)' : 'transparent',
                                color: formData.source === src ? '#0891B2' : '#64748B',
                                fontSize: '13px',
                                fontWeight: formData.source === src ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              {src}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
                          Additional Message
                        </label>
                        <textarea
                          value={formData.message}
                          onChange={handleChange('message')}
                          placeholder="Any specific requirements or questions..."
                          rows={3}
                          style={{
                            width: '100%', padding: '12px 16px',
                            border: '1.5px solid rgba(8,145,178,0.15)',
                            borderRadius: '12px', fontFamily: "'DM Sans', sans-serif",
                            fontSize: '14px', color: '#1E293B',
                            resize: 'vertical', outline: 'none',
                            background: '#F8FFFE', transition: 'border-color 0.2s',
                            boxSizing: 'border-box',
                          }}
                          onFocus={e => e.target.style.borderColor = '#0891B2'}
                          onBlur={e => e.target.style.borderColor = 'rgba(8,145,178,0.15)'}
                        />
                      </div>

                      {errors.submit && (
                        <div style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#B91C1C',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 500,
                          marginBottom: '12px',
                          textAlign: 'center',
                        }}>
                          {errors.submit}
                        </div>
                      )}

                      <motion.button
                        type="submit"
                        whileHover={{ scale: 1.02, boxShadow: '0 10px 36px rgba(34,197,94,0.45)' }}
                        whileTap={{ scale: 0.98 }}
                        disabled={loading}
                        style={{
                          width: '100%',
                          background: loading ? '#94A3B8' : 'linear-gradient(135deg, #22C55E, #16A34A)',
                          color: 'white', border: 'none',
                          padding: '14px', borderRadius: '12px',
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 700, fontSize: '15px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          boxShadow: '0 6px 20px rgba(34,197,94,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        }}
                      >
                        {loading ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              style={{ width: '18px', height: '18px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}
                            />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M9 2C9 2 4 8 4 12C4 14.761 6.239 17 9 17C11.761 17 14 14.761 14 12C14 8 9 2 9 2Z" fill="white" opacity="0.8"/>
                            </svg>
                            Start Free Trial
                          </>
                        )}
                      </motion.button>

                      <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '12px', marginTop: '10px' }}>
                        By submitting, you agree to be contacted by Aqua Imperial team. No spam ever.
                      </p>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ textAlign: 'center', padding: '36px 0' }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                      style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                        boxShadow: '0 0 36px rgba(34,197,94,0.35)',
                      }}
                    >
                      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                        <path d="M9 18L15 24L27 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                    <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '22px', fontWeight: 800, color: '#0F172A', marginBottom: '10px' }}>
                      Thank You, {formData.name || 'Friend'}!
                    </h3>
                    <p style={{ color: '#64748B', fontSize: '15px', lineHeight: 1.7, marginBottom: '24px' }}>
                      Your trial request has been received. Our team will call you within <strong>30 minutes</strong>.
                    </p>
                    <div style={{
                      background: 'rgba(8,145,178,0.05)', border: '1px solid rgba(8,145,178,0.15)',
                      borderRadius: '12px', padding: '14px', color: '#155E75', fontSize: '14px', fontWeight: 600,
                      marginBottom: '20px',
                    }}>
                      In a hurry? Call us at +91 95951 90024
                    </div>
                    <button
                      onClick={() => setSubmitted(false)}
                      style={{
                        background: 'transparent', border: '1.5px solid rgba(8,145,178,0.25)',
                        color: '#0891B2', padding: '10px 24px', borderRadius: '10px',
                        fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                      }}
                    >
                      Submit Another Request
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr !important; }
          .form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function InputField({ label, placeholder, value, onChange, error, type = 'text', style: extraStyle }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ ...extraStyle }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', fontFamily: "'DM Sans', sans-serif" }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '11px 16px',
          border: `1.5px solid ${error ? '#EF4444' : focused ? '#0891B2' : 'rgba(8,145,178,0.15)'}`,
          borderRadius: '10px', fontFamily: "'DM Sans', sans-serif",
          fontSize: '14px', color: '#1E293B',
          outline: 'none', background: '#F8FFFE',
          transition: 'border-color 0.2s', boxSizing: 'border-box',
        }}
      />
      {error && <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, error }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', fontFamily: "'DM Sans', sans-serif" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '11px 16px',
          border: `1.5px solid ${error ? '#EF4444' : focused ? '#0891B2' : 'rgba(8,145,178,0.15)'}`,
          borderRadius: '10px', fontFamily: "'DM Sans', sans-serif",
          fontSize: '14px', color: value ? '#1E293B' : '#94A3B8',
          outline: 'none', background: '#F8FFFE', cursor: 'pointer',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
          paddingRight: '36px', boxSizing: 'border-box',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <div style={{ color: '#EF4444', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
    </div>
  );
}
