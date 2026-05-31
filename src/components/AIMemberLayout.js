import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const MEMBER_COLORS = {
  hussain: '#3b82f6',
  hassan:  '#10b981',
  ali:     '#f59e0b',
  mahdi:   '#c9a84c',
  fatima:  '#ef4444',
  zainab:  '#8b5cf6',
};

const MEMBER_TRAITS = {
  hussain: ['Strategic', 'Data-driven', 'Direct'],
  hassan:  ['Outgoing', 'Persuasive', 'Hunter'],
  ali:     ['Closer', 'NEPQ', 'High-ticket'],
  mahdi:   ['Creative', 'Human', 'Storyteller'],
  fatima:  ['Systematic', 'Precise', 'Operational'],
  zainab:  ['Warm', 'Trusted', 'Retentive'],
};

const relTime = (d) => {
  const diff = Date.now() - new Date(d);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${days}d ago`;
};

export function AIMemberLayout({ memberSlug, role, description, memberStats, recentActivity, children }) {
  const accent = MEMBER_COLORS[memberSlug] || '#c9a84c';
  const traits = MEMBER_TRAITS[memberSlug] || [];
  const displayName = memberSlug.charAt(0).toUpperCase() + memberSlug.slice(1);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatResult, setChatResult] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const sendChat = async () => {
    if (!chatPrompt.trim()) return;
    setChatLoading(true);
    setChatResult('');
    try {
      const { data } = await axios.post(`${API_BASE}/${memberSlug}`, { prompt: chatPrompt });
      setChatResult(data.result || '');
    } catch {
      setChatResult('Failed to get response. Please try again.');
    }
    setChatLoading(false);
  };

  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, #0a1628 0%, #142840 100%)`, borderRadius: 20, padding: '28px 32px', marginBottom: 24, border: `1px solid ${accent}30`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 280, height: '100%', background: `radial-gradient(ellipse at top right, ${accent}12, transparent 65%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Large avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}33, ${accent}11)`, border: `2px solid ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: accent }}>
              {displayName[0]}
            </div>
            {/* Pulsing active dot */}
            <div style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: '#10b981', border: '2px solid #0a1628', boxShadow: '0 0 8px #10b981' }}>
              <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '2px solid #10b981', opacity: 0.4, animation: 'pulse 2s infinite' }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#f0f4f8', letterSpacing: '-0.5px' }}>{displayName}</div>
              <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)', fontWeight: 700, fontFamily: 'DM Mono,monospace', letterSpacing: 1 }}>● ACTIVE</span>
            </div>
            <div style={{ fontSize: 13, color: accent, fontWeight: 600, marginBottom: 8 }}>{role}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {traits.map(t => (
                <span key={t} style={{ fontSize: 10, padding: '4px 12px', borderRadius: 20, background: `${accent}14`, color: accent, border: `1px solid ${accent}30`, fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => { setChatOpen(true); setChatResult(''); setChatPrompt(''); }}
              style={{ background: accent, color: '#0a1628', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-message-bolt" />
              Chat with {displayName}
            </button>
          </div>
        </div>
        {description && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 16, lineHeight: 1.7, maxWidth: 700 }}>{description}</div>
        )}
      </div>

      {/* ── STATS ROW ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Briefings This Week', value: memberStats?.weekActions ?? 0, sub: 'actions sent', color: accent },
          { label: 'All-Time Briefings',  value: memberStats?.allTimeActions ?? 0, sub: 'total actions', color: '#8b5cf6' },
          { label: 'Recent Activity',     value: recentActivity?.length ?? 0, sub: 'last 10 briefings', color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0f1f35', border: `1px solid ${s.color}20`, borderTop: `3px solid ${s.color}`, borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#f0f4f8', lineHeight: 1, letterSpacing: '-1.5px', marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── RECENT ACTIONS ─────────────────────────────────── */}
      {recentActivity && recentActivity.length > 0 && (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 16 }}>Recent Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentActivity.map((b, i) => {
              const pc = b.priority === 'urgent' ? '#ef4444' : b.priority === 'high' ? '#c9a84c' : '#8896a8';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', borderLeft: `3px solid ${accent}55` }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="ti ti-send" style={{ fontSize: 13, color: accent }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f4f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.subject}</div>
                    <div style={{ fontSize: 10, color: '#4a5568' }}>→ {b.to_member}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 8, padding: '2px 8px', borderRadius: 20, background: `${pc}15`, color: pc, border: `1px solid ${pc}30`, fontWeight: 700, fontFamily: 'DM Mono,monospace' }}>{b.priority || 'normal'}</span>
                    <span style={{ fontSize: 10, color: '#4a5568' }}>{relTime(b.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CHILDREN (existing tabs/content) ────────────────── */}
      {children}

      {/* ── CHAT MODAL ─────────────────────────────────────── */}
      {chatOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1f35', borderRadius: 16, padding: 28, width: 560, maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', border: `1px solid ${accent}30` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 8, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 4 }}>Direct Message</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4f8' }}>Chat with {displayName}</div>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 22 }}>×</button>
            </div>
            <textarea rows={4} value={chatPrompt} onChange={e => setChatPrompt(e.target.value)}
              placeholder={`Ask ${displayName} anything — they have full context of your platform…`}
              style={{ width: '100%', border: `1px solid ${accent}25`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f0f4f8', background: 'rgba(255,255,255,0.04)', outline: 'none', resize: 'vertical', fontFamily: 'Inter,sans-serif', boxSizing: 'border-box', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={sendChat} disabled={chatLoading || !chatPrompt.trim()}
                style={{ background: accent, color: '#0a1628', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', flex: 1 }}>
                {chatLoading ? `${displayName} is thinking…` : `Send to ${displayName} →`}
              </button>
              <button onClick={() => setChatOpen(false)}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#8896a8', borderRadius: 10, padding: '10px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Cancel
              </button>
            </div>
            {chatResult && (
              <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}20`, borderRadius: 12, padding: '16px 18px', fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto' }}>
                {chatResult}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
