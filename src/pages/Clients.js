import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const [selectedClient, setSelectedClient] = useState(null);
  const [form, setForm] = useState({
    name: "", email: "", business_type: "Ecommerce", niche: "", tier: "starter", status: "onboarding"
  });

  const verticals = ["All", "Ecommerce", "Coaching", "Courses", "Real Estate", "Agency"];

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

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (!error && data) setClients(data);
    setLoading(false);
  };

  const addClient = async () => {
    if (!form.name) return;
    const { error } = await supabase.from("clients").insert([{
      ...form,
      health_score: 0,
      monthly_revenue: "$0",
      features: defaultFeatures
    }]);
    if (!error) {
      fetchClients();
      setShowForm(false);
      setForm({ name: "", email: "", business_type: "Ecommerce", niche: "", tier: "starter", status: "onboarding" });
    }
  };

  const toggleFeature = async (client, feature) => {
    const currentFeatures = client.features || defaultFeatures;
    const updatedFeatures = { ...currentFeatures, [feature]: !currentFeatures[feature] };
    await supabase.from("clients").update({ features: updatedFeatures }).eq("id", client.id);
    fetchClients();
    setSelectedClient({ ...client, features: updatedFeatures });
  };

  const filtered = filter === "All" ? clients : clients.filter(c => c.business_type === filter);

  const tierColor = (tier) => {
    if (tier === "elite") return { background: "#fdf4ff", color: "#a855f7", border: "0.5px solid #e9d5ff" };
    if (tier === "growth") return { background: "#eff6ff", color: "#3b82f6", border: "0.5px solid #bfdbfe" };
    return { background: "#ecfdf5", color: "#059669", border: "0.5px solid #a7f3d0" };
  };

  const inputStyle = {
    width: '100%', border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  const Toggle = ({ value, onChange }) => (
    <div onClick={onChange}
      style={{ width: '34px', height: '18px', borderRadius: '9px', background: value ? '#10b981' : '#e2e8f0', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: value ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div className="section-label" style={{ margin: 0 }}>ALL CLIENTS</div>
        <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>+ Add New Client</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "16px", border: "0.5px solid var(--green-border)" }}>
          <div className="section-label">ADD NEW CLIENT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>CLIENT NAME</div>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Luux Bags" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>EMAIL</div>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="e.g. adam@luuxbags.com" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>BUSINESS TYPE</div>
              <select value={form.business_type} onChange={e => setForm({ ...form, business_type: e.target.value })} style={inputStyle}>
                <option>Ecommerce</option>
                <option>Coaching</option>
                <option>Courses</option>
                <option>Real Estate</option>
                <option>Agency</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>NICHE</div>
              <input value={form.niche} onChange={e => setForm({ ...form, niche: e.target.value })} placeholder="e.g. Travel Bags" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>TIER</div>
              <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} style={inputStyle}>
                <option value="starter">Starter — $1,500/mo</option>
                <option value="growth">Growth — $3,000/mo</option>
                <option value="elite">Elite — $6,000/mo</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>STATUS</div>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                <option value="onboarding">Onboarding</option>
                <option value="live">Live</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-green" onClick={addClient}>Save Client</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {verticals.map(v => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding: "5px 14px", borderRadius: "20px", border: "0.5px solid", fontSize: "11px", cursor: "pointer", fontWeight: filter === v ? 600 : 400, background: filter === v ? "#0f1f35" : "white", color: filter === v ? "white" : "var(--muted)", borderColor: filter === v ? "#0f1f35" : "var(--border)" }}>
            {v}
          </button>
        ))}
      </div>

      {/* FEATURE CONTROL PANEL */}
      {selectedClient && (
        <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>FEATURE CONTROL — {selectedClient.name.toUpperCase()}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Toggle which features are active for this client</div>
            </div>
            <button onClick={() => setSelectedClient(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {Object.keys(featureLabels).map(feature => {
              const features = selectedClient.features || defaultFeatures;
              const isOn = features[feature] !== undefined ? features[feature] : defaultFeatures[feature];
              return (
                <div key={feature} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8f9fc', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#1a3c5e' }}>{featureLabels[feature]}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{isOn ? 'Active' : 'Disabled'}</div>
                  </div>
                  <Toggle value={isOn} onChange={() => toggleFeature(selectedClient, feature)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>Loading clients...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
          No clients yet. Click Add New Client to add your first client.
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-header" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr" }}>
            <div className="th">CLIENT</div>
            <div className="th">VERTICAL</div>
            <div className="th">NICHE</div>
            <div className="th">TIER</div>
            <div className="th">HEALTH</div>
            <div className="th">STATUS</div>
          </div>
          {filtered.map(client => (
            <div className="table-row" key={client.id}
              style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", cursor: "pointer", background: selectedClient?.id === client.id ? '#fafffe' : 'white' }}
              onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}>
              <div>
                <div className="td bold">{client.name}</div>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>{client.email}</div>
              </div>
              <div className="td">{client.business_type}</div>
              <div className="td">{client.niche || "—"}</div>
              <div className="td">
                <span style={{ fontSize: "9px", padding: "2px 8px", borderRadius: "8px", ...tierColor(client.tier) }}>
                  {client.tier ? client.tier.charAt(0).toUpperCase() + client.tier.slice(1) : "Starter"}
                </span>
              </div>
              <div className="td" style={{ color: client.health_score >= 70 ? "#10b981" : "#f59e0b" }}>
                {client.health_score}/100
              </div>
              <div className="td">
                <span className="status-dot" style={{ background: client.status === "live" ? "#10b981" : client.status === "paused" ? "var(--red)" : "#f59e0b" }}></span>
                {client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : "Onboarding"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}