import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';
// Fix 2: rate limit stats state added to component below

const BarChart = ({ data, title, color = '#c9a84c' }) => {
  const entries = Object.entries(data || {}).filter(([k]) => k && k !== 'null' && k !== 'undefined');
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="card">
      <div className="section-label" style={{ marginBottom: '14px' }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#8896a8', fontSize: '11px', padding: '20px 0' }}>No data yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {entries.sort(([, a], [, b]) => b - a).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '11px', color: '#4a5568', width: '110px', flexShrink: 0 }}>{key}</div>
              <div className="pbar" style={{ flex: 1 }}>
                <div style={{ height: '100%', borderRadius: '3px', background: color, width: `${(value / max) * 100}%`, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', width: '28px', textAlign: 'right' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MonthCard = ({ label, value, icon, accent, sub }) => (
  <div className={`stat-card ${accent}-top`}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div className="stat-label">{label}</div>
      <i className={`ti ${icon}`} style={{ fontSize: '15px', color: accent === 'gold' ? '#c9a84c' : accent === 'green' ? '#10b981' : accent === 'blue' ? '#3b82f6' : '#0a1628', opacity: 0.5 }} />
    </div>
    <div className="stat-value">{value}</div>
    {sub && <div className={`stat-sub-${accent === 'gold' ? 'gold' : accent === 'green' ? 'green' : 'blue'}`}>{sub}</div>}
  </div>
);

export default function Analytics() {
  const [monthStats, setMonthStats] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [messages, setMessages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [clients, setClients] = useState([]);
  const [seqPerformance, setSeqPerformance] = useState([]);
  const [rateLimitStats, setRateLimitStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('All');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [serverRes, contactsRes, workflowsRes, messagesRes, dealsRes, approvalsRes, clientsRes, activeWfRes, enrollmentsRes] = await Promise.all([
        axios.get(`${API_BASE}/analytics/stats`),
        supabase.from('contacts').select('source, pipeline_stage, client_id'),
        supabase.from('workflows').select('*'),
        supabase.from('messages').select('channel, direction, client_id'),
        supabase.from('pipeline_deals').select('value, stage, client_id'),
        supabase.from('approvals').select('status, client_id'),
        supabase.from('clients').select('id, name'),
        supabase.from('workflows').select('id, name, client_id, status, trigger_type, enrolled_count, clients(name)').eq('status', 'active'),
        supabase.from('workflow_enrollments').select('workflow_id, status'),
      ]);

      setMonthStats(serverRes.data);
      setContacts(contactsRes.data || []);
      setWorkflows(workflowsRes.data || []);
      setMessages(messagesRes.data || []);
      setDeals(dealsRes.data || []);
      setApprovals(approvalsRes.data || []);
      setClients(clientsRes.data || []);

      const enrollmentsByWorkflow = (enrollmentsRes.data || []).reduce((acc, e) => {
        if (!acc[e.workflow_id]) acc[e.workflow_id] = { total: 0, completed: 0 };
        acc[e.workflow_id].total += 1;
        if (e.status === 'completed') acc[e.workflow_id].completed += 1;
        return acc;
      }, {});
      const perf = (activeWfRes.data || []).map(w => {
        const counts = enrollmentsByWorkflow[w.id] || { total: 0, completed: 0 };
        const enrolled = counts.total;
        const completed = counts.completed;
        const rate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
        return {
          id: w.id,
          name: w.name,
          client_name: w.clients?.name || '—',
          trigger_type: w.trigger_type,
          enrolled,
          completed,
          completion_rate: rate,
          est_revenue: completed * 47,
        };
      }).sort((a, b) => b.completion_rate - a.completion_rate);
      setSeqPerformance(perf);
      // Fix 2: fetch rate limit stats
      axios.get(`${API_BASE}/admin/rate-limit-stats`).then(r => setRateLimitStats(r.data)).catch(() => {});
    } catch (e) {
      console.error('Analytics error:', e);
    }
    setLoading(false);
  };

  const filtered = (arr, idField = 'client_id') =>
    filterClient === 'All' ? arr : arr.filter(r => r[idField] === filterClient);

  const fc = filtered(contacts);
  const fm = filtered(messages);
  const fd = filtered(deals);
  const fa = filtered(approvals);

  const outbound = fm.filter(m => m.direction === 'outbound');
  const inbound  = fm.filter(m => m.direction === 'inbound');
  const pipelineValue = fd.reduce((s, d) => s + (d.value || 0), 0);
  const convertedDeals = fd.filter(d => d.stage === 'Converted');
  const revenueRecovered = convertedDeals.reduce((s, d) => s + (d.value || 0), 0);
  const approvedCount  = fa.filter(a => a.status === 'approved').length;

  const byKey = (arr, key) => arr.reduce((acc, r) => {
    const k = r[key] || 'Unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#8896a8', fontSize: '12px' }}>
        Loading analytics...
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div className="section-label">Analytics</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>
            Platform performance — {monthStats?.month || 'This month'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            style={{ border: '1px solid #e4e9f0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white' }}
          >
            <option value="All">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={fetchAll} className="btn btn-navy" style={{ fontSize: '11px', padding: '8px 16px' }}>
            <i className="ti ti-refresh" style={{ marginRight: '5px' }} />Refresh
          </button>
        </div>
      </div>

      {/* THIS MONTH — 6 KEY METRICS */}
      {monthStats && (
        <>
          <div className="section-label" style={{ marginBottom: '10px' }}>This Month</div>
          <div className="stats-row" style={{ marginBottom: '12px' }}>
            <MonthCard label="Emails Sent" value={monthStats.emailsSentThisMonth} icon="ti-mail" accent="blue" sub="outbound this month" />
            <MonthCard label="SMS Sent" value={monthStats.smsSentThisMonth} icon="ti-message" accent="green" sub="outbound this month" />
            <MonthCard label="WhatsApp Sent" value={monthStats.whatsappSentThisMonth} icon="ti-brand-whatsapp" accent="green" sub="outbound this month" />
            <MonthCard label="Contacts Added" value={monthStats.contactsAddedThisMonth} icon="ti-user-plus" accent="gold" sub="new this month" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <MonthCard label="Workflow Enrollments" value={monthStats.enrollmentsThisMonth} icon="ti-bolt" accent="gold" sub={`${monthStats.activeEnrollments} currently active`} />
            <MonthCard label="Active Sequences" value={monthStats.activeSequences} icon="ti-player-play" accent="blue" sub="sequences running" />
          </div>
        </>
      )}

      {/* ALL-TIME STATS */}
      <div className="section-label" style={{ marginBottom: '10px' }}>All Time</div>
      <div className="stats-row" style={{ marginBottom: '12px' }}>
        <div className="stat-card navy-top">
          <div className="stat-label">Total Contacts</div>
          <div className="stat-value">{monthStats?.totalContacts ?? fc.length}</div>
          <div className="stat-sub">{filterClient !== 'All' ? `${fc.length} for this client` : 'across all clients'}</div>
        </div>
        <div className="stat-card gold-top">
          <div className="stat-label">Active Workflows</div>
          <div className="stat-value">{workflows.filter(w => w.status === 'active').length}</div>
          <div className="stat-sub-gold">of {workflows.length} total</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">Messages Sent</div>
          <div className="stat-value">{outbound.length}</div>
          <div className="stat-sub-blue">{inbound.length} received</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Revenue Recovered</div>
          <div className="stat-value">${revenueRecovered.toLocaleString()}</div>
          <div className="stat-sub-green">{convertedDeals.length} deals converted</div>
        </div>
      </div>
      {(() => {
        const totalSeqEnrolled = seqPerformance.reduce((s, w) => s + w.enrolled, 0);
        const totalSeqCompleted = seqPerformance.reduce((s, w) => s + w.completed, 0);
        const hasOrderData = convertedDeals.length > 0;
        const winRateValue = totalSeqEnrolled > 0
          ? (hasOrderData
            ? Math.round((convertedDeals.length / totalSeqEnrolled) * 100)
            : Math.round((totalSeqCompleted / totalSeqEnrolled) * 100))
          : 0;
        const winRateSub = hasOrderData
          ? `${convertedDeals.length} converted of ${totalSeqEnrolled} enrolled`
          : `completion proxy — ${totalSeqCompleted} of ${totalSeqEnrolled} enrolled`;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Pipeline Value', value: `$${pipelineValue.toLocaleString()}`, sub: `${fd.length} open deals`, color: '#10b981' },
              { label: 'Approval Rate', value: fa.length > 0 ? Math.round((approvedCount / fa.length) * 100) + '%' : '—', sub: `${approvedCount} of ${fa.length} approved`, color: '#c9a84c' },
              { label: 'Inbound Messages', value: inbound.length, sub: `${monthStats?.inboundThisMonth ?? 0} this month`, color: '#3b82f6' },
              { label: 'Win Rate', value: totalSeqEnrolled > 0 ? `${winRateValue}%` : '—', sub: winRateSub, color: '#a78bfa' },
            ].map(s => (
              <div key={s.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${s.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{s.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: s.color, fontWeight: 500 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* CHARTS */}
      <div className="section-label" style={{ marginBottom: '10px' }}>Breakdowns</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <BarChart data={byKey(fc, 'source')} title="Contacts by Source" color="#c9a84c" />
        <BarChart data={byKey(fc, 'pipeline_stage')} title="Contacts by Stage" color="#3b82f6" />
        <BarChart data={byKey(fm, 'channel')} title="Messages by Channel" color="#10b981" />
      </div>

      {/* WORKFLOW PERFORMANCE */}
      <div className="section-label" style={{ marginBottom: '10px' }}>Workflow Performance</div>
      {workflows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#8896a8', fontSize: '12px' }}>
          No workflows yet
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-header">
            <div className="th" style={{ flex: 2 }}>Workflow</div>
            <div className="th" style={{ flex: 1 }}>Trigger</div>
            <div className="th" style={{ flex: '0 0 80px' }}>Status</div>
            <div className="th" style={{ flex: '0 0 80px', textAlign: 'right' }}>Enrolled</div>
          </div>
          {workflows.map(w => (
            <div key={w.id} className="table-row">
              <div className="td" style={{ flex: 2, fontWeight: 600, color: '#0a1628', fontSize: '12px' }}>{w.name}</div>
              <div className="td" style={{ flex: 1, fontSize: '11px', color: '#4a5568', textTransform: 'capitalize' }}>
                {(w.trigger_type || '').replace(/_/g, ' ')}
              </div>
              <div className="td" style={{ flex: '0 0 80px' }}>
                <span className={w.status === 'active' ? 'badge-green' : 'badge-yellow'}>
                  {w.status}
                </span>
              </div>
              <div className="td" style={{ flex: '0 0 80px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>
                {w.enrolled_count ?? 0}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SEQUENCE PERFORMANCE */}
      <div className="section-label" style={{ margin: '24px 0 10px' }}>Sequence Performance</div>
      <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '12px' }}>
        Active sequences across all clients — sorted by completion rate. Est. revenue @ $47/completion.
      </div>
      {seqPerformance.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#8896a8', fontSize: '12px' }}>
          No active sequences with enrollment data yet
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: '8px' }}>
          <div className="table-header">
            <div className="th" style={{ flex: 2 }}>Sequence</div>
            <div className="th" style={{ flex: 1 }}>Client</div>
            <div className="th" style={{ flex: 1 }}>Trigger</div>
            <div className="th" style={{ flex: '0 0 80px', textAlign: 'right' }}>Enrolled</div>
            <div className="th" style={{ flex: '0 0 80px', textAlign: 'right' }}>Completed</div>
            <div className="th" style={{ flex: '0 0 110px', textAlign: 'right' }}>Completion %</div>
            <div className="th" style={{ flex: '0 0 110px', textAlign: 'right' }}>Est. Revenue</div>
          </div>
          {seqPerformance.map(s => {
            const rateColor = s.completion_rate >= 40 ? '#10b981' : s.completion_rate >= 20 ? '#c9a84c' : '#dc2626';
            return (
              <div key={s.id} className="table-row">
                <div className="td" style={{ flex: 2, fontWeight: 600, color: '#0a1628', fontSize: '12px' }}>{s.name}</div>
                <div className="td" style={{ flex: 1, fontSize: '11px', color: '#4a5568' }}>{s.client_name}</div>
                <div className="td" style={{ flex: 1, fontSize: '11px', color: '#4a5568', textTransform: 'capitalize' }}>
                  {(s.trigger_type || '').replace(/_/g, ' ') || '—'}
                </div>
                <div className="td" style={{ flex: '0 0 80px', textAlign: 'right', fontSize: '12px', color: '#0a1628' }}>{s.enrolled}</div>
                <div className="td" style={{ flex: '0 0 80px', textAlign: 'right', fontSize: '12px', color: '#0a1628' }}>{s.completed}</div>
                <div className="td" style={{ flex: '0 0 110px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e4e9f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.completion_rate}%`, background: rateColor, borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: rateColor }}>{s.completion_rate}%</span>
                  </div>
                </div>
                <div className="td" style={{ flex: '0 0 110px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                  {s.est_revenue > 0 ? `$${s.est_revenue.toLocaleString()}` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FIX 2: RATE LIMIT STATS */}
      {rateLimitStats && (
        <>
          <div className="section-label" style={{ margin: '24px 0 10px' }}>Rate Limit Activity (This Week)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="card">
              <div className="section-label" style={{ marginBottom: '12px' }}>Top Blocked Endpoints</div>
              {rateLimitStats.topEndpoints.length === 0 ? <div style={{ fontSize: '11px', color: '#8896a8' }}>No hits this week</div> : rateLimitStats.topEndpoints.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f4f6fa', fontSize: '11px' }}>
                  <span style={{ color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{r.endpoint}</span>
                  <span className="badge-red" style={{ flexShrink: 0 }}>{r.hits}×</span>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="section-label" style={{ marginBottom: '12px' }}>Top Blocked IPs</div>
              {rateLimitStats.topIps.length === 0 ? <div style={{ fontSize: '11px', color: '#8896a8' }}>No hits this week</div> : rateLimitStats.topIps.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f4f6fa', fontSize: '11px' }}>
                  <span style={{ color: '#4a5568', fontFamily: 'DM Mono, monospace' }}>{r.ip}</span>
                  <span className="badge-red" style={{ flexShrink: 0 }}>{r.hits}×</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
