import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');
const fmtCtr = (n) => (Number(n || 0)).toFixed(2) + '%';
const fmtRoas = (n) => n != null ? Number(n).toFixed(2) + 'x' : '—';

export default function MetaAds() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data: rows }) => {
      if (rows) setClients(rows);
    });
  }, []);

  const fetchStats = async (clientId) => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    setErrorStatus(null);
    setData(null);
    try {
      const { data: res } = await axios.post(`${API_BASE}/meta/ad-stats`, { client_id: clientId });
      setData(res);
    } catch (e) {
      setErrorStatus(e.response?.status ?? null);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (id) => {
    setSelectedClient(id);
    fetchStats(id);
  };

  const maxAdSpend = data ? Math.max(...(data.topAds || []).map(a => a.spend), 1) : 1;

  const roasColor = (r) => {
    if (r == null) return '#8896a8';
    if (r >= 4) return '#10b981';
    if (r >= 2) return '#c9a84c';
    return '#dc2626';
  };

  const roasBadge = (r) => {
    if (r == null) return <span className="badge-yellow">—</span>;
    if (r >= 4) return <span className="badge-green">{fmtRoas(r)}</span>;
    if (r >= 2) return <span className="badge-gold">{fmtRoas(r)}</span>;
    return <span className="badge-red">{fmtRoas(r)}</span>;
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div className="section-label">Meta MCP</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Ad Performance — Last 30 Days</div>
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
          <i className="ti ti-brand-meta" style={{ fontSize: '36px', color: '#e4e9f0', display: 'block', marginBottom: '12px' }} />
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Select a client to load Meta Ads data</div>
          <div style={{ fontSize: '11px', color: '#8896a8' }}>Spend, impressions, clicks, CTR, and ROAS pulled live from Meta Marketing API.</div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Fetching live ad data from Meta...</div>
        </div>
      )}

      {/* ERROR — credentials missing (400) */}
      {error && !loading && errorStatus === 400 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <i className="ti ti-settings" style={{ fontSize: '32px', color: '#c9a84c', display: 'block', marginBottom: '12px' }} />
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '8px' }}>Meta credentials not configured</div>
          <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '16px', lineHeight: '1.7' }}>
            This client doesn't have a Meta Access Token or Ad Account ID set up yet.
          </div>
          <div style={{ display: 'inline-block', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 16px', fontSize: '11px', color: '#92400e', lineHeight: '1.6' }}>
            Go to <strong>Settings → Email Domains</strong>, find this client, and enter their
            <strong> Meta Access Token</strong> and <strong>Meta Ad Account ID</strong>.
          </div>
        </div>
      )}

      {/* ERROR — invalid token (401) */}
      {error && !loading && errorStatus === 401 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <i className="ti ti-alert-circle" style={{ fontSize: '28px', color: '#dc2626', display: 'block', marginBottom: '10px' }} />
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '6px' }}>Invalid or expired Meta access token</div>
          <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '12px' }}>{error}</div>
          <div style={{ fontSize: '11px', color: '#c9a84c' }}>
            Go to <strong>Settings → Email Domains</strong> and update this client's Meta Access Token.
          </div>
        </div>
      )}

      {/* ERROR — generic */}
      {error && !loading && errorStatus !== 400 && errorStatus !== 401 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <i className="ti ti-alert-circle" style={{ fontSize: '28px', color: '#dc2626', display: 'block', marginBottom: '10px' }} />
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>Could not load Meta data</div>
          <div style={{ fontSize: '11px', color: '#8896a8' }}>{error}</div>
        </div>
      )}

      {/* DATA */}
      {data && !loading && (
        <>
          {/* Connected badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <i className="ti ti-brand-meta" style={{ fontSize: '18px', color: '#3b82f6' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>Meta Ads</span>
            <span style={{ fontSize: '9px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '2px 10px', fontWeight: 700 }}>● CONNECTED</span>
            <span style={{ fontSize: '10px', color: '#8896a8', marginLeft: 'auto' }}>Last 30 days</span>
          </div>

          {/* STAT CARDS */}
          <div className="stats-row" style={{ marginBottom: '16px' }}>
            <div className="stat-card navy-top">
              <div className="stat-label">Total Spend</div>
              <div className="stat-value">{fmtMoney(data.spend)}</div>
              <div className="stat-sub">last 30 days</div>
            </div>
            <div className="stat-card blue-top">
              <div className="stat-label">Impressions</div>
              <div className="stat-value">{fmtNum(data.impressions)}</div>
              <div className="stat-sub-blue">{fmtNum(data.clicks)} clicks</div>
            </div>
            <div className="stat-card gold-top">
              <div className="stat-label">CTR</div>
              <div className="stat-value">{fmtCtr(data.ctr)}</div>
              <div className="stat-sub-gold">click-through rate</div>
            </div>
            <div className="stat-card green-top">
              <div className="stat-label">ROAS</div>
              <div className="stat-value" style={{ color: roasColor(data.roas) }}>{fmtRoas(data.roas)}</div>
              <div className="stat-sub-green">purchase ROAS</div>
            </div>
          </div>

          {/* ROAS BENCHMARK + SPEND EFFICIENCY */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

            {/* ROAS BENCHMARK */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>ROAS vs Benchmark</div>
              {[
                { label: 'Your ROAS', value: data.roas, color: roasColor(data.roas) },
                { label: 'Break-even (1.0x)', value: 1, color: '#8896a8' },
                { label: 'Good (2.5x)', value: 2.5, color: '#c9a84c' },
                { label: 'Strong (4.0x)', value: 4, color: '#10b981' },
              ].map((item, i) => {
                const maxScale = Math.max(data.roas ?? 0, 4, 1) * 1.1;
                const pct = Math.min((item.value / maxScale) * 100, 100);
                return (
                  <div key={i} style={{ marginBottom: i < 3 ? '12px' : '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <div style={{ fontSize: '11px', color: '#4a5568', fontWeight: i === 0 ? 600 : 400 }}>{item.label}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: item.color, fontFamily: 'DM Mono, monospace' }}>{item.value != null ? `${Number(item.value).toFixed(2)}x` : '—'}</div>
                    </div>
                    <div className="pbar">
                      <div style={{ height: '100%', borderRadius: '3px', background: item.color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SPEND BREAKDOWN */}
            <div className="card">
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Spend Efficiency</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  {
                    label: 'Cost Per Click',
                    value: data.clicks > 0 ? fmtMoney(data.spend / data.clicks) : '—',
                    icon: 'ti-click',
                    color: '#3b82f6',
                    sub: `${fmtNum(data.clicks)} total clicks`,
                  },
                  {
                    label: 'CPM',
                    value: data.impressions > 0 ? fmtMoney((data.spend / data.impressions) * 1000) : '—',
                    icon: 'ti-eye',
                    color: '#c9a84c',
                    sub: `per 1,000 impressions`,
                  },
                  {
                    label: 'Total Spend',
                    value: fmtMoney(data.spend),
                    icon: 'ti-currency-dollar',
                    color: '#0a1628',
                    sub: 'across all campaigns',
                  },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: `${item.color}14`, border: `1px solid ${item.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={`ti ${item.icon}`} style={{ fontSize: '15px', color: item.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10px', color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{item.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#0a1628', fontFamily: 'DM Mono, monospace', lineHeight: 1.3 }}>{item.value}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8' }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TOP ADS TABLE */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', textTransform: 'uppercase', letterSpacing: '1px' }}>Top Ads by Spend</div>
              <div style={{ fontSize: '10px', color: '#8896a8' }}>Last 30 days · sorted by spend</div>
            </div>

            {data.topAds && data.topAds.length > 0 ? (
              <div>
                <div className="table-header">
                  <div className="th" style={{ flex: 3 }}>Ad Name</div>
                  <div className="th" style={{ flex: '0 0 100px', textAlign: 'right' }}>Spend</div>
                  <div className="th" style={{ flex: '0 0 90px', textAlign: 'right' }}>Impressions</div>
                  <div className="th" style={{ flex: '0 0 70px', textAlign: 'right' }}>Clicks</div>
                  <div className="th" style={{ flex: '0 0 65px', textAlign: 'right' }}>CTR</div>
                  <div className="th" style={{ flex: '0 0 75px', textAlign: 'center' }}>ROAS</div>
                </div>
                {data.topAds.map((ad, i) => {
                  const spendPct = maxAdSpend > 0 ? Math.round((ad.spend / maxAdSpend) * 100) : 0;
                  return (
                    <div key={ad.id || i} className="table-row">
                      <div className="td" style={{ flex: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: i === 0 ? 'rgba(201,168,76,0.12)' : '#f8fafc', border: `1px solid ${i === 0 ? 'rgba(201,168,76,0.3)' : '#e4e9f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: i === 0 ? '#c9a84c' : '#8896a8', flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#0a1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.name}</div>
                            <div style={{ marginTop: '4px' }}>
                              <div className="pbar" style={{ height: '3px' }}>
                                <div style={{ height: '100%', borderRadius: '3px', background: '#3b82f6', width: `${spendPct}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="td" style={{ flex: '0 0 100px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>
                        {fmtMoney(ad.spend)}
                      </div>
                      <div className="td" style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '11px', color: '#4a5568' }}>
                        {fmtNum(ad.impressions)}
                      </div>
                      <div className="td" style={{ flex: '0 0 70px', textAlign: 'right', fontSize: '11px', color: '#4a5568' }}>
                        {fmtNum(ad.clicks)}
                      </div>
                      <div className="td" style={{ flex: '0 0 65px', textAlign: 'right', fontSize: '11px', color: '#4a5568' }}>
                        {fmtCtr(ad.ctr)}
                      </div>
                      <div className="td" style={{ flex: '0 0 75px', textAlign: 'center' }}>
                        {roasBadge(ad.roas)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', fontSize: '11px', color: '#8896a8' }}>
                No ad-level data available for this account
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
