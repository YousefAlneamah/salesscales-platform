import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalContacts: 0,
    activeWorkflows: 0,
    totalWorkflows: 0,
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

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [clientsRes, contactsRes, workflowsRes, dealsRes, approvalsRes, messagesRes, knowledgeRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(4),
        supabase.from('workflows').select('*'),
        supabase.from('pipeline_deals').select('*'),
        supabase.from('approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
        supabase.from('messages').select('*'),
        supabase.from('knowledge_base').select('*'),
      ]);

      setClients(clientsRes.data || []);
      setRecentContacts(contactsRes.data || []);
      setRecentApprovals(approvalsRes.data || []);

      const deals = dealsRes.data || [];
      const workflows = workflowsRes.data || [];
      const messages = messagesRes.data || [];

      setStats({
        totalClients: clientsRes.data?.length || 0,
        totalContacts: contactsRes.data?.length || 0,
        activeWorkflows: workflows.filter(w => w.status === 'active').length,
        totalWorkflows: workflows.length,
        totalDeals: deals.length,
        pipelineValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
        pendingApprovals: approvalsRes.data?.length || 0,
        totalMessages: messages.length,
        unreadMessages: messages.filter(m => m.status === 'unread').length,
        knowledgeDocs: knowledgeRes.data?.length || 0,
      });
    } catch (e) {
      console.error('Dashboard error:', e);
    }
    setLoading(false);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '—';
    const diff = new Date() - new Date(dateString);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '2px solid #e4e9f0', borderTop: '2px solid #c9a84c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}></div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  const primaryStats = [
    { label: 'Active Clients', value: stats.totalClients, sub: 'on platform', accent: '#c9a84c' },
    { label: 'Total Contacts', value: stats.totalContacts, sub: 'in database', accent: '#c9a84c' },
    { label: 'Active Workflows', value: stats.activeWorkflows, sub: `${stats.totalWorkflows} total built`, accent: '#c9a84c' },
    { label: 'Pipeline Value', value: `$${stats.pipelineValue.toLocaleString()}`, sub: `${stats.totalDeals} active deals`, accent: '#c9a84c' },
  ];

  const secondaryStats = [
    { label: 'Pending Approvals', value: stats.pendingApprovals, sub: 'need your review', accent: '#dc2626' },
    { label: 'Unread Messages', value: stats.unreadMessages, sub: `${stats.totalMessages} total`, accent: '#3b82f6' },
    { label: 'Knowledge Docs', value: stats.knowledgeDocs, sub: 'AI trained', accent: '#10b981' },
    { label: 'AI Brains Active', value: stats.totalClients, sub: 'client brains', accent: '#10b981' },
  ];

  return (
    <div>
      {/* PRIMARY STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '14px' }}>
        {primaryStats.map(stat => (
          <div key={stat.label} style={{
            background: 'white',
            border: '1px solid #e4e9f0',
            borderRadius: '12px',
            padding: '20px',
            borderTop: `2px solid ${stat.accent}`,
            boxShadow: '0 1px 3px rgba(10,22,40,0.06)',
          }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px' }}>{stat.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '6px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.accent, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* SECONDARY STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {secondaryStats.map(stat => (
          <div key={stat.label} style={{
            background: 'white',
            border: '1px solid #e4e9f0',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(10,22,40,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${stat.accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: stat.accent }}>{stat.value}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628', marginBottom: '2px' }}>{stat.label}</div>
              <div style={{ fontSize: '10px', color: '#8896a8' }}>{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* AI MORNING BRIEFING */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #112240 100%)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '20px',
        border: '1px solid rgba(201,168,76,0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '100%', background: 'linear-gradient(135deg, transparent, rgba(201,168,76,0.05))', pointerEvents: 'none' }}></div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '6px', height: '6px', background: '#c9a84c', borderRadius: '50%' }}></div>
              <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>Hussain — Morning Briefing</div>
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.7' }}>
              {stats.pendingApprovals > 0
                ? <span>You have <strong style={{ color: '#c9a84c' }}>{stats.pendingApprovals} AI actions</strong> waiting for your approval. Review them to keep your automations running at full speed.</span>
                : stats.activeWorkflows === 0
                ? <span>No active workflows running. Create a workflow to start automating your client revenue systems.</span>
                : <span>Platform running strong. <strong style={{ color: '#c9a84c' }}>{stats.activeWorkflows} workflows</strong> active across <strong style={{ color: '#c9a84c' }}>{stats.totalClients} clients</strong> with <strong style={{ color: '#c9a84c' }}>{stats.totalContacts} contacts</strong> in the system.</span>
              }
            </div>
          </div>
          <button style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c', borderRadius: '8px', padding: '8px 16px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginLeft: '20px' }}>
            View Approvals →
          </button>
        </div>
      </div>

      {/* BOTTOM GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
        {/* CLIENT OVERVIEW */}
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Client Overview</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clients.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '30px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
                No clients yet
              </div>
            ) : clients.map(client => (
              <div key={client.id} style={{
                background: 'white',
                border: '1px solid #e4e9f0',
                borderRadius: '12px',
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(10,22,40,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#c9a84c', fontWeight: 700 }}>
                      {client.name?.[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{client.name}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '1px' }}>{client.niche || client.business_type}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: client.status === 'live' ? '#ecfdf5' : '#fffbeb', color: client.status === 'live' ? '#059669' : '#d97706', border: `1px solid ${client.status === 'live' ? '#a7f3d0' : '#fde68a'}`, fontWeight: 600 }}>
                      {client.status?.charAt(0).toUpperCase() + client.status?.slice(1)}
                    </span>
                    <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#f0f3f8', color: '#8896a8', border: '1px solid #e4e9f0', fontWeight: 600 }}>
                      {client.tier?.charAt(0).toUpperCase() + client.tier?.slice(1)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '3px', background: '#f0f3f8', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', background: client.health_score >= 70 ? '#c9a84c' : '#f59e0b', width: `${client.health_score || 0}%`, transition: 'width 0.5s ease' }}></div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#8896a8', flexShrink: 0 }}>Health {client.health_score}/100</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* PENDING APPROVALS */}
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Pending Approvals</div>
            {recentApprovals.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#8896a8', fontSize: '11px' }}>
                All clear — no pending approvals
              </div>
            ) : recentApprovals.map(approval => (
              <div key={approval.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '12px 14px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#0a1628', marginBottom: '2px' }}>{approval.title}</div>
                  <div style={{ fontSize: '9px', color: '#8896a8' }}>{formatTime(approval.created_at)}</div>
                </div>
                <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', background: approval.priority === 'urgent' ? '#fef2f2' : '#fffbeb', color: approval.priority === 'urgent' ? '#dc2626' : '#d97706', border: `1px solid ${approval.priority === 'urgent' ? '#fecaca' : '#fde68a'}`, fontWeight: 600, flexShrink: 0 }}>
                  {approval.priority}
                </span>
              </div>
            ))}
          </div>

          {/* RECENT CONTACTS */}
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Recent Contacts</div>
            {recentContacts.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#8896a8', fontSize: '11px' }}>
                No contacts yet
              </div>
            ) : recentContacts.map(contact => (
              <div key={contact.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '10px 14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>
                  {contact.first_name?.[0]}{contact.last_name?.[0]}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#0a1628', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.first_name} {contact.last_name}</div>
                  <div style={{ fontSize: '9px', color: '#8896a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contact.source}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}