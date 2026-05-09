import React, { useState, useEffect } from "react";
import "./styles/global.css";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import AuditTool from "./pages/AuditTool";
import Analytics from "./pages/Analytics";
import Approvals from "./pages/Approvals";
import AIEngine from "./pages/AIEngine";
import Sequences from "./pages/Sequences";
import Pipeline from "./pages/Pipeline";
import Inbox from "./pages/Inbox";
import KnowledgeBase from "./pages/KnowledgeBase";
import Shopify from "./pages/Shopify";
import SocialMedia from "./pages/SocialMedia";
import VoiceAgents from "./pages/VoiceAgents";
import Integrations from "./pages/Integrations";
import MyPipeline from "./pages/MyPipeline";
import SocialAutomation from "./pages/SocialAutomation";
import Reports from "./pages/Reports";
import CaseStudies from "./pages/CaseStudies";
import Onboarding from "./pages/Onboarding";
import Marketplace from "./pages/Marketplace";
import WhiteLabel from "./pages/WhiteLabel";
import Settings from "./pages/Settings";

const navItems = [
  { group: "MAIN", items: [
    { id: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard" },
    { id: "clients", label: "Clients", icon: "ti-users" },
    { id: "audit", label: "Audit Tool", icon: "ti-search" },
    { id: "analytics", label: "Analytics", icon: "ti-chart-bar" },
  ]},
  { group: "CLIENT MGMT", items: [
    { id: "approvals", label: "Approvals", icon: "ti-bell", badge: "4" },
    { id: "ai", label: "Zainab AI", icon: "ti-robot" },
    { id: "sequences", label: "Sequences", icon: "ti-bolt" },
    { id: "pipeline", label: "Pipeline", icon: "ti-target" },
    { id: "inbox", label: "Inbox", icon: "ti-message", badge: "12" },
    { id: "knowledge", label: "Knowledge Base", icon: "ti-brain" },
  ]},
  { group: "INTEGRATIONS", items: [
    { id: "shopify", label: "Shopify", icon: "ti-shopping-cart" },
    { id: "social", label: "Social Media", icon: "ti-social" },
    { id: "voice", label: "Voice Agents", icon: "ti-microphone" },
    { id: "integrations", label: "All Integrations", icon: "ti-plug" },
  ]},
  { group: "SALES SCALES", items: [
    { id: "mypipeline", label: "My Pipeline", icon: "ti-briefcase" },
    { id: "socialautomation", label: "Social Automation", icon: "ti-device-mobile" },
    { id: "reports", label: "Reports", icon: "ti-file-analytics" },
    { id: "casestudies", label: "Case Studies", icon: "ti-trophy" },
  ]},
  { group: "PLATFORM", items: [
    { id: "onboarding", label: "Onboarding", icon: "ti-rocket" },
    { id: "marketplace", label: "Marketplace", icon: "ti-building-store" },
    { id: "whitelabel", label: "White Label", icon: "ti-tag" },
    { id: "settings", label: "Settings", icon: "ti-settings" },
  ]},
];

const pageTitles = {
  dashboard: "Owner Dashboard", clients: "All Clients", audit: "Audit Tool",
  analytics: "Analytics", approvals: "Approval Queue", ai: "Zainab AI Engine",
  sequences: "Sequences", pipeline: "Pipeline", inbox: "Unified Inbox",
  knowledge: "Knowledge Base", shopify: "Shopify Stores", social: "Social Media",
  voice: "Voice Agents", integrations: "All Integrations", mypipeline: "My Pipeline",
  socialautomation: "Social Automation", reports: "Reports", casestudies: "Case Studies",
  onboarding: "Onboarding", marketplace: "Marketplace", whitelabel: "White Label",
  settings: "Settings",
};

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("dashboard");

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  const renderPage = () => {
    switch(currentPage) {
      case "dashboard": return <Dashboard />;
      case "clients": return <Clients />;
      case "audit": return <AuditTool />;
      case "analytics": return <Analytics />;
      case "approvals": return <Approvals />;
      case "ai": return <AIEngine />;
      case "sequences": return <Sequences />;
      case "pipeline": return <Pipeline />;
      case "inbox": return <Inbox />;
      case "knowledge": return <KnowledgeBase />;
      case "shopify": return <Shopify />;
      case "social": return <SocialMedia />;
      case "voice": return <VoiceAgents />;
      case "integrations": return <Integrations />;
      case "mypipeline": return <MyPipeline />;
      case "socialautomation": return <SocialAutomation />;
      case "reports": return <Reports />;
      case "casestudies": return <CaseStudies />;
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
