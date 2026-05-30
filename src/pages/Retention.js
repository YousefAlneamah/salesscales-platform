import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

export default function Retention() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkinState, setCheckinState] = useState({}); // { [clientId]: { loading, message } }

  useEffect(() => {
    axios.get(`${API_BASE}/retention/dashboard`)
      .then(r => setData(r.data))
      .catch(e => console.error('Retention load error:', e.message))
      .finally(() => setLoading(false));
  }, []);

  const generateCheckin = async (clientId) => {
    setCheckinState(prev => ({ ...prev, [clientId]: { loading: true, message: null } }));
    try {
      const res = await axios.post(`${API_BASE}/retention/checkin`, { client_id: clientId });
      setCheckinState(prev => ({ ...prev, [clientId]: { loading: false, message: res.data.message } }));
    } catch (e) {
      setCheckinState(prev => ({ ...prev, [clientId]: { loading: false, message: null, error: e.response?.data?.error || e.message } }));
    }
  };

  const dismissCheckin = (clientId) =>
    setCheckinState(prev => ({ ...prev, [clientId]: {} }));

  const healthBar = (score) => {
    const pct = Math.min(100, Math.max(0, score ?? 0));
    const color = pct < 50 ? '#dc2626' : pct < 80 ? '#d97706' : '#10b981';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '72px', height: '6px', background: '#f0f3f8', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 700, color, minWidth: '28px' }}>{score ?? '—'}</span>
      </div>
    );
  };

  const daysSince = (d) => {
    if (d === null || d === undefined) return '—';
    if (d === 0) return 'Today';
    if (d === 1) return '1 day';
    return `${d} days`;
  };

  const ClientRow = ({ client, isAtRisk }) => {
    const ci = checkinState[client.id] || {};
    return (
      <>
        <div className="table-row" style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr auto', borderLeft: isAtRisk && client.churn_risk ? '3px solid #dc2626' : '3px solid transparent' }}>
          <div className="td">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#0a1628' }}>{client.name}</div>
              {client.churn_risk && (
                <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700, whiteSpace: 'nowrap' }}>HIGH CHURN RISK</span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '2px', textTransform: 'capitalize' }}>{client.tier || '—'}</div>
          </div>
          <div className="td">{healthBar(client.health_score)}</div>
          <div className="td" style={{ fontSize: '12px', color: client.days_since_activity !== null && client.days_since_activity > 14 ? '#dc2626' : '#4a5568', fontWeight: client.days_since_activity !== null && client.days_since_activity > 14 ? 600 : 400 }}>
            {daysSince(client.days_since_activity)}
          </div>
          <div className="td" style={{ fontSize: '12px', color: '#0a1628' }}>
            ${(client.revenue_recovered || 0).toLocaleString()}
          </div>
          <div className="td" style={{ fontSize: '12px', color: client.recent_enrollments_14d === 0 ? '#dc2626' : '#4a5568', fontWeight: client.recent_enrollments_14d === 0 ? 600 : 400 }}>
            {client.recent_enrollments_14d}
          </div>
          <div className="td">
            {isAtRisk && (
              <button
                onClick={() => generateCheckin(client.id)}
                disabled={ci.loading}
                style={{ background: ci.loading ? '#e4e9f0' : '#0a1628', color: ci.loading ? '#8896a8' : '#c9a84c', border: 'none', borderRadius: '8px', padding: '7px 13px', fontSize: '11px', fontWeight: 600, cursor: ci.loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {ci.loading ? 'Writing...' : 'Check-in'}
              </button>
            )}
          </div>
        </div>
        {(ci.message || ci.error) && (
          <div style={{ background: ci.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${ci.error ? '#fecaca' : '#bbf7d0'}`, borderRadius: '8px', margin: '0 0 8px', padding: '14px 16px', position: 'relative' }}>
            {ci.error
              ? <div style={{ fontSize: '12px', color: '#dc2626' }}>{ci.error}</div>
              : <>
                  <div style={{ fontSize: '9px', color: '#166534', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Zainab's Check-In Message</div>
                  <div style={{ fontSize: '13px', color: '#0a1628', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{ci.message}</div>
                </>
            }
            <button onClick={() => dismissCheckin(client.id)} style={{ position: 'absolute', top: '10px', right: '12px', background: 'none', border: 'none', fontSize: '16px', color: '#8896a8', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        )}
      </>
    );
  };

  const Section = ({ title, color, dotColor, clients: list, isAtRisk }) => (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0a1628' }}>{title}</div>
        <span style={{ fontSize: '11px', fontWeight: 500, color: '#8896a8' }}>({list.length} client{list.length !== 1 ? 's' : ''})</span>
      </div>
      {list.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '28px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
          No clients in this category
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-header" style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr auto', background: color }}>
            {['Client', 'Health Score', 'Last Activity', 'Revenue Recovered', '14d Enrollments', ''].map(h => (
              <div key={h} className="th">{h}</div>
            ))}
          </div>
          {list.map(c => <ClientRow key={c.id} client={c} isAtRisk={isAtRisk} />)}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#8896a8', fontSize: '13px' }}>
        Loading retention data...
      </div>
    );
  }

  const { at_risk = [], needs_attention = [], healthy = [] } = data || {};
  const total = at_risk.length + needs_attention.length + healthy.length;
  const highChurn = [...at_risk, ...needs_attention].filter(c => c.churn_risk).length;

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: '24px' }}>
        <div className="section-label">Client Health</div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>Retention Dashboard</div>
        <div style={{ fontSize: '12px', color: '#8896a8' }}>Monitor client health, catch at-risk accounts early, and generate personalised check-ins</div>
      </div>

      {/* STAT CARDS */}
      <div className="stats-row" style={{ marginBottom: '28px' }}>
        <div className="stat-card navy-top">
          <div className="stat-label">Total Active</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">clients monitored</div>
        </div>
        <div className="stat-card" style={{ borderTop: '2px solid #dc2626' }}>
          <div className="stat-label">At Risk</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>{at_risk.length}</div>
          <div className="stat-sub" style={{ color: '#dc2626' }}>health score below 50</div>
        </div>
        <div className="stat-card" style={{ borderTop: '2px solid #d97706' }}>
          <div className="stat-label">Needs Attention</div>
          <div className="stat-value" style={{ color: '#d97706' }}>{needs_attention.length}</div>
          <div className="stat-sub" style={{ color: '#d97706' }}>score 50–79</div>
        </div>
        <div className="stat-card" style={{ borderTop: '2px solid #10b981' }}>
          <div className="stat-label">Healthy</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{healthy.length}</div>
          <div className="stat-sub" style={{ color: '#10b981' }}>score 80+</div>
        </div>
      </div>

      {/* HIGH CHURN BANNER */}
      {highChurn > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '18px' }}>⚠</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', marginBottom: '2px' }}>
              {highChurn} client{highChurn !== 1 ? 's' : ''} flagged as high churn risk
            </div>
            <div style={{ fontSize: '11px', color: '#b91c1c' }}>
              Zero enrollments in the last 14 days — these accounts are disengaged and need immediate attention.
            </div>
          </div>
        </div>
      )}

      {/* SECTIONS */}
      <Section
        title="At Risk"
        color="#7f1d1d"
        dotColor="#dc2626"
        clients={at_risk}
        isAtRisk={true}
      />
      <Section
        title="Needs Attention"
        color="#78350f"
        dotColor="#d97706"
        clients={needs_attention}
        isAtRisk={false}
      />
      <Section
        title="Healthy"
        color="#064e3b"
        dotColor="#10b981"
        clients={healthy}
        isAtRisk={false}
      />
    </div>
  );
}
