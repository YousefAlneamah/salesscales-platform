import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';

const CATEGORIES = [
  { key: 'email',           label: 'Email Marketing',    icon: 'ti-mail',             maxScore: 20 },
  { key: 'cartAbandonment', label: 'Cart Abandonment',   icon: 'ti-shopping-cart-off', maxScore: 20 },
  { key: 'sms',             label: 'SMS Marketing',       icon: 'ti-message',          maxScore: 20 },
  { key: 'social',          label: 'Social Media',        icon: 'ti-social',           maxScore: 20 },
  { key: 'ads',             label: 'Paid Advertising',    icon: 'ti-ad',               maxScore: 20 },
];

const LOADING_STEPS = [
  'Analyzing email marketing setup...',
  'Checking cart abandonment flows...',
  'Reviewing SMS & WhatsApp strategy...',
  'Auditing social media presence...',
  'Evaluating paid advertising signals...',
  'Calculating revenue opportunity score...',
];

const NICHES = [
  '', 'Fashion & Apparel', 'Bags & Accessories', 'Beauty & Skincare', 'Health & Wellness',
  'Home & Lifestyle', 'Jewellery', 'Footwear', 'Supplements', 'Pet Products',
  'Baby & Kids', 'Sports & Fitness', 'Electronics', 'Food & Beverage', 'Other',
];

function scoreLevel(score) {
  if (score >= 16) return { label: 'Strong',  color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' };
  if (score >= 11) return { label: 'Fair',    color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' };
  if (score >= 6)  return { label: 'Weak',    color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  return              { label: 'Missing', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
}

function gradeStyle(grade) {
  if (!grade) return { color: '#8896a8' };
  const g = grade.toUpperCase();
  if (g === 'A+' || g === 'A') return { color: '#10b981' };
  if (g === 'B')               return { color: '#3b82f6' };
  if (g === 'C')               return { color: '#d97706' };
  return                              { color: '#dc2626' };
}

function ScoreBar({ score, max = 20 }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const lvl = scoreLevel(score);
  return (
    <div style={{ marginTop: '8px' }}>
      <div className="pbar">
        <div className="pfill" style={{ width: `${pct}%`, background: lvl.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function ToolPill({ label }) {
  return (
    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#f0f3f8', border: '1px solid #e4e9f0', color: '#4a5568', fontWeight: 500 }}>
      {label}
    </span>
  );
}

export default function AuditTool() {
  const [url, setUrl]           = useState('');
  const [niche, setNiche]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [report, setReport]     = useState(null);
  const [error, setError]       = useState(null);
  const [copied, setCopied]     = useState(false);
  const [history, setHistory]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('ss_audit_history') || '[]'); } catch { return []; }
  });
  const stepTimer = useRef(null);

  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      stepTimer.current = setInterval(() => {
        setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
      }, 1600);
    } else {
      clearInterval(stepTimer.current);
    }
    return () => clearInterval(stepTimer.current);
  }, [loading]);

  const runAudit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setReport(null);
    setError(null);

    const prompt = `STORE AUDIT REQUEST

Store URL: ${trimmed}${niche ? `\nNiche / Industry: ${niche}` : ''}

You are conducting a comprehensive ecommerce revenue audit. Analyze this store across 5 marketing categories based on what you know about the brand, their industry, and common patterns for stores of this type.

Return ONLY a valid JSON object — no markdown, no explanation, no text before or after the JSON:

{
  "storeName": "brand name extracted from URL or domain",
  "niche": "detected niche/industry",
  "email": {
    "score": 0,
    "findings": "What email marketing setup they likely have — popup, tools like Klaviyo/Mailchimp, welcome series, etc.",
    "tools": ["Tool1", "Tool2"],
    "recommendation": "Specific actionable recommendation for Sales Scales to offer"
  },
  "cartAbandonment": {
    "score": 0,
    "findings": "Whether they are recovering abandoned carts, what sequence if any, estimated recovery rate",
    "tools": [],
    "recommendation": "Specific recommendation"
  },
  "sms": {
    "score": 0,
    "findings": "SMS marketing presence — Postscript, Attentive, Klaviyo SMS, or absent",
    "tools": [],
    "recommendation": "Specific recommendation"
  },
  "social": {
    "score": 0,
    "findings": "Instagram, Facebook, TikTok presence — follower scale, content quality, DM automation",
    "tools": ["Instagram", "TikTok"],
    "recommendation": "Specific recommendation"
  },
  "ads": {
    "score": 0,
    "findings": "Facebook/Instagram ads, Google Shopping, TikTok ads — spend signals, creative quality",
    "tools": ["Meta Ads"],
    "recommendation": "Specific recommendation"
  },
  "totalScore": 0,
  "grade": "B",
  "topOpportunity": "The single biggest revenue gap — be specific with estimated monthly dollar amount",
  "pitchAngle": "A personalised cold outreach message Yousef can send to this store owner. Reference their brand, their gaps, and what Sales Scales can specifically solve. 3-4 sentences.",
  "estimatedMonthlyLift": "$X,000 - $Y,000",
  "urgencyFlag": "One sentence on why they should act now"
}

Scoring guide per category (max 20 each, total max 100):
- 0-5: Missing (no evidence of this at all)
- 6-10: Weak (basic setup, major gaps)
- 11-15: Fair (present but underoptimised)
- 16-20: Strong (well implemented)

Grade: 0-40=F, 41-55=D, 56-65=C, 66-75=B, 76-85=A, 86-100=A+

Be specific, be direct, think like a revenue strategist. This audit is used by Sales Scales to pitch and close this prospect.`;

    try {
      const { data } = await axios.post(`${API_BASE}/hussain`, { prompt, clientId: null });
      if (!data.result) throw new Error('No response from Hussain');

      // Strip markdown code fences, then extract outermost JSON object
      const cleaned = data.result
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Hussain returned a response but no JSON was found. Try running the audit again.');

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // Last-resort: try to fix truncated JSON by closing open braces
        const raw = jsonMatch[0];
        const opens = (raw.match(/\{/g) || []).length;
        const closes = (raw.match(/\}/g) || []).length;
        const padded = raw + '}'.repeat(Math.max(0, opens - closes));
        try {
          parsed = JSON.parse(padded);
        } catch {
          throw new Error('The audit response contained malformed JSON. Please try again — Hussain occasionally formats responses differently.');
        }
      }

      // Ensure minimum viable shape — fill missing fields with safe defaults
      parsed.totalScore = typeof parsed.totalScore === 'number' ? parsed.totalScore
        : ['email','cartAbandonment','sms','social','ads'].reduce((s, k) => s + (parsed[k]?.score || 0), 0);
      parsed.grade = parsed.grade || (parsed.totalScore >= 86 ? 'A+' : parsed.totalScore >= 76 ? 'A' : parsed.totalScore >= 66 ? 'B' : parsed.totalScore >= 56 ? 'C' : parsed.totalScore >= 41 ? 'D' : 'F');
      parsed.storeName = parsed.storeName || trimmed;

      setReport(parsed);

      const entry = { url: trimmed, storeName: parsed.storeName, totalScore: parsed.totalScore, grade: parsed.grade, date: new Date().toLocaleDateString('en-GB') };
      const updated = [entry, ...history.filter(h => h.url !== trimmed)].slice(0, 5);
      setHistory(updated);
      localStorage.setItem('ss_audit_history', JSON.stringify(updated));
    } catch (e) {
      setError(e.message || 'Audit failed. Check that the server is running.');
    }
    setLoading(false);
  };

  const copyPitch = () => {
    if (!report?.pitchAngle) return;
    const text = report.pitchAngle;
    const confirm = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(confirm).catch(() => fallbackCopy(text, confirm));
    } else {
      fallbackCopy(text, confirm);
    }
  };

  const fallbackCopy = (text, onSuccess) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); onSuccess(); } catch {}
    document.body.removeChild(ta);
  };

  const reset = () => { setReport(null); setError(null); setUrl(''); setNiche(''); };

  const inputStyle = {
    width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 14px',
    fontSize: '13px', color: '#0a1628', outline: 'none', fontFamily: 'DM Sans, sans-serif',
    boxSizing: 'border-box', background: 'white',
  };

  // ── INPUT SCREEN ───────────────────────────────────────────
  if (!loading && !report && !error) {
    return (
      <div>
        {/* HEADER */}
        <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '28px 32px', marginBottom: '24px', border: '1px solid rgba(201,168,76,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-search" style={{ fontSize: '22px', color: '#c9a84c' }} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>Store Audit Tool</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Powered by Hussain AI · Intelligence & Strategy</div>
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.65', maxWidth: '640px' }}>
            Enter any Shopify store URL. Hussain will audit their email setup, cart recovery, SMS, social presence, and ad spend — then generate a personalised pitch for you to close them.
          </div>
        </div>

        {/* FORM */}
        <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '20px' }}>
            New Audit
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Store URL</div>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runAudit()}
                placeholder="e.g. luuxbags.com or fashionstore.myshopify.com"
                style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Niche (optional)</div>
              <select value={niche} onChange={e => setNiche(e.target.value)} style={{ ...inputStyle, background: 'white' }}>
                {NICHES.map(n => <option key={n} value={n}>{n || 'Auto-detect'}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={runAudit}
              disabled={!url.trim()}
              style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '11px 28px', fontSize: '13px', fontWeight: 700, cursor: url.trim() ? 'pointer' : 'not-allowed', opacity: url.trim() ? 1 : 0.5, fontFamily: 'DM Sans, sans-serif' }}
            >
              <i className="ti ti-search" style={{ marginRight: '6px', fontSize: '13px' }} aria-hidden="true" />
              Run Full Audit
            </button>
            <div style={{ fontSize: '11px', color: '#8896a8' }}>Analyzes 5 categories · Generates a personalised pitch · ~15 seconds</div>
          </div>
        </div>

        {/* WHAT WE CHECK */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {CATEGORIES.map(cat => (
            <div key={cat.key} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
              <i className={`ti ${cat.icon}`} style={{ fontSize: '20px', color: '#c9a84c', display: 'block', marginBottom: '6px' }} aria-hidden="true" />
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628' }}>{cat.label}</div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '2px' }}>scored /20</div>
            </div>
          ))}
        </div>

        {/* HISTORY */}
        {history.length > 0 && (
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0a1628', marginBottom: '14px' }}>Recent Audits</div>
            <div className="table-wrap">
              <div className="table-header">
                <div className="th" style={{ flex: 2 }}>Store</div>
                <div className="th" style={{ flex: '0 0 80px', textAlign: 'center' }}>Score</div>
                <div className="th" style={{ flex: '0 0 60px', textAlign: 'center' }}>Grade</div>
                <div className="th" style={{ flex: '0 0 90px' }}>Date</div>
                <div className="th" style={{ flex: '0 0 80px' }}></div>
              </div>
              {history.map((h, i) => (
                <div key={i} className="table-row">
                  <div className="td" style={{ flex: 2 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{h.storeName || h.url}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>{h.url}</div>
                  </div>
                  <div className="td" style={{ flex: '0 0 80px', textAlign: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{h.totalScore}/100</span>
                  </div>
                  <div className="td" style={{ flex: '0 0 60px', textAlign: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, ...gradeStyle(h.grade) }}>{h.grade}</span>
                  </div>
                  <div className="td" style={{ flex: '0 0 90px', fontSize: '11px', color: '#8896a8' }}>{h.date}</div>
                  <div className="td" style={{ flex: '0 0 80px' }}>
                    <button onClick={() => setUrl(h.url)} style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e4e9f0', background: 'white', cursor: 'pointer', color: '#0a1628', fontFamily: 'DM Sans, sans-serif' }}>
                      Re-run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LOADING SCREEN ─────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ width: '420px' }}>
          <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(201,168,76,0.2)', marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <i className="ti ti-search" style={{ fontSize: '22px', color: '#c9a84c' }} aria-hidden="true" />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Hussain is auditing...</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace' }}>{url}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e4e9f0' }}>
            {LOADING_STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: i < LOADING_STEPS.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: i < loadingStep ? '#ecfdf5' : i === loadingStep ? 'rgba(201,168,76,0.15)' : '#f8fafc', border: `1px solid ${i < loadingStep ? '#a7f3d0' : i === loadingStep ? 'rgba(201,168,76,0.4)' : '#e4e9f0'}` }}>
                  {i < loadingStep
                    ? <i className="ti ti-check" style={{ fontSize: '11px', color: '#10b981' }} aria-hidden="true" />
                    : i === loadingStep
                      ? <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#c9a84c' }} />
                      : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e4e9f0' }} />
                  }
                </div>
                <div style={{ fontSize: '12px', color: i <= loadingStep ? '#0a1628' : '#8896a8', fontWeight: i === loadingStep ? 600 : 400, transition: 'color 0.3s' }}>
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR SCREEN ───────────────────────────────────────────
  if (error) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: '32px', color: '#dc2626', display: 'block', marginBottom: '12px' }} aria-hidden="true" />
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Audit failed</div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>{error}</div>
        <button onClick={reset} style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Try Again
        </button>
      </div>
    );
  }

  // ── REPORT SCREEN ──────────────────────────────────────────
  if (!report) return null;

  const totalPct = Math.min(100, report.totalScore || 0);
  const gs = gradeStyle(report.grade);

  return (
    <div>
      {/* REPORT HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px 28px', marginBottom: '20px', border: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Audit Report</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'white', marginBottom: '2px' }}>{report.storeName || url}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace' }}>{url}</div>
            {report.niche && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c', fontWeight: 600 }}>{report.niche}</span>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Opportunity Score</div>
              <div style={{ fontSize: '40px', fontWeight: 800, color: 'white', lineHeight: 1 }}>{report.totalScore}<span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)' }}>/100</span></div>
            </div>
            <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: `${gs.color}22`, border: `2px solid ${gs.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: gs.color }}>{report.grade}</span>
            </div>
          </div>
        </div>

        {/* TOTAL SCORE BAR */}
        <div style={{ marginTop: '16px' }}>
          <div className="pbar" style={{ height: '6px', background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: '100%', width: `${totalPct}%`, background: `linear-gradient(90deg, #c9a84c, ${gs.color})`, borderRadius: '3px', transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
            <span>0 — Poor</span><span>50 — Average</span><span>100 — Excellent</span>
          </div>
        </div>
      </div>

      {/* ESTIMATED LIFT BANNER */}
      {report.estimatedMonthlyLift && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderLeft: '3px solid #c9a84c', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(10,22,40,0.05)' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Estimated Monthly Revenue Lift</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#c9a84c' }}>{report.estimatedMonthlyLift}</div>
          </div>
          {report.urgencyFlag && (
            <div style={{ maxWidth: '400px', fontSize: '12px', color: '#4a5568', lineHeight: '1.6', textAlign: 'right' }}>
              <i className="ti ti-bolt" style={{ color: '#c9a84c', marginRight: '4px' }} aria-hidden="true" />
              {report.urgencyFlag}
            </div>
          )}
        </div>
      )}

      {/* CATEGORY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {CATEGORIES.map(cat => {
          const catData = report[cat.key] || {};
          const score = catData.score ?? 0;
          const lvl = scoreLevel(score);
          return (
            <div key={cat.key} style={{ background: 'white', border: '1px solid #e4e9f0', borderTop: `2px solid ${lvl.color}`, borderRadius: '10px', padding: '14px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: lvl.bg, border: `1px solid ${lvl.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${cat.icon}`} style={{ fontSize: '14px', color: lvl.color }} aria-hidden="true" />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: lvl.color, lineHeight: 1 }}>{score}</div>
                  <div style={{ fontSize: '9px', color: '#8896a8' }}>/ 20</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '2px' }}>{cat.label}</div>
              <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}`, fontWeight: 600 }}>{lvl.label}</span>
              <ScoreBar score={score} />
            </div>
          );
        })}
      </div>

      {/* DETAILED FINDINGS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {CATEGORIES.map(cat => {
          const catData = report[cat.key] || {};
          const score = catData.score ?? 0;
          const lvl = scoreLevel(score);
          const tools = Array.isArray(catData.tools) ? catData.tools : [];
          return (
            <div key={cat.key} className="card" style={{ borderLeft: `3px solid ${lvl.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: lvl.bg, border: `1px solid ${lvl.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`ti ${cat.icon}`} style={{ fontSize: '16px', color: lvl.color }} aria-hidden="true" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{cat.label}</div>
                    {tools.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {tools.map(t => <ToolPill key={t} label={t} />)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ fontSize: '9px', padding: '3px 9px', borderRadius: '20px', background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}`, fontWeight: 700 }}>{lvl.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: lvl.color }}>{score}</span>
                    <span style={{ fontSize: '10px', color: '#8896a8' }}>/20</span>
                  </div>
                </div>
              </div>

              {catData.findings && (
                <div style={{ fontSize: '12px', color: '#4a5568', lineHeight: '1.65', marginBottom: '10px' }}>
                  {catData.findings}
                </div>
              )}

              {catData.recommendation && (
                <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                    <i className="ti ti-bulb" style={{ marginRight: '4px' }} aria-hidden="true" />
                    Recommendation
                  </div>
                  <div style={{ fontSize: '12px', color: '#0a1628', lineHeight: '1.6' }}>{catData.recommendation}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* TOP OPPORTUNITY + PITCH */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {report.topOpportunity && (
          <div className="card" style={{ borderTop: '2px solid #c9a84c' }}>
            <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
              <i className="ti ti-target" style={{ marginRight: '5px' }} aria-hidden="true" />
              Top Revenue Opportunity
            </div>
            <div style={{ fontSize: '13px', color: '#0a1628', lineHeight: '1.7' }}>{report.topOpportunity}</div>
          </div>
        )}
        {report.pitchAngle && (
          <div className="card" style={{ borderTop: '2px solid #0a1628' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>
                <i className="ti ti-message-2" style={{ marginRight: '5px' }} aria-hidden="true" />
                Personalised Pitch
              </div>
              <button onClick={copyPitch} style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e4e9f0', background: copied ? '#ecfdf5' : 'white', color: copied ? '#10b981' : '#0a1628', cursor: 'pointer', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#4a5568', lineHeight: '1.75', fontStyle: 'italic' }}>"{report.pitchAngle}"</div>
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={reset} style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          <i className="ti ti-search" style={{ marginRight: '6px' }} aria-hidden="true" />
          New Audit
        </button>
        <button onClick={copyPitch} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '11px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#0a1628', fontFamily: 'DM Sans, sans-serif' }}>
          {copied ? '✓ Pitch Copied' : 'Copy Pitch Message'}
        </button>
      </div>
    </div>
  );
}
