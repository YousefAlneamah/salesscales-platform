import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';

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
      await axios.post('http://localhost:3001/approvals/action', {
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

  const filtered = approvals.filter(a => {
    const matchS = filterStatus === 'All' || a.status === filterStatus;
    const matchT = filterType === 'All' || a.type === filterType;
    const matchC = filterClient === 'All' || a.client_id === filterClient;
    return matchS && matchT && matchC;
  });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

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
            {pendingCount > 0
              ? <><span style={{ color: '#c9a84c' }}>{pendingCount} pending</span> — approve or reject each action</>
              : 'All clear'}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Pending Review', value: approvals.filter(a => a.status === 'pending').length, sub: 'waiting for you', color: '#d97706' },
          { label: 'Sequences', value: approvals.filter(a => a.status === 'pending' && (a.type === 'email_sequence' || a.type === 'sms_sequence')).length, sub: 'ready to activate', color: '#2563eb' },
          { label: 'Approved', value: approvals.filter(a => a.status === 'approved').length, sub: 'actions executed', color: '#10b981' },
          { label: 'Rejected', value: approvals.filter(a => a.status === 'rejected').length, sub: 'AI feedback logged', color: '#8896a8' },
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
        {['pending', 'approved', 'rejected', 'All'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterStatus === s ? 600 : 400, background: filterStatus === s ? '#0a1628' : 'white', color: filterStatus === s ? 'white' : '#8896a8', borderColor: filterStatus === s ? '#0a1628' : '#e4e9f0' }}>
            {s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div style={{ width: '1px', height: '20px', background: '#e4e9f0', margin: '0 4px' }} />
        {['All', 'email_sequence', 'sms_sequence', 'client_checkin', 'prospect', 'outreach_message'].map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterType === t ? 600 : 400, ...(filterType === t && t !== 'All' ? { background: typeStyle(t).bg, color: typeStyle(t).color, borderColor: typeStyle(t).border } : filterType === t ? { background: '#c9a84c', color: '#0a1628', borderColor: '#c9a84c' } : { background: 'white', color: '#8896a8', borderColor: '#e4e9f0' }) }}>
            {t === 'All' ? 'All Types' : TYPE_LABELS[t] || t}
          </button>
        ))}
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '150px', marginLeft: 'auto' }}>
          <option value="All">All Stores</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(approval => {
                const ts = typeStyle(approval.type);
                const memberColor = MEMBER_COLORS[approval.from_member] || '#8896a8';
                return (
                  <div key={approval.id}
                    onClick={() => { setSelected(selected?.id === approval.id ? null : approval); setShowReject(false); setFeedback(''); setEditing(false); setEditContent(''); setEditSteps([]); }}
                    style={{ background: 'white', border: `1px solid ${selected?.id === approval.id ? '#c9a84c' : '#e4e9f0'}`, borderRadius: '12px', padding: '16px 18px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(10,22,40,0.04)', transition: 'border-color 0.1s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                          {approval.type && (
                            <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, letterSpacing: '0.5px', background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                              {TYPE_LABELS[approval.type] || approval.type}
                            </span>
                          )}
                          {approval.from_member && (
                            <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, background: memberColor + '18', color: memberColor, border: `1px solid ${memberColor}30` }}>
                              {MEMBER_LABELS[approval.from_member] || approval.from_member}
                            </span>
                          )}
                          <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, background: approval.status === 'approved' ? '#ecfdf5' : approval.status === 'rejected' ? '#fef2f2' : '#fffbeb', color: approval.status === 'approved' ? '#059669' : approval.status === 'rejected' ? '#dc2626' : '#d97706', border: `1px solid ${approval.status === 'approved' ? '#a7f3d0' : approval.status === 'rejected' ? '#fecaca' : '#fde68a'}` }}>
                            {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>{approval.title}</div>
                        {approval.content && (
                          <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: '1.5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
                            {approval.content}
                          </div>
                        )}
                      </div>
                      {approval.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => action(approval.id, 'approve')}
                            style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '6px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                            ✓
                          </button>
                          <button onClick={() => { setSelected(approval); setShowReject(true); }}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '7px', padding: '6px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                            ✗
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>
                      {getClientName(approval.client_id)} · {formatTime(approval.created_at)}
                      {approval.actioned_at && ` · actioned ${formatTime(approval.actioned_at)}`}
                    </div>
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
