import React, { useState } from 'react';
import { supabase } from '../supabase';
import { API_BASE } from '../config';

const TOTAL_STEPS = 5;

const REVENUE_RANGES = ['Under $10K/mo', '$10K–$50K/mo', '$50K–$100K/mo', '$100K–$500K/mo', 'Over $500K/mo'];
const AOV_RANGES = ['Under $30', '$30–$75', '$75–$150', '$150–$300', 'Over $300'];
const BRAND_VOICES = ['Professional & formal', 'Friendly & conversational', 'Bold & direct', 'Luxury & exclusive', 'Educational & informative', 'Fun & playful'];
const CHALLENGES = [
  'Low conversion rate', 'Cart abandonment', 'Not enough traffic',
  'Email deliverability', 'Customer retention / churn',
  'Scaling ad spend profitably', 'Growing my contact list',
];
const TOOLS = [
  'Klaviyo', 'Mailchimp', 'Omnisend', 'ActiveCampaign',
  'Postscript (SMS)', 'Attentive (SMS)', 'Privy (Popups)', 'OptiMonk (Popups)',
  'Google Ads', 'Facebook / Instagram Ads', 'TikTok Ads',
  'Yotpo / Reviews.io', 'Gorgias', 'Zendesk',
];

const STEP_TITLES = ['Your Store', 'Your Brand', 'Your Stack', 'Your Goals', 'Connect Your Store'];
const STEP_DESCS = [
  'Start with the basics — we use this to personalise your AI system.',
  'Help our AI team write and speak in your exact brand voice.',
  'Tell us what tools you use so we build around your existing stack.',
  'What does a successful 90 days look like for your store?',
  'Connect Shopify so your AI team can sync orders and recover carts automatically.',
];

const fieldStyle = {
  width: '100%',
  border: '1.5px solid #e4e9f0',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  color: '#0a1628',
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
  boxSizing: 'border-box',
  background: '#fafbfc',
};

const labelStyle = {
  display: 'block',
  fontSize: '9px',
  color: '#8896a8',
  letterSpacing: '1.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  marginBottom: '8px',
};

const pillBtn = (active) => ({
  padding: '8px 14px',
  borderRadius: '8px',
  border: `1.5px solid ${active ? '#c9a84c' : '#e4e9f0'}`,
  background: active ? 'rgba(201,168,76,0.09)' : 'white',
  color: active ? '#0a1628' : '#8896a8',
  fontSize: '12px',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
  transition: 'all 0.15s',
});

export default function ClientOnboardingFlow({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    store_url: '',
    monthly_revenue: '',
    average_order_value: '',
    main_products: '',
    brand_voice: '',
    target_customer: '',
    current_tools: [],
    main_competitors: '',
    biggest_challenge: '',
    goals: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [connectClicked, setConnectClicked] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleTool = (tool) =>
    setForm(f => ({
      ...f,
      current_tools: f.current_tools.includes(tool)
        ? f.current_tools.filter(t => t !== tool)
        : [...f.current_tools, tool],
    }));

  const handleStep1Continue = () => {
    // Record terms acceptance server-side (non-blocking — captures real IP)
    fetch(`${API_BASE}/auth/accept-terms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    }).catch(() => {});
    setStep(2);
  };

  const canNext = {
    1: !!(form.store_url && form.monthly_revenue && form.average_order_value && termsAccepted),
    2: !!(form.main_products && form.brand_voice && form.target_customer),
    3: true,
    4: !!(form.biggest_challenge && form.goals),
  };

  // Save questionnaire answers (without completing) and move to the connect step.
  const submitQuestionnaire = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase.from('client_onboarding').upsert([{
        client_id: user.clientId,
        store_url: form.store_url,
        monthly_revenue: form.monthly_revenue,
        average_order_value: form.average_order_value,
        main_products: form.main_products,
        brand_voice: form.brand_voice,
        target_customer: form.target_customer,
        current_tools: form.current_tools,
        main_competitors: form.main_competitors,
        biggest_challenge: form.biggest_challenge,
        goals: form.goals,
      }], { onConflict: 'client_id' });
      if (err) throw err;
      // Fire briefing to owner — non-blocking
      fetch(`${API_BASE}/team/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_member: 'zainab',
          to_member: 'yousef',
          subject: `New Client Onboarding Complete — ${user.clientName}`,
          content: `${user.clientName} has just completed their onboarding questionnaire. Here is a summary of what they filled in:\n\nStore URL: ${form.store_url}\nMonthly Revenue: ${form.monthly_revenue}\nAverage Order Value: ${form.average_order_value}\nMain Products: ${form.main_products}\nBrand Voice: ${form.brand_voice}\nTarget Customer: ${form.target_customer}\nCurrent Tools: ${form.current_tools.join(', ') || 'None selected'}\nMain Competitors: ${form.main_competitors || 'Not provided'}\nBiggest Challenge: ${form.biggest_challenge}\n90-Day Goals: ${form.goals}\n\nRecommended Next Steps:\n1. Review their brand voice and customise active sequences accordingly\n2. Set up a cart abandonment workflow matched to their AOV bracket (${form.average_order_value})\n3. Have Zainab schedule a welcome call to confirm expectations and introduce the AI team\n4. Connect their Shopify store to begin contact sync\n5. Tailor Hussain's weekly briefings to their niche and challenge (${form.biggest_challenge})`,
          priority: 'high',
          client_id: user.clientId,
        }),
      }).catch(() => {});
      setSaving(false);
      setStep(5);
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  const connectStore = () => {
    const shop = form.store_url.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!shop) { setError('Enter your Shopify store URL — e.g. luuxbags.myshopify.com'); return; }
    setError('');
    window.open(`${API_BASE}/shopify/install?shop=${encodeURIComponent(shop)}&clientId=${user.clientId}`, '_blank');
    setConnectClicked(true);
  };

  // Mark onboarding complete (after the connect step is shown) and open the dashboard.
  const finishOnboarding = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase.from('client_onboarding').upsert([{
        client_id: user.clientId,
        completed_at: new Date().toISOString(),
      }], { onConflict: 'client_id' });
      if (err) throw err;
      // Notify owner that the client is fully onboarded — non-blocking
      fetch(`${API_BASE}/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: user.clientId,
          client_name: user.clientName,
          shopify_connected: connectClicked,
        }),
      }).catch(() => {});
      setDone(true);
      setTimeout(() => onComplete(), 2800);
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  // ─── DONE SCREEN ─────────────────────────────────────────
  if (done) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', zIndex: 1000 }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'rgba(201,168,76,0.12)', border: '2px solid rgba(201,168,76,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 26px' }}>
            <i className="ti ti-check" style={{ fontSize: '32px', color: '#c9a84c' }} aria-hidden="true"></i>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '12px', letterSpacing: '-0.5px' }}>
            You're all set, {user.name.split(' ')[0]}.
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.8', maxWidth: '360px', margin: '0 auto' }}>
            Your AI Revenue System is now configured. Hussain, Hassan, Ali, Mahdi, Fatima, and Zainab are ready to work for your store.
          </div>
          <div style={{ marginTop: '24px', fontSize: '11px', color: 'rgba(201,168,76,0.5)' }}>Opening your dashboard...</div>
        </div>
      </div>
    );
  }

  // ─── FLOW ─────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', zIndex: 1000, padding: '20px', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: '18px', width: '100%', maxWidth: '590px', overflow: 'hidden', boxShadow: '0 32px 72px rgba(0,0,0,0.55)', margin: 'auto' }}>

        {/* TOP BAR */}
        <div style={{ background: '#0a1628', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '3px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>SALES SCALES</div>
            <div style={{ fontSize: '11px', color: '#c9a84c', fontWeight: 500 }}>Account Setup</div>
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            Step {step} of {TOTAL_STEPS}
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div style={{ display: 'flex', background: '#0a1628', gap: '3px', padding: '0 0 1px' }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: '3px', background: i < step ? '#c9a84c' : 'rgba(255,255,255,0.08)', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ padding: '32px 32px 28px' }}>
          {/* Step header */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '7px' }}>
              {STEP_TITLES[step - 1]}
            </div>
            <div style={{ fontSize: '21px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '7px' }}>
              {step === 1 && `Welcome, ${user.name.split(' ')[0]}.`}
              {step === 2 && 'Tell us about your brand.'}
              {step === 3 && "What's in your stack?"}
              {step === 4 && 'Define your success.'}
              {step === 5 && 'Connect your store.'}
            </div>
            <div style={{ fontSize: '12px', color: '#8896a8', lineHeight: '1.65' }}>{STEP_DESCS[step - 1]}</div>
          </div>

          {/* ─── STEP 1 ─── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Store URL</label>
                <input style={fieldStyle} placeholder="yourstore.com" value={form.store_url} onChange={e => set('store_url', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Monthly Revenue Range</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {REVENUE_RANGES.map(r => (
                    <button key={r} type="button" style={pillBtn(form.monthly_revenue === r)} onClick={() => set('monthly_revenue', r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Average Order Value</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {AOV_RANGES.map(r => (
                    <button key={r} type="button" style={pillBtn(form.average_order_value === r)} onClick={() => set('average_order_value', r)}>{r}</button>
                  ))}
                </div>
              </div>

              {/* TERMS & PRIVACY */}
              <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#4a5568', lineHeight: '1.7', marginBottom: '12px' }}>
                  Before proceeding, please review our legal documents:
                  <div style={{ marginTop: '6px', display: 'flex', gap: '16px' }}>
                    <a href="/terms" target="_blank" rel="noopener noreferrer"
                      style={{ color: '#c9a84c', fontWeight: 600, fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      📋 Terms of Service
                    </a>
                    <a href="/privacy" target="_blank" rel="noopener noreferrer"
                      style={{ color: '#c9a84c', fontWeight: 600, fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      🔒 Privacy Policy
                    </a>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#c9a84c', flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', color: '#0a1628', lineHeight: '1.6' }}>
                    I have read and agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#c9a84c', fontWeight: 600, textDecoration: 'none' }}>Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#c9a84c', fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</a>.
                    My acceptance is recorded with timestamp and IP address.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* ─── STEP 2 ─── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Main Products</label>
                <textarea style={{ ...fieldStyle, resize: 'none' }} rows={3} placeholder="e.g. Wireless earbuds, phone cases, and travel accessories" value={form.main_products} onChange={e => set('main_products', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Brand Voice</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {BRAND_VOICES.map(v => (
                    <button key={v} type="button" style={pillBtn(form.brand_voice === v)} onClick={() => set('brand_voice', v)}>{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Target Customer Profile</label>
                <textarea style={{ ...fieldStyle, resize: 'none' }} rows={3} placeholder="e.g. Tech-savvy millennials aged 25–40 who value quality and shop online regularly" value={form.target_customer} onChange={e => set('target_customer', e.target.value)} />
              </div>
            </div>
          )}

          {/* ─── STEP 3 ─── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Current Tools — select all that apply</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                  {TOOLS.map(tool => (
                    <button key={tool} type="button" style={pillBtn(form.current_tools.includes(tool))} onClick={() => toggleTool(tool)}>
                      {form.current_tools.includes(tool) && <span style={{ marginRight: '4px' }}>✓</span>}{tool}
                    </button>
                  ))}
                </div>
                {form.current_tools.length === 0 && (
                  <div style={{ fontSize: '11px', color: '#8896a8' }}>None selected — that's fine, skip ahead.</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Main Competitors</label>
                <textarea style={{ ...fieldStyle, resize: 'none' }} rows={3} placeholder="e.g. Anker, Beats, JLab — stores that sell similar products to yours" value={form.main_competitors} onChange={e => set('main_competitors', e.target.value)} />
              </div>
            </div>
          )}

          {/* ─── STEP 4 ─── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Biggest Challenge Right Now</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {CHALLENGES.map(c => (
                    <button key={c} type="button" style={pillBtn(form.biggest_challenge === c)} onClick={() => set('biggest_challenge', c)}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Your 90-Day Goal</label>
                <textarea style={{ ...fieldStyle, resize: 'none' }} rows={4} placeholder="e.g. Recover 15% of abandoned carts, grow my email list to 10,000, and add $30K/mo in AI-driven revenue..." value={form.goals} onChange={e => set('goals', e.target.value)} />
              </div>
            </div>
          )}

          {/* ─── STEP 5 — CONNECT YOUR STORE ─── */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Shopify Store URL</label>
                <input style={fieldStyle} placeholder="luuxbags.myshopify.com" value={form.store_url}
                  onChange={e => set('store_url', e.target.value)} onKeyDown={e => e.key === 'Enter' && connectStore()} />
              </div>
              <button type="button" onClick={connectStore}
                style={{ width: '100%', background: '#0a1628', color: 'white', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <i className="ti ti-brand-shopify" aria-hidden="true"></i> Connect Your Store
              </button>
              {connectClicked && (
                <div style={{ fontSize: '12px', color: '#059669', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px', lineHeight: 1.6 }}>
                  A Shopify authorization window has opened. Approve access there, then click Finish below.
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: 1.6 }}>
                Connecting lets your AI team pull live orders, revenue, and abandoned carts — and build cart recovery sequences automatically. You can also do this later from Settings.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px' }}>
              {error}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
            {step > 1 && step < 5 ? (
              <button type="button" onClick={() => setStep(s => s - 1)}
                style={{ background: 'none', border: '1.5px solid #e4e9f0', borderRadius: '10px', padding: '10px 20px', fontSize: '12px', color: '#8896a8', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
                ← Back
              </button>
            ) : step === 5 ? (
              <button type="button" onClick={finishOnboarding} disabled={saving}
                style={{ background: 'none', border: 'none', padding: '10px 4px', fontSize: '12px', color: '#8896a8', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, textDecoration: 'underline' }}>
                Skip for now
              </button>
            ) : <div />}

            {step < 4 ? (
              <button type="button" onClick={step === 1 ? handleStep1Continue : () => setStep(s => s + 1)} disabled={!canNext[step]}
                style={{ background: canNext[step] ? '#c9a84c' : '#e4e9f0', color: canNext[step] ? '#0a1628' : '#a0aec0', border: 'none', borderRadius: '10px', padding: '11px 26px', fontSize: '13px', fontWeight: 700, cursor: canNext[step] ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.2px', transition: 'all 0.15s' }}>
                Continue →
              </button>
            ) : step === 4 ? (
              <button type="button" onClick={submitQuestionnaire} disabled={!canNext[4] || saving}
                style={{ background: canNext[4] && !saving ? '#c9a84c' : '#e4e9f0', color: canNext[4] && !saving ? '#0a1628' : '#a0aec0', border: 'none', borderRadius: '10px', padding: '11px 26px', fontSize: '13px', fontWeight: 700, cursor: canNext[4] && !saving ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s' }}>
                {saving ? 'Saving...' : 'Continue →'}
              </button>
            ) : (
              <button type="button" onClick={finishOnboarding} disabled={saving}
                style={{ background: !saving ? '#c9a84c' : '#e4e9f0', color: !saving ? '#0a1628' : '#a0aec0', border: 'none', borderRadius: '10px', padding: '11px 26px', fontSize: '13px', fontWeight: 700, cursor: !saving ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s' }}>
                {saving ? 'Activating...' : 'Finish →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
