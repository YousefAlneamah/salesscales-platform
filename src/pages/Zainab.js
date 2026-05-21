import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Zainab() {
  const [activeTab, setActiveTab] = useState('chat');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: "Hi, I'm Zainab, your Client Partner AI. I manage client relationships, handle onboarding, and make sure every client feels supported. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [onboardingResult, setOnboardingResult] = useState(null);
  const [updateResult, setUpdateResult] = useState(null);
  const [clientContext, setClientContext] = useState('');

  useEffect(() => { fetchClients(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*');
    if (data) setClients(data);
  };

  const callZainab = async (prompt) => {
    const response = await fetch('http://localhost:3001/hussain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    return data.result || 'Unable to generate response.';
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const selectedClientData = clients.find(c => c.id === selectedClient);
    const prompt = `You are Zainab, the Client Partner AI at Sales Scales. You manage client relationships and ensure every client feels supported and valued.

${selectedClientData ? `You are currently discussing client: ${selectedClientData.name} (${selectedClientData.niche || selectedClientData.business_type}) on the ${selectedClientData.tier} plan.` : 'No specific client selected.'}

User message: ${userMsg}

Respond as Zainab — warm, professional, solution-focused. Help with client relationship questions, communication strategies, retention concerns, and onboarding guidance. Keep response concise and actionable.`;

    const result = await callZainab(prompt);
    setChatMessages(prev => [...prev, { role: 'ai', content: result }]);
    setLoading(false);
  };

  const generateOnboarding = async () => {
    if (!selectedClient) return;
    setLoading(true);
    setOnboardingResult(null);

    const client = clients.find(c => c.id === selectedClient);
    const prompt = `You are Zainab, the Client Partner AI at Sales Scales. Generate a complete onboarding plan for this new client:

Client: ${client?.name}
Business Type: ${client?.business_type}
Niche: ${client?.niche}
Tier: ${client?.tier}
Status: ${client?.status}

Create a detailed onboarding plan including:
1. Welcome message to send on day 1
2. Week 1 setup checklist — what needs to be configured
3. First 30 days milestone plan
4. What to expect communication schedule
5. How to present the first results report
6. Red flags to watch for that indicate the client is at risk

Make it specific to their business and tier. This is what Zainab will follow to make the client feel supported from day one.`;

    const result = await callZainab(prompt);
    setOnboardingResult(result);
    setLoading(false);
  };

  const generateUpdate = async () => {
    if (!selectedClient) return;
    setLoading(true);
    setUpdateResult(null);

    const client = clients.find(c => c.id === selectedClient);
    const prompt = `You are Zainab, the Client Partner AI at Sales Scales. Write a client update message for:

Client: ${client?.name}
Niche: ${client?.niche}
Tier: ${client?.tier}
Context: ${clientContext || 'Monthly check-in update'}

Write a professional client update that:
1. Opens with a warm personal greeting
2. Summarizes what the AI system has been doing for them
3. Highlights any wins or progress
4. Sets expectations for the next period
5. Invites them to ask questions or share feedback
6. Closes with confidence and warmth

This message will be sent directly to the client. Write it ready to send.`;

    const result = await callZainab(prompt);
    setUpdateResult(result);
    setLoading(false);
  };

  const tabs = [
    { id: 'chat', label: 'Zainab Chat', icon: '💬' },
    { id: 'onboarding', label: 'Onboarding Plan', icon: '🚀' },
    { id: 'update', label: 'Client Update', icon: '📝' },
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
    <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '20px', marginTop: '16px', fontSize: '13px', color: '#0a1628', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
      {content}
    </div>
  );

  return (
    <div>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#c9a84c', fontWeight: 700 }}>Z</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Zainab</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Client Partner AI · Sales Scales</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>● Active</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '14px', lineHeight: '1.6' }}>
          Zainab manages all client relationships — from onboarding to retention. She ensures every client feels supported, informed, and confident in the value Sales Scales delivers.
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

      {/* ZAINAB CHAT */}
      {activeTab === 'chat' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#c9a84c', fontWeight: 700 }}>Z</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Zainab</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>● Online · Client Partner AI</div>
              </div>
            </div>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', color: 'white', outline: 'none', cursor: 'pointer' }}>
              <option value="">No client selected</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ height: '380px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', padding: '12px 14px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: msg.role === 'user' ? '#0a1628' : '#f8fafc', color: msg.role === 'user' ? 'white' : '#0a1628', fontSize: '12px', lineHeight: '1.6', border: msg.role === 'ai' ? '1px solid #e4e9f0' : 'none' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '12px 16px', borderRadius: '12px 12px 12px 2px', background: '#f8fafc', border: '1px solid #e4e9f0', fontSize: '12px', color: '#8896a8' }}>Zainab is typing...</div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #e4e9f0', padding: '14px 16px', display: 'flex', gap: '10px' }}>
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask Zainab about client relationships..."
              style={{ flex: 1, border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#0a1628', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Send
            </button>
          </div>
        </div>
      )}

      {/* ONBOARDING PLAN */}
      {activeTab === 'onboarding' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Client Onboarding</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Onboarding Plan Generator</div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Select Client</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={inputStyle}>
              <option value="">Select a client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={generateOnboarding} disabled={loading || !selectedClient}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Zainab is preparing...' : '🚀 Generate Onboarding Plan'}
          </button>
          {onboardingResult && <ResultCard content={onboardingResult} />}
        </div>
      )}

      {/* CLIENT UPDATE */}
      {activeTab === 'update' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Client Communication</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '16px' }}>Client Update Writer</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Select Client</label>
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={inputStyle}>
                <option value="">Select a client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Context or Update Type</label>
              <input type="text" value={clientContext} onChange={e => setClientContext(e.target.value)}
                placeholder="e.g. Monthly check-in, First week update, Results review"
                style={inputStyle} />
            </div>
          </div>
          <button onClick={generateUpdate} disabled={loading || !selectedClient}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Zainab is writing...' : '📝 Generate Client Update'}
          </button>
          {updateResult && <ResultCard content={updateResult} />}
        </div>
      )}
    </div>
  );
}