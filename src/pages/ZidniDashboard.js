import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PLATFORMS = [
  { key: 'personal_etsy',      id: 'etsy',      label: 'Etsy',      emoji: '🛍️' },
  { key: 'personal_gumroad',   id: 'gumroad',   label: 'Gumroad',   emoji: '📥' },
  { key: 'personal_kdp',       id: 'kdp',       label: 'KDP',       emoji: '📚' },
  { key: 'personal_affiliate', id: 'affiliate', label: 'Affiliate', emoji: '🔗' },
  { key: 'personal_shopify',   id: 'shopify',   label: 'Shopify',   emoji: '🏪' },
  { key: 'personal_redbubble', id: 'redbubble', label: 'Redbubble', emoji: '🎨' },
];

const fmt = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('zidni_token') || ''}` };
}

export default function ZidniDashboard() {
  const [loading, setLoading]               = useState(true);
  const [client, setClient]                 = useState(null);
  const [notifications, setNotifications]   = useState([]);
  const [earnings, setEarnings]             = useState([]);
  const [thisMonth, setThisMonth]           = useState(null);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pools, setPools]                   = useState([]);
  const [streams, setStreams]               = useState([]);
  const [payoutLoading, setPayoutLoading]   = useState(false);
  const [payoutMsg, setPayoutMsg]           = useState('');

  useEffect(() => {
    const token = localStorage.getItem('zidni_token');
    if (!token) { window.location.href = '/zidni/signup'; return; }

    Promise.all([
      axios.get('http://localhost:3001/zidni/client/me',      { headers: authHeaders() }),
      axios.get('http://localhost:3001/zidni/client/earnings', { headers: authHeaders() }),
      axios.get('http://localhost:3001/zidni/client/pools',    { headers: authHeaders() }),
      axios.get('http://localhost:3001/zidni/client/streams',  { headers: authHeaders() }),
    ])
      .then(([meRes, earningsRes, poolsRes, streamsRes]) => {
        setClient(meRes.data.client);
        setNotifications(meRes.data.notifications || []);
        setEarnings(earningsRes.data.earnings || []);
        setThisMonth(earningsRes.data.thisMonth || null);
        setAvailableBalance(earningsRes.data.availableBalance || 0);
        setPools(poolsRes.data.pools || []);
        setStreams(streamsRes.data.streams || []);
      })
      .catch(err => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('zidni_token');
          localStorage.removeItem('zidni_client');
          window.location.href = '/zidni/signup';
        }
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestPayout = async () => {
    setPayoutLoading(true);
    setPayoutMsg('');
    try {
      await axios.post('http://localhost:3001/zidni/client/request-payout', {}, { headers: authHeaders() });
      setPayoutMsg('success');
    } catch (err) {
      setPayoutMsg(err.response?.data?.error || 'Request failed. Try again.');
    }
    setPayoutLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('zidni_token');
    localStorage.removeItem('zidni_client');
    window.location.href = '/zidni';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#8896a8', fontSize: 14 }}>Loading your dashboard…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  const unread = notifications.filter(n => !n.read).length;
  const streamsIncome = PLATFORMS.reduce((s, p) => s + (thisMonth?.[p.key] || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', fontFamily: "'Inter',sans-serif", color: '#f0f4f8' }}>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: '1px solid rgba(201,168,76,0.12)', padding: '0 24px', position: 'sticky', top: 0, background: '#050d1a', zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#c9a84c,#e8c96a)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#050d1a', fontWeight: 800, fontSize: 13 }}>Z</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>Zidni</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {unread > 0 && (
              <div style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#c9a84c' }}>
                {unread} new
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{client?.name || 'Client'}</div>
              <div style={{ fontSize: 11, color: '#8896a8', textTransform: 'capitalize' }}>{client?.tier} · {client?.niche}</div>
            </div>
            <button onClick={logout} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#8896a8', cursor: 'pointer', fontFamily: 'inherit' }}>
              Log out
            </button>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ── WELCOME ── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 8 }}>
            Welcome back, {client?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge gold>{client?.tier === 'elite' ? 'Elite' : 'Starter'}</Badge>
            <Badge>{client?.niche}</Badge>
            <Badge>{client?.status === 'active' ? '✓ Active' : client?.status}</Badge>
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard label="This Month Total" value={fmtShort(thisMonth?.total)} sub="all streams combined" />
          <StatCard label="Pool Share" value={fmtShort(thisMonth?.pool_share)} sub="from shared pool" />
          <StatCard label="Personal Streams" value={fmtShort(streamsIncome)} sub="your own platforms" />
          <StatCard label="Available Payout" value={fmtShort(availableBalance)} sub="ready to withdraw" gold />
        </div>

        {/* ── EARNINGS BREAKDOWN + HISTORY ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, marginBottom: 20 }}>

          {/* Stream breakdown */}
          <Section title="Earnings This Month" sub="by income stream">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {PLATFORMS.map(p => {
                const val = thisMonth?.[p.key] || 0;
                const stream = streams.find(s => s.platform === p.id);
                return (
                  <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{p.emoji}</div>
                    <div style={{ fontSize: 12, color: '#8896a8', fontWeight: 600, marginBottom: 3 }}>{p.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: val > 0 ? '#c9a84c' : '#4a5568' }}>{fmt(val)}</div>
                    {stream && (
                      <div style={{ fontSize: 10, marginTop: 4, color: stream.status === 'active' ? '#10b981' : '#d97706', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {stream.status}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!thisMonth && <EmptyState msg="Earnings data will appear once your first month completes." />}
          </Section>

          {/* Monthly history */}
          <Section title="Earnings History" sub="last 6 months">
            {earnings.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Month', 'Pool', 'Streams', 'Total'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Month' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((e, i) => (
                      <tr key={e.id} style={{ borderBottom: i < earnings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td style={{ padding: '10px 10px', fontWeight: 600, fontSize: 13 }}>{e.month}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#8896a8' }}>{fmtShort(e.pool_share)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', color: '#8896a8' }}>{fmtShort(PLATFORMS.reduce((s, p) => s + (e[p.key] || 0), 0))}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#c9a84c' }}>{fmtShort(e.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState msg="Your earnings history will appear here after your first month." />
            )}
          </Section>
        </div>

        {/* ── POOL STATUS + PERSONAL STREAMS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, marginBottom: 20 }}>

          {/* Pool status */}
          <Section title="Pool Status" sub="your income pool assignment">
            {pools.length > 0 ? pools.map(({ spot_id, spots, pool }) => (
              <div key={spot_id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{pool?.name || 'Unnamed Pool'}</div>
                    <div style={{ fontSize: 12, color: '#8896a8' }}>{pool?.niche}</div>
                  </div>
                  <span style={{ background: pool?.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(201,168,76,0.1)', border: `1px solid ${pool?.status === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(201,168,76,0.3)'}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: pool?.status === 'active' ? '#10b981' : '#c9a84c', textTransform: 'capitalize' }}>
                    {pool?.status || 'building'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    ['Your spots', spots],
                    ['Members', pool?.current_spots || 0],
                    ['Monthly rev', fmtShort(pool?.monthly_revenue)],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#c9a84c' }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8896a8', marginBottom: 6 }}>
                    <span>Pool capacity</span>
                    <span>{pool?.current_spots || 0} / {pool?.max_spots || 100} spots</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6 }}>
                    <div style={{ background: 'linear-gradient(90deg,#c9a84c,#e8c96a)', borderRadius: 4, height: '100%', width: `${Math.min(100, ((pool?.current_spots || 0) / (pool?.max_spots || 100)) * 100)}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            )) : (
              <EmptyState msg="Pool assignment in progress. You'll be notified once your pool is ready." icon="🏊" />
            )}
          </Section>

          {/* Personal streams */}
          <Section title="Personal Streams" sub="your platform accounts">
            {streams.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {streams.map(s => {
                  const p = PLATFORMS.find(pl => pl.id === s.platform) || { emoji: '📦', label: s.platform };
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{p.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{p.label}</div>
                        {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#8896a8', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{s.url}</a> : <span style={{ fontSize: 11, color: '#4a5568' }}>URL not set</span>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#c9a84c', marginBottom: 3 }}>{fmtShort(s.monthly_revenue)}/mo</div>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: s.status === 'active' ? '#10b981' : '#d97706' }}>{s.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState msg="Your 6 personal stream accounts are being set up. This takes 1–2 weeks." icon="⚙️" />
            )}
          </Section>
        </div>

        {/* ── PAYOUT + NOTIFICATIONS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>

          {/* Payout */}
          <Section title="Payout" sub="withdraw your earnings">
            <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Available Balance</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#c9a84c', letterSpacing: '-1px', marginBottom: 4 }}>{fmt(availableBalance)}</div>
              <div style={{ fontSize: 12, color: '#8896a8' }}>Payout method: {client?.payout_method || 'paypal'} {client?.payout_email ? `· ${client.payout_email}` : ''}</div>
            </div>

            {payoutMsg === 'success' ? (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#10b981', textAlign: 'center' }}>
                ✓ Payout requested! We'll process it within 3–5 business days.
              </div>
            ) : (
              <>
                {payoutMsg && (
                  <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 12 }}>
                    {payoutMsg}
                  </div>
                )}
                <button
                  onClick={requestPayout}
                  disabled={payoutLoading || availableBalance <= 0}
                  style={{ width: '100%', padding: '13px', background: availableBalance > 0 ? 'linear-gradient(135deg,#c9a84c,#e8c96a)' : 'rgba(201,168,76,0.2)', color: availableBalance > 0 ? '#050d1a' : 'rgba(201,168,76,0.5)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: availableBalance > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                >
                  {payoutLoading ? 'Requesting…' : availableBalance > 0 ? `Request Payout · ${fmt(availableBalance)}` : 'No balance available'}
                </button>
                {availableBalance <= 0 && <p style={{ fontSize: 12, color: '#4a5568', textAlign: 'center', marginTop: 10 }}>Your balance will grow as your income streams generate revenue.</p>}
              </>
            )}

            {client?.referral_code && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Your referral code</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#c9a84c', letterSpacing: '1px' }}>{client.referral_code}</div>
                <div style={{ fontSize: 12, color: '#8896a8', marginTop: 3 }}>Share to earn rewards when friends join.</div>
              </div>
            )}
          </Section>

          {/* Notifications */}
          <Section title={`Notifications${unread > 0 ? ` (${unread})` : ''}`} sub="recent updates from your account">
            {notifications.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div key={n.id} style={{ padding: '12px 14px', background: n.read ? 'rgba(255,255,255,0.01)' : 'rgba(201,168,76,0.04)', border: `1px solid ${n.read ? 'rgba(255,255,255,0.05)' : 'rgba(201,168,76,0.15)'}`, borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                      {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#c9a84c', flexShrink: 0, marginTop: 4 }} />}
                    </div>
                    <div style={{ fontSize: 12, color: '#8896a8', lineHeight: 1.5 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: '#4a5568', marginTop: 6 }}>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState msg="No notifications yet. We'll update you when your streams go live and when earnings are posted." icon="🔔" />
            )}
          </Section>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, gold }) {
  return (
    <div style={{ background: '#0a1628', border: `1px solid ${gold ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '20px 20px 16px', position: 'relative', overflow: 'hidden' }}>
      {gold && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#c9a84c,#e8c96a)' }} />}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: gold ? '#c9a84c' : '#f0f4f8', letterSpacing: '-0.5px', marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#4a5568' }}>{sub}</div>}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: '#8896a8', marginTop: 3 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Badge({ children, gold }) {
  return (
    <span style={{ display: 'inline-block', background: gold ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${gold ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, color: gold ? '#c9a84c' : '#8896a8', textTransform: 'capitalize' }}>
      {children}
    </span>
  );
}

function EmptyState({ msg, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
      {icon && <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>}
      <p style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.6, margin: 0 }}>{msg}</p>
    </div>
  );
}
