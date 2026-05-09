import React from "react";

export default function SocialAutomation() {
  const content = [
    { emoji: "??", title: "How AI recovered $16,200 for a travel bag brand in month one", meta: "Publishing Tomorrow 9:00 AM — AI Avatar Video — 47 seconds", platforms: ["TikTok", "Instagram"] },
    { emoji: "??", title: "The 3 sequences every ecommerce brand needs but 90% are missing", meta: "Publishing Wednesday 11:00 AM — Carousel Post", platforms: ["Instagram", "LinkedIn"] },
    { emoji: "??", title: "Building a billion dollar AI platform as a solo founder — week 3", meta: "Publishing Friday 6:00 PM — AI Avatar Video — 62 seconds", platforms: ["TikTok", "Instagram", "Facebook"] },
    { emoji: "??", title: "Why your abandoned cart emails are not converting and how to fix it", meta: "Publishing Saturday 10:00 AM — Text Post", platforms: ["LinkedIn", "X"] },
  ];
  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">POSTS THIS MONTH</div><div className="stat-value">84</div><div className="stat-sub">across all platforms</div></div>
        <div className="stat-card"><div className="stat-label">LEADS FROM SOCIAL</div><div className="stat-value">23</div><div className="stat-sub">into my pipeline</div></div>
        <div className="stat-card"><div className="stat-label">VIDEOS PRODUCED</div><div className="stat-value">12</div><div className="stat-sub">AI avatar — no filming</div></div>
        <div className="stat-card"><div className="stat-label">NEXT REVIEW</div><div className="stat-value">Mon</div><div className="stat-sub">7 days queued</div></div>
      </div>
      <div className="section-label">UPCOMING CONTENT — THIS WEEK</div>
      {content.map((item, i) => (
        <div className="card" key={i} style={{display:"flex", alignItems:"center", gap:"14px", marginBottom:"8px"}}>
          <div style={{width:"50px", height:"50px", borderRadius:"8px", background:"var(--green-light)", border:"0.5px solid var(--green-border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0}}>{item.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px", marginBottom:"3px"}}>{item.title}</div>
            <div style={{fontSize:"10px", color:"var(--muted)", marginBottom:"5px"}}>{item.meta}</div>
            <div style={{display:"flex", gap:"4px"}}>
              {item.platforms.map(p => <span key={p} style={{fontSize:"8px", padding:"1px 6px", borderRadius:"4px", background:"var(--green-light)", color:"var(--green)", border:"0.5px solid var(--green-border)"}}>{p}</span>)}
            </div>
          </div>
          <div style={{display:"flex", gap:"6px"}}>
            <button className="btn btn-outline" style={{fontSize:"10px", padding:"4px 10px"}}>Edit</button>
            <button className="btn btn-green" style={{fontSize:"10px", padding:"4px 10px"}}>Approve</button>
          </div>
        </div>
      ))}
    </div>
  );
}
