import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({
    name: "", email: "", business_type: "Ecommerce", niche: "", tier: "starter", status: "onboarding"
  });

  const verticals = ["All", "Ecommerce", "Coaching", "Courses", "Real Estate", "Agency"];

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (!error && data) setClients(data);
    setLoading(false);
  };

  const addClient = async () => {
    if (!form.name) return;
    const { error } = await supabase.from("clients").insert([{ ...form, health_score: 0, monthly_revenue: "$0" }]);
    if (!error) { fetchClients(); setShowForm(false); setForm({ name: "", email: "", business_type: "Ecommerce", niche: "", tier: "starter", status: "onboarding" }); }
  };

  const filtered = filter === "All" ? clients : clients.filter(c => c.business_type === filter);

  const tierColor = (tier) => {
    if (tier === "elite") return { background: "#fdf4ff", color: "#a855f7", border: "0.5px solid #e9d5ff" };
    if (tier === "growth") return { background: "#eff6ff", color: "#3b82f6", border: "0.5px solid #bfdbfe" };
    return { background: "var(--green-light)", color: "var(--green)", border: "0.5px solid var(--green-border)" };
  };

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
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Luux Bags" style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>EMAIL</div>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="e.g. adam@luuxbags.com" style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>BUSINESS TYPE</div>
              <select value={form.business_type} onChange={e => setForm({ ...form, business_type: e.target.value })} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none", background: "white" }}>
                <option>Ecommerce</option>
                <option>Coaching</option>
                <option>Courses</option>
                <option>Real Estate</option>
                <option>Agency</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>NICHE</div>
              <input value={form.niche} onChange={e => setForm({ ...form, niche: e.target.value })} placeholder="e.g. Travel Bags" style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>TIER</div>
              <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none", background: "white" }}>
                <option value="starter">Starter — $1,500/mo</option>
                <option value="growth">Growth — $3,000/mo</option>
                <option value="elite">Elite — $6,000/mo</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>STATUS</div>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none", background: "white" }}>
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
          <button key={v} onClick={() => setFilter(v)} style={{ padding: "5px 14px", borderRadius: "20px", border: "0.5px solid", fontSize: "11px", cursor: "pointer", fontWeight: filter === v ? 600 : 400, background: filter === v ? "var(--green)" : "white", color: filter === v ? "white" : "var(--muted)", borderColor: filter === v ? "var(--green)" : "var(--border)" }}>
            {v}
          </button>
        ))}
      </div>

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
            <div className="table-row" key={client.id} style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", cursor: "pointer" }}>
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
              <div className="td" style={{ color: client.health_score >= 70 ? "var(--green)" : "var(--yellow)" }}>
                {client.health_score}/100
              </div>
              <div className="td">
                <span className="status-dot" style={{ background: client.status === "live" ? "var(--green)" : client.status === "paused" ? "var(--red)" : "#f59e0b" }}></span>
                {client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : "Onboarding"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
