import React, { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "../supabase";
import { API_BASE } from "../config";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [healthScores, setHealthScores] = useState({});
  const [healthBreakdowns, setHealthBreakdowns] = useState({});
  const [tooltipClientId, setTooltipClientId] = useState(null);
  const [ltvData, setLtvData] = useState({});
  const [comms, setComms] = useState({});
  const [tierChanging, setTierChanging] = useState(null);
  const [commForm, setCommForm] = useState({ type: 'call', date: new Date().toISOString().slice(0,10), summary: '', next_action: '' });
  const [commSaving, setCommSaving] = useState(false);
  const [clientNotes, setClientNotes] = useState({});
  const [notesSaving, setNotesSaving] = useState({});
  const [notesUpdatedAt, setNotesUpdatedAt] = useState({});
  const [checklist, setChecklist] = useState({});
  const [form, setForm] = useState({
    name: "", email: "", niche: "", tier: "starter", status: "onboarding"
  });

  const defaultFeatures = {
    email_sequences: true,
    sms_sequences: true,
    whatsapp: false,
    cart_recovery: true,
    post_purchase: true,
    win_back: true,
    voice_agents: false,
    social_media: false,
    ai_content: false,
    conversational_ai: false
  };

  const featureLabels = {
    email_sequences: 'Email Sequences',
    sms_sequences: 'SMS Sequences',
    whatsapp: 'WhatsApp',
    cart_recovery: 'Cart Recovery',
    post_purchase: 'Post Purchase',
    win_back: 'Win-Back',
    voice_agents: 'Voice Agents',
    social_media: 'Social Media',
    ai_content: 'AI Content',
    conversational_ai: 'Conversational AI'
  };

  useEffect(() => {
    fetchClients();
    axios.get(`${API_BASE}/clients/ltv`).then(r => {
      const map = {};
      (r.data.clients || []).forEach(c => { map[c.id] = c; });
      setLtvData(map);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setClients(data);
      computeHealthScores(data);
    }
    setLoading(false);
  };

  // Health score out of 100: enrollments this week (30) + messages this month (30)
  // + active sequences (20) + recent contact activity within 7 days (20).
  const computeHealthScores = async (clientList) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [enrollRes, msgRes, wfRes, actRes] = await Promise.all([
      supabase.from("workflow_enrollments").select("client_id").gte("enrolled_at", weekAgo),
      supabase.from("messages").select("client_id").eq("direction", "outbound").gte("created_at", monthStart),
      supabase.from("workflows").select("client_id, status"),
      supabase.from("contacts").select("client_id, last_activity").gte("last_activity", weekAgo),
    ]);
    const tally = (rows) => {
      const m = {};
      (rows || []).forEach(r => { if (r.client_id != null) m[r.client_id] = (m[r.client_id] || 0) + 1; });
      return m;
    };
    const enrollWeek = tally(enrollRes.data);
    const msgMonth = tally(msgRes.data);
    const activeSeq = tally((wfRes.data || []).filter(w => w.status === "active"));
    const recentAct = tally(actRes.data);
    const scores = {};
    const breakdowns = {};
    for (const c of clientList) {
      const enroll = enrollWeek[c.id] || 0;
      const msgs = msgMonth[c.id] || 0;
      const seqs = activeSeq[c.id] || 0;
      const hasAct = (recentAct[c.id] || 0) > 0;
      const enrollPts = Math.min(30, enroll * 10);
      const msgPts = Math.min(30, msgs * 3);
      const seqPts = Math.min(20, seqs * 10);
      const actPts = hasAct ? 20 : 0;
      scores[c.id] = Math.min(100, enrollPts + msgPts + seqPts + actPts);
      breakdowns[c.id] = { enroll, enrollPts, msgs, msgPts, seqs, seqPts, hasAct, actPts };
    }
    setHealthScores(scores);
    setHealthBreakdowns(breakdowns);
  };

  const addClient = async () => {
    if (!form.name) return;
    const { error } = await supabase.from("clients").insert([{
      ...form,
      business_type: "Ecommerce",
      health_score: 0,
      monthly_revenue: "$0",
      features: defaultFeatures
    }]);
    if (!error) {
      fetchClients();
      setShowForm(false);
      setForm({ name: "", email: "", niche: "", tier: "starter", status: "onboarding" });
    }
  };

  const changeTier = async (clientId, newTier) => {
    if (!window.confirm(`Change tier to ${newTier}? The client will receive a notification email.`)) return;
    setTierChanging(clientId);
    try {
      await fetch(`${API_BASE}/clients/${clientId}/tier`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: newTier }),
      });
      fetchClients();
    } catch {}
    setTierChanging(null);
  };

  const loadComms = async (clientId) => {
    if (comms[clientId]) return;
    try {
      const res = await fetch(`${API_BASE}/client-comms?client_id=${clientId}`);
      const data = await res.json();
      setComms(prev => ({ ...prev, [clientId]: data.comms || [] }));
    } catch { setComms(prev => ({ ...prev, [clientId]: [] })); }
  };

  const saveComm = async (clientId) => {
    if (!commForm.summary.trim()) return;
    setCommSaving(true);
    try {
      await fetch(`${API_BASE}/client-comms/log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, ...commForm }),
      });
      setComms(prev => ({ ...prev, [clientId]: undefined }));
      setCommForm({ type: 'call', date: new Date().toISOString().slice(0,10), summary: '', next_action: '' });
      loadComms(clientId);
    } catch {}
    setCommSaving(false);
  };

  const loadChecklist = async (clientId) => {
    if (checklist[clientId]) return;
    const [shopifyRes, approvedRes, enrolledRes, emailRes] = await Promise.all([
      supabase.from('shopify_connections').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'approved'),
      supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', clientId).eq('channel', 'email').eq('direction', 'outbound'),
    ]);
    setChecklist(prev => ({
      ...prev,
      [clientId]: {
        shopify: (shopifyRes.count || 0) > 0,
        approved: (approvedRes.count || 0) > 0,
        enrolled: (enrolledRes.count || 0) > 0,
        email_sent: (emailRes.count || 0) > 0,
      },
    }));
  };

  const saveNotes = async (clientId, notes) => {
    setNotesSaving(prev => ({ ...prev, [clientId]: true }));
    const now = new Date().toISOString();
    await supabase.from('clients').update({ notes, notes_updated_at: now }).eq('id', clientId);
    setNotesUpdatedAt(prev => ({ ...prev, [clientId]: now }));
    setNotesSaving(prev => ({ ...prev, [clientId]: false }));
  };

  const toggleFeature = async (client, feature) => {
    const currentFeatures = client.features || defaultFeatures;
    const updatedFeatures = { ...currentFeatures, [feature]: !currentFeatures[feature] };
    await supabase.from("clients").update({ features: updatedFeatures }).eq("id", client.id);
    fetchClients();
    setSelectedClient({ ...client, features: updatedFeatures });
  };

  const nameColor = (name = '') => {
    const cols = ['#3b82f6','#10b981','#c9a84c','#8b5cf6','#f59e0b','#ec4899','#0d9488','#ef4444'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return cols[Math.abs(h) % cols.length];
  };

  const TIER_GRAD = {
    starter: 'linear-gradient(135deg,#059669,#10b981)',
    growth:  'linear-gradient(135deg,#2563eb,#3b82f6)',
    elite:   'linear-gradient(135deg,#7c3aed,#a855f7)',
    scale:   'linear-gradient(135deg,#c9a84c,#f59e0b)',
  };

  const HealthRing = ({ score }) => {
    const R = 18, sw = 3, circ = 2 * Math.PI * R;
    const col = score >= 70 ? '#10b981' : score >= 40 ? '#c9a84c' : '#ef4444';
    const offset = circ * (1 - (score || 0) / 100);
    return (
      <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink:0 }}>
        <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        <circle cx="22" cy="22" r={R} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 22 22)" strokeLinecap="round" style={{ transition:'stroke-dashoffset 0.6s' }} />
        <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill={col}>{score}</text>
      </svg>
    );
  };

  const statusColor = (status) => {
    if (status === "live") return { bg: "rgba(16,185,129,0.1)", color: "#34d399", border: "rgba(16,185,129,0.25)" };
    if (status === "paused") return { bg: "rgba(239,68,68,0.1)", color: "#f87171", border: "rgba(239,68,68,0.25)" };
    return { bg: "rgba(217,119,6,0.1)", color: "#f59e0b", border: "rgba(217,119,6,0.25)" };
  };

  const inputStyle = {
    width: '100%',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '12px',
    color: '#f0f4f8',
    outline: 'none',
    background: 'rgba(255,255,255,0.05)',
    boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
  };

  const Toggle = ({ value, onChange }) => (
    <div onClick={onChange}
      style={{ width: '36px', height: '20px', borderRadius: '10px', background: value ? '#10b981' : '#e4e9f0', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: value ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}></div>
    </div>
  );

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Ecommerce Clients</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{clients.length} client{clients.length !== 1 ? 's' : ''} on the platform</div>
        </div>
        <button onClick={() => window.open(`${API_BASE}/clients/export`, '_blank')}
          style={{ background: 'white', color: '#0a1628', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          ↓ Export CSV
        </button>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          + Add Client
        </button>
      </div>

      {/* ADD CLIENT FORM */}
      {showForm && (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px', fontFamily:'DM Mono,monospace' }}>New Ecommerce Client</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Store Name</div>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Luux Bags" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Owner Email</div>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="owner@store.com" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Niche</div>
              <input value={form.niche} onChange={e => setForm({ ...form, niche: e.target.value })} placeholder="e.g. Travel Bags, Fitness, Fashion" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tier</div>
              <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} style={inputStyle}>
                <option value="starter">Starter — $1,500/mo</option>
                <option value="growth">Growth — $3,000/mo</option>
                <option value="elite">Elite — $6,000/mo</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                <option value="onboarding">Onboarding</option>
                <option value="live">Live</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={addClient}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Save Client
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* FEATURE CONTROL PANEL */}
      {selectedClient && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Feature Control</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{selectedClient.name}</div>
            </div>
            <button onClick={() => setSelectedClient(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
          {/* Fix 8: Change Tier */}
          <div style={{ background: '#f8fafc', border: '1px solid #f0f3f8', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Current Tier</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{selectedClient.tier?.charAt(0).toUpperCase() + selectedClient.tier?.slice(1)}</div>
            </div>
            <select
              defaultValue={selectedClient.tier?.toLowerCase()}
              onChange={e => changeTier(selectedClient.id, e.target.value)}
              disabled={tierChanging === selectedClient.id}
              style={{ border: '1px solid #e4e9f0', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              <option value="starter">Starter — $997/mo</option>
              <option value="growth">Growth — $1,997/mo</option>
              <option value="elite">Elite — $2,997/mo</option>
            </select>
            {tierChanging === selectedClient.id && <span style={{ fontSize: '11px', color: '#8896a8' }}>Updating…</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '20px' }}>
            {Object.keys(featureLabels).map(feature => {
              const features = selectedClient.features || defaultFeatures;
              const isOn = features[feature] !== undefined ? features[feature] : defaultFeatures[feature];
              return (
                <div key={feature} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f0f3f8' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#0a1628' }}>{featureLabels[feature]}</div>
                    <div style={{ fontSize: '10px', color: isOn ? '#10b981' : '#8896a8', marginTop: '1px', fontWeight: 500 }}>{isOn ? '● Active' : '○ Disabled'}</div>
                  </div>
                  <Toggle value={isOn} onChange={() => toggleFeature(selectedClient, feature)} />
                </div>
              );
            })}
          </div>

          {/* Fix 7: Onboarding checklist */}
          {checklist[selectedClient.id] && (() => {
            const cl = checklist[selectedClient.id];
            const items = [
              { key: 'shopify', label: 'Shopify connected' },
              { key: 'approved', label: 'Sequences approved' },
              { key: 'enrolled', label: 'First contact enrolled' },
              { key: 'email_sent', label: 'First email sent' },
            ];
            const done = items.filter(i => cl[i.key]).length;
            const pct = Math.round((done / items.length) * 100);
            return (
              <div style={{ borderTop: '1px solid #f0f3f8', paddingTop: '14px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Onboarding Checklist</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: pct === 100 ? '#10b981' : '#c9a84c' }}>{done}/{items.length} · {pct}%</div>
                </div>
                <div style={{ height: '4px', background: '#f0f3f8', borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#10b981' : '#c9a84c', borderRadius: '2px', transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {items.map(item => (
                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: cl[item.key] ? '#059669' : '#8896a8' }}>
                      <span style={{ fontSize: '12px' }}>{cl[item.key] ? '✓' : '○'}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Fix 2: Private owner notes */}
          <div style={{ borderTop: '1px solid #f0f3f8', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Private Notes</div>
              <div style={{ fontSize: '10px', color: '#8896a8' }}>
                {notesSaving[selectedClient.id] ? 'Saving…' : notesUpdatedAt[selectedClient.id] ? `Saved ${new Date(notesUpdatedAt[selectedClient.id]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : selectedClient.notes_updated_at ? `Last updated ${new Date(selectedClient.notes_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Auto-saves on blur'}
              </div>
            </div>
            <textarea
              rows={3}
              placeholder="Add private notes about this client — visible only to you, never to the client…"
              defaultValue={clientNotes[selectedClient.id] ?? (selectedClient.notes || '')}
              onChange={e => setClientNotes(prev => ({ ...prev, [selectedClient.id]: e.target.value }))}
              onBlur={e => saveNotes(selectedClient.id, e.target.value)}
              style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', resize: 'vertical', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box', lineHeight: 1.6 }}
            />
          </div>

          {/* Fix 3: Communication History */}
          <div style={{ borderTop: '1px solid #f0f3f8', paddingTop: '16px', marginTop: '4px' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Communication History</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <select value={commForm.type} onChange={e => setCommForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                <option value="call">Phone Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="note">Note</option>
              </select>
              <input type="date" value={commForm.date} onChange={e => setCommForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </div>
            <textarea rows={2} placeholder="Summary of the conversation..." value={commForm.summary} onChange={e => setCommForm(f => ({ ...f, summary: e.target.value }))}
              style={{ ...inputStyle, resize: 'none', marginBottom: '6px', display: 'block' }} />
            <input type="text" placeholder="Next action (optional)..." value={commForm.next_action} onChange={e => setCommForm(f => ({ ...f, next_action: e.target.value }))} style={{ ...inputStyle, marginBottom: '8px' }} />
            <button onClick={() => saveComm(selectedClient.id)} disabled={commSaving || !commForm.summary.trim()}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px', opacity: commSaving ? 0.6 : 1 }}>
              {commSaving ? 'Saving…' : '+ Log Communication'}
            </button>
            {(comms[selectedClient.id] || []).slice(0, 5).map(c => (
              <div key={c.id} style={{ background: '#f8fafc', border: '1px solid #f0f3f8', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: '#0a1628', color: '#c9a84c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.type}</span>
                    <span style={{ fontSize: '10px', color: '#8896a8' }}>{c.date}</span>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#0a1628', lineHeight: 1.5 }}>{c.summary}</div>
                {c.next_action && <div style={{ fontSize: '10px', color: '#c9a84c', marginTop: '4px', fontWeight: 500 }}>→ {c.next_action}</div>}
              </div>
            ))}
            {(comms[selectedClient.id] || []).length === 0 && <div style={{ fontSize: '11px', color: '#8896a8' }}>No communications logged yet.</div>}
          </div>
        </div>
      )}

      {/* CLIENTS TABLE */}
      {loading ? (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '40px', textAlign: 'center', color: '#4a5568' }}>Loading clients…</div>
      ) : clients.length === 0 ? (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏪</div>
          <div style={{ fontWeight: 700, color: '#f0f4f8', marginBottom: '6px', fontSize: '14px' }}>No clients yet</div>
          <div style={{ fontSize: '12px', color: '#4a5568' }}>Add your first ecommerce client to get started</div>
        </div>
      ) : (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 1fr 1fr 1fr', padding: '12px 20px', background: '#142840', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['CLIENT', 'NICHE', 'TIER', 'HEALTH', 'LTV', 'STATUS'].map(h => (
              <div key={h} style={{ fontSize: '8px', color: '#4a5568', letterSpacing: '2px', fontWeight: 700, fontFamily: 'DM Mono,monospace' }}>{h}</div>
            ))}
          </div>
          {clients.map(client => {
            const nc = nameColor(client.name || '');
            const sc = statusColor(client.status);
            const tierGrad = TIER_GRAD[client.tier?.toLowerCase()] || TIER_GRAD.starter;
            return (
              <div key={client.id}
                onClick={() => { const c = selectedClient?.id === client.id ? null : client; setSelectedClient(c); if (c) { loadChecklist(c.id); loadComms(c.id); } }}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: selectedClient?.id === client.id ? 'rgba(201,168,76,0.05)' : 'transparent', transition: 'background 0.15s', position: 'relative' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; const acts = e.currentTarget.querySelector('.hover-actions'); if (acts) acts.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = selectedClient?.id === client.id ? 'rgba(201,168,76,0.05)' : 'transparent'; const acts = e.currentTarget.querySelector('.hover-actions'); if (acts) acts.style.opacity = '0'; }}>

                {/* Avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: nc + '22', border: `1px solid ${nc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: nc, flexShrink: 0 }}>
                    {(client.name || '?')[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                    <div style={{ fontSize: 10, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#8896a8', display: 'flex', alignItems: 'center' }}>{client.niche || '—'}</div>

                {/* Gradient tier badge */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, padding: '4px 10px', borderRadius: 20, fontWeight: 700, background: tierGrad, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                    {client.tier?.charAt(0).toUpperCase() + client.tier?.slice(1)}
                  </span>
                </div>

                {/* Circular health ring */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {(() => {
                    const s = healthScores[client.id] ?? client.health_score ?? 0;
                    const bd = healthBreakdowns[client.id];
                    const isOpen = tooltipClientId === client.id;
                    return (
                      <div style={{ position: 'relative' }}
                        onMouseEnter={() => setTooltipClientId(client.id)}
                        onMouseLeave={() => setTooltipClientId(null)}>
                        <HealthRing score={s} />
                        {isOpen && bd && (
                          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, background: '#0a1628', borderRadius: 10, padding: '12px 14px', width: 200, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', pointerEvents: 'none' }}>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 10 }}>Score Breakdown</div>
                            {[
                              { label: 'Enrollments/wk', val: bd.enroll, pts: bd.enrollPts, max: 30 },
                              { label: 'Messages/mo', val: bd.msgs, pts: bd.msgPts, max: 30 },
                              { label: 'Active sequences', val: bd.seqs, pts: bd.seqPts, max: 20 },
                              { label: 'Recent activity', val: bd.hasAct ? 'Yes' : 'No', pts: bd.actPts, max: 20 },
                            ].map(row => (
                              <div key={row.label} style={{ marginBottom: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                                  <span style={{ fontSize: 10, color: '#c9a84c', fontWeight: 600 }}>{row.pts}/{row.max}</span>
                                </div>
                                <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                                  <div style={{ width: `${(row.pts / row.max) * 100}%`, height: '100%', background: '#c9a84c', borderRadius: 2 }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* LTV */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {(() => {
                    const ltv = ltvData[client.id];
                    if (!ltv) return <span style={{ fontSize: 10, color: '#4a5568' }}>—</span>;
                    const roiColor = ltv.roi >= 2 ? '#10b981' : ltv.roi >= 1 ? '#c9a84c' : '#ef4444';
                    return (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4f8' }}>${ltv.totalSubscription.toLocaleString()}</div>
                        <div style={{ fontSize: 9, color: roiColor, fontWeight: 700 }}>{ltv.roi}× ROI</div>
                      </div>
                    );
                  })()}
                </div>

                {/* Status + hover actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, padding: '4px 10px', borderRadius: 20, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {client.status?.charAt(0).toUpperCase() + client.status?.slice(1)}
                  </span>
                  <div className="hover-actions" style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s' }}>
                    <button onClick={e => e.stopPropagation()} style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.07)', color: '#8896a8', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>View</button>
                    <button onClick={e => e.stopPropagation()} style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.07)', color: '#c9a84c', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Audit</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}