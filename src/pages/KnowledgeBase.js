import React from "react";

export default function KnowledgeBase() {
  const docs = [
    { name: "Luux Bags — Brand Guidelines", meta: "Uploaded 3 days ago • 12 pages • Active in AI", status: "Trained" },
    { name: "Luux Bags — Product Catalog", meta: "Uploaded 3 days ago • 8 products • Active in AI", status: "Trained" },
    { name: "Luux Bags — Top 50 Customer Reviews", meta: "Uploaded 2 days ago • 50 reviews • Active in AI", status: "Trained" },
    { name: "Sarah — Coaching Program Curriculum", meta: "Uploaded 5 days ago • 24 pages • Active in AI", status: "Trained" },
    { name: "Sarah — Client Testimonials", meta: "Uploaded 5 days ago • 10 testimonials • Active in AI", status: "Trained" },
    { name: "Ahmed — MLS Listing Data", meta: "Auto-synced daily • 47 active listings • Active in AI", status: "Trained" },
    { name: "Nova — Course Content Library", meta: "Uploaded 1 week ago • 8 modules • Active in AI", status: "Trained" },
  ];
  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px"}}>
        <div className="section-label" style={{margin:0}}>KNOWLEDGE BASE — ALL CLIENTS</div>
        <button className="btn btn-green">+ Add Document</button>
      </div>
      {docs.map((doc, i) => (
        <div className="card" key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px"}}>
          <div>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px", marginBottom:"3px"}}>{doc.name}</div>
            <div style={{fontSize:"10px", color:"var(--muted)"}}>{doc.meta}</div>
          </div>
          <div className="badge-green">{doc.status}</div>
        </div>
      ))}
    </div>
  );
}
