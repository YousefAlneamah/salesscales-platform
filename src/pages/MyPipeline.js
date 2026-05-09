import React from "react";

export default function MyPipeline() {
  const stages = [
    { name: "PROSPECTS", count: 12, items: [
      { name: "Peak Fitness", detail: "Ecommerce", time: "Audit sent" },
      { name: "Lisa Chen", detail: "Life Coach", time: "LinkedIn DM" },
      { name: "Bali Bliss", detail: "Ecommerce", time: "Cold outreach" },
    ]},
    { name: "AUDIT SENT", count: 8, items: [
      { name: "TechGear Pro", detail: "Opened 3x", time: "$14K gap found" },
      { name: "Coach Ryan", detail: "Opened once", time: "$8K gap found" },
    ]},
    { name: "CALL BOOKED", count: 4, items: [
      { name: "StyleHaus", detail: "Tomorrow 3pm", time: "Growth tier" },
      { name: "PropertyPro", detail: "Friday 11am", time: "Elite tier" },
    ]},
    { name: "CLOSED", count: 2, items: [
      { name: "Luux Bags", detail: "$1,000/mo", time: "Case study" },
      { name: "Sarah Coach", detail: "$3,000/mo", time: "Growth tier" },
    ]},
  ];
  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px"}}>
        <div className="section-label" style={{margin:0}}>SALES SCALES — MY PROSPECT PIPELINE</div>
        <button className="btn btn-green">+ Add Prospect</button>
      </div>
      <div style={{display:"flex", gap:"12px", overflowX:"auto", paddingBottom:"8px"}}>
        {stages.map(stage => (
          <div key={stage.name} style={{minWidth:"200px", flex:1}}>
            <div style={{display:"flex", justifyContent:"space-between", padding:"8px 12px", background:"var(--surface)", border:"0.5px solid var(--border)", borderRadius:"8px 8px 0 0", borderBottom:"2px solid var(--green)"}}>
              <div style={{fontSize:"9px", fontWeight:600, color:"var(--muted)", letterSpacing:"1px"}}>{stage.name}</div>
              <div style={{fontSize:"11px", fontWeight:600, color:"var(--green)"}}>{stage.count}</div>
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
