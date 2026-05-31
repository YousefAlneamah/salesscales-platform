import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const PRIORITY_COLOR = {
  urgent: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  high:   { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  normal: { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
  low:    { bg: '#f8fafc', color: '#8896a8', border: '#e4e9f0' },
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'normal' });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('open');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/tasks`, { params: { status: filterStatus || undefined } });
      setTasks(data.tasks || []);
    } catch (e) {
      console.error('Tasks fetch error:', e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/tasks`, form);
      setForm({ title: '', description: '', due_date: '', priority: 'normal' });
      setShowForm(false);
      fetchTasks();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to save task');
    }
    setSaving(false);
  };

  const markComplete = async (id) => {
    await axios.put(`${API_BASE}/tasks/${id}`, { status: 'completed' });
    fetchTasks();
  };

  const reopen = async (id) => {
    await axios.put(`${API_BASE}/tasks/${id}`, { status: 'open' });
    fetchTasks();
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    await axios.delete(`${API_BASE}/tasks/${id}`);
    fetchTasks();
  };

  const isOverdue = (due) => due && new Date(due) < new Date() && filterStatus === 'open';

  const inputStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: 'var(--text)', outline: 'none', background: 'white', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' };

  const open  = tasks.filter(t => t.status === 'open');
  const done  = tasks.filter(t => t.status === 'completed');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div className="section-label" style={{ marginBottom: '4px' }}>Task Manager</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            {open.length} open · {done.length} completed
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text)', outline: 'none', background: 'white' }}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-navy" style={{ fontSize: '12px', padding: '9px 18px' }}>
            + Add Task
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={addTask} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div className="section-label" style={{ marginBottom: '14px' }}>New Task</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase' }}>Title *</div>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Review sequences for Client X" required style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase' }}>Due Date</div>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase' }}>Priority</div>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase' }}>Description (optional)</div>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Additional context…" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? 'Saving…' : 'Save Task'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: '13px', padding: '40px 0', textAlign: 'center' }}>Loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <i className="ti ti-checkbox" style={{ fontSize: '32px', color: 'var(--muted)', display: 'block', marginBottom: '12px' }} />
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>No tasks yet</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Click + Add Task to create your first one</div>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-header">
            <div className="th" style={{ flex: 3 }}>Task</div>
            <div className="th" style={{ flex: 1 }}>Client</div>
            <div className="th" style={{ flex: '0 0 100px' }}>Priority</div>
            <div className="th" style={{ flex: '0 0 110px' }}>Due Date</div>
            <div className="th" style={{ flex: '0 0 130px' }}>Actions</div>
          </div>
          {tasks.map(t => {
            const pc = PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.normal;
            const overdue = isOverdue(t.due_date);
            return (
              <div key={t.id} className="table-row" style={{ background: overdue ? '#fef2f2' : t.status === 'completed' ? '#f8fafb' : undefined }}>
                <div className="td" style={{ flex: 3 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: t.status === 'completed' ? 'var(--muted)' : 'var(--text)', textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>{t.title}</div>
                  {t.description && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{t.description}</div>}
                </div>
                <div className="td" style={{ flex: 1, fontSize: '11px', color: 'var(--slate)' }}>{t.clients?.name || '—'}</div>
                <div className="td" style={{ flex: '0 0 100px' }}>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{t.priority}</span>
                </div>
                <div className="td" style={{ flex: '0 0 110px', fontSize: '11px', color: overdue ? '#dc2626' : 'var(--muted)', fontWeight: overdue ? 700 : 400 }}>
                  {t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  {overdue && <div style={{ fontSize: '9px', color: '#dc2626', fontWeight: 700 }}>OVERDUE</div>}
                </div>
                <div className="td" style={{ flex: '0 0 130px', display: 'flex', gap: '5px' }}>
                  {t.status === 'open' ? (
                    <button onClick={() => markComplete(t.id)} style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '5px 10px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
                      ✓ Done
                    </button>
                  ) : (
                    <button onClick={() => reopen(t.id)} style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '6px', padding: '5px 10px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
                      Reopen
                    </button>
                  )}
                  <button onClick={() => deleteTask(t.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
