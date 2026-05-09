import React from "react";

export default function SocialMedia() {
  const platforms = [
    { name: "Instagram", meta: "DM automation • Story replies • Post scheduling", connected: true },
    { name: "Facebook", meta: "Page DMs • Ad comment replies • Scheduling", connected: true },
    { name: "TikTok", meta: "Video scheduling • Comment monitoring • DMs", connected: true },
    { name: "LinkedIn", meta: "Post scheduling • Connection sequences", connected: false },
    { name: "X Twitter", meta: "Post scheduling • Mention monitoring", connected: false },
    { name: "YouTube", meta: "Video publishing • Comment monitoring", connected: false },
  ];
  return (
    <div>
      <div className="section-label">SOCIAL MEDIA INTEGRATIONS</div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px"}}>
        {platforms.map((p, i) => (
          <div className="card" key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px", marginBottom:"3px"}}>{p.name}</div>
              <div style={{fontSize:"10px", color:"var(--muted)"}}>{p.meta}</div>
            </div>
            {p.connected ? <div className="badge-green">Connected</div> : <button className="btn btn-outline" style={{fontSize:"10px", padding:"4px 10px"}}>Connect</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
