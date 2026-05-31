import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const FUNNEL_STAGES = [
  { key: 'enrolled', label: 'Enrolled', color: '#3b82f6' },
  { key: 'active', label: 'Active', color: '#c9a84c' },
  { key: 'completed', label: 'Completed', color: '#10b981' },
];

export default function SequenceAnalytics() {
  const [workflows, setWorkflows] = useState([]);
  const [funnelData, setFunnelData] = useState({});
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('All');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [wfRes, clientsRes, enrollRes] = await Promise.all([
        supabase.from('workflows').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name'),
        supabase.from('workflow_enrollments').select('workflow_id, status, contact_id'),
      ]);

      const wfs = wfRes.data || [];
      const allEnrollments = enrollRes.data || [];
      setWorkflows(wfs);
      setClients(clientsRes.data || []);

      const funnel = {};
      for (const wf of wfs) {
        const wfEnrolls = allEnrollments.filter(e => e.workflow_id === wf.id);
        const total = wfEnrolls.length;
        const active = wfEnrolls.filter(e => e.status === 'active').length;
        const completed = wfEnrolls.filter(e => e.status === 'completed').length;
        const cancelled = wfEnrolls.filter(e => e.status === 'cancelled').length;
        const dropOff = total > 0 ? Math.round((cancelled / total) * 100) : 0;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        funnel[wf.id] = { total, active, completed, cancelled, dropOff, completionRate };
      }
      setFunnelData(funnel);
    } catch (e) {
      console.error('SequenceAnalytics fetch error:', e.message);
    }
    setLoading(false);
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';
  const filtered = filterClient === 'All' ? workflows : workflows.filter(w => w.client_id === filterClient);

  const FunnelBar = ({ stage, value, max, color }) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#4a5568', fontWeight: 500 }}>{stage}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color }}>{value} <span style={{ color: '#8896a8', fontWeight: 400 }}>({pct}%)</span></span>
        </div>
        <div style={{ height: '20px', background: '#f0f3f8', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '6px', transition: 'width 0.6s ease', minWidth: pct > 0 ? '4px' : '0' }} />
        </div>
      </div>
    );
  };

  const inputStyle = {
    border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px',
    fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white',
    fontFamily: 'DM Sans, sans-serif',
  };

  const allTotal = Object.values(funnelData).reduce((s, d) => s + d.total, 0);
  const allCompleted = Object.values(funnelData).reduce((s, d) => s + d.completed, 0);
  const allActive = Object.values(funnelData).reduce((s, d) => s + d.active, 0);
  const avgCompletion = filtered.length > 0
    ? Math.round(filtered.reduce((s, w) => s + (funnelData[w.id]?.completionRate || 0), 0) / filtered.length)
    : 0;

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Funnel Analytics</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{filtered.length} sequence{filtered.length !== 1 ? 's' : ''} — enrollment funnel breakdown</div>
        </div>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '180px' }}>
          <option value="All">All Stores</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* SUMMARY STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Total Enrolled', value: allTotal, color: '#3b82f6', icon: 'ti-user-plus' },
          { label: 'Currently Active', value: allActive, color: '#c9a84c', icon: 'ti-bolt' },
          { label: 'Completed', value: allCompleted, color: '#10b981', icon: 'ti-circle-check' },
          { label: 'Avg Completion Rate', value: `${avgCompletion}%`, color: avgCompletion >= 30 ? '#10b981' : '#d97706', icon: 'ti-chart-bar' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${s.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
              <i className={`ti ${s.icon}`} style={{ fontSize: '14px', color: s.color, opacity: 0.5 }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading analytics...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No sequences yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Create sequences in the Sequences page to see funnel analytics here</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : 'repeat(2, 1fr)', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr' : undefined, gap: '14px' }}>
            {filtered.map(wf => {
              const d = funnelData[wf.id] || { total: 0, active: 0, completed: 0, cancelled: 0, dropOff: 0, completionRate: 0 };
              const isSelected = selected?.id === wf.id;
              return (
                <div key={wf.id}
                  onClick={() => setSelected(isSelected ? null : wf)}
                  style={{ background: 'white', border: `1px solid ${isSelected ? '#c9a84c' : '#e4e9f0'}`, borderRadius: '12px', padding: '18px 20px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', transition: 'border-color 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '3px' }}>{wf.name}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8' }}>{getClientName(wf.client_id)} · {wf.trigger_type}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: d.completionRate >= 30 ? '#ecfdf5' : '#fffbeb', color: d.completionRate >= 30 ? '#059669' : '#d97706', border: `1px solid ${d.completionRate >= 30 ? '#a7f3d0' : '#fde68a'}` }}>
                        {d.completionRate}% complete
                      </span>
                      <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: wf.status === 'active' ? '#ecfdf5' : '#f8fafc', color: wf.status === 'active' ? '#059669' : '#8896a8', border: `1px solid ${wf.status === 'active' ? '#a7f3d0' : '#e4e9f0'}` }}>
                        {wf.status}
                      </span>
                    </div>
                  </div>

                  {/* Funnel bars */}
                  <FunnelBar stage="Enrolled" value={d.total} max={d.total || 1} color="#3b82f6" />
                  <FunnelBar stage="Active in Sequence" value={d.active} max={d.total || 1} color="#c9a84c" />
                  <FunnelBar stage="Completed" value={d.completed} max={d.total || 1} color="#10b981" />
                  <FunnelBar stage="Cancelled / Dropped" value={d.cancelled} max={d.total || 1} color="#ef4444" />

                  {d.total > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0f3f8' }}>
                      <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>↓ {d.dropOff}% drop-off</div>
                      <div style={{ fontSize: '10px', color: '#8896a8', marginLeft: 'auto' }}>{d.total} total enrollments</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selected && (() => {
            const d = funnelData[selected.id] || { total: 0, active: 0, completed: 0, cancelled: 0, dropOff: 0, completionRate: 0 };
            return (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', height: 'fit-content', position: 'sticky', top: 0, boxShadow: '0 4px 12px rgba(10,22,40,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{selected.name}</div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px' }}>×</button>
                </div>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Funnel Breakdown</div>
                {FUNNEL_STAGES.map(stage => {
                  const val = d[stage.key] || 0;
                  const pct = d.total > 0 ? Math.round((val / d.total) * 100) : 0;
                  const dropPct = stage.key !== 'enrolled' ? (d.total > 0 ? Math.round(((d.total - val) / d.total) * 100) : 0) : 0;
                  return (
                    <div key={stage.key} style={{ background: '#f8fafc', border: '1px solid #f0f3f8', borderRadius: '8px', padding: '14px 16px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{stage.label}</span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: stage.color }}>{val}</span>
                      </div>
                      <div style={{ height: '8px', background: '#e4e9f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: stage.color, borderRadius: '4px', transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ color: stage.color, fontWeight: 600 }}>{pct}% of enrolled</span>
                        {dropPct > 0 && <span style={{ color: '#ef4444' }}>↓ {dropPct}% drop</span>}
                      </div>
                    </div>
                  );
                })}
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px 16px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>Cancelled / Dropped</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#dc2626' }}>{d.cancelled}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '6px' }}>Overall drop-off: {d.dropOff}%</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
