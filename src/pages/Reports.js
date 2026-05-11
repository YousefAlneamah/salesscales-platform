import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Reports() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  
  useEffect(() => {
    fetchClients();
    fetchReports();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*');
    if (data) setClients(data);
  };

  const fetchReports = async () => {
    setLoading(false);
  };

  const generateReport = async () => {
    if (!selectedClient) {
      alert('Please select a client');
      return;
    }
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

    const reportData = {
      client: client,
      period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      generatedAt: new Date().toISOString(),
      stats: {
        totalContacts: contacts.length,
        newContacts: contacts.filter(c => {
          const d = new Date(c.created_at);
          const now = new Date();
          return now - d < 30 * 24 * 60 * 60 * 1000;
        }).length,
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
      channels: messages.reduce((acc, m) => {
        acc[m.channel] = (acc[m.channel] || 0) + 1;
        return acc;
      }, {}),
      contactsByStage: contacts.reduce((acc, c) => {
        acc[c.pipeline_stage] = (acc[c.pipeline_stage] || 0) + 1;
        return acc;
      }, {}),
    };

    setReport(reportData);
    setGenerating(false);
  };

  const inputStyle = {
    border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>REPORTS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Generate performance reports per client</div>
        </div>
      </div>

      {/* GENERATE REPORT */}
      <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '14px' }}>GENERATE MONTHLY REPORT</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>SELECT CLIENT</div>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}>
              <option value="">Select client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>REPORT PERIOD</div>
            <input type="month" style={{ ...inputStyle, width: '100%' }}
              defaultValue={new Date().toISOString().substring(0, 7)} />
          </div>
        </div>
        <button onClick={generateReport} disabled={generating}
          style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '9px 20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
          {generating ? 'Generating...' : '⚡ Generate Report'}
        </button>
      </div>

      {/* REPORT OUTPUT */}
      {report && (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
          {/* REPORT HEADER */}
          <div style={{ borderBottom: '2px solid #1a3c5e', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '2px', fontWeight: 600, marginBottom: '4px' }}>SALES SCALES</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a3c5e', marginBottom: '4px' }}>Monthly Performance Report</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>{report.client.name} · {report.period}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Generated</div>
                <div style={{ fontSize: '11px', color: '#475569' }}>{new Date(report.generatedAt).toLocaleDateString()}</div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', border: '0.5px solid #a7f3d0', fontWeight: 600 }}>
                    {report.client.tier?.toUpperCase()} TIER
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* KEY METRICS */}
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '12px' }}>KEY METRICS THIS MONTH</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Contacts', value: report.stats.totalContacts, sub: `${report.stats.newContacts} new this month` },
              { label: 'Active Workflows', value: report.stats.activeWorkflows, sub: `${report.stats.totalWorkflows} total built` },
              { label: 'Messages Sent', value: report.stats.messagesSent, sub: `${report.stats.messagesReceived} received` },
              { label: 'Pipeline Value', value: '$' + report.stats.pipelineValue.toLocaleString(), sub: `${report.stats.totalDeals} total deals` },
              { label: 'Hot Leads', value: report.stats.hotLeads, sub: 'ready to close' },
              { label: 'Deals Converted', value: report.stats.convertedDeals, sub: `of ${report.stats.totalDeals} in pipeline` },
            ].map(metric => (
              <div key={metric.label} style={{ background: '#f8f9fc', borderRadius: '8px', padding: '14px 16px', borderLeft: '3px solid #10b981' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>{metric.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a3c5e', marginBottom: '2px' }}>{metric.value}</div>
                <div style={{ fontSize: '10px', color: '#10b981' }}>{metric.sub}</div>
              </div>
            ))}
          </div>

          {/* CHANNEL BREAKDOWN */}
          {Object.keys(report.channels).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '12px' }}>CHANNEL PERFORMANCE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(report.channels).map(([channel, count]) => {
                  const max = Math.max(...Object.values(report.channels));
                  return (
                    <div key={channel} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#475569', width: '100px' }}>{channel}</div>
                      <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px' }}>
                        <div style={{ height: '100%', borderRadius: '4px', background: '#10b981', width: `${(count / max) * 100}%` }}></div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#1a3c5e', width: '30px', textAlign: 'right' }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PIPELINE STAGES */}
          {Object.keys(report.contactsByStage).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '12px' }}>CONTACTS BY PIPELINE STAGE</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {Object.entries(report.contactsByStage).map(([stage, count]) => (
                  <div key={stage} style={{ background: '#f8f9fc', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a3c5e' }}>{count}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{stage}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APPROVAL STATS */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '12px' }}>AI APPROVAL SUMMARY</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { label: 'Total AI Actions', value: report.stats.approvalsTotal, color: '#1a3c5e' },
                { label: 'Approved', value: report.stats.approvalsApproved, color: '#10b981' },
                { label: 'Rejected', value: report.stats.approvalsTotal - report.stats.approvalsApproved, color: '#dc2626' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8f9fc', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Generated by Sales Scales AI Revenue System</div>
            <button style={{ background: '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 16px', fontSize: '11px', cursor: 'pointer' }}>
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}