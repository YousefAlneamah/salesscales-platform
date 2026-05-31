import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3001';

const ROADMAP = {
  shipped: [
    { id: 'ai-team', title: 'AI Team (6 members)', desc: 'Hussain, Hassan, Ali, Mahdi, Fatima, and Zainab — your full AI revenue team.' },
    { id: 'sequences', title: 'Email & SMS Sequences', desc: 'Automated multi-step campaigns triggered by customer behaviour.' },
    { id: 'shopify-oauth', title: 'Shopify OAuth Integration', desc: 'One-click store connection with live order and revenue data.' },
    { id: 'client-portal', title: 'Client Portal', desc: 'Branded dashboard for each client to see their results and approve content.' },
    { id: 'knowledge-base', title: 'Knowledge Base & RAG', desc: 'Train your AI team with PDFs, YouTube content, and brand documents.' },
  ],
  in_progress: [
    { id: 'whatsapp-automation', title: 'WhatsApp Automation', desc: 'Full WhatsApp Business API integration for automated messaging sequences.' },
    { id: 'meta-ads-ai', title: 'Meta Ads AI Optimization', desc: 'AI-driven ad creative suggestions based on your top-performing emails.' },
    { id: 'mobile-app', title: 'Mobile App', desc: 'iOS and Android app for managing your AI revenue system on the go.' },
    { id: 'ab-testing', title: 'A/B Testing Engine', desc: 'Automatic winner selection for sequence variants based on open and click rates.' },
    { id: 'client-success', title: 'Client Success Dashboard', desc: 'ROI tracking, completion rates, and health scores for every client.' },
  ],
  coming_soon: [
    { id: 'tiktok-ads', title: 'TikTok Ads Integration', desc: 'Connect TikTok ad accounts and let the AI optimize spend automatically.' },
    { id: 'voice-outbound', title: 'AI Outbound Calling', desc: 'Automated sales calls powered by ElevenLabs conversational AI.' },
    { id: 'agency-white-label', title: 'Full White-Label Mode', desc: 'Run Sales Scales under your own brand with custom domain and branding.' },
    { id: 'team-collab', title: 'Team Collaboration', desc: 'Invite team members with role-based permissions and audit logs.' },
    { id: 'predictive-churn', title: 'Predictive Churn Prevention', desc: 'AI identifies at-risk customers before they leave and triggers retention sequences.' },
  ],
};

const COL_CONFIG = {
  shipped:    { label: 'Shipped',     color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', icon: '✓' },
  in_progress:{ label: 'In Progress', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', icon: '⟳' },
  coming_soon:{ label: 'Coming Soon', color: '#c9a84c', bg: '#fffbeb', border: '#fde68a', icon: '◎' },
};

export default function PublicRoadmap() {
  const [votes, setVotes] = useState({});
  const [voted, setVoted] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('roadmap_voted') || '[]')); } catch { return new Set(); }
  });
  const [voting, setVoting] = useState(null);

  useEffect(() => {
    axios.get(`${API}/roadmap/votes`)
      .then(r => setVotes(r.data.votes || {}))
      .catch(() => {});
  }, []);

  const handleVote = async (featureId) => {
    if (voted.has(featureId) || voting) return;
    setVoting(featureId);
    try {
      const r = await axios.post(`${API}/roadmap/vote`, { feature_id: featureId });
      setVotes(prev => ({ ...prev, [featureId]: r.data.votes }));
      const next = new Set(voted); next.add(featureId);
      setVoted(next);
      localStorage.setItem('roadmap_voted', JSON.stringify([...next]));
    } catch {}
    setVoting(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f3f8', fontFamily: 'DM Sans, Arial, sans-serif' }}>
      <div style={{ background: '#0a1628', padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: '#c9a84c', fontWeight: 800, letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '12px' }}>Sales Scales</div>
        <div style={{ fontSize: '32px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>Product Roadmap</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', maxWidth: '500px', margin: '0 auto' }}>
          See what we've built, what's in progress, and what's coming next. Vote for features you want to see.
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '24px' }}>
        {['shipped', 'in_progress', 'coming_soon'].map(col => {
          const cfg = COL_CONFIG[col];
          const items = ROADMAP[col];
          return (
            <div key={col}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 16px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '10px' }}>
                <span style={{ fontWeight: 800, fontSize: '16px', color: cfg.color }}>{cfg.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '14px', color: cfg.color }}>{cfg.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: cfg.color, fontWeight: 600 }}>{items.length}</span>
              </div>
              {items.map(item => (
                <div key={item.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0a1628', marginBottom: '6px' }}>{item.title}</div>
                  <div style={{ fontSize: '12px', color: '#8896a8', lineHeight: '1.6', marginBottom: '12px' }}>{item.desc}</div>
                  {col !== 'shipped' && (
                    <button
                      onClick={() => handleVote(item.id)}
                      disabled={voted.has(item.id) || voting === item.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: voted.has(item.id) ? 'default' : 'pointer', border: `1px solid ${voted.has(item.id) ? cfg.border : '#e4e9f0'}`, background: voted.has(item.id) ? cfg.bg : 'white', color: voted.has(item.id) ? cfg.color : '#8896a8', transition: 'all 0.15s' }}
                    >
                      <span>{voted.has(item.id) ? '▲' : '△'}</span>
                      <span>{votes[item.id] || 0} vote{(votes[item.id] || 0) !== 1 ? 's' : ''}</span>
                      {voted.has(item.id) && <span style={{ fontSize: '10px' }}>Voted</span>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ background: '#070e1c', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} Sales Scales · <a href="/" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Back to home</a>
        </div>
      </div>
    </div>
  );
}
