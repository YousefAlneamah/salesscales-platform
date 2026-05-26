import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

export default function Hussain() {
  const [activeTab, setActiveTab] = useState('briefing');
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [weeklyInsights, setWeeklyInsights] = useState(null);
  const [prospectUrl, setProspectUrl] = useState('');
  const [prospectResearch, setProspectResearch] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [platformData, setPlatformData] = useState(null);

  useEffect(() => { fetchPlatformData(); }, []);

  const fetchPlatformData = async () => {
    const [clientsRes, contactsRes, workflowsRes, messagesRes, approvalsRes] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('workflows').select('*'),
      supabase.from('messages').select('*'),
      supabase.from('approvals').select('*'),
    ]);
    setPlatformData({
      clients: clientsRes.data || [],
      contacts: contactsRes.data || [],
      workflows: workflowsRes.data || [],
      messages: messagesRes.data || [],
      approvals: approvalsRes.data || [],
    });
  };

  const callHussain = async (prompt) => {
    const { data } = await axios.post(`${API_BASE}/hussain`, { prompt });
    return data.result || 'Unable to generate response.';
  };

  const generateBriefing = async () => {
    if (!platformData) return;
    setLoading(true);
    setBriefing(null);
    const prompt = `Generate a morning briefing for Sales Scales based on this real platform data:

Clients: ${platformData.clients.length} total (${platformData.clients.filter(c => c.status === 'live').length} live)
Contacts: ${platformData.contacts.length} total in database
Active Workflows: ${platformData.workflows.filter(w => w.status === 'active').length} of ${platformData.workflows.length} total
Messages Sent: ${platformData.messages.filter(m => m.direction === 'outbound').length}
Messages Received: ${platformData.messages.filter(m => m.direction === 'inbound').length}
Pending Approvals: ${platformData.approvals.filter(a => a.status === 'pending').length}
Client names: ${platformData.clients.map(c => c.name).join(', ')}

Write a sharp morning briefing covering:
1. What is the most important thing to focus on today
2. What the numbers are telling us
3. One specific action to take today
4. Any risks or opportunities to be aware of

Be direct and specific. No generic advice.`;
    const result = await callHussain(prompt);
    setBriefing(result);
    setLoading(false);
  };

  const generateWeeklyInsights = async () => {
    if (!platformData) return;
    setLoading(true);
    setWeeklyInsights(null);
    const prompt = `Generate a weekly strategic insights report for Sales Scales based on this platform data:

Clients: ${platformData.clients.length} total
Active Workflows: ${platformData.workflows.filter(w => w.status === 'active').length}
Total Messages Sent: ${platformData.messages.filter(m => m.direction === 'outbound').length}
Total Messages Received: ${platformData.messages.filter(m => m.direction === 'inbound').length}
Approvals approved: ${platformData.approvals.filter(a => a.status === 'approved').length}
Approvals rejected: ${platformData.approvals.filter(a => a.status === 'rejected').length}

Analyze this week's performance and provide:
1. What is working well
2. What is not working and why
3. The biggest opportunity right now
4. What to prioritize next week
5. A revenue growth prediction if current trajectory continues

Be brutally honest and data-driven.`;
    const result = await callHussain(prompt);
    setWeeklyInsights(result);
    setLoading(false);
  };

  const generateProspectResearch = async () => {
    if (!prospectUrl) return;
    setLoading(true);
    setProspectResearch(null);
    const prompt = `Research this ecommerce store and give me a prospect intelligence report: ${prospectUrl}

Provide:
1. What they sell and their likely target customer
2. Estimated monthly revenue range
3. What AI revenue systems they are likely missing
4. The biggest revenue gap we can fix for them
5. The perfect opening message to send them on LinkedIn
6. Confidence score (0-100) that they would be a good Sales Scales client

Be specific and actionable. This is a sales intelligence report.`;
    const result = await callHussain(prompt);
    setProspectResearch(result);
    setLoading(false);
  };

  const generateRecommendations = async () => {
    if (!platformData) return;
    setLoading(true);
    setRecommendations(null);
    const prompt = `Based on this Sales Scales platform data, give me strategic recommendations:

Clients: ${platformData.clients.length} (${platformData.clients.map(c => `${c.name} - ${c.status} - ${c.tier}`).join(', ')})
Contacts: ${platformData.contacts.length}
Active Workflows: ${platformData.workflows.filter(w => w.status === 'active').length}
Messages sent: ${platformData.messages.filter(m => m.direction === 'outbound').length}
Pending approvals: ${platformData.approvals.filter(a => a.status === 'pending').length}

Give me:
1. The 3 highest leverage actions to grow Sales Scales revenue right now
2. Which client needs the most attention and why
3. What automation to build next that would have the biggest impact
4. The ideal next client profile to target
5. One thing that could kill the business if not fixed

Rank everything by impact. Be direct.`;
    const result = await callHussain(prompt);
    setRecommendations(result);
    setLoading(false);
  };

  const tabs = [
    { id: 'briefing', label: 'Morning Briefing', icon: '☀' },
    { id: 'weekly', label: 'Weekly Insights', icon: '📊' },
    { id: 'prospect', label: 'Prospect Research', icon: '🔍' },
    { id: 'recommendations', label: 'Recommendations', icon: '🎯' },
  ];

  const ResultCard = ({ content }) => (
    <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '20px', marginTop: '16px', fontSize: '13px', color: '#0a1628', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
      {content}
    </div>
  );

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#c9a84c', fontWeight: 700 }}>H</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Hussain</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Intelligence & Strategy AI · Sales Scales</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>● Active</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '14px', lineHeight: '1.6' }}>
          Hussain analyzes all platform data and gives you sharp, actionable intelligence. He thinks like a founder — no fluff, only what matters.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#0a1628' : 'white', color: activeTab === tab.id ? 'white' : '#8896a8', borderColor: activeTab === tab.id ? '#0a1628' : '#e4e9f0', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'briefing' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Daily Intelligence</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Morning Briefing</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px' }}>Hussain analyzes your platform data and tells you exactly what to focus on today.</div>
          <button onClick={generateBriefing} disabled={loading}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Hussain is thinking...' : '☀ Generate Today\'s Briefing'}
          </button>
          {briefing && <ResultCard content={briefing} />}
        </div>
      )}

      {activeTab === 'weekly' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Strategic Analysis</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Weekly Insights</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px' }}>A deep analysis of this week's performance — what worked, what didn't, and what to do next week.</div>
          <button onClick={generateWeeklyInsights} disabled={loading}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Hussain is analyzing...' : '📊 Generate Weekly Insights'}
          </button>
          {weeklyInsights && <ResultCard content={weeklyInsights} />}
        </div>
      )}

      {activeTab === 'prospect' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Sales Intelligence</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Prospect Research</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px' }}>Enter a Shopify store URL and Hussain will give you a sales intelligence report.</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" value={prospectUrl} onChange={e => setProspectUrl(e.target.value)}
              placeholder="https://store.myshopify.com"
              style={{ flex: 1, border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#0a1628', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
            <button onClick={generateProspectResearch} disabled={loading || !prospectUrl}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {loading ? 'Researching...' : '🔍 Research'}
            </button>
          </div>
          {prospectResearch && <ResultCard content={prospectResearch} />}
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Strategic Direction</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Recommendations</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px' }}>Hussain analyzes everything and tells you the highest leverage actions to take right now.</div>
          <button onClick={generateRecommendations} disabled={loading}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Hussain is thinking...' : '🎯 Generate Recommendations'}
          </button>
          {recommendations && <ResultCard content={recommendations} />}
        </div>
      )}
    </div>
  );
}