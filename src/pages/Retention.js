import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

export default function Retention() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkinState, setCheckinState] = useState({});
  const [colOverride, setColOverride] = useState({});
  const dragRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);

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


  const daysSince = (d) => {
    if (d === null || d === undefined) return '—';
    if (d === 0) return 'Today';
    if (d === 1) return '1 day';
    return `${d} days`;
  };


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



  const colClients = (col) => {
    const base = col === 'healthy' ? healthy : col === 'needs_attention' ? needs_attention : at_risk;
    const added = Object.entries(colOverride)
      .filter(([, c]) => c === col)
      .map(([id]) => [...healthy, ...needs_attention, ...at_risk].find(c => c.id === id))
      .filter(Boolean);
    const removed = new Set(Object.entries(colOverride).filter(([, c]) => c !== col).map(([id]) => id));
    return [...base.filter(c => !removed.has(c.id)), ...added.filter(c => !base.find(b => b.id === c.id))];
  };

  const HealthRing = ({ score }) => {
    const R = 22, sw = 4, circ = 2 * Math.PI * R;
    const col = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    const offset = circ * (1 - Math.min(100, Math.max(0, score || 0)) / 100);
    return (
      <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        <circle cx="26" cy="26" r={R} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 26 26)" strokeLinecap="round" />
        <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill={col}>{score ?? '—'}</text>
      </svg>
    );
  };

  const KanbanCard = ({ client, col }) => {
    const ci = checkinState[client.id] || {};
    return (
      <div draggable
        onDragStart={() => { dragRef.current = { client, fromCol: col }; }}
        onDragEnd={() => { dragRef.current = null; }}
        style={{ background: '#0f1f35', border: `1px solid ${client.churn_risk ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 8, cursor: 'grab', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <HealthRing score={client.health_score} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{client.name}</div>
            {client.churn_risk && <span style={{ fontSize: 8, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 700, fontFamily: 'DM Mono,monospace' }}>HIGH RISK</span>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
          {[
            { label: 'Last activity', value: daysSince(client.days_since_activity), warn: client.days_since_activity > 14 },
            { label: 'Enrollments 14d', value: client.recent_enrollments_14d, warn: client.recent_enrollments_14d === 0 },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: '#4a5568', marginBottom: 2, fontFamily: 'DM Mono,monospace', letterSpacing: 1 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.warn ? '#ef4444' : '#f0f4f8' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <button onClick={() => generateCheckin(client.id)} disabled={ci.loading}
          style={{ width: '100%', padding: '8px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: '1px solid rgba(201,168,76,0.25)', background: ci.loading ? 'transparent' : 'rgba(201,168,76,0.08)', color: ci.loading ? '#4a5568' : '#c9a84c', cursor: ci.loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
          {ci.loading ? 'Writing check-in…' : 'Generate Check-in'}
        </button>
        {(ci.message || ci.error) && (
          <div style={{ marginTop: 8, background: ci.error ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${ci.error ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: 8, padding: '10px 12px', position: 'relative' }}>
            {ci.error
              ? <div style={{ fontSize: 11, color: '#f87171' }}>{ci.error}</div>
              : <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{ci.message}</div>}
            <button onClick={() => dismissCheckin(client.id)} style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        )}
      </div>
    );
  };

  const COLUMNS = [
    { key: 'healthy',          label: 'Healthy',         color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  grad: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.04))' },
    { key: 'needs_attention',  label: 'Needs Attention', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  grad: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.04))' },
    { key: 'at_risk',          label: 'At Risk',          color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',   grad: 'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.04))' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, color: '#8896a8', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 6 }}>Client Health</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f4f8', marginBottom: 4 }}>Retention Dashboard</div>
        <div style={{ fontSize: 12, color: '#8896a8' }}>Monitor health, catch at-risk accounts early. Drag cards between columns to reorder.</div>
      </div>

      <div className="stats-row" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Clients', value: total, color: 'var(--gold)', top: 'gold-top' },
          { label: 'Healthy',       value: healthy.length, color: '#10b981', top: 'green-top' },
          { label: 'Needs Attention', value: needs_attention.length, color: '#f59e0b', top: '' },
          { label: 'At Risk',       value: at_risk.length, color: '#ef4444', top: '' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.top}`} style={s.top ? {} : { borderTop: `2px solid ${s.color}` }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-sub">{s.label === 'Total Clients' ? 'monitored' : s.value === 1 ? 'client' : 'clients'}</div>
          </div>
        ))}
      </div>

      {highChurn > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>{highChurn} client{highChurn !== 1 ? 's' : ''} flagged as high churn risk</div>
            <div style={{ fontSize: 11, color: 'rgba(239,68,68,0.6)' }}>Zero enrollments in 14 days — disengaged accounts need immediate attention.</div>
          </div>
        </div>
      )}

      {/* KANBAN COLUMNS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {COLUMNS.map(col => {
          const clients = colClients(col.key);
          const isOver = dragOver === col.key;
          return (
            <div key={col.key}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(null);
                if (dragRef.current && dragRef.current.fromCol !== col.key) {
                  setColOverride(prev => ({ ...prev, [dragRef.current.client.id]: col.key }));
                }
              }}
              style={{ background: isOver ? col.bg : 'rgba(255,255,255,0.01)', border: `1px solid ${isOver ? col.border : 'rgba(255,255,255,0.06)'}`, borderRadius: 18, padding: 16, transition: 'all 0.15s', minHeight: 200 }}>
              <div style={{ background: col.grad, borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: col.color }}>{col.label}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: col.color, background: `${col.color}18`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${col.border}` }}>{clients.length}</span>
              </div>
              {clients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#4a5568', fontSize: 12 }}>No clients</div>
              ) : clients.map(c => <KanbanCard key={c.id} client={c} col={col.key} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
