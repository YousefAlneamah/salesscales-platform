import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Approvals() {
  const [approvals, setApprovals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterClient, setFilterClient] = useState('All');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    fetchApprovals();
    fetchClients();
  }, []);

  const fetchApprovals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setApprovals(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const approve = async (approval) => {
    await supabase.from('approvals').update({
      status: 'approved',
      reviewed_at: new Date().toISOString()
    }).eq('id', approval.id);
    fetchApprovals();
    if (selectedApproval?.id === approval.id) setSelectedApproval(null);
  };

  const reject = async (approval) => {
    if (!rejectReason) {
      alert('Please provide a reason for rejection');
      return;
    }
    await supabase.from('approvals').update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectReason
    }).eq('id', approval.id);
    setRejectReason('');
    setShowRejectForm(false);
    fetchApprovals();
    if (selectedApproval?.id === approval.id) setSelectedApproval(null);
  };

  const addTestApproval = async () => {
    const testApprovals = [
      {
        title: 'Cart Recovery Email — 47 Customers',
        description: 'AI wants to send cart recovery email to 47 customers who abandoned carts over $150 in the last 24 hours.',
        content: 'Subject: You left something behind...\n\nHi {{first_name}},\n\nWe noticed you left your Luux weekender bag in your cart. It is still waiting for you — and so is our lifetime warranty.\n\nComplete your order before it sells out.\n\nThe Luux Bags Team',
        type: 'email',
        channel: 'Email',
        priority: 'urgent',
        confidence: 72
      },
      {
        title: 'New Listing Alert — 23 Leads',
        description: 'AI detected a new listing matching 23 leads in pipeline. Wants to fire new listing alert SMS within 30 minutes.',
        content: 'Hi {{first_name}}, a new 3-bedroom just listed in downtown that matches exactly what you told us you were looking for. $640K. Want to see it today?',
        type: 'sms',
        channel: 'SMS',
        priority: 'urgent',
        confidence: 85
      },
      {
        title: 'Discovery Call Follow-Up — 3 Leads',
        description: 'Post-call follow-up to 3 leads who attended discovery calls yesterday. Personalized emails addressing their specific objections.',
        content: 'Hi {{first_name}},\n\nThank you for our conversation yesterday. I loved hearing about where you want to take your business.\n\nBased on what you shared, I genuinely believe the 6-month program is the right fit for you. The client I mentioned who went from $5K to $40K per month had a very similar starting point to yours.\n\nI would love to get you started. Are you ready to take the next step?',
        type: 'email',
        channel: 'Email',
        priority: 'important',
        confidence: 91
      },
      {
        title: 'Win-Back Sequence — 340 Customers',
        description: 'AI identified 340 customers who purchased once over 6 months ago with no win-back sequence. Estimated recovery $4,800.',
        content: 'Subject: We miss you — and so does your next adventure\n\nHi {{first_name}},\n\nIt has been a while since your last Luux order. We have been busy designing new collections built for the way you travel.\n\nCome see what is new — we think you will love it.',
        type: 'email',
        channel: 'Email',
        priority: 'low',
        confidence: 88
      },
    ];

    const firstClient = clients[0];
    const random = testApprovals[Math.floor(Math.random() * testApprovals.length)];
    await supabase.from('approvals').insert([{
      ...random,
      client_id: firstClient?.id || null,
      status: 'pending'
    }]);
    fetchApprovals();
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : '—';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const priorityStyle = (priority) => {
    if (priority === 'urgent') return { background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca' };
    if (priority === 'important') return { background: '#fffbeb', color: '#d97706', border: '0.5px solid #fde68a' };
    return { background: '#ecfdf5', color: '#059669', border: '0.5px solid #a7f3d0' };
  };

  const statusStyle = (status) => {
    if (status === 'approved') return { background: '#ecfdf5', color: '#059669', border: '0.5px solid #a7f3d0' };
    if (status === 'rejected') return { background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca' };
    return { background: '#fffbeb', color: '#d97706', border: '0.5px solid #fde68a' };
  };

  const channelIcon = (channel) => {
    const icons = { Email: '📧', SMS: '📱', WhatsApp: '💬', Instagram: '📸', Facebook: '👥', Voice: '🎙️' };
    return icons[channel] || '📋';
  };

  const filtered = approvals.filter(a => {
    const matchPriority = filterPriority === 'All' || a.priority === filterPriority;
    const matchClient = filterClient === 'All' || a.client_id === filterClient;
    const matchStatus = filterStatus === 'All' || a.status === filterStatus;
    return matchPriority && matchClient && matchStatus;
  });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const urgentCount = approvals.filter(a => a.priority === 'urgent' && a.status === 'pending').length;

  const inputStyle = {
    width: '100%', border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>APPROVAL QUEUE</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            {pendingCount} pending · {urgentCount} urgent
          </div>
        </div>
        <button onClick={addTestApproval}
          style={{ background: '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
          + Add Test Approval
        </button>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'PENDING REVIEW', value: approvals.filter(a => a.status === 'pending').length, sub: 'waiting for you', color: '#d97706' },
          { label: 'URGENT', value: urgentCount, sub: 'time sensitive', color: '#dc2626' },
          { label: 'APPROVED TODAY', value: approvals.filter(a => a.status === 'approved').length, sub: 'actions live', color: '#10b981' },
          { label: 'REJECTED', value: approvals.filter(a => a.status === 'rejected').length, sub: 'AI learning', color: '#94a3b8' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', borderTop: `2px solid ${stat.color}` }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a3c5e' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: stat.color, marginTop: '2px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {['All', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '5px 12px', borderRadius: '20px', border: '0.5px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterStatus === s ? 600 : 400, background: filterStatus === s ? '#1a3c5e' : 'white', color: filterStatus === s ? 'white' : '#94a3b8', borderColor: filterStatus === s ? '#1a3c5e' : '#e2e8f0' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        {['All', 'urgent', 'important', 'low'].map(p => (
          <button key={p} onClick={() => setFilterPriority(p)}
            style={{ padding: '5px 12px', borderRadius: '20px', border: '0.5px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterPriority === p ? 600 : 400, background: filterPriority === p ? '#10b981' : 'white', color: filterPriority === p ? 'white' : '#94a3b8', borderColor: filterPriority === p ? '#10b981' : '#e2e8f0' }}>
            {p === 'All' ? 'All Priority' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ ...inputStyle, width: '150px', marginLeft: 'auto' }}>
          <option value="All">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedApproval ? '1fr 1fr' : '1fr', gap: '16px' }}>
        {/* APPROVALS LIST */}
        <div>
          {loading ? (
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading approvals...</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔔</div>
              <div style={{ fontWeight: 600, color: '#1a3c5e', marginBottom: '6px' }}>No approvals here</div>
              <div style={{ fontSize: '11px', marginBottom: '12px' }}>Click Add Test Approval to add a sample item</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(approval => (
                <div key={approval.id}
                  onClick={() => setSelectedApproval(selectedApproval?.id === approval.id ? null : approval)}
                  style={{ background: 'white', border: `0.5px solid ${selectedApproval?.id === approval.id ? '#10b981' : '#e2e8f0'}`, borderRadius: '10px', padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px' }}>{channelIcon(approval.channel)}</span>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a3c5e' }}>{approval.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', ...priorityStyle(approval.priority) }}>
                        {approval.priority.charAt(0).toUpperCase() + approval.priority.slice(1)}
                      </span>
                      <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', ...statusStyle(approval.status) }}>
                        {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* CONFIDENCE BAR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>AI Confidence</div>
                    <div style={{ flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '2px' }}>
                      <div style={{ height: '100%', borderRadius: '2px', background: approval.confidence >= 80 ? '#10b981' : approval.confidence >= 60 ? '#f59e0b' : '#ef4444', width: `${approval.confidence}%` }}></div>
                    </div>
                    <div style={{ fontSize: '9px', color: '#10b981', fontWeight: 600 }}>{approval.confidence}%</div>
                  </div>

                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '10px', lineHeight: '1.5' }}>{approval.description}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>{getClientName(approval.client_id)} · {formatTime(approval.created_at)}</div>
                    {approval.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={e => { e.stopPropagation(); approve(approval); }}
                          style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '10px', fontWeight: 500, cursor: 'pointer' }}>
                          ✓ Approve
                        </button>
                        <button onClick={e => { e.stopPropagation(); setSelectedApproval(approval); setShowRejectForm(true); }}
                          style={{ background: '#fef2f2', border: '0.5px solid #fecaca', color: '#dc2626', borderRadius: '6px', padding: '5px 12px', fontSize: '10px', cursor: 'pointer' }}>
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* APPROVAL DETAIL */}
        {selectedApproval && (
          <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px', height: 'fit-content', position: 'sticky', top: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a3c5e' }}>Review Content</div>
              <button onClick={() => { setSelectedApproval(null); setShowRejectForm(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', ...priorityStyle(selectedApproval.priority) }}>{selectedApproval.priority}</span>
              <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: '#f8f9fc', color: '#64748b', border: '0.5px solid #e2e8f0' }}>{selectedApproval.channel}</span>
              <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: '#f8f9fc', color: '#64748b', border: '0.5px solid #e2e8f0' }}>{getClientName(selectedApproval.client_id)}</span>
            </div>

            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '8px' }}>AI GENERATED CONTENT</div>
            <div style={{ background: '#f8f9fc', borderRadius: '8px', padding: '12px', marginBottom: '14px', fontSize: '11px', color: '#475569', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
              {selectedApproval.content}
            </div>

            {selectedApproval.rejection_reason && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '11px', color: '#dc2626' }}>
                <strong>Rejection reason:</strong> {selectedApproval.rejection_reason}
              </div>
            )}

            {showRejectForm && selectedApproval.status === 'pending' && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>REASON FOR REJECTION</div>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="Tell the AI why this is wrong so it learns..."
                  rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '8px' }} />
                <button onClick={() => reject(selectedApproval)}
                  style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', width: '100%' }}>
                  Confirm Rejection
                </button>
              </div>
            )}

            {selectedApproval.status === 'pending' && !showRejectForm && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => approve(selectedApproval)}
                  style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '9px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', flex: 1 }}>
                  ✓ Approve & Send
                </button>
                <button onClick={() => setShowRejectForm(true)}
                  style={{ background: '#fef2f2', border: '0.5px solid #fecaca', color: '#dc2626', borderRadius: '7px', padding: '9px 14px', fontSize: '12px', cursor: 'pointer', flex: 1 }}>
                  ✗ Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}