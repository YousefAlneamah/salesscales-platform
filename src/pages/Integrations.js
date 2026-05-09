import React from "react";

export default function Integrations() {
  const integrations = [
    { name: "Twilio — SMS", meta: "SMS sending and receiving", connected: true },
    { name: "WhatsApp Business", meta: "WhatsApp messaging at scale", connected: true },
    { name: "SendGrid — Email", meta: "Email delivery infrastructure", connected: true },
    { name: "Stripe — Payments", meta: "Payment events and recovery", connected: true },
    { name: "Calendly — Booking", meta: "Call booking automation", connected: true },
    { name: "ElevenLabs — Voice", meta: "AI voice synthesis", connected: true },
    { name: "HeyGen — Video", meta: "AI avatar video production", connected: false },
    { name: "Kajabi — Courses", meta: "Course platform events", connected: false },
    { name: "Zillow — Real Estate", meta: "Lead capture from listings", connected: false },
    { name: "DocuSign — Contracts", meta: "Contract signing triggers", connected: false },
    { name: "Google Analytics", meta: "Website traffic and conversions", connected: false },
    { name: "Zapier", meta: "Custom third party connections", connected: false },
  ];
  return (
    <div>
      <div className="section-label">ALL INTEGRATIONS</div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px"}}>
        {integrations.map((item, i) => (
          <div className="card" key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:600, color:"var(--navy)", fontSize:"12px", marginBottom:"3px"}}>{item.name}</div>
              <div style={{fontSize:"10px", color:"var(--muted)"}}>{item.meta}</div>
            </div>
            {item.connected ? <div className="badge-green">Connected</div> : <button className="btn btn-outline" style={{fontSize:"10px", padding:"4px 10px"}}>Connect</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
