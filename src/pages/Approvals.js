import React, { useState } from "react";

export default function Approvals() {
  const [items, setItems] = useState([
    { id: 1, client: "Luux Bags", action: "Cart Recovery Email", priority: "Urgent", confidence: 72, text: "AI wants to send cart recovery email to 47 customers who abandoned carts over $150 in the last 24 hours. No discount language used — brand voice confirmed." },
    { id: 2, client: "Ahmed — Real Estate", action: "New Listing Alert SMS", priority: "Important", confidence: 85, text: "New listing detected matching 23 leads in pipeline. AI wants to fire new listing alert SMS to all 23 leads within 30 minutes while the listing is fresh." },
    { id: 3, client: "Sarah — Coach", action: "Discovery Call Follow-Up", priority: "Low", confidence: 91, text: "Post-call follow-up to 3 leads who attended discovery calls yesterday. Personalized emails addressing their specific objections from the call." },
    { id: 4, client: "Nova Courses", action: "Student Re-engagement", priority: "Low", confidence: 88, text: "12 students have not logged in for 14 days. AI wants to send a re-engagement sequence to get them back on track with their course progress." },
  ]);

  const remove = (id) => setItems(items.filter(i => i.id !== id));

  const priorityColor = (p) => {
    if (p === "Urgent") return "badge-red";
    if (p === "Important") return "badge-yellow";
    return "badge-green";
  };

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px"}}>
        <div className="section-label" style={{margin:0}}>APPROVAL QUEUE — {items.length} ITEMS</div>
        <button className="btn btn-green" onClick={() => setItems([])}>Approve All</button>
      </div>
      {items.length === 0 && (
        <div className="card" style={{textAlign:"center", padding:"40px", color:"var(--muted)"}}>
          All caught up. No items waiting for approval.
        </div>
      )}
      {items.map(item => (
        <div className="card" key={item.id}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px"}}>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px"}}>{item.client} — {item.action}</div>
            <div className={priorityColor(item.priority)}>{item.priority}</div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px"}}>
            <div style={{fontSize:"9px", color:"var(--muted)"}}>Confidence</div>
            <div style={{flex:1, height:"4px", background:"var(--border)", borderRadius:"2px"}}>
              <div style={{width:item.confidence+"%", height:"100%", background:"var(--green)", borderRadius:"2px"}}></div>
            </div>
            <div style={{fontSize:"9px", color:"var(--green)", fontWeight:600}}>{item.confidence}%</div>
          </div>
          <div style={{fontSize:"11px", color:"#64748b", lineHeight:1.6, marginBottom:"10px"}}>{item.text}</div>
          <div style={{display:"flex", gap:"8px"}}>
            <button className="btn btn-green" onClick={() => remove(item.id)}>Approve</button>
            <button className="btn btn-outline">Edit</button>
            <button className="btn btn-red" onClick={() => remove(item.id)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
