import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { API_BASE } from "../config";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [healthScores, setHealthScores] = useState({});
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
    for (const c of clientList) {
      let score = 0;
      score += Math.min(30, (enrollWeek[c.id] || 0) * 10);
      score += Math.min(30, (msgMonth[c.id] || 0) * 3);
      score += Math.min(20, (activeSeq[c.id] || 0) * 10);
      score += (recentAct[c.id] || 0) > 0 ? 20 : 0;
      scores[c.id] = Math.min(100, score);
    }
    setHealthScores(scores);
  };

  const healthColor = (s) => {
    if (s >= 80) return { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" };
    if (s >= 50) return { bg: "#fffbeb", color: "#d97706", border: "#fde68a" };
    return { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" };
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

  const tierColor = (tier) => {
    if (tier === "elite") return { background: "#fdf4ff", color: "#a855f7", border: "1px solid #e9d5ff" };
    if (tier === "growth") return { background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe" };
    return { background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" };
  };

  const statusColor = (status) => {
    if (status === "live") return { bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" };
    if (status === "paused") return { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" };
    return { bg: "#fffbeb", color: "#d97706", border: "#fde68a" };
  };

  const inputStyle = {
    width: '100%',
    border: '1px solid #e4e9f0',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '12px',
    color: '#0a1628',
    outline: 'none',
    background: 'white',
    boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif'
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
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>New Ecommerce Client</div>
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
        </div>
      )}

      {/* CLIENTS TABLE */}
      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading clients...</div>
      ) : clients.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏪</div>
          <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '6px', fontSize: '14px' }}>No clients yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Add your first ecommerce client to get started</div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr', padding: '12px 18px', background: '#0a1628' }}>
            {['CLIENT', 'NICHE', 'TIER', 'HEALTH', 'STATUS'].map(h => (
              <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700 }}>{h}</div>
            ))}
          </div>
          {clients.map(client => {
            const sc = statusColor(client.status);
            return (
              <div key={client.id}
                onClick={() => { const c = selectedClient?.id === client.id ? null : client; setSelectedClient(c); if (c) loadChecklist(c.id); }}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr', padding: '14px 18px', borderBottom: '1px solid #f4f6fa', cursor: 'pointer', background: selectedClient?.id === client.id ? '#fafbfd' : 'white', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (selectedClient?.id !== client.id) e.currentTarget.style.background = '#fafbfd'; }}
                onMouseLeave={e => { if (selectedClient?.id !== client.id) e.currentTarget.style.background = 'white'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>
                    {client.name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{client.name}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>{client.email}</div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#4a5568', display: 'flex', alignItems: 'center' }}>{client.niche || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, ...tierColor(client.tier) }}>
                    {client.tier?.charAt(0).toUpperCase() + client.tier?.slice(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {(() => {
                    const s = healthScores[client.id] ?? client.health_score ?? 0;
                    const hc = healthColor(s);
                    return (
                      <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: hc.bg, color: hc.color, border: `1px solid ${hc.border}` }}>
                        {s}/100
                      </span>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {client.status?.charAt(0).toUpperCase() + client.status?.slice(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}