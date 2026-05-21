import React, { useState } from 'react';

export default function Hassan() {
  const [activeTab, setActiveTab] = useState('outreach');
  const [loading, setLoading] = useState(false);
  const [storeUrl, setStoreUrl] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [prospectBusiness, setProspectBusiness] = useState('');
  const [prospectNiche, setProspectNiche] = useState('');
  const [channel, setChannel] = useState('LinkedIn');
  const [outreachResult, setOutreachResult] = useState(null);
  const [followUpResult, setFollowUpResult] = useState(null);
  const [contentResult, setContentResult] = useState(null);
  const [contentType, setContentType] = useState('LinkedIn Post');
  const [contentTopic, setContentTopic] = useState('');
  const [daysSince, setDaysSince] = useState('3');
  const [followUpContext, setFollowUpContext] = useState('');

  const callHassan = async (prompt) => {
    const response = await fetch('http://localhost:3001/hassan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    return data.result || 'Unable to generate response.';
  };

  const generateOutreach = async () => {
    if (!prospectName || !prospectBusiness) return;
    setLoading(true);
    setOutreachResult(null);

    const prompt = `You are Hassan, the Growth and Outreach AI at Sales Scales. Write a personalized outreach message for this prospect:

Name: ${prospectName}
Business: ${prospectBusiness}
Niche: ${prospectNiche || 'Ecommerce'}
Channel: ${channel}
Store URL: ${storeUrl || 'Not provided'}

Write a highly personalized ${channel} outreach message that:
1. Opens with something specific about their business — not generic
2. Identifies ONE specific revenue gap they likely have
3. Positions Sales Scales as the solution in ONE sentence
4. Has a clear low-friction call to action
5. Feels like it was written by a human who actually researched them

For LinkedIn: 150-200 words max, conversational, no bullet points
For Email: Subject line + 200-250 words, professional but not corporate
For Instagram DM: 80-100 words max, casual and direct

Do not use placeholders. Write the complete ready-to-send message.`;

    const result = await callHassan(prompt);
    setOutreachResult(result);
    setLoading(false);
  };

  const generateFollowUp = async () => {
    if (!prospectName) return;
    setLoading(true);
    setFollowUpResult(null);

    const prompt = `You are Hassan, the Growth and Outreach AI at Sales Scales. Write a follow-up message for this prospect:

Name: ${prospectName}
Business: ${prospectBusiness}
Channel: ${channel}
Days since first message: ${daysSince}
Context: ${followUpContext || 'No response to initial outreach'}

Write a follow-up message that:
1. Does not apologize for following up
2. Adds new value — a different angle or insight
3. Is shorter than the original message
4. Has a single clear question or call to action
5. Feels natural not pushy

Write the complete ready-to-send message. No placeholders.`;

    const result = await callHassan(prompt);
    setFollowUpResult(result);
    setLoading(false);
  };

  const generateContent = async () => {
    if (!contentTopic) return;
    setLoading(true);
    setContentResult(null);

    const prompt = `You are Hassan, the Growth and Outreach AI at Sales Scales. Create ${contentType} content for Sales Scales:

Topic: ${contentTopic}
Platform: ${contentType}
Brand: Sales Scales — AI revenue systems for Shopify ecommerce brands
Voice: Direct, confident, founder-to-founder, data-driven, no fluff

Content requirements:
- LinkedIn Post: 150-250 words, hook in first line, ends with a question or insight
- Twitter/X Thread: 5-7 tweets, each under 280 characters, numbered
- Email Newsletter: Subject + 300-400 words, one clear CTA
- Instagram Caption: 100-150 words, conversational, 5-8 relevant hashtags

Write the complete ready-to-post content. No placeholders.`;

    const result = await callHassan(prompt);
    setContentResult(result);
    setLoading(false);
  };

  const tabs = [
    { id: 'outreach', label: 'Outreach Writer', icon: '✉' },
    { id: 'followup', label: 'Follow Up', icon: '🔄' },
    { id: 'content', label: 'Content Creator', icon: '✍' },
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
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59,130,246,0.15)', border: '1.5px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#3b82f6', fontWeight: 700 }}>H</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Hassan</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Growth & Outreach AI · Sales Scales</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>● Active</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '14px', lineHeight: '1.6' }}>
          Hassan finds prospects, writes personalized outreach, follows up automatically, and creates content that attracts ecommerce founders to Sales Scales.
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

      {/* OUTREACH WRITER */}
      {activeTab === 'outreach' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Personalized Outreach</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Outreach Writer</div>
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
              <label style={labelStyle}>Store URL</label>
              <input type="text" value={storeUrl} onChange={e => setStoreUrl(e.target.value)} placeholder="https://store.com" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Channel</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} style={inputStyle}>
                <option>LinkedIn</option>
                <option>Email</option>
                <option>Instagram DM</option>
                <option>Twitter DM</option>
              </select>
            </div>
          </div>
          <button onClick={generateOutreach} disabled={loading || !prospectName || !prospectBusiness}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Hassan is writing...' : '✉ Generate Outreach Message'}
          </button>
          {outreachResult && <ResultCard content={outreachResult} />}
        </div>
      )}

      {/* FOLLOW UP */}
      {activeTab === 'followup' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Follow Up</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Follow Up Writer</div>
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
              <label style={labelStyle}>Channel</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} style={inputStyle}>
                <option>LinkedIn</option>
                <option>Email</option>
                <option>Instagram DM</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Days Since First Message</label>
              <select value={daysSince} onChange={e => setDaysSince(e.target.value)} style={inputStyle}>
                <option value="3">3 days</option>
                <option value="5">5 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Context — what happened so far</label>
              <textarea value={followUpContext} onChange={e => setFollowUpContext(e.target.value)}
                placeholder="e.g. Sent LinkedIn message, no response. They viewed my profile twice."
                rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <button onClick={generateFollowUp} disabled={loading || !prospectName}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Hassan is writing...' : '🔄 Generate Follow Up'}
          </button>
          {followUpResult && <ResultCard content={followUpResult} />}
        </div>
      )}

      {/* CONTENT CREATOR */}
      {activeTab === 'content' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Content Creation</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Content Creator</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Content Type</label>
              <select value={contentType} onChange={e => setContentType(e.target.value)} style={inputStyle}>
                <option>LinkedIn Post</option>
                <option>Twitter/X Thread</option>
                <option>Email Newsletter</option>
                <option>Instagram Caption</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Topic or Angle</label>
              <input type="text" value={contentTopic} onChange={e => setContentTopic(e.target.value)} placeholder="e.g. Why most Shopify stores lose 30% of revenue" style={inputStyle} />
            </div>
          </div>
          <button onClick={generateContent} disabled={loading || !contentTopic}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Hassan is creating...' : '✍ Generate Content'}
          </button>
          {contentResult && <ResultCard content={contentResult} />}
        </div>
      )}
    </div>
  );
}