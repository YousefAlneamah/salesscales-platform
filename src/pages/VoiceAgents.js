import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { supabase } from '../supabase';

const DEFAULT_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah — Friendly Female' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel — Calm Female' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte — Professional Female' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria — Conversational Female' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam — Neutral Male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh — Deep Male' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger — Confident Male' },
];

export default function VoiceAgents() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [voices, setVoices] = useState(DEFAULT_VOICES);
  const [clients, setClients] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [testAgentTarget, setTestAgentTarget] = useState('inbound');

  const [inbound, setInbound] = useState({
    name: 'Sales Scales Receptionist',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    firstMessage: "Hi! Thanks for calling. I'm the AI assistant for Sales Scales. How can I help you today?",
    systemPrompt: "You are a professional sales receptionist for Sales Scales, an AI revenue system for ecommerce agencies. Be warm, professional, and helpful. Qualify the caller by asking about their business, current monthly revenue, and what they are trying to achieve. Book discovery calls for qualified leads. Keep all responses concise and conversational — this is a phone call.",
    status: 'active',
    agentId: localStorage.getItem('ss_inbound_agent_id') || null,
  });

  const [outbound, setOutbound] = useState({
    name: 'Cart Recovery Agent',
    voiceId: '9BWtsMINqrJLrRacOk9x',
    script: "Hi {{first_name}}, this is Maya calling from the team. I noticed you left some items in your cart recently and wanted to personally reach out. Do you have 2 minutes? I'd love to help you complete your order.",
    systemPrompt: "You are a friendly outbound sales agent recovering abandoned carts. Be warm, helpful, and concise. If the customer is interested, offer assistance with their purchase or a discount code. Never be pushy. If they say no, thank them politely and end the call.",
    trigger: 'abandoned_cart',
    status: 'paused',
    agentId: localStorage.getItem('ss_outbound_agent_id') || null,
    clientId: '',
  });

  const [callLogs] = useState([
    { id: 1, type: 'inbound', contact: 'Unknown Caller', phone: '+1 (555) 234-5678', duration: '4:12', status: 'qualified', date: '2m ago' },
    { id: 2, type: 'outbound', contact: 'Emma Wilson', phone: '+1 (555) 876-5432', duration: '2:38', status: 'no_answer', date: '18m ago' },
    { id: 3, type: 'outbound', contact: 'James Lee', phone: '+1 (555) 345-6789', duration: '6:44', status: 'booked', date: '1h ago' },
    { id: 4, type: 'inbound', contact: 'Unknown Caller', phone: '+1 (555) 901-2345', duration: '1:15', status: 'not_qualified', date: '2h ago' },
    { id: 5, type: 'outbound', contact: 'Priya Sharma', phone: '+1 (555) 567-8901', duration: '3:50', status: 'qualified', date: '3h ago' },
  ]);

  useEffect(() => {
    fetchClients();
    fetchVoices();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    setClients(data || []);
  };

  const fetchVoices = async () => {
    try {
      const res = await fetch(`${API_BASE}/voice-agent/voices`);
      const data = await res.json();
      if (data.voices && data.voices.length > 0) {
        setVoices(data.voices.map(v => ({ id: v.voice_id, name: v.name })));
      }
    } catch {
      // keep DEFAULT_VOICES
    }
  };

  const errStr = (data, fallback) => {
    const d = data.details || data.error || data.message;
    if (!d) return fallback;
    if (typeof d === 'string') return d;
    if (d.message && typeof d.message === 'string') return d.message;
    return JSON.stringify(d);
  };

  const saveAgent = async (type) => {
    setSaving(true);
    setTestResult(null);
    const cfg = type === 'inbound' ? inbound : outbound;
    try {
      const res = await fetch(`${API_BASE}/voice-agent/save-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: cfg.agentId,
          name: cfg.name,
          voiceId: cfg.voiceId,
          firstMessage: type === 'inbound' ? cfg.firstMessage : cfg.script,
          systemPrompt: cfg.systemPrompt,
        })
      });
      const data = await res.json();
      if (data.agentId) {
        const key = `ss_${type}_agent_id`;
        localStorage.setItem(key, data.agentId);
        if (type === 'inbound') setInbound(p => ({ ...p, agentId: data.agentId }));
        else setOutbound(p => ({ ...p, agentId: data.agentId }));
        setTestResult({ ok: true, message: `${type === 'inbound' ? 'Inbound' : 'Outbound'} agent saved. Agent ID: ${data.agentId}` });
      } else {
        setTestResult({ ok: false, message: errStr(data, 'Failed to save agent') });
      }
    } catch {
      setTestResult({ ok: false, message: 'Failed to connect to server.' });
    }
    setSaving(false);
  };

  const initiateTestCall = async (agentId) => {
    if (!testPhone) return;
    if (!agentId) { setTestResult({ ok: false, message: 'Save the agent first to enable test calls.' }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/voice-agent/outbound-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, agentId })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ ok: true, message: `Call initiated to ${testPhone}!${data.callId ? ` Call ID: ${data.callId}` : ''}` });
      } else {
        setTestResult({ ok: false, message: errStr(data, 'Failed to initiate call') });
      }
    } catch {
      setTestResult({ ok: false, message: 'Call failed — check ElevenLabs + Twilio configuration.' });
    }
    setTesting(false);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'inbound', label: 'Inbound Agent', icon: '📞' },
    { id: 'outbound', label: 'Outbound Calls', icon: '📤' },
    { id: 'logs', label: 'Call Logs', icon: '📋' },
  ];

  const agentBadge = (status) => status === 'active'
    ? { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)', label: '● Live' }
    : { bg: 'rgba(217,119,6,0.15)', color: '#d97706', border: 'rgba(217,119,6,0.3)', label: '◉ Paused' };

  const FieldLabel = ({ children }) => (
    <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{children}</div>
  );

  const inputStyle = { width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#0a1628', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' };
  const selectStyle = { ...inputStyle, background: 'white' };

  const StatusToggle = ({ status, onChange }) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      {['active', 'paused'].map(s => {
        const active = status === s;
        return (
          <button key={s} onClick={() => onChange(s)}
            style={{ padding: '8px 20px', borderRadius: '7px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
              background: active ? (s === 'active' ? '#ecfdf5' : '#fffbeb') : 'white',
              color: active ? (s === 'active' ? '#059669' : '#d97706') : '#8896a8',
              borderColor: active ? (s === 'active' ? '#a7f3d0' : '#fde68a') : '#e4e9f0' }}>
            {s === 'active' ? '● Active' : '◉ Paused'}
          </button>
        );
      })}
    </div>
  );

  const TestCallPanel = ({ agentId, label }) => (
    <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
      <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Test {label}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>Send a Test Call</div>
      <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px' }}>
        Enter a phone number and the agent will call it now. Requires ElevenLabs + Twilio phone number integration.
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)}
          placeholder="+1 (555) 000-0000"
          style={{ flex: 1, ...inputStyle }} />
        <button onClick={() => initiateTestCall(agentId)} disabled={testing || !testPhone}
          style={{ background: '#c9a84c', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', opacity: !testPhone ? 0.5 : 1 }}>
          {testing ? 'Calling...' : '📞 Test Call'}
        </button>
      </div>
      {!agentId && (
        <div style={{ fontSize: '11px', color: '#d97706', marginTop: '8px' }}>⚠ Save the agent first to enable test calls.</div>
      )}
    </div>
  );

  const inboundB = agentBadge(inbound.status);
  const outboundB = agentBadge(outbound.status);

  return (
    <div>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🎙</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Voice Agents</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Powered by ElevenLabs · Sales Scales Phase 6</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: inboundB.bg, color: inboundB.color, border: `1px solid ${inboundB.border}`, fontWeight: 600 }}>
              Inbound {inboundB.label}
            </span>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: outboundB.bg, color: outboundB.color, border: `1px solid ${outboundB.border}`, fontWeight: 600 }}>
              Outbound {outboundB.label}
            </span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '14px', lineHeight: '1.6' }}>
          AI voice agents that answer inbound calls and proactively call abandoned cart customers — all powered by ElevenLabs ultra-realistic voices.
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Calls', value: callLogs.length, sub: 'all time', color: '#c9a84c' },
          { label: 'Inbound', value: callLogs.filter(c => c.type === 'inbound').length, sub: 'calls answered', color: '#10b981' },
          { label: 'Outbound', value: callLogs.filter(c => c.type === 'outbound').length, sub: 'calls made', color: '#3b82f6' },
          { label: 'Booked', value: callLogs.filter(c => c.status === 'booked').length, sub: 'discovery calls', color: '#c9a84c' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${s.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: s.color, fontWeight: 500 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setTestResult(null); }}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#0a1628' : 'white', color: activeTab === tab.id ? 'white' : '#8896a8', borderColor: activeTab === tab.id ? '#0a1628' : '#e4e9f0', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* RESULT BANNER */}
      {testResult && (
        <div style={{ background: testResult.ok ? '#ecfdf5' : '#fef2f2', border: `1px solid ${testResult.ok ? '#a7f3d0' : '#fecaca'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: testResult.ok ? '#059669' : '#dc2626', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{testResult.ok ? '✓' : '✗'} {testResult.message}</span>
          <button onClick={() => setTestResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px' }}>×</button>
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Inbound card */}
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Inbound Agent</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a1628' }}>{inbound.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '9px', padding: '4px 10px', borderRadius: '20px', background: inboundB.bg, color: inboundB.color, border: `1px solid ${inboundB.border}`, fontWeight: 600 }}>
                  {inboundB.label}
                </span>
                <button onClick={() => setInbound(p => ({ ...p, status: p.status === 'active' ? 'paused' : 'active' }))}
                  style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e4e9f0', background: 'white', cursor: 'pointer', color: '#8896a8' }}>
                  Toggle
                </button>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '14px', lineHeight: '1.6' }}>
              Answers inbound calls 24/7 and qualifies leads automatically. Routes to human when needed.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'Calls', value: callLogs.filter(c => c.type === 'inbound').length },
                { label: 'Qualified', value: callLogs.filter(c => c.type === 'inbound' && c.status === 'qualified').length },
                { label: 'Booked', value: callLogs.filter(c => c.type === 'inbound' && c.status === 'booked').length },
              ].map(s => (
                <div key={s.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0a1628' }}>{s.value}</div>
                  <div style={{ fontSize: '9px', color: '#8896a8' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {inbound.agentId && (
              <div style={{ fontSize: '10px', color: '#8896a8', background: '#f8fafc', borderRadius: '6px', padding: '6px 10px', marginBottom: '12px', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}>
                ID: {inbound.agentId}
              </div>
            )}
            <button onClick={() => setActiveTab('inbound')}
              style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '7px', border: '1px solid #e4e9f0', background: 'white', cursor: 'pointer', color: '#0a1628', fontWeight: 600 }}>
              Configure →
            </button>
          </div>

          {/* Outbound card */}
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Outbound Agent</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a1628' }}>{outbound.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '9px', padding: '4px 10px', borderRadius: '20px', background: outboundB.bg, color: outboundB.color, border: `1px solid ${outboundB.border}`, fontWeight: 600 }}>
                  {outboundB.label}
                </span>
                <button onClick={() => setOutbound(p => ({ ...p, status: p.status === 'active' ? 'paused' : 'active' }))}
                  style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e4e9f0', background: 'white', cursor: 'pointer', color: '#8896a8' }}>
                  Toggle
                </button>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '14px', lineHeight: '1.6' }}>
              Calls abandoned cart customers automatically. Recovers revenue on autopilot.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'Calls', value: callLogs.filter(c => c.type === 'outbound').length },
                { label: 'Answered', value: callLogs.filter(c => c.type === 'outbound' && c.duration !== '—').length },
                { label: 'Recovered', value: callLogs.filter(c => c.type === 'outbound' && c.status === 'booked').length },
              ].map(s => (
                <div key={s.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#0a1628' }}>{s.value}</div>
                  <div style={{ fontSize: '9px', color: '#8896a8' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {outbound.agentId && (
              <div style={{ fontSize: '10px', color: '#8896a8', background: '#f8fafc', borderRadius: '6px', padding: '6px 10px', marginBottom: '12px', fontFamily: 'DM Mono, monospace', wordBreak: 'break-all' }}>
                ID: {outbound.agentId}
              </div>
            )}
            <button onClick={() => setActiveTab('outbound')}
              style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '7px', border: '1px solid #e4e9f0', background: 'white', cursor: 'pointer', color: '#0a1628', fontWeight: 600 }}>
              Configure →
            </button>
          </div>

          {/* Test call panel — full width */}
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Quick Test</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>Send a Test Call</div>
            <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px' }}>
              Trigger a live call to any phone number to hear your voice agent in action.
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={testAgentTarget} onChange={e => setTestAgentTarget(e.target.value)}
                style={{ border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', fontFamily: 'DM Sans, sans-serif' }}>
                <option value="inbound">Inbound Agent</option>
                <option value="outbound">Outbound Agent</option>
              </select>
              <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                style={{ flex: 1, minWidth: '200px', ...inputStyle }} />
              <button
                onClick={() => initiateTestCall(testAgentTarget === 'inbound' ? inbound.agentId : outbound.agentId)}
                disabled={testing || !testPhone}
                style={{ background: '#c9a84c', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', opacity: !testPhone ? 0.5 : 1 }}>
                {testing ? 'Calling...' : '📞 Test Call'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INBOUND AGENT TAB */}
      {activeTab === 'inbound' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Agent Configuration</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <FieldLabel>Agent Name</FieldLabel>
                <input type="text" value={inbound.name} onChange={e => setInbound(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Voice</FieldLabel>
                <select value={inbound.voiceId} onChange={e => setInbound(p => ({ ...p, voiceId: e.target.value }))} style={selectStyle}>
                  {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <FieldLabel>Status</FieldLabel>
              <StatusToggle status={inbound.status} onChange={s => setInbound(p => ({ ...p, status: s }))} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <FieldLabel>First Message — what the agent says when the call connects</FieldLabel>
              <textarea value={inbound.firstMessage} onChange={e => setInbound(p => ({ ...p, firstMessage: e.target.value }))} rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <FieldLabel>Agent Persona & Instructions</FieldLabel>
              <textarea value={inbound.systemPrompt} onChange={e => setInbound(p => ({ ...p, systemPrompt: e.target.value }))} rows={7}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={() => saveAgent('inbound')} disabled={saving}
                style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : '💾 Save to ElevenLabs'}
              </button>
              {inbound.agentId && (
                <span style={{ fontSize: '10px', color: '#8896a8', fontFamily: 'DM Mono, monospace' }}>Agent ID: {inbound.agentId}</span>
              )}
            </div>
          </div>

          <TestCallPanel agentId={inbound.agentId} label="Inbound Agent" />
        </div>
      )}

      {/* OUTBOUND AGENT TAB */}
      {activeTab === 'outbound' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Campaign Configuration</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <FieldLabel>Campaign Name</FieldLabel>
                <input type="text" value={outbound.name} onChange={e => setOutbound(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Voice</FieldLabel>
                <select value={outbound.voiceId} onChange={e => setOutbound(p => ({ ...p, voiceId: e.target.value }))} style={selectStyle}>
                  {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <FieldLabel>Trigger</FieldLabel>
                <select value={outbound.trigger} onChange={e => setOutbound(p => ({ ...p, trigger: e.target.value }))} style={selectStyle}>
                  <option value="abandoned_cart">Abandoned Cart (Shopify)</option>
                  <option value="new_lead">New Lead</option>
                  <option value="follow_up">Follow-Up Sequence</option>
                  <option value="manual">Manual Trigger</option>
                </select>
              </div>
              <div>
                <FieldLabel>Client</FieldLabel>
                <select value={outbound.clientId} onChange={e => setOutbound(p => ({ ...p, clientId: e.target.value }))} style={selectStyle}>
                  <option value="">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <FieldLabel>Status</FieldLabel>
              <StatusToggle status={outbound.status} onChange={s => setOutbound(p => ({ ...p, status: s }))} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <FieldLabel>Opening Script</FieldLabel>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px' }}>Use {'{{first_name}}'} for contact personalization</div>
              <textarea value={outbound.script} onChange={e => setOutbound(p => ({ ...p, script: e.target.value }))} rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <FieldLabel>Agent Behavior Instructions</FieldLabel>
              <textarea value={outbound.systemPrompt} onChange={e => setOutbound(p => ({ ...p, systemPrompt: e.target.value }))} rows={5}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={() => saveAgent('outbound')} disabled={saving}
                style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : '💾 Save to ElevenLabs'}
              </button>
              {outbound.agentId && (
                <span style={{ fontSize: '10px', color: '#8896a8', fontFamily: 'DM Mono, monospace' }}>Agent ID: {outbound.agentId}</span>
              )}
            </div>
          </div>

          <TestCallPanel agentId={outbound.agentId} label="Outbound Agent" />
        </div>
      )}

      {/* CALL LOGS TAB */}
      {activeTab === 'logs' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e4e9f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Voice Activity</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628' }}>Call Logs</div>
            </div>
            <span style={{ fontSize: '10px', color: '#8896a8' }}>{callLogs.length} calls</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0a1628' }}>
                  {['Type', 'Contact', 'Phone', 'Duration', 'Status', 'Time'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '9px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {callLogs.map((log, i) => {
                  const statusColors = {
                    booked: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
                    qualified: { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
                    no_answer: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
                    not_qualified: { bg: '#f8fafc', color: '#8896a8', border: '#e4e9f0' },
                  };
                  const sc = statusColors[log.status] || statusColors.not_qualified;
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f0f3f8', background: i % 2 === 0 ? 'white' : '#fafbfd' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600,
                          background: log.type === 'inbound' ? '#eff6ff' : '#f0fdf4',
                          color: log.type === 'inbound' ? '#3b82f6' : '#10b981',
                          border: `1px solid ${log.type === 'inbound' ? '#bfdbfe' : '#a7f3d0'}` }}>
                          {log.type === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 500, color: '#0a1628' }}>{log.contact}</td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#8896a8', fontFamily: 'DM Mono, monospace' }}>{log.phone}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#0a1628', fontFamily: 'DM Mono, monospace' }}>{log.duration}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {log.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#8896a8' }}>{log.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
