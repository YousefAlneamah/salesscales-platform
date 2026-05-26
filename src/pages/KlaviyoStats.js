import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';

const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => n != null ? `${n}%` : '—';

const CAMPAIGN_STATUS = {
  sent:      { label: 'Sent',      cls: 'badge-green' },
  scheduled: { label: 'Scheduled', cls: 'badge-blue' },
  draft:     { label: 'Draft',     cls: 'badge-yellow' },
  cancelled: { label: 'Cancelled', cls: 'badge-red' },
};

export default function KlaviyoStats() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthError, setIsAuthError] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data: rows }) => {
      if (rows) setClients(rows);
    });
  }, []);

  const fetchStats = async (clientId) => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    setIsAuthError(false);
    setData(null);
    try {
      const { data: res } = await axios.post('http://localhost:3001/klaviyo/stats', { client_id: clientId });
      setData(res);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      const status = e.response?.status;
      setIsAuthError(status === 401);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (id) => {
    setSelectedClient(id);
    fetchStats(id);
  };

  const maxListCount = data ? Math.max(...(data.lists || []).map(l => l.profile_count), 1) : 1;

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div className="section-label">Klaviyo MCP</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Email Performance — Last 30 Days</div>
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
            <button onClick={() => fetchStats(selectedClient)} className="btn btn-outline" style={{ fontSize: '11px', padding: '8px 14px' }}>
              <i className="ti ti-refresh" style={{ marginRight: '5px' }} />Refresh
            </button>
          )}
        </div>
      </div>

      {/* EMPTY STATE */}
      {!selectedClient && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="ti ti-mail-opened" style={{ fontSize: '36px', color: '#e4e9f0', display: 'block', marginBottom: '12px' }} />
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Select a client to load Klaviyo data</div>
          <div style={{ fontSize: '11px', color: '#8896a8' }}>Open rates, click rates, revenue, list sizes, and recent campaigns pulled live from Klaviyo.</div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Fetching live data from Klaviyo...</div>
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <i className="ti ti-alert-circle" style={{ fontSize: '28px', color: '#dc2626', display: 'block', marginBottom: '10px' }} />
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '6px' }}>
            {isAuthError ? 'Invalid or missing Klaviyo API key' : 'Could not load Klaviyo data'}
          </div>
          <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: isAuthError ? '16px' : '0' }}>{error}</div>
          {isAuthError && (
            <div style={{ fontSize: '11px', color: '#c9a84c' }}>
              Go to <strong>Settings → Email Domains</strong> and enter the Klaviyo API key for this client.
            </div>
          )}
        </div>
      )}

      {/* DATA */}
      {data && !loading && (
        <>
          {/* Connected badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <i className="ti ti-mail-opened" style={{ fontSize: '18px', color: '#c9a84c' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>Klaviyo</span>
            <span style={{ fontSize: '9px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '2px 10px', fontWeight: 700 }}>● CONNECTED</span>
            <span style={{ fontSize: '10px', color: '#8896a8', marginLeft: 'auto' }}>Last 30 days · {data.totalLists} list{data.totalLists !== 1 ? 's' : ''}</span>
          </div>

          {/* TOP STATS */}
          <div className="stats-row" style={{ marginBottom: '16px' }}>
            <div className="stat-card gold-top">
              <div className="stat-label">Open Rate</div>
              <div className="stat-value">{pct(data.openRate)}</div>
              <div className="stat-sub-gold">last 30 days</div>
            </div>
            <div className="stat-card blue-top">
              <div className="stat-label">Click Rate</div>
              <div className="stat-value">{pct(data.clickRate)}</div>
              <div className="stat-sub-blue">last 30 days</div>
            </div>
            <div className="stat-card green-top">
              <div className="stat-label">Revenue Attributed</div>
              <div className="stat-value">{data.revenue != null ? fmt(data.revenue) : '—'}</div>
              <div className="stat-sub-green">last 30 days</div>
            </div>
            <div className="stat-card navy-top">
              <div className="stat-label">Total Subscribers</div>
              <div className="stat-value">{(data.totalSubscribers || 0).toLocaleString()}</div>
              <div className="stat-sub">across {data.totalLists} lists</div>
            </div>
          </div>

          {/* LISTS + CAMPAIGNS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            {/* LIST BREAKDOWN */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>List Breakdown</div>
              {data.lists && data.lists.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.lists.slice(0, 8).map((list, i) => {
                    const pctWidth = maxListCount > 0 ? Math.round((list.profile_count / maxListCount) * 100) : 0;
                    return (
                      <div key={list.id || i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <div style={{ fontSize: '11px', color: '#0a1628', fontWeight: 500, flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</div>
                          <div style={{ fontSize: '11px', color: '#c9a84c', fontWeight: 700, fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>{(list.profile_count || 0).toLocaleString()}</div>
                        </div>
                        <div className="pbar">
                          <div style={{ height: '100%', borderRadius: '3px', background: '#c9a84c', width: `${pctWidth}%`, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                  {data.lists.length > 8 && (
                    <div style={{ fontSize: '10px', color: '#8896a8', textAlign: 'center' }}>+{data.lists.length - 8} more lists</div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', fontSize: '11px', color: '#8896a8' }}>No lists found in this account</div>
              )}
            </div>

            {/* RECENT CAMPAIGNS */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Recent Campaigns</div>
              {data.recentCampaigns && data.recentCampaigns.length > 0 ? (
                <div className="table-wrap">
                  <div className="table-header">
                    <div className="th" style={{ flex: 2 }}>Campaign</div>
                    <div className="th" style={{ flex: '0 0 80px' }}>Status</div>
                    <div className="th" style={{ flex: '0 0 90px', textAlign: 'right' }}>Sent</div>
                  </div>
                  {data.recentCampaigns.slice(0, 8).map((c, i) => {
                    const statusInfo = CAMPAIGN_STATUS[c.status?.toLowerCase()] || { label: c.status || '—', cls: 'badge-yellow' };
                    const sentDate = c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
                    return (
                      <div key={c.id || i} className="table-row">
                        <div className="td" style={{ flex: 2, fontSize: '11px', fontWeight: 500, color: '#0a1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</div>
                        <div className="td" style={{ flex: '0 0 80px' }}>
                          <span className={statusInfo.cls}>{statusInfo.label}</span>
                        </div>
                        <div className="td" style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '11px', color: '#8896a8', fontFamily: 'DM Mono, monospace' }}>{sentDate}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', fontSize: '11px', color: '#8896a8' }}>No campaigns found</div>
              )}
            </div>
          </div>

          {/* BENCHMARKS */}
          <div className="card">
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Industry Benchmarks</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {[
                { label: 'Open Rate', value: data.openRate, benchmark: 21.5, unit: '%', color: '#c9a84c' },
                { label: 'Click Rate', value: data.clickRate, benchmark: 2.6, unit: '%', color: '#3b82f6' },
              ].map(item => {
                const val = item.value;
                const above = val != null && val > item.benchmark;
                const diff = val != null ? Math.abs(val - item.benchmark).toFixed(1) : null;
                return (
                  <div key={item.label} style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.label}</div>
                      {diff != null && (
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: above ? '#ecfdf5' : '#fef2f2', color: above ? '#059669' : '#dc2626', border: `1px solid ${above ? '#a7f3d0' : '#fecaca'}` }}>
                          {above ? `+${diff}% above avg` : `${diff}% below avg`}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '26px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', lineHeight: 1 }}>{val != null ? `${val}%` : '—'}</div>
                      <div style={{ fontSize: '11px', color: '#8896a8', paddingBottom: '2px' }}>vs {item.benchmark}% avg</div>
                    </div>
                    <div style={{ position: 'relative', height: '6px', background: '#e4e9f0', borderRadius: '3px' }}>
                      {val != null && (
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '3px', background: item.color, width: `${Math.min((val / (item.benchmark * 2)) * 100, 100)}%`, transition: 'width 0.5s ease' }} />
                      )}
                      <div style={{ position: 'absolute', top: '-3px', height: '12px', width: '2px', background: '#8896a8', left: `${Math.min((item.benchmark / (item.benchmark * 2)) * 100, 100)}%` }} />
                    </div>
                    <div style={{ fontSize: '9px', color: '#8896a8', marginTop: '5px', textAlign: 'right' }}>industry avg mark</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
