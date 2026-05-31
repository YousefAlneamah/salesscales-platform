import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';

const MEMBERS = [
  { id: 'hussain', name: 'Hussain', role: 'Intelligence & Strategy' },
  { id: 'hassan', name: 'Hassan', role: 'Growth & Outreach' },
  { id: 'ali', name: 'Ali', role: 'Sales Closer' },
  { id: 'mahdi', name: 'Mahdi', role: 'Marketing & Content' },
  { id: 'fatima', name: 'Fatima', role: 'Operations Manager' },
  { id: 'zainab', name: 'Zainab', role: 'Client Partner' },
];

const PRIORITY_BADGE = {
  urgent: 'badge-red',
  high: 'badge-yellow',
  normal: 'badge-blue',
  low: 'badge-green',
};

const PRIORITY_COLOR = {
  urgent: '#dc2626',
  high: '#d97706',
  normal: '#3b82f6',
  low: '#10b981',
};

function CalendarView({ briefings, getMemberName }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const getBriefingsForDay = (day) => {
    const dayStr = day.toISOString().slice(0, 10);
    return briefings.filter(b => {
      const src = b.scheduled_for || b.created_at;
      return src && new Date(src).toISOString().slice(0, 10) === dayStr;
    });
  };

  const dayLabel = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isToday = (d) => d.toDateString() === new Date().toDateString();

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: '8px', minWidth: '840px' }}>
        {days.map((day, idx) => {
          const dayBriefings = getBriefingsForDay(day);
          return (
            <div key={idx} style={{ background: isToday(day) ? 'rgba(201,168,76,0.05)' : 'var(--bg)', border: `1px solid ${isToday(day) ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '10px', padding: '10px', minHeight: '140px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: isToday(day) ? 'var(--gold)' : 'var(--muted)', marginBottom: '8px' }}>
                {dayLabel(day)}{isToday(day) ? ' · Today' : ''}
              </div>
              {dayBriefings.length === 0 ? (
                <div style={{ fontSize: '10px', color: 'var(--muted)', textAlign: 'center', marginTop: '24px' }}>—</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {dayBriefings.map(b => (
                    <div key={b.id} style={{ background: 'white', border: `1px solid ${PRIORITY_COLOR[b.priority] || '#e4e9f0'}`, borderLeft: `3px solid ${PRIORITY_COLOR[b.priority] || '#3b82f6'}`, borderRadius: '6px', padding: '6px 8px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: PRIORITY_COLOR[b.priority] || '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{b.priority}</div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: '2px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.subject}</div>
                      <div style={{ fontSize: '9px', color: 'var(--muted)' }}>{getMemberName(b.from_member)} → {getMemberName(b.to_member)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {Object.entries(PRIORITY_COLOR).map(([p, c]) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--muted)' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: c }} />
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </div>
        ))}
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: 'auto' }}>Showing today + 6 days · Scheduled briefings shown on their scheduled date, others on created date</div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  fontSize: '13px',
  color: 'var(--text)',
  background: 'var(--bg)',
  boxSizing: 'border-box',
  outline: 'none',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
};

export default function TeamBriefings() {
  const [briefings, setBriefings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({
    from_member: 'hussain',
    to_member: 'hassan',
    subject: '',
    content: '',
    priority: 'normal',
    scheduled_for: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  const fetchBriefings = async () => {
    setLoading(true);
    try {
      const url = filter === 'all'
        ? `${API_BASE}/team/briefings`
        : `${API_BASE}/team/briefings?recipient=${filter}`;
      const { data } = await axios.get(url);
      setBriefings(data.briefings || []);
    } catch (e) {
      console.error('Failed to fetch briefings:', e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchBriefings(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (form.from_member === form.to_member) {
      setErrorMsg('From and To must be different members.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/team/brief`, {
        ...form,
        scheduled_for: form.scheduled_for || null,
      });
      setSuccessMsg(`Briefing sent to ${getMemberName(form.to_member)}.`);
      setForm(f => ({ ...f, subject: '', content: '' }));
      fetchBriefings();
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (e) {
      setErrorMsg('Failed to send briefing. Check the server.');
    }
    setSubmitting(false);
  };

  const getMemberName = (id) => MEMBERS.find(m => m.id === id)?.name || id;

  const archiveBriefing = async (id) => {
    try {
      await axios.post(`${API_BASE}/briefings/archive`, { briefing_id: id });
      setBriefings(prev => prev.map(b => b.id === id ? { ...b, is_archived: true } : b));
    } catch (e) {
      console.error('Archive failed:', e.message);
    }
  };

  const copyBriefing = (b) => {
    const text = `From: ${getMemberName(b.from_member)}\nTo: ${getMemberName(b.to_member)}\nSubject: ${b.subject}\nPriority: ${b.priority}\nDate: ${formatDate(b.created_at)}\n\n${b.content}`;
    navigator.clipboard.writeText(text)
      .then(() => { setCopiedId(b.id); setTimeout(() => setCopiedId(null), 2000); })
      .catch(() => {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopiedId(b.id);
        setTimeout(() => setCopiedId(null), 2000);
      });
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: undefined, hour: '2-digit', minute: '2-digit' });
  };

  const unread = briefings.filter(b => !b.is_read).length;
  const urgent = briefings.filter(b => b.priority === 'urgent').length;
  const today = briefings.filter(b => {
    return new Date(b.created_at).toDateString() === new Date().toDateString();
  }).length;

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card gold-top">
          <div className="stat-label">Total Briefings</div>
          <div className="stat-value">{briefings.length}</div>
          <div className="stat-sub-gold">All team handoffs</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">Unread</div>
          <div className="stat-value">{unread}</div>
          <div className="stat-sub-blue">Awaiting review</div>
        </div>
        <div className="stat-card" style={{ borderTop: '2px solid var(--red)' }}>
          <div className="stat-label">Urgent</div>
          <div className="stat-value">{urgent}</div>
          <div className="stat-sub" style={{ color: 'var(--red)' }}>High priority</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Today</div>
          <div className="stat-value">{today}</div>
          <div className="stat-sub-green">Sent today</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ti ti-send" style={{ fontSize: '17px', color: 'var(--gold)' }} aria-hidden="true"></i>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>Create Briefing</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '4px' }}>— handoff context injected into the recipient's next AI session</div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>From</div>
              <select style={selectStyle} value={form.from_member} onChange={e => setForm(f => ({ ...f, from_member: e.target.value }))}>
                {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
              </select>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>To</div>
              <select style={selectStyle} value={form.to_member} onChange={e => setForm(f => ({ ...f, to_member: e.target.value }))}>
                {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
              </select>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Priority</div>
              <select style={selectStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: '6px' }}>Schedule For (optional)</div>
              <input type="date" style={inputStyle} value={form.scheduled_for}
                onChange={e => setForm(f => ({ ...f, scheduled_for: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div className="section-label" style={{ marginBottom: '6px' }}>Subject</div>
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. Hot lead from outreach — needs closing script"
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              required
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <div className="section-label" style={{ marginBottom: '6px' }}>Briefing Content</div>
            <textarea
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Full context, action items, key details — this will be injected into the recipient's AI session automatically."
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              required
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" className="btn btn-gold" disabled={submitting}>
              <i className="ti ti-send" style={{ marginRight: '6px' }} aria-hidden="true"></i>
              {submitting ? 'Sending...' : 'Send Briefing'}
            </button>
            {successMsg && <span className="badge-green" style={{ padding: '5px 14px', borderRadius: '7px', fontSize: '12px' }}>{successMsg}</span>}
            {errorMsg && <span className="badge-red" style={{ padding: '5px 14px', borderRadius: '7px', fontSize: '12px' }}>{errorMsg}</span>}
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{ id: 'list', label: 'All Briefings', icon: 'ti-list' }, { id: 'calendar', label: 'Calendar', icon: 'ti-calendar' }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ background: activeTab === tab.id ? 'var(--navy)' : 'var(--bg)', color: activeTab === tab.id ? 'var(--gold)' : 'var(--muted)', border: `1px solid ${activeTab === tab.id ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <i className={`ti ${tab.icon}`} aria-hidden="true"></i>
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'list' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setShowArchived(v => !v)}
                style={{ background: showArchived ? 'rgba(201,168,76,0.1)' : 'var(--bg)', color: showArchived ? 'var(--gold)' : 'var(--muted)', border: `1px solid ${showArchived ? 'var(--gold)' : 'var(--border)'}`, borderRadius: '7px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                {showArchived ? 'Hide Archived' : 'Show Archived'}
              </button>
              <div className="section-label" style={{ marginRight: '4px' }}>Filter by recipient:</div>
              <select
                style={{ ...selectStyle, width: 'auto', padding: '6px 10px', fontSize: '12px' }}
                value={filter}
                onChange={e => setFilter(e.target.value)}
              >
                <option value="all">All Members</option>
                {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {activeTab === 'calendar' ? (
          <CalendarView briefings={briefings} getMemberName={getMemberName} />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '13px' }}>Loading briefings...</div>
        ) : briefings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <i className="ti ti-mail-off" style={{ fontSize: '32px', color: 'var(--muted)', display: 'block', marginBottom: '10px' }} aria-hidden="true"></i>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No briefings found. Use the form above to create the first one.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-header">
              <div className="th" style={{ flex: '0 0 110px' }}>From</div>
              <div className="th" style={{ flex: '0 0 110px' }}>To</div>
              <div className="th" style={{ flex: 1 }}>Subject &amp; Preview</div>
              <div className="th" style={{ flex: '0 0 80px' }}>Priority</div>
              <div className="th" style={{ flex: '0 0 72px' }}>Status</div>
              <div className="th" style={{ flex: '0 0 130px' }}>Date</div>
              <div className="th" style={{ flex: '0 0 80px' }}></div>
            </div>
            {briefings.filter(b => showArchived ? b.is_archived : !b.is_archived).map(b => {
              const isExpanded = expandedId === b.id;
              const isCopied = copiedId === b.id;
              return (
                <div
                  key={b.id}
                  className="table-row"
                  style={{ background: !b.is_read ? 'rgba(201,168,76,0.04)' : undefined, alignItems: 'flex-start' }}
                >
                  <div className="td" style={{ flex: '0 0 110px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{getMemberName(b.from_member)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{MEMBERS.find(m => m.id === b.from_member)?.role}</div>
                  </div>
                  <div className="td" style={{ flex: '0 0 110px' }}>
                    <div style={{ fontWeight: 500, fontSize: '13px' }}>{getMemberName(b.to_member)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{MEMBERS.find(m => m.id === b.to_member)?.role}</div>
                  </div>
                  <div className="td" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{b.subject}</div>
                    {isExpanded ? (
                      <>
                        <div style={{
                          fontSize: '12px', color: 'var(--slate)', lineHeight: '1.75',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          background: 'var(--bg)', border: '1px solid var(--border)',
                          borderRadius: '8px', padding: '12px 14px', marginBottom: '10px',
                        }}>
                          {b.content}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => setExpandedId(null)}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif' }}>
                            ↑ Collapse
                          </button>
                          <button
                            onClick={() => copyBriefing(b)}
                            style={{
                              background: isCopied ? 'var(--green)' : 'var(--navy)',
                              color: isCopied ? 'white' : 'var(--gold)',
                              border: 'none', borderRadius: '6px', padding: '4px 12px',
                              fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                              fontFamily: 'DM Sans, sans-serif', transition: 'background 0.2s',
                            }}>
                            {isCopied ? '✓ Copied' : '⎘ Copy'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                          {b.content}
                        </div>
                        <button
                          onClick={() => setExpandedId(b.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif' }}>
                          View full →
                        </button>
                      </>
                    )}
                  </div>
                  <div className="td" style={{ flex: '0 0 80px' }}>
                    <span className={PRIORITY_BADGE[b.priority] || 'badge-blue'}>{b.priority}</span>
                  </div>
                  <div className="td" style={{ flex: '0 0 72px' }}>
                    <span className={b.is_read ? 'badge-green' : 'badge-gold'}>{b.is_read ? 'read' : 'unread'}</span>
                  </div>
                  <div className="td" style={{ flex: '0 0 130px', fontSize: '11px', color: 'var(--muted)' }}>
                    {formatDate(b.created_at)}
                  </div>
                  <div className="td" style={{ flex: '0 0 80px' }}>
                    {!b.is_archived && (
                      <button onClick={() => archiveBriefing(b.id)}
                        style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
