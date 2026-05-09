import React from "react";

export default function Analytics() {
  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">TOTAL ATTRIBUTED</div><div className="stat-value">$87,400</div><div className="stat-sub">34% vs last month</div></div>
        <div className="stat-card"><div className="stat-label">AVG OPEN RATE</div><div className="stat-value">64%</div><div className="stat-sub">industry avg 21%</div></div>
        <div className="stat-card"><div className="stat-label">LEADS CAPTURED</div><div className="stat-value">1,284</div><div className="stat-sub">this month</div></div>
        <div className="stat-card"><div className="stat-label">REVENUE FORECAST</div><div className="stat-value">$102K</div><div className="stat-sub">next 30 days</div></div>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px"}}>
        <div className="card">
          <div className="section-label">MONTHLY REVENUE</div>
          <div style={{display:"flex", alignItems:"flex-end", gap:"8px", height:"120px", marginBottom:"20px"}}>
            {[{m:"Jan",v:51,h:45},{m:"Feb",v:58,h:55},{m:"Mar",v:65,h:63},{m:"Apr",v:72,h:71},{m:"May",v:87,h:100}].map(b => (
              <div key={b.m} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", height:"100%"}}>
                <div style={{fontSize:"9px", color:"var(--green)", marginBottom:"3px", fontWeight:600}}>${b.v}k</div>
                <div style={{width:"100%", height:b.h+"%", background: b.m==="May" ? "var(--green)" : "var(--green-light)", borderRadius:"4px 4px 0 0", border:"0.5px solid var(--green-border)"}}></div>
                <div style={{fontSize:"8px", color:"var(--muted)", marginTop:"4px"}}>{b.m}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-label">CHANNEL PERFORMANCE</div>
          {[{n:"Email",p:78},{n:"SMS",p:64},{n:"WhatsApp",p:71},{n:"Instagram",p:55},{n:"Voice",p:42}].map(c => (
            <div key={c.n} style={{display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px"}}>
              <div style={{fontSize:"10px", color:"var(--slate)", width:"70px"}}>{c.n}</div>
              <div style={{flex:1, height:"6px", background:"var(--bg)", borderRadius:"3px"}}>
                <div style={{width:c.p+"%", height:"100%", background:"var(--green)", borderRadius:"3px"}}></div>
              </div>
              <div style={{fontSize:"10px", color:"var(--navy)", fontWeight:500, width:"30px"}}>{c.p}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
