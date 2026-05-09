import React, { useState } from "react";

export default function Inbox() {
  const [active, setActive] = useState(0);
  const messages = [
    { name: "James K.", client: "Luux Bags", channel: "Instagram DM", time: "2 min ago", msg: "Hi, I was looking at the weekender bag earlier. Does it come in navy blue? Also what is the return policy?", avatar: "J", unread: true },
    { name: "Maria S.", client: "Sarah Coaching", channel: "Email", time: "8 min ago", msg: "I watched your free training and I am really interested in the 6-month program. Can you tell me more about what is included?", avatar: "M", unread: true },
    { name: "David R.", client: "Ahmed Real Estate", channel: "SMS", time: "15 min ago", msg: "We are looking for a 3-bedroom in the downtown area. Budget around $650K. Are there any new listings?", avatar: "D", unread: true },
    { name: "Anna L.", client: "Luux Bags", channel: "WhatsApp", time: "22 min ago", msg: "Just received my bag and I absolutely love it! The quality is incredible. Will definitely be buying the travel set next.", avatar: "A", unread: false },
    { name: "Chris T.", client: "Sarah Coaching", channel: "Email", time: "45 min ago", msg: "I have been following you for a while and I think I am finally ready to invest in coaching. What does the process look like?", avatar: "C", unread: false },
  ];

  const channelColor = (ch) => {
    if (ch === "Email") return { background: "#eff6ff", color: "#3b82f6" };
    if (ch === "SMS") return { background: "#fdf4ff", color: "#a855f7" };
    if (ch === "WhatsApp") return { background: "#ecfdf5", color: "#10b981" };
    return { background: "#fff1f2", color: "#f43f5e" };
  };

  return (
    <div style={{display:"grid", gridTemplateColumns:"300px 1fr", gap:"12px", height:"calc(100vh - 120px)"}}>
      <div style={{background:"var(--surface)", border:"0.5px solid var(--border)", borderRadius:"10px", overflow:"hidden"}}>
        <div style={{padding:"12px 14px", borderBottom:"0.5px solid var(--border)", fontSize:"10px", fontWeight:600, color:"var(--muted)", letterSpacing:"1px"}}>UNIFIED INBOX — {messages.filter(m=>m.unread).length} UNREAD</div>
        {messages.map((msg, i) => (
          <div key={i} onClick={() => setActive(i)} style={{padding:"12px 14px", borderBottom:"0.5px solid #f8f9fc", cursor:"pointer", background: active === i ? "var(--green-light)" : "var(--surface)", borderLeft: active === i ? "2px solid var(--green)" : "2px solid transparent"}}>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:"3px"}}>
              <div style={{fontWeight:600, color:"var(--navy)", fontSize:"11px"}}>{msg.name}</div>
              <div style={{fontSize:"9px", color:"var(--muted)"}}>{msg.time}</div>
            </div>
            <div style={{fontSize:"9px", color:"var(--green)", marginBottom:"3px"}}>{msg.client}</div>
            <div style={{fontSize:"10px", color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{msg.msg}</div>
            <div style={{marginTop:"4px"}}><span style={{fontSize:"8px", padding:"1px 6px", borderRadius:"4px", ...channelColor(msg.channel)}}>{msg.channel}</span></div>
          </div>
        ))}
      </div>
      <div style={{background:"var(--surface)", border:"0.5px solid var(--border)", borderRadius:"10px", padding:"16px", display:"flex", flexDirection:"column"}}>
        <div style={{borderBottom:"0.5px solid var(--border)", paddingBottom:"12px", marginBottom:"12px"}}>
          <div style={{fontWeight:600, color:"var(--navy)", fontSize:"13px"}}>{messages[active].name}</div>
          <div style={{fontSize:"10px", color:"var(--muted)", marginTop:"2px"}}>{messages[active].client} — <span style={{padding:"1px 6px", borderRadius:"4px", fontSize:"9px", ...channelColor(messages[active].channel)}}>{messages[active].channel}</span></div>
        </div>
        <div style={{flex:1, display:"flex", alignItems:"flex-start"}}>
          <div style={{background:"var(--bg)", borderRadius:"10px", padding:"12px 14px", fontSize:"12px", color:"var(--slate)", lineHeight:1.6, maxWidth:"80%"}}>
            {messages[active].msg}
          </div>
        </div>
        <div style={{borderTop:"0.5px solid var(--border)", paddingTop:"12px", marginTop:"12px"}}>
          <div style={{fontSize:"10px", color:"var(--green)", marginBottom:"8px", fontWeight:500}}>AI Suggested Reply:</div>
          <div style={{background:"var(--green-light)", border:"0.5px solid var(--green-border)", borderRadius:"8px", padding:"10px 12px", fontSize:"11px", color:"var(--slate)", lineHeight:1.6, marginBottom:"8px"}}>
            Hi! Thanks for reaching out. I would love to help you with that. Let me get you the information you need right away.
          </div>
          <div style={{display:"flex", gap:"8px"}}>
            <button className="btn btn-green" style={{flex:1}}>Send AI Reply</button>
            <button className="btn btn-outline">Edit Reply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
