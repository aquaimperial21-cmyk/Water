import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'aqua_enquiry_popup_shown';
const SHOW_DELAY_MS = 1500;
const WHATSAPP = '919595190024';
const FORM_ENDPOINT = 'https://formsubmit.co/ajax/aquaimperial21@gmail.com';

const cities = ['Pune', 'Mumbai', 'Nashik', 'Aurangabad', 'Nagpur', 'Kolhapur', 'Solapur', 'Other'];

export default function EnquiryPopup() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ name: '', phone: '', city: '' });
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(STORAGE_KEY, '1');
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleClose = () => setOpen(false);

  const handleChange = (field) => (e) => {
    setData((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!data.name.trim()) e.name = 'Please enter your name';
    if (!/^[6-9]\d{9}$/.test(data.phone.trim())) e.phone = 'Enter a valid 10-digit mobile';
    if (!data.city) e.city = 'Pick your city';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
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
          _subject: 'New Enquiry — Aqua Imperial (Popup)',
          _template: 'table',
          _captcha: 'false',
          _honey: '',
          Name: data.name,
          Phone: `+91 ${data.phone}`,
          City: data.city,
          Source: 'Website popup',
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

  const handleWhatsApp = () => {
    const msg = `Hi Aqua Imperial! I'm interested. Name: ${data.name || 'Customer'}, City: ${data.city || 'N/A'}`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="ep-backdrop"
            className="ep-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ep-title"
          >
            <motion.div
              className="ep-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="ep-close"
                onClick={handleClose}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              <AnimatePresence mode="wait">
                {!submitted ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="ep-body"
                  >
                    <div className="ep-head">
                      <div className="ep-logo">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C12 2 5 10 5 15C5 18.866 8.134 22 12 22C15.866 22 19 18.866 19 15C19 10 12 2 12 2Z" fill="white"/>
                        </svg>
                      </div>
                      <span className="ep-eyebrow">Limited Summer Offer</span>
                    </div>

                    <h2 id="ep-title" className="ep-title">
                      Free home demo<br />
                      <span className="ep-title-accent">for ₹0 today</span>
                    </h2>
                    <p className="ep-sub">
                      Plans start at <strong>₹349/month</strong>. We'll call you within 30 minutes.
                    </p>

                    <form onSubmit={handleSubmit} noValidate className="ep-form">
                      <Field
                        id="ep-name"
                        label="Full name"
                        value={data.name}
                        onChange={handleChange('name')}
                        focused={focused === 'name'}
                        onFocus={() => setFocused('name')}
                        onBlur={() => setFocused('')}
                        error={errors.name}
                        autoFocus
                      />
                      <Field
                        id="ep-phone"
                        label="Mobile number"
                        type="tel"
                        prefix="+91"
                        maxLength={10}
                        value={data.phone}
                        onChange={handleChange('phone')}
                        focused={focused === 'phone'}
                        onFocus={() => setFocused('phone')}
                        onBlur={() => setFocused('')}
                        error={errors.phone}
                      />
                      <SelectField
                        id="ep-city"
                        label="City"
                        value={data.city}
                        onChange={handleChange('city')}
                        focused={focused === 'city'}
                        onFocus={() => setFocused('city')}
                        onBlur={() => setFocused('')}
                        error={errors.city}
                        options={cities}
                      />

                      {errors.submit && (
                        <div className="ep-err" style={{ textAlign: 'center', marginTop: 2 }}>
                          {errors.submit}
                        </div>
                      )}

                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={{ scale: loading ? 1 : 1.015 }}
                        whileTap={{ scale: loading ? 1 : 0.985 }}
                        className="ep-submit"
                      >
                        {loading ? (
                          <>
                            <motion.span
                              className="ep-spinner"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                            />
                            Sending…
                          </>
                        ) : (
                          <>
                            Book Free Demo
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </>
                        )}
                      </motion.button>

                      <button
                        type="button"
                        onClick={handleWhatsApp}
                        className="ep-wa"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/>
                        </svg>
                        Chat on WhatsApp instead
                      </button>
                    </form>

                    <div className="ep-trust">
                      <span className="ep-trust-item">
                        <Tick />Zero installation cost
                      </span>
                      <span className="ep-trust-item">
                        <Tick />7-day risk-free trial
                      </span>
                      <span className="ep-trust-item">
                        <Tick />No spam, ever
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ep-body ep-success"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 220, delay: 0.05 }}
                      className="ep-tick"
                    >
                      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                        <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                    <h2 className="ep-title">You're all set, {data.name?.split(' ')[0] || 'Friend'}.</h2>
                    <p className="ep-sub">
                      Our team will call you on <strong>+91 {data.phone}</strong> within 30 minutes.
                    </p>
                    <a href="tel:+919595190024" className="ep-callbox">
                      <svg width="14" height="14" viewBox="0 0 22 22" fill="currentColor">
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                      </svg>
                      In a hurry? Call +91 95951 90024
                    </a>
                    <button onClick={handleClose} className="ep-submit ep-submit-alt">
                      Continue browsing
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .ep-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(8, 23, 42, 0.55);
          backdrop-filter: blur(8px) saturate(140%);
          -webkit-backdrop-filter: blur(8px) saturate(140%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-y: auto;
          font-family: 'DM Sans', sans-serif;
        }
        .ep-modal {
          position: relative;
          width: 100%;
          max-width: 400px;
          background: #ffffff;
          border-radius: 22px;
          box-shadow:
            0 30px 80px rgba(8, 23, 42, 0.32),
            0 0 0 1px rgba(8, 145, 178, 0.06);
          overflow: hidden;
          margin: auto;
        }
        .ep-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #F1F5F9;
          border: none;
          color: #64748B;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
          transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }
        .ep-close:hover {
          background: #0F172A;
          color: #ffffff;
          transform: rotate(90deg);
        }

        .ep-body {
          padding: 32px 28px 24px;
        }

        .ep-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }
        .ep-logo {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0891B2, #22D3EE);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(8, 145, 178, 0.32);
          flex-shrink: 0;
        }
        .ep-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #0891B2;
          background: rgba(8, 145, 178, 0.08);
          padding: 5px 10px;
          border-radius: 999px;
        }

        .ep-title {
          font-size: 24px;
          font-weight: 800;
          color: #0F172A;
          line-height: 1.18;
          margin: 0 0 8px;
          letter-spacing: -0.6px;
        }
        .ep-title-accent {
          background: linear-gradient(90deg, #0891B2, #22D3EE);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ep-sub {
          color: #64748B;
          font-size: 13.5px;
          line-height: 1.55;
          margin: 0 0 22px;
        }
        .ep-sub strong { color: #0F172A; font-weight: 700; }

        .ep-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* Field */
        .ep-field-wrap { position: relative; }
        .ep-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #64748B;
          margin-bottom: 6px;
          letter-spacing: 0.1px;
          transition: color 0.2s;
        }
        .ep-label-active { color: #0891B2; }
        .ep-label-err { color: #EF4444; }
        .ep-input-shell {
          display: flex;
          align-items: stretch;
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          border-radius: 12px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          overflow: hidden;
        }
        .ep-input-shell-active {
          background: #ffffff;
          border-color: #0891B2;
          box-shadow: 0 0 0 4px rgba(8, 145, 178, 0.12);
        }
        .ep-input-shell-err {
          border-color: #EF4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
        }
        .ep-prefix {
          display: inline-flex;
          align-items: center;
          padding: 0 12px 0 14px;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          border-right: 1px solid #E2E8F0;
          background: transparent;
          letter-spacing: 0.2px;
        }
        .ep-input,
        .ep-select {
          flex: 1;
          width: 100%;
          padding: 11px 14px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          color: #0F172A;
          background: transparent;
          border: none;
          outline: none;
          letter-spacing: 0.1px;
        }
        .ep-input::placeholder { color: #94A3B8; }
        .ep-select {
          appearance: none;
          padding-right: 38px;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%2364748B' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          cursor: pointer;
        }
        .ep-select:invalid, .ep-select option[value=""] { color: #94A3B8; }
        .ep-err {
          color: #EF4444;
          font-size: 12px;
          margin-top: 5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ep-submit {
          width: 100%;
          padding: 13px 16px;
          margin-top: 4px;
          background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-family: inherit;
          font-weight: 700;
          font-size: 14.5px;
          letter-spacing: 0.2px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 10px 24px rgba(8, 145, 178, 0.32);
          transition: opacity 0.2s, box-shadow 0.2s;
        }
        .ep-submit:disabled { opacity: 0.7; cursor: not-allowed; }
        .ep-submit:hover:not(:disabled) {
          box-shadow: 0 14px 30px rgba(8, 145, 178, 0.42);
        }
        .ep-submit-alt {
          background: #0F172A;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.25);
          margin-top: 16px;
        }
        .ep-submit-alt:hover:not(:disabled) {
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.35);
        }
        .ep-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.4);
          border-top-color: #ffffff;
          border-radius: 50%;
          display: inline-block;
        }

        .ep-wa {
          width: 100%;
          padding: 11px;
          background: transparent;
          color: #128C7E;
          border: none;
          font-family: inherit;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: -2px;
          transition: color 0.18s;
        }
        .ep-wa:hover { color: #0a6b58; text-decoration: underline; text-underline-offset: 3px; }

        .ep-trust {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 6px 14px;
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #F1F5F9;
        }
        .ep-trust-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 500;
          color: #64748B;
          white-space: nowrap;
        }

        /* Success state */
        .ep-success {
          text-align: center;
          padding: 40px 28px 28px;
        }
        .ep-tick {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22C55E, #16A34A);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 18px;
          box-shadow: 0 12px 32px rgba(34, 197, 94, 0.35);
        }
        .ep-success .ep-title { font-size: 22px; }
        .ep-callbox {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(8, 145, 178, 0.07);
          border: 1px solid rgba(8, 145, 178, 0.18);
          border-radius: 10px;
          padding: 10px 16px;
          color: #0891B2;
          font-size: 13px;
          font-weight: 600;
          margin: 16px 0 0;
          text-decoration: none;
          transition: background 0.18s;
        }
        .ep-callbox:hover { background: rgba(8, 145, 178, 0.12); }

        @media (max-width: 480px) {
          .ep-backdrop { padding: 12px; align-items: flex-end; }
          .ep-modal { max-width: 100%; border-radius: 18px 18px 0 0; }
          .ep-body { padding: 28px 22px 20px; }
          .ep-success { padding: 32px 22px 22px; }
          .ep-title { font-size: 22px; }
          .ep-success .ep-title { font-size: 20px; }
        }
      `}</style>
    </>
  );
}

function Field({ id, label, type = 'text', value, onChange, focused, onFocus, onBlur, error, prefix, maxLength, autoFocus }) {
  const active = focused || !!value;
  return (
    <div className="ep-field-wrap">
      <label
        htmlFor={id}
        className={`ep-label ${focused ? 'ep-label-active' : ''} ${error ? 'ep-label-err' : ''}`}
      >
        {label}
      </label>
      <div className={`ep-input-shell ${focused ? 'ep-input-shell-active' : ''} ${error ? 'ep-input-shell-err' : ''}`}>
        {prefix && <span className="ep-prefix">{prefix}</span>}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className="ep-input"
          placeholder={active ? '' : `Your ${label.toLowerCase()}`}
        />
      </div>
      {error && <div className="ep-err">{error}</div>}
    </div>
  );
}

function SelectField({ id, label, value, onChange, focused, onFocus, onBlur, error, options }) {
  return (
    <div className="ep-field-wrap">
      <label
        htmlFor={id}
        className={`ep-label ${focused ? 'ep-label-active' : ''} ${error ? 'ep-label-err' : ''}`}
      >
        {label}
      </label>
      <div className={`ep-input-shell ${focused ? 'ep-input-shell-active' : ''} ${error ? 'ep-input-shell-err' : ''}`}>
        <select
          id={id}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          className="ep-select"
        >
          <option value="">Choose your city</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {error && <div className="ep-err">{error}</div>}
    </div>
  );
}

function Tick() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="#22C55E" opacity="0.15"/>
      <path d="M4.5 7L6 8.5L9.5 5" stroke="#16A34A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
