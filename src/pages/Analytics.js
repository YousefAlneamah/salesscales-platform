import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Analytics() {
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalWorkflows: 0,
    activeWorkflows: 0,
    totalMessages: 0,
    totalDeals: 0,
    convertedDeals: 0,
    pipelineValue: 0,
    totalApprovals: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });
  const [clients, setClients] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [filterClient, setFilterClient] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        contactsRes, workflowsRes, messagesRes,
        dealsRes, approvalsRes, clientsRes
      ] = await Promise.all([
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
      const clientData = clientsRes.data || [];

      setClients(clientData);
      setWorkflows(workflowData);
      setStats({
        totalContacts: contacts.length,
        totalWorkflows: workflowData.length,
        activeWorkflows: workflowData.filter(w => w.status === 'active').length,
        totalMessages: messages.length,
        sentMessages: messages.filter(m => m.direction === 'outbound').length,
        inboundMessages: messages.filter(m => m.direction === 'inbound').length,
        totalDeals: deals.length,
        convertedDeals: deals.filter(d => d.stage === 'Converted').length,
        hotLeads: deals.filter(d => d.stage === 'Hot Lead').length,
        pipelineValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
        totalApprovals: approvals.length,
        approvedCount: approvals.filter(a => a.status === 'approved').length,
        rejectedCount: approvals.filter(a => a.status === 'rejected').length,
        pendingCount: approvals.filter(a => a.status === 'pending').length,
        contactsBySource: contacts.reduce((acc, c) => {
          acc[c.source] = (acc[c.source] || 0) + 1;
          return acc;
        }, {}),
        contactsByStage: contacts.reduce((acc, c) => {
          acc[c.pipeline_stage] = (acc[c.pipeline_stage] || 0) + 1;
          return acc;
        }, {}),
        messagesByChannel: messages.reduce((acc, m) => {
          acc[m.channel] = (acc[m.channel] || 0) + 1;
          return acc;
        }, {}),
      });
    } catch (e) {
      console.error('Analytics error:', e);
    }
    setLoading(false);
  };

  const inputStyle = {
    border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  const BarChart = ({ data, title, color = '#10b981' }) => {
    const entries = Object.entries(data || {}).filter(([k]) => k && k !== 'null' && k !== 'undefined');
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return (
      <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', height: '100%' }}>
        <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '14px' }}>{title}</div>
        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', padding: '20px' }}>No data yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entries.sort(([, a], [, b]) => b - a).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '10px', color: '#475569', width: '100px', flexShrink: 0 }}>{key}</div>
                <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px' }}>
                  <div style={{ height: '100%', borderRadius: '3px', background: color, width: `${(value / max) * 100}%`, transition: 'width 0.5s ease' }}></div>
                </div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#1a3c5e', width: '20px', textAlign: 'right' }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', fontSize: '13px' }}>
        Loading analytics...
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>ANALYTICS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Real data from your platform</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '160px' }}>
            <option value="All">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={fetchData} style={{ background: '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '11px', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* TOP STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'TOTAL CONTACTS', value: stats.totalContacts, sub: 'in database', color: '#10b981' },
          { label: 'ACTIVE WORKFLOWS', value: stats.activeWorkflows, sub: `of ${stats.totalWorkflows} total`, color: '#10b981' },
          { label: 'MESSAGES SENT', value: stats.sentMessages || 0, sub: `${stats.inboundMessages || 0} received`, color: '#3b82f6' },
          { label: 'PIPELINE VALUE', value: '$' + (stats.pipelineValue || 0).toLocaleString(), sub: `${stats.totalDeals} deals`, color: '#8b5cf6' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', borderTop: `2px solid ${stat.color}` }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a3c5e' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: stat.color, marginTop: '2px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* SECOND STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'DEALS CONVERTED', value: stats.convertedDeals || 0, sub: `of ${stats.totalDeals} total`, color: '#10b981' },
          { label: 'HOT LEADS', value: stats.hotLeads || 0, sub: 'ready to close', color: '#f59e0b' },
          { label: 'APPROVALS RATE', value: stats.totalApprovals > 0 ? Math.round((stats.approvedCount / stats.totalApprovals) * 100) + '%' : '0%', sub: `${stats.approvedCount} approved · ${stats.rejectedCount} rejected`, color: '#10b981' },
          { label: 'AI ACTIONS PENDING', value: stats.pendingCount || 0, sub: 'waiting for review', color: '#d97706' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', borderTop: `2px solid ${stat.color}` }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a3c5e' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: stat.color, marginTop: '2px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <BarChart data={stats.contactsBySource} title="CONTACTS BY SOURCE" color="#10b981" />
        <BarChart data={stats.contactsByStage} title="CONTACTS BY STAGE" color="#3b82f6" />
        <BarChart data={stats.messagesByChannel} title="MESSAGES BY CHANNEL" color="#8b5cf6" />
      </div>

      {/* WORKFLOWS TABLE */}
      <div>
        <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>WORKFLOW PERFORMANCE</div>
        {workflows.length === 0 ? (
          <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
            No workflows yet. Create workflows to see performance data.
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
              <div className="th">WORKFLOW</div>
              <div className="th">TRIGGER</div>
              <div className="th">STATUS</div>
              <div className="th">ENROLLED</div>
              <div className="th">ACTIVE</div>
              <div className="th">CONVERTED</div>
            </div>
            {workflows.map(w => (
              <div key={w.id} className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#1a3c5e' }}>{w.name}</div>
                <div style={{ fontSize: '11px', color: '#475569' }}>{w.trigger_type}</div>
                <div>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: w.status === 'active' ? '#ecfdf5' : '#fffbeb', color: w.status === 'active' ? '#059669' : '#d97706', border: `0.5px solid ${w.status === 'active' ? '#a7f3d0' : '#fde68a'}` }}>
                    {w.status}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>{w.enrolled_count}</div>
                <div style={{ fontSize: '11px', color: '#475569' }}>{w.active_count}</div>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>{w.converted_count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}