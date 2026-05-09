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
    { id: "dashboard", label: "Dashboard" },
    { id: "clients", label: "Clients" },
    { id: "audit", label: "Audit Tool" },
    { id: "analytics", label: "Analytics" },
  ]},
  { group: "CLIENT MGMT", items: [
    { id: "approvals", label: "Approvals", badge: "4" },
    { id: "ai", label: "AI Engine" },
    { id: "sequences", label: "Sequences" },
    { id: "pipeline", label: "Pipeline" },
    { id: "inbox", label: "Inbox", badge: "12" },
    { id: "knowledge", label: "Knowledge Base" },
  ]},
  { group: "INTEGRATIONS", items: [
    { id: "shopify", label: "Shopify" },
    { id: "social", label: "Social Media" },
    { id: "voice", label: "Voice Agents" },
    { id: "integrations", label: "All Integrations" },
  ]},
  { group: "SALES SCALES", items: [
    { id: "mypipeline", label: "My Pipeline" },
    { id: "socialautomation", label: "Social Automation" },
    { id: "reports", label: "Reports" },
    { id: "casestudies", label: "Case Studies" },
  ]},
  { group: "PLATFORM", items: [
    { id: "onboarding", label: "Onboarding" },
    { id: "marketplace", label: "Marketplace" },
    { id: "whitelabel", label: "White Label" },
    { id: "settings", label: "Settings" },
  ]},
];

const pageTitles = {
  dashboard: "Owner Dashboard", clients: "All Clients", audit: "Audit Tool",
  analytics: "Analytics", approvals: "Approval Queue", ai: "AI Engine",
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

  const handleLogin = (userData) => {
    setUser(userData);
  };

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
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </div>
            ))}
          </div>
        ))}
        <div style={{marginTop:"auto", padding:"16px"}}>
          <div style={{fontSize:"11px", color:"var(--muted)", marginBottom:"4px"}}>{user.name}</div>
          <div style={{fontSize:"10px", color:"var(--muted)", marginBottom:"10px"}}>{user.email}</div>
          <button onClick={handleLogout} className="btn btn-outline" style={{width:"100%", fontSize:"10px", padding:"6px"}}>Sign Out</button>
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
