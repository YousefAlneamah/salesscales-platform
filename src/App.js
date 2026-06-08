import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import "./styles/global.css";
import { supabase } from "./supabase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Contacts from "./pages/Contacts";
import AuditTool from "./pages/AuditTool";
import Analytics from "./pages/Analytics";
import Approvals from "./pages/Approvals";
import AIEngine from "./pages/AIEngine";
import Sequences from "./pages/Sequences";
import Pipeline from "./pages/Pipeline";
import Inbox from "./pages/Inbox";
import KnowledgeBase from "./pages/KnowledgeBase";
import Shopify from "./pages/Shopify";
import ShopifyWebhooks from "./pages/ShopifyWebhooks";
import SocialMedia from "./pages/SocialMedia";
import VoiceAgents from "./pages/VoiceAgents";
import Integrations from "./pages/Integrations";
import ShopifyData from "./pages/ShopifyData";
import KlaviyoStats from "./pages/KlaviyoStats";
import MetaAds from "./pages/MetaAds";
import CanvaDesign from "./pages/CanvaDesign";
import HiggsField from "./pages/HiggsField";
import Billing from "./pages/Billing";
import AutoReports from "./pages/AutoReports";
import HubSpot from "./pages/HubSpot";
import Contracts from "./pages/Contracts";
import Transcribe from "./pages/Transcribe";
import MyPipeline from "./pages/MyPipeline";
import SocialAutomation from "./pages/SocialAutomation";
import Reports from "./pages/Reports";
import RevenueDashboard from "./pages/RevenueDashboard";
import CaseStudies from "./pages/CaseStudies";
import CompetitiveIntelligence from "./pages/CompetitiveIntelligence";
import Onboarding from "./pages/Onboarding";
import Marketplace from "./pages/Marketplace";
import WhiteLabel from "./pages/WhiteLabel";
import Settings from "./pages/Settings";
import Referrals from "./pages/Referrals";
import Retention from "./pages/Retention";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Calls from "./pages/Calls";
import ClientDashboard from "./pages/ClientDashboard";
import ClientOnboardingFlow from "./pages/ClientOnboardingFlow";
import ClientSignup from "./pages/ClientSignup";
import Hussain from "./pages/Hussain";
import Hassan from "./pages/Hassan";
import Ali from "./pages/Ali";
import Mahdi from "./pages/Mahdi";
import Fatima from "./pages/Fatima";
import Zainab from "./pages/Zainab";
import TeamBriefings from "./pages/TeamBriefings";
import Tasks from "./pages/Tasks";
import PlatformSettings from "./pages/PlatformSettings";
import TeamPerformance from "./pages/TeamPerformance";
import LandingPage from "./pages/LandingPage";
import SequenceTemplates from "./pages/SequenceTemplates";
import SequenceAnalytics from "./pages/SequenceAnalytics";
import Changelog from "./pages/Changelog";
import ApiDocs from "./pages/ApiDocs";
import PlatformHealth from "./pages/PlatformHealth";
import SuccessScores from "./pages/SuccessScores";
import PublicRoadmap from "./pages/PublicRoadmap";
import ZidniWaitlist from "./pages/ZidniWaitlist";
import ZidniSignup from "./pages/ZidniSignup";

const navItems = [
  { group: "MAIN", items: [
    { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
    { id: "clients", label: "Clients", icon: "ti-users" },
    { id: "tasks", label: "Tasks", icon: "ti-checkbox" },
    { id: "contacts", label: "Contacts", icon: "ti-user" },
    { id: "analytics", label: "Analytics", icon: "ti-chart-bar" },
    { id: "retention", label: "Retention", icon: "ti-heart-rate-monitor" },
  ]},
  { group: "AI TEAM", items: [
    { id: "hussain", label: "Hussain AI", icon: "ti-brain" },
    { id: "hassan", label: "Hassan AI", icon: "ti-speakerphone" },
    { id: "ali", label: "Ali AI", icon: "ti-phone" },
    { id: "mahdi", label: "Mahdi AI", icon: "ti-pencil" },
    { id: "fatima", label: "Fatima AI", icon: "ti-settings" },
    { id: "zainab", label: "Zainab AI", icon: "ti-robot" },
    { id: "briefings", label: "Team Briefings", icon: "ti-mail-forward" },
    { id: "team-performance", label: "Team Performance", icon: "ti-chart-dots" },
  ]},
  { group: "CLIENT MGMT", items: [
    { id: "approvals", label: "Approvals", icon: "ti-bell" },
    { id: "sequences", label: "Sequences", icon: "ti-bolt" },
    { id: "pipeline", label: "Pipeline", icon: "ti-target" },
    { id: "inbox", label: "Inbox", icon: "ti-message" },
    { id: "knowledge", label: "Knowledge Base", icon: "ti-brain" },
  ]},
  { group: "INTEGRATIONS", items: [
    { id: "shopify", label: "Shopify", icon: "ti-shopping-cart" },
    { id: "shopify-data", label: "Store Data", icon: "ti-chart-bar" },
    { id: "shopifywebhooks", label: "Shopify Webhooks", icon: "ti-webhook" },
    { id: "klaviyo-stats", label: "Klaviyo", icon: "ti-mail-opened" },
    { id: "meta-ads", label: "Meta Ads", icon: "ti-brand-meta" },
    { id: "canva-design", label: "Canva Design", icon: "ti-palette" },
    { id: "higgsfield", label: "Higgsfield", icon: "ti-video" },
    { id: "social", label: "Social Media", icon: "ti-social" },
    { id: "voice", label: "Voice Agents", icon: "ti-microphone" },
    { id: "calls", label: "Calls", icon: "ti-phone-call" },
    { id: "hubspot", label: "HubSpot", icon: "ti-brand-hubspot" },
    { id: "integrations", label: "All Integrations", icon: "ti-plug" },
  ]},
  { group: "SALES SCALES", items: [
    { id: "mypipeline", label: "My Pipeline", icon: "ti-briefcase" },
    { id: "socialautomation", label: "Social Automation", icon: "ti-device-mobile" },
    { id: "reports", label: "Reports", icon: "ti-file-analytics" },
    { id: "casestudies", label: "Case Studies", icon: "ti-trophy" },
    { id: "revenue-dashboard", label: "Revenue Dashboard", icon: "ti-currency-dollar" },
    { id: "store-audit", label: "Store Audit", icon: "ti-search" },
    { id: "competitive-intelligence", label: "Competitive Intel", icon: "ti-radar" },
    { id: "sequence-templates", label: "Sequence Templates", icon: "ti-template" },
    { id: "sequence-analytics", label: "Sequence Analytics", icon: "ti-chart-sankey" },
  ]},
  { group: "PLATFORM", items: [
    { id: "transcribe", label: "Transcribe", icon: "ti-microphone-2" },
    { id: "onboarding", label: "Onboarding", icon: "ti-rocket" },
    { id: "marketplace", label: "Marketplace", icon: "ti-building-store" },
    { id: "whitelabel", label: "White Label", icon: "ti-tag" },
    { id: "contracts", label: "Contracts", icon: "ti-file-text" },
    { id: "referrals", label: "Referrals", icon: "ti-users" },
    { id: "auto-reports", label: "Auto Reports", icon: "ti-file-report" },
    { id: "billing", label: "Billing", icon: "ti-credit-card" },
    { id: "platform-settings", label: "Platform Settings", icon: "ti-adjustments" },
    { id: "settings", label: "Settings", icon: "ti-settings" },
    { id: "platform-health", label: "Platform Health", icon: "ti-heart-rate-monitor" },
    { id: "success-scores", label: "Success Scores", icon: "ti-star" },
    { id: "changelog", label: "Changelog", icon: "ti-clipboard-list" },
    { id: "api-docs", label: "API Docs", icon: "ti-code" },
  ]},
];

const pageTitles = {
  dashboard: "Owner Dashboard",
  clients: "Ecommerce Clients",
  tasks: "Tasks",
  contacts: "Contacts",
  analytics: "Analytics",
  retention: "Retention Dashboard",
  hussain: "Hussain — Intelligence & Strategy",
  hassan: "Hassan — Growth & Outreach",
  ali: "Ali — Sales Closer",
  mahdi: "Mahdi — Marketing & Content",
  fatima: "Fatima — Operations Manager",
  zainab: "Zainab — Client Partner",
  briefings: "Team Briefings",
  "team-performance": "Team Performance",
  approvals: "Approval Queue",
  ai: "Zainab AI Engine",
  sequences: "Sequences",
  pipeline: "Pipeline",
  inbox: "Unified Inbox",
  knowledge: "Knowledge Base",
  shopify: "Shopify Stores",
  "shopify-data": "Live Store Data",
  shopifywebhooks: "Shopify Webhooks",
  "klaviyo-stats": "Klaviyo Email Performance",
  "meta-ads": "Meta Ads Performance",
  "canva-design": "Canva Design Studio",
  higgsfield: "Higgsfield Video Briefs",
  contracts: "Client Contracts",
  referrals: "Referral Tracker",
  "auto-reports": "Automated Monthly Reports",
  billing: "Billing",
  social: "Social Media",
  voice: "Voice Agents",
  calls: "Call Logs",
  hubspot: "HubSpot CRM Sync",
  integrations: "All Integrations",
  mypipeline: "My Pipeline",
  socialautomation: "Social Automation",
  reports: "Reports",
  casestudies: "Case Studies",
  "revenue-dashboard": "Revenue Dashboard",
  "store-audit": "Store Audit Tool",
  "competitive-intelligence": "Competitive Intelligence",
  "sequence-templates": "Sequence Templates",
  "sequence-analytics": "Sequence Analytics",
  "changelog": "Platform Changelog",
  "api-docs": "API Documentation",
  "platform-health": "Platform Health",
  "success-scores": "Client Success Scores",
  transcribe: "Call Transcription",
  onboarding: "Onboarding",
  marketplace: "Marketplace",
  whitelabel: "White Label",
  "platform-settings": "Platform Settings",
  settings: "Settings",
};

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("dashboard");

  // Fix 2: GA4 page-change tracking
  // Replace 'G-XXXXXXXXXX' in public/index.html with your real GA4 Measurement ID
  // Then every owner page navigation will be tracked automatically
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', { page_path: '/' + currentPage, page_title: currentPage });
    }
  }, [currentPage]);
  const [clientOnboarded, setClientOnboarded] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Fix 9: owner first-time tour
  const [tourStep, setTourStep] = useState(-1);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [unreadInbox, setUnreadInbox] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ contacts: [], clients: [], approvals: [] });
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(null);
  const searchRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_read') || '[]')); } catch { return new Set(); }
  });
  const notifRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      if (u.role === 'owner' && !localStorage.getItem('owner_tour_completed')) {
        setTimeout(() => setTourStep(0), 800);
      }
    }
    const token = localStorage.getItem("token");
    if (token) axios.defaults.headers.common["Authorization"] = "Bearer " + token;
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'client') {
      setClientOnboarded(null);
      return;
    }
    setClientOnboarded(null);
    supabase
      .from('client_onboarding')
      .select('id, completed_at')
      .eq('client_id', user.clientId)
      .maybeSingle()
      .then(({ data }) => {
        setClientOnboarded(!!(data && data.completed_at));
      });
  }, [user]);

  useEffect(() => {
    if (!user || user.role === 'client') { setPendingApprovals(0); return; }
    const fetchPending = () => {
      supabase
        .from('approvals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(({ count }) => setPendingApprovals(count || 0));
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || user.role === 'client') { setUnreadInbox(0); return; }
    const fetchUnread = () => {
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .eq('status', 'unread')
        .then(({ count }) => setUnreadInbox(count || 0));
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || user.role === 'client') return;
    const fetchNotifs = async () => {
      try {
        const [approvalsRes, contactsRes, completedRes] = await Promise.all([
          supabase.from('approvals').select('id,title,priority,status,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(8),
          supabase.from('contacts').select('id,first_name,last_name,source,created_at').order('created_at',{ascending:false}).limit(6),
          supabase.from('workflow_enrollments').select('id,workflow_id,completed_at').eq('status','completed').order('completed_at',{ascending:false}).limit(6),
        ]);
        const notifs = [
          ...(approvalsRes.data||[]).map(a => ({ id:'a'+a.id, type:'approval', title: a.title, sub: `${a.priority} priority — needs review`, time: a.created_at, icon:'ti-bell', color:'#d97706' })),
          ...(contactsRes.data||[]).map(c => ({ id:'c'+c.id, type:'contact', title:`${c.first_name||''} ${c.last_name||''}`.trim() || 'New contact', sub:`Added via ${c.source||'unknown'}`, time: c.created_at, icon:'ti-user-plus', color:'#10b981' })),
          ...(completedRes.data||[]).map(e => ({ id:'e'+e.id, type:'enrollment', title:'Sequence completed', sub:'A contact finished a workflow', time: e.completed_at, icon:'ti-circle-check', color:'#3b82f6' })),
        ].sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0,20);
        setNotifications(notifs);
      } catch {}
    };
    fetchNotifs();
    const t = setInterval(fetchNotifs, 60000);
    return () => clearInterval(t);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notifOpen) return;
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [notifOpen]);

  const markNotifRead = (id) => {
    setReadIds(prev => {
      const next = new Set(prev); next.add(id);
      localStorage.setItem('notif_read', JSON.stringify([...next]));
      return next;
    });
  };

  const handleLogin = (userData) => {
    setUser(userData);
    if (userData.role === 'owner' && !localStorage.getItem('owner_tour_completed')) {
      setTimeout(() => setTourStep(0), 800);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults({ contacts: [], clients: [], approvals: [] }); return; }
    setSearching(true);
    try {
      const [contactsRes, clientsRes, approvalsRes] = await Promise.all([
        supabase.from('contacts')
          .select('id, first_name, last_name, email, phone')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5),
        supabase.from('clients')
          .select('id, name, niche')
          .or(`name.ilike.%${q}%,niche.ilike.%${q}%`)
          .limit(5),
        supabase.from('approvals')
          .select('id, title, content, status')
          .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
          .limit(5),
      ]);
      setSearchResults({
        contacts: contactsRes.data || [],
        clients: clientsRes.data || [],
        approvals: approvalsRes.data || [],
      });
    } catch {}
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (searchQuery) runSearch(searchQuery); else setSearchResults({ contacts: [], clients: [], approvals: [] }); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, runSearch]);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchNavigate = (page, id, name) => {
    setCurrentPage(page);
    setSearchHighlight({ id, name, page });
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults({ contacts: [], clients: [], approvals: [] });
    setTimeout(() => setSearchHighlight(null), 4000);
  };

  const totalSearchResults = searchResults.contacts.length + searchResults.clients.length + searchResults.approvals.length;

  if (window.location.pathname === '/terms') return <Terms />;
  if (window.location.pathname === '/privacy') return <Privacy />;
  if (window.location.pathname === '/signup') return <ClientSignup />;
  if (window.location.pathname === '/roadmap') return <PublicRoadmap />;
  if (window.location.pathname === '/zidni') return <ZidniWaitlist />;
  if (window.location.pathname === '/zidni/signup') return <ZidniSignup />;

  const knownPaths = ['/', '/terms', '/privacy', '/signup', '/roadmap', '/zidni', '/zidni/signup'];
  if (!knownPaths.includes(window.location.pathname)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a1628', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ fontSize: '96px', fontWeight: 800, color: '#c9a84c', lineHeight: 1 }}>404</div>
        <div style={{ fontSize: '20px', fontWeight: 600, color: 'white', margin: '16px 0 32px' }}>Page Not Found</div>
        <button onClick={() => window.location.href = '/'} style={{ padding: '12px 28px', background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Go Home</button>
      </div>
    );
  }

  if (!user) {
    if (showLogin) return <Login onLogin={(u) => { setShowLogin(false); handleLogin(u); }} />;
    return <LandingPage onLoginClick={() => setShowLogin(true)} />;
  }

  if (user.role === 'client') {
    if (clientOnboarded === null) {
      return (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a1628', fontFamily: 'DM Sans, sans-serif' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', letterSpacing: '1px' }}>Loading...</div>
        </div>
      );
    }
    if (!clientOnboarded) {
      return <ClientOnboardingFlow user={user} onComplete={() => setClientOnboarded(true)} />;
    }
    return <ClientDashboard user={user} onLogout={handleLogout} />;
  }

  const renderPage = () => {
    switch(currentPage) {
      case "dashboard": return <Dashboard />;
      case "clients": return <Clients />;
      case "tasks": return <Tasks />;
      case "contacts": return <Contacts />;
      case "analytics": return <Analytics />;
      case "retention": return <Retention />;
      case "hussain": return <Hussain />;
      case "hassan": return <Hassan />;
      case "ali": return <Ali />;
      case "mahdi": return <Mahdi />;
      case "fatima": return <Fatima />;
      case "zainab": return <Zainab />;
      case "briefings": return <TeamBriefings />;
      case "team-performance": return <TeamPerformance />;
      case "approvals": return <Approvals />;
      case "ai": return <AIEngine />;
      case "sequences": return <Sequences />;
      case "pipeline": return <Pipeline />;
      case "inbox": return <Inbox />;
      case "knowledge": return <KnowledgeBase />;
      case "shopify": return <Shopify />;
      case "shopify-data": return <ShopifyData />;
      case "shopifywebhooks": return <ShopifyWebhooks />;
      case "klaviyo-stats": return <KlaviyoStats />;
      case "meta-ads": return <MetaAds />;
      case "canva-design": return <CanvaDesign />;
      case "higgsfield": return <HiggsField />;
      case "social": return <SocialMedia />;
      case "voice": return <VoiceAgents />;
      case "calls": return <Calls />;
      case "hubspot": return <HubSpot />;
      case "integrations": return <Integrations />;
      case "mypipeline": return <MyPipeline />;
      case "socialautomation": return <SocialAutomation />;
      case "reports": return <Reports />;
      case "casestudies": return <CaseStudies />;
      case "revenue-dashboard": return <RevenueDashboard />;
      case "store-audit": return <AuditTool />;
      case "competitive-intelligence": return <CompetitiveIntelligence />;
      case "sequence-templates": return <SequenceTemplates />;
      case "sequence-analytics": return <SequenceAnalytics />;
      case "changelog": return <Changelog />;
      case "api-docs": return <ApiDocs />;
      case "transcribe": return <Transcribe />;
      case "onboarding": return <Onboarding />;
      case "marketplace": return <Marketplace />;
      case "whitelabel": return <WhiteLabel />;
      case "contracts": return <Contracts />;
      case "referrals": return <Referrals />;
      case "auto-reports": return <AutoReports />;
      case "billing": return <Billing />;
      case "platform-settings": return <PlatformSettings />;
      case "platform-health": return <PlatformHealth />;
      case "success-scores": return <SuccessScores />;
      case "settings": return <Settings />;
      default: return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', fontFamily: 'DM Sans, sans-serif' }}>
          <div style={{ fontSize: '80px', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>404</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: '12px 0 24px' }}>Page Not Found</div>
          <button className="btn btn-navy" onClick={() => setCurrentPage('dashboard')}>Go Home</button>
        </div>
      );
    }
  };

  return (
    <div className="app">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={"sidebar" + (sidebarOpen ? " open" : "")}>
        <div className="logo-area">
          <div className="logo">SALES SCALES</div>
          <div className="logo-sub">AI REVENUE SYSTEM</div>
          <div className="logo-line"></div>
        </div>

        <div className="nav-scroll">
          {navItems.map(group => (
            <div className="nav-group" key={group.group}>
              <div className="nav-label">{group.group}</div>
              {group.items.map(item => (
                <div
                  key={item.id}
                  className={"nav-item " + (currentPage === item.id ? "active" : "")}
                  onClick={() => { setCurrentPage(item.id); setSidebarOpen(false); }}
                >
                  <i className={"ti " + item.icon} style={{fontSize:"15px"}} aria-hidden="true"></i>
                  <span>{item.label}</span>
                  {(item.id === "approvals" ? pendingApprovals > 0 : item.id === "inbox" ? unreadInbox > 0 : !!item.badge) && (
                    <span className="nav-badge">{item.id === "approvals" ? pendingApprovals : item.id === "inbox" ? unreadInbox : item.badge}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user-name">{user.name}</div>
          <div className="sidebar-user-email">{user.email}</div>
          <button onClick={handleLogout} style={{width:"100%", padding:"7px", fontSize:"10px", borderRadius:"7px", background:"rgba(255,255,255,0.06)", border:"0.5px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", cursor:"pointer"}}>Sign Out</button>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <i className="ti ti-menu-2" aria-hidden="true"></i>
          </button>
          <div className="page-title" style={{ flex: '0 0 auto' }}>{pageTitles[currentPage]}</div>

          {/* Global search */}
          <div ref={searchRef} style={{ flex: '1 1 auto', maxWidth: '400px', margin: '0 16px', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <i className="ti ti-search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search contacts, clients, approvals..."
                style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
              />
              {searching && (
                <i className="ti ti-loader-2" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--muted)' }} />
              )}
            </div>

            {searchOpen && searchQuery.trim() && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(10,22,40,0.12)', zIndex: 1000, overflow: 'hidden', maxHeight: '420px', overflowY: 'auto' }}>
                {totalSearchResults === 0 && !searching && (
                  <div style={{ padding: '16px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>No results for "{searchQuery}"</div>
                )}

                {searchResults.contacts.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 14px 4px', fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', borderBottom: '1px solid var(--border)' }}>Contacts</div>
                    {searchResults.contacts.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSearchNavigate('contacts', c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim())}
                        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {(c.first_name || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${c.first_name || ''} ${c.last_name || ''}`.trim() || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email || c.phone || ''}</div>
                        </div>
                        <i className="ti ti-arrow-right" style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.clients.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 14px 4px', fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', borderBottom: '1px solid var(--border)' }}>Clients</div>
                    {searchResults.clients.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSearchNavigate('clients', c.id, c.name)}
                        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {(c.name || '?')[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{c.niche || 'Ecommerce'}</div>
                        </div>
                        <i className="ti ti-arrow-right" style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.approvals.length > 0 && (
                  <div>
                    <div style={{ padding: '8px 14px 4px', fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', borderBottom: '1px solid var(--border)' }}>Approvals</div>
                    {searchResults.approvals.map(a => (
                      <div
                        key={a.id}
                        onClick={() => handleSearchNavigate('approvals', a.id, a.title)}
                        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: a.status === 'pending' ? 'var(--yellow)' : a.status === 'approved' ? 'var(--green)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className="ti ti-bell" style={{ fontSize: '13px', color: '#fff' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'capitalize' }}>{a.status}</div>
                        </div>
                        <i className="ti ti-arrow-right" style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--muted)', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="topbar-right">
            {pendingApprovals > 0 && (
              <div className="top-badge">{pendingApprovals} approval{pendingApprovals !== 1 ? 's' : ''} waiting</div>
            )}

            {/* Fix 10: Notification Bell */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => setNotifOpen(v => !v)}
                style={{ position: 'relative', background: notifOpen ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${notifOpen ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                <i className="ti ti-bell" style={{ fontSize: '15px', color: notifOpen ? '#c9a84c' : 'rgba(255,255,255,0.6)' }} />
                {notifications.filter(n => !readIds.has(n.id)).length > 0 && (
                  <div style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#dc2626', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0a1628' }}>
                    {notifications.filter(n => !readIds.has(n.id)).length}
                  </div>
                )}
              </button>

              {notifOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '320px', background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', boxShadow: '0 12px 40px rgba(10,22,40,0.15)', zIndex: 1001, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f3f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0a1628' }}>Notifications</div>
                    <button onClick={() => { notifications.forEach(n => markNotifRead(n.id)); }}
                      style={{ fontSize: '10px', color: '#8896a8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Mark all read</button>
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>No notifications yet</div>
                    ) : notifications.map(n => {
                      const isRead = readIds.has(n.id);
                      const diff = Math.floor((Date.now() - new Date(n.time)) / 60000);
                      const timeStr = diff < 60 ? `${diff}m ago` : diff < 1440 ? `${Math.floor(diff/60)}h ago` : `${Math.floor(diff/1440)}d ago`;
                      return (
                        <div key={n.id} onClick={() => { markNotifRead(n.id); setNotifOpen(false); if (n.type==='approval') setCurrentPage('approvals'); else if (n.type==='contact') setCurrentPage('contacts'); }}
                          style={{ display: 'flex', gap: '10px', padding: '12px 16px', cursor: 'pointer', background: isRead ? 'white' : 'rgba(201,168,76,0.04)', borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = isRead ? 'white' : 'rgba(201,168,76,0.04)'}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: n.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className={`ti ${n.icon}`} style={{ fontSize: '14px', color: n.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: isRead ? 500 : 700, color: '#0a1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                            <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '1px' }}>{n.sub}</div>
                          </div>
                          <div style={{ fontSize: '9px', color: '#8896a8', flexShrink: 0, paddingTop: '2px' }}>{timeStr}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="avatar">{user.name ? user.name[0].toUpperCase() : "Y"}</div>
          </div>
        </div>

        {searchHighlight && (
          <div style={{ background: 'var(--gold)', color: '#fff', fontSize: '12px', fontWeight: 600, padding: '6px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-search" style={{ fontSize: '13px' }} />
            Jumped to: {searchHighlight.name}
            <button onClick={() => setSearchHighlight(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
          </div>
        )}

        <div className="content">{renderPage()}</div>
      </div>

      {/* Fix 9: Owner first-time tour */}
      {tourStep >= 0 && (() => {
        const TOUR_STEPS = [
          { nav: 'dashboard',  title: 'Dashboard',      body: 'Your Revenue Command Center — see all key metrics, active sequences, and client health scores at a glance.' },
          { nav: 'clients',    title: 'Clients',         body: 'Manage all your ecommerce client accounts. Add clients, set tiers, and track their onboarding progress.' },
          { nav: 'hussain',    title: 'AI Team',         body: 'Your 6 AI specialists are ready to help. Ask Hussain for strategy, Mahdi for content, Ali to close deals — and more.' },
          { nav: 'approvals',  title: 'Approvals',       body: 'All AI-generated content lands here before it goes live. Review sequences, emails, and outreach — then approve or reject.' },
          { nav: 'knowledge',  title: 'Knowledge Base',  body: 'Train your AI team with brand documents, PDFs, and YouTube content. The better the context, the better the output.' },
          { nav: 'analytics',  title: 'Analytics',       body: 'Track emails sent, SMS delivered, contacts added, and workflow enrollments — broken down by month and client.' },
          { nav: 'retention',  title: 'Retention',       body: 'Spot at-risk contacts before they churn. Engagement scores, activity timelines, and automated win-back triggers.' },
          { nav: 'settings',   title: 'Settings',        body: 'Configure email senders, client branding, integrations, and your platform preferences. Set it once and it runs itself.' },
        ];
        const step = TOUR_STEPS[tourStep];
        const skipTour = () => { setTourStep(-1); localStorage.setItem('owner_tour_completed', '1'); };
        const nextTour = () => {
          if (tourStep >= TOUR_STEPS.length - 1) { skipTour(); return; }
          setCurrentPage(TOUR_STEPS[tourStep + 1].nav);
          setTourStep(s => s + 1);
        };
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.55)', zIndex: 9998, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '40px', right: '40px', zIndex: 9999, background: 'white', borderRadius: '16px', boxShadow: '0 24px 60px rgba(10,22,40,0.3)', width: '340px', overflow: 'hidden', fontFamily: 'DM Sans, sans-serif' }}>
              <div style={{ background: '#0a1628', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {TOUR_STEPS.map((_, i) => (
                    <div key={i} style={{ width: i === tourStep ? '16px' : '6px', height: '6px', borderRadius: '3px', background: i === tourStep ? '#c9a84c' : 'rgba(255,255,255,0.2)', transition: 'all 0.2s' }} />
                  ))}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{tourStep + 1} of {TOUR_STEPS.length}</div>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0a1628', marginBottom: '8px' }}>{step.title}</div>
                <div style={{ fontSize: '13px', color: '#4a5568', lineHeight: '1.7', marginBottom: '20px' }}>{step.body}</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={skipTour} className="btn btn-outline" style={{ flex: 1, fontSize: '12px', padding: '8px' }}>Skip Tour</button>
                  <button onClick={nextTour} className="btn btn-gold" style={{ flex: 2, fontSize: '12px', padding: '8px' }}>
                    {tourStep >= TOUR_STEPS.length - 1 ? 'Finish →' : 'Next →'}
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default App;