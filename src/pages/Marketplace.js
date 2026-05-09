import React from "react";

export default function Marketplace() {
  const agencies = [
    { emoji: "??", name: "GrowthLab Agency — Email Marketing", meta: "Certified Partner • 47 completed projects • 4.9 rating", price: "From $800" },
    { emoji: "??", name: "SocialPro — Instagram Growth", meta: "Certified Partner • 32 completed projects • 4.8 rating", price: "From $600" },
    { emoji: "??", name: "VideoFirst — Content Production", meta: "Certified Partner • 28 completed projects • 4.7 rating", price: "From $1,200" },
    { emoji: "??", name: "EmailPro — Deliverability", meta: "Certified Partner • 19 completed projects • 4.9 rating", price: "From $400" },
  ];
  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">LISTED AGENCIES</div><div className="stat-value">24</div><div className="stat-sub">verified partners</div></div>
        <div className="stat-card"><div className="stat-label">TRANSACTIONS</div><div className="stat-value">$48K</div><div className="stat-sub">this month</div></div>
        <div className="stat-card"><div className="stat-label">SS COMMISSION</div><div className="stat-value">$4,800</div><div className="stat-sub">10% this month</div></div>
        <div className="stat-card"><div className="stat-label">NEW LISTINGS</div><div className="stat-value">3</div><div className="stat-sub">this week</div></div>
      </div>
      <div className="section-label">AGENCY MARKETPLACE</div>
      {agencies.map((a, i) => (
        <div className="card" key={i} style={{display:"flex", alignItems:"center", gap:"14px", marginBottom:"8px"}}>
          <div style={{width:"40px", height:"40px", borderRadius:"8px", background:"var(--green-light)", border:"0.5px solid var(--green-border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0}}>{a.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px", marginBottom:"2px"}}>{a.name}</div>
            <div style={{fontSize:"10px", color:"var(--muted)"}}>{a.meta}</div>
          </div>
          <div style={{fontWeight:600, color:"var(--green)", fontSize:"12px"}}>{a.price}</div>
        </div>
      ))}
    </div>
  );
}
