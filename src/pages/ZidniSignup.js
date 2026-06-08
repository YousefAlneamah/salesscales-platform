import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const TIERS = [
  {
    id: 'starter',
    price: '$100',
    label: 'Starter',
    spots: '1 pool spot',
    features: [
      '1 spot across all 6 income streams',
      'AI-managed daily operations',
      'Monthly earnings report',
      'PayPal payout every month',
      'WhatsApp support',
    ],
  },
  {
    id: 'elite',
    price: '$200',
    label: 'Elite',
    spots: '1.5 pool spots',
    badge: 'Most Popular',
    features: [
      '1.5 spots — 50% more earning power',
      'Priority AI optimization on all streams',
      'Weekly earnings report',
      'Priority payout processing',
      'Dedicated WhatsApp support line',
      'Early access to new niches',
    ],
  },
];

const NICHES = [
  { id: 'Personal Finance', emoji: '💰', title: 'Personal Finance', desc: 'Budgeting, investing, saving, debt freedom. Evergreen demand with high affiliate commissions.' },
  { id: 'AI Tools', emoji: '🤖', title: 'AI Tools', desc: 'AI prompts, guides, and tools. The fastest-growing digital category in 2026.' },
];

export default function ZidniSignup() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ tier: '', name: '', email: '', password: '', whatsapp: '', country: '', niche: '' });
  const [errors, setErrors] = useState({});
  const [payError, setPayError] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Keep a ref to the current form so PayPal callbacks always see latest values
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  // ── PayPal ─────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 4) return;
    setPayError('');

    const doRender = () => {
      if (!window.paypal) return;
      const container = document.getElementById('paypal-button-container');
      if (!container) return;
      container.innerHTML = '';
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
        createOrder: async () => {
          const { data } = await axios.post('http://localhost:3001/zidni/paypal/create-order', { tier: formRef.current.tier });
          return data.orderId;
        },
        onApprove: async (ppData) => {
          setPayLoading(true);
          setPayError('');
          try {
            const { data } = await axios.post('http://localhost:3001/zidni/signup', {
              ...formRef.current,
              paypalOrderId: ppData.orderID,
            });
            localStorage.setItem('zidni_token', data.token);
            localStorage.setItem('zidni_client', JSON.stringify({ id: data.clientId, name: data.name, email: data.email, tier: data.tier }));
            window.location.href = '/zidni/dashboard';
          } catch (err) {
            setPayError(err.response?.data?.error || 'Signup failed after payment. Contact yousef@joinzidni.com');
            setPayLoading(false);
          }
        },
        onError: () => setPayError('Payment failed. Please try again.'),
        onCancel: () => setPayError('Payment was cancelled.'),
      }).render('#paypal-button-container');
    };

    axios.get('http://localhost:3001/zidni/paypal-config')
      .then(({ data: cfg }) => {
        if (!cfg.clientId) { setPayError('Payment not configured. Contact support.'); return; }
        if (window.paypal) { doRender(); return; }
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${cfg.clientId}&currency=USD`;
        script.onload = doRender;
        script.onerror = () => setPayError('Could not load payment system. Please refresh the page.');
        document.head.appendChild(script);
      })
      .catch(() => setPayError('Could not load payment config. Is the server running?'));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation ─────────────────────────────────────────────
  const validateStep2 = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 1 && !form.tier) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !form.niche) return;
    setStep(s => s + 1);
  };

  const selectedTier = TIERS.find(t => t.id === form.tier);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', fontFamily: "'Inter', sans-serif", color: '#f0f4f8' }}>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/zidni" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#050d1a', fontWeight: 800, fontSize: 14 }}>Z</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px', color: '#f0f4f8' }}>Zidni</span>
          </a>
          <p style={{ fontSize: 13, color: '#8896a8', margin: 0 }}>
            Already a member?{' '}
            <a href="/zidni/login" style={{ color: '#c9a84c', textDecoration: 'none', fontWeight: 600 }}>Log in</a>
          </p>
        </div>
      </nav>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* STEPPER */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 48 }}>
          {['Choose Plan', 'Your Details', 'Pick Niche', 'Payment'].map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <React.Fragment key={label}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: done ? '#c9a84c' : active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.03)',
                    border: done || active ? '2px solid #c9a84c' : '2px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    color: done ? '#050d1a' : active ? '#c9a84c' : '#4a5568',
                    flexShrink: 0,
                  }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? '#c9a84c' : done ? '#8896a8' : '#4a5568', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </div>
                {i < 3 && (
                  <div style={{ flex: 1, height: 2, background: step > n ? '#c9a84c' : 'rgba(255,255,255,0.06)', margin: '0 4px 16px', transition: 'background 0.3s', minWidth: 12 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── STEP 1: TIER ── */}
        {step === 1 && (
          <div>
            <h1 style={headStyle}>Choose your plan</h1>
            <p style={subStyle}>Pick the membership tier that fits your goals. Both include all 6 income streams.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginBottom: 32 }}>
              {TIERS.map(t => (
                <div
                  key={t.id}
                  onClick={() => set('tier', t.id)}
                  style={{
                    background: '#0a1628',
                    border: form.tier === t.id ? '2px solid #c9a84c' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16, padding: '24px 24px 20px', cursor: 'pointer',
                    position: 'relative', transition: 'all 0.15s',
                    boxShadow: form.tier === t.id ? '0 0 0 4px rgba(201,168,76,0.08)' : 'none',
                  }}
                >
                  {t.badge && (
                    <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', color: '#050d1a', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 20, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {t.badge}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 3 }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: '#c9a84c', fontWeight: 600 }}>{t.spots}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#c9a84c', lineHeight: 1 }}>{t.price}</div>
                      <div style={{ fontSize: 11, color: '#8896a8', marginTop: 2 }}>/month</div>
                    </div>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {t.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#8896a8', lineHeight: 1.4 }}>
                        <span style={{ color: '#c9a84c', flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button onClick={next} disabled={!form.tier} style={primaryBtn(!form.tier)}>
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: DETAILS ── */}
        {step === 2 && (
          <div>
            <h1 style={headStyle}>Your details</h1>
            <p style={subStyle}>Create your Zidni account. You'll use these to log in to your dashboard.</p>
            <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
              <Field label="Full Name" required error={errors.name}>
                <input style={inputSt(!!errors.name)} placeholder="Your full name" value={form.name} onChange={e => set('name', e.target.value)} />
              </Field>
              <Field label="Email Address" required error={errors.email}>
                <input style={inputSt(!!errors.email)} type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </Field>
              <Field label="Password" required error={errors.password}>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inputSt(!!errors.password), paddingRight: 48 }} type={showPass ? 'text' : 'password'} placeholder="Minimum 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8896a8', cursor: 'pointer', fontSize: 12, padding: 4, fontFamily: 'inherit' }}>
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>
              <Field label="WhatsApp Number">
                <input style={inputSt(false)} placeholder="+1 234 567 8900" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
              </Field>
              <Field label="Country">
                <input style={inputSt(false)} placeholder="United States" value={form.country} onChange={e => set('country', e.target.value)} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={backBtn}>← Back</button>
              <button onClick={next} style={primaryBtn(false)}>Continue →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: NICHE ── */}
        {step === 3 && (
          <div>
            <h1 style={headStyle}>Choose your niche</h1>
            <p style={subStyle}>Your income pool is built around this topic. You'll be grouped with members in the same space for pooled growth.</p>
            <div style={{ display: 'grid', gap: 14, marginBottom: 32 }}>
              {NICHES.map(n => (
                <div
                  key={n.id}
                  onClick={() => set('niche', n.id)}
                  style={{
                    background: '#0a1628',
                    border: form.niche === n.id ? '2px solid #c9a84c' : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16, padding: 24, cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: form.niche === n.id ? '0 0 0 4px rgba(201,168,76,0.08)' : 'none',
                    display: 'flex', gap: 18, alignItems: 'flex-start',
                  }}
                >
                  <div style={{ fontSize: 40, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{n.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{n.title}</div>
                    <div style={{ fontSize: 13, color: '#8896a8', lineHeight: 1.55 }}>{n.desc}</div>
                  </div>
                  {form.niche === n.id && (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#c9a84c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span style={{ color: '#050d1a', fontSize: 12, fontWeight: 800 }}>✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={backBtn}>← Back</button>
              <button onClick={next} disabled={!form.niche} style={primaryBtn(!form.niche)}>Continue →</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: PAYMENT ── */}
        {step === 4 && (
          <div>
            <h1 style={headStyle}>Complete payment</h1>
            <p style={subStyle}>Secure checkout via PayPal. Your income system starts building immediately.</p>

            {/* Order summary */}
            <div style={{ background: '#0a1628', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14 }}>Order Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Zidni {selectedTier?.label} Membership</span>
                <span style={{ fontWeight: 800, color: '#c9a84c', fontSize: 15 }}>{selectedTier?.price}/mo</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8896a8', marginBottom: 7 }}>
                <span>Niche</span><span style={{ color: '#f0f4f8' }}>{form.niche}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8896a8', marginBottom: 7 }}>
                <span>Pool spots allocated</span><span style={{ color: '#f0f4f8' }}>{form.tier === 'elite' ? '1.5' : '1.0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8896a8', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span>Email</span><span style={{ color: '#f0f4f8' }}>{form.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontWeight: 700 }}>Total due today</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: '#c9a84c' }}>{selectedTier?.price}</span>
              </div>
            </div>

            {payError && (
              <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16, lineHeight: 1.5 }}>
                {payError}
              </div>
            )}

            {payLoading ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <div style={{ fontSize: 38, marginBottom: 14 }}>⏳</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Setting up your account…</div>
                <div style={{ fontSize: 13, color: '#8896a8', marginTop: 6 }}>Do not close this tab. This takes a few seconds.</div>
              </div>
            ) : (
              <div id="paypal-button-container" style={{ minHeight: 50 }} />
            )}

            {!payLoading && (
              <div style={{ marginTop: 14 }}>
                <button onClick={() => setStep(3)} style={backBtn}>← Back</button>
              </div>
            )}

            <p style={{ fontSize: 12, color: '#4a5568', textAlign: 'center', marginTop: 20, lineHeight: 1.7 }}>
              By completing payment you agree to our Terms of Service.<br />
              Billed monthly. Cancel anytime by contacting support.
            </p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#4a5568', margin: 0 }}>© 2026 Zidni. All rights reserved.</p>
      </div>
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8896a8', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}{required && <span style={{ color: '#c9a84c', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>{error}</div>}
    </div>
  );
}

const headStyle = { fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' };
const subStyle  = { fontSize: 14, color: '#8896a8', marginBottom: 32, lineHeight: 1.6 };

const primaryBtn = (disabled) => ({
  flex: 1, padding: '14px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
  background: disabled ? 'rgba(201,168,76,0.3)' : 'linear-gradient(135deg,#c9a84c,#e8c96a)',
  color: disabled ? 'rgba(5,13,26,0.5)' : '#050d1a',
  border: 'none', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: '-0.2px',
});

const backBtn = {
  padding: '14px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, color: '#8896a8', cursor: 'pointer',
};

const inputSt = (hasError) => ({
  width: '100%', padding: '12px 14px', fontSize: 14, fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.03)', color: '#f0f4f8', outline: 'none',
  border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
  borderRadius: 10,
});
