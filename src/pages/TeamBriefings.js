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
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
      await axios.post(`${API_BASE}/team/brief`, form);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <i className="ti ti-send" style={{ fontSize: '17px', color: 'var(--gold)' }} aria-hidden="true"></i>
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>Create Briefing</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '4px' }}>— handoff context that gets injected into the recipient's next AI session</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
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
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>All Briefings</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>

        {loading ? (
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
            </div>
            {briefings.map(b => (
              <div
                key={b.id}
                className="table-row"
                style={{ background: !b.is_read ? 'rgba(201,168,76,0.04)' : undefined }}
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
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{b.subject}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.content}</div>
                </div>
                <div className="td" style={{ flex: '0 0 80px' }}>
                  <span className={PRIORITY_BADGE[b.priority] || 'badge-blue'}>{b.priority}</span>
                </div>
                <div className="td" style={{ flex: '0 0 72px' }}>
                  <span className={b.is_read ? 'badge-green' : 'badge-gold'}>{b.is_read ? 'read' : 'unread'}</span>
                </div>
                <div className="td" style={{ flex: '0 0 130px', fontSize: '11px', color: 'var(--muted)' }}>{formatDate(b.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
