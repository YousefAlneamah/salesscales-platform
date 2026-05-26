import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const WEBHOOK_DEFS = [
  { topic: 'checkouts/create', label: 'Cart Recovery', triggerType: 'cart_abandoned', icon: 'ti-shopping-cart-off', desc: 'Fires when a checkout is created — triggers abandoned cart sequence' },
  { topic: 'orders/create', label: 'Post Purchase', triggerType: 'order_placed', icon: 'ti-circle-check', desc: 'Fires when a new order is placed — triggers post purchase sequence' },
  { topic: 'orders/updated', label: 'Payment Recovery', triggerType: 'payment_failed', icon: 'ti-credit-card-off', desc: 'Fires when an order has pending/failed payment — triggers recovery sequence' },
  { topic: 'orders/fulfilled', label: 'Delivery Confirmation', triggerType: 'order_fulfilled', icon: 'ti-truck-delivery', desc: 'Fires when an order is fulfilled — triggers delivery sequence' },
];

export default function ShopifyWebhooks() {
  const [connections, setConnections] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState({});
  const [registering, setRegistering] = useState({});
  const [checking, setChecking] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: conns }, { data: clientList }] = await Promise.all([
      supabase.from('shopify_connections').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name')
    ]);
    setConnections(conns || []);
    const map = {};
    (clientList || []).forEach(c => { map[c.id] = c.name; });
    setClients(map);
    setLoading(false);
  };

  const checkStatus = async (shop, accessToken) => {
    setChecking(prev => ({ ...prev, [shop]: true }));
    try {
      const res = await axios.post(`${API_BASE}/shopify/list-webhooks`, { shop, accessToken });
      setWebhookStatus(prev => ({ ...prev, [shop]: { webhooks: res.data.webhooks || [], error: null } }));
    } catch (e) {
      setWebhookStatus(prev => ({ ...prev, [shop]: { webhooks: [], error: e.response?.data?.error || e.message } }));
    }
    setChecking(prev => ({ ...prev, [shop]: false }));
  };

  const registerWebhooks = async (shop, accessToken) => {
    setRegistering(prev => ({ ...prev, [shop]: true }));
    try {
      const res = await axios.post(`${API_BASE}/shopify/register-webhooks`, { shop, accessToken });
      if (res.data.failed?.length > 0) {
        alert(`Registered ${res.data.registered.length} webhooks. ${res.data.failed.length} failed:\n${res.data.failed.map(f => f.topic).join(', ')}`);
      }
      await checkStatus(shop, accessToken);
    } catch (e) {
      alert('Failed to register webhooks: ' + (e.response?.data?.error || e.message));
    }
    setRegistering(prev => ({ ...prev, [shop]: false }));
  };

  const isRegistered = (shop, topic) => {
    const status = webhookStatus[shop];
    if (!status || !status.webhooks) return null;
    return status.webhooks.some(w => w.topic === topic);
  };

  const totalRegistered = () => {
    let count = 0;
    Object.values(webhookStatus).forEach(s => { count += (s.webhooks || []).length; });
    return count;
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--muted)' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="stats-row" style={{ marginBottom: '24px' }}>
        <div className="stat-card blue-top">
          <div className="stat-label">Connected Stores</div>
          <div className="stat-value">{connections.length}</div>
          <div className="stat-sub">Shopify integrations</div>
        </div>
        <div className="stat-card gold-top">
          <div className="stat-label">Webhook Topics</div>
          <div className="stat-value">4</div>
          <div className="stat-sub">per store</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Webhooks Checked</div>
          <div className="stat-value">{totalRegistered()}</div>
          <div className="stat-sub">active across all stores</div>
        </div>
        <div className="stat-card navy-top">
          <div className="stat-label">Auto-Trigger</div>
          <div className="stat-value">Live</div>
          <div className="stat-sub">real-time enrollment</div>
        </div>
      </div>

      {connections.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>
          <i className="ti ti-shopping-cart" style={{ fontSize: '40px', marginBottom: '12px', display: 'block', opacity: 0.3 }}></i>
          <div style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text)' }}>No Shopify stores connected</div>
          <div style={{ fontSize: '13px' }}>Connect a store from the Shopify page first</div>
        </div>
      )}

      {connections.map(conn => {
        const status = webhookStatus[conn.shop];
        const isChecking = checking[conn.shop];
        const isReg = registering[conn.shop];

        return (
          <div key={conn.shop} className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="ti ti-brand-shopify" style={{ fontSize: '20px', color: 'var(--green)' }}></i>
                  <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>{conn.shop}</span>
                  {conn.client_id && clients[conn.client_id] && (
                    <span className="badge-blue" style={{ fontSize: '10px' }}>{clients[conn.client_id]}</span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', paddingLeft: '30px' }}>
                  Connected {new Date(conn.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => checkStatus(conn.shop, conn.access_token)}
                  disabled={isChecking}
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  <i className="ti ti-refresh" style={{ marginRight: '5px' }}></i>
                  {isChecking ? 'Checking...' : 'Check Status'}
                </button>
                <button
                  className="btn btn-gold"
                  onClick={() => registerWebhooks(conn.shop, conn.access_token)}
                  disabled={isReg}
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                >
                  <i className="ti ti-webhook" style={{ marginRight: '5px' }}></i>
                  {isReg ? 'Registering...' : 'Register Webhooks'}
                </button>
              </div>
            </div>

            {status?.error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--red)', marginBottom: '16px' }}>
                <i className="ti ti-alert-circle" style={{ marginRight: '6px' }}></i>
                {status.error}
              </div>
            )}

            <div className="table-wrap">
              <div className="table-header">
                <div className="th" style={{ flex: 2 }}>Webhook Trigger</div>
                <div className="th" style={{ flex: 2 }}>Shopify Topic</div>
                <div className="th" style={{ flex: 2 }}>Workflow Trigger Type</div>
                <div className="th" style={{ flex: 1 }}>Status</div>
              </div>
              {WEBHOOK_DEFS.map(def => {
                const registered = isRegistered(conn.shop, def.topic);
                return (
                  <div key={def.topic} className="table-row">
                    <div className="td" style={{ flex: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className={`ti ${def.icon}`} style={{ color: 'var(--gold)', fontSize: '14px' }}></i>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '13px' }}>{def.label}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{def.desc}</div>
                        </div>
                      </div>
                    </div>
                    <div className="td" style={{ flex: 2 }}>
                      <code style={{ fontSize: '11px', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', color: 'var(--slate)' }}>
                        {def.topic}
                      </code>
                    </div>
                    <div className="td" style={{ flex: 2 }}>
                      <code style={{ fontSize: '11px', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', color: 'var(--blue)' }}>
                        {def.triggerType}
                      </code>
                    </div>
                    <div className="td" style={{ flex: 1 }}>
                      {registered === null ? (
                        <span className="badge-yellow">Not Checked</span>
                      ) : registered ? (
                        <span className="badge-green">Active</span>
                      ) : (
                        <span className="badge-red">Not Registered</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {status?.webhooks && status.webhooks.length > 0 && (
              <div style={{ marginTop: '14px', padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px' }}>
                <div className="section-label" style={{ marginBottom: '8px' }}>All Registered Webhooks on this Store</div>
                {status.webhooks.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0', fontSize: '12px', color: 'var(--slate)' }}>
                    <i className="ti ti-circle-dot" style={{ color: 'var(--green)', fontSize: '10px' }}></i>
                    <code style={{ flex: 1 }}>{w.topic}</code>
                    <span style={{ color: 'var(--muted)', flex: 2 }}>{w.address}</span>
                    <span style={{ color: 'var(--muted)' }}>ID: {w.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="card" style={{ background: 'var(--navy)', color: 'white', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <i className="ti ti-info-circle" style={{ fontSize: '20px', color: 'var(--gold)', flexShrink: 0, marginTop: '2px' }}></i>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Setup Instructions</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.7' }}>
              1. Set <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>WEBHOOK_BASE_URL</code> in your .env to your public server URL (ngrok in dev, your domain in prod).<br />
              2. Create workflows with matching trigger types: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>cart_abandoned</code>, <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>order_placed</code>, <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>payment_failed</code>, <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>order_fulfilled</code>.<br />
              3. Click Register Webhooks for each store — Shopify will start sending real-time events.<br />
              4. Contacts are automatically created and enrolled in the matching sequence when events fire.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
