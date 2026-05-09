import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Onboarding() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    business_type: "", niche: "", monthly_revenue: "", monthly_leads: "",
    biggest_challenge: "", brand_voice: "", never_use_words: "", off_limits: "",
    bad_experience: "", ideal_customer: "", what_makes_different: "",
    approval_threshold: "review_uncertain", website_url: "", extra_notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").eq("status", "onboarding");
    if (data) setClients(data);
  };

  const save = async () => {
    setSaving(true);
    await supabase.from("onboarding").insert([{ client_id: selected.id, business_type: form.business_type, niche: form.niche, answers: form, completed: true }]);
    await supabase.from("clients").update({ status: "live", niche: form.niche, business_type: form.business_type }).eq("id", selected.id);
    setSaving(false);
    setDone(true);
  };

  const ariaMessage = (s) => {
    const msgs = {
      1: `Hi ${selected?.name || "there"}! I am Aria, your AI revenue partner. I am going to ask you some questions about your business so I can build your revenue system correctly. This takes about 10 minutes. Let us start with the basics.`,
      2: "Great! Now tell me about your brand voice and what makes you unique so I can write in your exact style.",
      3: "Perfect. Now let me understand your customers and what has worked or not worked for you before.",
      4: "Almost done! Last few questions and then I will build your complete system.",
      5: "I have everything I need. Here is a summary of what I learned about your business. Please review and confirm.",
    };
    return msgs[s] || "";
  };

  if (done) return (
    <div className="card" style={{ textAlign: "center", padding: "40px" }}>
      <div style={{ fontSize: "40px", marginBottom: "16px" }}>?</div>
      <div style={{ fontWeight: 600, color: "var(--navy)", fontSize: "16px", marginBottom: "8px" }}>Onboarding Complete!</div>
      <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>{selected?.name} is now live. Aria is building their revenue system.</div>
      <button className="btn btn-green" onClick={() => { setSelected(null); setStep(1); setDone(false); fetchClients(); }}>Onboard Another Client</button>
    </div>
  );

  if (!selected) return (
    <div>
      <div className="section-label">CLIENT ONBOARDING — SELECT A CLIENT</div>
      {clients.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>No clients in onboarding status. Add a client first from the Clients page.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {clients.map(client => (
            <div className="card" key={client.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setSelected(client)}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--navy)", fontSize: "12px" }}>{client.name}</div>
                <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>{client.business_type} — {client.email}</div>
              </div>
              <button className="btn btn-green" style={{ fontSize: "10px", padding: "5px 12px" }}>Start Onboarding ?</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "12px" }}>? Back</button>
        <div className="section-label" style={{ margin: 0 }}>ONBOARDING — {selected.name.toUpperCase()}</div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {[1,2,3,4,5].map(s => (
          <div key={s} style={{ flex: 1, height: "4px", borderRadius: "2px", background: s <= step ? "var(--green)" : "var(--border)" }}></div>
        ))}
      </div>

      <div className="opp-box" style={{ marginBottom: "16px" }}>
        <div className="opp-head"><div className="opp-dot"></div><div className="opp-title">ARIA</div></div>
        <div className="opp-text">{ariaMessage(step)}</div>
      </div>

      {step === 1 && (
        <div className="card">
          <div className="section-label">BUSINESS BASICS</div>
          {[
            { label: "Business Type", key: "business_type", type: "select", options: ["Ecommerce", "Coaching", "Courses", "Real Estate", "Agency"] },
            { label: "Niche", key: "niche", placeholder: "e.g. Travel Bags, Business Coaching, Luxury Real Estate" },
            { label: "Current Monthly Revenue Range", key: "monthly_revenue", placeholder: "e.g. $10K-$50K, $50K-$100K" },
            { label: "Current Monthly Leads or Inquiries", key: "monthly_leads", placeholder: "e.g. 50-100 leads per month" },
            { label: "Website URL", key: "website_url", placeholder: "e.g. luuxbags.com" },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>{field.label.toUpperCase()}</div>
              {field.type === "select" ? (
                <select value={form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none", background: "white" }}>
                  <option value="">Select...</option>
                  {field.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input value={form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })} placeholder={field.placeholder} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none" }} />
              )}
            </div>
          ))}
          <button className="btn btn-green" onClick={() => setStep(2)}>Next ?</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="section-label">BRAND VOICE AND IDENTITY</div>
          {[
            { label: "Brand Voice", key: "brand_voice", type: "select", options: ["Professional and formal", "Friendly and conversational", "Bold and direct", "Inspirational and motivational", "Educational and informative", "Luxury and exclusive"] },
            { label: "Words and Phrases You NEVER Want Used", key: "never_use_words", placeholder: "e.g. cheap, discount, deal, guru, hustle" },
            { label: "Topics That Are Completely Off Limits", key: "off_limits", placeholder: "e.g. competitor comparisons, price matching, income claims" },
            { label: "What Makes You Different From Competitors", key: "what_makes_different", placeholder: "e.g. lifetime warranty, sustainable materials, fastest response time" },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>{field.label.toUpperCase()}</div>
              {field.type === "select" ? (
                <select value={form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none", background: "white" }}>
                  <option value="">Select...</option>
                  {field.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input value={form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })} placeholder={field.placeholder} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none" }} />
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>? Back</button>
            <button className="btn btn-green" onClick={() => setStep(3)}>Next ?</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="section-label">YOUR CUSTOMERS AND PAST EXPERIENCES</div>
          {[
            { label: "Who Is Your Ideal Customer — Describe In Detail", key: "ideal_customer", placeholder: "e.g. Frequent travelers aged 28-45 who value quality over price and travel for business and leisure" },
            { label: "Biggest Challenge Right Now", key: "biggest_challenge", placeholder: "e.g. Low cart conversion, not enough leads, high churn rate" },
            { label: "Past Bad Experiences With Marketing or Automation", key: "bad_experience", placeholder: "e.g. Email sequences felt too salesy, lost subscribers, generic content that did not sound like us" },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>{field.label.toUpperCase()}</div>
              <textarea value={form[field.key]} onChange={e => setForm({ ...form, [field.key]: e.target.value })} placeholder={field.placeholder} rows={3} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline" onClick={() => setStep(2)}>? Back</button>
            <button className="btn btn-green" onClick={() => setStep(4)}>Next ?</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <div className="section-label">APPROVAL SETTINGS</div>
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "10px", fontWeight: 500 }}>HOW MUCH SHOULD ARIA EXECUTE AUTOMATICALLY?</div>
            {[
              { value: "review_everything", label: "Review everything before it goes out", desc: "You approve every single action Aria takes. Full control." },
              { value: "review_uncertain", label: "Review only what Aria is uncertain about", desc: "High confidence actions execute automatically. Medium confidence items come to you for approval." },
              { value: "autopilot", label: "Let Aria run and just notify me after", desc: "Aria executes everything automatically and notifies you of what was done. Available after 90 days of trust." },
            ].map(option => (
              <div key={option.value} onClick={() => setForm({ ...form, approval_threshold: option.value })} style={{ padding: "12px", border: `0.5px solid ${form.approval_threshold === option.value ? "var(--green)" : "var(--border)"}`, borderRadius: "8px", marginBottom: "8px", cursor: "pointer", background: form.approval_threshold === option.value ? "var(--green-light)" : "white" }}>
                <div style={{ fontWeight: 500, color: "var(--navy)", fontSize: "12px", marginBottom: "3px" }}>{option.label}</div>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>{option.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "5px", fontWeight: 500 }}>ADDITIONAL NOTES FOR ARIA</div>
            <textarea value={form.extra_notes} onChange={e => setForm({ ...form, extra_notes: e.target.value })} placeholder="Anything else Aria should know about your business, your customers, or how you want to be represented..." rows={3} style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "7px", padding: "8px 12px", fontSize: "12px", color: "var(--navy)", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline" onClick={() => setStep(3)}>? Back</button>
            <button className="btn btn-green" onClick={() => setStep(5)}>Review Summary ?</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <div className="section-label">AI SUMMARY — WHAT ARIA LEARNED</div>
          <div style={{ background: "var(--bg)", border: "0.5px solid var(--green-border)", borderLeft: "3px solid var(--green)", borderRadius: "8px", padding: "16px", marginBottom: "16px", fontSize: "12px", color: "var(--slate)", lineHeight: 1.8 }}>
            <p>Here is what I know about <b style={{ color: "var(--navy)" }}>{selected.name}</b>:</p>
            <br />
            <p>You are a <b style={{ color: "var(--navy)" }}>{form.business_type || "—"}</b> business in the <b style={{ color: "var(--navy)" }}>{form.niche || "—"}</b> niche. Your current monthly revenue is approximately <b style={{ color: "var(--navy)" }}>{form.monthly_revenue || "—"}</b> with about <b style={{ color: "var(--navy)" }}>{form.monthly_leads || "—"}</b> leads coming in per month.</p>
            <br />
            <p>Your brand voice is <b style={{ color: "var(--navy)" }}>{form.brand_voice || "—"}</b>. I will never use the following words or phrases: <b style={{ color: "var(--red)" }}>{form.never_use_words || "none specified"}</b>. The following topics are completely off limits: <b style={{ color: "var(--red)" }}>{form.off_limits || "none specified"}</b>.</p>
            <br />
            <p>Your ideal customer is: <b style={{ color: "var(--navy)" }}>{form.ideal_customer || "—"}</b>. What makes you different: <b style={{ color: "var(--navy)" }}>{form.what_makes_different || "—"}</b>.</p>
            <br />
            <p>Your biggest challenge: <b style={{ color: "var(--navy)" }}>{form.biggest_challenge || "—"}</b>. Past bad experience to avoid repeating: <b style={{ color: "var(--navy)" }}>{form.bad_experience || "none specified"}</b>.</p>
            <br />
            <p>Approval setting: <b style={{ color: "var(--green)" }}>{form.approval_threshold === "review_everything" ? "Review everything before it goes out" : form.approval_threshold === "review_uncertain" ? "Review only what I am uncertain about" : "Auto-pilot — notify after executing"}</b>.</p>
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "16px" }}>Please review this summary carefully. If anything is wrong click Back to correct it. Once you confirm I will start building your complete revenue system.</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline" onClick={() => setStep(4)}>? Back to Edit</button>
            <button className="btn btn-green" onClick={save} disabled={saving}>{saving ? "Activating system..." : "Confirm and Activate System ?"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
