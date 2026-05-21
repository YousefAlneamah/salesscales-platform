import React, { useState } from 'react';

export default function Ali() {
  const [activeTab, setActiveTab] = useState('closer');
  const [loading, setLoading] = useState(false);
  const [prospectName, setProspectName] = useState('');
  const [prospectBusiness, setProspectBusiness] = useState('');
  const [prospectNiche, setProspectNiche] = useState('');
  const [budget, setBudget] = useState('');
  const [objection, setObjection] = useState('');
  const [context, setContext] = useState('');
  const [callStage, setCallStage] = useState('Discovery');
  const [closerResult, setCloserResult] = useState(null);
  const [objectionResult, setObjectionResult] = useState(null);
  const [scriptResult, setScriptResult] = useState(null);
  const [tierTarget, setTierTarget] = useState('starter');

  const callAli = async (prompt) => {
    const response = await fetch('http://localhost:3001/ali', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    return data.result || 'Unable to generate response.';
  };

  const generateCloser = async () => {
    if (!prospectName || !prospectBusiness) return;
    setLoading(true);
    setCloserResult(null);

    const prompt = `You are Ali, the Sales Closer AI at Sales Scales. Generate a sales conversation strategy for this prospect:

Name: ${prospectName}
Business: ${prospectBusiness}
Niche: ${prospectNiche || 'Ecommerce'}
Estimated Budget: ${budget || 'Unknown'}
Call Stage: ${callStage}
Target Tier: ${tierTarget}
Context: ${context || 'First sales call'}

Provide:
1. The exact opening question to ask in the first 30 seconds
2. The 3 most important discovery questions for this specific prospect
3. How to position Sales Scales for their specific situation
4. The exact moment to transition to the offer
5. The closing question to use

Be specific to their business. No generic sales advice. Write it as a script Ali would use word for word.`;

    const result = await callAli(prompt);
    setCloserResult(result);
    setLoading(false);
  };

  const generateObjectionHandler = async () => {
    if (!objection) return;
    setLoading(true);
    setObjectionResult(null);

    const prompt = `You are Ali, the Sales Closer AI at Sales Scales. Handle this sales objection:

Prospect: ${prospectName || 'The prospect'}
Business: ${prospectBusiness || 'their ecommerce store'}
Objection: "${objection}"
Context: ${context || 'Sales call for Sales Scales AI revenue system'}
Target Tier: ${tierTarget}

Using the NEPQ framework (Neuro Emotional Persuasion Questioning):
1. Acknowledge the objection without agreeing or disagreeing
2. Ask a clarifying question that makes them think deeper
3. Reframe the objection as a reason TO buy
4. Provide the exact words to say

Write the complete word-for-word response Ali would give. Make it feel natural, not scripted.`;

    const result = await callAli(prompt);
    setObjectionResult(result);
    setLoading(false);
  };

  const generateScript = async () => {
    if (!prospectBusiness) return;
    setLoading(true);
    setScriptResult(null);

    const prompt = `You are Ali, the Sales Closer AI at Sales Scales. Write a complete sales call script for:

Business: ${prospectBusiness}
Niche: ${prospectNiche || 'Ecommerce'}
Call Stage: ${callStage}
Target Tier: ${tierTarget} ($${tierTarget === 'starter' ? '1,500' : tierTarget === 'growth' ? '3,000' : '6,000'}/mo)
Context: ${context || 'Discovery call for Sales Scales AI revenue system'}

Write a complete word-for-word call script including:
1. Opening — first 60 seconds
2. Discovery — 5 key questions
3. Problem agitation — make the pain real
4. Solution presentation — Sales Scales positioned specifically for them
5. Offer presentation — price and what they get
6. Closing — ask for the decision
7. Handling the most likely objection

Format it as a real script with clear sections. Make it feel like a human conversation not a corporate pitch.`;

    const result = await callAli(prompt);
    setScriptResult(result);
    setLoading(false);
  };

  const tabs = [
    { id: 'closer', label: 'Sales Strategy', icon: '🎯' },
    { id: 'objections', label: 'Objection Handler', icon: '🛡' },
    { id: 'script', label: 'Call Script', icon: '📋' },
  ];

  const inputStyle = {
    width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#0a1628',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif'
  };

  const labelStyle = {
    fontSize: '10px', color: '#8896a8', marginBottom: '6px',
    fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px'
  };

  const ResultCard = ({ content }) => (
    <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '20px', marginTop: '16px', fontSize: '13px', color: '#0a1628', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontFamily: 'DM Sans, sans-serif' }}>
      {content}
    </div>
  );

  return (
    <div>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#c9a84c', fontWeight: 700 }}>A</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Ali</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Sales Closer AI · Sales Scales</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>● Active</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '14px', lineHeight: '1.6' }}>
          Ali takes warm leads from Hassan and closes them. He generates sales strategies, handles objections using NEPQ, and writes complete call scripts tailored to each prospect.
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#0a1628' : 'white', color: activeTab === tab.id ? 'white' : '#8896a8', borderColor: activeTab === tab.id ? '#0a1628' : '#e4e9f0', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SALES STRATEGY */}
      {activeTab === 'closer' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Sales Intelligence</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Sales Strategy</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Prospect Name</label>
              <input type="text" value={prospectName} onChange={e => setProspectName(e.target.value)} placeholder="e.g. Sarah Johnson" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Business Name</label>
              <input type="text" value={prospectBusiness} onChange={e => setProspectBusiness(e.target.value)} placeholder="e.g. Peak Fitness" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Niche</label>
              <input type="text" value={prospectNiche} onChange={e => setProspectNiche(e.target.value)} placeholder="e.g. Fitness Supplements" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Estimated Budget</label>
              <input type="text" value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. $1,500-3,000/mo" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Call Stage</label>
              <select value={callStage} onChange={e => setCallStage(e.target.value)} style={inputStyle}>
                <option>Discovery</option>
                <option>Follow Up</option>
                <option>Proposal</option>
                <option>Closing</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Target Tier</label>
              <select value={tierTarget} onChange={e => setTierTarget(e.target.value)} style={inputStyle}>
                <option value="starter">Starter — $1,500/mo</option>
                <option value="growth">Growth — $3,000/mo</option>
                <option value="elite">Elite — $6,000/mo</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Context</label>
              <textarea value={context} onChange={e => setContext(e.target.value)}
                placeholder="Any additional context about the prospect or conversation so far..."
                rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <button onClick={generateCloser} disabled={loading || !prospectName || !prospectBusiness}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Ali is thinking...' : '🎯 Generate Sales Strategy'}
          </button>
          {closerResult && <ResultCard content={closerResult} />}
        </div>
      )}

      {/* OBJECTION HANDLER */}
      {activeTab === 'objections' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>NEPQ Framework</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Objection Handler</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Prospect Name</label>
              <input type="text" value={prospectName} onChange={e => setProspectName(e.target.value)} placeholder="e.g. Sarah" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Their Business</label>
              <input type="text" value={prospectBusiness} onChange={e => setProspectBusiness(e.target.value)} placeholder="e.g. Peak Fitness" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Target Tier</label>
              <select value={tierTarget} onChange={e => setTierTarget(e.target.value)} style={inputStyle}>
                <option value="starter">Starter — $1,500/mo</option>
                <option value="growth">Growth — $3,000/mo</option>
                <option value="elite">Elite — $6,000/mo</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Their Exact Objection</label>
              <input type="text" value={objection} onChange={e => setObjection(e.target.value)}
                placeholder='e.g. "I need to think about it" or "It is too expensive"' style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Context</label>
              <textarea value={context} onChange={e => setContext(e.target.value)}
                placeholder="What happened in the conversation before this objection..."
                rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <button onClick={generateObjectionHandler} disabled={loading || !objection}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Ali is thinking...' : '🛡 Handle This Objection'}
          </button>
          {objectionResult && <ResultCard content={objectionResult} />}
        </div>
      )}

      {/* CALL SCRIPT */}
      {activeTab === 'script' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Complete Script</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Call Script Generator</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Business Name</label>
              <input type="text" value={prospectBusiness} onChange={e => setProspectBusiness(e.target.value)} placeholder="e.g. Peak Fitness" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Niche</label>
              <input type="text" value={prospectNiche} onChange={e => setProspectNiche(e.target.value)} placeholder="e.g. Fitness Supplements" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Call Stage</label>
              <select value={callStage} onChange={e => setCallStage(e.target.value)} style={inputStyle}>
                <option>Discovery</option>
                <option>Follow Up</option>
                <option>Proposal</option>
                <option>Closing</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Target Tier</label>
              <select value={tierTarget} onChange={e => setTierTarget(e.target.value)} style={inputStyle}>
                <option value="starter">Starter — $1,500/mo</option>
                <option value="growth">Growth — $3,000/mo</option>
                <option value="elite">Elite — $6,000/mo</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Additional Context</label>
              <textarea value={context} onChange={e => setContext(e.target.value)}
                placeholder="Any specific details about the prospect or situation..."
                rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <button onClick={generateScript} disabled={loading || !prospectBusiness}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Ali is writing...' : '📋 Generate Call Script'}
          </button>
          {scriptResult && <ResultCard content={scriptResult} />}
        </div>
      )}
    </div>
  );
}