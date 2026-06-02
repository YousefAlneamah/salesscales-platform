import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';
import { API_BASE } from '../config';

const TYPE_LABELS = {
  email_sequence: 'Email Sequence',
  sms_sequence: 'SMS Sequence',
  outreach_message: 'Outreach Message',
  client_checkin: 'Client Check-in',
  prospect: 'Prospect',
};

const TYPE_COLORS = {
  email_sequence: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  sms_sequence:   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  outreach_message: { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff' },
  client_checkin: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  prospect:       { bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
};

const MEMBER_COLORS = {
  hussain: '#3b82f6', hassan: '#10b981', ali: '#c9a84c',
  mahdi: '#8b5cf6', fatima: '#f59e0b', zainab: '#ec4899',
};

const PRIORITY_STYLES = {
  urgent: { bg: '#fee2e2', color: '#dc2626', border: '#fecaca', label: '● Urgent' },
  high:   { bg: '#fffbeb', color: '#c9a84c', border: '#fde68a', label: '● High' },
  normal: { bg: '#f8fafc', color: '#8896a8', border: '#e4e9f0', label: '● Normal' },
};

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2 };

const MEMBER_LABELS = {
  hussain: 'Hussain AI', hassan: 'Hassan AI', ali: 'Ali AI',
  mahdi: 'Mahdi AI', fatima: 'Fatima AI', zainab: 'Zainab AI', system: 'System',
};

export default function Approvals() {
  const [approvals, setApprovals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterType, setFilterType] = useState('All');
  const [filterClient, setFilterClient] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSteps, setEditSteps] = useState([]);

  const isSeq = (a) => ['email_sequence', 'sms_sequence', 'whatsapp_sequence'].includes(a?.type);

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

  const action = async (approvalId, act) => {
    setActioning(true);
    try {
      await axios.post(`${API_BASE}/approvals/action`, {
        approval_id: approvalId,
        action: act,
        feedback: feedback || undefined,
        edited_content: act === 'approve' && editing && !isSeq(selected) ? editContent : undefined,
        edited_steps: act === 'approve' && editing && isSeq(selected) ? editSteps : undefined,
      });
      setFeedback('');
      setShowReject(false);
      setEditing(false);
      setEditContent('');
      setEditSteps([]);
      setSelected(null);
      await fetchApprovals();
    } catch (e) {
      alert(e.response?.data?.error || 'Action failed');
    } finally {
      setActioning(false);
    }
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';

  const formatTime = (d) => {
    if (!d) return '—';
    const diff = Date.now() - new Date(d);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const typeStyle = (t) => TYPE_COLORS[t] || { bg: '#f8fafc', color: '#64748b', border: '#e4e9f0' };

  const filtered = approvals
    .filter(a => {
      const matchS = filterStatus === 'All' || a.status === filterStatus;
      const matchT = filterType === 'All' || a.type === filterType;
      const matchC = filterClient === 'All' || a.client_id === filterClient;
      const matchP = filterPriority === 'All' || (a.priority || 'normal') === filterPriority;
      return matchS && matchT && matchC && matchP;
    })
    .sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortOrder === 'client') return (getClientName(a.client_id) || '').localeCompare(getClientName(b.client_id) || '');
      if (sortOrder === 'priority') {
        const pa = PRIORITY_ORDER[a.priority || 'normal'] ?? 2;
        const pb = PRIORITY_ORDER[b.priority || 'normal'] ?? 2;
        if (pa !== pb) return pa - pb;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  const [approvedAnim, setApprovedAnim] = useState({});

  const actionWithAnim = async (approvalId, act) => {
    if (act === 'approve') {
      setApprovedAnim(prev => ({ ...prev, [approvalId]: true }));
      await new Promise(r => setTimeout(r, 600));
    }
    await action(approvalId, act);
    setApprovedAnim(prev => { const n = { ...prev }; delete n[approvalId]; return n; });
  };

  const inputStyle = {
    width: '100%', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#f0f4f8',
    outline: 'none', background: 'rgba(255,255,255,0.05)', boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Approval Queue</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>
            {pendingCount > 0
              ? <><span style={{ color: '#c9a84c' }}>{pendingCount} pending</span> — approve or reject each action</>
              : 'All clear'}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Pending Review', value: approvals.filter(a => a.status === 'pending').length, sub: 'waiting for you', color: '#f59e0b' },
          { label: 'Sequences', value: approvals.filter(a => a.status === 'pending' && (a.type === 'email_sequence' || a.type === 'sms_sequence')).length, sub: 'ready to activate', color: '#60a5fa' },
          { label: 'Auto-Approved', value: approvals.filter(a => a.status === 'auto_approved').length, sub: 'score 9–10 · live', color: '#a78bfa' },
          { label: 'Approved', value: approvals.filter(a => a.status === 'approved').length, sub: 'actions executed', color: '#34d399' },
          { label: 'Rejected', value: approvals.filter(a => a.status === 'rejected').length, sub: 'AI feedback logged', color: '#8896a8' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderTop: `2px solid ${stat.color}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 10 }}>{stat.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#f0f4f8', letterSpacing: '-1px', lineHeight: 1, marginBottom: 6 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: stat.color, fontWeight: 600 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {['pending', 'approved', 'auto_approved', 'rejected', 'All'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterStatus === s ? 600 : 400, background: filterStatus === s ? (s === 'auto_approved' ? '#7c3aed' : '#0a1628') : 'white', color: filterStatus === s ? 'white' : '#8896a8', borderColor: filterStatus === s ? (s === 'auto_approved' ? '#7c3aed' : '#0a1628') : '#e4e9f0' }}>
            {s === 'All' ? 'All Status' : s === 'auto_approved' ? '⚡ Auto-Approved' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div style={{ width: '1px', height: '20px', background: '#e4e9f0', margin: '0 2px' }} />
        {[{ v: 'All', label: 'All Priority' }, { v: 'urgent', label: '● Urgent' }, { v: 'high', label: '● High' }, { v: 'normal', label: '● Normal' }].map(({ v, label }) => {
          const ps = PRIORITY_STYLES[v] || {};
          const active = filterPriority === v;
          return (
            <button key={v} onClick={() => setFilterPriority(v)}
              style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: active ? 600 : 400, background: active ? (ps.bg || '#c9a84c') : 'white', color: active ? (ps.color || '#0a1628') : '#8896a8', borderColor: active ? (ps.border || '#c9a84c') : '#e4e9f0' }}>
              {label}
            </button>
          );
        })}
        <div style={{ width: '1px', height: '20px', background: '#e4e9f0', margin: '0 4px' }} />
        {['All', 'email_sequence', 'sms_sequence', 'client_checkin', 'prospect', 'outreach_message'].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterType === t ? 600 : 400, ...(filterType === t && t !== 'All' ? { background: typeStyle(t).bg, color: typeStyle(t).color, borderColor: typeStyle(t).border } : filterType === t ? { background: '#c9a84c', color: '#0a1628', borderColor: '#c9a84c' } : { background: 'white', color: '#8896a8', borderColor: '#e4e9f0' }) }}>
            {t === 'All' ? 'All Types' : TYPE_LABELS[t] || t}
          </button>
        ))}
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '140px', marginLeft: 'auto' }}>
          <option value="All">All Stores</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ ...inputStyle, width: '140px' }}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="client">By Client</option>
          <option value="priority">By Priority</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: '16px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {filtered.map(approval => {
                const memberColor = MEMBER_COLORS[approval.from_member] || '#8896a8';
                const priorityBorder = approval.priority === 'urgent' ? '#ef4444' : approval.priority === 'high' ? '#c9a84c' : 'rgba(255,255,255,0.12)';
                const isAnimApproved = approvedAnim[approval.id];
                return (
                  <div key={approval.id}
                    onClick={() => { setSelected(selected?.id === approval.id ? null : approval); setShowReject(false); setFeedback(''); setEditing(false); setEditContent(''); setEditSteps([]); }}
                    style={{ background: '#0f1f35', border: `1px solid ${selected?.id === approval.id ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.06)'}`, borderLeft: `4px solid ${priorityBorder}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative', overflow: 'hidden' }}>

                    {/* Member avatar chip */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {approval.from_member && (
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: memberColor + '22', border: `1px solid ${memberColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: memberColor, flexShrink: 0 }}>
                            {(approval.from_member || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: memberColor }}>{MEMBER_LABELS[approval.from_member] || 'System'}</div>
                          <div style={{ fontSize: 9, color: '#4a5568' }}>{formatTime(approval.created_at)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {approval.priority && approval.priority !== 'normal' && (
                          <span style={{ fontSize: 8, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: priorityBorder + '18', color: priorityBorder, border: `1px solid ${priorityBorder}44` }}>
                            {approval.priority.toUpperCase()}
                          </span>
                        )}
                        {approval.type && (
                          <span style={{ fontSize: 8, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: memberColor + '12', color: memberColor, border: `1px solid ${memberColor}25` }}>
                            {TYPE_LABELS[approval.type] || approval.type}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4f8', marginBottom: 6, lineHeight: 1.4 }}>{approval.title}</div>

                    {/* Content preview */}
                    {approval.content && (
                      <div style={{ fontSize: 11, color: '#8896a8', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 10 }}>
                        {approval.content}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 10, color: '#4a5568' }}>{getClientName(approval.client_id)}</div>
                      {/* Status badge */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {approval.confidence_score != null && (
                          <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 20, fontWeight: 700, background: approval.confidence_score >= 9 ? 'rgba(124,58,237,0.15)' : approval.confidence_score >= 7 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)', color: approval.confidence_score >= 9 ? '#a78bfa' : approval.confidence_score >= 7 ? '#60a5fa' : '#f87171', border: `1px solid ${approval.confidence_score >= 9 ? 'rgba(124,58,237,0.3)' : 'rgba(59,130,246,0.3)'}` }}>
                            {approval.confidence_score}/10
                          </span>
                        )}
                        <span style={{ fontSize: 9, padding: '3px 9px', borderRadius: 20, fontWeight: 700,
                          background: approval.status === 'auto_approved' ? 'rgba(124,58,237,0.15)' : approval.status === 'approved' ? 'rgba(16,185,129,0.12)' : approval.status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(217,119,6,0.12)',
                          color: approval.status === 'auto_approved' ? '#a78bfa' : approval.status === 'approved' ? '#34d399' : approval.status === 'rejected' ? '#f87171' : '#f59e0b',
                          border: `1px solid ${approval.status === 'auto_approved' ? 'rgba(124,58,237,0.3)' : approval.status === 'approved' ? 'rgba(16,185,129,0.25)' : approval.status === 'rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(217,119,6,0.25)'}`,
                        }}>
                          {approval.status === 'auto_approved' ? '⚡ Auto-Approved' : approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Approve / Reject buttons */}
                    {approval.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => actionWithAnim(approval.id, 'approve')}
                          style={{ flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.3s', background: isAnimApproved ? '#10b981' : 'rgba(16,185,129,0.15)', color: isAnimApproved ? '#fff' : '#34d399' }}>
                          {isAnimApproved ? '✓ Approved!' : '✓ Approve'}
                        </button>
                        <button onClick={() => { setSelected(approval); setShowReject(true); }}
                          style={{ flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 700, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#f87171', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DETAIL PANEL */}
        {selected && (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', height: 'fit-content', position: 'sticky', top: 0, boxShadow: '0 4px 12px rgba(10,22,40,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>Review</div>
              <button onClick={() => { setSelected(null); setShowReject(false); setFeedback(''); setEditing(false); setEditContent(''); setEditSteps([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {(() => { const ps = PRIORITY_STYLES[selected.priority || 'normal'] || PRIORITY_STYLES.normal; return (
                <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>{ps.label}</span>
              );})()}
              {selected.type && (() => { const ts = typeStyle(selected.type); return (
                <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>{TYPE_LABELS[selected.type] || selected.type}</span>
              );})()}
              {selected.from_member && (() => { const mc = MEMBER_COLORS[selected.from_member] || '#8896a8'; return (
                <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: mc + '18', color: mc, border: `1px solid ${mc}30` }}>{MEMBER_LABELS[selected.from_member] || selected.from_member}</span>
              );})()}
              {selected.client_id && (
                <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#f8fafc', color: '#64748b', border: '1px solid #e4e9f0', fontWeight: 500 }}>{getClientName(selected.client_id)}</span>
              )}
            </div>

            {/* Metadata details */}
            {selected.metadata && Object.keys(selected.metadata).length > 0 && selected.type !== 'email_sequence' && selected.type !== 'sms_sequence' && (
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', border: '1px solid #f0f3f8' }}>
                {selected.metadata.to_email && <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}><strong>To:</strong> {selected.metadata.to_email}</div>}
                {selected.metadata.subject && <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}><strong>Subject:</strong> {selected.metadata.subject}</div>}
                {selected.metadata.channel && <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}><strong>Channel:</strong> {selected.metadata.channel}</div>}
                {selected.metadata.niche && <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}><strong>Niche:</strong> {selected.metadata.niche}</div>}
                {selected.metadata.pain_point && <div style={{ fontSize: '11px', color: '#64748b' }}><strong>Pain Point:</strong> {selected.metadata.pain_point}</div>}
              </div>
            )}

            {/* Steps preview for sequences (read-only) */}
            {isSeq(selected) && !editing && selected.metadata?.steps?.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{selected.metadata.steps.filter(s => s.step_type !== 'wait').length} Steps · {selected.metadata.trigger_type || 'manual'} trigger</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selected.metadata.steps.map((step, i) => (
                    <div key={i} style={{ background: step.step_type === 'wait' ? '#f8fafc' : '#f0f3f8', borderRadius: '6px', padding: '8px 10px', border: '1px solid #e4e9f0' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: step.step_type === 'wait' ? '#8896a8' : '#0a1628', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: step.step_type !== 'wait' ? '4px' : 0 }}>
                        {step.step_type === 'wait' ? `⏱ Wait ${step.wait_hours || 0}h` : `Step ${i + 1} — ${step.step_type}`}
                      </div>
                      {step.subject && <div style={{ fontSize: '11px', color: '#4a5568', marginBottom: '2px' }}><strong>Subject:</strong> {step.subject}</div>}
                      {step.content && step.step_type !== 'wait' && (
                        <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{step.content}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-step editor for sequences */}
            {editing && isSeq(selected) && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                  Edit Steps<span style={{ color: '#c9a84c', marginLeft: '6px' }}>· editing</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {editSteps.map((step, i) => (
                    <div key={i} style={{ background: step.step_type === 'wait' ? '#f8fafc' : '#fff', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e4e9f0' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: step.step_type === 'wait' ? '#8896a8' : '#0a1628', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: step.step_type !== 'wait' ? '6px' : 0 }}>
                        {step.step_type === 'wait' ? `⏱ Wait ${step.wait_hours || 0}h` : `Step ${i + 1} — ${step.step_type}`}
                      </div>
                      {step.step_type !== 'wait' && (
                        <>
                          {(step.step_type === 'email' || step.subject !== undefined) && (
                            <input value={step.subject || ''} placeholder="Subject"
                              onChange={e => setEditSteps(prev => prev.map((s, j) => j === i ? { ...s, subject: e.target.value } : s))}
                              style={{ ...inputStyle, marginBottom: '6px', fontWeight: 600 }} />
                          )}
                          <textarea value={step.content || ''}
                            onChange={e => setEditSteps(prev => prev.map((s, j) => j === i ? { ...s, content: e.target.value } : s))}
                            rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6', minHeight: '72px' }} />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            {((selected.content && !editing) || (editing && !isSeq(selected))) && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                  Content{editing && <span style={{ color: '#c9a84c', marginLeft: '6px' }}>· editing</span>}
                </div>
                {editing ? (
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                    rows={10}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7', minHeight: '160px' }} />
                ) : (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#475569', lineHeight: '1.7', whiteSpace: 'pre-wrap', border: '1px solid #f0f3f8', maxHeight: '200px', overflowY: 'auto' }}>
                    {selected.content}
                  </div>
                )}
              </div>
            )}

            {selected.feedback && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '11px', color: '#dc2626' }}>
                <strong>Feedback logged:</strong> {selected.feedback}
              </div>
            )}

            {showReject && selected.status === 'pending' && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Feedback for AI</div>
                <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
                  placeholder="Tell the AI why this is wrong so it learns and improves..."
                  rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => action(selected.id, 'reject')} disabled={actioning}
                    style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flex: 1, opacity: actioning ? 0.6 : 1 }}>
                    Confirm Rejection
                  </button>
                  <button onClick={() => { setShowReject(false); setFeedback(''); }}
                    style={{ background: 'white', border: '1px solid #e4e9f0', color: '#64748b', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {selected.status === 'pending' && !showReject && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => action(selected.id, 'approve')} disabled={actioning}
                  style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flex: 1, opacity: actioning ? 0.6 : 1 }}>
                  ✓ {editing ? 'Save & Approve' : 'Approve & Execute'}
                </button>
                {editing ? (
                  <button onClick={() => { setEditing(false); setEditContent(''); setEditSteps([]); }}
                    style={{ background: 'white', border: '1px solid #e4e9f0', color: '#64748b', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancel Edit
                  </button>
                ) : (
                  <button onClick={() => { setEditing(true); setEditContent(selected.content || ''); setEditSteps(isSeq(selected) ? (selected.metadata?.steps || []).map(s => ({ ...s })) : []); }}
                    style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    ✎ Edit
                  </button>
                )}
                <button onClick={() => setShowReject(true)}
                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
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
