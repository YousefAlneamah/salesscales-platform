import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Approvals() {
  const [approvals, setApprovals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterClient, setFilterClient] = useState('All');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    fetchApprovals();
    fetchClients();
  }, []);

  const fetchApprovals = async () => {
    setLoading(true);
    const { data } = await supabase.from('approvals').select('*').order('created_at', { ascending: false });
    if (data) setApprovals(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const approve = async (approval) => {
    await supabase.from('approvals').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', approval.id);
    fetchApprovals();
    if (selectedApproval?.id === approval.id) setSelectedApproval(null);
  };

  const reject = async (approval) => {
    if (!rejectReason) { alert('Please provide a reason'); return; }
    await supabase.from('approvals').update({ status: 'rejected', reviewed_at: new Date().toISOString(), rejection_reason: rejectReason }).eq('id', approval.id);
    setRejectReason('');
    setShowRejectForm(false);
    fetchApprovals();
    if (selectedApproval?.id === approval.id) setSelectedApproval(null);
  };

  const addTestApproval = async () => {
    const tests = [
      { title: 'Cart Recovery Email — 47 Customers', description: 'AI wants to send cart recovery email to 47 customers who abandoned carts over $150 in the last 24 hours.', content: 'Subject: You left something behind...\n\nHi {{first_name}},\n\nWe noticed you left your Luux bag in your cart. It is still waiting for you — and so is our lifetime warranty.\n\nComplete your order before it sells out.\n\nThe Luux Bags Team', type: 'email', channel: 'Email', priority: 'urgent', confidence: 72 },
      { title: 'Win-Back SMS — 340 Customers', description: 'AI identified 340 customers who purchased over 6 months ago with no activity. Estimated recovery $4,800.', content: 'Hi {{first_name}}, we miss you! Your next Luux Bag is waiting. Shop our new collection now and get free shipping on orders over $100.', type: 'sms', channel: 'SMS', priority: 'important', confidence: 88 },
      { title: 'Post Purchase Follow-Up — 23 Orders', description: 'AI wants to send a post-purchase check-in to customers who received their order in the last 3 days.', content: 'Hi {{first_name}}, how are you loving your new Luux bag? We would love to hear your feedback. Reply to this message anytime.', type: 'email', channel: 'Email', priority: 'low', confidence: 91 },
    ];
    const firstClient = clients[0];
    const random = tests[Math.floor(Math.random() * tests.length)];
    await supabase.from('approvals').insert([{ ...random, client_id: firstClient?.id || null, status: 'pending' }]);
    fetchApprovals();
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';

  const formatTime = (d) => {
    if (!d) return '—';
    const diff = new Date() - new Date(d);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const priorityStyle = (p) => {
    if (p === 'urgent') return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
    if (p === 'important') return { bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
    return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
  };

  const channelIcon = (ch) => ({ Email: '✉', SMS: '💬', WhatsApp: '📱', Instagram: '📸', Facebook: '👥' }[ch] || '📋');

  const filtered = approvals.filter(a => {
    const matchP = filterPriority === 'All' || a.priority === filterPriority;
    const matchS = filterStatus === 'All' || a.status === filterStatus;
    const matchC = filterClient === 'All' || a.client_id === filterClient;
    return matchP && matchS && matchC;
  });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const urgentCount = approvals.filter(a => a.priority === 'urgent' && a.status === 'pending').length;

  const inputStyle = {
    width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#0a1628',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif'
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Approval Queue</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>
            {pendingCount > 0 ? <span><span style={{ color: '#c9a84c' }}>{pendingCount} pending</span>{urgentCount > 0 ? ` · ${urgentCount} urgent` : ''}</span> : 'All clear'}
          </div>
        </div>
        <button onClick={addTestApproval}
          style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          + Test Approval
        </button>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Pending Review', value: approvals.filter(a => a.status === 'pending').length, sub: 'waiting for you', color: '#d97706' },
          { label: 'Urgent', value: urgentCount, sub: 'time sensitive', color: '#dc2626' },
          { label: 'Approved', value: approvals.filter(a => a.status === 'approved').length, sub: 'actions live', color: '#10b981' },
          { label: 'Rejected', value: approvals.filter(a => a.status === 'rejected').length, sub: 'AI learning', color: '#8896a8' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterStatus === s ? 600 : 400, background: filterStatus === s ? '#0a1628' : 'white', color: filterStatus === s ? 'white' : '#8896a8', borderColor: filterStatus === s ? '#0a1628' : '#e4e9f0' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        {['All', 'urgent', 'important', 'low'].map(p => (
          <button key={p} onClick={() => setFilterPriority(p)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterPriority === p ? 600 : 400, background: filterPriority === p ? '#c9a84c' : 'white', color: filterPriority === p ? '#0a1628' : '#8896a8', borderColor: filterPriority === p ? '#c9a84c' : '#e4e9f0' }}>
            {p === 'All' ? 'All Priority' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '150px', marginLeft: 'auto' }}>
          <option value="All">All Stores</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedApproval ? '1fr 1fr' : '1fr', gap: '16px' }}>
        {/* LIST */}
        <div>
          {loading ? (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '6px', fontSize: '14px' }}>All clear</div>
              <div style={{ fontSize: '12px', color: '#8896a8' }}>No approvals in this view</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(approval => {
                const ps = priorityStyle(approval.priority);
                return (
                  <div key={approval.id}
                    onClick={() => setSelectedApproval(selectedApproval?.id === approval.id ? null : approval)}
                    style={{ background: 'white', border: `1px solid ${selectedApproval?.id === approval.id ? '#c9a84c' : '#e4e9f0'}`, borderRadius: '12px', padding: '16px 18px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(10,22,40,0.04)', transition: 'border-color 0.1s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', border: '1px solid #e4e9f0', flexShrink: 0 }}>
                          {channelIcon(approval.channel)}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{approval.title}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                          {approval.priority.charAt(0).toUpperCase() + approval.priority.slice(1)}
                        </span>
                        <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: approval.status === 'approved' ? '#ecfdf5' : approval.status === 'rejected' ? '#fef2f2' : '#fffbeb', color: approval.status === 'approved' ? '#059669' : approval.status === 'rejected' ? '#dc2626' : '#d97706', border: `1px solid ${approval.status === 'approved' ? '#a7f3d0' : approval.status === 'rejected' ? '#fecaca' : '#fde68a'}` }}>
                          {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* CONFIDENCE BAR */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '9px', color: '#8896a8', width: '80px' }}>AI Confidence</div>
                      <div style={{ flex: 1, height: '3px', background: '#f0f3f8', borderRadius: '2px' }}>
                        <div style={{ height: '100%', borderRadius: '2px', background: approval.confidence >= 80 ? '#10b981' : approval.confidence >= 60 ? '#d97706' : '#dc2626', width: `${approval.confidence}%` }}></div>
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#0a1628', width: '30px', textAlign: 'right' }}>{approval.confidence}%</div>
                    </div>

                    <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '12px', lineHeight: '1.5' }}>{approval.description}</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#8896a8' }}>{getClientName(approval.client_id)} · {formatTime(approval.created_at)}</div>
                      {approval.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={e => { e.stopPropagation(); approve(approval); }}
                            style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '6px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                            ✓ Approve
                          </button>
                          <button onClick={e => { e.stopPropagation(); setSelectedApproval(approval); setShowRejectForm(true); }}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '7px', padding: '6px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                            ✗ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DETAIL */}
        {selectedApproval && (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', height: 'fit-content', position: 'sticky', top: 0, boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>Review Content</div>
              <button onClick={() => { setSelectedApproval(null); setShowRejectForm(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {(() => { const ps = priorityStyle(selectedApproval.priority); return (
                <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>{selectedApproval.priority}</span>
              );})()}
              <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#f8fafc', color: '#64748b', border: '1px solid #e4e9f0', fontWeight: 500 }}>{selectedApproval.channel}</span>
              <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#f8fafc', color: '#64748b', border: '1px solid #e4e9f0', fontWeight: 500 }}>{getClientName(selectedApproval.client_id)}</span>
            </div>

            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>AI Generated Content</div>
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '12px', color: '#475569', lineHeight: '1.7', whiteSpace: 'pre-wrap', border: '1px solid #f0f3f8' }}>
              {selectedApproval.content}
            </div>

            {selectedApproval.rejection_reason && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '14px', fontSize: '11px', color: '#dc2626' }}>
                <strong>Rejection reason:</strong> {selectedApproval.rejection_reason}
              </div>
            )}

            {showRejectForm && selectedApproval.status === 'pending' && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Reason for Rejection</div>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="Tell the AI why this is wrong so it learns and improves..."
                  rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '8px' }} />
                <button onClick={() => reject(selectedApproval)}
                  style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                  Confirm Rejection
                </button>
              </div>
            )}

            {selectedApproval.status === 'pending' && !showRejectForm && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => approve(selectedApproval)}
                  style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flex: 1 }}>
                  ✓ Approve & Send
                </button>
                <button onClick={() => setShowRejectForm(true)}
                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flex: 1 }}>
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