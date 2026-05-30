import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';
import { API_BASE } from '../config';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [clients, setClients] = useState([]);
  const [emailConfig, setEmailConfig] = useState({});
  const [emailSaving, setEmailSaving] = useState(null);
  const [emailSaved, setEmailSaved] = useState(null);
  const [twilioProvisioning, setTwilioProvisioning] = useState(null);
  const [twilioResult, setTwilioResult] = useState({});
  const [shopifyConns, setShopifyConns] = useState({});
  const [socialConfig, setSocialConfig] = useState({});
  const [socialNames, setSocialNames] = useState({});
  const [disconnecting, setDisconnecting] = useState({});

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

  useEffect(() => {
    supabase.from('clients').select('id, name, from_email, from_name, klaviyo_api_key, meta_access_token, meta_ad_account_id, meta_page_id, meta_ig_user_id, hubspot_api_key, hubspot_portal_id, twilio_phone_number, twilio_subaccount_sid').order('name').then(({ data }) => {
      if (!data) return;
      setClients(data);
      const cfg = {};
      data.forEach(c => { cfg[c.id] = { from_email: c.from_email || '', from_name: c.from_name || '', klaviyo_api_key: c.klaviyo_api_key || '', meta_access_token: c.meta_access_token || '', meta_ad_account_id: c.meta_ad_account_id || '', hubspot_api_key: c.hubspot_api_key || '', hubspot_portal_id: c.hubspot_portal_id || '' }; });
      setEmailConfig(cfg);
      const sc = {};
      data.forEach(c => { sc[c.id] = { meta_page_id: c.meta_page_id || '', meta_ig_user_id: c.meta_ig_user_id || '' }; });
      setSocialConfig(sc);
      const tr = {};
      data.forEach(c => { if (c.twilio_phone_number) tr[c.id] = { phone: c.twilio_phone_number, sid: c.twilio_subaccount_sid }; });
      setTwilioResult(tr);
    });
    supabase.from('shopify_connections').select('client_id, shop').then(({ data }) => {
      const sc = {};
      (data || []).forEach(c => { sc[c.client_id] = c.shop; });
      setShopifyConns(sc);
    });
  }, []);

  const provisionNumber = async (clientId, areaCode) => {
    setTwilioProvisioning(clientId);
    try {
      const res = await fetch(`${API_BASE}/twilio/provision-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, area_code: areaCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Provisioning failed');
      setTwilioResult(prev => ({ ...prev, [clientId]: { phone: data.phone_number, sid: data.subaccount_sid } }));
    } catch (e) {
      alert('Provisioning failed: ' + e.message);
    } finally {
      setTwilioProvisioning(null);
    }
  };

  useEffect(() => {
    if (activeTab !== 'email-domains') return;
    clients.forEach(c => {
      const sc = socialConfig[c.id] || {};
      if (sc.meta_page_id || sc.meta_ig_user_id) {
        axios.get(`${API_BASE}/meta/page-info`, { params: { client_id: c.id } })
          .then(r => setSocialNames(prev => ({ ...prev, [c.id]: r.data })))
          .catch(() => {});
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, clients.length]);

  const disconnectSocial = async (clientId, platform) => {
    if (!window.confirm(`Disconnect ${platform === 'facebook' ? 'Facebook' : 'Instagram'} for this client?`)) return;
    setDisconnecting(prev => ({ ...prev, [clientId]: platform }));
    try {
      await axios.post(`${API_BASE}/auth/${platform}/disconnect`, { client_id: clientId });
      setSocialConfig(prev => ({
        ...prev,
        [clientId]: {
          ...prev[clientId],
          ...(platform === 'facebook' ? { meta_page_id: '' } : { meta_ig_user_id: '' }),
        },
      }));
      setSocialNames(prev => ({
        ...prev,
        [clientId]: {
          ...prev[clientId],
          ...(platform === 'facebook' ? { page_name: null } : { ig_username: null }),
        },
      }));
    } catch (e) {
      alert('Disconnect failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setDisconnecting(prev => ({ ...prev, [clientId]: null }));
    }
  };

  const disconnectShopify = async (clientId) => {
    if (!window.confirm('Disconnect Shopify? This will pause all active workflows for this client.')) return;
    setDisconnecting(prev => ({ ...prev, [clientId]: 'shopify' }));
    try {
      await axios.post(`${API_BASE}/shopify/disconnect`, { client_id: clientId });
      setShopifyConns(prev => { const n = { ...prev }; delete n[clientId]; return n; });
    } catch (e) {
      alert('Disconnect failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setDisconnecting(prev => ({ ...prev, [clientId]: null }));
    }
  };

  const saveEmailConfig = async (clientId) => {
    setEmailSaving(clientId);
    const { from_email, from_name, klaviyo_api_key, meta_access_token, meta_ad_account_id, hubspot_api_key, hubspot_portal_id } = emailConfig[clientId] || {};
    await supabase.from('clients').update({ from_email: from_email || null, from_name: from_name || null, klaviyo_api_key: klaviyo_api_key || null, meta_access_token: meta_access_token || null, meta_ad_account_id: meta_ad_account_id || null, hubspot_api_key: hubspot_api_key || null, hubspot_portal_id: hubspot_portal_id || null }).eq('id', clientId);
    setEmailSaving(null);
    setEmailSaved(clientId);
    setTimeout(() => setEmailSaved(null), 2000);
  };

  const tabs = [
    { id: 'profile', label: 'Business Profile', icon: '🏢' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'integrations', label: 'Integrations', icon: '🔌' },
    { id: 'pricing', label: 'Pricing', icon: '💰' },
    { id: 'email-domains', label: 'Email Domains', icon: '📧' },
    { id: 'ai', label: 'AI Team', icon: '🤖' },
    { id: 'security', label: 'Security', icon: '🔒' },
  ];

  const aiTeam = [
    { name: 'Zainab', role: 'Client AI Partner', description: 'Handles client onboarding, orientation, and ongoing relationship management.', status: 'active' },
    { name: 'Ali', role: 'Sales Closer', description: 'Takes warm leads from Hassan, handles full sales conversation, closes deals.', status: 'active' },
    { name: 'Fatima', role: 'Operations Manager', description: 'Monitors all workflows, manages contracts and payments, runs background processes.', status: 'active' },
    { name: 'Mahdi', role: 'Marketing & Content AI', description: 'Creates all content for Sales Scales and clients in exact brand voice.', status: 'active' },
    { name: 'Hassan', role: 'Growth & Outreach AI', description: 'Finds prospects, researches them, sends outreach, warms and qualifies leads.', status: 'active' },
    { name: 'Hussain', role: 'Intelligence & Strategy AI', description: 'Analyzes all data, weekly insights, benchmarks, strategic recommendations, morning briefing.', status: 'active' },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = {
    width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#0a1628',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif'
  };

  const labelStyle = {
    fontSize: '10px', color: '#8896a8', marginBottom: '6px',
    fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px'
  };

  const TwilioAreaInput = ({ clientId, provisioning, onProvision }) => {
    const [areaCode, setAreaCode] = React.useState('');
    return (
      <>
        <input
          type="text"
          value={areaCode}
          onChange={e => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
          placeholder="Area code (optional)"
          style={{ width: '140px', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '7px 10px', fontSize: '11px', color: '#0a1628', outline: 'none', background: 'white', fontFamily: 'DM Mono, monospace' }}
        />
        <button
          onClick={() => onProvision(clientId, areaCode)}
          disabled={provisioning}
          style={{ background: provisioning ? '#8896a8' : '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '11px', fontWeight: 700, cursor: provisioning ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
          {provisioning ? 'Provisioning...' : '+ Provision Number'}
        </button>
        <span style={{ fontSize: '10px', color: '#8896a8' }}>Creates a Twilio sub-account and purchases a dedicated US number</span>
      </>
    );
  };

  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)}
      style={{ width: '36px', height: '20px', borderRadius: '10px', background: value ? '#10b981' : '#e4e9f0', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: value ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}></div>
    </div>
  );

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Settings</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Configure your Sales Scales platform</div>
        </div>
        <button onClick={handleSave}
          style={{ background: saved ? '#10b981' : '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px' }}>
        {/* TABS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tabs.map(tab => (
            <div key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#0a1628' : 'transparent', color: activeTab === tab.id ? 'white' : '#4a5568', transition: 'all 0.15s' }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '20px' }}>Business Profile</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><label style={labelStyle}>Business Name</label><input type="text" value={profile.businessName} onChange={e => setProfile({ ...profile, businessName: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Owner Name</label><input type="text" value={profile.ownerName} onChange={e => setProfile({ ...profile, ownerName: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Email</label><input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Phone</label><input type="text" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+965 XXXX XXXX" style={inputStyle} /></div>
                <div><label style={labelStyle}>Website</label><input type="text" value={profile.website} onChange={e => setProfile({ ...profile, website: e.target.value })} style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>Timezone</label>
                  <select value={profile.timezone} onChange={e => setProfile({ ...profile, timezone: e.target.value })} style={inputStyle}>
                    <option value="Asia/Kuwait">Kuwait (GMT+3)</option>
                    <option value="America/New_York">New York (GMT-5)</option>
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
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '20px' }}>Notification Preferences</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { key: 'newApproval', label: 'New Approval Request', sub: 'When AI generates a new action requiring review' },
                  { key: 'urgentApproval', label: 'Urgent Approval Alert', sub: 'When a time-sensitive action is waiting' },
                  { key: 'newMessage', label: 'New Inbound Message', sub: 'When a contact sends a message on any channel' },
                  { key: 'clientHealth', label: 'Client Health Alert', sub: 'When a client health score drops below 60' },
                  { key: 'weeklyReport', label: 'Weekly Performance Report', sub: 'Automated report every Monday morning' },
                  { key: 'dailyBriefing', label: 'Daily AI Briefing', sub: 'Hussain morning briefing every day at 8am' },
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f0f3f8' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#0a1628' }}>{item.label}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '2px' }}>{item.sub}</div>
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
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '20px' }}>API Integrations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { key: 'anthropicKey', label: 'Anthropic API Key', placeholder: 'sk-ant-...', sub: 'Powers all AI features — Zainab, Ali, Fatima, Mahdi, Hassan, Hussain' },
                  { key: 'sendgridKey', label: 'SendGrid API Key', placeholder: 'SG.xxxxx', sub: 'Email sending for all clients' },
                  { key: 'twilioSid', label: 'Twilio Account SID', placeholder: 'ACxxxxx', sub: 'SMS sending for all clients' },
                  { key: 'twilioToken', label: 'Twilio Auth Token', placeholder: 'xxxxx', sub: 'Twilio authentication' },
                  { key: 'twilioPhone', label: 'Twilio Phone Number', placeholder: '+1 555 000 0000', sub: 'Default SMS sending number' },
                  { key: 'whatsappToken', label: 'WhatsApp Business Token', placeholder: 'EAAxxxxx', sub: 'WhatsApp Business API' },
                  { key: 'elevenlabsKey', label: 'ElevenLabs API Key', placeholder: 'xxxxx', sub: 'AI voice agents' },
                ].map(item => (
                  <div key={item.key}>
                    <label style={labelStyle}>{item.label}</label>
                    <input type="password" value={integrations[item.key]} onChange={e => setIntegrations({ ...integrations, [item.key]: e.target.value })} placeholder={item.placeholder} style={inputStyle} />
                    <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '4px' }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRICING */}
          {activeTab === 'pricing' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '20px' }}>Pricing Configuration</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {[
                  { key: 'starterMonthly', label: 'Starter Monthly ($)' },
                  { key: 'starterSetup', label: 'Starter Setup Fee ($)' },
                  { key: 'growthMonthly', label: 'Growth Monthly ($)' },
                  { key: 'growthSetup', label: 'Growth Setup Fee ($)' },
                  { key: 'eliteMonthly', label: 'Elite Monthly ($)' },
                  { key: 'eliteSetup', label: 'Elite Setup Fee ($)' },
                  { key: 'performanceBonus', label: 'Performance Bonus (%)' },
                  { key: 'annualDiscount', label: 'Annual Discount (%)' },
                  { key: 'auditFee', label: 'Audit Tool Fee ($)' },
                ].map(item => (
                  <div key={item.key}>
                    <label style={labelStyle}>{item.label}</label>
                    <input type="number" value={pricing[item.key]} onChange={e => setPricing({ ...pricing, [item.key]: parseFloat(e.target.value) })} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #f0f3f8' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Revenue Potential — 5 Clients Per Tier</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {['starter', 'growth', 'elite'].map(tier => (
                    <div key={tier} style={{ textAlign: 'center', background: 'white', borderRadius: '8px', padding: '14px', border: '1px solid #e4e9f0' }}>
                      <div style={{ fontSize: '9px', color: '#8896a8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{tier}</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#0a1628', marginBottom: '3px' }}>${(pricing[`${tier}Monthly`] * 5).toLocaleString()}/mo</div>
                      <div style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 500 }}>${(pricing[`${tier}Monthly`] * 5 * 12 * 0.8).toLocaleString()}/yr</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI TEAM */}
          {activeTab === 'ai' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '20px' }}>AI Team Configuration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aiTeam.map(ai => (
                  <div key={ai.name} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid #f0f3f8' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>
                      {ai.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '1px' }}>{ai.name}</div>
                      <div style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 500, marginBottom: '3px' }}>{ai.role}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8', lineHeight: '1.5' }}>{ai.description}</div>
                    </div>
                    <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontWeight: 600, flexShrink: 0 }}>● Active</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMAIL DOMAINS */}
          {activeTab === 'email-domains' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Per-Client Email Sender</div>
              <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '20px', lineHeight: '1.6' }}>
                Set a custom From email and name for each client. Emails sent via sequences and workflows will use these instead of the default SendGrid address. The from_email must be verified in SendGrid.
              </div>
              {clients.length === 0 && (
                <div style={{ fontSize: '12px', color: '#8896a8', textAlign: 'center', padding: '40px 0' }}>No clients found.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {clients.map(client => {
                  const cfg = emailConfig[client.id] || { from_email: '', from_name: '', klaviyo_api_key: '', meta_access_token: '', meta_ad_account_id: '', hubspot_api_key: '', hubspot_portal_id: '' };
                  const isSaving = emailSaving === client.id;
                  const isDone = emailSaved === client.id;
                  return (
                    <div key={client.id} style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '14px 16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '12px' }}>{client.name}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>From Email</label>
                          <input
                            type="email"
                            value={cfg.from_email}
                            onChange={e => setEmailConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], from_email: e.target.value } }))}
                            placeholder="hello@clientbrand.com"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>From Name</label>
                          <input
                            type="text"
                            value={cfg.from_name}
                            onChange={e => setEmailConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], from_name: e.target.value } }))}
                            placeholder="Client Brand"
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ visibility: 'hidden', padding: '9px 16px' }} />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ ...labelStyle, color: '#c9a84c' }}>Klaviyo API Key</label>
                        <input
                          type="password"
                          value={cfg.klaviyo_api_key}
                          onChange={e => setEmailConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], klaviyo_api_key: e.target.value } }))}
                          placeholder="pk_••••••••••••••••••••••••••••••••"
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={{ ...labelStyle, color: '#3b82f6' }}>Meta Access Token</label>
                          <input
                            type="password"
                            value={cfg.meta_access_token}
                            onChange={e => setEmailConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], meta_access_token: e.target.value } }))}
                            placeholder="EAAxxxxxxxxxxxxxxxx"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, color: '#3b82f6' }}>Meta Ad Account ID</label>
                          <input
                            type="text"
                            value={cfg.meta_ad_account_id}
                            onChange={e => setEmailConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], meta_ad_account_id: e.target.value } }))}
                            placeholder="act_1234567890"
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                        <div>
                          <label style={{ ...labelStyle, color: '#ff7a59' }}>HubSpot API Key</label>
                          <input
                            type="password"
                            value={cfg.hubspot_api_key}
                            onChange={e => setEmailConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], hubspot_api_key: e.target.value } }))}
                            placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, color: '#ff7a59' }}>HubSpot Portal ID</label>
                          <input
                            type="text"
                            value={cfg.hubspot_portal_id}
                            onChange={e => setEmailConfig(prev => ({ ...prev, [client.id]: { ...prev[client.id], hubspot_portal_id: e.target.value } }))}
                            placeholder="12345678"
                            style={inputStyle}
                          />
                        </div>
                        <button
                          onClick={() => saveEmailConfig(client.id)}
                          disabled={isSaving}
                          style={{ background: isDone ? '#10b981' : '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s' }}>
                          {isSaving ? 'Saving...' : isDone ? '✓ Saved' : 'Save'}
                        </button>
                      </div>

                      {/* TWILIO NUMBER */}
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e4e9f0' }}>
                        <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                          Dedicated SMS Number
                        </div>
                        {twilioResult[client.id] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontWeight: 600 }}>● Active</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0a1628', fontFamily: 'DM Mono, monospace' }}>{twilioResult[client.id].phone}</span>
                            <span style={{ fontSize: '10px', color: '#8896a8' }}>Sub-account: {twilioResult[client.id].sid}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <TwilioAreaInput clientId={client.id} provisioning={twilioProvisioning === client.id} onProvision={provisionNumber} />
                          </div>
                        )}
                      </div>

                      {/* SOCIAL CONNECTIONS */}
                      {(() => {
                        const sc = socialConfig[client.id] || {};
                        const names = socialNames[client.id] || {};
                        const shopDomain = shopifyConns[client.id];
                        const hasFb = !!sc.meta_page_id;
                        const hasIg = !!sc.meta_ig_user_id;
                        const connBadge = { fontSize: '9px', padding: '2px 8px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontWeight: 600 };
                        const disconnBtn = (clientId, platform, busy) => (
                          <button
                            onClick={() => disconnectSocial(clientId, platform)}
                            disabled={busy}
                            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                            {busy ? '...' : 'Disconnect'}
                          </button>
                        );
                        return (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e4e9f0' }}>
                            <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Social Connections</div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>

                              {/* Facebook */}
                              {hasFb ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0f4ff', border: '1px solid #c7d7ff', borderRadius: '8px', padding: '7px 12px' }}>
                                  <span style={connBadge}>● Facebook</span>
                                  <span style={{ fontSize: '11px', color: '#0a1628', fontWeight: 500 }}>
                                    {names.page_name || sc.meta_page_id}
                                  </span>
                                  {disconnBtn(client.id, 'facebook', disconnecting[client.id] === 'facebook')}
                                </div>
                              ) : (
                                <a href={`${API_BASE}/auth/facebook/connect?client_id=${client.id}`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1877f2', color: 'white', borderRadius: '8px', padding: '7px 14px', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                                  <i className="ti ti-brand-facebook" style={{ fontSize: '13px' }} /> Connect Facebook
                                </a>
                              )}

                              {/* Instagram */}
                              {hasIg ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff0f7', border: '1px solid #fbc8e2', borderRadius: '8px', padding: '7px 12px' }}>
                                  <span style={connBadge}>● Instagram</span>
                                  <span style={{ fontSize: '11px', color: '#0a1628', fontWeight: 500 }}>
                                    {names.ig_username ? `@${names.ig_username}` : sc.meta_ig_user_id}
                                  </span>
                                  {disconnBtn(client.id, 'instagram', disconnecting[client.id] === 'instagram')}
                                </div>
                              ) : (
                                <a href={`${API_BASE}/auth/instagram/connect?client_id=${client.id}`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', color: 'white', borderRadius: '8px', padding: '7px 14px', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                                  <i className="ti ti-brand-instagram" style={{ fontSize: '13px' }} /> Connect Instagram
                                </a>
                              )}

                              {/* Shopify */}
                              {shopDomain && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '7px 12px' }}>
                                  <span style={connBadge}>● Shopify</span>
                                  <span style={{ fontSize: '11px', color: '#0a1628', fontWeight: 500, fontFamily: 'DM Mono, monospace' }}>{shopDomain}</span>
                                  <button
                                    onClick={() => disconnectShopify(client.id)}
                                    disabled={disconnecting[client.id] === 'shopify'}
                                    style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 10px', fontSize: '10px', fontWeight: 600, cursor: disconnecting[client.id] === 'shopify' ? 'not-allowed' : 'pointer' }}>
                                    {disconnecting[client.id] === 'shopify' ? '...' : 'Disconnect'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '20px' }}>Security Settings</div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#d97706', marginBottom: '4px' }}>⚠ Security Hardening Pending</div>
                <div style={{ fontSize: '10px', color: '#92400e', lineHeight: '1.6' }}>JWT authentication, proper Row Level Security, and rate limiting will be implemented before production launch.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div><label style={labelStyle}>Current Password</label><input type="password" placeholder="Enter current password" style={inputStyle} /></div>
                <div><label style={labelStyle}>New Password</label><input type="password" placeholder="Enter new password" style={inputStyle} /></div>
                <div><label style={labelStyle}>Confirm New Password</label><input type="password" placeholder="Confirm new password" style={inputStyle} /></div>
                <button onClick={handleSave}
                  style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', width: 'fit-content' }}>
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