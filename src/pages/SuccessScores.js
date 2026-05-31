import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3001';

const TIER_COLOR = { starter: '#8896a8', growth: '#3b82f6', scale: '#c9a84c', enterprise: '#10b981' };

export default function SuccessScores() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/clients/success-scores`)
      .then(r => setClients(r.data.clients || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const maxRoi = Math.max(...clients.map(c => c.roi || 0), 1);

  if (loading) return <div style={{ color: 'var(--muted)', fontSize: '13px', padding: '40px', textAlign: 'center' }}>Loading success scores...</div>;
  if (error) return <div style={{ color: 'var(--red)', padding: '20px' }}>{error}</div>;

  const avgRoi = clients.length > 0 ? clients.reduce((s, c) => s + c.roi, 0) / clients.length : 0;
  const avgCompletion = clients.length > 0 ? clients.reduce((s, c) => s + c.completionRate, 0) / clients.length : 0;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div className="section-label">Performance</div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>Client Success Scores</div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>ROI = estimated revenue recovered ÷ subscription paid · ranked by ROI</div>
      </div>

      <div className="stats-row" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Total Clients', value: clients.length, sub: 'tracked', color: 'var(--gold)' },
          { label: 'Avg ROI', value: `${avgRoi.toFixed(2)}x`, sub: 'return on investment', color: 'var(--green)' },
          { label: 'Avg Completion Rate', value: `${Math.round(avgCompletion)}%`, sub: 'sequence completion', color: 'var(--blue)' },
          { label: 'Top Performer', value: clients[0]?.name?.split(' ')[0] || '—', sub: `${clients[0]?.roi?.toFixed(2) || 0}x ROI`, color: 'var(--gold)' },
        ].map(s => (
          <div key={s.label} className="stat-card gold-top">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-header">
          <div className="th" style={{ width: '30px' }}>#</div>
          <div className="th" style={{ flex: 2 }}>Client</div>
          <div className="th">Tier</div>
          <div className="th">ROI</div>
          <div className="th">Completion</div>
          <div className="th">Contact Growth</div>
          <div className="th">Contacts</div>
          <div className="th">Paid</div>
          <div className="th">Est. Revenue</div>
        </div>
        {clients.map((c, i) => (
          <div key={c.id} className="table-row">
            <div className="td" style={{ width: '30px', color: i < 3 ? 'var(--gold)' : 'var(--muted)', fontWeight: i < 3 ? 700 : 400 }}>{i + 1}</div>
            <div className="td" style={{ flex: 2 }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Health: {c.health_score || 0}%</div>
            </div>
            <div className="td">
              <span className="badge-blue" style={{ background: TIER_COLOR[c.tier?.toLowerCase()] + '22', color: TIER_COLOR[c.tier?.toLowerCase()], border: `1px solid ${TIER_COLOR[c.tier?.toLowerCase()]}44` }}>
                {c.tier || 'starter'}
              </span>
            </div>
            <div className="td">
              <div style={{ fontWeight: 700, color: c.roi >= 2 ? 'var(--green)' : c.roi >= 1 ? 'var(--gold)' : 'var(--red)' }}>
                {c.roi.toFixed(2)}x
              </div>
              <div style={{ marginTop: '4px', height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', width: '80px' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (c.roi / maxRoi) * 100)}%`, background: c.roi >= 2 ? 'var(--green)' : 'var(--gold)', borderRadius: '2px' }} />
              </div>
            </div>
            <div className="td">
              <div style={{ fontWeight: 600, color: c.completionRate >= 50 ? 'var(--green)' : 'var(--gold)' }}>{c.completionRate}%</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{c.completedEnrollments} completed</div>
            </div>
            <div className="td">
              <span style={{ fontSize: '13px', fontWeight: 600, color: c.contactGrowthRate > 0 ? 'var(--green)' : 'var(--muted)' }}>
                {c.contactGrowthRate > 0 ? '+' : ''}{c.contactGrowthRate}%
              </span>
            </div>
            <div className="td">{c.totalContacts.toLocaleString()}</div>
            <div className="td" style={{ color: 'var(--muted)' }}>${c.totalPaid.toLocaleString()}</div>
            <div className="td" style={{ fontWeight: 600 }}>${c.estimatedRevenue.toLocaleString()}</div>
          </div>
        ))}
        {clients.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No client data yet</div>
        )}
      </div>
    </div>
  );
}
