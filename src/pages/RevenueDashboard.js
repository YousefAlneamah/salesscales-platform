import React, { useState, useEffect } from 'react';

const fmt = (n) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
const pct = (n) => `${n}%`;

const CHANNEL_META = {
  Email:     { icon: 'ti-mail',         color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  Sms:       { icon: 'ti-message',      color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  Whatsapp:  { icon: 'ti-brand-whatsapp', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  Voice:     { icon: 'ti-phone',        color: '#c9a84c', bg: '#fffbeb', border: '#fde68a' },
};

function MiniBar({ value, max, color = '#c9a84c' }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="pbar" style={{ height: '5px', marginTop: '6px' }}>
      <div className="pfill" style={{ width: `${w}%`, background: color, borderRadius: '3px' }} />
    </div>
  );
}

function ConvBadge({ rate }) {
  if (rate >= 40) return <span className="badge-green">{rate}%</span>;
  if (rate >= 20) return <span className="badge-gold">{rate}%</span>;
  if (rate >= 5)  return <span className="badge-blue">{rate}%</span>;
  return <span className="badge-yellow">{rate}%</span>;
}

export default function RevenueDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/revenue/dashboard');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const formatTime = (d) => d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="ti ti-chart-bar" style={{ fontSize: '32px', color: '#c9a84c', display: 'block', marginBottom: '12px' }} aria-hidden="true" />
          <div style={{ fontSize: '13px', color: '#8896a8' }}>Loading revenue data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: '32px', color: '#dc2626', display: 'block', marginBottom: '12px' }} aria-hidden="true" />
        <div style={{ fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>{error}</div>
        <button onClick={fetchStats} className="btn btn-navy" style={{ fontSize: '12px', padding: '9px 20px' }}>Retry</button>
      </div>
    );
  }

  const { thisMonth, byChannel, byTrigger, topSequences, byClient, maxRevenue } = stats;
  const maxChannelSent = Math.max(...(byChannel || []).map(c => c.sent), 1);
  const maxTriggerEnrolled = Math.max(...(byTrigger || []).map(t => t.enrolled), 1);

  const heroStats = [
    {
      label: 'Revenue This Month',
      value: fmt(thisMonth.totalRevenue),
      sub: thisMonth.revenueChange != null
        ? `${thisMonth.revenueChange >= 0 ? '+' : ''}${thisMonth.revenueChange}% vs last month`
        : 'No prior month data',
      subClass: thisMonth.revenueChange >= 0 ? 'stat-sub-green' : 'stat-sub',
      accent: 'gold-top',
    },
    {
      label: 'Deals Closed',
      value: thisMonth.totalDeals,
      sub: 'Converted pipeline deals',
      subClass: 'stat-sub-gold',
      accent: 'gold-top',
    },
    {
      label: 'Sequences Completed',
      value: thisMonth.completedEnrollments,
      sub: `of ${thisMonth.totalEnrollments} enrollments this month`,
      subClass: 'stat-sub-blue',
      accent: 'blue-top',
    },
    {
      label: 'Avg Conversion Rate',
      value: pct(thisMonth.conversionRate),
      sub: 'Across all sequences',
      subClass: 'stat-sub-green',
      accent: 'green-top',
    },
  ];

  return (
    <div>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '22px 24px', marginBottom: '24px', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-currency-dollar" style={{ fontSize: '20px', color: '#c9a84c' }} aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>Revenue Dashboard</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
              Cart recovery · Sequences · Pipeline · All channels
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefresh && (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
              Updated {formatTime(lastRefresh)}
            </div>
          )}
          <button onClick={fetchStats} style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '8px', padding: '8px 16px', fontSize: '11px', color: '#c9a84c', cursor: 'pointer', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
            <i className="ti ti-refresh" style={{ marginRight: '5px', fontSize: '12px' }} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {/* HERO STATS */}
      <div className="stats-row" style={{ marginBottom: '20px' }}>
        {heroStats.map(s => (
          <div key={s.label} className={`stat-card ${s.accent}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={s.subClass}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* BY CHANNEL + BY TRIGGER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* REVENUE BY CHANNEL */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0a1628' }}>Revenue by Channel</div>
            <div style={{ fontSize: '10px', color: '#8896a8' }}>Outbound messages · this month</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(byChannel || []).map(ch => {
              const key = ch.channel;
              const meta = CHANNEL_META[key] || CHANNEL_META.Email;
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: meta.bg, border: `1px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`ti ${meta.icon}`} style={{ fontSize: '14px', color: meta.color }} aria-hidden="true" />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{key}</div>
                        <div style={{ fontSize: '10px', color: '#8896a8' }}>{ch.sent} messages sent</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{fmt(ch.revenue)}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8' }}>
                        {thisMonth.totalRevenue > 0 ? Math.round((ch.revenue / thisMonth.totalRevenue) * 100) : 0}% of total
                      </div>
                    </div>
                  </div>
                  <MiniBar value={ch.sent} max={maxChannelSent} color={meta.color} />
                </div>
              );
            })}
            {(byChannel || []).every(c => c.sent === 0) && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#8896a8', fontSize: '12px' }}>
                No outbound messages sent this month yet
              </div>
            )}
          </div>
        </div>

        {/* REVENUE BY SEQUENCE TYPE */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0a1628' }}>By Sequence Type</div>
            <div style={{ fontSize: '10px', color: '#8896a8' }}>All-time enrollments</div>
          </div>
          {(byTrigger || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8896a8', fontSize: '12px' }}>
              No workflow enrollments yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(byTrigger || []).map(t => (
                <div key={t.trigger}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#0a1628', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>
                      {t.trigger}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '10px', color: '#8896a8' }}>{t.completed}/{t.enrolled}</span>
                      <ConvBadge rate={t.conversionRate} />
                    </div>
                  </div>
                  <MiniBar value={t.enrolled} max={maxTriggerEnrolled} color="#c9a84c" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TOP PERFORMING SEQUENCES */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#0a1628' }}>Top Performing Sequences</div>
          <div style={{ fontSize: '10px', color: '#8896a8' }}>Ranked by conversion rate</div>
        </div>
        {(topSequences || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#8896a8' }}>
            <i className="ti ti-bolt" style={{ fontSize: '30px', display: 'block', marginBottom: '10px' }} aria-hidden="true" />
            <div style={{ fontSize: '13px' }}>No sequence data yet. Enroll contacts in workflows to see performance.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-header">
              <div className="th" style={{ flex: 2 }}>Sequence</div>
              <div className="th" style={{ flex: '0 0 130px' }}>Trigger</div>
              <div className="th" style={{ flex: '0 0 130px' }}>Client</div>
              <div className="th" style={{ flex: '0 0 80px', textAlign: 'right' }}>Enrolled</div>
              <div className="th" style={{ flex: '0 0 90px', textAlign: 'right' }}>Completed</div>
              <div className="th" style={{ flex: '0 0 100px', textAlign: 'center' }}>Conv. Rate</div>
            </div>
            {(topSequences || []).map((seq, i) => (
              <div key={seq.id} className="table-row">
                <div className="td" style={{ flex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: i < 3 ? 'rgba(201,168,76,0.12)' : '#f8fafc', border: `1px solid ${i < 3 ? 'rgba(201,168,76,0.3)' : '#e4e9f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: i < 3 ? '#c9a84c' : '#8896a8', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{seq.name}</div>
                  </div>
                </div>
                <div className="td" style={{ flex: '0 0 130px' }}>
                  <span style={{ fontSize: '10px', color: '#8896a8' }}>{seq.trigger}</span>
                </div>
                <div className="td" style={{ flex: '0 0 130px', fontSize: '12px', color: '#0a1628' }}>{seq.clientName}</div>
                <div className="td" style={{ flex: '0 0 80px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: '#0a1628' }}>{seq.enrolled}</div>
                <div className="td" style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>{seq.completed}</div>
                <div className="td" style={{ flex: '0 0 100px', textAlign: 'center' }}>
                  <ConvBadge rate={seq.conversionRate} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PER CLIENT REVENUE BREAKDOWN */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#0a1628' }}>Per Client Revenue Breakdown</div>
          <div style={{ fontSize: '10px', color: '#8896a8' }}>Converted pipeline deals · all-time</div>
        </div>
        {(byClient || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#8896a8', fontSize: '12px' }}>No clients found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(byClient || []).map((c, i) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 80px 90px', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {c.name ? c.name[0].toUpperCase() : '?'}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628' }}>{fmt(c.revenue)}</span>
                    <span style={{ fontSize: '10px', color: '#8896a8' }}>{maxRevenue > 0 ? Math.round((c.revenue / maxRevenue) * 100) : 0}%</span>
                  </div>
                  <div className="pbar">
                    <div className="pfill" style={{ width: maxRevenue > 0 ? `${Math.round((c.revenue / maxRevenue) * 100)}%` : '0%' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{c.deals}</div>
                  <div style={{ fontSize: '9px', color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>deals</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{c.enrolled}</div>
                  <div style={{ fontSize: '9px', color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>enrolled</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <ConvBadge rate={c.conversionRate} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
