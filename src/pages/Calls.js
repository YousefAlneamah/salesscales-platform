import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';

const fmtDuration = (s) => {
  if (!s && s !== 0) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

export default function Calls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { fetchCalls(); }, []);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/calls/list`);
      setCalls(data.calls || []);
    } catch (_) {}
    setLoading(false);
  };

  const inbound = calls.filter(c => c.direction === 'inbound').length;
  const outbound = calls.filter(c => c.direction === 'outbound').length;
  const totalSecs = calls.reduce((a, c) => a + (c.duration_seconds || 0), 0);

  return (
    <div>
      {/* STATS */}
      <div className="stats-row" style={{ marginBottom: '20px' }}>
        <div className="stat-card gold-top">
          <div className="stat-label">Total Calls</div>
          <div className="stat-value">{calls.length}</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">Inbound</div>
          <div className="stat-value">{inbound}</div>
        </div>
        <div className="stat-card navy-top">
          <div className="stat-label">Outbound</div>
          <div className="stat-value">{outbound}</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Total Talk Time</div>
          <div className="stat-value">{fmtDuration(totalSecs)}</div>
        </div>
      </div>

      <div className="section-label" style={{ marginBottom: '16px' }}>CALL LOGS</div>

      {/* TABLE */}
      <div className="table-wrap">
        <div className="table-header">
          <div className="th">Direction</div>
          <div className="th">Phone</div>
          <div className="th">Duration</div>
          <div className="th" style={{ flex: 3 }}>Summary</div>
          <div className="th">Date</div>
          <div className="th">Transcript</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>Loading calls...</div>
        ) : calls.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#8896a8' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📞</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>No calls logged yet</div>
            <div style={{ fontSize: '11px' }}>Calls appear here once ElevenLabs webhooks fire on call end</div>
          </div>
        ) : calls.map(c => (
          <React.Fragment key={c.id}>
            <div className="table-row">
              <div className="td">
                <span className={c.direction === 'inbound' ? 'badge-blue' : 'badge-gold'}>
                  {c.direction === 'inbound' ? '↓ Inbound' : '↑ Outbound'}
                </span>
              </div>
              <div className="td" style={{ fontWeight: 600, color: '#0a1628' }}>{c.contact_phone || '—'}</div>
              <div className="td" style={{ fontSize: '11px', color: '#4a5568' }}>{fmtDuration(c.duration_seconds)}</div>
              <div className="td" style={{ flex: 3, fontSize: '11px', color: '#4a5568' }}>{c.summary || '—'}</div>
              <div className="td" style={{ fontSize: '11px', color: '#8896a8', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString()}</div>
              <div className="td">
                <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="btn btn-outline" style={{ fontSize: '10px', padding: '4px 10px' }}>
                  {expanded === c.id ? 'Hide' : 'View'}
                </button>
              </div>
            </div>
            {expanded === c.id && (
              <div style={{ background: '#0a1628', padding: '18px 22px', borderBottom: '1px solid #e4e9f0' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: '#c9a84c', fontFamily: 'DM Mono, monospace', marginBottom: '10px' }}>
                  {c.clients?.name ? `${c.clients.name} — ` : ''}Full Transcript
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#e4e9f0', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, margin: 0 }}>
                  {c.transcript || 'No transcript available for this call.'}
                </pre>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
