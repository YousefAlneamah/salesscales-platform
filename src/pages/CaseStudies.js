import React from "react";

export default function CaseStudies() {
  const cases = [
    { title: "Luux Bags — 10.8x ROI in Month One", meta: "Ecommerce • Travel Bags • $16,200 generated", status: "Published" },
    { title: "Sarah — 6x ROI • 6 Extra Discovery Calls", meta: "Coaching • Business • $18,000 generated", status: "Published" },
    { title: "Ahmed — 60 Second Lead Response • 2 Extra Deals", meta: "Real Estate • Residential • $9,400 generated", status: "Draft" },
  ];
  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px"}}>
        <div className="section-label" style={{margin:0}}>CASE STUDIES</div>
        <button className="btn btn-green">+ Generate New</button>
      </div>
      {cases.map((c, i) => (
        <div className="card" key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px"}}>
          <div>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px", marginBottom:"3px"}}>{c.title}</div>
            <div style={{fontSize:"10px", color:"var(--muted)"}}>{c.meta}</div>
          </div>
          <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
            <div className={c.status === "Published" ? "badge-green" : "badge-yellow"}>{c.status}</div>
            <button className="btn btn-outline" style={{fontSize:"10px", padding:"4px 10px"}}>View</button>
            <button className="btn btn-navy" style={{fontSize:"10px", padding:"4px 10px"}}>Share</button>
          </div>
        </div>
      ))}
    </div>
  );
}
