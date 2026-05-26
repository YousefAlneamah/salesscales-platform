import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3001';

const STATUS_MAP = {
  pending:   { cls: 'badge-yellow', label: 'Pending' },
  contacted: { cls: 'badge-blue',   label: 'Contacted' },
  converted: { cls: 'badge-green',  label: 'Converted' },
  declined:  { cls: 'badge-red',    label: 'Declined' },
};

export default function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ referrer_name: '', referrer_email: '', referred_business: '', notes: '' });

  useEffect(() => { fetchReferrals(); }, []);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/referrals/list`);
      setReferrals(data.referrals || []);
    } catch (_) {}
    setLoading(false);
  };

  const submit = async () => {
    if (!form.referrer_name || !form.referred_business) { alert('Referrer name and referred business are required'); return; }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/referrals/create`, form);
      setReferrals([data.referral, ...referrals]);
      setShowForm(false);
      setForm({ referrer_name: '', referrer_email: '', referred_business: '', notes: '' });
    } catch (_) { alert('Failed to add referral'); }
    setSubmitting(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/referrals/${id}/status`, { status });
      setReferrals(referrals.map(r => r.id === id ? { ...r, status } : r));
    } catch (_) {}
  };

  const converted = referrals.filter(r => r.status === 'converted').length;
  const pending = referrals.filter(r => r.status === 'pending').length;
  const contacted = referrals.filter(r => r.status === 'contacted').length;

  const inputStyle = { width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' };

  return (
    <div>
      {/* STATS */}
      <div className="stats-row" style={{ marginBottom: '20px' }}>
        <div className="stat-card gold-top">
          <div className="stat-label">Total Referrals</div>
          <div className="stat-value">{referrals.length}</div>
        </div>
        <div className="stat-card navy-top">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{pending}</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">Contacted</div>
          <div className="stat-value">{contacted}</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Converted</div>
          <div className="stat-value">{converted}</div>
          <div className="stat-sub-green">{referrals.length > 0 ? `${Math.round((converted / referrals.length) * 100)}% rate` : '—'}</div>
        </div>
      </div>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div className="section-label" style={{ margin: 0 }}>REFERRAL TRACKER</div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-navy">+ Add Referral</button>
      </div>

      {/* FORM */}
      {showForm && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="section-label" style={{ marginBottom: '14px' }}>NEW REFERRAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase' }}>Referrer Name *</div>
              <input value={form.referrer_name} onChange={e => setForm({ ...form, referrer_name: e.target.value })} placeholder="Who referred them?" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase' }}>Referrer Email</div>
              <input type="email" value={form.referrer_email} onChange={e => setForm({ ...form, referrer_email: e.target.value })} placeholder="referrer@email.com" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase' }}>Referred Business *</div>
              <input value={form.referred_business} onChange={e => setForm({ ...form, referred_business: e.target.value })} placeholder="Business name or website" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase' }}>Notes</div>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any context about this referral..." style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={submit} disabled={submitting} className="btn btn-gold">{submitting ? 'Saving...' : 'Add Referral'}</button>
            <button onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="table-wrap">
        <div className="table-header">
          <div className="th" style={{ flex: 2 }}>Referred Business</div>
          <div className="th" style={{ flex: 2 }}>Referrer</div>
          <div className="th">Date</div>
          <div className="th" style={{ flex: 2 }}>Notes</div>
          <div className="th">Status</div>
          <div className="th">Update</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#8896a8' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>No referrals yet</div>
            <div style={{ fontSize: '11px' }}>Add your first referral above</div>
          </div>
        ) : referrals.map(r => (
          <div key={r.id} className="table-row">
            <div className="td" style={{ flex: 2, fontWeight: 600, color: '#0a1628' }}>{r.referred_business}</div>
            <div className="td" style={{ flex: 2 }}>
              <div style={{ fontSize: '12px', color: '#0a1628' }}>{r.referrer_name}</div>
              {r.referrer_email && <div style={{ fontSize: '10px', color: '#8896a8' }}>{r.referrer_email}</div>}
            </div>
            <div className="td" style={{ fontSize: '11px', color: '#8896a8', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString()}</div>
            <div className="td" style={{ flex: 2, fontSize: '11px', color: '#8896a8' }}>{r.notes || '—'}</div>
            <div className="td">
              <span className={STATUS_MAP[r.status]?.cls || 'badge-yellow'}>{STATUS_MAP[r.status]?.label || r.status}</span>
            </div>
            <div className="td">
              <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                style={{ fontSize: '10px', border: '1px solid #e4e9f0', borderRadius: '6px', padding: '4px 8px', color: '#0a1628', cursor: 'pointer', background: 'white', outline: 'none' }}>
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
