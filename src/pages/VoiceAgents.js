import React from "react";

export default function VoiceAgents() {
  const agents = [
    { name: "Sarah — Inbound Voice Agent", status: "Live", calls: 24, qualified: "71%", booked: 6 },
    { name: "Ahmed — Outbound Lead Follow-Up", status: "Live", calls: 12, qualified: "58%", booked: 2 },
    { name: "Luux Bags — Cart Recovery Calls", status: "Paused", calls: 0, qualified: "—", booked: 0 },
  ];
  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">CALLS TODAY</div><div className="stat-value">47</div><div className="stat-sub">inbound and outbound</div></div>
        <div className="stat-card"><div className="stat-label">QUALIFIED LEADS</div><div className="stat-value">23</div><div className="stat-sub">from voice today</div></div>
        <div className="stat-card"><div className="stat-label">CALLS BOOKED</div><div className="stat-value">8</div><div className="stat-sub">discovery calls</div></div>
        <div className="stat-card"><div className="stat-label">AVG CALL TIME</div><div className="stat-value">3:42</div><div className="stat-sub">minutes</div></div>
      </div>
      <div className="section-label">ACTIVE VOICE AGENTS</div>
      {agents.map((agent, i) => (
        <div className="card" key={i} style={{marginBottom:"10px"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px"}}>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px"}}>{agent.name}</div>
            <div className={agent.status === "Live" ? "badge-green" : "badge-yellow"}>{agent.status}</div>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px"}}>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"8px"}}>
              <div style={{fontSize:"18px", fontWeight:600, color:"var(--navy)"}}>{agent.calls}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Calls Today</div>
            </div>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"8px"}}>
              <div style={{fontSize:"18px", fontWeight:600, color:"var(--green)"}}>{agent.qualified}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Qualified</div>
            </div>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"8px"}}>
              <div style={{fontSize:"18px", fontWeight:600, color:"var(--navy)"}}>{agent.booked}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Booked</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
