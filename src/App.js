import React, { useState, useEffect } from "react";
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
import Transcribe from "./pages/Transcribe";
import MyPipeline from "./pages/MyPipeline";
import SocialAutomation from "./pages/SocialAutomation";
import Reports from "./pages/Reports";
import RevenueDashboard from "./pages/RevenueDashboard";
import CaseStudies from "./pages/CaseStudies";
import Onboarding from "./pages/Onboarding";
import Marketplace from "./pages/Marketplace";
import WhiteLabel from "./pages/WhiteLabel";
import Settings from "./pages/Settings";
import ClientDashboard from "./pages/ClientDashboard";
import ClientOnboardingFlow from "./pages/ClientOnboardingFlow";
import Hussain from "./pages/Hussain";
import Hassan from "./pages/Hassan";
import Ali from "./pages/Ali";
import Mahdi from "./pages/Mahdi";
import Fatima from "./pages/Fatima";
import Zainab from "./pages/Zainab";
import TeamBriefings from "./pages/TeamBriefings";

const navItems = [
  { group: "MAIN", items: [
    { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
    { id: "clients", label: "Clients", icon: "ti-users" },
    { id: "contacts", label: "Contacts", icon: "ti-user" },
    { id: "analytics", label: "Analytics", icon: "ti-chart-bar" },
  ]},
  { group: "AI TEAM", items: [
    { id: "hussain", label: "Hussain AI", icon: "ti-brain" },
    { id: "hassan", label: "Hassan AI", icon: "ti-speakerphone" },
    { id: "ali", label: "Ali AI", icon: "ti-phone" },
    { id: "mahdi", label: "Mahdi AI", icon: "ti-pencil" },
    { id: "fatima", label: "Fatima AI", icon: "ti-settings" },
    { id: "zainab", label: "Zainab AI", icon: "ti-robot" },
    { id: "briefings", label: "Team Briefings", icon: "ti-mail-forward" },
  ]},
  { group: "CLIENT MGMT", items: [
    { id: "approvals", label: "Approvals", icon: "ti-bell", badge: "4" },
    { id: "sequences", label: "Sequences", icon: "ti-bolt" },
    { id: "pipeline", label: "Pipeline", icon: "ti-target" },
    { id: "inbox", label: "Inbox", icon: "ti-message", badge: "12" },
    { id: "knowledge", label: "Knowledge Base", icon: "ti-brain" },
  ]},
  { group: "INTEGRATIONS", items: [
    { id: "shopify", label: "Shopify", icon: "ti-shopping-cart" },
    { id: "shopify-data", label: "Store Data", icon: "ti-chart-bar" },
    { id: "shopifywebhooks", label: "Shopify Webhooks", icon: "ti-webhook" },
    { id: "klaviyo-stats", label: "Klaviyo", icon: "ti-mail-opened" },
    { id: "meta-ads", label: "Meta Ads", icon: "ti-brand-meta" },
    { id: "social", label: "Social Media", icon: "ti-social" },
    { id: "voice", label: "Voice Agents", icon: "ti-microphone" },
    { id: "integrations", label: "All Integrations", icon: "ti-plug" },
  ]},
  { group: "SALES SCALES", items: [
    { id: "mypipeline", label: "My Pipeline", icon: "ti-briefcase" },
    { id: "socialautomation", label: "Social Automation", icon: "ti-device-mobile" },
    { id: "reports", label: "Reports", icon: "ti-file-analytics" },
    { id: "casestudies", label: "Case Studies", icon: "ti-trophy" },
    { id: "revenue-dashboard", label: "Revenue Dashboard", icon: "ti-currency-dollar" },
    { id: "store-audit", label: "Store Audit", icon: "ti-search" },
  ]},
  { group: "PLATFORM", items: [
    { id: "transcribe", label: "Transcribe", icon: "ti-microphone-2" },
    { id: "onboarding", label: "Onboarding", icon: "ti-rocket" },
    { id: "marketplace", label: "Marketplace", icon: "ti-building-store" },
    { id: "whitelabel", label: "White Label", icon: "ti-tag" },
    { id: "settings", label: "Settings", icon: "ti-settings" },
  ]},
];

const pageTitles = {
  dashboard: "Owner Dashboard",
  clients: "Ecommerce Clients",
  contacts: "Contacts",
  analytics: "Analytics",
  hussain: "Hussain — Intelligence & Strategy",
  hassan: "Hassan — Growth & Outreach",
  ali: "Ali — Sales Closer",
  mahdi: "Mahdi — Marketing & Content",
  fatima: "Fatima — Operations Manager",
  zainab: "Zainab — Client Partner",
  briefings: "Team Briefings",
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
  social: "Social Media",
  voice: "Voice Agents",
  integrations: "All Integrations",
  mypipeline: "My Pipeline",
  socialautomation: "Social Automation",
  reports: "Reports",
  casestudies: "Case Studies",
  "revenue-dashboard": "Revenue Dashboard",
  "store-audit": "Store Audit Tool",
  transcribe: "Call Transcription",
  onboarding: "Onboarding",
  marketplace: "Marketplace",
  whitelabel: "White Label",
  settings: "Settings",
};

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [clientOnboarded, setClientOnboarded] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
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

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

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
      case "contacts": return <Contacts />;
      case "analytics": return <Analytics />;
      case "hussain": return <Hussain />;
      case "hassan": return <Hassan />;
      case "ali": return <Ali />;
      case "mahdi": return <Mahdi />;
      case "fatima": return <Fatima />;
      case "zainab": return <Zainab />;
      case "briefings": return <TeamBriefings />;
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
      case "social": return <SocialMedia />;
      case "voice": return <VoiceAgents />;
      case "integrations": return <Integrations />;
      case "mypipeline": return <MyPipeline />;
      case "socialautomation": return <SocialAutomation />;
      case "reports": return <Reports />;
      case "casestudies": return <CaseStudies />;
      case "revenue-dashboard": return <RevenueDashboard />;
      case "store-audit": return <AuditTool />;
      case "transcribe": return <Transcribe />;
      case "onboarding": return <Onboarding />;
      case "marketplace": return <Marketplace />;
      case "whitelabel": return <WhiteLabel />;
      case "settings": return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="logo-area">
          <div className="logo">SALES SCALES</div>
          <div className="logo-sub">AI REVENUE SYSTEM</div>
          <div className="logo-line"></div>
        </div>

        {navItems.map(group => (
          <div className="nav-group" key={group.group}>
            <div className="nav-label">{group.group}</div>
            {group.items.map(item => (
              <div
                key={item.id}
                className={"nav-item " + (currentPage === item.id ? "active" : "")}
                onClick={() => setCurrentPage(item.id)}
              >
                <i className={"ti " + item.icon} style={{fontSize:"15px"}} aria-hidden="true"></i>
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </div>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="sidebar-user-name">{user.name}</div>
          <div className="sidebar-user-email">{user.email}</div>
          <button onClick={handleLogout} style={{width:"100%", padding:"7px", fontSize:"10px", borderRadius:"7px", background:"rgba(255,255,255,0.06)", border:"0.5px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", cursor:"pointer"}}>Sign Out</button>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <div className="page-title">{pageTitles[currentPage]}</div>
          <div className="topbar-right">
            <div className="top-badge">4 approvals waiting</div>
            <div className="avatar">{user.name ? user.name[0].toUpperCase() : "Y"}</div>
          </div>
        </div>
        <div className="content">{renderPage()}</div>
      </div>
    </div>
  );
}

export default App;