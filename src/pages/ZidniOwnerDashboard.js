import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pools',    label: 'Pools' },
  { id: 'clients',  label: 'Clients' },
  { id: 'revenue',  label: 'Revenue' },
  { id: 'payouts',  label: 'Payouts' },
  { id: 'waitlist', label: 'Waitlist' },
];

const STREAMS = [
  { key: 'etsy',      label: 'Etsy' },
  { key: 'gumroad',   label: 'Gumroad' },
  { key: 'kdp',       label: 'KDP' },
  { key: 'pinterest', label: 'Pinterest' },
  { key: 'affiliate', label: 'Affiliate' },
  { key: 'shopify',   label: 'Shopify' },
];

const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const curMonth = () => new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

function ownerH() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } };
}

export default function ZidniOwnerDashboard() {
  const [activeTab,  setActiveTab]  = useState('overview');
  const [loading,    setLoading]    = useState(true);
  const [stats,      setStats]      = useState(null);
  const [pools,      setPools]      = useState([]);
  const [clients,    setClients]    = useState([]);
  const [payouts,    setPayouts]    = useState([]);
  const [waitlist,   setWaitlist]   = useState([]);

  // New pool form
  const [showNewPool,  setShowNewPool]  = useState(false);
  const [newPool,      setNewPool]      = useState({ niche: '', name: '', max_spots: 100 });
  const [poolSaving,   setPoolSaving]   = useState(false);

  // Revenue form
  const emptyRev = { pool_id: '', month: curMonth(), etsy: '', gumroad: '', kdp: '', pinterest: '', affiliate: '', shopify: '' };
  const [revForm,   setRevForm]   = useState(emptyRev);
  const [revSaving, setRevSaving] = useState(false);
  const [revResult, setRevResult] = useState(null);
  const [revError,  setRevError]  = useState('');

  // Clients search
  const [clientSearch, setClientSearch] = useState('');

  // Approving payout
  const [approvingId, setApprovingId] = useState(null);

  // ── Auth + load ──────────────────────────────────────────
  useEffect(() => {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { window.location.href = '/'; return; }
    try {
      const u = JSON.parse(userStr);
      if (u.role !== 'owner') { window.location.href = '/'; return; }
    } catch { window.location.href = '/'; return; }

    Promise.all([
      axios.get('http://localhost:3001/zidni/owner/stats',    ownerH()),
      axios.get('http://localhost:3001/zidni/owner/pools',    ownerH()),
      axios.get('http://localhost:3001/zidni/owner/clients',  ownerH()),
      axios.get('http://localhost:3001/zidni/owner/payouts',  ownerH()),
      axios.get('http://localhost:3001/zidni/owner/waitlist', ownerH()),
    ])
      .then(([sR, pR, cR, pyR, wR]) => {
        setStats(sR.data);
        setPools(pR.data.pools || []);
        setClients(cR.data.clients || []);
        setPayouts(pyR.data.payouts || []);
        setWaitlist(wR.data.waitlist || []);
      })
      .catch(err => { if (err.response?.status === 401 || err.response?.status === 403) window.location.href = '/'; })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────
  const createPool = async () => {
    if (!newPool.niche || !newPool.name) return;
    setPoolSaving(true);
    try {
      const { data } = await axios.post('http://localhost:3001/zidni/owner/pools', newPool, ownerH());
      setPools(prev => [data.pool, ...prev]);
      setStats(prev => prev ? { ...prev, totalPools: (prev.totalPools || 0) + 1 } : prev);
      setNewPool({ niche: '', name: '', max_spots: 100 });
      setShowNewPool(false);
    } catch (_) {}
    setPoolSaving(false);
  };

  const submitRevenue = async (e) => {
    e.preventDefault();
    if (!revForm.pool_id || !revForm.month) return;
    setRevSaving(true);
    setRevError('');
    setRevResult(null);
    try {
      const { data } = await axios.post('http://localhost:3001/zidni/owner/revenue', revForm, ownerH());
      setRevResult(data);
      setPools(prev => prev.map(p => p.id === revForm.pool_id ? { ...p, monthly_revenue: data.poolTotal } : p));
    } catch (err) {
      setRevError(err.response?.data?.error || 'Failed to post revenue.');
    }
    setRevSaving(false);
  };

  const approvePayout = async (id) => {
    setApprovingId(id);
    try {
      await axios.post(`http://localhost:3001/zidni/owner/payouts/${id}/approve`, {}, ownerH());
      setPayouts(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', processed_at: new Date().toISOString() } : p));
      setStats(prev => prev ? { ...prev, pendingPayouts: Math.max(0, (prev.pendingPayouts || 0) - 1) } : prev);
    } catch (_) {}
    setApprovingId(null);
  };

  const setRev = (k, v) => setRevForm(f => ({ ...f, [k]: v }));
  const revTotal = STREAMS.reduce((s, st) => s + (parseFloat(revForm[st.key]) || 0), 0);

  const filteredClients = clients.filter(c =>
    !clientSearch ||
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.niche?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#8896a8', fontSize: 14 }}>Loading Zidni Owner Dashboard…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', fontFamily: "'Inter',sans-serif", color: '#f0f4f8' }}>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '0 24px', background: '#050d1a', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#050d1a', fontWeight: 800, fontSize: 13 }}>Z</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>Zidni</span>
            <span style={{ fontSize: 12, color: '#4a5568', marginLeft: 4 }}>Owner Dashboard</span>
          </div>
          <a href="/" style={{ fontSize: 12, fontWeight: 600, color: '#8896a8', textDecoration: 'none', padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
            ← Sales Scales
          </a>
        </div>
      </nav>

      {/* ── TABS ── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', background: '#050d1a' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? '#c9a84c' : '#8896a8',
                borderBottom: activeTab === t.id ? '2px solid #c9a84c' : '2px solid transparent',
                whiteSpace: 'nowrap', transition: 'color 0.15s',
              }}
            >
              {t.label}
              {t.id === 'payouts' && (stats?.pendingPayouts > 0) && (
                <span style={{ marginLeft: 6, background: '#c9a84c', color: '#050d1a', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>{stats.pendingPayouts}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === 'overview' && (
          <div>
            <SectionHead title="Overview" sub="Platform-wide summary" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 32 }}>
              <OStatCard label="Total Clients"   value={stats?.totalClients || 0} />
              <OStatCard label="Monthly Revenue" value={fmtMoney(stats?.mrr)}     gold />
              <OStatCard label="Active Pools"    value={stats?.totalPools || 0} />
              <OStatCard label="Pending Payouts" value={stats?.pendingPayouts || 0} warn={stats?.pendingPayouts > 0} />
              <OStatCard label="Waitlist"        value={stats?.waitlistCount || 0} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
              <OCard title="Clients by Tier">
                <div style={{ display: 'flex', gap: 24, padding: '8px 0' }}>
                  {[['Starter', stats?.byTier?.starter || 0, '$100/mo'], ['Elite', stats?.byTier?.elite || 0, '$200/mo']].map(([label, count, price]) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center', padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#c9a84c', marginBottom: 4 }}>{count}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, color: '#8896a8' }}>{price}</div>
                    </div>
                  ))}
                </div>
              </OCard>
              <OCard title="MRR Breakdown">
                <div style={{ padding: '8px 0' }}>
                  {[['Starter', (stats?.byTier?.starter || 0) * 100], ['Elite', (stats?.byTier?.elite || 0) * 200]].map(([label, rev]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 14, color: '#8896a8' }}>{label} subscriptions</span>
                      <span style={{ fontWeight: 700, color: '#c9a84c' }}>{fmtMoney(rev)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0' }}>
                    <span style={{ fontWeight: 700 }}>Total MRR</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#c9a84c' }}>{fmtMoney(stats?.mrr)}</span>
                  </div>
                </div>
              </OCard>
            </div>
          </div>
        )}

        {/* ═══ POOLS ═══ */}
        {activeTab === 'pools' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <SectionHead title="Pools" sub="Manage income pool groups" noMargin />
              <button onClick={() => setShowNewPool(v => !v)} style={goldBtn}>{showNewPool ? 'Cancel' : '+ New Pool'}</button>
            </div>

            {showNewPool && (
              <div style={{ background: '#0a1628', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Create New Pool</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
                  <OField label="Pool Name">
                    <input style={inputSt} placeholder="e.g. Personal Finance Alpha" value={newPool.name} onChange={e => setNewPool(p => ({ ...p, name: e.target.value }))} />
                  </OField>
                  <OField label="Niche">
                    <select style={inputSt} value={newPool.niche} onChange={e => setNewPool(p => ({ ...p, niche: e.target.value }))}>
                      <option value="">Select niche…</option>
                      <option>Personal Finance</option>
                      <option>AI Tools</option>
                    </select>
                  </OField>
                  <OField label="Max Spots">
                    <input style={inputSt} type="number" min="1" value={newPool.max_spots} onChange={e => setNewPool(p => ({ ...p, max_spots: parseInt(e.target.value) || 100 }))} />
                  </OField>
                </div>
                <button onClick={createPool} disabled={poolSaving || !newPool.niche || !newPool.name} style={goldBtn}>
                  {poolSaving ? 'Saving…' : 'Create Pool'}
                </button>
              </div>
            )}

            <OTable headers={['Pool Name', 'Niche', 'Status', 'Spots', 'Monthly Revenue', 'Created']}>
              {pools.length === 0 ? (
                <tr><td colSpan={6} style={emptyTd}>No pools yet. Create your first pool above.</td></tr>
              ) : pools.map(p => (
                <tr key={p.id} style={trStyle}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{p.name}</span></td>
                  <td style={tdStyle}>{p.niche}</td>
                  <td style={tdStyle}><StatusBadge status={p.status} /></td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{p.current_spots} / {p.max_spots}</span>
                      <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ height: '100%', background: '#c9a84c', borderRadius: 2, width: `${Math.min(100, (p.current_spots / p.max_spots) * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: '#c9a84c', fontWeight: 700 }}>{fmtMoney(p.monthly_revenue)}</td>
                  <td style={{ ...tdStyle, color: '#4a5568' }}>{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </OTable>
          </div>
        )}

        {/* ═══ CLIENTS ═══ */}
        {activeTab === 'clients' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <SectionHead title={`Clients (${clients.length})`} sub="All registered members" noMargin />
              <input
                style={{ ...inputSt, width: 240, fontSize: 13 }}
                placeholder="Search name, email, niche…"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
            </div>
            <OTable headers={['Name', 'Email', 'Tier', 'Niche', 'Status', 'Country', 'Joined']}>
              {filteredClients.length === 0 ? (
                <tr><td colSpan={7} style={emptyTd}>{clientSearch ? 'No clients match your search.' : 'No clients yet.'}</td></tr>
              ) : filteredClients.map(c => (
                <tr key={c.id} style={trStyle}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{c.name || '—'}</span></td>
                  <td style={{ ...tdStyle, color: '#8896a8' }}>{c.email}</td>
                  <td style={tdStyle}>
                    <span style={{ background: c.tier === 'elite' ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${c.tier === 'elite' ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, color: c.tier === 'elite' ? '#c9a84c' : '#8896a8', textTransform: 'capitalize' }}>
                      {c.tier}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#8896a8' }}>{c.niche || '—'}</td>
                  <td style={tdStyle}><StatusBadge status={c.status || 'active'} /></td>
                  <td style={{ ...tdStyle, color: '#8896a8' }}>{c.country || '—'}</td>
                  <td style={{ ...tdStyle, color: '#4a5568' }}>{fmtDate(c.joined_at)}</td>
                </tr>
              ))}
            </OTable>
          </div>
        )}

        {/* ═══ REVENUE ═══ */}
        {activeTab === 'revenue' && (
          <div style={{ maxWidth: 720 }}>
            <SectionHead title="Enter Pool Revenue" sub="Post monthly revenue — earnings auto-distribute to all clients in the pool" />

            <form onSubmit={submitRevenue} style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 28, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <OField label="Pool" required>
                  <select style={inputSt} value={revForm.pool_id} onChange={e => setRev('pool_id', e.target.value)} required>
                    <option value="">Select pool…</option>
                    {pools.map(p => <option key={p.id} value={p.id}>{p.name} ({p.niche})</option>)}
                  </select>
                </OField>
                <OField label="Month" required>
                  <input style={inputSt} placeholder="e.g. June 2026" value={revForm.month} onChange={e => setRev('month', e.target.value)} required />
                </OField>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Revenue by Stream</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
                {STREAMS.map(s => (
                  <OField key={s.key} label={s.label}>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4a5568', fontSize: 14 }}>$</span>
                      <input style={{ ...inputSt, paddingLeft: 24 }} type="number" min="0" step="0.01" placeholder="0.00" value={revForm[s.key]} onChange={e => setRev(s.key, e.target.value)} />
                    </div>
                  </OField>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 10, marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#8896a8' }}>Pool Total This Month</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#c9a84c' }}>{fmtMoney(revTotal)}</span>
              </div>

              {revError && <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{revError}</div>}

              <button type="submit" disabled={revSaving || !revForm.pool_id || !revForm.month || revTotal === 0} style={{ ...goldBtn, width: '100%', padding: '14px' }}>
                {revSaving ? 'Distributing…' : `Post Revenue & Distribute ${fmtMoney(revTotal)} to Clients`}
              </button>
            </form>

            {revResult && (
              <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>✓ Revenue posted for {revResult.month}</div>
                <div style={{ fontSize: 13, color: '#8896a8', marginBottom: 16 }}>Pool total: {fmtMoney(revResult.poolTotal)} · {revResult.distributions?.length || 0} clients notified</div>
                {revResult.distributions?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {revResult.distributions.map(d => (
                      <div key={d.client_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                        <span style={{ color: '#8896a8' }}>{d.name || d.client_id}</span>
                        <span style={{ fontWeight: 700, color: '#10b981' }}>+{fmtMoney(d.pool_share)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ PAYOUTS ═══ */}
        {activeTab === 'payouts' && (
          <div>
            <SectionHead title="Payout Requests" sub="Review and approve client payout requests" />
            <OTable headers={['Client', 'Email', 'Amount', 'Month', 'Method', 'Requested', 'Status', '']}>
              {payouts.length === 0 ? (
                <tr><td colSpan={8} style={emptyTd}>No payout requests yet.</td></tr>
              ) : payouts.map(p => (
                <tr key={p.id} style={trStyle}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{p.zidni_clients?.name || '—'}</span></td>
                  <td style={{ ...tdStyle, color: '#8896a8' }}>{p.zidni_clients?.email || '—'}</td>
                  <td style={{ ...tdStyle, color: '#c9a84c', fontWeight: 700 }}>{fmtMoney(p.amount)}</td>
                  <td style={{ ...tdStyle, color: '#8896a8' }}>{p.month}</td>
                  <td style={{ ...tdStyle, color: '#8896a8', textTransform: 'capitalize' }}>{p.zidni_clients?.payout_method || 'paypal'}</td>
                  <td style={{ ...tdStyle, color: '#4a5568' }}>{fmtDate(p.created_at)}</td>
                  <td style={tdStyle}><StatusBadge status={p.status} /></td>
                  <td style={tdStyle}>
                    {p.status === 'pending' && (
                      <button
                        onClick={() => approvePayout(p.id)}
                        disabled={approvingId === p.id}
                        style={{ padding: '5px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#10b981', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {approvingId === p.id ? '…' : 'Approve'}
                      </button>
                    )}
                    {p.status === 'completed' && <span style={{ fontSize: 12, color: '#4a5568' }}>{fmtDate(p.processed_at)}</span>}
                  </td>
                </tr>
              ))}
            </OTable>
          </div>
        )}

        {/* ═══ WAITLIST ═══ */}
        {activeTab === 'waitlist' && (
          <div>
            <SectionHead title={`Waitlist (${waitlist.length})`} sub="People who applied to join Zidni" />
            <OTable headers={['Name', 'Email', 'WhatsApp', 'Country', 'Niche', 'Applied']}>
              {waitlist.length === 0 ? (
                <tr><td colSpan={6} style={emptyTd}>No waitlist signups yet.</td></tr>
              ) : waitlist.map(w => (
                <tr key={w.id} style={trStyle}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{w.name || '—'}</span></td>
                  <td style={{ ...tdStyle, color: '#8896a8' }}>{w.email}</td>
                  <td style={{ ...tdStyle, color: '#8896a8' }}>{w.whatsapp || '—'}</td>
                  <td style={{ ...tdStyle, color: '#8896a8' }}>{w.country || '—'}</td>
                  <td style={tdStyle}>
                    {w.niche && <span style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#c9a84c' }}>{w.niche}</span>}
                  </td>
                  <td style={{ ...tdStyle, color: '#4a5568' }}>{fmtDate(w.created_at)}</td>
                </tr>
              ))}
            </OTable>
          </div>
        )}

      </main>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────

function SectionHead({ title, sub, noMargin }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', margin: '0 0 4px' }}>{title}</h2>
      {sub && <p style={{ fontSize: 13, color: '#8896a8', margin: 0 }}>{sub}</p>}
    </div>
  );
}

function OStatCard({ label, value, gold, warn }) {
  return (
    <div style={{ background: '#0a1628', border: `1px solid ${gold ? 'rgba(201,168,76,0.25)' : warn ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      {gold && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#c9a84c,#e8c96a)' }} />}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: gold ? '#c9a84c' : warn ? '#ef4444' : '#f0f4f8', letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}

function OCard({ title, children }) {
  return (
    <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function OTable({ headers, children }) {
  return (
    <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function OField({ label, required, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8896a8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 7 }}>
        {label}{required && <span style={{ color: '#c9a84c', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active:    { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  color: '#10b981' },
    building:  { bg: 'rgba(201,168,76,0.1)',  border: 'rgba(201,168,76,0.3)',   color: '#c9a84c' },
    completed: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  color: '#10b981' },
    pending:   { bg: 'rgba(217,119,6,0.1)',   border: 'rgba(217,119,6,0.25)',   color: '#d97706' },
    inactive:  { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', color: '#4a5568' },
  };
  const s = map[status] || map.inactive;
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

const trStyle  = { borderTop: '1px solid rgba(255,255,255,0.04)' };
const tdStyle  = { padding: '13px 16px', verticalAlign: 'middle' };
const emptyTd  = { padding: '40px 16px', textAlign: 'center', color: '#4a5568', fontSize: 13 };
const inputSt  = { width: '100%', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', background: 'rgba(255,255,255,0.04)', color: '#f0f4f8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, outline: 'none' };
const goldBtn  = { padding: '9px 18px', background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', color: '#050d1a', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' };
