import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Fatima() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [platformData, setPlatformData] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [checklistResult, setChecklistResult] = useState(null);
  const [clientHealth, setClientHealth] = useState([]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientsRes, contactsRes, workflowsRes, messagesRes, approvalsRes, enrollmentsRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('contacts').select('*'),
        supabase.from('workflows').select('*'),
        supabase.from('messages').select('*'),
        supabase.from('approvals').select('*'),
        supabase.from('workflow_enrollments').select('*'),
      ]);

      const clients = clientsRes.data || [];
      const contacts = contactsRes.data || [];
      const workflows = workflowsRes.data || [];
      const messages = messagesRes.data || [];
      const approvals = approvalsRes.data || [];
      const enrollments = enrollmentsRes.data || [];

      const healthData = clients.map(client => {
        const clientContacts = contacts.filter(c => c.client_id === client.id);
        const clientWorkflows = workflows.filter(w => w.client_id === client.id);
        const clientMessages = messages.filter(m => m.client_id === client.id);
        const clientEnrollments = enrollments.filter(e => e.client_id === client.id);
        const activeWorkflows = clientWorkflows.filter(w => w.status === 'active').length;
        const sentMessages = clientMessages.filter(m => m.direction === 'outbound').length;

        let score = 0;
        if (clientContacts.length > 0) score += 25;
        if (activeWorkflows > 0) score += 25;
        if (sentMessages > 0) score += 25;
        if (clientEnrollments.length > 0) score += 25;

        return {
          ...client,
          calculatedHealth: score,
          contactCount: clientContacts.length,
          activeWorkflows,
          messagesSent: sentMessages,
          enrollments: clientEnrollments.length,
          issues: [
            clientContacts.length === 0 && 'No contacts in database',
            activeWorkflows === 0 && 'No active workflows',
            sentMessages === 0 && 'No messages sent yet',
          ].filter(Boolean)
        };
      });

      setClientHealth(healthData);
      setPlatformData({
        clients, contacts, workflows, messages, approvals, enrollments,
        activeWorkflows: workflows.filter(w => w.status === 'active').length,
        pendingApprovals: approvals.filter(a => a.status === 'pending').length,
        activeEnrollments: enrollments.filter(e => e.status === 'active').length,
      });
    } catch (e) {
      console.error('Fatima data error:', e);
    }
    setLoading(false);
  };

  const callFatima = async (prompt) => {
    const response = await fetch('http://localhost:3001/fatima', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    return data.result || 'Unable to generate response.';
  };

  const generateAnalysis = async () => {
    if (!platformData) return;
    setLoading(true);
    setAnalysisResult(null);

    const prompt = `You are Fatima, the Operations Manager AI at Sales Scales. Analyze the platform operations and identify any issues:

Platform Data:
- Total Clients: ${platformData.clients.length}
- Total Contacts: ${platformData.contacts.length}
- Active Workflows: ${platformData.activeWorkflows}
- Total Workflows: ${platformData.workflows.length}
- Pending Approvals: ${platformData.pendingApprovals}
- Active Enrollments: ${platformData.activeEnrollments}
- Total Messages Sent: ${platformData.messages.filter(m => m.direction === 'outbound').length}

Client Health:
${clientHealth.map(c => `${c.name}: Score ${c.calculatedHealth}/100 — ${c.issues.length > 0 ? 'Issues: ' + c.issues.join(', ') : 'All good'}`).join('\n')}

Provide:
1. Overall platform health assessment
2. Any operational issues that need immediate attention
3. Which clients need attention and why
4. Workflow automation performance review
5. Three specific actions to improve platform performance this week

Be direct and operational. Focus on what needs to be fixed.`;

    const result = await callFatima(prompt);
    setAnalysisResult(result);
    setLoading(false);
  };

  const generateChecklist = async () => {
    if (!platformData) return;
    setLoading(true);
    setChecklistResult(null);

    const prompt = `You are Fatima, the Operations Manager AI at Sales Scales. Generate a daily operations checklist based on current platform status:

Current Status:
- Pending Approvals: ${platformData.pendingApprovals}
- Active Enrollments: ${platformData.activeEnrollments}
- Active Workflows: ${platformData.activeWorkflows}
- Clients with issues: ${clientHealth.filter(c => c.issues.length > 0).map(c => c.name).join(', ') || 'None'}

Generate a prioritized daily checklist with:
1. Urgent items — must do today
2. Important items — should do today
3. Regular maintenance — do if time allows
4. Weekly items — flag if overdue

Format as a clear actionable checklist. Be specific.`;

    const result = await callFatima(prompt);
    setChecklistResult(result);
    setLoading(false);
  };

  const tabs = [
    { id: 'overview', label: 'Operations Overview', icon: '⚙' },
    { id: 'health', label: 'Client Health', icon: '💚' },
    { id: 'analysis', label: 'Operations Analysis', icon: '📊' },
    { id: 'checklist', label: 'Daily Checklist', icon: '✅' },
  ];

  const ResultCard = ({ content }) => (
    <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '20px', marginTop: '16px', fontSize: '13px', color: '#0a1628', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
      {content}
    </div>
  );

  return (
    <div>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid rgba(124,58,237,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(124,58,237,0.15)', border: '1.5px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#7c3aed', fontWeight: 700 }}>F</div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Fatima</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Operations Manager AI · Sales Scales</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '9px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>● Active</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '14px', lineHeight: '1.6' }}>
          Fatima monitors all platform operations, tracks client health scores, manages workflow performance, and keeps Sales Scales running at full capacity.
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 600 : 400, background: activeTab === tab.id ? '#0a1628' : 'white', color: activeTab === tab.id ? 'white' : '#8896a8', borderColor: activeTab === tab.id ? '#0a1628' : '#e4e9f0', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* OPERATIONS OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Active Workflows', value: platformData?.activeWorkflows || 0, sub: 'running automatically', color: '#10b981' },
              { label: 'Pending Approvals', value: platformData?.pendingApprovals || 0, sub: 'need your review', color: platformData?.pendingApprovals > 0 ? '#dc2626' : '#10b981' },
              { label: 'Active Enrollments', value: platformData?.activeEnrollments || 0, sub: 'contacts in sequences', color: '#c9a84c' },
              { label: 'Total Messages', value: platformData?.messages?.length || 0, sub: 'sent and received', color: '#3b82f6' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>{stat.value}</div>
                <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Workflow Status</div>
              {platformData?.workflows?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#8896a8', fontSize: '12px' }}>No workflows yet</div>
              ) : platformData?.workflows?.map(w => (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f4f6fa' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#0a1628' }}>{w.name}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>{w.trigger_type}</div>
                  </div>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: w.status === 'active' ? '#ecfdf5' : '#fffbeb', color: w.status === 'active' ? '#059669' : '#d97706', border: `1px solid ${w.status === 'active' ? '#a7f3d0' : '#fde68a'}` }}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>Enrollment Status</div>
              {[
                { label: 'Active', value: platformData?.enrollments?.filter(e => e.status === 'active').length || 0, color: '#10b981' },
                { label: 'Completed', value: platformData?.enrollments?.filter(e => e.status === 'completed').length || 0, color: '#3b82f6' },
                { label: 'Paused', value: platformData?.enrollments?.filter(e => e.status === 'paused').length || 0, color: '#d97706' },
                { label: 'Cancelled', value: platformData?.enrollments?.filter(e => e.status === 'cancelled').length || 0, color: '#dc2626' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f4f6fa' }}>
                  <div style={{ fontSize: '12px', color: '#0a1628', fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CLIENT HEALTH */}
      {activeTab === 'health' && (
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Client Health Scores</div>
          {clientHealth.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>No clients yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {clientHealth.map(client => (
                <div key={client.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#c9a84c', fontWeight: 700 }}>
                        {client.name?.[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{client.name}</div>
                        <div style={{ fontSize: '10px', color: '#8896a8' }}>{client.niche || client.business_type}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: client.calculatedHealth >= 75 ? '#10b981' : client.calculatedHealth >= 50 ? '#d97706' : '#dc2626' }}>
                      {client.calculatedHealth}/100
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {[
                      { label: 'Contacts', value: client.contactCount },
                      { label: 'Workflows', value: client.activeWorkflows },
                      { label: 'Messages', value: client.messagesSent },
                      { label: 'Enrolled', value: client.enrollments },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#0a1628' }}>{stat.value}</div>
                        <div style={{ fontSize: '9px', color: '#8896a8' }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ height: '4px', background: '#f0f3f8', borderRadius: '2px', marginBottom: '8px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', background: client.calculatedHealth >= 75 ? '#10b981' : client.calculatedHealth >= 50 ? '#d97706' : '#dc2626', width: `${client.calculatedHealth}%`, transition: 'width 0.5s ease' }}></div>
                  </div>

                  {client.issues.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {client.issues.map(issue => (
                        <span key={issue} style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 600 }}>
                          ⚠ {issue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OPERATIONS ANALYSIS */}
      {activeTab === 'analysis' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>AI Operations Review</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Operations Analysis</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px' }}>Fatima analyzes all platform operations and tells you exactly what needs attention.</div>
          <button onClick={generateAnalysis} disabled={loading}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Fatima is analyzing...' : '📊 Generate Operations Analysis'}
          </button>
          {analysisResult && <ResultCard content={analysisResult} />}
        </div>
      )}

      {/* DAILY CHECKLIST */}
      {activeTab === 'checklist' && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Daily Operations</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '6px' }}>Daily Checklist</div>
          <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '16px' }}>Fatima generates a prioritized daily operations checklist based on current platform status.</div>
          <button onClick={generateChecklist} disabled={loading}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Fatima is preparing...' : '✅ Generate Daily Checklist'}
          </button>
          {checklistResult && <ResultCard content={checklistResult} />}
        </div>
      )}
    </div>
  );
}