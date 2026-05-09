import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (!error && data) setClients(data);
    setLoading(false);
  };

  const liveClients = clients.filter(c => c.status === "live");
  const totalClients = clients.length;

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">TOTAL CLIENTS</div>
          <div className="stat-value">{totalClients}</div>
          <div className="stat-sub">{liveClients.length} live — {totalClients - liveClients.length} onboarding</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">PERFORMANCE BONUSES</div>
          <div className="stat-value">$0</div>
          <div className="stat-sub">connecting data soon</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ACTIVE CLIENTS</div>
          <div className="stat-value">{liveClients.length}</div>
          <div className="stat-sub">across all verticals</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AUTOMATIONS RUNNING</div>
          <div className="stat-value">0</div>
          <div className="stat-sub">connecting soon</div>
        </div>
      </div>

      <div className="opp-box">
        <div className="opp-head">
          <div className="opp-dot"></div>
          <div className="opp-title">AI MORNING OPPORTUNITY</div>
        </div>
        <div className="opp-text">
          You have <b>{totalClients} client{totalClients !== 1 ? "s" : ""}</b> on the platform. {totalClients === 0 ? "Add your first client to get started." : `${liveClients.length} are live and generating results. Keep building the system.`}
        </div>
        {totalClients === 0 && (
          <button className="btn btn-green" style={{ marginTop: "10px" }} onClick={() => window.location.href = "#clients"}>Add Your First Client ?</button>
        )}
      </div>

      <div className="section-label">CLIENT OVERVIEW</div>
      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>Loading clients...</div>
      ) : clients.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>No clients yet. Go to Clients page to add your first client.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {clients.map(client => (
            <div className="card" key={client.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ fontWeight: 600, color: "var(--navy)", fontSize: "12px" }}>{client.name}</div>
                <div className={client.health_score >= 70 ? "badge-green" : "badge-yellow"}>{client.health_score}/100</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>Business type</span>
                <span style={{ fontSize: "10px", color: "var(--slate)" }}>{client.business_type}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>Niche</span>
                <span style={{ fontSize: "10px", color: "var(--slate)" }}>{client.niche || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>Tier</span>
                <span style={{ fontSize: "10px", color: "var(--green)", fontWeight: 500 }}>{client.tier ? client.tier.charAt(0).toUpperCase() + client.tier.slice(1) : "Starter"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>Status</span>
                <span style={{ fontSize: "10px", color: client.status === "live" ? "var(--green)" : "var(--yellow)" }}>
                  {client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : "Onboarding"}
                </span>
              </div>
              <div className="pbar">
                <div className="pfill" style={{ width: client.health_score + "%" }}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
