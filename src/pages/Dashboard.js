import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalContacts: 0,
    totalWorkflows: 0,
    activeWorkflows: 0,
    totalDeals: 0,
    pipelineValue: 0,
    pendingApprovals: 0,
    totalMessages: 0,
    unreadMessages: 0,
    knowledgeDocs: 0,
  });
  const [clients, setClients] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [recentApprovals, setRecentApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        clientsRes, contactsRes, workflowsRes,
        dealsRes, approvalsRes, messagesRes, knowledgeRes
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('workflows').select('*'),
        supabase.from('pipeline_deals').select('*'),
        supabase.from('approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
        supabase.from('messages').select('*'),
        supabase.from('knowledge_base').select('*'),
      ]);

      const allContacts = await supabase.from('contacts').select('count', { count: 'exact' });

      setClients(clientsRes.data || []);
      setRecentContacts(contactsRes.data || []);
      setRecentApprovals(approvalsRes.data || []);

      const deals = dealsRes.data || [];
      const workflows = workflowsRes.data || [];
      const messages = messagesRes.data || [];

      setStats({
        totalClients: clientsRes.data?.length || 0,
        totalContacts: allContacts.count || 0,
        totalWorkflows: workflows.length,
        activeWorkflows: workflows.filter(w => w.status === 'active').length,
        totalDeals: deals.length,
        pipelineValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
        pendingApprovals: approvalsRes.data?.length || 0,
        totalMessages: messages.length,
        unreadMessages: messages.filter(m => m.status === 'unread').length,
        knowledgeDocs: knowledgeRes.data?.length || 0,
      });
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    }
    setLoading(false);
  };

  const getHealthColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const formatTime = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const priorityStyle = (priority) => {
    if (priority === 'urgent') return { background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca' };
    if (priority === 'important') return { background: '#fffbeb', color: '#d97706', border: '0.5px solid #fde68a' };
    return { background: '#ecfdf5', color: '#059669', border: '0.5px solid #a7f3d0' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', fontSize: '13px' }}>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div>
      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'ACTIVE CLIENTS', value: stats.totalClients, sub: 'on the platform', color: '#10b981' },
          { label: 'TOTAL CONTACTS', value: stats.totalContacts, sub: 'in database', color: '#10b981' },
          { label: 'ACTIVE WORKFLOWS', value: stats.activeWorkflows, sub: `${stats.totalWorkflows} total`, color: '#10b981' },
          { label: 'PIPELINE VALUE', value: '$' + stats.pipelineValue.toLocaleString(), sub: `${stats.totalDeals} deals`, color: '#10b981' },
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
          { label: 'PENDING APPROVALS', value: stats.pendingApprovals, sub: 'waiting for review', color: '#d97706' },
          { label: 'UNREAD MESSAGES', value: stats.unreadMessages, sub: `${stats.totalMessages} total`, color: '#3b82f6' },
          { label: 'KNOWLEDGE DOCS', value: stats.knowledgeDocs, sub: 'AI trained', color: '#8b5cf6' },
          { label: 'CLIENT BRAINS', value: stats.totalClients, sub: 'AI brains active', color: '#10b981' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', borderTop: `2px solid ${stat.color}` }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a3c5e' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: stat.color, marginTop: '2px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* AI MORNING OPPORTUNITY */}
      <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderLeft: '3px solid #10b981', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }}></div>
          <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 600, letterSpacing: '0.5px' }}>AI MORNING OPPORTUNITY</div>
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
          {stats.totalContacts === 0
            ? <span>Start by adding contacts to the platform. Connect a Shopify store or add contacts manually to begin building your pipeline.</span>
            : stats.pendingApprovals > 0
            ? <span>You have <strong style={{ color: '#1a3c5e' }}>{stats.pendingApprovals} items</strong> waiting in your approval queue. Review and approve them to keep your automations running at full speed.</span>
            : stats.activeWorkflows === 0
            ? <span>You have <strong style={{ color: '#1a3c5e' }}>{stats.totalContacts} contacts</strong> in the database but no active workflows. Create a workflow to start automating your outreach.</span>
            : <span>Platform is running strong. <strong style={{ color: '#1a3c5e' }}>{stats.activeWorkflows} workflows</strong> active across <strong style={{ color: '#1a3c5e' }}>{stats.totalClients} clients</strong> with <strong style={{ color: '#1a3c5e' }}>{stats.totalContacts} contacts</strong> in the database.</span>
          }
        </div>
        <button style={{ marginTop: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
          View Approvals →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* CLIENT OVERVIEW */}
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>CLIENT OVERVIEW</div>
          {clients.length === 0 ? (
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
              No clients yet. Add your first client.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {clients.map(client => (
                <div key={client.id} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a3c5e' }}>{client.name}</div>
                    <div style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: client.health_score >= 70 ? '#ecfdf5' : '#fffbeb', color: client.health_score >= 70 ? '#059669' : '#d97706', border: `0.5px solid ${client.health_score >= 70 ? '#a7f3d0' : '#fde68a'}` }}>
                      {client.health_score}/100
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Business type</span>
                    <span style={{ fontSize: '10px', color: '#475569' }}>{client.business_type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Status</span>
                    <span style={{ fontSize: '10px', color: client.status === 'live' ? '#10b981' : '#94a3b8' }}>
                      {client.status?.charAt(0).toUpperCase() + client.status?.slice(1)}
                    </span>
                  </div>
                  <div style={{ height: '3px', background: '#e2e8f0', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', background: getHealthColor(client.health_score), width: `${client.health_score}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* PENDING APPROVALS */}
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>PENDING APPROVALS</div>
            {recentApprovals.length === 0 ? (
              <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                No pending approvals
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recentApprovals.map(approval => (
                  <div key={approval.id} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: '#1a3c5e', marginBottom: '3px' }}>{approval.title}</div>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>{formatTime(approval.created_at)}</div>
                    </div>
                    <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', ...priorityStyle(approval.priority) }}>
                      {approval.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RECENT CONTACTS */}
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>RECENT CONTACTS</div>
            {recentContacts.length === 0 ? (
              <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                No contacts yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recentContacts.map(contact => (
                  <div key={contact.id} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ecfdf5', border: '0.5px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#10b981', fontWeight: 600, flexShrink: 0 }}>
                      {contact.first_name?.[0]}{contact.last_name?.[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: '#1a3c5e' }}>{contact.first_name} {contact.last_name}</div>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>{contact.email} · {contact.source}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}