import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';
import { AIMemberLayout } from '../components/AIMemberLayout';

const MEMBER_NAME = 'mahdi';

export default function Mahdi() {
  const [activeTab, setActiveTab] = useState('email');
  const [memberStats, setMemberStats] = useState({ weekActions: 0, allTimeActions: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [focusArea, setFocusArea] = useState('');
  const [personality, setPersonality] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    const weekAgo = new Date(Date.now() - 7*86400000).toISOString();
    Promise.all([
      supabase.from('team_briefings').select('id',{count:'exact',head:true}).eq('from_member',MEMBER_NAME),
      supabase.from('team_briefings').select('id',{count:'exact',head:true}).eq('from_member',MEMBER_NAME).gte('created_at',weekAgo),
      supabase.from('team_briefings').select('subject,created_at,to_member,priority').eq('from_member',MEMBER_NAME).order('created_at',{ascending:false}).limit(10),
      supabase.from('platform_settings').select('key,value').in('key',[`${MEMBER_NAME}_focus`,`${MEMBER_NAME}_personality`]),
    ]).then(([all, week, recent, cfg]) => {
      setMemberStats({ allTimeActions: all.count||0, weekActions: week.count||0 });
      setRecentActivity(recent.data||[]);
      const s = (cfg.data||[]).reduce((m,r)=>{m[r.key]=r.value;return m;},{});
      setFocusArea(s[`${MEMBER_NAME}_focus`]||''); setPersonality(s[`${MEMBER_NAME}_personality`]||'');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = async () => {
    setSavingConfig(true);
    await supabase.from('platform_settings').upsert([{key:`${MEMBER_NAME}_focus`,value:focusArea,updated_at:new Date().toISOString()},{key:`${MEMBER_NAME}_personality`,value:personality,updated_at:new Date().toISOString()}],{onConflict:'key'});
    setSavingConfig(false); setShowConfig(false);
  };
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
    const { data } = await axios.post(`${API_BASE}/mahdi`, { prompt });
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
    <AIMemberLayout memberSlug={MEMBER_NAME} role="Marketing & Content AI"
      description="Mahdi writes every email, SMS, and sequence in your exact brand voice. Creative, data-informed, and obsessed with conversion."
      memberStats={memberStats} recentActivity={recentActivity}>

      {/* Configure panel */}
      {showConfig && (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 14 }}>Configure Mahdi</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div><div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Focus Area</div><input type="text" value={focusArea} onChange={e=>setFocusArea(e.target.value)} placeholder="e.g. Email copy, SMS campaigns..." style={{ width: '100%', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#f0f4f8', outline: 'none', background: 'rgba(255,255,255,0.05)', boxSizing: 'border-box' }} /></div>
            <div><div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Personality</div><input type="text" value={personality} onChange={e=>setPersonality(e.target.value)} placeholder="e.g. More persuasive, casual..." style={{ width: '100%', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#f0f4f8', outline: 'none', background: 'rgba(255,255,255,0.05)', boxSizing: 'border-box' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={saveConfig} disabled={savingConfig} style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{savingConfig?'Saving...':'Save'}</button><button onClick={()=>setShowConfig(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8896a8', borderRadius: 8, padding: '9px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button></div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', color: activeTab === tab.id ? '#fff' : '#8896a8', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* EMAIL SEQUENCES */}
      {activeTab === 'email' && (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px' }}>
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
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px' }}>
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
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px' }}>
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
    </AIMemberLayout>
  );
}