import React from "react";

export default function AIEngine() {
  const feed = [
    { client: "Luux Bags", action: "Cart Recovery Fired", detail: "47 emails sent — confidence 94% — auto-executed", time: "3 min ago", status: "success" },
    { client: "Sarah", action: "Instagram DM Responded", detail: "3 high-intent leads qualified — moved to pipeline", time: "8 min ago", status: "success" },
    { client: "Ahmed", action: "New Listing Detected", detail: "23 matching leads identified — queued for approval", time: "12 min ago", status: "pending" },
    { client: "Nova Courses", action: "Student Re-engagement", detail: "12 inactive students — re-engagement sequence fired", time: "18 min ago", status: "success" },
    { client: "Flex Studio", action: "Price Drop Detected", detail: "AI paused all sequences mentioning old price — updating content", time: "25 min ago", status: "processing" },
    { client: "Sarah", action: "Discovery Call Booked", detail: "Lead from Instagram DM booked a call — confirmation sent", time: "31 min ago", status: "success" },
  ];

  const statusStyle = (s) => {
    if (s === "success") return { background: "#ecfdf5", color: "#059669", border: "0.5px solid #a7f3d0" };
    if (s === "pending") return { background: "#fffbeb", color: "#d97706", border: "0.5px solid #fde68a" };
    return { background: "#eff6ff", color: "#3b82f6", border: "0.5px solid #bfdbfe" };
  };

  const statusLabel = (s) => {
    if (s === "success") return "Success";
    if (s === "pending") return "Pending";
    return "Processing";
  };

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">AI ACTIONS TODAY</div><div className="stat-value">1,847</div><div className="stat-sub">across all clients</div></div>
        <div className="stat-card"><div className="stat-label">AUTO-EXECUTED</div><div className="stat-value">1,803</div><div className="stat-sub">high confidence</div></div>
        <div className="stat-card"><div className="stat-label">SENT TO APPROVAL</div><div className="stat-value">44</div><div className="stat-sub">medium confidence</div></div>
        <div className="stat-card"><div className="stat-label">STOPPED BY AI</div><div className="stat-value">0</div><div className="stat-sub">low confidence today</div></div>
      </div>
      <div className="section-label">LIVE AI ACTIVITY FEED</div>
      {feed.map((item, i) => (
        <div className="card" key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", marginBottom:"8px"}}>
          <div>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"11px", marginBottom:"3px"}}>{item.client} — {item.action}</div>
            <div style={{fontSize:"10px", color:"var(--muted)"}}>{item.detail} — {item.time}</div>
          </div>
          <div style={{fontSize:"9px", padding:"2px 8px", borderRadius:"6px", ...statusStyle(item.status)}}>{statusLabel(item.status)}</div>
        </div>
      ))}
    </div>
  );
}
