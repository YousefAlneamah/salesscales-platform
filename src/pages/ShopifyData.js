import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';

const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLE = {
  paid:      { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' },
  pending:   { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' },
  refunded:  { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  voided:    { background: '#f8fafc', color: '#8896a8', border: '1px solid #e4e9f0' },
  partially_paid: { background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' },
};

const Badge = ({ text }) => {
  const s = STATUS_STYLE[text] || STATUS_STYLE.voided;
  return (
    <span style={{ ...s, fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {text}
    </span>
  );
};

export default function ShopifyData() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data: rows }) => {
      if (rows) setClients(rows);
    });
  }, []);

  const fetchData = async (clientId) => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    setData(null);
    setAiResult('');
    try {
      const { data: res } = await axios.post('http://localhost:3001/shopify/store-data', { client_id: clientId });
      setData(res);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (id) => {
    setSelectedClient(id);
    fetchData(id);
  };

  const askAI = async () => {
    if (!aiPrompt.trim() || !selectedClient) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const { data: res } = await axios.post('http://localhost:3001/hussain', {
        prompt: aiPrompt,
        clientId: selectedClient,
      });
      setAiResult(res.result || '');
    } catch (e) {
      setAiResult('Error: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const statCard = (label, value, sub, accent) => (
    <div className={`stat-card ${accent}-top`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className={`stat-sub-${accent === 'gold' ? 'gold' : accent === 'green' ? 'green' : accent === 'blue' ? 'blue' : ''}`}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div className="section-label">Shopify MCP</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Live Store Data</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={selectedClient}
            onChange={e => handleClientChange(e.target.value)}
            style={{ border: '1px solid #e4e9f0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', minWidth: '200px' }}
          >
            <option value="">— Select client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedClient && (
            <button onClick={() => fetchData(selectedClient)} className="btn btn-outline" style={{ fontSize: '11px', padding: '8px 14px' }}>
              <i className="ti ti-refresh" style={{ marginRight: '5px' }} />Refresh
            </button>
          )}
        </div>
      </div>

      {/* EMPTY STATE */}
      {!selectedClient && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="ti ti-shopping-cart" style={{ fontSize: '36px', color: '#e4e9f0', display: 'block', marginBottom: '12px' }} />
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Select a client to load store data</div>
          <div style={{ fontSize: '11px', color: '#8896a8' }}>Live orders, revenue, products and abandoned checkouts pulled directly from Shopify.</div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Fetching live store data from Shopify...</div>
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <i className="ti ti-alert-circle" style={{ fontSize: '28px', color: '#dc2626', display: 'block', marginBottom: '10px' }} />
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>Could not load store data</div>
          <div style={{ fontSize: '11px', color: '#8896a8' }}>{error}</div>
        </div>
      )}

      {/* DATA */}
      {data && !loading && (
        <>
          {/* Store badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <i className="ti ti-brand-shopify" style={{ fontSize: '18px', color: '#10b981' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{data.shop}</span>
            <span style={{ fontSize: '9px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '2px 10px', fontWeight: 700 }}>● CONNECTED</span>
            <span style={{ fontSize: '10px', color: '#8896a8', marginLeft: 'auto' }}>Last fetched {new Date(data.fetchedAt).toLocaleTimeString()}</span>
          </div>

          {/* STATS */}
          <div className="stats-row" style={{ marginBottom: '16px' }}>
            {statCard('Revenue This Month', fmt(data.monthRevenue), `${data.monthOrderCount} paid orders`, 'green')}
            {statCard('Total Orders', data.totalOrders?.toLocaleString(), 'all time', 'navy')}
            {statCard('Orders This Month', data.monthOrderCount, 'current month', 'blue')}
            {statCard('Abandoned Checkouts', data.abandonedCheckouts, 'open checkouts', 'gold')}
          </div>

          {/* ORDERS + PRODUCTS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            {/* RECENT ORDERS */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Recent Orders</div>
              <div className="table-wrap">
                <div className="table-header">
                  <div className="th" style={{ flex: '0 0 70px' }}>Order</div>
                  <div className="th" style={{ flex: 1 }}>Customer</div>
                  <div className="th" style={{ flex: '0 0 80px', textAlign: 'right' }}>Total</div>
                  <div className="th" style={{ flex: '0 0 80px' }}>Status</div>
                </div>
                {(data.recentOrders || []).map(o => (
                  <div key={o.id} className="table-row">
                    <div className="td" style={{ flex: '0 0 70px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#c9a84c', fontWeight: 600 }}>{o.name}</div>
                    <div className="td" style={{ flex: 1, fontSize: '11px' }}>
                      <div style={{ fontWeight: 500, color: '#0a1628' }}>{o.email || '—'}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8' }}>{o.item_count} item{o.item_count !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="td" style={{ flex: '0 0 80px', textAlign: 'right', fontWeight: 600, color: '#0a1628', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>
                      {fmt(o.total)}
                    </div>
                    <div className="td" style={{ flex: '0 0 80px' }}>
                      <Badge text={o.financial_status} />
                    </div>
                  </div>
                ))}
                {(!data.recentOrders || data.recentOrders.length === 0) && (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#8896a8' }}>No orders found</div>
                )}
              </div>
            </div>

            {/* TOP PRODUCTS */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Top Products This Month</div>
              {data.topProducts && data.topProducts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.topProducts.map((p, i) => {
                    const maxRev = data.topProducts[0].revenue;
                    const pct = maxRev > 0 ? Math.round((p.revenue / maxRev) * 100) : 0;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ fontSize: '11px', color: '#0a1628', fontWeight: 500, flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                          <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>{fmt(p.revenue)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="pbar" style={{ flex: 1 }}>
                            <div className="pfill-green" style={{ width: pct + '%' }} />
                          </div>
                          <div style={{ fontSize: '10px', color: '#8896a8', width: '50px', textAlign: 'right' }}>{p.quantity} sold</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', fontSize: '11px', color: '#8896a8' }}>No product sales data for this month</div>
              )}
            </div>
          </div>

          {/* ASK AI */}
          <div className="card">
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ask Hussain About This Store</div>
            <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '14px' }}>Hussain has access to live store data in his context — ask anything about performance, opportunities, or strategy.</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: aiResult ? '14px' : '0' }}>
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askAI()}
                placeholder="e.g. What's our biggest revenue opportunity this month? Why are so many checkouts abandoned?"
                style={{ flex: 1, border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
              />
              <button onClick={askAI} disabled={aiLoading || !aiPrompt.trim()} className="btn btn-navy" style={{ padding: '9px 18px', fontSize: '11px' }}>
                {aiLoading ? 'Thinking...' : 'Ask Hussain'}
              </button>
            </div>
            {aiResult && (
              <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '14px', fontSize: '12px', color: '#0a1628', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                {aiResult}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
