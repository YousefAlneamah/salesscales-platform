import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Analytics() {
  const [stats, setStats] = useState({});
  const [clients, setClients] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('All');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contactsRes, workflowsRes, messagesRes, dealsRes, approvalsRes, clientsRes] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('workflows').select('*'),
        supabase.from('messages').select('*'),
        supabase.from('pipeline_deals').select('*'),
        supabase.from('approvals').select('*'),
        supabase.from('clients').select('*'),
      ]);

      const contacts = contactsRes.data || [];
      const workflowData = workflowsRes.data || [];
      const messages = messagesRes.data || [];
      const deals = dealsRes.data || [];
      const approvals = approvalsRes.data || [];

      setClients(clientsRes.data || []);
      setWorkflows(workflowData);
      setStats({
        totalContacts: contacts.length,
        activeWorkflows: workflowData.filter(w => w.status === 'active').length,
        totalWorkflows: workflowData.length,
        sentMessages: messages.filter(m => m.direction === 'outbound').length,
        inboundMessages: messages.filter(m => m.direction === 'inbound').length,
        totalDeals: deals.length,
        convertedDeals: deals.filter(d => d.stage === 'Converted').length,
        hotLeads: deals.filter(d => d.stage === 'Hot Lead').length,
        pipelineValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
        approvedCount: approvals.filter(a => a.status === 'approved').length,
        rejectedCount: approvals.filter(a => a.status === 'rejected').length,
        totalApprovals: approvals.length,
        contactsBySource: contacts.reduce((acc, c) => { acc[c.source] = (acc[c.source] || 0) + 1; return acc; }, {}),
        contactsByStage: contacts.reduce((acc, c) => { acc[c.pipeline_stage] = (acc[c.pipeline_stage] || 0) + 1; return acc; }, {}),
        messagesByChannel: messages.reduce((acc, m) => { acc[m.channel] = (acc[m.channel] || 0) + 1; return acc; }, {}),
      });
    } catch (e) {
      console.error('Analytics error:', e);
    }
    setLoading(false);
  };

  const inputStyle = {
    border: '1px solid #e4e9f0', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#0a1628',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif'
  };

  const BarChart = ({ data, title, color = '#c9a84c' }) => {
    const entries = Object.entries(data || {}).filter(([k]) => k && k !== 'null' && k !== 'undefined');
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return (
      <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>{title}</div>
        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8896a8', fontSize: '11px', padding: '20px' }}>No data yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {entries.sort(([, a], [, b]) => b - a).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '11px', color: '#4a5568', width: '110px', flexShrink: 0 }}>{key}</div>
                <div style={{ flex: 1, height: '6px', background: '#f0f3f8', borderRadius: '3px' }}>
                  <div style={{ height: '100%', borderRadius: '3px', background: color, width: `${(value / max) * 100}%`, transition: 'width 0.5s ease' }}></div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', width: '24px', textAlign: 'right' }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#8896a8' }}>Loading analytics...</div>;
  }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Analytics</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Real data from your platform</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '160px' }}>
            <option value="All">All Stores</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={fetchData}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* TOP STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
        {[
          { label: 'Total Contacts', value: stats.totalContacts, sub: 'in database', color: '#c9a84c' },
          { label: 'Active Workflows', value: stats.activeWorkflows, sub: `of ${stats.totalWorkflows} total`, color: '#c9a84c' },
          { label: 'Messages Sent', value: stats.sentMessages || 0, sub: `${stats.inboundMessages || 0} received`, color: '#3b82f6' },
          { label: 'Pipeline Value', value: '$' + (stats.pipelineValue || 0).toLocaleString(), sub: `${stats.totalDeals} deals`, color: '#7c3aed' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* BOTTOM STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Deals Converted', value: stats.convertedDeals || 0, sub: `of ${stats.totalDeals} total`, color: '#10b981' },
          { label: 'Hot Leads', value: stats.hotLeads || 0, sub: 'ready to close', color: '#d97706' },
          { label: 'Approval Rate', value: stats.totalApprovals > 0 ? Math.round((stats.approvedCount / stats.totalApprovals) * 100) + '%' : '0%', sub: `${stats.approvedCount} approved`, color: '#10b981' },
          { label: 'AI Actions', value: stats.totalApprovals || 0, sub: `${stats.rejectedCount || 0} rejected`, color: '#8896a8' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* CHARTS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <BarChart data={stats.contactsBySource} title="Contacts by Source" color="#c9a84c" />
        <BarChart data={stats.contactsByStage} title="Contacts by Stage" color="#3b82f6" />
        <BarChart data={stats.messagesByChannel} title="Messages by Channel" color="#7c3aed" />
      </div>

      {/* WORKFLOW PERFORMANCE */}
      <div>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Workflow Performance</div>
        {workflows.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
            No workflows yet
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 18px', background: '#0a1628' }}>
              {['WORKFLOW', 'TRIGGER', 'STATUS', 'ENROLLED', 'ACTIVE', 'CONVERTED'].map(h => (
                <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {workflows.map(w => (
              <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '13px 18px', borderBottom: '1px solid #f4f6fa' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{w.name}</div>
                <div style={{ fontSize: '11px', color: '#4a5568' }}>{w.trigger_type}</div>
                <div>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: w.status === 'active' ? '#ecfdf5' : '#fffbeb', color: w.status === 'active' ? '#059669' : '#d97706', border: `1px solid ${w.status === 'active' ? '#a7f3d0' : '#fde68a'}` }}>
                    {w.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#4a5568' }}>{w.enrolled_count}</div>
                <div style={{ fontSize: '12px', color: '#4a5568' }}>{w.active_count}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#c9a84c' }}>{w.converted_count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}