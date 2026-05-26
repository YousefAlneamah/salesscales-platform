import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { supabase } from '../supabase';

const TONES = [
  { id: 'friendly', label: 'Friendly', desc: 'Warm & approachable', icon: '😊' },
  { id: 'professional', label: 'Professional', desc: 'Polished & formal', icon: '💼' },
  { id: 'casual', label: 'Casual', desc: 'Relaxed & fun', icon: '👋' },
  { id: 'enthusiastic', label: 'Enthusiastic', desc: 'Energetic & positive', icon: '🔥' },
];

const inputStyle = {
  width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px',
  padding: '10px 14px', fontSize: '12px', color: '#0a1628',
  outline: 'none', background: 'white', boxSizing: 'border-box',
  fontFamily: 'DM Sans, sans-serif'
};

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{children}</div>
);

const ToneSelector = ({ value, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
    {TONES.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)}
        style={{ padding: '12px 8px', borderRadius: '8px', border: `1px solid ${value === t.id ? '#c9a84c' : '#e4e9f0'}`, cursor: 'pointer', textAlign: 'center', background: value === t.id ? '#fffdf5' : 'white', outline: value === t.id ? '2px solid rgba(201,168,76,0.25)' : 'none', transition: 'all 0.15s' }}>
        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{t.icon}</div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: value === t.id ? '#c9a84c' : '#0a1628', marginBottom: '2px' }}>{t.label}</div>
        <div style={{ fontSize: '10px', color: '#8896a8' }}>{t.desc}</div>
      </button>
    ))}
  </div>
);

const EnableToggle = ({ enabled, onChange, label, sub }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: enabled ? '#ecfdf5' : '#f8fafc', borderRadius: '8px', border: `1px solid ${enabled ? '#a7f3d0' : '#e4e9f0'}`, marginBottom: '20px' }}>
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{label}</div>
      <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '2px' }}>{sub || (enabled ? 'Replies are being sent automatically' : 'Auto-replies are disabled')}</div>
    </div>
    <button onClick={() => onChange(!enabled)}
      style={{ padding: '7px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '11px', background: enabled ? '#059669' : '#8896a8', color: 'white', transition: 'all 0.2s' }}>
      {enabled ? '● Active' : '○ Paused'}
    </button>
  </div>
);

const platformColor = (channel) => {
  const ch = (channel || '').toLowerCase();
  if (ch.includes('instagram')) return { bg: '#fce7f3', color: '#db2777', border: '#fbcfe8' };
  if (ch.includes('facebook')) return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
  return { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' };
};

const platformLabel = (channel) => {
  const ch = (channel || '').toLowerCase();
  if (ch.includes('instagram')) return '📸 Instagram';
  if (ch.includes('facebook')) return '📘 Facebook';
  return '💬 Social';
};

export default function SocialAutomation() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const [instagram, setInstagram] = useState(() =>
    JSON.parse(localStorage.getItem('ss_ig') || '{"connected":false,"pageId":"","accessToken":"","pageName":""}')
  );
  const [facebook, setFacebook] = useState(() =>
    JSON.parse(localStorage.getItem('ss_fb') || '{"connected":false,"pageId":"","accessToken":"","pageName":""}')
  );
  const [dmConfig, setDmConfig] = useState(() =>
    JSON.parse(localStorage.getItem('ss_dm_cfg') || '{"enabled":true,"tone":"friendly","customReply":"","workflowId":"","enrollContacts":true}')
  );
  const [commentConfig, setCommentConfig] = useState(() =>
    JSON.parse(localStorage.getItem('ss_comment_cfg') || '{"enabled":true,"tone":"friendly","customReply":""}')
  );

  const [connectForm, setConnectForm] = useState({ show: false, platform: null, pageId: '', accessToken: '', pageName: '' });
  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const BASE_URL = `${API_BASE}`;
  const VERIFY_TOKEN = 'salesscales_meta_verify';

  useEffect(() => {
    fetchWorkflows();
    fetchFeed();
  }, []);

  const fetchWorkflows = async () => {
    const { data } = await supabase.from('workflows').select('id, name, trigger_type, status').eq('status', 'active');
    setWorkflows(data || []);
  };

  const fetchFeed = async () => {
    setFeedLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .in('channel', ['instagram', 'facebook', 'Instagram', 'Facebook', 'instagram_comment', 'facebook_comment'])
      .order('created_at', { ascending: false })
      .limit(60);
    setFeed(data || []);
    setFeedLoading(false);
  };

  const pushServerConfig = async (patch) => {
    try {
      await fetch(`${BASE_URL}/social/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
    } catch {}
  };

  const connectAccount = async () => {
    const { platform, pageId, accessToken, pageName } = connectForm;
    if (!pageId || !accessToken) { setResult({ ok: false, message: 'Please fill in Page ID and Access Token' }); return; }
    const acct = { connected: true, pageId, accessToken, pageName: pageName || pageId };
    if (platform === 'instagram') {
      localStorage.setItem('ss_ig', JSON.stringify(acct));
      setInstagram(acct);
      await pushServerConfig({ instagram: { pageId, accessToken } });
    } else {
      localStorage.setItem('ss_fb', JSON.stringify(acct));
      setFacebook(acct);
      await pushServerConfig({ facebook: { pageId, accessToken } });
    }
    setConnectForm({ show: false, platform: null, pageId: '', accessToken: '', pageName: '' });
    setResult({ ok: true, message: `${platform === 'instagram' ? 'Instagram' : 'Facebook'} connected successfully` });
  };

  const disconnectAccount = async (platform) => {
    const empty = { connected: false, pageId: '', accessToken: '', pageName: '' };
    if (platform === 'instagram') { localStorage.setItem('ss_ig', JSON.stringify(empty)); setInstagram(empty); }
    else { localStorage.setItem('ss_fb', JSON.stringify(empty)); setFacebook(empty); }
    await pushServerConfig({ [platform]: { pageId: null, accessToken: null } });
  };

  const saveDmConfig = async () => {
    setSaving(true);
    localStorage.setItem('ss_dm_cfg', JSON.stringify(dmConfig));
    await pushServerConfig({ dm: dmConfig });
    setResult({ ok: true, message: 'DM automation settings saved' });
    setSaving(false);
  };

  const saveCommentConfig = async () => {
    setSaving(true);
    localStorage.setItem('ss_comment_cfg', JSON.stringify(commentConfig));
    await pushServerConfig({ comments: commentConfig });
    setResult({ ok: true, message: 'Comment automation settings saved' });
    setSaving(false);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setResult({ ok: true, message: `${label} copied to clipboard` });
  };

  const dmsIn = feed.filter(m => ['instagram', 'facebook', 'Instagram', 'Facebook'].includes(m.channel) && m.direction === 'inbound').length;
  const dmsOut = feed.filter(m => ['instagram', 'facebook', 'Instagram', 'Facebook'].includes(m.channel) && m.direction === 'outbound').length;
  const commentsIn = feed.filter(m => (m.channel || '').toLowerCase().includes('comment') && m.direction === 'inbound').length;
  const commentsOut = feed.filter(m => (m.channel || '').toLowerCase().includes('comment') && m.direction === 'outbound').length;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'dm', label: 'DM Auto-Reply', icon: '💬' },
    { id: 'comments', label: 'Comment Replies', icon: '💭' },
    { id: 'feed', label: 'Live Feed', icon: '📡' },
    { id: 'accounts', label: 'Accounts & Webhooks', icon: '🔗' },
  ];

  return (
    <div>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>📱</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Social Media Automation</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Instagram & Facebook · AI-Powered DM & Comment Replies · Phase 7</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: instagram.connected ? 'rgba(219,39,119,0.15)' : 'rgba(255,255,255,0.06)', color: instagram.connected ? '#f9a8d4' : 'rgba(255,255,255,0.35)', border: `1px solid ${instagram.connected ? 'rgba(219,39,119,0.3)' : 'rgba(255,255,255,0.1)'}`, fontWeight: 600 }}>
              📸 {instagram.connected ? '● Live' : '○ Instagram'}
            </span>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: facebook.connected ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.06)', color: facebook.connected ? '#93c5fd' : 'rgba(255,255,255,0.35)', border: `1px solid ${facebook.connected ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.1)'}`, fontWeight: 600 }}>
              📘 {facebook.connected ? '● Live' : '○ Facebook'}
            </span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '14px', lineHeight: '1.6' }}>
          Every DM and comment gets an instant AI reply. People who message your page are automatically enrolled in follow-up sequences — turning social engagement into revenue.
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'DMs Received', value: dmsIn, sub: 'across platforms', color: '#c9a84c' },
          { label: 'DMs Auto-Replied', value: dmsOut, sub: 'handled by AI', color: '#10b981' },
          { label: 'Comments Replied', value: commentsOut, sub: `of ${commentsIn} received`, color: '#3b82f6' },
          { label: 'DM Automation', value: dmConfig.enabled ? 'ON' : 'OFF', sub: commentConfig.enabled ? 'Comments ON' : 'Comments OFF', color: dmConfig.enabled ? '#10b981' : '#8896a8' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${s.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: s.color, fontWeight: 500 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#0a1628' : 'white', color: activeTab === tab.id ? 'white' : '#8896a8', borderColor: activeTab === tab.id ? '#0a1628' : '#e4e9f0', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* RESULT BANNER */}
      {result && (
        <div style={{ background: result.ok ? '#ecfdf5' : '#fef2f2', border: `1px solid ${result.ok ? '#a7f3d0' : '#fecaca'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: result.ok ? '#059669' : '#dc2626', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{result.ok ? '✓' : '✗'} {result.message}</span>
          <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* CONNECT MODAL */}
      {connectForm.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '460px', maxWidth: '90vw', boxShadow: '0 24px 60px rgba(10,22,40,0.35)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Connect {connectForm.platform === 'instagram' ? '📸 Instagram' : '📘 Facebook'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Link Your Page</div>
            <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '20px', lineHeight: '1.7' }}>
              Get your Page ID and Page Access Token from the <span style={{ color: '#3b82f6' }}>Meta Developer Console</span>.
              The token needs <code style={{ background: '#f8fafc', padding: '1px 5px', borderRadius: '3px', fontSize: '11px' }}>pages_messaging</code> and <code style={{ background: '#f8fafc', padding: '1px 5px', borderRadius: '3px', fontSize: '11px' }}>instagram_manage_messages</code> permissions.
            </div>
            <div style={{ marginBottom: '14px' }}>
              <FieldLabel>Page Name (display only)</FieldLabel>
              <input type="text" value={connectForm.pageName} onChange={e => setConnectForm(p => ({ ...p, pageName: e.target.value }))} placeholder="e.g. My Brand" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <FieldLabel>Page ID</FieldLabel>
              <input type="text" value={connectForm.pageId} onChange={e => setConnectForm(p => ({ ...p, pageId: e.target.value }))} placeholder="e.g. 123456789012345" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <FieldLabel>Page Access Token</FieldLabel>
              <textarea value={connectForm.accessToken} onChange={e => setConnectForm(p => ({ ...p, accessToken: e.target.value }))}
                placeholder="EAAGm0PX4ZBh..." rows={3} style={{ ...inputStyle, resize: 'none', lineHeight: '1.5' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={connectAccount}
                style={{ flex: 1, background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Connect Page
              </button>
              <button onClick={() => setConnectForm({ show: false, platform: null, pageId: '', accessToken: '', pageName: '' })}
                style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '8px', padding: '11px 16px', fontSize: '12px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DASHBOARD TAB ─── */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Instagram Card */}
          {[
            { platform: 'instagram', acct: instagram, icon: '📸', name: 'Instagram', grad: 'linear-gradient(135deg,#f43f5e,#ec4899,#a855f7)', pill: { bg: '#fce7f3', color: '#db2777', border: '#fbcfe8' } },
            { platform: 'facebook', acct: facebook, icon: '📘', name: 'Facebook', grad: '#1877f2', pill: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' } },
          ].map(({ platform, acct, icon, name, grad, pill }) => (
            <div key={platform} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>{name}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628' }}>{acct.connected ? acct.pageName : 'Not connected'}</div>
                  </div>
                </div>
                {acct.connected
                  ? <span style={{ fontSize: '9px', padding: '4px 10px', borderRadius: '20px', background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`, fontWeight: 600 }}>● Live</span>
                  : <span style={{ fontSize: '9px', padding: '4px 10px', borderRadius: '20px', background: '#f8fafc', color: '#8896a8', border: '1px solid #e4e9f0', fontWeight: 600 }}>○ Not Connected</span>
                }
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '14px' }}>
                {[
                  { label: 'DMs In', value: feed.filter(m => m.channel?.toLowerCase() === platform && m.direction === 'inbound').length },
                  { label: 'Replied', value: feed.filter(m => m.channel?.toLowerCase() === platform && m.direction === 'outbound').length },
                  { label: 'Comments', value: feed.filter(m => (m.channel || '').toLowerCase() === `${platform}_comment`).length },
                ].map(s => (
                  <div key={s.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0a1628' }}>{s.value}</div>
                    <div style={{ fontSize: '9px', color: '#8896a8' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {acct.connected ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setActiveTab('dm')} style={{ flex: 1, background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Configure →</button>
                  <button onClick={() => disconnectAccount(platform)} style={{ background: 'white', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '8px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Disconnect</button>
                </div>
              ) : (
                <button onClick={() => setConnectForm({ show: true, platform, pageId: '', accessToken: '', pageName: '' })}
                  style={{ width: '100%', background: grad, color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Connect {name} →
                </button>
              )}
            </div>
          ))}

          {/* DM Config summary */}
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>DM Auto-Reply</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>AI DM Replies</div>
              <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: dmConfig.enabled ? '#ecfdf5' : '#fffbeb', color: dmConfig.enabled ? '#059669' : '#d97706', border: `1px solid ${dmConfig.enabled ? '#a7f3d0' : '#fde68a'}` }}>
                {dmConfig.enabled ? '● Active' : '◉ Paused'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '6px' }}>Tone: <strong style={{ color: '#0a1628' }}>{dmConfig.tone}</strong></div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '14px' }}>Workflow: {dmConfig.workflowId ? <strong style={{ color: '#059669' }}>Configured</strong> : <span style={{ color: '#d97706' }}>Not set</span>}</div>
            <button onClick={() => setActiveTab('dm')} style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '7px', border: '1px solid #e4e9f0', background: 'white', cursor: 'pointer', color: '#0a1628', fontWeight: 600 }}>Configure →</button>
          </div>

          {/* Comment Config summary */}
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Comment Auto-Reply</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>AI Comment Replies</div>
              <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: commentConfig.enabled ? '#ecfdf5' : '#fffbeb', color: commentConfig.enabled ? '#059669' : '#d97706', border: `1px solid ${commentConfig.enabled ? '#a7f3d0' : '#fde68a'}` }}>
                {commentConfig.enabled ? '● Active' : '◉ Paused'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '14px' }}>Tone: <strong style={{ color: '#0a1628' }}>{commentConfig.tone}</strong></div>
            <button onClick={() => setActiveTab('comments')} style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '7px', border: '1px solid #e4e9f0', background: 'white', cursor: 'pointer', color: '#0a1628', fontWeight: 600 }}>Configure →</button>
          </div>
        </div>
      )}

      {/* ─── DM AUTO-REPLY TAB ─── */}
      {activeTab === 'dm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '20px' }}>DM Automation Settings</div>

            <EnableToggle enabled={dmConfig.enabled} onChange={v => setDmConfig(p => ({ ...p, enabled: v }))} label="DM Auto-Reply" />

            <div style={{ marginBottom: '20px' }}>
              <FieldLabel>Reply Tone</FieldLabel>
              <ToneSelector value={dmConfig.tone} onChange={v => setDmConfig(p => ({ ...p, tone: v }))} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <FieldLabel>Custom Reply Template (optional)</FieldLabel>
              <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '6px' }}>Leave blank to use AI-generated contextual replies. Fill in to always send this exact message.</div>
              <textarea value={dmConfig.customReply} onChange={e => setDmConfig(p => ({ ...p, customReply: e.target.value }))}
                placeholder="Hi! Thanks for reaching out. We'll get back to you shortly..."
                rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
            </div>

            <div style={{ borderTop: '1px solid #e4e9f0', paddingTop: '20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Workflow Enrollment</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <button onClick={() => setDmConfig(p => ({ ...p, enrollContacts: !p.enrollContacts }))}
                  style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', background: dmConfig.enrollContacts ? '#c9a84c' : '#e4e9f0', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '8px', background: 'white', position: 'absolute', top: '3px', left: dmConfig.enrollContacts ? '21px' : '3px', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>Auto-enroll DM senders in a workflow</div>
                  <div style={{ fontSize: '11px', color: '#8896a8' }}>Creates a contact and starts a sequence when someone messages your page</div>
                </div>
              </div>
              {dmConfig.enrollContacts && (
                <div>
                  <FieldLabel>Workflow to enroll in</FieldLabel>
                  <select value={dmConfig.workflowId} onChange={e => setDmConfig(p => ({ ...p, workflowId: e.target.value }))} style={{ ...inputStyle, background: 'white' }}>
                    <option value="">Select a workflow...</option>
                    {workflows.map(w => <option key={w.id} value={w.id}>{w.name} — {w.trigger_type}</option>)}
                  </select>
                  {workflows.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#d97706', marginTop: '6px' }}>⚠ No active workflows. Create one in Sequences first.</div>
                  )}
                </div>
              )}
            </div>

            <button onClick={saveDmConfig} disabled={saving}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : '💾 Save DM Settings'}
            </button>
          </div>

          {/* How it works */}
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>How DM Automation Works</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { icon: '💬', title: 'DM Received', desc: 'Someone sends a DM to your Instagram or Facebook page' },
                { icon: '🤖', title: 'AI Generates Reply', desc: `Claude AI crafts a ${dmConfig.tone} reply in under 2 seconds using context from the message` },
                { icon: '⚡', title: 'Instant Reply Sent', desc: 'Reply delivered automatically via the Meta Graph API' },
                { icon: '🎯', title: 'Contact Enrolled', desc: dmConfig.enrollContacts && dmConfig.workflowId ? `Contact created and enrolled in your selected workflow` : 'Enrollment is not configured — toggle it on above' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>Step {i + 1} — {s.title}</div>
                    <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '2px' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── COMMENT REPLIES TAB ─── */}
      {activeTab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '20px' }}>Comment Automation Settings</div>

            <EnableToggle enabled={commentConfig.enabled} onChange={v => setCommentConfig(p => ({ ...p, enabled: v }))} label="Comment Auto-Reply" sub={commentConfig.enabled ? 'Replies to all public comments automatically' : 'Auto-replies to comments are disabled'} />

            <div style={{ marginBottom: '20px' }}>
              <FieldLabel>Reply Tone</FieldLabel>
              <ToneSelector value={commentConfig.tone} onChange={v => setCommentConfig(p => ({ ...p, tone: v }))} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <FieldLabel>Custom Reply Template (optional)</FieldLabel>
              <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '6px' }}>Leave blank for AI-generated contextual replies. Fill in to always send this fixed message.</div>
              <textarea value={commentConfig.customReply} onChange={e => setCommentConfig(p => ({ ...p, customReply: e.target.value }))}
                placeholder="Thanks for the comment! ❤️ DM us for more details."
                rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
            </div>

            <div style={{ background: '#fffdf5', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>💡 Pro tip</div>
              <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: '1.7' }}>
                Push comment conversations into DMs — the reply rate from social comments is low but DM conversion is high. Try: <em>"Great question! 💬 DM us and we'll sort you out personally."</em>
              </div>
            </div>

            <button onClick={saveCommentConfig} disabled={saving}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : '💾 Save Comment Settings'}
            </button>
          </div>

          {/* Tone examples */}
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>AI Reply Examples by Tone</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { tone: 'Friendly 😊', comment: 'How much does it cost?', reply: "Great question! We have options for every budget. DM us and we'll find the perfect fit for you! 😊" },
                { tone: 'Professional 💼', comment: 'What are your shipping times?', reply: 'Standard shipping is 3–5 business days. Express options are available. Please contact us for full details.' },
                { tone: 'Enthusiastic 🔥', comment: 'Is this still available?', reply: "YES! 🙌 And you're going to love it. Slide into our DMs and let's make it happen!" },
              ].map((ex, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 700, marginBottom: '8px' }}>{ex.tone}</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#8896a8', flexShrink: 0, paddingTop: '1px' }}>Comment:</span>
                    <span style={{ fontSize: '11px', color: '#4a5568', fontStyle: 'italic' }}>"{ex.comment}"</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#059669', flexShrink: 0, paddingTop: '1px' }}>AI Reply:</span>
                    <span style={{ fontSize: '11px', color: '#0a1628' }}>"{ex.reply}"</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── LIVE FEED TAB ─── */}
      {activeTab === 'feed' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Real-Time Activity</div>
              <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{feed.length} interactions logged</div>
            </div>
            <button onClick={fetchFeed} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '8px 16px', fontSize: '11px', cursor: 'pointer', color: '#0a1628', fontWeight: 500 }}>
              ↻ Refresh
            </button>
          </div>
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0a1628' }}>
                  {['Platform', 'Type', 'From', 'Message', 'Direction', 'Time'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '9px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feedLoading ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>Loading...</td></tr>
                ) : feed.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>📡</div>
                    <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '4px', fontSize: '13px' }}>No social activity yet</div>
                    <div style={{ fontSize: '11px', color: '#8896a8' }}>DMs and comments will appear here once webhooks are live</div>
                  </td></tr>
                ) : feed.map((msg, i) => {
                  const ch = (msg.channel || '').toLowerCase();
                  const isComment = ch.includes('comment');
                  const pc = platformColor(msg.channel);
                  return (
                    <tr key={msg.id} style={{ borderBottom: '1px solid #f0f3f8', background: i % 2 === 0 ? 'white' : '#fafbfd' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '9px', padding: '3px 9px', borderRadius: '20px', fontWeight: 600, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>
                          {platformLabel(msg.channel)}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '10px', color: '#8896a8' }}>{isComment ? '💭 Comment' : '💬 DM'}</td>
                      <td style={{ padding: '11px 14px', fontSize: '12px', color: '#0a1628', fontWeight: 500, maxWidth: '120px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.sender_name || '—'}</div>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '11px', color: '#4a5568', maxWidth: '280px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.content}</div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: '9px', padding: '3px 9px', borderRadius: '20px', fontWeight: 600,
                          background: msg.direction === 'outbound' ? '#ecfdf5' : '#f0f9ff',
                          color: msg.direction === 'outbound' ? '#059669' : '#0369a1',
                          border: `1px solid ${msg.direction === 'outbound' ? '#a7f3d0' : '#bae6fd'}` }}>
                          {msg.direction === 'outbound' ? '↗ AI Reply' : '↙ Received'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '11px', color: '#8896a8', fontFamily: 'DM Mono, monospace' }}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── ACCOUNTS & WEBHOOKS TAB ─── */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { platform: 'instagram', acct: instagram, icon: '📸', name: 'Instagram', grad: 'linear-gradient(135deg,#f43f5e,#ec4899,#a855f7)', pill: { bg: '#fce7f3', color: '#db2777', border: '#fbcfe8' } },
            { platform: 'facebook', acct: facebook, icon: '📘', name: 'Facebook', grad: '#1877f2', pill: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' } },
          ].map(({ platform, acct, icon, name, grad, pill }) => (
            <div key={platform} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{icon}</div>
                <div>
                  <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1px', textTransform: 'uppercase' }}>{name} Account</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a1628' }}>{acct.connected ? acct.pageName : 'Not Connected'}</div>
                </div>
                {acct.connected
                  ? <span style={{ marginLeft: 'auto', fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`, fontWeight: 600 }}>● Connected</span>
                  : <span style={{ marginLeft: 'auto', fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: '#f8fafc', color: '#8896a8', border: '1px solid #e4e9f0', fontWeight: 600 }}>Not Connected</span>
                }
              </div>
              {acct.connected ? (
                <div>
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '3px' }}>Page ID</div>
                      <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#0a1628' }}>{acct.pageId}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '3px' }}>Access Token</div>
                      <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#0a1628' }}>{acct.accessToken.substring(0, 22)}...</div>
                    </div>
                  </div>
                  <button onClick={() => disconnectAccount(platform)}
                    style={{ background: 'white', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Disconnect {name}
                  </button>
                </div>
              ) : (
                <button onClick={() => setConnectForm({ show: true, platform, pageId: '', accessToken: '', pageName: '' })}
                  style={{ background: grad, color: 'white', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Connect {name} →
                </button>
              )}
            </div>
          ))}

          {/* Webhook config */}
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Webhook Configuration</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {[
                { label: 'Instagram Webhook URL', value: `${BASE_URL}/social/instagram-webhook` },
                { label: 'Facebook Webhook URL', value: `${BASE_URL}/social/facebook-webhook` },
                { label: 'Verify Token', value: VERIFY_TOKEN },
              ].map(item => (
                <div key={item.label}>
                  <FieldLabel>{item.label}</FieldLabel>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 14px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#4a5568', wordBreak: 'break-all' }}>
                      {item.value}
                    </div>
                    <button onClick={() => copyToClipboard(item.value, item.label)}
                      style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 16px', fontSize: '11px', cursor: 'pointer', color: '#8896a8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: '#0a1628', borderRadius: '10px', padding: '16px 18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '10px' }}>Setup Instructions</div>
              <ol style={{ margin: 0, padding: '0 0 0 16px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', lineHeight: '2' }}>
                <li>Go to <span style={{ color: '#c9a84c' }}>developers.facebook.com</span> → Your App → Webhooks</li>
                <li>Subscribe to <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>messages</code> and <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>feed</code> topics for your page</li>
                <li>Paste the Webhook URL and Verify Token above into the Meta console</li>
                <li>Set <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>WEBHOOK_BASE_URL</code> in your .env for production (use ngrok in dev)</li>
                <li>Connect Instagram and Facebook accounts above with a Page Access Token</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
