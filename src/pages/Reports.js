import React from "react";

export default function Reports() {
  const reports = [
    { client: "Luux Bags", month: "May 2026", revenue: "$16,200", roi: "10.8x", openRate: "68%", delivered: "May 1" },
    { client: "Sarah — Coach", month: "May 2026", revenue: "$18,000", roi: "6x", openRate: "71%", delivered: "May 1" },
    { client: "Ahmed — Real Estate", month: "May 2026", revenue: "$9,400", roi: "4.7x", openRate: "58%", delivered: "May 1" },
    { client: "Nova Courses", month: "May 2026", revenue: "$11,800", roi: "5.9x", openRate: "64%", delivered: "May 1" },
  ];
  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px"}}>
        <div className="section-label" style={{margin:0}}>MONTHLY REPORTS</div>
        <button className="btn btn-green">Generate All Reports</button>
      </div>
      {reports.map((r, i) => (
        <div className="card" key={i} style={{marginBottom:"10px"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px"}}>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"13px"}}>{r.client} — {r.month}</div>
            <div style={{fontSize:"10px", color:"var(--muted)"}}>Delivered {r.delivered} — Auto-generated</div>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginBottom:"12px"}}>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"10px"}}>
              <div style={{fontSize:"18px", fontWeight:600, color:"var(--green)"}}>{r.revenue}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Revenue Generated</div>
            </div>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"10px"}}>
              <div style={{fontSize:"18px", fontWeight:600, color:"var(--navy)"}}>{r.roi}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>ROI</div>
            </div>
            <div style={{textAlign:"center", background:"var(--bg)", borderRadius:"6px", padding:"10px"}}>
              <div style={{fontSize:"18px", fontWeight:600, color:"var(--navy)"}}>{r.openRate}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Avg Open Rate</div>
            </div>
          </div>
          <div style={{display:"flex", gap:"8px"}}>
            <button className="btn btn-navy" style={{flex:1}}>View Report</button>
            <button className="btn btn-outline" style={{flex:1}}>Download PDF</button>
          </div>
        </div>
      ))}
    </div>
  );
}
