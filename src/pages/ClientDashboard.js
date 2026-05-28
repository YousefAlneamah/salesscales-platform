import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';

const parseAov = (text) => {
  if (!text) return 75;
  if (text.includes('Under')) return 25;
  if (text === '$30–$75') return 52;
  if (text === '$75–$150') return 112;
  if (text === '$150–$300') return 225;
  if (text.includes('Over')) return 350;
  return 75;
};

export default function ClientDashboard({ user, onLogout }) {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [stats, setStats] = useState({
    totalContacts: 0,
    activeWorkflows: 0,
    messagesSent: 0,
    messagesReceived: 0,
    emailsSentMonth: 0,
    smsSentMonth: 0,
    contactsAddedMonth: 0,
    enrollmentsMonth: 0,
    revenueRecovered: 0,
    completedEnrollments: 0,
  });
  const [workflows, setWorkflows] = useState([]);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [enrollmentsByWorkflow, setEnrollmentsByWorkflow] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [user.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [
        contactsRes, workflowsRes, messagesRes,
        emailsRes, smsRes, contactsMonthRes, enrollmentsRes,
        onboardingRes, allEnrollmentsRes,
      ] = await Promise.all([
        supabase.from('contacts').select('*').eq('client_id', user.clientId).order('created_at', { ascending: false }),
        supabase.from('workflows').select('*').eq('client_id', user.clientId),
        supabase.from('messages').select('*').eq('client_id', user.clientId).order('created_at', { ascending: false }),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', user.clientId).eq('channel', 'Email').eq('direction', 'outbound').gte('created_at', monthStart),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', user.clientId).eq('channel', 'SMS').eq('direction', 'outbound').gte('created_at', monthStart),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', user.clientId).gte('created_at', monthStart),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', user.clientId).gte('enrolled_at', monthStart),
        supabase.from('client_onboarding').select('average_order_value').eq('client_id', user.clientId).maybeSingle(),
        supabase.from('workflow_enrollments').select('workflow_id, status').eq('client_id', user.clientId),
      ]);

      const msgs = messagesRes.data || [];
      const wfs = workflowsRes.data || [];
      const cts = contactsRes.data || [];
      const allEnrollments = allEnrollmentsRes.data || [];

      // Per-workflow enrollment breakdown
      const byWorkflow = {};
      for (const e of allEnrollments) {
        if (!byWorkflow[e.workflow_id]) byWorkflow[e.workflow_id] = { total: 0, completed: 0, active: 0 };
        byWorkflow[e.workflow_id].total++;
        if (e.status === 'completed') byWorkflow[e.workflow_id].completed++;
        if (e.status === 'active') byWorkflow[e.workflow_id].active++;
      }
      setEnrollmentsByWorkflow(byWorkflow);

      const aov = parseAov(onboardingRes.data?.average_order_value);
      const completedTotal = allEnrollments.filter(e => e.status === 'completed').length;

      setContacts(cts);
      setWorkflows(wfs);
      setMessages(msgs);
      setStats({
        totalContacts: cts.length,
        activeWorkflows: wfs.filter(w => w.status === 'active').length,
        messagesSent: msgs.filter(m => m.direction === 'outbound').length,
        messagesReceived: msgs.filter(m => m.direction === 'inbound').length,
        emailsSentMonth: emailsRes.count || 0,
        smsSentMonth: smsRes.count || 0,
        contactsAddedMonth: contactsMonthRes.count || 0,
        enrollmentsMonth: enrollmentsRes.count || 0,
        revenueRecovered: completedTotal * aov,
        completedEnrollments: completedTotal,
      });
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
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const channelIcon = (ch) => ({ Email: '✉', SMS: '💬', WhatsApp: '📱', Instagram: '📸', Facebook: '👥' }[ch] || '💌');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '▦' },
    { id: 'results', label: 'My Results', icon: '📈' },
    { id: 'sequences', label: 'Sequences', icon: '⚡' },
    { id: 'approvals', label: 'My Approvals', icon: '✓' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'contacts', label: 'Contacts', icon: '👥' },
    { id: 'zainab', label: 'Zainab AI', icon: '🤖' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ];

  const pageTitles = {
    dashboard: 'Dashboard',
    results: 'My Results',
    sequences: 'Active Sequences',
    approvals: 'My Approvals',
    messages: 'Messages',
    contacts: 'My Contacts',
    zainab: 'Zainab — AI Partner',
    settings: 'Settings',
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <ClientHome />;
      case 'results': return <ClientResults />;
      case 'sequences': return <ClientSequences />;
      case 'approvals': return <ClientApprovals />;
      case 'messages': return <ClientMessages />;
      case 'contacts': return <ClientContacts />;
      case 'zainab': return <ClientZainab />;
      case 'settings': return <ClientSettings />;
      default: return <ClientHome />;
    }
  };

  // ─── DASHBOARD ────────────────────────────────────────
  const ClientHome = () => (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Welcome back</div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px' }}>Good to see you, {user.name.split(' ')[0]}</div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Your AI revenue system is working for you 24/7</div>
      </div>

      {/* Revenue Recovered Hero Card */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #112240 100%)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '14px', padding: '24px 28px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(10,22,40,0.15)' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Revenue Recovered</div>
          <div style={{ fontSize: '38px', fontWeight: 800, color: '#c9a84c', letterSpacing: '-1.5px', lineHeight: 1 }}>${stats.revenueRecovered.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
            {stats.completedEnrollments} sequences completed · estimated from your average order value
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(201,168,76,0.12)', border: '1.5px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>💰</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '8px', letterSpacing: '1px' }}>ALL TIME</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total Contacts', value: stats.totalContacts, sub: 'in your database', color: '#c9a84c' },
          { label: 'Active Sequences', value: stats.activeWorkflows, sub: 'running automatically', color: '#c9a84c' },
          { label: 'Emails Sent', value: stats.emailsSentMonth, sub: 'this month', color: '#10b981' },
          { label: 'SMS Sent', value: stats.smsSentMonth, sub: 'this month', color: '#3b82f6' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '18px 20px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>{stat.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '5px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Contacts Added', value: stats.contactsAddedMonth, sub: 'this month', color: '#c9a84c' },
          { label: 'Enrollments', value: stats.enrollmentsMonth, sub: 'in sequences this month', color: '#10b981' },
          { label: 'Messages Received', value: stats.messagesReceived, sub: 'replies from customers', color: '#3b82f6' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '18px 20px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>{stat.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '5px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Active Sequences</div>
          {workflows.filter(w => w.status === 'active').length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>⚡</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No active sequences yet</div>
              <div style={{ fontSize: '11px', color: '#8896a8' }}>Your AI team is setting things up</div>
            </div>
          ) : workflows.filter(w => w.status === 'active').map(workflow => {
            const wfStats = enrollmentsByWorkflow[workflow.id] || { total: 0, completed: 0, active: 0 };
            const completionRate = wfStats.total > 0 ? Math.round((wfStats.completed / wfStats.total) * 100) : 0;
            return (
              <div key={workflow.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', marginBottom: '8px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{workflow.name}</div>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>● Active</span>
                </div>
                <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '12px' }}>Trigger: {workflow.trigger_type}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  {[
                    { label: 'Enrolled', value: wfStats.total },
                    { label: 'Active', value: wfStats.active },
                    { label: 'Completed', value: wfStats.completed },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#0a1628' }}>{s.value}</div>
                      <div style={{ fontSize: '9px', color: '#8896a8' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '5px', background: '#f0f3f8', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${completionRate}%`, height: '100%', background: completionRate >= 50 ? '#10b981' : '#c9a84c', borderRadius: '3px', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: completionRate >= 50 ? '#10b981' : '#c9a84c', minWidth: '32px', textAlign: 'right' }}>{completionRate}%</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Recent Activity</div>
            {messages.slice(0, 5).length === 0 ? (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '30px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📬</div>
                <div style={{ fontSize: '12px', color: '#8896a8' }}>No activity yet</div>
              </div>
            ) : messages.slice(0, 5).map(msg => (
              <div key={msg.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '10px 14px', marginBottom: '6px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ fontSize: '18px', flexShrink: 0 }}>{channelIcon(msg.channel)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#0a1628' }}>{msg.direction === 'outbound' ? 'AI Sent' : msg.sender_name}</div>
                  <div style={{ fontSize: '10px', color: '#8896a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.content}</div>
                </div>
                <div style={{ fontSize: '9px', color: '#8896a8', flexShrink: 0 }}>{formatTime(msg.created_at)}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '18px', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Your AI Team</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.7', marginBottom: '14px' }}>Zainab, Ali, Hassan, Mahdi, Fatima and Hussain are working 24/7 to grow your store automatically.</div>
            <button onClick={() => setCurrentPage('zainab')}
              style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c', borderRadius: '8px', padding: '8px 16px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', width: '100%' }}>
              Chat with Zainab →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── RESULTS ──────────────────────────────────────────
  const ClientResults = () => (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Performance</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Results</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Revenue Recovered', value: '$0', sub: 'cart recovery this month', color: '#c9a84c', icon: '💰' },
          { label: 'Contacts Reached', value: stats.messagesSent, sub: 'messages delivered', color: '#10b981', icon: '📨' },
          { label: 'Conversion Rate', value: '0%', sub: 'from sequences', color: '#3b82f6', icon: '🎯' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>{stat.icon}</div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Sequence Performance</div>
        {workflows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8896a8' }}>No sequences yet</div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '10px 14px', background: '#0a1628', borderRadius: '8px', marginBottom: '4px' }}>
              {['SEQUENCE', 'STATUS', 'ENROLLED', 'ACTIVE', 'CONVERTED'].map(h => (
                <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {workflows.map(w => (
              <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 14px', borderBottom: '1px solid #f4f6fa', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{w.name}</div>
                <div>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: w.status === 'active' ? '#ecfdf5' : '#fffbeb', color: w.status === 'active' ? '#059669' : '#d97706', border: `1px solid ${w.status === 'active' ? '#a7f3d0' : '#fde68a'}` }}>
                    {w.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#4a5568' }}>{w.enrolled_count || 0}</div>
                <div style={{ fontSize: '12px', color: '#4a5568' }}>{w.active_count || 0}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#c9a84c' }}>{w.converted_count || 0}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── SEQUENCES ────────────────────────────────────────
  const ClientSequences = () => (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Automation</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>Active Sequences</div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>{workflows.filter(w => w.status === 'active').length} running · {workflows.length} total</div>
      </div>

      {workflows.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No sequences yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Your AI team is building your sequences</div>
        </div>
      ) : workflows.map(workflow => {
        const wfStats = enrollmentsByWorkflow[workflow.id] || { total: 0, completed: 0, active: 0 };
        const completionRate = wfStats.total > 0 ? Math.round((wfStats.completed / wfStats.total) * 100) : 0;
        return (
          <div key={workflow.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>{workflow.name}</div>
                <div style={{ fontSize: '11px', color: '#8896a8' }}>Trigger: {workflow.trigger_type} · Created {formatDate(workflow.created_at)}</div>
              </div>
              <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', fontWeight: 600, background: workflow.status === 'active' ? '#ecfdf5' : '#fffbeb', color: workflow.status === 'active' ? '#059669' : '#d97706', border: `1px solid ${workflow.status === 'active' ? '#a7f3d0' : '#fde68a'}` }}>
                {workflow.status === 'active' ? '● Active' : '○ Paused'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {[
                { label: 'Total Enrolled', value: wfStats.total, color: '#c9a84c' },
                { label: 'Currently Active', value: wfStats.active, color: '#3b82f6' },
                { label: 'Completed', value: wfStats.completed, color: '#10b981' },
                { label: 'Completion Rate', value: `${completionRate}%`, color: completionRate >= 50 ? '#10b981' : '#c9a84c' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', textAlign: 'center', border: '1px solid #f0f3f8' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, marginBottom: '4px' }}>{s.value}</div>
                  <div style={{ fontSize: '10px', color: '#8896a8' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>Completion</div>
              <div style={{ flex: 1, height: '6px', background: '#f0f3f8', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${completionRate}%`, height: '100%', background: `linear-gradient(90deg, ${completionRate >= 50 ? '#10b981' : '#c9a84c'}, ${completionRate >= 50 ? '#059669' : '#a07234'})`, borderRadius: '4px', transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: completionRate >= 50 ? '#10b981' : '#c9a84c', minWidth: '36px' }}>{completionRate}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── MESSAGES ────────────────────────────────────────
  const ClientMessages = () => (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Communications</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>Messages</div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>{messages.length} total · {messages.filter(m => m.direction === 'outbound').length} sent · {messages.filter(m => m.direction === 'inbound').length} received</div>
      </div>

      {messages.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📬</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No messages yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Messages will appear here as your AI team sends them</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: msg.direction === 'outbound' ? '#0a1628' : '#f0f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                {channelIcon(msg.channel)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>
                    {msg.direction === 'outbound' ? `AI → ${msg.channel}` : msg.sender_name}
                  </div>
                  <div style={{ fontSize: '9px', color: '#8896a8' }}>{formatTime(msg.created_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', background: msg.direction === 'outbound' ? '#ecfdf5' : '#eff6ff', color: msg.direction === 'outbound' ? '#059669' : '#3b82f6', border: `1px solid ${msg.direction === 'outbound' ? '#a7f3d0' : '#bfdbfe'}`, fontWeight: 600 }}>
                    {msg.direction === 'outbound' ? '↑ Sent' : '↓ Received'}
                  </span>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', background: '#f8fafc', color: '#8896a8', border: '1px solid #e4e9f0' }}>{msg.channel}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.5' }}>{msg.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── CONTACTS ────────────────────────────────────────
  const ClientContacts = () => (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Database</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Contacts</div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>{contacts.length} customers in your database</div>
      </div>

      {contacts.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👥</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No contacts yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Contacts will appear when your Shopify store is connected</div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', padding: '12px 18px', background: '#0a1628' }}>
            {['CONTACT', 'EMAIL', 'SOURCE', 'ADDED'].map(h => (
              <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700 }}>{h}</div>
            ))}
          </div>
          {contacts.map(contact => (
            <div key={contact.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', padding: '12px 18px', borderBottom: '1px solid #f4f6fa', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>
                  {contact.first_name?.[0]}{contact.last_name?.[0]}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#0a1628' }}>{contact.first_name} {contact.last_name}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#8896a8' }}>{contact.email}</div>
              <div style={{ fontSize: '11px', color: '#4a5568' }}>{contact.source}</div>
              <div style={{ fontSize: '10px', color: '#8896a8' }}>{formatDate(contact.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── ZAINAB ───────────────────────────────────────────
  const ClientZainab = () => {
    const [chatMessages, setChatMessages] = useState([
      { role: 'ai', content: `Hi ${user.name.split(' ')[0]}! I'm Zainab, your dedicated AI partner at Sales Scales. I'm here to help you understand your results, answer questions about your sequences, and make sure your AI revenue system is delivering maximum value. What can I help you with today?` }
    ]);
    const [input, setInput] = useState('');
    const [generating, setGenerating] = useState(false);

    const sendMessage = async () => {
      if (!input.trim()) return;
      const userMsg = input.trim();
      setInput('');
      setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setGenerating(true);

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            system: `You are Zainab, the dedicated AI Client Partner at Sales Scales. You are warm, professional, and genuinely helpful. You are speaking with ${user.name}, the owner of ${user.clientName}. They are on the ${user.tier} plan. Your job is to help them understand their AI revenue system, answer questions about their sequences and results, and make them feel confident that Sales Scales is delivering value. Keep responses concise and friendly. Never mention that you are built on Claude.`,
            messages: [{ role: 'user', content: userMsg }]
          })
        });
        const data = await response.json();
        const reply = data.content?.[0]?.text || 'I am here to help. Could you rephrase your question?';
        setChatMessages(prev => [...prev, { role: 'ai', content: reply }]);
      } catch (e) {
        setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I had trouble connecting. Please try again.' }]);
      }
      setGenerating(false);
    };

    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>AI Client Partner</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>Zainab</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Your dedicated AI partner — available 24/7</div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#c9a84c', fontWeight: 700 }}>Z</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Zainab</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>● Online · AI Client Partner</div>
            </div>
          </div>

          <div style={{ height: '380px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', padding: '12px 14px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: msg.role === 'user' ? '#0a1628' : '#f8fafc', color: msg.role === 'user' ? 'white' : '#0a1628', fontSize: '12px', lineHeight: '1.6', border: msg.role === 'ai' ? '1px solid #e4e9f0' : 'none' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {generating && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '12px 16px', borderRadius: '12px 12px 12px 2px', background: '#f8fafc', border: '1px solid #e4e9f0', fontSize: '12px', color: '#8896a8' }}>Zainab is typing...</div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #e4e9f0', padding: '14px 16px', display: 'flex', gap: '10px' }}>
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask Zainab anything about your results..."
              style={{ flex: 1, border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#0a1628', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
            <button onClick={sendMessage} disabled={generating || !input.trim()}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Send
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── MY APPROVALS ────────────────────────────────────
  const ClientApprovals = () => {
    const [approvals, setApprovals] = useState([]);
    const [loadingA, setLoadingA] = useState(true);
    const [selected, setSelected] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [busy, setBusy] = useState(false);

    const loadApprovals = async () => {
      setLoadingA(true);
      try {
        const { data } = await supabase.from('approvals')
          .select('*').eq('client_id', user.clientId).eq('status', 'pending')
          .order('created_at', { ascending: false });
        setApprovals(data || []);
        if (data && data.length > 0) setSelected(s => s || data[0]);
      } catch (e) {
        console.error('Load approvals error:', e);
      }
      setLoadingA(false);
    };

    useEffect(() => { loadApprovals(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const act = async (approval, action) => {
      if (action === 'reject' && !feedback.trim()) {
        alert('Please describe the changes you would like before requesting changes.');
        return;
      }
      setBusy(true);
      try {
        await axios.post('http://localhost:3001/approvals/action', {
          approval_id: approval.id, action, feedback: action === 'reject' ? feedback.trim() : null,
        });
        setApprovals(prev => prev.filter(a => a.id !== approval.id));
        setSelected(null);
        setFeedback('');
      } catch (e) {
        alert(e.response?.data?.error || 'Something went wrong. Please try again.');
      }
      setBusy(false);
    };

    const steps = selected?.metadata?.steps || [];

    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Pending Review</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Approvals</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Review and approve content before it goes live to your customers</div>
        </div>

        {loadingA ? (
          <div style={{ color: '#8896a8', fontSize: '13px', padding: '40px 0', textAlign: 'center' }}>Loading approvals...</div>
        ) : approvals.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>All caught up</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>You have no content waiting for approval right now.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', alignItems: 'start' }}>
            {/* LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {approvals.map(a => (
                <div key={a.id} onClick={() => { setSelected(a); setFeedback(''); }}
                  style={{ background: 'white', border: `1px solid ${selected?.id === a.id ? '#c9a84c' : '#e4e9f0'}`, borderLeft: `3px solid ${selected?.id === a.id ? '#c9a84c' : 'transparent'}`, borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
                  <div style={{ fontSize: '8px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>{(a.type || 'content').replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', lineHeight: 1.4 }}>{a.title}</div>
                  <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '6px' }}>{formatDate(a.created_at)}</div>
                </div>
              ))}
            </div>

            {/* DETAIL */}
            {selected ? (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
                <div style={{ background: '#0a1628', padding: '18px 22px' }}>
                  <div style={{ fontSize: '8px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{(selected.type || 'content').replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>{selected.title}</div>
                </div>
                <div style={{ padding: '22px', maxHeight: '420px', overflowY: 'auto' }}>
                  {steps.length > 0 ? (
                    steps.map((s, i) => (
                      <div key={i} style={{ borderBottom: i < steps.length - 1 ? '1px solid #f4f6fa' : 'none', paddingBottom: '14px', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '8px', padding: '3px 8px', borderRadius: '5px', background: 'rgba(201,168,76,0.12)', color: '#c9a84c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.step_type || 'step'}</span>
                          {s.wait_hours ? <span style={{ fontSize: '10px', color: '#8896a8' }}>sends after {s.wait_hours}h</span> : null}
                        </div>
                        {s.subject ? <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>{s.subject}</div> : null}
                        <div style={{ fontSize: '12px', color: '#4a5568', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.content}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '13px', color: '#4a5568', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selected.content || 'No content preview available.'}</div>
                  )}
                </div>
                <div style={{ borderTop: '1px solid #e4e9f0', padding: '18px 22px', background: '#f8fafc' }}>
                  <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Optional: describe any changes you'd like (required if requesting changes)"
                    style={{ width: '100%', minHeight: '64px', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#0a1628', fontFamily: 'DM Sans, sans-serif', resize: 'vertical', boxSizing: 'border-box', marginBottom: '12px' }} />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button disabled={busy} onClick={() => act(selected, 'approve')}
                      style={{ flex: 1, padding: '11px', background: busy ? '#e4e9f0' : '#10b981', color: busy ? '#8896a8' : 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
                      {busy ? 'Working...' : 'Approve & Go Live'}
                    </button>
                    <button disabled={busy} onClick={() => act(selected, 'reject')}
                      style={{ flex: 1, padding: '11px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
                      Request Changes
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#8896a8', fontSize: '13px', padding: '40px', textAlign: 'center' }}>Select an item to review.</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── SETTINGS ────────────────────────────────────────
  const ClientSettings = () => {
    const KB_FIELDS = [
      { key: 'brand_voice', label: 'Brand Voice & Tone', placeholder: 'How should your brand sound? e.g. friendly and casual, premium and polished, bold and direct...' },
      { key: 'key_products', label: 'Key Products', placeholder: 'List your best-selling or flagship products, their key benefits, and price points.' },
      { key: 'faqs', label: 'Frequently Asked Questions', placeholder: 'Common customer questions and the answers you want the AI to give.' },
      { key: 'return_policy', label: 'Return & Refund Policy', placeholder: 'Your return window, refund process, and any conditions.' },
    ];
    const [profile, setProfile] = useState({ brand_voice: '', key_products: '', faqs: '', return_policy: '' });
    const [loadingP, setLoadingP] = useState(true);
    const [savingP, setSavingP] = useState(false);
    const [savedP, setSavedP] = useState(false);

    useEffect(() => {
      (async () => {
        try {
          const { data } = await axios.get('http://localhost:3001/client-profile', { params: { client_id: user.clientId } });
          if (data.profile) {
            setProfile({
              brand_voice: data.profile.brand_voice || '',
              key_products: data.profile.key_products || '',
              faqs: data.profile.faqs || '',
              return_policy: data.profile.return_policy || '',
            });
          }
        } catch (e) {
          console.error('Load profile error:', e);
        }
        setLoadingP(false);
      })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const saveProfile = async () => {
      setSavingP(true);
      setSavedP(false);
      try {
        await axios.post('http://localhost:3001/client-profile', { client_id: user.clientId, ...profile });
        setSavedP(true);
        setTimeout(() => setSavedP(false), 2500);
      } catch (e) {
        alert(e.response?.data?.error || 'Could not save. Please try again.');
      }
      setSavingP(false);
    };

    return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Account</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>Settings</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Account Details</div>
          {[
            { label: 'Name', value: user.name },
            { label: 'Email', value: user.email },
            { label: 'Store', value: user.clientName },
            { label: 'Plan', value: user.tier?.charAt(0).toUpperCase() + user.tier?.slice(1) },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f4f6fa' }}>
              <div style={{ fontSize: '11px', color: '#8896a8', fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: '12px', color: '#0a1628', fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Your Plan</div>
          <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '10px', padding: '20px', marginBottom: '14px', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{user.tier} Plan</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
              ${user.tier === 'growth' ? '3,000' : user.tier === 'elite' ? '6,000' : '1,500'}/mo
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>AI Revenue System · Sales Scales</div>
          </div>
          <button style={{ width: '100%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c', borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Upgrade Plan →
          </button>
        </div>
      </div>

      {/* KNOWLEDGE BASE */}
      <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Your Store Knowledge Base</div>
          <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600 }}>Used by your AI team</span>
        </div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '18px', lineHeight: 1.6 }}>
          Tell your AI team about your store. This information is used whenever the AI writes emails, replies, or sequences for you — so the more you share, the more on-brand everything sounds.
        </div>

        {loadingP ? (
          <div style={{ color: '#8896a8', fontSize: '13px', padding: '20px 0' }}>Loading...</div>
        ) : (
          <>
            {KB_FIELDS.map(f => (
              <div key={f.key} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '7px' }}>{f.label}</label>
                <textarea
                  value={profile[f.key]}
                  onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', minHeight: '72px', border: '1.5px solid #e4e9f0', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: '#0a1628', fontFamily: 'DM Sans, sans-serif', resize: 'vertical', boxSizing: 'border-box', background: '#fafbfc', outline: 'none' }} />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button onClick={saveProfile} disabled={savingP}
                style={{ background: savingP ? '#e4e9f0' : '#c9a84c', color: savingP ? '#8896a8' : '#0a1628', border: 'none', borderRadius: '10px', padding: '11px 28px', fontSize: '13px', fontWeight: 700, cursor: savingP ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                {savingP ? 'Saving...' : 'Save Knowledge Base'}
              </button>
              {savedP && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>✓ Saved — your AI team is now using this</span>}
            </div>
          </>
        )}
      </div>
    </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'DM Sans, sans-serif', background: '#f0f3f8' }}>
      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#0a1628', display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* LOGO */}
        <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '4px', color: 'white', marginBottom: '3px' }}>SALES SCALES</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', marginBottom: '10px' }}>AI REVENUE SYSTEM</div>
          <div style={{ height: '1px', width: '32px', background: 'linear-gradient(90deg, #c9a84c, transparent)', borderRadius: '1px' }}></div>
        </div>

        {/* STORE INFO */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'white', marginBottom: '2px' }}>{user.clientName}</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{user.tier?.charAt(0).toUpperCase() + user.tier?.slice(1)} Plan</div>
        </div>

        {/* NAV */}
        <div style={{ padding: '12px 0', flex: 1 }}>
          {navItems.map(item => (
            <div key={item.id} onClick={() => setCurrentPage(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 18px', fontSize: '12px', color: currentPage === item.id ? '#c9a84c' : 'rgba(255,255,255,0.5)', cursor: 'pointer', borderLeft: `2px solid ${currentPage === item.id ? '#c9a84c' : 'transparent'}`, background: currentPage === item.id ? 'rgba(201,168,76,0.07)' : 'transparent', fontWeight: currentPage === item.id ? 600 : 400, transition: 'all 0.15s' }}>
              <span style={{ fontSize: '14px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{ padding: '16px 18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px', fontWeight: 500 }}>{user.name}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>{user.email}</div>
          <button onClick={onLogout} style={{ width: '100%', padding: '7px', fontSize: '10px', borderRadius: '7px', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* TOPBAR */}
        <div style={{ background: 'white', borderBottom: '1px solid #e4e9f0', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(10,22,40,0.04)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628' }}>{pageTitles[currentPage]}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(201,168,76,0.1)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {user.tier} Plan
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#c9a84c', fontWeight: 700, border: '1.5px solid rgba(201,168,76,0.2)' }}>
              {user.name?.[0]}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#8896a8' }}>Loading your dashboard...</div>
          ) : renderPage()}
        </div>
      </div>
    </div>
  );
}