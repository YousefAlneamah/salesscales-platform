import React, { useState } from 'react';

export default function Mahdi() {
  const [activeTab, setActiveTab] = useState('email');
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientNiche, setClientNiche] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [sequenceType, setSequenceType] = useState('Cart Recovery');
  const [emailCount, setEmailCount] = useState('3');
  const [emailResult, setEmailResult] = useState(null);
  const [smsResult, setSmsResult] = useState(null);
  const [adResult, setAdResult] = useState(null);
  const [adType, setAdType] = useState('Facebook Ad');
  const [adGoal, setAdGoal] = useState('');
  const [smsCount, setSmsCount] = useState('3');

  const callMahdi = async (prompt) => {
    const response = await fetch('http://localhost:3001/hussain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    return data.result || 'Unable to generate response.';
  };

  const generateEmails = async () => {
    if (!clientName || !clientNiche) return;
    setLoading(true);
    setEmailResult(null);

    const prompt = `You are Mahdi, the Marketing and Content AI at Sales Scales. Write a complete ${sequenceType} email sequence for this ecommerce client:

Client: ${clientName}
Niche: ${clientNiche}
Brand Voice: ${brandVoice || 'Professional, warm, and direct'}
Number of Emails: ${emailCount}
Sequence Type: ${sequenceType}

Write ${emailCount} complete emails with:
- Subject line for each email
- Preview text for each email
- Full email body with personalization using {{first_name}}
- Clear call to action in each email
- Increasing urgency across the sequence

Make each email feel human and brand-specific. No generic templates. Write the complete ready-to-send emails.`;

    const result = await callMahdi(prompt);
    setEmailResult(result);
    setLoading(false);
  };

  const generateSMS = async () => {
    if (!clientName || !clientNiche) return;
    setLoading(true);
    setSmsResult(null);

    const prompt = `You are Mahdi, the Marketing and Content AI at Sales Scales. Write a complete ${sequenceType} SMS sequence for this ecommerce client:

Client: ${clientName}
Niche: ${clientNiche}
Brand Voice: ${brandVoice || 'Friendly and direct'}
Number of SMS: ${smsCount}
Sequence Type: ${sequenceType}

Write ${smsCount} complete SMS messages with:
- Each message under 160 characters
- Personalization using {{first_name}}
- A clear link placeholder {{link}}
- Natural conversational tone
- Increasing urgency across the sequence

Number each message and include the send timing (e.g. Send immediately, Send after 2 hours). Write complete ready-to-send messages.`;

    const result = await callMahdi(prompt);
    setSmsResult(result);
    setLoading(false);
  };

  const generateAd = async () => {
    if (!clientName || !adGoal) return;
    setLoading(true);
    setAdResult(null);

    const prompt = `You are Mahdi, the Marketing and Content AI at Sales Scales. Write ${adType} copy for this ecommerce client:

Client: ${clientName}
Niche: ${clientNiche || 'Ecommerce'}
Brand Voice: ${brandVoice || 'Professional and compelling'}
Ad Type: ${adType}
Goal: ${adGoal}

Write 3 variations of the ad copy including:
- Primary text
- Headline
- Description
- Call to action button text

Make each variation test a different angle — one emotional, one logical, one urgency-based. Write complete ready-to-use ad copy.`;

    const result = await callMahdi(prompt);
    setAdResult(result);
    setLoading(false);
  };

  const tabs = [
    { id: 'email', label: 'Email Sequences', icon: '✉' },
    { id: 'sms', label: 'SMS Sequences', icon: '💬' },
    { id: 'ads', label: 'Ad Copy', icon: '📢' },
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
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', border: '1.5px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#10b981', fontWeight: 700 }}>M</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Mahdi</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Marketing & Content AI · Sales Scales</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>● Active</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '14px', lineHeight: '1.6' }}>
          Mahdi writes all content for Sales Scales clients — email sequences, SMS campaigns, and ad copy — all in the exact brand voice of each client.
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

      {/* EMAIL SEQUENCES */}
      {activeTab === 'email' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Email Marketing</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Email Sequence Writer</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Client Store Name</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Luux Bags" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Niche</label>
              <input type="text" value={clientNiche} onChange={e => setClientNiche(e.target.value)} placeholder="e.g. Luxury Travel Bags" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Sequence Type</label>
              <select value={sequenceType} onChange={e => setSequenceType(e.target.value)} style={inputStyle}>
                <option>Cart Recovery</option>
                <option>Post Purchase</option>
                <option>Win-Back</option>
                <option>Welcome Series</option>
                <option>Browse Abandonment</option>
                <option>VIP Customer</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Number of Emails</label>
              <select value={emailCount} onChange={e => setEmailCount(e.target.value)} style={inputStyle}>
                <option value="2">2 emails</option>
                <option value="3">3 emails</option>
                <option value="4">4 emails</option>
                <option value="5">5 emails</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Brand Voice</label>
              <input type="text" value={brandVoice} onChange={e => setBrandVoice(e.target.value)} placeholder="e.g. Premium, sophisticated, adventurous" style={inputStyle} />
            </div>
          </div>
          <button onClick={generateEmails} disabled={loading || !clientName || !clientNiche}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Mahdi is writing...' : '✉ Generate Email Sequence'}
          </button>
          {emailResult && <ResultCard content={emailResult} />}
        </div>
      )}

      {/* SMS SEQUENCES */}
      {activeTab === 'sms' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>SMS Marketing</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>SMS Sequence Writer</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Client Store Name</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Luux Bags" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Niche</label>
              <input type="text" value={clientNiche} onChange={e => setClientNiche(e.target.value)} placeholder="e.g. Luxury Travel Bags" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Sequence Type</label>
              <select value={sequenceType} onChange={e => setSequenceType(e.target.value)} style={inputStyle}>
                <option>Cart Recovery</option>
                <option>Post Purchase</option>
                <option>Win-Back</option>
                <option>Flash Sale</option>
                <option>Back In Stock</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Number of SMS</label>
              <select value={smsCount} onChange={e => setSmsCount(e.target.value)} style={inputStyle}>
                <option value="2">2 messages</option>
                <option value="3">3 messages</option>
                <option value="4">4 messages</option>
                <option value="5">5 messages</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Brand Voice</label>
              <input type="text" value={brandVoice} onChange={e => setBrandVoice(e.target.value)} placeholder="e.g. Friendly, direct, premium" style={inputStyle} />
            </div>
          </div>
          <button onClick={generateSMS} disabled={loading || !clientName || !clientNiche}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Mahdi is writing...' : '💬 Generate SMS Sequence'}
          </button>
          {smsResult && <ResultCard content={smsResult} />}
        </div>
      )}

      {/* AD COPY */}
      {activeTab === 'ads' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Paid Advertising</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Ad Copy Generator</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Client Store Name</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Luux Bags" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Niche</label>
              <input type="text" value={clientNiche} onChange={e => setClientNiche(e.target.value)} placeholder="e.g. Luxury Travel Bags" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Ad Type</label>
              <select value={adType} onChange={e => setAdType(e.target.value)} style={inputStyle}>
                <option>Facebook Ad</option>
                <option>Instagram Ad</option>
                <option>Google Ad</option>
                <option>TikTok Ad</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Brand Voice</label>
              <input type="text" value={brandVoice} onChange={e => setBrandVoice(e.target.value)} placeholder="e.g. Premium, sophisticated" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Ad Goal</label>
              <input type="text" value={adGoal} onChange={e => setAdGoal(e.target.value)} placeholder="e.g. Drive purchases of the weekender bag collection" style={inputStyle} />
            </div>
          </div>
          <button onClick={generateAd} disabled={loading || !clientName || !adGoal}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Mahdi is writing...' : '📢 Generate Ad Copy'}
          </button>
          {adResult && <ResultCard content={adResult} />}
        </div>
      )}
    </div>
  );
}