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
      setResult({ error: "Audit failed. Make sure the server is running." });
    }
    setLoading(false);
  };

  const impactColor = (impact) => {
    if (impact === "High") return { background: "#fef2f2", color: "#dc2626", border: "0.5px solid #fecaca" };
    if (impact === "Medium") return { background: "#fffbeb", color: "#d97706", border: "0.5px solid #fde68a" };
    return { background: "var(--blue-light)", color: "var(--blue)", border: "0.5px solid var(--blue-border)" };
  };

  return (
    <div>
      <div className="card">
        <div style={{fontSize:"18px", fontWeight:700, color:"var(--navy)", marginBottom:"6px"}}>Revenue Audit Tool</div>
        <div style={{fontSize:"13px", color:"var(--muted)", marginBottom:"18px"}}>Enter any store or business URL. Zainab analyzes everything and reveals exactly how much revenue they are losing and why.</div>
        <div style={{display:"flex", gap:"12px"}}>
          <input
            style={{flex:1, border:"0.5px solid var(--border)", borderRadius:"8px", padding:"11px 14px", fontSize:"14px", color:"var(--navy)", outline:"none"}}
            placeholder="e.g. luuxbags.com or anycoach.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runAudit()}
          />
          <button className="btn btn-green" style={{padding:"11px 24px", fontSize:"14px"}} onClick={runAudit} disabled={loading}>
            {loading ? "Analyzing..." : "Run Audit"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="card" style={{textAlign:"center", padding:"50px"}}>
          <div style={{fontSize:"16px", color:"var(--navy)", fontWeight:600, marginBottom:"8px"}}>Zainab is analyzing the business...</div>
          <div style={{fontSize:"13px", color:"var(--muted)"}}>Reading their marketing, automation gaps, and revenue opportunities. This takes about 30 seconds.</div>
        </div>
      )}

      {result && !result.error && (
        <div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"14px", marginBottom:"14px"}}>
            <div className="stat-card gold-top">
              <div className="stat-label">REVENUE SCORE</div>
              <div className="stat-value">{result.score}/100</div>
              <div className="stat-sub-gold">revenue system strength</div>
            </div>
            <div className="stat-card gold-top">
              <div className="stat-label">EST. MONTHLY REVENUE</div>
              <div className="stat-value" style={{fontSize:"18px"}}>{result.estimatedMonthlyRevenue}</div>
              <div className="stat-sub-gold">AOV {result.estimatedAOV}</div>
            </div>
            <div className="stat-card" style={{borderTop:"2px solid var(--red)"}}>
              <div className="stat-label">ESTIMATED MONTHLY LOSS</div>
              <div className="stat-value" style={{fontSize:"18px", color:"var(--red)"}}>{result.estimatedMonthlyLoss}</div>
              <div style={{fontSize:"11px", color:"var(--red)", marginTop:"3px"}}>from missing automations</div>
            </div>
          </div>

          <div className="card" style={{marginBottom:"14px"}}>
            <div className="section-label" style={{marginBottom:"14px"}}>AUTOMATION HEALTH CHECK — {result.brandName}</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px"}}>
              {[
                {label:"Email Capture", value: result.hasEmailPopup},
                {label:"Cart Recovery", value: result.hasCartRecovery},
                {label:"SMS", value: result.hasSMS},
                {label:"WhatsApp", value: result.hasWhatsApp},
                {label:"AI Voice", value: result.hasAIVoice},
                {label:"Post-Purchase", value: result.hasPostPurchase},
                {label:"Win-Back", value: result.hasWinBack},
                {label:"Upsell", value: result.hasUpsell},
              ].map(item => (
                <div key={item.label} style={{background:"var(--bg)", borderRadius:"8px", padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                  <span style={{fontSize:"12px", color:"var(--slate)"}}>{item.label}</span>
                  <span style={{fontSize:"10px", padding:"2px 8px", borderRadius:"6px", fontWeight:600, ...(item.value ? {background:"var(--blue-light)", color:"var(--blue)", border:"0.5px solid var(--blue-border)"} : {background:"#fef2f2", color:"var(--red)", border:"0.5px solid #fecaca"})}}>
                    {item.value ? "Yes" : "No"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {result.gaps && result.gaps.length > 0 && (
            <div className="card" style={{marginBottom:"14px"}}>
              <div className="section-label" style={{marginBottom:"14px"}}>REVENUE GAP ANALYSIS — DETAILED BREAKDOWN</div>
              {result.gaps.map((gap, i) => (
                <div key={i} style={{background:"var(--bg)", border:"0.5px solid var(--border)", borderRadius:"10px", padding:"14px 16px", marginBottom:"10px"}}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px"}}>
                    <div style={{fontWeight:700, color:"var(--navy)", fontSize:"14px"}}>{gap.name}</div>
                    <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
                      <span style={{fontSize:"11px", padding:"3px 9px", borderRadius:"6px", fontWeight:600, ...impactColor(gap.impact)}}>{gap.impact} Impact</span>
                      <span style={{fontSize:"13px", fontWeight:700, color:"var(--red)"}}>{gap.estimatedLoss}</span>
                    </div>
                  </div>
                  <div style={{fontSize:"13px", color:"var(--muted)", marginBottom:"8px", lineHeight:1.6}}>{gap.description}</div>
                  <div style={{fontSize:"12px", color:"var(--navy)", background:"var(--surface)", border:"0.5px solid var(--border)", borderRadius:"7px", padding:"10px 12px", lineHeight:1.6}}>
                    <span style={{fontWeight:600, color:"var(--blue)"}}>Recommendation: </span>{gap.recommendation}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"14px"}}>
            <div className="card">
              <div className="section-label">BIGGEST GAP</div>
              <div style={{fontSize:"13px", color:"var(--slate)", lineHeight:1.7}}>{result.biggestGap}</div>
            </div>
            <div className="card">
              <div className="section-label">QUICK WIN THIS WEEK</div>
              <div style={{fontSize:"13px", color:"var(--slate)", lineHeight:1.7}}>{result.quickWin}</div>
            </div>
          </div>

          {result.competitorInsight && (
            <div className="card" style={{marginBottom:"14px", borderLeft:"3px solid var(--gold)"}}>
              <div className="section-label">COMPETITOR INSIGHT</div>
              <div style={{fontSize:"13px", color:"var(--slate)", lineHeight:1.7}}>{result.competitorInsight}</div>
            </div>
          )}

          <div className="card">
            <div className="section-label">PERSONALISED OUTREACH MESSAGE</div>
            <div style={{background:"var(--bg)", border:"0.5px solid var(--border)", borderRadius:"8px", padding:"14px 16px", fontSize:"13px", color:"var(--slate)", lineHeight:1.8, marginBottom:"12px"}}>
              {result.pitchMessage}
            </div>
            <button className="btn btn-green" style={{fontSize:"13px", padding:"10px 20px"}} onClick={() => { navigator.clipboard.writeText(result.pitchMessage); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? "Copied!" : "Copy Outreach Message"}
            </button>
          </div>
        </div>
      )}

      {result && result.error && (
        <div className="card" style={{textAlign:"center", padding:"30px"}}>
          <div style={{color:"var(--red)", fontSize:"14px", fontWeight:500}}>{result.error}</div>
        </div>
      )}
    </div>
  );
}
