import React from "react";

export default function WhiteLabel() {
  const agencies = [
    { name: "RevScale Agency — Dubai", clients: 12, fee: "$2,400", revenue: "$84K", health: 89 },
    { name: "AiGrowth — London", clients: 8, fee: "$1,600", revenue: "$61K", health: 84 },
    { name: "ScaleForce — New York", clients: 6, fee: "$1,200", revenue: "$47K", health: 91 },
  ];
  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">ACTIVE FRANCHISEES</div><div className="stat-value">7</div><div className="stat-sub">certified agencies</div></div>
        <div className="stat-card"><div className="stat-label">THEIR CLIENTS</div><div className="stat-value">84</div><div className="stat-sub">on the platform</div></div>
        <div className="stat-card"><div className="stat-label">PLATFORM FEES</div><div className="stat-value">$14,000</div><div className="stat-sub">this month</div></div>
        <div className="stat-card"><div className="stat-label">TOTAL SS REVENUE</div><div className="stat-value">$28,400</div><div className="stat-sub">this month</div></div>
      </div>
      <div className="section-label">WHITE LABEL AGENCIES</div>
      {agencies.map((a, i) => (
        <div className="card" key={i} style={{marginBottom:"10px"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px"}}>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"13px"}}>{a.name}</div>
            <div className="badge-green">Active</div>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px"}}>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"8px"}}>
              <div style={{fontSize:"16px", fontWeight:600, color:"var(--navy)"}}>{a.clients}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Clients</div>
            </div>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"8px"}}>
              <div style={{fontSize:"16px", fontWeight:600, color:"var(--green)"}}>{a.fee}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Platform Fee</div>
            </div>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"8px"}}>
              <div style={{fontSize:"16px", fontWeight:600, color:"var(--navy)"}}>{a.revenue}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Their Revenue</div>
            </div>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"8px"}}>
              <div style={{fontSize:"16px", fontWeight:600, color:"var(--green)"}}>{a.health}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Avg Health</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
