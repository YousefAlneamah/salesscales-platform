import React, { useState } from 'react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({
    businessName: 'Sales Scales',
    ownerName: 'Yousef',
    email: 'yousef@salesscales.com',
    phone: '',
    website: 'salesscales.com',
    timezone: 'Asia/Kuwait',
  });

  const [notifications, setNotifications] = useState({
    newApproval: true,
    urgentApproval: true,
    newMessage: true,
    clientHealth: true,
    weeklyReport: true,
    dailyBriefing: true,
  });

  const [integrations, setIntegrations] = useState({
    anthropicKey: '',
    sendgridKey: '',
    twilioSid: '',
    twilioToken: '',
    twilioPhone: '',
    whatsappToken: '',
    elevenlabsKey: '',
  });

  const [pricing, setPricing] = useState({
    starterMonthly: 1500,
    starterSetup: 500,
    growthMonthly: 3000,
    growthSetup: 1500,
    eliteMonthly: 6000,
    eliteSetup: 3000,
    performanceBonus: 10,
    annualDiscount: 20,
    auditFee: 300,
  });

  const tabs = [
    { id: 'profile', label: 'Business Profile', icon: '🏢' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'integrations', label: 'Integrations', icon: '🔌' },
    { id: 'pricing', label: 'Pricing', icon: '💰' },
    { id: 'ai', label: 'AI Team', icon: '🤖' },
    { id: 'security', label: 'Security', icon: '🔒' },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = {
    width: '100%', border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  const labelStyle = {
    fontSize: '10px', color: '#94a3b8', marginBottom: '5px',
    fontWeight: 500, display: 'block'
  };

  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)}
      style={{ width: '36px', height: '20px', borderRadius: '10px', background: value ? '#10b981' : '#e2e8f0', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: value ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}></div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>SETTINGS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Configure your Sales Scales platform</div>
        </div>
        <button onClick={handleSave}
          style={{ background: saved ? '#10b981' : '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 16px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px' }}>
        {/* TABS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tabs.map(tab => (
            <div key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#ecfdf5' : 'transparent', color: activeTab === tab.id ? '#10b981' : '#64748b', border: activeTab === tab.id ? '0.5px solid #a7f3d0' : '0.5px solid transparent' }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e', marginBottom: '16px' }}>Business Profile</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>BUSINESS NAME</label>
                  <input type="text" value={profile.businessName} onChange={e => setProfile({ ...profile, businessName: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>OWNER NAME</label>
                  <input type="text" value={profile.ownerName} onChange={e => setProfile({ ...profile, ownerName: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>EMAIL</label>
                  <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>PHONE</label>
                  <input type="text" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+965 XXXX XXXX" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>WEBSITE</label>
                  <input type="text" value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>TIMEZONE</label>
                  <select value={profile.timezone} onChange={e => setProfile({ ...profile, timezone: e.target.value })} style={inputStyle}>
                    <option value="Asia/Kuwait">Kuwait (GMT+3)</option>
                    <option value="America/New_York">New York (GMT-5)</option>
                    <option value="America/Los_Angeles">Los Angeles (GMT-8)</option>
                    <option value="Europe/London">London (GMT+0)</option>
                    <option value="Asia/Dubai">Dubai (GMT+4)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e', marginBottom: '16px' }}>Notification Preferences</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { key: 'newApproval', label: 'New Approval Request', sub: 'When AI generates a new action requiring review' },
                  { key: 'urgentApproval', label: 'Urgent Approval Alert', sub: 'When a time-sensitive action is waiting' },
                  { key: 'newMessage', label: 'New Inbound Message', sub: 'When a contact sends a message on any channel' },
                  { key: 'clientHealth', label: 'Client Health Alert', sub: 'When a client health score drops below 60' },
                  { key: 'weeklyReport', label: 'Weekly Performance Report', sub: 'Automated report every Monday morning' },
                  { key: 'dailyBriefing', label: 'Daily AI Briefing', sub: 'Hussain morning briefing every day at 8am' },
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8f9fc', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#1a3c5e' }}>{item.label}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{item.sub}</div>
                    </div>
                    <Toggle value={notifications[item.key]} onChange={v => setNotifications({ ...notifications, [item.key]: v })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e', marginBottom: '16px' }}>API Integrations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { key: 'anthropicKey', label: 'ANTHROPIC API KEY', placeholder: 'sk-ant-...', sub: 'Powers all AI features — Zainab, Ali, Fatima, Mahdi, Hassan, Hussain' },
                  { key: 'sendgridKey', label: 'SENDGRID API KEY', placeholder: 'SG.xxxxx', sub: 'Email sending infrastructure for all clients' },
                  { key: 'twilioSid', label: 'TWILIO ACCOUNT SID', placeholder: 'ACxxxxx', sub: 'SMS sending for all clients' },
                  { key: 'twilioToken', label: 'TWILIO AUTH TOKEN', placeholder: 'xxxxx', sub: 'Twilio authentication' },
                  { key: 'twilioPhone', label: 'TWILIO PHONE NUMBER', placeholder: '+1 555 000 0000', sub: 'Default sending number for SMS' },
                  { key: 'whatsappToken', label: 'WHATSAPP BUSINESS TOKEN', placeholder: 'EAAxxxxx', sub: 'WhatsApp Business API for all clients' },
                  { key: 'elevenlabsKey', label: 'ELEVENLABS API KEY', placeholder: 'xxxxx', sub: 'AI voice agents for all clients' },
                ].map(item => (
                  <div key={item.key}>
                    <label style={labelStyle}>{item.label}</label>
                    <input type="password" value={integrations[item.key]}
                      onChange={e => setIntegrations({ ...integrations, [item.key]: e.target.value })}
                      placeholder={item.placeholder} style={inputStyle} />
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRICING */}
          {activeTab === 'pricing' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e', marginBottom: '16px' }}>Pricing Configuration</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[
                  { key: 'starterMonthly', label: 'STARTER MONTHLY ($)' },
                  { key: 'starterSetup', label: 'STARTER SETUP FEE ($)' },
                  { key: 'growthMonthly', label: 'GROWTH MONTHLY ($)' },
                  { key: 'growthSetup', label: 'GROWTH SETUP FEE ($)' },
                  { key: 'eliteMonthly', label: 'ELITE MONTHLY ($)' },
                  { key: 'eliteSetup', label: 'ELITE SETUP FEE ($)' },
                  { key: 'performanceBonus', label: 'PERFORMANCE BONUS (%)' },
                  { key: 'annualDiscount', label: 'ANNUAL DISCOUNT (%)' },
                  { key: 'auditFee', label: 'AUDIT TOOL FEE ($)' },
                ].map(item => (
                  <div key={item.key}>
                    <label style={labelStyle}>{item.label}</label>
                    <input type="number" value={pricing[item.key]}
                      onChange={e => setPricing({ ...pricing, [item.key]: parseFloat(e.target.value) })}
                      style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', background: '#f8f9fc', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>ANNUAL REVENUE POTENTIAL</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {['starter', 'growth', 'elite'].map(tier => {
                    const monthly = pricing[`${tier}Monthly`];
                    const annual = monthly * 12 * (1 - pricing.annualDiscount / 100);
                    return (
                      <div key={tier} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>{tier.toUpperCase()} × 5 clients</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a3c5e' }}>${(monthly * 5).toLocaleString()}/mo</div>
                        <div style={{ fontSize: '10px', color: '#10b981' }}>${(annual * 5).toLocaleString()}/yr</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* AI TEAM */}
          {activeTab === 'ai' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e', marginBottom: '16px' }}>AI Team Configuration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { name: 'Zainab', role: 'Client AI Partner', description: 'Handles client onboarding, orientation, and ongoing relationship management. Feeds knowledge to Mahdi.', status: 'active' },
                  { name: 'Ali', role: 'Sales Closer', description: 'Takes warm leads from Hassan, handles full sales conversation, closes Starter and Growth. Escalates Elite to Yousef.', status: 'active' },
                  { name: 'Fatima', role: 'Operations Manager', description: 'Monitors all workflows, manages contracts and payments, runs background processes, manages approval queue.', status: 'active' },
                  { name: 'Mahdi', role: 'Marketing and Content AI', description: 'Creates all content for Sales Scales and clients in exact brand voice. Fed by Zainab knowledge base.', status: 'active' },
                  { name: 'Hassan', role: 'Growth and Outreach AI', description: 'Finds prospects, researches them, sends outreach, warms conversations, qualifies and hands to Ali fully briefed.', status: 'active' },
                  { name: 'Hussain', role: 'Intelligence, Strategy, and Founder Thinking AI', description: 'Analyzes all data, weekly insights, benchmarks, strategic recommendations, thinks like Yousef, morning briefing daily.', status: 'active' },
                ].map(ai => (
                  <div key={ai.name} style={{ background: '#f8f9fc', borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a3c5e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#10b981', fontWeight: 700, flexShrink: 0 }}>
                        {ai.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a3c5e' }}>{ai.name}</div>
                        <div style={{ fontSize: '10px', color: '#10b981', marginBottom: '4px' }}>{ai.role}</div>
                        <div style={{ fontSize: '10px', color: '#64748b', lineHeight: '1.5' }}>{ai.description}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', border: '0.5px solid #a7f3d0', flexShrink: 0, marginLeft: '8px' }}>
                      ● Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e', marginBottom: '16px' }}>Security Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#d97706', marginBottom: '4px' }}>⚠️ Security Hardening Pending</div>
                  <div style={{ fontSize: '10px', color: '#92400e' }}>JWT authentication, Row Level Security, and rate limiting will be implemented before production launch.</div>
                </div>
                <div>
                  <label style={labelStyle}>CURRENT PASSWORD</label>
                  <input type="password" placeholder="Enter current password" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>NEW PASSWORD</label>
                  <input type="password" placeholder="Enter new password" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CONFIRM NEW PASSWORD</label>
                  <input type="password" placeholder="Confirm new password" style={inputStyle} />
                </div>
                <button onClick={handleSave}
                  style={{ background: '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', padding: '9px 16px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', width: 'fit-content' }}>
                  Update Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}