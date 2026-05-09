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

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card gold-top">
          <div className="stat-label">TOTAL REVENUE GENERATED</div>
          <div className="stat-value">$0</div>
          <div className="stat-sub-gold">connecting Shopify soon</div>
        </div>
        <div className="stat-card gold-top">
          <div className="stat-label">PERFORMANCE BONUSES</div>
          <div className="stat-value">$0</div>
          <div className="stat-sub-gold">earned this month</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">ACTIVE CLIENTS</div>
          <div className="stat-value">{liveClients.length}</div>
          <div className="stat-sub-blue">{clients.length} total on platform</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">AUTOMATIONS RUNNING</div>
          <div className="stat-value">0</div>
          <div className="stat-sub-blue">connecting soon</div>
        </div>
      </div>

      <div className="opp-box">
        <div className="opp-head">
          <div className="opp-dot"></div>
          <div className="opp-title">ZAINAB MORNING OPPORTUNITY</div>
        </div>
        <div className="opp-text">
          You have <b>{clients.length} client{clients.length !== 1 ? "s" : ""}</b> on the platform.
          {clients.length === 0 ? " Add your first client to get started." : ` ${liveClients.length} are live. Keep building the system.`}
        </div>
      </div>

      <div className="section-label">CLIENT OVERVIEW</div>
      {loading ? (
        <div className="card" style={{textAlign:"center", padding:"40px", color:"var(--muted)", fontSize:"14px"}}>Loading clients...</div>
      ) : clients.length === 0 ? (
        <div className="card" style={{textAlign:"center", padding:"40px", color:"var(--muted)", fontSize:"14px"}}>No clients yet. Go to Clients page to add your first client.</div>
      ) : (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px"}}>
          {clients.map(client => (
            <div className="card" key={client.id}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px"}}>
                <div style={{fontWeight:700, color:"var(--navy)", fontSize:"15px"}}>{client.name}</div>
                <div className={client.health_score >= 70 ? "badge-blue" : "badge-yellow"}>{client.health_score}/100</div>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"8px"}}>
                <span style={{fontSize:"12px", color:"var(--muted)"}}>Business type</span>
                <span style={{fontSize:"12px", color:"var(--slate)", fontWeight:500}}>{client.business_type}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"8px"}}>
                <span style={{fontSize:"12px", color:"var(--muted)"}}>Niche</span>
                <span style={{fontSize:"12px", color:"var(--slate)"}}>{client.niche || "—"}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"8px"}}>
                <span style={{fontSize:"12px", color:"var(--muted)"}}>Tier</span>
                <span style={{fontSize:"12px", color:"var(--gold)", fontWeight:600}}>{client.tier ? client.tier.charAt(0).toUpperCase() + client.tier.slice(1) : "Starter"}</span>
              </div>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:"8px"}}>
                <span style={{fontSize:"12px", color:"var(--muted)"}}>Status</span>
                <span style={{fontSize:"12px", color: client.status === "live" ? "var(--blue)" : "var(--yellow)", fontWeight:500}}>
                  {client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : "Onboarding"}
                </span>
              </div>
              <div className="pbar">
                <div className="pfill" style={{width: client.health_score + "%"}}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
