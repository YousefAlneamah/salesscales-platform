import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Shopify() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connections, setConnections] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    fetchClients();
    fetchConnections();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const fetchConnections = async () => {
    const { data } = await supabase.from('shopify_connections').select('*');
    if (data) setConnections(data);
  };

  const connectShopify = () => {
    if (!shopDomain) {
      alert('Please enter your Shopify store domain');
      return;
    }
    if (!selectedClient) {
      alert('Please select a client');
      return;
    }

    let shop = shopDomain.trim();
    if (!shop.includes('.myshopify.com')) {
      shop = shop + '.myshopify.com';
    }
    shop = shop.replace('https://', '').replace('http://', '');

    setConnecting(true);
    const installUrl = `http://localhost:3001/shopify/install?shop=${shop}&clientId=${selectedClient}`;
    window.open(installUrl, '_blank');
    setConnecting(false);
  };

  const syncCustomers = async (connection) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('http://localhost:3001/shopify/sync-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: connection.shop,
          accessToken: connection.access_token,
          clientId: connection.client_id
        })
      });
      const data = await response.json();
      if (data.success) {
        setSyncResult(`Successfully synced ${data.count} customers from ${connection.shop}`);
      } else {
        setSyncResult('Sync failed: ' + data.error);
      }
    } catch (e) {
      setSyncResult('Sync error: ' + e.message);
    }
    setSyncing(false);
  };

  const inputStyle = {
    width: '100%',
    border: '0.5px solid #e2e8f0',
    borderRadius: '7px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#1a3c5e',
    outline: 'none',
    background: 'white',
    boxSizing: 'border-box'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>SHOPIFY STORES</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{connections.length} stores connected</div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'CONNECTED STORES', value: connections.length, sub: 'active connections' },
          { label: 'TOTAL CUSTOMERS', value: '0', sub: 'sync to see real data' },
          { label: 'ORDERS THIS MONTH', value: '0', sub: 'sync to see real data' },
          { label: 'RECOVERED REVENUE', value: '$0', sub: 'cart recovery this month' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', borderTop: '2px solid #10b981' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a3c5e' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* CONNECT NEW STORE */}
      <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '14px' }}>CONNECT NEW SHOPIFY STORE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>SELECT CLIENT</div>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={inputStyle}>
              <option value="">Select client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>SHOPIFY STORE DOMAIN</div>
            <input
              type="text"
              value={shopDomain}
              onChange={e => setShopDomain(e.target.value)}
              placeholder="yourstore.myshopify.com"
              style={inputStyle}
            />
          </div>
        </div>
        <button
          onClick={connectShopify}
          disabled={connecting}
          style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '9px 20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
        >
          {connecting ? 'Connecting...' : '+ Connect Shopify Store'}
        </button>
        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '10px' }}>
          The client will be redirected to Shopify to approve the connection. This takes less than 60 seconds.
        </div>
      </div>

      {/* SYNC RESULT */}
      {syncResult && (
        <div style={{ background: syncResult.includes('failed') || syncResult.includes('error') ? '#fef2f2' : '#ecfdf5', border: `0.5px solid ${syncResult.includes('failed') || syncResult.includes('error') ? '#fecaca' : '#a7f3d0'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: syncResult.includes('failed') || syncResult.includes('error') ? '#dc2626' : '#059669' }}>
          {syncResult}
        </div>
      )}

      {/* CONNECTED STORES */}
      {connections.length === 0 ? (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🛍️</div>
          <div style={{ fontWeight: 600, color: '#1a3c5e', marginBottom: '6px' }}>No stores connected yet</div>
          <div style={{ fontSize: '11px' }}>Connect a Shopify store above to start syncing customers automatically</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>CONNECTED STORES</div>
          {connections.map(conn => (
            <div key={conn.id} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e', marginBottom: '3px' }}>{conn.shop}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Connected · Last sync: never</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => syncCustomers(conn)}
                  disabled={syncing}
                  style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                >
                  {syncing ? 'Syncing...' : 'Sync Customers'}
                </button>
                <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', border: '0.5px solid #a7f3d0', alignSelf: 'center' }}>Connected</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
