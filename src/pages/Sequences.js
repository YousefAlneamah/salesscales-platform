import React from "react";

export default function Sequences() {
  const sequences = [
    { name: "Luux Bags — Cart Recovery", meta: "Email + SMS • 3 touches • 47 contacts active", openRate: "68%", revenue: "$8,460", status: "Live" },
    { name: "Sarah — Discovery Call Nurture", meta: "Email • 8 touches • 23 contacts active", openRate: "71%", revenue: "$18,000", status: "Live" },
    { name: "Ahmed — New Lead Response", meta: "SMS + Email + Voice • Immediate • 8 leads", openRate: "94%", revenue: "$9,400", status: "Live" },
    { name: "Nova — Course Completion Upsell", meta: "Email • 4 touches • 34 contacts active", openRate: "62%", revenue: "$4,200", status: "Paused" },
    { name: "Luux Bags — Win-Back", meta: "Email + SMS • 3 touches • 120 contacts", openRate: "44%", revenue: "$2,100", status: "Live" },
    { name: "Flex Studio — Post-Purchase", meta: "Email • 5 touches • 89 contacts active", openRate: "58%", revenue: "$3,800", status: "Live" },
  ];

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px"}}>
        <div className="section-label" style={{margin:0}}>ALL SEQUENCES</div>
        <button className="btn btn-green">+ New Sequence</button>
      </div>
      {sequences.map((seq, i) => (
        <div className="card" key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px"}}>
          <div>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px", marginBottom:"3px"}}>{seq.name}</div>
            <div style={{fontSize:"10px", color:"var(--muted)"}}>{seq.meta}</div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:"20px"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"14px", fontWeight:600, color:"var(--green)"}}>{seq.openRate}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Open Rate</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"14px", fontWeight:600, color:"var(--navy)"}}>{seq.revenue}</div>
              <div style={{fontSize:"8px", color:"var(--muted)"}}>Revenue</div>
            </div>
            <div className={seq.status === "Live" ? "badge-green" : "badge-yellow"}>{seq.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
