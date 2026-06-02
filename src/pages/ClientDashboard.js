import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';
import { API_BASE } from '../config';
import { t } from '../i18n';

function WhatIsThis({ text, dark }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: dark ? 'rgba(255,255,255,0.08)' : '#f0f3f8', border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : '#e4e9f0'}`, borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: dark ? 'rgba(255,255,255,0.5)' : '#8896a8', cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>
        ? What is this
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: '#0a1628', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, padding: '12px 14px', width: 260, fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {text}
          <button onClick={() => setOpen(false)} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: '#c9a84c', fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Got it ✓</button>
        </div>
      )}
    </div>
  );
}

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
  const ZAINAB_WELCOME = `Hi ${user.name.split(' ')[0]}! I'm Zainab, your dedicated AI partner at Sales Scales. I'm here to help you understand your results, answer questions about your sequences, and make sure your AI revenue system is delivering maximum value. What can I help you with today?`;
  const [chatMessages, setChatMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(`zainab_chat_${user.clientId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [{ role: 'ai', content: ZAINAB_WELCOME }];
  });
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [referralData, setReferralData] = useState({ referral_code: null, referral_link: null, referrals: [], total: 0, converted: 0, rewards_earned: 0 });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  const [aov, setAov] = useState(75);
  const [workflowStepsMap, setWorkflowStepsMap] = useState({});
  const [onboardingSteps, setOnboardingSteps] = useState(null);
  const [daysSinceJoined, setDaysSinceJoined] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cd_dark') === '1');
  const [lang, setLang] = useState(() => localStorage.getItem('cd_lang') || 'en');
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef(null);
  // Fix 4: product tour
  const TOUR_KEY = `tour_done_${user.email}`;
  const [tourStep, setTourStep] = useState(-1); // -1 = not started

  // persist dark mode + lang preferences
  useEffect(() => { localStorage.setItem('cd_dark', darkMode ? '1' : '0'); }, [darkMode]);
  useEffect(() => { localStorage.setItem('cd_lang', lang); }, [lang]);

  // Fix 4: start tour after onboarding completes and walkthrough was shown, if not done yet
  useEffect(() => {
    if (onboardingSteps && Object.values(onboardingSteps).every(Boolean) && localStorage.getItem(TOUR_KEY) !== 'done') {
      setTimeout(() => setTourStep(0), 1200);
    }
  }, [onboardingSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  const skipTour = () => { setTourStep(-1); localStorage.setItem(TOUR_KEY, 'done'); };
  const nextTour = (total) => {
    if (tourStep >= total - 1) { skipTour(); } else { setTourStep(s => s + 1); }
  };

  useEffect(() => { fetchData(); }, [user.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    axios.get(`${API_BASE}/referrals/client-stats?client_id=${user.clientId}`)
      .then(r => setReferralData(r.data))
      .catch(() => {});
  }, [user.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchNotifs = () => {
      axios.get(`${API_BASE}/notifications?client_id=${user.clientId}`)
        .then(r => {
          setNotifications(r.data.notifications || []);
          setUnreadCount(r.data.unread_count || 0);
        })
        .catch(() => {});
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen]);

  const markAllRead = async () => {
    try {
      await axios.post(`${API_BASE}/notifications/read`, { client_id: user.clientId });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    try {
      const toSave = chatMessages.slice(-50);
      localStorage.setItem(`zainab_chat_${user.clientId}`, JSON.stringify(toSave));
    } catch { /* storage quota — ignore */ }
  }, [chatMessages, user.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setAov(aov);
      const completedTotal = allEnrollments.filter(e => e.status === 'completed').length;

      // Fix 9: onboarding progress
      const [shopifyRes, approvedRes, enrolledRes, emailSentRes, clientUserRes] = await Promise.all([
        supabase.from('shopify_connections').select('id', { count: 'exact', head: true }).eq('client_id', user.clientId),
        supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('client_id', user.clientId).eq('status', 'approved'),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', user.clientId),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', user.clientId).eq('channel', 'email').eq('direction', 'outbound'),
        supabase.from('client_users').select('created_at').eq('client_id', user.clientId).maybeSingle(),
      ]);
      const steps = {
        account: true,
        store: (shopifyRes.count || 0) > 0,
        sequences: (approvedRes.count || 0) > 0,
        enrolled: (enrolledRes.count || 0) > 0,
        email: (emailSentRes.count || 0) > 0,
      };
      setOnboardingSteps(steps);
      if (clientUserRes.data?.created_at) {
        const days = Math.floor((Date.now() - new Date(clientUserRes.data.created_at)) / 86400000);
        setDaysSinceJoined(days);
      }

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

  useEffect(() => {
    if (workflows.length === 0) return;
    const wfIds = workflows.map(w => w.id);
    supabase.from('workflow_steps').select('*').in('workflow_id', wfIds).order('step_order')
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(s => {
          if (!map[s.workflow_id]) map[s.workflow_id] = [];
          map[s.workflow_id].push(s);
        });
        setWorkflowStepsMap(map);
      })
      .catch(() => {});
  }, [workflows]); // eslint-disable-line react-hooks/exhaustive-deps

  const channelIcon = (ch) => ({ Email: '✉', SMS: '💬', WhatsApp: '📱', Instagram: '📸', Facebook: '👥' }[ch] || '💌');
  const stepTypeIcon = (t) => ({ email: '✉', sms: '💬', whatsapp: '📱', wait: '⏱', tag: '🏷', pipeline: '🎯', notify: '🔔' }[t] || '·');

  const navItems = [
    { id: 'dashboard', label: t('dashboard', lang), icon: '▦' },
    { id: 'results', label: t('myResults', lang), icon: '📈' },
    { id: 'sequences', label: t('sequences', lang), icon: '⚡' },
    { id: 'activity', label: t('recentActivity', lang), icon: '📊' },
    { id: 'approvals', label: t('myApprovals', lang), icon: '✓' },
    { id: 'messages', label: t('messages', lang), icon: '💬' },
    { id: 'contacts', label: t('contacts', lang), icon: '👥' },
    { id: 'calls', label: t('calls', lang), icon: '📞' },
    { id: 'reports', label: t('reports', lang), icon: '📄' },
    { id: 'invoices', label: t('invoices', lang), icon: '🧾' },
    { id: 'zainab', label: t('zainab', lang), icon: '🤖' },
    { id: 'referrals', label: t('referrals', lang), icon: '🎁' },
    { id: 'help', label: t('help', lang), icon: '❔' },
    { id: 'settings', label: t('settings', lang), icon: '⚙' },
  ];

  const pageTitles = {
    dashboard: 'Dashboard',
    results: 'My Results',
    sequences: 'Active Sequences',
    activity: 'Recent Activity',
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
      case 'activity': return <ClientActivity />;
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
  const ClientHome = () => {
    const onbItems = [
      { key: 'account', label: 'Account created' },
      { key: 'store', label: 'Store connected' },
      { key: 'sequences', label: 'Sequences approved' },
      { key: 'enrolled', label: 'First contact enrolled' },
      { key: 'email', label: 'First email sent' },
    ];
    const onbDone = onboardingSteps ? onbItems.filter(i => onboardingSteps[i.key]).length : 0;
    const onbPct = Math.round((onbDone / onbItems.length) * 100);
    const allDone = onbDone === onbItems.length;

    // 7-day revenue bar chart data (pseudo-daily from monthly)
    const today = new Date();
    const dayLabels = Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-6+i);return d.toLocaleDateString('en-US',{weekday:'short'});});
    const seeds = [0.6,0.9,0.7,1.1,1.0,0.8,1.2];
    const dailyBase = stats.revenueRecovered / 30;
    const barVals = seeds.map(s => Math.max(0, dailyBase * s));
    const barMax = Math.max(...barVals, 1);

    return (
    <div>
      {/* WELCOME BANNER */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #142840 100%)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 20, padding: '24px 28px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top:0, right:0, width:200, height:'100%', background:'radial-gradient(ellipse at top right, rgba(201,168,76,0.1), transparent 65%)', pointerEvents:'none' }} />
        <div style={{ fontSize: 9, color: '#c9a84c', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 6 }}>
          {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#f0f4f8', marginBottom: 6, letterSpacing: '-0.5px' }}>
          Hello, {user.name.split(' ')[0]} 👋
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
          {daysSinceJoined !== null ? `Day ${daysSinceJoined} with Sales Scales — ` : ''}Your AI revenue system has been active and recovering revenue while you focus on your business.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'View Sequences', page: 'sequences', icon: '⚡' },
            { label: 'Review Approvals', page: 'approvals', icon: '✓' },
            { label: 'My Results', page: 'results', icon: '📈' },
            { label: 'Settings', page: 'settings', icon: '⚙' },
          ].map(q => (
            <button key={q.page} onClick={() => setCurrentPage(q.page)}
              style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.08)', color: '#c9a84c', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Inter,sans-serif' }}>
              <span>{q.icon}</span>{q.label}
            </button>
          ))}
          <button onClick={openWalkthrough}
            style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Inter,sans-serif' }}>
            🎓 Welcome Tour
          </button>
        </div>
      </div>

      {/* HERO STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Revenue Recovered', value: `$${stats.revenueRecovered.toLocaleString()}`, sub: 'this month est.', color: '#c9a84c', icon: '💰', trend: '↑' },
          { label: 'Emails Sent', value: stats.emailsSentMonth, sub: 'outbound this month', color: '#3b82f6', icon: '✉', trend: '↑' },
          { label: 'Contacts Enrolled', value: stats.enrollmentsMonth, sub: 'in sequences', color: '#10b981', icon: '👥', trend: '↑' },
          { label: 'Active Sequences', value: stats.activeWorkflows, sub: 'running 24/7', color: '#8b5cf6', icon: '⚡', trend: stats.activeWorkflows > 0 ? '▲' : '—' },
        ].map(card => (
          <div key={card.label} style={{ background: 'rgba(15,31,53,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${card.color}18`, borderTop: `2px solid ${card.color}`, borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 22 }}>{card.icon}</div>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 10 }}>{card.label}</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#f0f4f8', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 8 }}>{card.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: card.color, fontWeight: 700, background: card.color+'15', padding: '2px 8px', borderRadius: 20 }}>{card.trend}</span>
              <span style={{ fontSize: 11, color: '#8896a8' }}>{card.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* REVENUE BAR CHART */}
      <div style={{ background: '#0f1f35', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 16, padding: '22px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 4 }}>Revenue Trend</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f0f4f8' }}>${stats.revenueRecovered.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>↑ estimated this month</div>
          </div>
          <div style={{ fontSize: 10, color: '#4a5568' }}>Last 7 days</div>
        </div>
        <svg viewBox={`0 0 420 80`} width="100%" height={80} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="cdgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {barVals.map((v, i) => {
            const barH = Math.max(4, (v / barMax) * 65);
            const x = i * 60 + 5;
            return (
              <g key={i}>
                <rect x={x} y={75 - barH} width={44} height={barH} rx={5} fill="url(#cdgrad)" />
                <text x={x+22} y={92} textAnchor="middle" fontSize="9" fill="#4a5568">{dayLabels[i]}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ONBOARDING PROGRESS */}
      {onboardingSteps && !allDone && (
        <div style={{ background: '#0f1f35', border: `1px solid rgba(201,168,76,0.2)`, borderRadius: 16, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4f8' }}>Getting started — {onbDone}/{onbItems.length} complete</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#c9a84c' }}>{onbPct}%</div>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ width: `${onbPct}%`, height: '100%', background: 'linear-gradient(90deg, #c9a84c, #a07234)', borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {onbItems.map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: onboardingSteps[item.key] ? '#34d399' : '#4a5568', background: onboardingSteps[item.key] ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${onboardingSteps[item.key] ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, padding: '3px 10px', fontFamily: 'Inter,sans-serif' }}>
                <span>{onboardingSteps[item.key] ? '✓' : '○'}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace' }}>Active Sequences</div>
            <WhatIsThis text="Sequences are automated email, SMS, and WhatsApp campaigns that fire based on customer actions — like abandoning a cart. Each one runs 24/7 and recovers revenue while you sleep." />
          </div>
          {workflows.filter(w => w.status === 'active').length === 0 ? (
            <div style={{ background: '#0f1f35', border: '2px dashed rgba(255,255,255,0.07)', borderRadius: 14, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4f8', marginBottom: 6 }}>No active sequences yet</div>
              <div style={{ fontSize: 12, color: '#4a5568' }}>Your AI team is setting things up</div>
            </div>
          ) : workflows.filter(w => w.status === 'active').map(workflow => {
            const wfStats = enrollmentsByWorkflow[workflow.id] || { total: 0, completed: 0, active: 0 };
            const completionRate = wfStats.total > 0 ? Math.round((wfStats.completed / wfStats.total) * 100) : 0;
            const R = 20, circ = 2*Math.PI*R, offset = circ*(1-completionRate/100);
            const col = completionRate >= 50 ? '#10b981' : '#c9a84c';
            return (
              <div key={workflow.id} style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px', marginBottom: 10, transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4f8', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workflow.name}</div>
                    <div style={{ fontSize: 11, color: '#4a5568' }}>Trigger: {workflow.trigger_type}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 12 }}>
                    {/* Circular progress ring */}
                    <svg width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                      <circle cx="24" cy="24" r={R} fill="none" stroke={col} strokeWidth="3" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 24 24)" strokeLinecap="round" />
                      <text x="24" y="28" textAnchor="middle" fontSize="9" fontWeight="700" fill={col}>{completionRate}%</text>
                    </svg>
                    <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>● Active</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[{ label: 'Enrolled', value: wfStats.total }, { label: 'Active', value: wfStats.active }, { label: 'Completed', value: wfStats.completed }].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#f0f4f8', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: '#4a5568', fontFamily: 'DM Mono,monospace' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 14 }}>Recent Activity</div>
            {messages.slice(0, 5).length === 0 ? (
              <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 30, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📬</div>
                <div style={{ fontSize: 12, color: '#4a5568' }}>No activity yet</div>
              </div>
            ) : messages.slice(0, 5).map(msg => (
              <div key={msg.id} style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', marginBottom: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
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
  };

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

    const totalEnrolled = Object.values(enrollmentsByWorkflow).reduce((s, e) => s + e.total, 0);
    const convRate = totalEnrolled > 0 ? Math.round((stats.completedEnrollments / totalEnrolled) * 100) : 0;
    // Win rate gauge
    const gaugeR = 60, gaugeCirc = Math.PI * gaugeR; // half circle
    const gaugeFill = gaugeCirc * (convRate / 100);

    return (
    <div>
      {/* Fix 4: celebration banner when revenue has been recovered */}
      {stats.revenueRecovered > 0 && (
        <div style={{ background: 'linear-gradient(90deg, rgba(201,168,76,0.12), rgba(201,168,76,0.06))', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 14, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>🏆</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#c9a84c', marginBottom: 2 }}>
              Your AI team has recovered ${stats.revenueRecovered.toLocaleString()} in revenue
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              {stats.completedEnrollments} sequence{stats.completedEnrollments !== 1 ? 's' : ''} completed · keep approving content to maintain momentum
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 4 }}>Performance</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f4f8' }}>My Results</div>
        </div>
        <WhatIsThis text="My Results shows estimated revenue recovered through your sequences, email open rates, click rates, and enrollment counts. Revenue is calculated as completed enrollments × your average order value." />
      </div>

      {/* REVENUE HERO */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #142840 100%)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '28px 32px', marginBottom: 20, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 120%, rgba(201,168,76,0.15), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.7)', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 10 }}>Total Revenue Recovered</div>
        <div style={{ fontSize: 60, fontWeight: 800, color: '#c9a84c', letterSpacing: '-2px', lineHeight: 1, textShadow: '0 0 40px rgba(201,168,76,0.4)', marginBottom: 10 }}>
          ${stats.revenueRecovered.toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{stats.completedEnrollments} sequences completed · estimated from your average order value of ${aov}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Contacts Reached', value: stats.messagesSent, sub: 'messages delivered', color: '#10b981', icon: '📨' },
          { label: 'Active Sequences', value: stats.activeWorkflows, sub: 'running for you', color: '#8b5cf6', icon: '⚡' },
          { label: 'Win Rate', value: `${convRate}%`, sub: `${stats.completedEnrollments} of ${totalEnrolled} completed`, color: '#c9a84c', icon: '🎯' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#0f1f35', border: `1px solid rgba(255,255,255,0.07)`, borderTop: `2px solid ${stat.color}`, borderRadius: 16, padding: '20px 22px' }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>{stat.icon}</div>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#f0f4f8', marginBottom: 4, letterSpacing: '-1px' }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: stat.color, fontWeight: 600 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* WIN RATE GAUGE */}
      <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ flexShrink: 0 }}>
          <svg width="160" height="90" viewBox="0 0 160 90">
            <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
            <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="#c9a84c" strokeWidth="14" strokeLinecap="round"
              strokeDasharray={`${gaugeFill} ${gaugeCirc}`} style={{ transition: 'stroke-dasharray 0.8s' }} />
            <text x="80" y="75" textAnchor="middle" fontSize="22" fontWeight="800" fill="#f0f4f8">{convRate}%</text>
            <text x="80" y="90" textAnchor="middle" fontSize="9" fill="#4a5568">WIN RATE</text>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 8 }}>Sequence Win Rate</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4f8', marginBottom: 4 }}>{stats.completedEnrollments} of {totalEnrolled} contacts converted</div>
          <div style={{ fontSize: 12, color: '#8896a8', lineHeight: 1.6 }}>This is the percentage of contacts who completed a full sequence. Industry average is 15–25%.</div>
        </div>
      </div>

      {/* EMAIL PERFORMANCE */}
      <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '22px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 16 }}>Email Performance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { label: 'Emails Sent', value: emailSent, color: '#f0f4f8', icon: '📤' },
            { label: 'Opened', value: emailOpened, color: '#3b82f6', icon: '👁' },
            { label: 'Open Rate', value: `${openRate}%`, color: '#3b82f6', icon: '📊' },
            { label: 'Clicked', value: emailClicked, color: '#c9a84c', icon: '🔗' },
            { label: 'Click Rate', value: `${clickRate}%`, color: '#10b981', icon: '✓' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#4a5568', fontFamily: 'DM Mono,monospace', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Revenue Attribution by Sequence</div>
            <div style={{ fontSize: '11px', color: '#4a5568' }}>Active sequences only · sorted by estimated revenue recovered</div>
          </div>
          <div style={{ fontSize: '10px', color: '#8896a8', textAlign: 'right' }}>
            AOV: <span style={{ fontWeight: 700, color: '#c9a84c' }}>${aov}</span>
          </div>
        </div>
        {(() => {
          const activeWorkflows = workflows.filter(w => w.status === 'active');
          if (activeWorkflows.length === 0) {
            return <div style={{ textAlign: 'center', padding: '40px', color: '#8896a8', fontSize: '12px' }}>No active sequences yet</div>;
          }
          const withRevenue = activeWorkflows.map(w => {
            const e = enrollmentsByWorkflow[w.id] || { total: 0, completed: 0, active: 0 };
            const revenue = e.completed * aov;
            const completionRate = e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0;
            return { ...w, enrolled: e.total, completed: e.completed, activeCount: e.active, revenue, completionRate };
          }).sort((a, b) => b.revenue - a.revenue || b.enrolled - a.enrolled);
          const topRevenue = withRevenue[0]?.revenue > 0;

          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1.5fr', padding: '10px 14px', background: '#0a1628', borderRadius: '8px 8px 0 0', marginBottom: 0 }}>
                {['Sequence', 'Enrolled', 'Completed', 'Rate', 'Est. Revenue'].map(h => (
                  <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              <div style={{ border: '1px solid #e4e9f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                {withRevenue.map((w, i) => {
                  const isTop = i === 0 && topRevenue;
                  return (
                    <div key={w.id} style={{
                      display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1.5fr',
                      padding: '13px 14px', alignItems: 'center',
                      borderBottom: i < withRevenue.length - 1 ? '1px solid #f4f6fa' : 'none',
                      background: isTop ? 'rgba(201,168,76,0.06)' : 'white',
                      borderLeft: isTop ? '3px solid #c9a84c' : '3px solid transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        {isTop && (
                          <span style={{ fontSize: '10px', background: '#c9a84c', color: '#0a1628', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>TOP</span>
                        )}
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{w.enrolled}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{w.completed}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '28px', height: '4px', background: '#f0f3f8', borderRadius: '2px', overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ width: `${w.completionRate}%`, height: '100%', background: w.completionRate >= 50 ? '#10b981' : '#c9a84c' }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: w.completionRate >= 50 ? '#10b981' : '#c9a84c' }}>{w.completionRate}%</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: isTop ? '#c9a84c' : '#0a1628' }}>
                          {w.revenue > 0 ? `$${w.revenue.toLocaleString()}` : '—'}
                        </div>
                        {w.completed > 0 && (
                          <div style={{ fontSize: '9px', color: '#8896a8', marginTop: '1px' }}>{w.completed} × ${aov}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '10px', fontSize: '10px', color: '#8896a8', lineHeight: 1.6 }}>
                Revenue estimated from completed sequences × your average order value of ${aov}. Actual results may vary.
              </div>
            </div>
          );
        })()}
      </div>
    </div>
    );
  };

  // ─── SEQUENCES ────────────────────────────────────────
  const hasWhatsAppPendingSteps = Object.values(workflowStepsMap).some(steps => steps.some(s => s.step_type === 'whatsapp'));

  const ClientSequences = () => {
    const [enrollModal, setEnrollModal] = useState(null); // { workflow }
    const [enrollContactId, setEnrollContactId] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [enrollMsg, setEnrollMsg] = useState('');

    const openEnrollModal = (workflow) => {
      setEnrollModal(workflow);
      setEnrollContactId(contacts[0]?.id || '');
      setEnrollMsg('');
    };

    const doEnroll = async () => {
      if (!enrollContactId || !enrollModal) return;
      setEnrolling(true);
      setEnrollMsg('');
      try {
        const res = await axios.post(`${API_BASE}/contacts/enroll`, {
          contact_id: enrollContactId,
          workflow_id: enrollModal.id,
          client_id: user.clientId,
        });
        setEnrollMsg(res.data.ok ? '✓ Enrolled successfully' : 'Enrollment failed');
        if (res.data.ok) setTimeout(() => setEnrollModal(null), 1200);
      } catch (e) {
        setEnrollMsg(e.response?.data?.error || 'Enrollment failed');
      }
      setEnrolling(false);
    };

    return (
    <div>
      {enrollModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '380px', boxShadow: '0 20px 60px rgba(10,22,40,0.25)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>Enroll a Contact</div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '16px' }}>Sequence: <strong>{enrollModal.name}</strong></div>
            <div style={{ fontSize: '11px', color: '#4a5568', marginBottom: '6px', fontWeight: 600 }}>Select contact</div>
            <select value={enrollContactId} onChange={e => setEnrollContactId(e.target.value)}
              style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', marginBottom: '16px', outline: 'none' }}>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.email ? `— ${c.email}` : ''}</option>
              ))}
            </select>
            {enrollMsg && <div style={{ fontSize: '11px', color: enrollMsg.startsWith('✓') ? '#059669' : '#dc2626', marginBottom: '12px' }}>{enrollMsg}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={doEnroll} disabled={enrolling || !enrollContactId}
                style={{ flex: 1, background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: enrolling ? 0.6 : 1 }}>
                {enrolling ? 'Enrolling…' : 'Enroll'}
              </button>
              <button onClick={() => setEnrollModal(null)}
                style={{ padding: '10px 16px', background: 'white', border: '1px solid #e4e9f0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#8896a8' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Automation</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Sequences</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>{workflows.filter(w => w.status === 'active').length} running · {workflows.length} total · full step-by-step visibility into what your AI team is sending</div>
        </div>
        <WhatIsThis text="Sequences are automated campaigns written by Mahdi in your brand voice. They fire automatically based on customer actions. Each one must be approved before going live — check My Approvals to review them." dark />
      </div>

      {/* Fix 1: WhatsApp pending banner */}
      {hasWhatsAppPendingSteps && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <i className="ti ti-brand-whatsapp" style={{ color: '#d97706', fontSize: '16px', marginTop: '1px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>WhatsApp steps are pending</div>
            <div style={{ fontSize: '11px', color: '#78350f', lineHeight: '1.6' }}>Some of your sequences include WhatsApp steps that are currently being skipped. WhatsApp requires activation by the Sales Scales team. Email and SMS are fully active.</div>
          </div>
        </div>
      )}

      {workflows.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No sequences yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Your AI team is building your sequences</div>
        </div>
      ) : workflows.map(workflow => {
        const wfStats = enrollmentsByWorkflow[workflow.id] || { total: 0, completed: 0, active: 0 };
        const completionRate = wfStats.total > 0 ? Math.round((wfStats.completed / wfStats.total) * 100) : 0;
        const steps = workflowStepsMap[workflow.id] || [];
        const actionSteps = steps.filter(s => s.step_type !== 'wait').length;
        return (
          <div key={workflow.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>{workflow.name}</div>
                <div style={{ fontSize: '11px', color: '#8896a8' }}>
                  Trigger: {workflow.trigger_type} · {actionSteps} messages · Created {formatDate(workflow.created_at)}
                </div>
              </div>
              <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', fontWeight: 600, background: workflow.status === 'active' ? '#ecfdf5' : '#fffbeb', color: workflow.status === 'active' ? '#059669' : '#d97706', border: `1px solid ${workflow.status === 'active' ? '#a7f3d0' : '#fde68a'}`, flexShrink: 0 }}>
                {workflow.status === 'active' ? '● Active' : '○ Paused'}
              </span>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {[
                { label: 'Contacts Enrolled', value: wfStats.total, color: '#c9a84c' },
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

            {/* Completion bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: steps.length > 0 ? '16px' : 0 }}>
              <div style={{ fontSize: '9px', color: '#8896a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>Completion</div>
              <div style={{ flex: 1, height: '6px', background: '#f0f3f8', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${completionRate}%`, height: '100%', background: `linear-gradient(90deg, ${completionRate >= 50 ? '#10b981' : '#c9a84c'}, ${completionRate >= 50 ? '#059669' : '#a07234'})`, borderRadius: '4px', transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: completionRate >= 50 ? '#10b981' : '#c9a84c', minWidth: '36px' }}>{completionRate}%</div>
            </div>

            {/* Step timeline */}
            {steps.length > 0 && (
              <div style={{ borderTop: '1px solid #f0f3f8', paddingTop: '16px' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Sequence Timeline — {steps.length} steps
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {steps.map((step, idx) => {
                    const isWait = step.step_type === 'wait';
                    const waitLabel = step.wait_hours >= 24
                      ? `${Math.floor(step.wait_hours / 24)}d${step.wait_hours % 24 ? ` ${step.wait_hours % 24}h` : ''} delay`
                      : `${step.wait_hours || 0}h delay`;
                    return (
                      <div key={step.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', paddingBottom: idx < steps.length - 1 ? '8px' : 0 }}>
                        {/* icon + connector */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: isWait ? '#f8fafc' : '#0a1628', border: `1px solid ${isWait ? '#e4e9f0' : '#0a1628'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                            {stepTypeIcon(step.step_type)}
                          </div>
                          {idx < steps.length - 1 && (
                            <div style={{ width: '1px', flex: 1, minHeight: '8px', background: '#e4e9f0', margin: '2px 0' }} />
                          )}
                        </div>
                        {/* content */}
                        <div style={{ paddingBottom: idx < steps.length - 1 ? '6px' : 0, paddingTop: '3px', flex: 1 }}>
                          {isWait ? (
                            <div style={{ fontSize: '11px', color: '#8896a8', fontStyle: 'italic' }}>{waitLabel}</div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: step.subject ? '2px' : 0 }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', textTransform: 'capitalize' }}>{step.step_type}</span>
                                <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#f0f3f8', color: '#8896a8', fontWeight: 600 }}>Step {idx + 1}</span>
                              </div>
                              {step.subject && (
                                <div style={{ fontSize: '11px', color: '#4a5568' }}>{step.subject}</div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fix 7: Enroll Contact button */}
            {workflow.status === 'active' && contacts.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f3f8' }}>
                <button onClick={() => openEnrollModal(workflow)}
                  style={{ fontSize: '11px', padding: '7px 16px', background: 'rgba(201,168,76,0.08)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '7px', cursor: 'pointer', fontWeight: 600 }}>
                  + Enroll Contact
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
    );
  };

  // ─── RECENT ACTIVITY ─────────────────────────────────
  const ClientActivity = () => {
    const contactMap = {};
    contacts.forEach(c => {
      contactMap[c.id] = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '—';
    });

    const outbound = messages
      .filter(m => m.direction === 'outbound')
      .slice(0, 20);

    const getStatus = (msg) => {
      if (msg.clicked_at) return { label: 'Clicked', color: '#c9a84c', border: '#fde68a', bg: '#fffbeb' };
      if (msg.opened_at)  return { label: 'Opened',  color: '#3b82f6', border: '#bfdbfe', bg: '#eff6ff' };
      return { label: 'Sent', color: '#8896a8', border: '#e4e9f0', bg: '#f8fafc' };
    };

    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Outreach Log</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>Recent Activity</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Last 20 messages sent to your contacts by your AI team</div>
        </div>

        {outbound.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No activity yet</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>Activity appears here as your AI team sends messages to contacts</div>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 3fr 0.8fr 0.9fr', padding: '12px 18px', background: '#0a1628' }}>
              {['Contact', 'Channel', 'Message', 'Status', 'Sent'].map(h => (
                <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {outbound.map(msg => {
              const st = getStatus(msg);
              const contactName = contactMap[msg.contact_id] || '—';
              return (
                <div key={msg.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 3fr 0.8fr 0.9fr', padding: '11px 18px', borderBottom: '1px solid #f4f6fa', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#0a1628' }}>{contactName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#4a5568' }}>
                    {channelIcon(msg.channel)} <span style={{ fontSize: '11px' }}>{msg.channel}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#8896a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>
                    {(msg.content || '').slice(0, 90)}
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#8896a8' }}>{formatTime(msg.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ─── MESSAGES ────────────────────────────────────────
  const ClientMessages = () => {
    const [takeoverLoading, setTakeoverLoading] = useState({});
    const [refundLoading, setRefundLoading] = useState({});
    const [refundResult, setRefundResult] = useState({});

    const contactMap = {};
    contacts.forEach(c => { contactMap[c.id] = c; });

    const toggleTakeover = async (contactId, value) => {
      setTakeoverLoading(prev => ({ ...prev, [contactId]: true }));
      try {
        await axios.patch(`${API_BASE}/contacts/${contactId}/takeover`, { human_takeover: value });
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, human_takeover: value } : c));
      } catch (e) {
        console.error('Takeover toggle error:', e.message);
      }
      setTakeoverLoading(prev => ({ ...prev, [contactId]: false }));
    };

    const processRefund = async (msg) => {
      const contact = msg.contact_id ? contactMap[msg.contact_id] : null;
      if (!contact?.email) return;
      setRefundLoading(prev => ({ ...prev, [msg.id]: true }));
      setRefundResult(prev => ({ ...prev, [msg.id]: null }));
      try {
        const res = await axios.post(`${API_BASE}/shopify/refund`, {
          client_id: user.clientId,
          contact_id: contact.id,
          contact_email: contact.email,
        });
        setRefundResult(prev => ({ ...prev, [msg.id]: { ok: true, text: `Refund issued for order #${res.data.order_number} — $${res.data.amount}` } }));
      } catch (e) {
        setRefundResult(prev => ({ ...prev, [msg.id]: { ok: false, text: e.response?.data?.error || 'Refund failed' } }));
      }
      setRefundLoading(prev => ({ ...prev, [msg.id]: false }));
    };

    const hasRefundKeyword = (text) => /refund|return|money back/i.test(text || '');

    // Group messages by contact_id to show per-conversation takeover state
    const seenContacts = new Set();

    return (
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
          {messages.map(msg => {
            const contact = msg.contact_id ? contactMap[msg.contact_id] : null;
            const inTakeover = contact?.human_takeover === true;
            const isFirstForContact = msg.contact_id && !seenContacts.has(msg.contact_id);
            if (msg.contact_id) seenContacts.add(msg.contact_id);
            const showRefund = hasRefundKeyword(msg.content) && contact?.email && msg.channel !== 'Refund';
            return (
              <div key={msg.id} style={{ background: 'white', border: `1px solid ${inTakeover ? '#fde68a' : '#e4e9f0'}`, borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
                {/* Fix 1: takeover banner */}
                {inTakeover && isFirstForContact && (
                  <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#92400e' }}>
                      You are handling this conversation — AI is paused
                    </div>
                    <button
                      disabled={takeoverLoading[msg.contact_id]}
                      onClick={() => toggleTakeover(msg.contact_id, false)}
                      style={{ fontSize: '10px', padding: '4px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                      {takeoverLoading[msg.contact_id] ? '…' : 'Hand Back to AI'}
                    </button>
                  </div>
                )}
                <div style={{ padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: msg.direction === 'outbound' ? '#0a1628' : '#f0f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                    {channelIcon(msg.channel)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>
                        {msg.direction === 'outbound' ? `AI → ${msg.channel}` : msg.sender_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Fix 1: take over button (first message per contact, not already in takeover) */}
                        {isFirstForContact && contact && !inTakeover && (
                          <button
                            disabled={takeoverLoading[msg.contact_id]}
                            onClick={() => toggleTakeover(msg.contact_id, true)}
                            style={{ fontSize: '9px', padding: '3px 10px', background: 'rgba(10,22,40,0.06)', color: '#0a1628', border: '1px solid rgba(10,22,40,0.15)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                            {takeoverLoading[msg.contact_id] ? '…' : 'Take Over'}
                          </button>
                        )}
                        <div style={{ fontSize: '9px', color: '#8896a8' }}>{formatTime(msg.created_at)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', background: msg.direction === 'outbound' ? '#ecfdf5' : '#eff6ff', color: msg.direction === 'outbound' ? '#059669' : '#3b82f6', border: `1px solid ${msg.direction === 'outbound' ? '#a7f3d0' : '#bfdbfe'}`, fontWeight: 600 }}>
                        {msg.direction === 'outbound' ? '↑ Sent' : '↓ Received'}
                      </span>
                      <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', background: '#f8fafc', color: '#8896a8', border: '1px solid #e4e9f0' }}>{msg.channel}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.5' }}>{msg.content}</div>
                    {/* Fix 2: refund button on messages with refund/return keywords */}
                    {showRefund && (
                      <div style={{ marginTop: '8px' }}>
                        {refundResult[msg.id] ? (
                          <div style={{ fontSize: '11px', color: refundResult[msg.id].ok ? '#059669' : '#dc2626', fontWeight: 600 }}>
                            {refundResult[msg.id].text}
                          </div>
                        ) : (
                          <button
                            disabled={refundLoading[msg.id]}
                            onClick={() => processRefund(msg)}
                            style={{ fontSize: '10px', padding: '5px 14px', background: refundLoading[msg.id] ? '#f0f3f8' : '#dc2626', color: refundLoading[msg.id] ? '#8896a8' : 'white', border: 'none', borderRadius: '6px', cursor: refundLoading[msg.id] ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                            {refundLoading[msg.id] ? 'Processing…' : 'Process Refund'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    );
  };

  // ─── CONTACTS ────────────────────────────────────────
  const ClientContacts = () => {
    const [enrollModal, setEnrollModal] = useState(null); // contact object
    const [enrolling, setEnrolling] = useState(false);
    const [enrollMsg, setEnrollMsg] = useState('');
    const [selectedWfId, setSelectedWfId] = useState('');

    const openEnroll = (contact) => {
      setEnrollModal(contact);
      setEnrollMsg('');
      setSelectedWfId(workflows.filter(w => w.status === 'active')[0]?.id || '');
    };

    const doEnroll = async () => {
      if (!selectedWfId) return;
      setEnrolling(true);
      setEnrollMsg('');
      try {
        const res = await axios.post(`${API_BASE}/contacts/enroll`, {
          contact_id: enrollModal.id,
          workflow_id: selectedWfId,
          client_id: user.clientId,
        });
        setEnrollMsg(res.data.ok ? '✓ Enrolled successfully' : 'Enrollment failed');
        if (res.data.ok) setTimeout(() => setEnrollModal(null), 1200);
      } catch (e) {
        setEnrollMsg(e.response?.data?.error || 'Enrollment failed');
      }
      setEnrolling(false);
    };

    return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Database</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Contacts</div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>{contacts.length} customers in your database</div>
      </div>

      {enrollModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(10,22,40,0.25)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Enroll {enrollModal.first_name}</div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '16px' }}>Select a sequence to enroll this contact in</div>
            <select value={selectedWfId} onChange={e => setSelectedWfId(e.target.value)}
              style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', marginBottom: '16px', outline: 'none' }}>
              {workflows.filter(w => w.status === 'active').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {enrollMsg && <div style={{ fontSize: '11px', color: enrollMsg.startsWith('✓') ? '#059669' : '#dc2626', marginBottom: '12px' }}>{enrollMsg}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={doEnroll} disabled={enrolling || !selectedWfId}
                style={{ flex: 1, background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                {enrolling ? 'Enrolling…' : 'Enroll'}
              </button>
              <button onClick={() => setEnrollModal(null)}
                style={{ padding: '10px 16px', background: 'white', border: '1px solid #e4e9f0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#8896a8' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👥</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No contacts yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Contacts will appear when your Shopify store is connected</div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 80px', padding: '12px 18px', background: '#0a1628' }}>
            {['CONTACT', 'EMAIL', 'SOURCE', 'ADDED', ''].map(h => (
              <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700 }}>{h}</div>
            ))}
          </div>
          {contacts.map(contact => (
            <div key={contact.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 80px', padding: '12px 18px', borderBottom: '1px solid #f4f6fa', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>
                  {contact.first_name?.[0]}{contact.last_name?.[0]}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#0a1628' }}>{contact.first_name} {contact.last_name}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#8896a8' }}>{contact.email}</div>
              <div style={{ fontSize: '11px', color: '#4a5568' }}>{contact.source}</div>
              <div style={{ fontSize: '10px', color: '#8896a8' }}>{formatDate(contact.created_at)}</div>
              <div>
                {workflows.some(w => w.status === 'active') && (
                  <button onClick={() => openEnroll(contact)}
                    style={{ fontSize: '10px', padding: '4px 10px', background: 'rgba(201,168,76,0.1)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                    Enroll
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  };

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
        <div style={{ background: '#0f1f35', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, overflow: 'hidden' }}>
          {/* Chat header */}
          <div style={{ background: 'linear-gradient(135deg, #0a1628 0%, #1a0a2e 100%)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(139,92,246,0.2)', border: '2px solid rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#a78bfa' }}>Z</div>
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: '#10b981', border: '2px solid #0a1628', boxShadow: '0 0 5px #10b981' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f0f4f8' }}>Zainab</div>
              <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>AI Client Partner · Sales Scales</div>
            </div>
            <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)', fontWeight: 700, fontFamily: 'DM Mono,monospace' }}>● ONLINE</span>
          </div>

          {/* Chat bubbles */}
          <div style={{ height: '400px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, background: '#050d1a' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                {msg.role === 'ai' && (
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#a78bfa', flexShrink: 0 }}>Z</div>
                )}
                <div style={{ maxWidth: '72%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px', background: msg.role === 'user' ? '#0a1628' : '#0f1f35', color: msg.role === 'user' ? '#f0f4f8' : 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.7, border: msg.role === 'user' ? '1px solid rgba(139,92,246,0.2)' : '1px solid rgba(255,255,255,0.07)' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {generating && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#a78bfa', flexShrink: 0 }}>Z</div>
                <div style={{ padding: '12px 16px', borderRadius: '14px 14px 14px 2px', background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0,1,2].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', opacity: 0.4 + d * 0.2 }} />)}
                </div>
              </div>
            )}
          </div>

          {/* Reply bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px', display: 'flex', gap: 10, background: '#0a1628' }}>
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask Zainab anything about your results…"
              style={{ flex: 1, border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f0f4f8', outline: 'none', background: 'rgba(255,255,255,0.04)', fontFamily: 'Inter, sans-serif' }} />
            <button onClick={sendMessage} disabled={generating || !input.trim()}
              style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: (generating || !input.trim()) ? 0.5 : 1 }}>
              Send →
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
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Pending Review</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Approvals</div>
            <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Review and approve content before it goes live to your customers</div>
          </div>
          <WhatIsThis text="Before any sequence goes live to your customers, it appears here for your review. Read the content, edit if needed, then approve with one click. Rejecting sends it back to the AI with your feedback." dark />
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
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
            {/* LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvals.map(a => {
                const pBorder = a.priority === 'urgent' ? '#ef4444' : a.priority === 'high' ? '#c9a84c' : 'rgba(255,255,255,0.15)';
                return (
                <div key={a.id} onClick={() => { setSelected(a); setFeedback(''); setEditing(false); setEditContent(''); }}
                  style={{ background: selected?.id === a.id ? 'rgba(201,168,76,0.06)' : '#0f1f35', border: `1px solid ${selected?.id === a.id ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.07)'}`, borderLeft: `4px solid ${selected?.id === a.id ? '#c9a84c' : pBorder}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ fontSize: 8, color: '#4a5568', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace' }}>{(a.type || 'content').replace(/_/g, ' ')}</div>
                    {a.priority && a.priority !== 'normal' && <span style={{ fontSize: 8, padding: '1px 7px', borderRadius: 20, background: pBorder+'18', color: pBorder, border: `1px solid ${pBorder}44`, fontWeight: 700 }}>{a.priority}</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4f8', lineHeight: 1.4 }}>{a.title}</div>
                  <div style={{ fontSize: 10, color: '#4a5568', marginTop: 6 }}>{formatDate(a.created_at)}</div>
                </div>
                );
              })}
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
    const [expandedScript, setExpandedScript] = useState({});
    const [expandedTranscript, setExpandedTranscript] = useState({});

    const fmtDur = (s) => {
      if (!s && s !== 0) return '—';
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };

    const toggleSection = (id, setter) => setter(prev => ({ ...prev, [id]: !prev[id] }));

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

    const OBJECTION_LABELS = {
      too_expensive: 'Too Expensive',
      need_to_think: 'Need to Think About It',
      quality_concerns: 'Not Sure About Quality',
      shipping_concerns: 'Shipping Concerns',
      wrong_time: 'Wrong Time',
    };

    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Voice Calls</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Calls</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Ali-briefed call scripts, objection handlers, and transcripts</div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {calls.map(c => {
              const objections = typeof c.objection_handlers === 'object' && !Array.isArray(c.objection_handlers) ? c.objection_handlers : {};
              const hasScript = !!c.call_script;
              const hasObjHandlers = Object.keys(objections).length > 0;
              const hasFollowUp = !!c.follow_up_action;
              const scriptOpen = expandedScript[c.id];
              const transcriptOpen = expandedTranscript[c.id];

              return (
                <div key={c.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(10,22,40,0.06)' }}>
                  {/* Call header */}
                  <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f3f8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, background: c.direction === 'inbound' ? '#eff6ff' : '#fef9ec', color: c.direction === 'inbound' ? '#3b82f6' : '#c9a84c', border: `1px solid ${c.direction === 'inbound' ? '#bfdbfe' : '#f0e0b0'}` }}>
                        {c.direction === 'inbound' ? '↓ INBOUND' : '↑ OUTBOUND'}
                      </span>
                      {hasScript && (
                        <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '20px', fontWeight: 700, background: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>⚡ Ali Briefed</span>
                      )}
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628' }}>{c.contact_phone || 'Unknown'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#8896a8' }}>{fmtDur(c.duration_seconds)}</div>
                      <div style={{ fontSize: '11px', color: '#8896a8' }}>{formatDate(c.created_at)}</div>
                    </div>
                  </div>

                  {/* Summary */}
                  {c.summary && (
                    <div style={{ padding: '14px 20px 0', fontSize: '13px', color: '#0a1628', lineHeight: 1.7, fontWeight: 500 }}>{c.summary}</div>
                  )}

                  {/* Follow-up action (post-call Ali recommendation) */}
                  {hasFollowUp && (
                    <div style={{ margin: '12px 20px 0', background: '#fef9ec', border: '1px solid #f0e0b0', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Ali's Follow-Up Recommendation</div>
                      <div style={{ fontSize: '12px', color: '#0a1628', fontWeight: 600 }}>{c.follow_up_action}</div>
                    </div>
                  )}

                  {/* Ali's Call Brief (collapsible) */}
                  {(hasScript || hasObjHandlers) && (
                    <div style={{ margin: '12px 20px 0' }}>
                      <button
                        onClick={() => toggleSection(c.id, setExpandedScript)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '7px 12px', fontSize: '11px', fontWeight: 700, color: '#3b82f6', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                        <span>📋</span>
                        {scriptOpen ? 'Hide' : 'Show'} Ali's Call Brief & Objection Handlers
                        <span style={{ marginLeft: 'auto', fontSize: '12px' }}>{scriptOpen ? '▲' : '▼'}</span>
                      </button>

                      {scriptOpen && (
                        <div style={{ marginTop: '10px', background: '#0a1628', borderRadius: '10px', padding: '18px 20px', color: '#f0f4f8' }}>
                          <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Ali — NEPQ Call Brief</div>

                          {/* Render structured script sections */}
                          {(() => {
                            // Try to extract structured sections from call_script text
                            const scriptText = c.call_script || '';
                            const sections = [
                              { key: 'OPENING', label: 'Opening' },
                              { key: 'SITUATION QUESTIONS', label: 'Situation Questions' },
                              { key: 'PROBLEM AWARENESS', label: 'Problem Awareness' },
                              { key: 'CONSEQUENCE QUESTIONS', label: 'Consequence Questions' },
                              { key: 'CLOSE', label: 'Close' },
                            ];
                            const parsed = {};
                            sections.forEach((s, i) => {
                              const marker = `── ${s.key} ──`;
                              const nextMarker = i < sections.length - 1 ? `── ${sections[i + 1].key} ──` : '── OBJECTION HANDLERS ──';
                              const start = scriptText.indexOf(marker);
                              const end = scriptText.indexOf(nextMarker);
                              if (start !== -1) {
                                parsed[s.key] = scriptText.slice(start + marker.length, end !== -1 ? end : undefined).trim();
                              }
                            });

                            const hasStructured = Object.keys(parsed).length > 0;
                            if (!hasStructured) return (
                              <pre style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{scriptText}</pre>
                            );
                            return sections.map(s => parsed[s.key] ? (
                              <div key={s.key} style={{ marginBottom: '14px' }}>
                                <div style={{ fontSize: '8px', color: '#c9a84c', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{s.label}</div>
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{parsed[s.key]}</div>
                              </div>
                            ) : null);
                          })()}

                          {/* Objection handlers grid */}
                          {hasObjHandlers && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', marginTop: '4px' }}>
                              <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Objection Handlers</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {Object.entries(objections).map(([key, response]) => (
                                  <div key={key} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '10px 12px' }}>
                                    <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
                                      {OBJECTION_LABELS[key] || key.replace(/_/g, ' ')}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}>{response}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Transcript (collapsible) */}
                  <div style={{ margin: '12px 20px 16px' }}>
                    <button
                      onClick={() => toggleSection(c.id, setExpandedTranscript)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '7px 12px', fontSize: '11px', fontWeight: 700, color: '#8896a8', cursor: 'pointer', fontFamily: 'Inter,sans-serif', width: '100%' }}>
                      <span>📝</span>
                      {transcriptOpen ? 'Hide' : 'Show'} Transcript
                      <span style={{ marginLeft: 'auto', fontSize: '12px' }}>{transcriptOpen ? '▲' : '▼'}</span>
                    </button>
                    {transcriptOpen && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#4a5568', lineHeight: 1.8, whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: '8px', padding: '14px 16px', maxHeight: '320px', overflowY: 'auto' }}>
                        {c.transcript || 'No transcript available for this call.'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Monthly Performance</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>My Reports</div>
            <div style={{ fontSize: '12px', color: '#8896a8', marginTop: '4px' }}>Your monthly performance reports, written by Zainab</div>
          </div>
          <WhatIsThis text="Zainab generates a full monthly report each month covering emails sent, SMS sent, contacts added, which sequences performed best, and personalised recommendations for next month." dark />
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
    const [billing, setBilling] = useState(null);
    const [billingLoading, setBillingLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(null);
    const [upgradeMsg, setUpgradeMsg] = useState('');

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

    useEffect(() => {
      axios.get(`${API_BASE}/billing/status?client_id=${user.clientId}`)
        .then(r => setBilling(r.data))
        .catch(() => setBilling(null))
        .finally(() => setBillingLoading(false));
    }, [user.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubscribe = async (plan) => {
      setSubscribing(plan);
      setUpgradeMsg('');
      try {
        const email = user.email;
        const res = await axios.post(`${API_BASE}/billing/create-subscription`, {
          client_id: user.clientId,
          plan,
          email,
        });
        if (res.data.approval_url) {
          window.open(res.data.approval_url, '_blank');
          const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
          setUpgradeMsg(`✓ ${planLabel} subscription page opened — complete authorization in the PayPal window to activate.`);
        }
      } catch (e) {
        setUpgradeMsg('');
        alert(e.response?.data?.error || 'Could not start subscription. Please try again.');
      } finally {
        setSubscribing(null);
      }
    };

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
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 4 }}>Account</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f4f8' }}>Settings</div>
      </div>

      {/* INTEGRATIONS */}
      <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '22px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Integrations</div>
          <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(201,168,76,0.1)', color: '#c9a84c', fontWeight: 600 }}>Managed for you</span>
        </div>
        <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '18px', lineHeight: 1.6 }}>
          Your messaging channels are set up and managed by the Sales Scales team on your behalf. Add your WhatsApp Business number below and we'll handle the rest.
        </div>

        {/* Fix 8: WhatsApp pending approval warning */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '3px' }}>WhatsApp sequences pending Meta approval</div>
            <div style={{ fontSize: '11px', color: '#b45309', lineHeight: 1.6 }}>
              WhatsApp is included in your plan but requires Meta Business verification before it can send messages. Your sequences will skip WhatsApp steps until approval is complete. Email and SMS are fully active.
            </div>
          </div>
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

        {(() => {
          const TIER_ORDER = ['starter', 'growth', 'elite'];
          const TIER_PRICES = { starter: '$997', growth: '$1,997', elite: '$2,997' };
          const TIER_FEATURES = {
            starter: ['Email + SMS automation', 'Full AI team (6 members)', 'CRM & contacts', 'Up to 3 sequences'],
            growth:  ['Everything in Starter', 'WhatsApp automation', 'Unlimited sequences', 'Klaviyo + Meta Ads + HubSpot'],
            elite:   ['Everything in Growth', 'Voice AI agents', 'Shopify live data', 'Canva & Higgsfield AI briefs'],
          };
          const currentTier = (user.tier || 'starter').toLowerCase();
          const currentIdx = TIER_ORDER.indexOf(currentTier);
          const upgradablePlans = TIER_ORDER.slice(currentIdx + 1);

          return (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Your Plan</div>
              <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '10px', padding: '16px 18px', marginBottom: '14px', border: '1px solid rgba(201,168,76,0.2)' }}>
                <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{currentTier} Plan · Active</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{TIER_PRICES[currentTier] || '$997'}<span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mo</span></div>
                <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {(TIER_FEATURES[currentTier] || []).map(f => (
                    <li key={f} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ color: '#c9a84c' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {upgradeMsg && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: '#059669', lineHeight: 1.5 }}>
                  {upgradeMsg}
                </div>
              )}

              {upgradablePlans.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Available Upgrades</div>
                  {upgradablePlans.map(planKey => (
                    <div key={planKey} style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0a1628', marginBottom: '3px' }}>
                          {planKey.charAt(0).toUpperCase() + planKey.slice(1)} — {TIER_PRICES[planKey]}/mo
                        </div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {(TIER_FEATURES[planKey] || []).map(f => (
                            <li key={f} style={{ fontSize: '10px', color: '#8896a8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: '#10b981' }}>✓</span> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={() => handleSubscribe(planKey)}
                        disabled={subscribing === planKey}
                        style={{ background: subscribing === planKey ? '#e4e9f0' : '#0a1628', color: subscribing === planKey ? '#8896a8' : '#c9a84c', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '11px', fontWeight: 700, cursor: subscribing === planKey ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'DM Sans, sans-serif' }}>
                        {subscribing === planKey ? 'Opening...' : 'Upgrade →'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#059669', fontWeight: 500 }}>
                  🏆 You're on our highest plan — Elite
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* BILLING */}
      <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', marginTop: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Billing & Subscription</div>
          {billing?.has_subscription && billing?.paypal_status && (
            <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600,
              background: billing.paypal_status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
              color: billing.paypal_status === 'ACTIVE' ? '#059669' : '#dc2626',
              border: `1px solid ${billing.paypal_status === 'ACTIVE' ? '#a7f3d0' : '#fecaca'}` }}>
              ● {billing.paypal_status === 'ACTIVE' ? 'Active' : billing.paypal_status}
            </span>
          )}
        </div>

        {billingLoading ? (
          <div style={{ fontSize: '12px', color: '#8896a8', padding: '12px 0' }}>Loading billing status...</div>
        ) : billing?.has_subscription ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              {[
                { label: 'Plan', value: billing.tier || '—' },
                { label: 'Status', value: billing.paypal_status || '—' },
                { label: 'Next Billing', value: billing.next_billing_date ? new Date(billing.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
                { label: 'Last Payment', value: billing.last_payment?.time ? new Date(billing.last_payment.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '9px', color: '#8896a8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: 1.6 }}>
              Subscription ID: <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px' }}>{billing.subscription_id}</span>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px', lineHeight: 1.6 }}>
              No active subscription. Subscribe via PayPal to enable automated recurring billing.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'starter', label: 'Starter', price: '$997/mo', desc: 'Email, SMS, workflows, AI team, CRM' },
                { key: 'growth',  label: 'Growth',  price: '$1,997/mo', desc: 'Everything in Starter + WhatsApp, Klaviyo, Meta Ads, HubSpot' },
                { key: 'elite',   label: 'Elite',   price: '$2,997/mo', desc: 'Everything in Growth + voice agents, Shopify live data, Canva & Higgsfield AI' },
              ].map(plan => (
                <div key={plan.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0a1628', marginBottom: '2px' }}>{plan.label} — {plan.price}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>{plan.desc}</div>
                  </div>
                  <button
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={subscribing === plan.key}
                    style={{ background: subscribing === plan.key ? '#e4e9f0' : '#0a1628', color: subscribing === plan.key ? '#8896a8' : '#c9a84c', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '11px', fontWeight: 700, cursor: subscribing === plan.key ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {subscribing === plan.key ? 'Opening...' : 'Subscribe'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
            {KB_FIELDS.map(f => {
              const len = (profile[f.key] || '').length;
              const isWarn = len >= 2000 && len < 3000;
              const isError = len >= 3000;
              return (
                <div key={f.key} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</label>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: isError ? '#dc2626' : isWarn ? '#d97706' : '#8896a8' }}>
                      {len.toLocaleString()} / 3,000
                    </span>
                  </div>
                  <textarea
                    value={profile[f.key]}
                    onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value.slice(0, 3000) }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', minHeight: '72px', border: `1.5px solid ${isError ? '#dc2626' : isWarn ? '#d97706' : '#e4e9f0'}`, borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: '#0a1628', fontFamily: 'DM Sans, sans-serif', resize: 'vertical', boxSizing: 'border-box', background: '#fafbfc', outline: 'none' }} />
                  {isWarn && !isError && <div style={{ fontSize: '10px', color: '#d97706', marginTop: '4px' }}>⚠ Approaching limit — keep under 3,000 characters for best AI results.</div>}
                  {isError && <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '4px' }}>✕ Maximum 3,000 characters — text has been trimmed.</div>}
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button onClick={saveProfile} disabled={savingP}
                style={{ background: savingP ? '#e4e9f0' : '#c9a84c', color: savingP ? '#8896a8' : '#0a1628', border: 'none', borderRadius: '10px', padding: '11px 28px', fontSize: '13px', fontWeight: 700, cursor: savingP ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                {savingP ? 'Saving...' : 'Save Knowledge Base'}
              </button>
              {savedP && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>✓ Saved — your AI team is now using this</span>}
            </div>
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f3f8' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Data Portability (GDPR)</div>
              <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '12px', lineHeight: 1.6 }}>Download a copy of all your data stored on Sales Scales including contacts, messages, reports, and enrollments.</div>
              <button onClick={async () => {
                try {
                  const res = await axios.get(`${API_BASE}/client/export-data`, { params: { client_id: user.clientId } });
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `salesscales-data-${user.clientId}.json`; a.click();
                  URL.revokeObjectURL(url);
                } catch (e) { alert('Export failed: ' + (e.response?.data?.error || e.message)); }
              }} style={{ background: 'white', color: '#0a1628', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '10px 22px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                ↓ Download My Data
              </button>
            </div>

            {/* Fix 3: Download Contract */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f3f8' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Service Agreement</div>
              <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '12px', lineHeight: 1.6 }}>Download your formal service agreement as a print-ready document. Open it in your browser and use File → Print → Save as PDF.</div>
              <a
                href={`${API_BASE}/contracts/generate?client_id=${user.clientId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', background: '#0a1628', color: '#c9a84c', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none' }}>
                ↓ Download Contract
              </a>
            </div>
          </>
        )}
      </div>
    </div>
    );
  };

  const dm = (light, dark) => darkMode ? dark : light;
  const rtl = lang === 'ar';

  const C = { bg: '#050d1a', card: '#0f1f35', border: 'rgba(255,255,255,0.06)', text: '#f0f4f8', muted: '#8896a8', gold: '#c9a84c', sidebar: '#0a1628' };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, DM Sans, sans-serif', background: C.bg, direction: rtl ? 'rtl' : 'ltr' }}>
      {/* SIDEBAR */}
      <div style={{ width: '220px', background: C.sidebar, display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: 'auto' }}>
        {/* LOGO */}
        <div style={{ padding: '22px 18px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '4px', color: '#ffffff', marginBottom: '3px', fontFamily: 'DM Mono, monospace' }}>SALES SCALES</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginBottom: '10px', fontFamily: 'DM Mono, monospace' }}>AI REVENUE SYSTEM</div>
          <div style={{ height: '1px', width: '32px', background: 'linear-gradient(90deg, #c9a84c, transparent)', borderRadius: '1px' }} />
        </div>

        {/* STORE INFO */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#c9a84c', flexShrink: 0 }}>
              {(user.clientName || '?')[0]}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{user.clientName}</div>
              <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 600, marginTop: 1 }}>{user.tier?.charAt(0).toUpperCase() + user.tier?.slice(1)} Plan</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#10b981', fontWeight: 700 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 4px #10b981' }} />
            Revenue system active
          </div>
        </div>

        {/* NAV */}
        <div style={{ padding: '10px 8px', flex: 1 }}>
          {navItems.map(item => (
            <div key={item.id} onClick={() => setCurrentPage(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', fontSize: '12px', color: currentPage === item.id ? '#c9a84c' : 'rgba(255,255,255,0.45)', cursor: 'pointer', borderLeft: `3px solid ${currentPage === item.id ? '#c9a84c' : 'transparent'}`, borderRadius: '0 8px 8px 0', background: currentPage === item.id ? 'rgba(201,168,76,0.1)' : 'transparent', fontWeight: currentPage === item.id ? 700 : 400, transition: 'all 0.15s', marginBottom: 2, fontFamily: 'Inter, sans-serif' }}>
              <span style={{ fontSize: '14px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginBottom: '2px', fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginBottom: '10px' }}>{user.email}</div>
          <button onClick={onLogout} style={{ width: '100%', padding: '7px', fontSize: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
        {/* TOPBAR */}
        <div style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>{pageTitles[currentPage]}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* Fix 9: Dark mode toggle */}
            <button onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Light mode' : 'Dark mode'}
              style={{ background: dm('transparent', 'rgba(255,255,255,0.06)'), border: `1px solid ${dm('#e4e9f0', 'rgba(255,255,255,0.12)')}`, borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <i className={`ti ${darkMode ? 'ti-sun' : 'ti-moon'}`} style={{ fontSize: '14px', color: dm('#4a5568', 'rgba(255,255,255,0.6)') }} />
            </button>

            {/* Fix 8: Language toggle */}
            <button onClick={() => setLang(l => l === 'en' ? 'ar' : 'en')}
              style={{ background: dm('transparent', 'rgba(255,255,255,0.06)'), border: `1px solid ${dm('#e4e9f0', 'rgba(255,255,255,0.12)')}`, borderRadius: '8px', padding: '5px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', color: dm('#4a5568', 'rgba(255,255,255,0.6)'), letterSpacing: '0.5px', fontFamily: 'DM Sans, sans-serif' }}>
              {lang === 'en' ? 'العربية' : 'English'}
            </button>

            {/* Fix 6: Help button */}
            <div ref={helpRef} style={{ position: 'relative' }}>
              <button onClick={() => setHelpOpen(o => !o)} title="Help Center"
                style={{ background: dm('transparent', 'rgba(255,255,255,0.06)'), border: `1px solid ${dm('#e4e9f0', 'rgba(255,255,255,0.12)')}`, borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <i className="ti ti-help-circle" style={{ fontSize: '15px', color: dm('#4a5568', 'rgba(255,255,255,0.6)') }} />
              </button>
            </div>


            {/* NOTIFICATION BELL */}
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setBellOpen(o => !o)}
                style={{ position: 'relative', background: 'transparent', border: '1px solid #e4e9f0', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c9a84c'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e9f0'; }}>
                <i className="ti ti-bell" style={{ fontSize: '15px', color: '#4a5568' }} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '16px', height: '16px', borderRadius: '8px', background: '#dc2626', color: 'white', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1, pointerEvents: 'none' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (() => {
                const typeIcon = (t) => ({ approval: '✓', sequence: '⚡', report: '📄', deal: '🤝', refund: '↩', info: 'ℹ' }[t] || 'ℹ');
                const timeAgo = (d) => {
                  const diff = Date.now() - new Date(d).getTime();
                  const m = Math.floor(diff / 60000);
                  if (m < 1) return 'just now';
                  if (m < 60) return `${m}m ago`;
                  const h = Math.floor(m / 60);
                  if (h < 24) return `${h}h ago`;
                  return `${Math.floor(h / 24)}d ago`;
                };
                const typeDot = (t) => ({ approval: '#10b981', sequence: '#c9a84c', report: '#3b82f6', deal: '#8b5cf6', refund: '#dc2626', info: '#8896a8' }[t] || '#8896a8');
                return (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '340px', background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', boxShadow: '0 8px 32px rgba(10,22,40,0.14)', zIndex: 1000, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #e4e9f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0a1628' }}>
                        Notifications {unreadCount > 0 && <span style={{ fontSize: '10px', background: '#fee2e2', color: '#dc2626', borderRadius: '10px', padding: '1px 7px', marginLeft: '6px', fontWeight: 600 }}>{unreadCount} new</span>}
                      </div>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} style={{ fontSize: '11px', color: '#c9a84c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔔</div>
                          No notifications yet
                        </div>
                      ) : notifications.map(n => (
                        <div key={n.id} style={{ display: 'flex', gap: '10px', padding: '11px 14px', borderBottom: '1px solid #f4f6fa', background: n.read ? 'white' : '#fefef4', alignItems: 'flex-start', transition: 'background 0.15s' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${typeDot(n.type)}18`, border: `1px solid ${typeDot(n.type)}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                            {typeIcon(n.type)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: n.read ? 500 : 700, color: '#0a1628', marginBottom: '2px', lineHeight: 1.3 }}>{n.title}</div>
                            <div style={{ fontSize: '11px', color: '#4a5568', lineHeight: 1.5, marginBottom: '3px' }}>{n.message}</div>
                            <div style={{ fontSize: '9px', color: '#8896a8', fontWeight: 500 }}>{timeAgo(n.created_at)}</div>
                          </div>
                          {!n.read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', flexShrink: 0, marginTop: '5px' }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

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
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', background: C.bg }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#8896a8' }}>Loading your dashboard...</div>
          ) : renderPage()}
        </div>
      </div>

      {/* Fix 6: HELP CENTER SLIDE-IN PANEL */}
      {helpOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setHelpOpen(false)}>
          <div style={{ width: '380px', height: '100vh', background: dm('white', '#0d1a2d'), boxShadow: '-8px 0 40px rgba(10,22,40,0.2)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#0a1628', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ color: '#c9a84c', fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '3px' }}>Help Center</div>
                <div style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>How can we help?</div>
              </div>
              <button onClick={() => setHelpOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', flex: 1 }}>
              {[
                { icon: '🚀', title: 'Getting Started', body: 'Connect your Shopify store, complete the onboarding questionnaire, and approve your first sequences. Your AI team starts working immediately after store connection.' },
                { icon: '⚡', title: 'How Sequences Work', body: 'Sequences are automated email, SMS, and WhatsApp campaigns that fire based on customer actions — like abandoning a cart or placing an order. Each sequence is written by Mahdi in your brand voice and goes live after your approval.' },
                { icon: '📊', title: 'Reading Your Reports', body: 'Check My Results for email open rates, click rates, and estimated revenue recovered. Revenue is estimated as completed sequence enrollments × your average order value. Actual results vary.' },
              ].map(item => (
                <div key={item.title} style={{ background: dm('#f8fafc', 'rgba(255,255,255,0.04)'), border: `1px solid ${dm('#e4e9f0', 'rgba(255,255,255,0.08)')}`, borderRadius: '10px', padding: '16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: dm('#0a1628', 'rgba(255,255,255,0.9)'), marginBottom: '5px' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: dm('#4a5568', 'rgba(255,255,255,0.5)'), lineHeight: 1.7 }}>{item.body}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', margin: '16px 0 10px' }}>FAQ</div>
              {[
                ['Why haven\'t I seen any revenue yet?', 'Revenue recovery requires your Shopify store to be connected and your sequences to be approved and active. Check the Sequences page to confirm they\'re running.'],
                ['Can I edit the sequences?', 'Yes — go to My Approvals to review each sequence before it goes live, and request changes in the feedback box.'],
                ['How often are sequences sent?', 'Sequences fire based on customer behaviour, not a fixed schedule. Cart recovery emails fire 1 hour after abandonment by default.'],
                ['Who writes the emails?', 'Mahdi, your AI Marketing & Content specialist, writes every email in your brand voice based on your onboarding questionnaire.'],
                ['What\'s the best way to get support?', 'Reply to any email from the team, or use the Contact Support button below — Zainab monitors the inbox and replies within a few hours.'],
              ].map(([q, a], i) => (
                <div key={i} style={{ borderBottom: `1px solid ${dm('#f0f3f8', 'rgba(255,255,255,0.06)')}`, paddingBottom: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: dm('#0a1628', 'rgba(255,255,255,0.85)'), marginBottom: '5px' }}>{q}</div>
                  <div style={{ fontSize: '11px', color: dm('#4a5568', 'rgba(255,255,255,0.5)'), lineHeight: 1.7 }}>{a}</div>
                </div>
              ))}
              <a href="mailto:yousef@aisalesscales.com" style={{ display: 'block', background: '#c9a84c', color: '#0a1628', borderRadius: '10px', padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 700, textDecoration: 'none', marginTop: '8px' }}>
                Contact Support →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Fix 4: PRODUCT TOUR TOOLTIPS */}
      {tourStep >= 0 && (() => {
        const TOUR = [
          { title: 'Dashboard Overview', body: 'This is your Revenue Dashboard. Watch your recovered revenue, active sequences, emails sent, and customer replies — all in one place.', nav: 'dashboard' },
          { title: 'My Sequences', body: 'Your AI-powered email and SMS sequences run here. Each one fires automatically based on customer behaviour — like abandoning a cart or placing an order.', nav: 'sequences' },
          { title: 'My Approvals', body: 'Before sequences go live, they appear here for your review. Read through the content, request changes, or approve and activate with one click.', nav: 'approvals' },
          { title: 'Zainab AI', body: 'Zainab is your dedicated AI Client Partner. Ask her anything about your results, sequences, or next steps — she has full context on your store.', nav: 'zainab' },
          { title: 'Settings', body: 'Update your store details, brand voice, and contact preferences here. The more Mahdi knows about your brand, the better your sequences will perform.', nav: 'settings' },
        ];
        const step = TOUR[tourStep];
        const isLast = tourStep === TOUR.length - 1;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none' }}>
            {/* backdrop */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,0.6)', pointerEvents: 'auto' }} onClick={skipTour} />
            {/* tooltip card - centred */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '380px', background: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 60px rgba(10,22,40,0.3)', pointerEvents: 'auto' }}>
              <div style={{ background: '#0a1628', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>Tour — step {tourStep + 1} of {TOUR.length}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{step.title}</div>
                </div>
                <button onClick={skipTour} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ height: '3px', background: '#f0f3f8' }}>
                <div style={{ height: '100%', background: '#c9a84c', borderRadius: '2px', transition: 'width 0.4s', width: `${((tourStep + 1) / TOUR.length) * 100}%` }} />
              </div>
              <div style={{ padding: '20px 22px' }}>
                <p style={{ fontSize: '13px', color: '#4a5568', lineHeight: 1.8, margin: '0 0 20px' }}>{step.body}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setCurrentPage(step.nav); nextTour(TOUR.length); }}
                    style={{ flex: 1, background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '9px', padding: '11px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    {isLast ? 'Finish Tour ✓' : 'Next →'}
                  </button>
                  <button onClick={skipTour}
                    style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '9px', padding: '11px 16px', fontSize: '11px', cursor: 'pointer' }}>
                    Skip Tour
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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