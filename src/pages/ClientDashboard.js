import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';
import { API_BASE } from '../config';

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
  const [products, setProducts] = useState([]);
  const [enrollmentsByWorkflow, setEnrollmentsByWorkflow] = useState({});
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: `Hi ${user.name.split(' ')[0]}! I'm Zainab, your dedicated AI partner at Sales Scales. I'm here to help you understand your results, answer questions about your sequences, and make sure your AI revenue system is delivering maximum value. What can I help you with today?` }
  ]);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [referralData, setReferralData] = useState({ referral_code: null, referral_link: null, referrals: [], total: 0, converted: 0, rewards_earned: 0 });

  useEffect(() => { fetchData(); }, [user.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    axios.get(`${API_BASE}/referrals/client-stats?client_id=${user.clientId}`)
      .then(r => setReferralData(r.data))
      .catch(() => {});
  }, [user.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    axios.get(`${API_BASE}/shopify/products?client_id=${user.clientId}`)
      .then(r => setProducts(r.data.products || []))
      .catch(() => setProducts([]));
  }, [user.clientId]);

  useEffect(() => {
    (async () => {
      const lsKey = `wt_done_${user.email}`;
      try {
        const { data } = await supabase
          .from('client_users')
          .select('first_login_completed')
          .eq('email', user.email)
          .maybeSingle();
        if (!data?.first_login_completed && localStorage.getItem(lsKey) !== 'true') {
          setShowWalkthrough(true);
        }
      } catch {
        if (localStorage.getItem(lsKey) !== 'true') setShowWalkthrough(true);
      }
    })();
  }, [user.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const openWalkthrough = () => { setWalkthroughStep(0); setShowWalkthrough(true); };

  const completeWalkthrough = async () => {
    localStorage.setItem(`wt_done_${user.email}`, 'true');
    try {
      await supabase.from('client_users').update({ first_login_completed: true }).eq('email', user.email);
    } catch { /* column may not exist yet — localStorage fallback is set */ }
    setWalkthroughStep(4);
  };

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
    { id: 'calls', label: 'My Calls', icon: '📞' },
    { id: 'reports', label: 'My Reports', icon: '📄' },
    { id: 'invoices', label: 'My Invoices', icon: '🧾' },
    { id: 'zainab', label: 'Zainab AI', icon: '🤖' },
    { id: 'referrals', label: 'Refer & Earn', icon: '🎁' },
    { id: 'help', label: 'Help', icon: '❔' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ];

  const pageTitles = {
    dashboard: 'Dashboard',
    results: 'My Results',
    sequences: 'Active Sequences',
    approvals: 'My Approvals',
    messages: 'Messages',
    contacts: 'My Contacts',
    calls: 'My Calls',
    reports: 'My Reports',
    invoices: 'My Invoices',
    zainab: 'Zainab — AI Partner',
    referrals: 'Refer & Earn',
    help: 'Help & Support',
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
      case 'calls': return <ClientCalls />;
      case 'reports': return <ClientReports />;
      case 'invoices': return <ClientInvoices />;
      case 'zainab': return <ClientZainab chatMessages={chatMessages} setChatMessages={setChatMessages} />;
      case 'referrals': return <ClientReferrals />;
      case 'help': return <ClientHelp />;
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

      {/* MY PRODUCTS */}
      {products.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>My Products</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {products.map((p, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
                <div style={{ width: '100%', height: '120px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {p.image ? (
                    <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: '28px' }}>🛍️</div>
                  )}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#c9a84c', marginTop: '4px' }}>${p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REFERRAL BANNER */}
      <div style={{ marginTop: '24px', background: 'linear-gradient(135deg, #112240, #0a1628)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '14px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '28px', flexShrink: 0 }}>🎁</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>
              Refer a friend — earn 1 month free
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              {referralData.total > 0
                ? `${referralData.total} referral${referralData.total !== 1 ? 's' : ''} made · ${referralData.rewards_earned} month${referralData.rewards_earned !== 1 ? 's' : ''} earned`
                : 'Share your referral link — every paying signup earns you one free month.'}
            </div>
          </div>
        </div>
        <button onClick={() => setCurrentPage('referrals')}
          style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {referralData.rewards_earned > 0 ? `🏆 ${referralData.rewards_earned} Month${referralData.rewards_earned !== 1 ? 's' : ''} Earned` : 'View Referral Link →'}
        </button>
      </div>
    </div>
  );

  // ─── REFER & EARN ─────────────────────────────────────
  const ClientReferrals = () => {
    const [copied, setCopied] = useState(false);

    const copyLink = () => {
      const link = referralData.referral_link;
      if (!link) return;
      try {
        navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(fallback);
      } catch { fallback(); }
      function fallback() {
        const el = document.createElement('textarea');
        el.value = link;
        el.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    const statusBadge = (status) => {
      const map = {
        pending:      { bg: '#f8fafc', color: '#8896a8', label: 'Pending' },
        signed_up:    { bg: '#eff6ff', color: '#3b82f6', label: 'Signed Up' },
        paid:         { bg: '#ecfdf5', color: '#059669', label: 'Paid' },
        reward_issued:{ bg: '#fffbeb', color: '#c9a84c', label: '🏆 Reward Issued' },
      };
      const s = map[status] || map.pending;
      return <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color, fontWeight: 600, border: `1px solid ${s.color}33` }}>{s.label}</span>;
    };

    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Referral Program</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>Refer & Earn</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Refer a business to Sales Scales — earn 1 month free for every paying signup</div>
        </div>

        {/* REFERRAL LINK HERO */}
        <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '14px', padding: '24px 28px', marginBottom: '20px' }}>
          <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Your Referral Link</div>
          {referralData.referral_link ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '11px 14px', fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontFamily: 'DM Mono, monospace', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {referralData.referral_link}
              </div>
              <button onClick={copyLink}
                style={{ background: copied ? '#10b981' : '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Generating your link...</div>
          )}
          {referralData.referral_code && (
            <div style={{ marginTop: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
              Code: <span style={{ fontFamily: 'DM Mono, monospace', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{referralData.referral_code}</span>
            </div>
          )}
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Referrals', value: referralData.total, sub: 'businesses referred', color: '#3b82f6' },
            { label: 'Converted & Paid', value: referralData.converted, sub: 'paid their first month', color: '#10b981' },
            { label: 'Months Earned', value: referralData.rewards_earned, sub: 'free months credited', color: '#c9a84c' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', borderTop: `2px solid ${s.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>{s.label}</div>
              <div style={{ fontSize: '30px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: s.color, fontWeight: 500 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* REFERRALS TABLE */}
        {referralData.referrals.length > 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', padding: '12px 18px', background: '#0a1628' }}>
              {['Business', 'Email', 'Status', 'Date'].map(h => (
                <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {referralData.referrals.map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', padding: '12px 18px', borderBottom: '1px solid #f4f6fa', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{r.referred_business || '—'}</div>
                <div style={{ fontSize: '11px', color: '#8896a8' }}>{r.referred_email || '—'}</div>
                <div>{statusBadge(r.status)}</div>
                <div style={{ fontSize: '10px', color: '#8896a8' }}>{formatDate(r.created_at)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', marginBottom: '20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎁</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No referrals yet</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>Share your link — every business that signs up and pays earns you 1 free month.</div>
          </div>
        )}

        {/* HOW IT WORKS */}
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>How It Works</div>
          {[
            { n: '1', title: 'Share your link', body: 'Send your referral link to any ecommerce business that could benefit from AI-powered revenue automation.' },
            { n: '2', title: 'They sign up', body: 'When they use your link to sign up, we track the referral automatically — no extra steps needed.' },
            { n: '3', title: 'They pay their first month', body: 'Once the referred business completes their first payment, you earn 1 month free.' },
            { n: '4', title: 'Credit applied automatically', body: 'Your free month is applied to your next billing cycle. No action needed on your part.' },
          ].map(step => (
            <div key={step.n} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#c9a84c', flexShrink: 0 }}>{step.n}</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '2px' }}>{step.title}</div>
                <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: 1.6 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── RESULTS ──────────────────────────────────────────
  const ClientResults = () => {
    const emailMsgs = messages.filter(m => (m.channel === 'Email' || m.channel === 'email') && m.direction === 'outbound');
    const emailSent = emailMsgs.length;
    const emailOpened = emailMsgs.filter(m => m.opened_at).length;
    const emailClicked = emailMsgs.filter(m => m.clicked_at).length;
    const openRate = emailSent ? Math.round((emailOpened / emailSent) * 100) : 0;
    const clickRate = emailSent ? Math.round((emailClicked / emailSent) * 100) : 0;

    return (
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

      {/* EMAIL PERFORMANCE */}
      <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', marginBottom: '20px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Email Performance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          {[
            { label: 'Emails Sent', value: emailSent, color: '#0a1628' },
            { label: 'Opened', value: emailOpened, color: '#3b82f6' },
            { label: 'Open Rate', value: `${openRate}%`, color: '#3b82f6' },
            { label: 'Clicked', value: emailClicked, color: '#c9a84c' },
            { label: 'Click Rate', value: `${clickRate}%`, color: '#10b981' },
          ].map(s => (
            <div key={s.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', textAlign: 'center', border: '1px solid #f0f3f8' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: s.color, marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
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
  };

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
  const ClientZainab = ({ chatMessages, setChatMessages }) => {
    const [input, setInput] = useState('');
    const [generating, setGenerating] = useState(false);

    const sendMessage = async () => {
      if (!input.trim()) return;
      const userMsg = input.trim();
      setInput('');
      setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setGenerating(true);

      try {
        const { data } = await axios.post(`${API_BASE}/client/zainab`, {
          client_id: user.clientId,
          client_name: user.clientName,
          message: userMsg,
        });
        const reply = data.reply || 'I am here to help. Could you rephrase your question?';
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
    const [editing, setEditing] = useState(false);
    const [editContent, setEditContent] = useState('');

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
        await axios.post(`${API_BASE}/approvals/action`, {
          approval_id: approval.id, action, feedback: action === 'reject' ? feedback.trim() : null,
          edited_content: action === 'approve' && editing ? editContent : undefined,
        });
        setApprovals(prev => prev.filter(a => a.id !== approval.id));
        setSelected(null);
        setFeedback('');
        setEditing(false);
        setEditContent('');
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
                <div key={a.id} onClick={() => { setSelected(a); setFeedback(''); setEditing(false); setEditContent(''); }}
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
                  {editing ? (
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      placeholder="Edit the content before approving..."
                      style={{ width: '100%', minHeight: '240px', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#0a1628', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }} />
                  ) : steps.length > 0 ? (
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
                      {busy ? 'Working...' : editing ? 'Save & Go Live' : 'Approve & Go Live'}
                    </button>
                    {editing ? (
                      <button disabled={busy} onClick={() => { setEditing(false); setEditContent(''); }}
                        style={{ flex: 1, padding: '11px', background: 'white', color: '#64748b', border: '1px solid #e4e9f0', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
                        Cancel Edit
                      </button>
                    ) : (
                      <button disabled={busy} onClick={() => { setEditing(true); setEditContent(selected.content || ''); }}
                        style={{ flex: 1, padding: '11px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
                        Edit
                      </button>
                    )}
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

  // ─── MY CALLS ────────────────────────────────────────
  const ClientCalls = () => {
    const [calls, setCalls] = useState([]);
    const [loadingC, setLoadingC] = useState(true);

    const fmtDur = (s) => {
      if (!s && s !== 0) return '—';
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };

    useEffect(() => {
      (async () => {
        try {
          const { data } = await axios.get(`${API_BASE}/calls/list?client_id=${user.clientId}`);
          setCalls(data.calls || []);
        } catch (e) {
          console.error('Load calls error:', e);
        }
        setLoadingC(false);
      })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Voice Calls</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Calls</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Recordings and transcripts of your AI-handled calls</div>
        </div>

        {loadingC ? (
          <div style={{ color: '#8896a8', fontSize: '13px', padding: '40px 0', textAlign: 'center' }}>Loading calls...</div>
        ) : calls.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📞</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No calls yet</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>Your call recordings and transcripts will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {calls.map(c => (
              <div key={c.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f3f8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, letterSpacing: '0.5px', background: c.direction === 'inbound' ? '#eff6ff' : '#fef9ec', color: c.direction === 'inbound' ? '#3b82f6' : '#c9a84c', border: `1px solid ${c.direction === 'inbound' ? '#bfdbfe' : '#f0e0b0'}` }}>
                      {c.direction === 'inbound' ? '↓ INBOUND' : '↑ OUTBOUND'}
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628' }}>{c.contact_phone || 'Unknown'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#8896a8' }}>{fmtDur(c.duration_seconds)}</div>
                    <div style={{ fontSize: '11px', color: '#8896a8' }}>{formatDate(c.created_at)}</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {c.summary && (
                    <div style={{ fontSize: '13px', color: '#0a1628', lineHeight: 1.7, marginBottom: '14px', fontWeight: 500 }}>{c.summary}</div>
                  )}
                  <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Transcript</div>
                  <div style={{ fontSize: '12px', color: '#4a5568', lineHeight: 1.8, whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: '8px', padding: '14px 16px', maxHeight: '320px', overflowY: 'auto' }}>
                    {c.transcript || 'No transcript available for this call.'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── MY REPORTS ──────────────────────────────────────
  const ClientReports = () => {
    const [reports, setReports] = useState([]);
    const [loadingR, setLoadingR] = useState(true);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
      (async () => {
        try {
          const { data } = await supabase.from('reports')
            .select('*').eq('client_id', user.clientId).order('created_at', { ascending: false });
          setReports(data || []);
        } catch (e) {
          console.error('Load reports error:', e);
        }
        setLoadingR(false);
      })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Monthly Performance</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Reports</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Your monthly performance reports, written by Zainab</div>
        </div>

        {loadingR ? (
          <div style={{ color: '#8896a8', fontSize: '13px', padding: '40px 0', textAlign: 'center' }}>Loading reports...</div>
        ) : reports.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No reports yet</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>Your first monthly report will appear here once it's ready.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reports.map(r => (
              <div key={r.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
                <div onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628' }}>{r.period || 'Report'}</div>
                    <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '3px' }}>{formatDate(r.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a1628' }}>{r.emails_sent || 0}</div>
                      <div style={{ fontSize: '8px', color: '#8896a8', letterSpacing: '1px', textTransform: 'uppercase' }}>Emails</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a1628' }}>{r.sms_sent || 0}</div>
                      <div style={{ fontSize: '8px', color: '#8896a8', letterSpacing: '1px', textTransform: 'uppercase' }}>SMS</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a1628' }}>{r.contacts_added || 0}</div>
                      <div style={{ fontSize: '8px', color: '#8896a8', letterSpacing: '1px', textTransform: 'uppercase' }}>Contacts</div>
                    </div>
                    <span style={{ fontSize: '14px', color: '#c9a84c' }}>{expanded === r.id ? '▲' : '▼'}</span>
                  </div>
                </div>
                {expanded === r.id && (
                  <div style={{ borderTop: '1px solid #e4e9f0', padding: '20px', background: '#f8fafc' }}>
                    {r.top_sequence && (
                      <div style={{ marginBottom: '14px' }}>
                        <span style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase' }}>Top Sequence: </span>
                        <span style={{ fontSize: '12px', color: '#0a1628', fontWeight: 600 }}>{r.top_sequence}</span>
                      </div>
                    )}
                    <div style={{ fontSize: '13px', color: '#4a5568', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{r.summary || 'No written summary available for this report.'}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── MY INVOICES ─────────────────────────────────────
  const ClientInvoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [loadingI, setLoadingI] = useState(true);
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
      (async () => {
        try {
          const { data, error } = await supabase.from('invoices')
            .select('*').eq('client_id', user.clientId).order('created_at', { ascending: false });
          if (error) { setUnavailable(true); }
          else setInvoices(data || []);
        } catch (e) {
          setUnavailable(true);
        }
        setLoadingI(false);
      })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const statusBadge = (status) => {
      const map = {
        paid: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
        pending: { bg: 'rgba(217,119,6,0.1)', color: '#d97706' },
        overdue: { bg: 'rgba(220,38,38,0.1)', color: '#dc2626' },
        draft: { bg: '#f4f6fa', color: '#8896a8' },
      };
      const s = map[(status || '').toLowerCase()] || map.draft;
      return <span style={{ fontSize: '9px', padding: '4px 10px', borderRadius: '20px', background: s.bg, color: s.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{status || 'draft'}</span>;
    };

    const fmtAmount = (v) => {
      const n = Number(v);
      return isNaN(n) ? '—' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Billing</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Invoices</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Your billing history with Sales Scales</div>
        </div>

        {loadingI ? (
          <div style={{ color: '#8896a8', fontSize: '13px', padding: '40px 0', textAlign: 'center' }}>Loading invoices...</div>
        ) : unavailable ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧾</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Invoices not available yet</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>Your invoices will show here once billing is set up. Reach out via Help if you have a billing question.</div>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧾</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No invoices yet</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>You don't have any invoices on file right now.</div>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 0.8fr', padding: '12px 20px', background: '#0a1628', fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase' }}>
              <div>Invoice</div><div>Amount</div><div>Status</div><div>Due</div><div style={{ textAlign: 'right' }}>Created</div>
            </div>
            {invoices.map(inv => (
              <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 0.8fr', padding: '14px 20px', borderBottom: '1px solid #f4f6fa', alignItems: 'center', fontSize: '12px', color: '#0a1628' }}>
                <div style={{ fontWeight: 600 }}>{inv.invoice_number || inv.number || `#${String(inv.id).slice(0, 8)}`}</div>
                <div style={{ fontWeight: 700 }}>{fmtAmount(inv.amount ?? inv.total ?? inv.amount_due)}</div>
                <div>{statusBadge(inv.status)}</div>
                <div style={{ color: '#8896a8' }}>{inv.due_date ? formatDate(inv.due_date) : '—'}</div>
                <div style={{ textAlign: 'right', color: '#8896a8' }}>{formatDate(inv.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── HELP & SUPPORT ──────────────────────────────────
  const ClientHelp = () => (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Support</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>Help &amp; Support</div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>We're here to help you get the most out of Sales Scales</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Contact Us</div>
          {[
            { label: 'Email', value: 'support@salesscales.com', href: 'mailto:support@salesscales.com' },
            { label: 'Account Partner', value: 'Zainab — available 24/7 in the Zainab AI tab' },
            { label: 'Response Time', value: 'Within 1 business day' },
          ].map(item => (
            <div key={item.label} style={{ padding: '11px 0', borderBottom: '1px solid #f4f6fa' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
              {item.href
                ? <a href={item.href} style={{ fontSize: '13px', color: '#c9a84c', fontWeight: 600, textDecoration: 'none' }}>{item.value}</a>
                : <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 500 }}>{item.value}</div>}
            </div>
          ))}
        </div>

        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '22px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>How to Get Support</div>
          {[
            'Ask Zainab AI any question about your results, sequences, or reports — she has your store data and answers instantly.',
            'Review pending content in My Approvals before it goes live to your customers.',
            'Check My Reports each month for a full performance breakdown.',
            'For billing questions, see My Invoices or email our support team.',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#c9a84c', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
              <div style={{ fontSize: '12px', color: '#4a5568', lineHeight: 1.6 }}>{step}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '12px', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>Need to talk to your AI partner?</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Zainab is online now and ready to help with anything.</div>
        </div>
        <button onClick={() => setCurrentPage('zainab')} style={{ background: '#c9a84c', border: 'none', borderRadius: '10px', padding: '11px 24px', fontSize: '13px', fontWeight: 700, color: '#0a1628', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
          Chat with Zainab →
        </button>
      </div>
    </div>
  );

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
    const [whatsappNumber, setWhatsappNumber] = useState('');

    useEffect(() => {
      (async () => {
        try {
          const { data } = await axios.get(`${API_BASE}/client-profile`, { params: { client_id: user.clientId } });
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
        await axios.post(`${API_BASE}/client-profile`, { client_id: user.clientId, ...profile });
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

      {/* INTEGRATIONS */}
      <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Integrations</div>
          <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(201,168,76,0.1)', color: '#c9a84c', fontWeight: 600 }}>Managed for you</span>
        </div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '18px', lineHeight: 1.6 }}>
          Your messaging channels are set up and managed by the Sales Scales team on your behalf. Add your WhatsApp Business number below and we'll handle the rest.
        </div>

        {/* WhatsApp Business */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ti ti-brand-whatsapp" style={{ color: '#25d366' }} aria-hidden="true"></i> WhatsApp Business Number
          </div>
          <input type="text" value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)}
            placeholder="+1 555 123 4567"
            style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '11px 14px', fontSize: '12px', color: '#0a1628', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
        </div>

        {/* Facebook + Instagram status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-brand-facebook" style={{ fontSize: '18px', color: '#1877f2' }} aria-hidden="true"></i>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>Facebook Page</div>
            </div>
            <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(217,119,6,0.1)', color: '#d97706', fontWeight: 600 }}>Pending Setup</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-brand-instagram" style={{ fontSize: '18px', color: '#e1306c' }} aria-hidden="true"></i>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>Instagram</div>
            </div>
            <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(217,119,6,0.1)', color: '#d97706', fontWeight: 600 }}>Pending Setup</span>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '14px', lineHeight: 1.6 }}>
          These connections are managed by the Sales Scales team on your behalf. We'll reach out if we need anything from you to complete setup.
        </div>
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
            <button onClick={openWalkthrough}
              style={{ background: 'transparent', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '6px 13px', fontSize: '11px', fontWeight: 600, color: '#8896a8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#c9a84c'; e.currentTarget.style.color = '#c9a84c'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e9f0'; e.currentTarget.style.color = '#8896a8'; }}>
              <i className="ti ti-help-circle" style={{ fontSize: '14px' }} /> Setup Guide
            </button>
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

      {/* ── ONBOARDING WALKTHROUGH MODAL ───────────────────── */}
      {showWalkthrough && (() => {
        const STEPS = [
          {
            icon: '🎉',
            title: `Welcome to Sales Scales, ${user.name.split(' ')[0]}`,
            body: "Your AI revenue system is live. This quick tour takes 2 minutes and shows you exactly where everything is — so you can get results from day one.",
            detail: null,
            cta: 'Start Tour →',
          },
          {
            icon: '🛍️',
            title: 'Connect Your Shopify Store',
            body: 'Connecting Shopify unlocks cart recovery sequences, automatic customer sync, and live product data. Your AI team uses this to recover abandoned carts while you sleep.',
            detail: products.length > 0
              ? { ok: true, text: `✓ Shopify connected — ${products.length} product${products.length !== 1 ? 's' : ''} loaded` }
              : { ok: false, text: 'Not connected yet — ask your Sales Scales team to set this up, or connect via the Integrations page.' },
            cta: 'Continue →',
          },
          {
            icon: '⚡',
            title: 'Review Your Sequences',
            body: "Your AI team has already built automated email, SMS, and WhatsApp sequences for you. Head to My Approvals to review them and send them live with one click.",
            detail: (() => {
              const active = workflows.filter(w => w.status === 'active').length;
              const total = workflows.length;
              return { ok: total > 0, text: total > 0 ? `${active} sequence${active !== 1 ? 's' : ''} active · ${total} total built for you` : 'No sequences yet — your AI team is building them now.' };
            })(),
            cta: 'Got It →',
          },
          {
            icon: '🚀',
            title: "You're All Set",
            body: "Zainab, Hassan, Ali, Mahdi, Fatima, and Hussain are working 24/7 on your store. Check your Dashboard to watch results come in — and use the Setup Guide button any time to reopen this tour.",
            detail: null,
            cta: 'Launch My Dashboard',
          },
        ];

        const TOTAL = STEPS.length;
        const isCongrats = walkthroughStep >= TOTAL;
        const step = isCongrats ? null : STEPS[walkthroughStep];

        const advance = () => {
          if (walkthroughStep < TOTAL - 1) {
            setWalkthroughStep(s => s + 1);
          } else {
            completeWalkthrough();
          }
        };

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(10,22,40,0.32)' }}>

              {/* Header */}
              <div style={{ background: '#0a1628', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a84c', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>Z</div>
                <div>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>Zainab · Client Partner</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginTop: '1px' }}>{isCongrats ? 'Onboarding complete' : `Step ${walkthroughStep + 1} of ${TOTAL}`}</div>
                </div>
                {isCongrats && (
                  <button onClick={() => setShowWalkthrough(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
                )}
              </div>

              {/* Progress bar */}
              {!isCongrats && (
                <div style={{ display: 'flex', gap: '4px', padding: '14px 22px 0' }}>
                  {STEPS.map((_, i) => (
                    <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= walkthroughStep ? '#c9a84c' : '#e4e9f0', transition: 'background 0.3s' }} />
                  ))}
                </div>
              )}

              <div style={{ padding: '22px 24px 24px' }}>
                {isCongrats ? (
                  /* Congrats state */
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ fontSize: '44px', marginBottom: '14px' }}>🚀</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0a1628', marginBottom: '8px' }}>You're live!</div>
                    <div style={{ fontSize: '13px', color: '#8896a8', lineHeight: 1.7, marginBottom: '24px' }}>
                      Your AI revenue system is fully active. The team is working around the clock — check back tomorrow to see your first results.
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '14px 16px', marginBottom: '22px', textAlign: 'left' }}>
                      <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Your next steps</div>
                      {[
                        'Check My Approvals to review and activate your sequences',
                        'Ask Zainab anything about your results via the Zainab AI tab',
                        'Use the Setup Guide button in the header to reopen this tour',
                      ].map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: i < 2 ? '8px' : 0 }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#c9a84c', flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ fontSize: '12px', color: '#4a5568', lineHeight: 1.5 }}>{t}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => { setShowWalkthrough(false); setCurrentPage('dashboard'); }}
                      style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 32px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', width: '100%', fontFamily: 'DM Sans, sans-serif' }}>
                      Go to Dashboard →
                    </button>
                  </div>
                ) : (
                  /* Step content */
                  <>
                    <div style={{ fontSize: '32px', marginBottom: '14px' }}>{step.icon}</div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: '#0a1628', marginBottom: '10px', lineHeight: 1.3 }}>{step.title}</div>
                    <div style={{ fontSize: '13px', color: '#4a5568', lineHeight: 1.7, marginBottom: step.detail ? '14px' : '22px' }}>{step.body}</div>

                    {step.detail && (
                      <div style={{ background: step.detail.ok ? '#f0fdf4' : '#fffbeb', border: `1px solid ${step.detail.ok ? '#bbf7d0' : '#fde68a'}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '22px', fontSize: '12px', color: step.detail.ok ? '#166534' : '#92400e', fontWeight: 500 }}>
                        {step.detail.text}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {walkthroughStep > 0 && (
                        <button onClick={() => setWalkthroughStep(s => s - 1)}
                          style={{ padding: '11px 18px', background: 'transparent', border: '1px solid #e4e9f0', borderRadius: '10px', fontSize: '12px', fontWeight: 600, color: '#8896a8', cursor: 'pointer' }}>
                          ← Back
                        </button>
                      )}
                      <button onClick={advance}
                        style={{ flex: 1, padding: '12px', background: '#0a1628', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                        {step.cta}
                      </button>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                      <button onClick={() => setShowWalkthrough(false)}
                        style={{ background: 'none', border: 'none', fontSize: '11px', color: '#8896a8', cursor: 'pointer', textDecoration: 'underline' }}>
                        Skip for now
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}