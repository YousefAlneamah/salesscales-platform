import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function ClientDashboard({ user, onLogout }) {
  const [stats, setStats] = useState({
    totalContacts: 0,
    activeWorkflows: 0,
    messagesSent: 0,
    messagesReceived: 0,
  });
  const [workflows, setWorkflows] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contactsRes, workflowsRes, messagesRes] = await Promise.all([
        supabase.from('contacts').select('*').eq('client_id', user.clientId),
        supabase.from('workflows').select('*').eq('client_id', user.clientId),
        supabase.from('messages').select('*').eq('client_id', user.clientId).order('created_at', { ascending: false }).limit(5),
      ]);

      const messages = messagesRes.data || [];
      const workflows = workflowsRes.data || [];

      setStats({
        totalContacts: contactsRes.data?.length || 0,
        activeWorkflows: workflows.filter(w => w.status === 'active').length,
        messagesSent: messages.filter(m => m.direction === 'outbound').length,
        messagesReceived: messages.filter(m => m.direction === 'inbound').length,
      });

      setWorkflows(workflows);
      setRecentMessages(messages);
    } catch (e) {
      console.error('Client dashboard error:', e);
    }
    setLoading(false);
  };

  const formatTime = (d) => {
    if (!d) return '—';
    const diff = new Date() - new Date(d);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const channelIcon = (ch) => ({ Email: '✉', SMS: '💬', WhatsApp: '📱', Instagram: '📸', Facebook: '👥' }[ch] || '💌');

  return (
    <div style={{ minHeight: '100vh', background: '#f0f3f8', fontFamily: 'DM Sans, sans-serif' }}>
      {/* TOPBAR */}
      <div style={{ background: 'white', borderBottom: '1px solid #e4e9f0', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '4px', color: '#0a1628' }}>SALES SCALES</div>
            <div style={{ fontSize: '8px', color: '#8896a8', letterSpacing: '2px' }}>AI REVENUE SYSTEM</div>
          </div>
          <div style={{ width: '1px', height: '24px', background: '#e4e9f0' }}></div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{user.clientName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(201,168,76,0.1)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            {user.tier} Plan
          </span>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#c9a84c', fontWeight: 700 }}>
            {user.name?.[0]}
          </div>
          <button onClick={onLogout}
            style={{ background: 'none', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '6px 14px', fontSize: '11px', color: '#8896a8', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '28px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* WELCOME */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Welcome back</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px' }}>
            {user.clientName} Dashboard
          </div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Your AI revenue system — live and working for you</div>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Contacts', value: stats.totalContacts, sub: 'in your database', color: '#c9a84c' },
            { label: 'Active Workflows', value: stats.activeWorkflows, sub: 'running automatically', color: '#c9a84c' },
            { label: 'Messages Sent', value: stats.messagesSent, sub: 'by AI this month', color: '#10b981' },
            { label: 'Replies Received', value: stats.messagesReceived, sub: 'from your customers', color: '#3b82f6' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '18px 20px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>{stat.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '5px' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
          {/* ACTIVE WORKFLOWS */}
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Active Sequences</div>
            {loading ? (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '30px', textAlign: 'center', color: '#8896a8' }}>Loading...</div>
            ) : workflows.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>⚡</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No sequences yet</div>
                <div style={{ fontSize: '11px', color: '#8896a8' }}>Your AI team is setting up your sequences</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {workflows.map(workflow => (
                  <div key={workflow.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{workflow.name}</div>
                      <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: workflow.status === 'active' ? '#ecfdf5' : '#fffbeb', color: workflow.status === 'active' ? '#059669' : '#d97706', border: `1px solid ${workflow.status === 'active' ? '#a7f3d0' : '#fde68a'}` }}>
                        {workflow.status === 'active' ? '● Active' : '○ Paused'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '10px' }}>Trigger: {workflow.trigger_type}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[
                        { label: 'Enrolled', value: workflow.enrolled_count || 0 },
                        { label: 'Active', value: workflow.active_count || 0 },
                        { label: 'Converted', value: workflow.converted_count || 0 },
                      ].map(s => (
                        <div key={s.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0a1628' }}>{s.value}</div>
                          <div style={{ fontSize: '9px', color: '#8896a8' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RECENT MESSAGES */}
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Recent Activity</div>
            {recentMessages.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>📬</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No messages yet</div>
                <div style={{ fontSize: '11px', color: '#8896a8' }}>Your AI team will start sending messages soon</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recentMessages.map(msg => (
                  <div key={msg.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '18px', flexShrink: 0 }}>{channelIcon(msg.channel)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: '#0a1628' }}>{msg.direction === 'outbound' ? 'AI Sent' : msg.sender_name}</div>
                        <div style={{ fontSize: '9px', color: '#8896a8' }}>{formatTime(msg.created_at)}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: '#8896a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* POWERED BY */}
            <div style={{ marginTop: '16px', background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(201,168,76,0.2)' }}>
              <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Powered by Sales Scales AI</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>Your AI team is working 24/7 to recover revenue, nurture leads, and grow your store automatically.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}