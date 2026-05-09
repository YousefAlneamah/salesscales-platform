import React from "react";

export default function Pipeline() {
  const stages = [
    { name: "NEW LEADS", count: 14, color: "#10b981", items: [
      { name: "James K.", detail: "Luux Bags lead", time: "2 min ago" },
      { name: "Maria S.", detail: "Sarah coaching", time: "14 min ago" },
      { name: "David R.", detail: "Ahmed real estate", time: "1 hr ago" },
    ]},
    { name: "NURTURING", count: 31, color: "#3b82f6", items: [
      { name: "Anna L.", detail: "Day 4 sequence", time: "Email opened" },
      { name: "Tom B.", detail: "Day 8 sequence", time: "Link clicked" },
      { name: "Rachel M.", detail: "Day 12 sequence", time: "No response" },
    ]},
    { name: "HOT LEADS", count: 8, color: "#f59e0b", items: [
      { name: "Rachel M.", detail: "High intent", time: "Viewed 3x" },
      { name: "Chris T.", detail: "High intent", time: "Replied to email" },
    ]},
    { name: "CONVERTED", count: 47, color: "#059669", items: [
      { name: "Sophie W.", detail: "$6,000 closed", time: "Today" },
      { name: "Mike P.", detail: "$180 purchase", time: "Yesterday" },
      { name: "Lisa R.", detail: "$3,000 closed", time: "2 days ago" },
    ]},
  ];

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px"}}>
        <div className="section-label" style={{margin:0}}>CRM PIPELINE — ALL CLIENTS</div>
        <button className="btn btn-outline">Filter by Client</button>
      </div>
      <div style={{display:"flex", gap:"12px", overflowX:"auto", paddingBottom:"8px"}}>
        {stages.map(stage => (
          <div key={stage.name} style={{minWidth:"200px", flex:1}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"var(--surface)", border:"0.5px solid var(--border)", borderRadius:"8px 8px 0 0", borderBottom:"2px solid "+stage.color}}>
              <div style={{fontSize:"9px", fontWeight:600, color:"var(--muted)", letterSpacing:"1px"}}>{stage.name}</div>
              <div style={{fontSize:"11px", fontWeight:600, color:stage.color}}>{stage.count}</div>
            </div>
            <div style={{background:"var(--bg)", border:"0.5px solid var(--border)", borderTop:"none", borderRadius:"0 0 8px 8px", padding:"8px", minHeight:"200px"}}>
              {stage.items.map((item, i) => (
                <div key={i} style={{background:"var(--surface)", border:"0.5px solid var(--border)", borderRadius:"6px", padding:"8px 10px", marginBottom:"6px"}}>
                  <div style={{fontSize:"11px", fontWeight:500, color:"var(--navy)"}}>{item.name}</div>
                  <div style={{fontSize:"9px", color:"var(--green)", marginTop:"2px"}}>{item.detail}</div>
                  <div style={{fontSize:"9px", color:"var(--muted)", marginTop:"1px"}}>{item.time}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
