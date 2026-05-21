import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Reports() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*');
    if (data) setClients(data);
  };

  const generateReport = async () => {
    if (!selectedClient) { alert('Please select a client'); return; }
    setGenerating(true);
    setReport(null);

    const client = clients.find(c => c.id === selectedClient);

    const [contactsRes, workflowsRes, messagesRes, dealsRes, approvalsRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('client_id', selectedClient),
      supabase.from('workflows').select('*').eq('client_id', selectedClient),
      supabase.from('messages').select('*').eq('client_id', selectedClient),
      supabase.from('pipeline_deals').select('*').eq('client_id', selectedClient),
      supabase.from('approvals').select('*').eq('client_id', selectedClient),
    ]);

    const contacts = contactsRes.data || [];
    const workflows = workflowsRes.data || [];
    const messages = messagesRes.data || [];
    const deals = dealsRes.data || [];
    const approvals = approvalsRes.data || [];

    setReport({
      client,
      period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      generatedAt: new Date().toISOString(),
      stats: {
        totalContacts: contacts.length,
        newContacts: contacts.filter(c => new Date() - new Date(c.created_at) < 30 * 24 * 60 * 60 * 1000).length,
        activeWorkflows: workflows.filter(w => w.status === 'active').length,
        totalWorkflows: workflows.length,
        messagesSent: messages.filter(m => m.direction === 'outbound').length,
        messagesReceived: messages.filter(m => m.direction === 'inbound').length,
        totalDeals: deals.length,
        convertedDeals: deals.filter(d => d.stage === 'Converted').length,
        hotLeads: deals.filter(d => d.stage === 'Hot Lead').length,
        pipelineValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
        approvalsTotal: approvals.length,
        approvalsApproved: approvals.filter(a => a.status === 'approved').length,
      },
      channels: messages.reduce((acc, m) => { acc[m.channel] = (acc[m.channel] || 0) + 1; return acc; }, {}),
      contactsByStage: contacts.reduce((acc, c) => { acc[c.pipeline_stage] = (acc[c.pipeline_stage] || 0) + 1; return acc; }, {}),
    });

    setGenerating(false);
  };

  const inputStyle = {
    border: '1px solid #e4e9f0', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#0a1628',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif', width: '100%'
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Reports</div>
        <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Generate performance reports per client store</div>
      </div>

      {/* GENERATE */}
      <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Generate Monthly Report</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Store</div>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={inputStyle}>
              <option value="">Select store</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Report Period</div>
            <input type="month" style={inputStyle} defaultValue={new Date().toISOString().substring(0, 7)} />
          </div>
        </div>
        <button onClick={generateReport} disabled={generating}
          style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          {generating ? 'Generating...' : '⚡ Generate Report'}
        </button>
      </div>

      {/* REPORT */}
      {report && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '28px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          {/* REPORT HEADER */}
          <div style={{ borderBottom: '2px solid #0a1628', paddingBottom: '18px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '3px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Sales Scales</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>Monthly Performance Report</div>
              <div style={{ fontSize: '13px', color: '#8896a8' }}>{report.client.name} · {report.period}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px' }}>Generated {new Date(report.generatedAt).toLocaleDateString()}</div>
              <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                {report.client.tier?.toUpperCase()} TIER
              </span>
            </div>
          </div>

          {/* KEY METRICS */}
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Key Metrics This Month</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {[
              { label: 'Total Contacts', value: report.stats.totalContacts, sub: `${report.stats.newContacts} new this month` },
              { label: 'Active Workflows', value: report.stats.activeWorkflows, sub: `${report.stats.totalWorkflows} total built` },
              { label: 'Messages Sent', value: report.stats.messagesSent, sub: `${report.stats.messagesReceived} received` },
              { label: 'Pipeline Value', value: '$' + report.stats.pipelineValue.toLocaleString(), sub: `${report.stats.totalDeals} deals` },
              { label: 'Hot Leads', value: report.stats.hotLeads, sub: 'ready to close' },
              { label: 'Deals Converted', value: report.stats.convertedDeals, sub: `of ${report.stats.totalDeals} in pipeline` },
            ].map(metric => (
              <div key={metric.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', borderLeft: '3px solid #c9a84c' }}>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600 }}>{metric.label}</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '3px' }}>{metric.value}</div>
                <div style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 500 }}>{metric.sub}</div>
              </div>
            ))}
          </div>

          {/* CHANNEL PERFORMANCE */}
          {Object.keys(report.channels).length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Channel Performance</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(report.channels).map(([channel, count]) => {
                  const max = Math.max(...Object.values(report.channels));
                  return (
                    <div key={channel} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ fontSize: '12px', color: '#4a5568', width: '90px', fontWeight: 500 }}>{channel}</div>
                      <div style={{ flex: 1, height: '6px', background: '#f0f3f8', borderRadius: '3px' }}>
                        <div style={{ height: '100%', borderRadius: '3px', background: '#c9a84c', width: `${(count / max) * 100}%` }}></div>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0a1628', width: '30px', textAlign: 'right' }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PIPELINE STAGES */}
          {Object.keys(report.contactsByStage).length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Contacts by Pipeline Stage</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {Object.entries(report.contactsByStage).map(([stage, count]) => (
                  <div key={stage} style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', textAlign: 'center', border: '1px solid #f0f3f8' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628', marginBottom: '3px' }}>{count}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>{stage}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI SUMMARY */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>AI Approval Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: 'Total AI Actions', value: report.stats.approvalsTotal, color: '#0a1628' },
                { label: 'Approved', value: report.stats.approvalsApproved, color: '#10b981' },
                { label: 'Rejected', value: report.stats.approvalsTotal - report.stats.approvalsApproved, color: '#dc2626' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', textAlign: 'center', border: '1px solid #f0f3f8' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: item.color, marginBottom: '4px' }}>{item.value}</div>
                  <div style={{ fontSize: '10px', color: '#8896a8' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ borderTop: '1px solid #e4e9f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: '#8896a8' }}>Generated by Sales Scales AI Revenue System</div>
            <button style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}