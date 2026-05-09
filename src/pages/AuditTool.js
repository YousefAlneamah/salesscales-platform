import React, { useState } from "react";

export default function AuditTool() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const apiUrl = window.location.hostname === "localhost" ? "http://localhost:3001/audit" : "/api/audit";

  const runAudit = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      setResult(data);
    } catch (e) {
      setResult({ error: "Audit failed. Please try again." });
    }
    setLoading(false);
  };

  const copyMessage = () => {
    if (result && result.pitchMessage) {
      navigator.clipboard.writeText(result.pitchMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="section-label">STORE AUDIT TOOL</div>
        <p style={{fontSize:"11px", color:"var(--muted)", marginBottom:"14px"}}>Enter any store URL to reveal revenue gaps and generate a personalised outreach message.</p>
        <div style={{display:"flex", gap:"10px", marginBottom:"16px"}}>
          <input
            style={{flex:1, border:"0.5px solid var(--border)", borderRadius:"7px", padding:"9px 12px", fontSize:"12px", color:"var(--navy)", outline:"none"}}
            placeholder="e.g. luuxbags.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runAudit()}
          />
          <button className="btn btn-green" onClick={runAudit} disabled={loading}>
            {loading ? "Analyzing..." : "Run Audit"}
          </button>
        </div>

        {loading && (
          <div style={{textAlign:"center", padding:"30px", color:"var(--muted)", fontSize:"12px"}}>
            Aria is analyzing the store...
          </div>
        )}

        {result && !result.error && (
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px"}}>
            <div>
              <div style={{width:"70px", height:"70px", borderRadius:"50%", border:"3px solid var(--green)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", marginBottom:"12px"}}>
                <div style={{fontSize:"22px", fontWeight:600, color:"var(--navy)", lineHeight:1}}>{result.score}</div>
                <div style={{fontSize:"8px", color:"var(--muted)"}}>/100</div>
              </div>
              <div style={{fontWeight:600, color:"var(--navy)", fontSize:"14px", marginBottom:"2px"}}>{result.brandName}</div>
              <div style={{fontSize:"11px", color:"var(--muted)", marginBottom:"12px"}}>{result.niche} — AOV {result.estimatedAOV} — Est. {result.estimatedMonthlyRevenue}/mo</div>

              {[
                { label: "Email Capture", value: result.hasEmailPopup },
                { label: "Cart Recovery", value: result.hasCartRecovery === true || result.hasCartRecovery === "likely" },
                { label: "SMS Automation", value: result.hasSMS },
                { label: "WhatsApp", value: result.hasWhatsApp },
                { label: "AI Voice Agent", value: result.hasAIVoice },
              ].map(item => (
                <div key={item.label} style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", borderBottom:"0.5px solid #f8f9fc"}}>
                  <span style={{fontSize:"11px", color:"var(--slate)"}}>{item.label}</span>
                  <span className={item.value ? "badge-green" : "badge-red"}>{item.value ? "Present" : "Missing"}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="section-label">BIGGEST GAP</div>
              <div style={{background:"var(--bg)", border:"0.5px solid var(--border)", borderRadius:"7px", padding:"10px", fontSize:"11px", color:"var(--slate)", lineHeight:1.6, marginBottom:"14px"}}>
                {result.biggestGap}
              </div>
              <div className="section-label">OUTREACH MESSAGE</div>
              <div style={{background:"var(--bg)", border:"0.5px solid var(--border)", borderRadius:"7px", padding:"10px", fontSize:"11px", color:"var(--slate)", lineHeight:1.6, marginBottom:"10px"}}>
                {result.pitchMessage}
              </div>
              <div style={{display:"flex", gap:"8px"}}>
                <button className="btn btn-navy" style={{flex:1}} onClick={copyMessage}>
                  {copied ? "Copied!" : "Copy Message"}
                </button>
              </div>
            </div>
          </div>
        )}

        {result && result.error && (
          <div style={{color:"var(--red)", fontSize:"12px", padding:"10px"}}>{result.error}</div>
        )}
      </div>
    </div>
  );
}
