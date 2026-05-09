import React, { useState } from "react";

export default function Settings() {
  const [settings, setSettings] = useState({
    autoExecute: true, morningMessage: true, anomalyPause: true, quarterlyAudit: true,
    approvalAlerts: true, healthAlerts: true, leadNotifications: true, weeklyReport: false,
  });

  const toggle = (key) => setSettings(s => ({...s, [key]: !s[key]}));

  return (
    <div>
      <div className="card" style={{marginBottom:"12px"}}>
        <div className="section-label">AI BEHAVIOR</div>
        {[
          { label: "Auto-execute high confidence actions", desc: "AI executes automatically when confidence is above 90%", k: "autoExecute" },
          { label: "Morning opportunity message", desc: "Receive one AI opportunity alert every morning at 8am", k: "morningMessage" },
          { label: "Anomaly auto-pause", desc: "Automatically pause sequences when anomalies are detected", k: "anomalyPause" },
          { label: "Quarterly system audit", desc: "Run automated audit of all client systems every 90 days", k: "quarterlyAudit" },
        ].map(row => (
          <div key={row.k} style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:"0.5px solid var(--bg)"}}>
            <div>
              <div style={{fontSize:"12px", fontWeight:500, color:"var(--navy)"}}>{row.label}</div>
              <div style={{fontSize:"10px", color:"var(--muted)", marginTop:"2px"}}>{row.desc}</div>
            </div>
            <div onClick={() => toggle(row.k)} style={{width:"36px", height:"20px", borderRadius:"10px", background: settings[row.k] ? "var(--green)" : "var(--border)", position:"relative", cursor:"pointer"}}>
              <div style={{width:"16px", height:"16px", borderRadius:"50%", background:"#fff", position:"absolute", top:"2px", right: settings[row.k] ? "2px" : "auto", left: settings[row.k] ? "auto" : "2px"}}></div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="section-label">NOTIFICATIONS</div>
        {[
          { label: "Approval queue alerts", desc: "Get notified when urgent items need review", k: "approvalAlerts" },
          { label: "Client health score alerts", desc: "Alert when any client score drops below 70", k: "healthAlerts" },
          { label: "New lead notifications", desc: "Real-time alerts when high-intent leads enter pipeline", k: "leadNotifications" },
          { label: "Weekly performance summary", desc: "Receive a weekly summary of all client performance", k: "weeklyReport" },
        ].map(row => (
          <div key={row.k} style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:"0.5px solid var(--bg)"}}>
            <div>
              <div style={{fontSize:"12px", fontWeight:500, color:"var(--navy)"}}>{row.label}</div>
              <div style={{fontSize:"10px", color:"var(--muted)", marginTop:"2px"}}>{row.desc}</div>
            </div>
            <div onClick={() => toggle(row.k)} style={{width:"36px", height:"20px", borderRadius:"10px", background: settings[row.k] ? "var(--green)" : "var(--border)", position:"relative", cursor:"pointer"}}>
              <div style={{width:"16px", height:"16px", borderRadius:"50%", background:"#fff", position:"absolute", top:"2px", right: settings[row.k] ? "2px" : "auto", left: settings[row.k] ? "auto" : "2px"}}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
