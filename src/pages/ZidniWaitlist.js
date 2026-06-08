import React, { useState } from 'react';
import axios from 'axios';

const EARNINGS_TABLE = [
  { month: 'Month 1',  low: 80,    high: 200   },
  { month: 'Month 2',  low: 150,   high: 380   },
  { month: 'Month 3',  low: 280,   high: 650   },
  { month: 'Month 4',  low: 420,   high: 900   },
  { month: 'Month 5',  low: 580,   high: 1200  },
  { month: 'Month 6',  low: 750,   high: 1600  },
  { month: 'Month 7',  low: 950,   high: 2100  },
  { month: 'Month 8',  low: 1200,  high: 2700  },
  { month: 'Month 9',  low: 1500,  high: 3400  },
  { month: 'Month 10', low: 1850,  high: 4200  },
  { month: 'Month 11', low: 2200,  high: 5100  },
  { month: 'Month 12', low: 2600,  high: 6000  },
];

const STEPS = [
  {
    num: '01',
    title: 'We build your income streams',
    desc: 'Our team sets up your Etsy shop, Gumroad store, KDP account, Pinterest presence, affiliate programs, and Shopify store — all fully optimized from day one.',
  },
  {
    num: '02',
    title: 'AI runs everything daily',
    desc: 'Our AI system publishes products, writes listings, pins content, manages promotions, and optimizes every channel automatically — 24 hours a day.',
  },
  {
    num: '03',
    title: 'You earn every month automatically',
    desc: 'Revenue from all 6 streams is pooled, tracked, and paid out to you every month. No work required. Just watch your balance grow.',
  },
];

export default function ZidniWaitlist() {
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', country: '', niche: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.niche) { setError('Email and niche are required.'); return; }
    setError('');
    setLoading(true);
    try {
      await axios.post('http://localhost:3001/zidni/waitlist', form);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', fontFamily: "'Inter', sans-serif", color: '#f0f4f8' }}>

      {/* ── NAV ── */}
      <div style={{ borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#050d1a', fontWeight: 800, fontSize: 14 }}>Z</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>Zidni</span>
          </div>
          <a href="#join" style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', color: '#050d1a', fontWeight: 700, fontSize: 13, padding: '8px 20px', borderRadius: 8, textDecoration: 'none' }}>
            Join Waitlist
          </a>
        </div>
      </div>

      {/* ── HERO ── */}
      <div style={{ background: 'linear-gradient(180deg,#0a1628 0%,#050d1a 100%)', padding: '96px 24px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '5px 16px', fontSize: 12, fontWeight: 600, color: '#c9a84c', letterSpacing: '0.5px', marginBottom: 28, textTransform: 'uppercase' }}>
          Now Accepting Applications
        </div>
        <h1 style={{ fontSize: 'clamp(32px,6vw,64px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1px', maxWidth: 820, margin: '0 auto 20px' }}>
          Join Zidni — Earn From{' '}
          <span style={{ background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            6 Automated Income Streams
          </span>
        </h1>
        <p style={{ fontSize: 'clamp(16px,2.5vw,20px)', color: '#8896a8', maxWidth: 560, margin: '0 auto 48px', lineHeight: 1.6 }}>
          We build and run your complete income system. You just earn.
        </p>

        {/* ── STREAM BADGES ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 56 }}>
          {['Etsy', 'Gumroad', 'KDP', 'Pinterest', 'Affiliate', 'Shopify'].map(s => (
            <span key={s} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#c9a84c' }}>{s}</span>
          ))}
        </div>

        {/* ── HERO STATS ── */}
        <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[['6', 'Income Streams'], ['$2,600+', 'Avg Month 12'], ['100%', 'Automated']].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#c9a84c' }}>{val}</div>
              <div style={{ fontSize: 12, color: '#8896a8', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#c9a84c', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>How It Works</div>
          <h2 style={{ fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800, letterSpacing: '-0.5px' }}>Three steps to passive income</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {STEPS.map(s => (
            <div key={s.num} style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: 'rgba(201,168,76,0.2)', lineHeight: 1, marginBottom: 20 }}>{s.num}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, lineHeight: 1.3 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: '#8896a8', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── EARNINGS TABLE ── */}
      <div style={{ padding: '0 24px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ background: '#0a1628', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#c9a84c', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 8 }}>Earnings Projection</div>
            <h2 style={{ fontSize: 24, fontWeight: 800 }}>Realistic monthly earnings over 12 months</h2>
            <p style={{ fontSize: 13, color: '#8896a8', marginTop: 6 }}>Combined across all 6 income streams. Range depends on niche and tier.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Month', 'Conservative', 'Optimistic', 'Progress'].map(h => (
                    <th key={h} style={{ padding: '14px 24px', textAlign: h === 'Month' ? 'left' : h === 'Progress' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: '#8896a8', letterSpacing: '1px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EARNINGS_TABLE.map((row, i) => (
                  <tr key={row.month} style={{ borderBottom: i < EARNINGS_TABLE.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '14px 24px', fontWeight: 600 }}>{row.month}</td>
                    <td style={{ padding: '14px 24px', textAlign: 'right', color: '#8896a8' }}>${row.low.toLocaleString()}</td>
                    <td style={{ padding: '14px 24px', textAlign: 'right', color: '#c9a84c', fontWeight: 700 }}>${row.high.toLocaleString()}</td>
                    <td style={{ padding: '14px 24px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6, width: '100%', minWidth: 80 }}>
                        <div style={{ background: 'linear-gradient(90deg,#c9a84c,#e8c96a)', borderRadius: 4, height: '100%', width: `${(row.high / 6000) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── WAITLIST FORM ── */}
      <div id="join" style={{ padding: '0 24px 100px', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#c9a84c', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>Limited Spots</div>
          <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 12 }}>Secure your spot on the waitlist</h2>
          <p style={{ fontSize: 14, color: '#8896a8', lineHeight: 1.6 }}>We onboard a limited number of members per month. Apply now to be first in line.</p>
        </div>

        {done ? (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginBottom: 10 }}>You're on the list!</h3>
            <p style={{ fontSize: 14, color: '#8896a8', lineHeight: 1.6 }}>We'll reach out soon with next steps. Check your inbox for a confirmation email.</p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background: '#0a1628', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 20, padding: 40 }}>
            <div style={{ display: 'grid', gap: 16 }}>

              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Email Address <span style={{ color: '#c9a84c' }}>*</span></label>
                <input style={inputStyle} type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>

              <div>
                <label style={labelStyle}>WhatsApp Number</label>
                <input style={inputStyle} placeholder="+1 234 567 8900" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Country</label>
                <input style={inputStyle} placeholder="United States" value={form.country} onChange={e => set('country', e.target.value)} />
              </div>

              <div>
                <label style={labelStyle}>Which niche interests you? <span style={{ color: '#c9a84c' }}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  {['Personal Finance', 'AI Tools'].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('niche', n)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: form.niche === n ? '2px solid #c9a84c' : '1px solid rgba(255,255,255,0.08)',
                        background: form.niche === n ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                        color: form.niche === n ? '#c9a84c' : '#8896a8',
                        fontWeight: form.niche === n ? 700 : 500,
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '16px',
                  background: loading ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg,#c9a84c,#e8c96a)',
                  color: '#050d1a',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                  fontFamily: 'inherit',
                  letterSpacing: '-0.2px',
                }}
              >
                {loading ? 'Submitting…' : 'Join the Waitlist →'}
              </button>

              <p style={{ fontSize: 12, color: '#4a5568', textAlign: 'center', marginTop: 4 }}>
                No spam. We'll only contact you about your application.
              </p>
            </div>
          </form>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#4a5568' }}>© 2026 Zidni. All rights reserved.</p>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#8896a8',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  marginBottom: 8,
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 14,
  color: '#f0f4f8',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.15s',
};
