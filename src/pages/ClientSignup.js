import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const TIERS = [
  { id: 'starter', label: 'Starter', price: '$997/mo', desc: 'Email & SMS automation, AI team, 3 sequences, monthly reports' },
  { id: 'growth',  label: 'Growth',  price: '$1,997/mo', desc: 'Everything in Starter + WhatsApp, Klaviyo, unlimited sequences, HubSpot sync' },
  { id: 'scale',   label: 'Scale',   price: '$3,997/mo', desc: 'Everything in Growth + voice AI, Shopify live data, dedicated account management' },
];

const inputStyle = {
  width: '100%', border: '1.5px solid #e4e9f0', borderRadius: '10px',
  padding: '11px 14px', fontSize: '13px', color: '#0a1628', outline: 'none',
  fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box', background: '#fafbfc',
};

const labelStyle = {
  display: 'block', fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px',
  fontWeight: 700, textTransform: 'uppercase', marginBottom: '7px',
};

export default function ClientSignup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', niche: '', tier: 'starter' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Business name, email, and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await axios.post(`${API_BASE}/clients/onboard`, {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        niche: form.niche.trim() || null,
        tier: form.tier,
      });
      setSuccess(true);
    } catch (e) {
      setError(e.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', fontSize: '28px' }}>
            ✓
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '14px' }}>
            You're in, {form.name.split(' ')[0]}.
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.8', marginBottom: '28px' }}>
            Your Sales Scales account has been created and a welcome email with your login details has been sent to <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{form.email}</strong>.
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px 24px', textAlign: 'left', marginBottom: '24px' }}>
            <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Getting Started</div>
            {['Log in at salesscales.com using your email and password', 'Complete your 4-step onboarding questionnaire', 'Connect your Shopify store for contact sync', 'Your AI team (Hussain, Zainab, Mahdi, Ali, Hassan, Fatima) is ready'].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#c9a84c', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.6' }}>{step}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { window.location.pathname = '/'; }}
            style={{ background: '#c9a84c', border: 'none', borderRadius: '10px', padding: '13px 32px', fontSize: '13px', fontWeight: 700, color: '#0a1628', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            Go to Login →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '4px', color: 'white', marginBottom: '6px' }}>SALES SCALES</div>
          <div style={{ width: '32px', height: '2px', background: 'linear-gradient(90deg, #c9a84c, transparent)', borderRadius: '1px', margin: '0 auto 16px' }} />
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>Start your AI revenue system</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Takes 2 minutes · No credit card required to start</div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div>
              <label style={labelStyle}>Business Name</label>
              <input style={inputStyle} placeholder="e.g. Apex Gear Store" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Email Address</label>
              <input style={inputStyle} type="email" placeholder="you@yourbrand.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" placeholder="At least 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Your Niche <span style={{ color: '#c4c4c4', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input style={inputStyle} placeholder="e.g. Fitness supplements, pet accessories, skincare" value={form.niche} onChange={e => set('niche', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Service Plan</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TIERS.map(t => (
                  <div
                    key={t.id}
                    onClick={() => set('tier', t.id)}
                    style={{ padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', border: `1.5px solid ${form.tier === t.id ? '#c9a84c' : '#e4e9f0'}`, background: form.tier === t.id ? 'rgba(201,168,76,0.04)' : 'white', transition: 'all 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '3px' }}>{t.label}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8', lineHeight: '1.5' }}>{t.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: form.tier === t.id ? '#c9a84c' : '#4a5568' }}>{t.price}</div>
                      {form.tier === t.id && (
                        <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 700, letterSpacing: '1px', marginTop: '3px' }}>SELECTED</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ width: '100%', padding: '13px', background: submitting ? '#e4e9f0' : '#c9a84c', color: submitting ? '#8896a8' : '#0a1628', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s' }}
            >
              {submitting ? 'Creating your account...' : 'Create My Account →'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '11px', color: '#8896a8' }}>
              Already have an account?{' '}
              <span onClick={() => { window.location.pathname = '/'; }} style={{ color: '#c9a84c', fontWeight: 600, cursor: 'pointer' }}>
                Sign in
              </span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', borderTop: '1px solid #e4e9f0', padding: '14px 32px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
            {['AI-powered sequences', 'All 6 AI team members', 'No setup fee'].map(f => (
              <div key={f} style={{ fontSize: '10px', color: '#8896a8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
