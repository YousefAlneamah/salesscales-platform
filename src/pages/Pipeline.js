import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import axios from 'axios';
import { API_BASE } from '../config';

export default function Pipeline() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterClient, setFilterClient] = useState('All');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState('New Lead');
  const [contactId, setContactId] = useState('');
  const [clientId, setClientId] = useState('');
  const [source, setSource] = useState('Shopify');
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);

  const DEFAULT_STAGES = [
    { id: 'New Lead', color: '#8896a8', light: '#f8fafc' },
    { id: 'Contacted', color: '#3b82f6', light: '#eff6ff' },
    { id: 'Nurturing', color: '#7c3aed', light: '#f5f3ff' },
    { id: 'Hot Lead', color: '#d97706', light: '#fffbeb' },
    { id: 'Proposal Sent', color: '#10b981', light: '#ecfdf5' },
    { id: 'Converted', color: '#059669', light: '#d1fae5' },
  ];
  const STAGE_COLORS = ['#8896a8','#3b82f6','#7c3aed','#d97706','#10b981','#059669','#dc2626','#c9a84c'];
  const [customStages, setCustomStages] = useState(null);
  const stages = customStages
    ? customStages.map((name, i) => ({ id: name, color: STAGE_COLORS[i % STAGE_COLORS.length], light: '#f8fafc' }))
    : DEFAULT_STAGES;

  useEffect(() => {
    fetchDeals();
    fetchContacts();
    fetchClients();
  }, []);

  useEffect(() => {
    if (filterClient === 'All') { setCustomStages(null); return; }
    axios.get(`${API_BASE}/pipeline/stages`, { params: { client_id: filterClient } })
      .then(r => setCustomStages(r.data.stages || null))
      .catch(() => setCustomStages(null));
  }, [filterClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDeals = async () => {
    setLoading(true);
    const { data } = await supabase.from('pipeline_deals').select('*').order('created_at', { ascending: false });
    if (data) setDeals(data);
    setLoading(false);
  };

  const fetchContacts = async () => {
    const { data } = await supabase.from('contacts').select('id, first_name, last_name, email');
    if (data) setContacts(data);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const addDeal = async () => {
    if (!title || !clientId) { alert('Please fill in deal title and select a client'); return; }
    const { error } = await supabase.from('pipeline_deals').insert([{
      title, value: parseFloat(value) || 0, stage,
      client_id: clientId, contact_id: contactId || null, source, notes
    }]);
    if (!error) {
      fetchDeals();
      setShowForm(false);
      setTitle(''); setValue(''); setStage('New Lead');
      setClientId(''); setContactId(''); setSource('Shopify'); setNotes('');
    }
  };

  const moveDeal = async (dealId, newStage) => {
    await supabase.from('pipeline_deals').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', dealId);
    fetchDeals();
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';
  const getContactName = (id) => { const c = contacts.find(c => c.id === id); return c ? `${c.first_name} ${c.last_name}` : '—'; };

  const filtered = filterClient === 'All' ? deals : deals.filter(d => d.client_id === filterClient);
  const getDealsForStage = (s) => filtered.filter(d => d.stage === s);
  const getTotalValue = (s) => getDealsForStage(s).reduce((sum, d) => sum + (d.value || 0), 0);
  const totalValue = filtered.reduce((sum, d) => sum + (d.value || 0), 0);
  const convertedDeals = filtered.filter(d => d.stage === 'Converted').length;
  const hotLeads = filtered.filter(d => d.stage === 'Hot Lead').length;

  const handleDragStart = (e, deal) => { setDragging(deal); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e, stageId) => {
    e.preventDefault();
    if (dragging && dragging.stage !== stageId) moveDeal(dragging.id, stageId);
    setDragging(null);
  };

  const STAGE_GRAD = {
    'New Lead':      'linear-gradient(135deg,#1d4ed8,#3b82f6)',
    'Contacted':     'linear-gradient(135deg,#b45309,#f59e0b)',
    'Nurturing':     'linear-gradient(135deg,#6d28d9,#8b5cf6)',
    'Hot Lead':      'linear-gradient(135deg,#c2410c,#f97316)',
    'Proposal Sent': 'linear-gradient(135deg,#065f46,#10b981)',
    'Converted':     'linear-gradient(135deg,#047857,#34d399)',
    'Lost':          'linear-gradient(135deg,#991b1b,#ef4444)',
  };

  const daysSinceCreated = (d) => {
    const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
    return diff === 0 ? 'Today' : `${diff}d`;
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
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Deal Pipeline</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{filtered.length} deals · ${totalValue.toLocaleString()} total value</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '160px' }}>
            <option value="All">All Stores</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Add Deal
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Deals', value: filtered.length, sub: 'in pipeline', color: '#c9a84c' },
          { label: 'Pipeline Value', value: '$' + totalValue.toLocaleString(), sub: 'total value', color: '#10b981' },
          { label: 'Hot Leads', value: hotLeads, sub: 'ready to close', color: '#f97316' },
          { label: 'Converted', value: convertedDeals, sub: 'this pipeline', color: '#34d399' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#0f1f35', border: `1px solid ${stat.color}20`, borderTop: `2px solid ${stat.color}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 10 }}>{stat.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#f0f4f8', letterSpacing: '-1px', lineHeight: 1, marginBottom: 6 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: stat.color, fontWeight: 600 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ADD DEAL FORM */}
      {showForm && (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace', marginBottom: 16 }}>New Deal</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deal Title</div>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Cart Recovery — Luux Bags" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Value ($)</div>
              <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client Store</div>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                <option value="">Select store</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</div>
              <select value={contactId} onChange={e => setContactId(e.target.value)} style={inputStyle}>
                <option value="">Select contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage</div>
              <select value={stage} onChange={e => setStage(e.target.value)} style={inputStyle}>
                {stages.map(s => <option key={s.id}>{s.id}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</div>
              <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                <option>Shopify</option>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>Referral</option>
                <option>Manual</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addDeal} style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Save Deal</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* KANBAN */}
      {loading ? (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 40, textAlign: 'center', color: '#4a5568' }}>Loading pipeline…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: 10, alignItems: 'start' }}>
          {stages.map(stageObj => {
            const stageDeals = getDealsForStage(stageObj.id);
            const stageValue = getTotalValue(stageObj.id);
            const grad = STAGE_GRAD[stageObj.id] || `linear-gradient(135deg,${stageObj.color},${stageObj.color}99)`;
            return (
              <div key={stageObj.id}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, stageObj.id)}
                style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden', minHeight: 280 }}>

                {/* Gradient column header */}
                <div style={{ background: grad, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.5 }}>{stageObj.id}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '2px 8px' }}>{stageDeals.length}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>${stageValue.toLocaleString()}</div>
                </div>

                <div style={{ padding: '10px 8px' }}>
                  {stageDeals.map(deal => (
                    <div key={deal.id}
                      draggable
                      onDragStart={e => handleDragStart(e, deal)}
                      onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)}
                      style={{ background: '#0f1f35', border: `1px solid ${selectedDeal?.id === deal.id ? stageObj.color + '60' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '11px 12px', marginBottom: 8, cursor: 'grab', transition: 'border-color 0.15s, background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#0f1f35'; }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4f8', marginBottom: 6, lineHeight: 1.3 }}>{deal.title}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: stageObj.color, letterSpacing: '-0.5px', marginBottom: 6 }}>
                        {deal.value > 0 ? '$' + deal.value.toLocaleString() : '—'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 9, color: '#4a5568' }}>{getClientName(deal.client_id)}</div>
                        <div style={{ fontSize: 9, color: '#4a5568', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 6px' }}>{daysSinceCreated(deal.created_at)}</div>
                      </div>
                      {deal.contact_id && <div style={{ fontSize: 9, color: '#8896a8', marginTop: 3 }}>{getContactName(deal.contact_id)}</div>}
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div onClick={() => setShowForm(true)} style={{ textAlign: 'center', padding: '24px 8px', color: '#4a5568', fontSize: 11, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
                      + Add Deal
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DEAL DETAIL */}
      {selectedDeal && (
        <div style={{ marginTop: 16, background: '#0f1f35', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f0f4f8', marginBottom: 4 }}>{selectedDeal.title}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#c9a84c', marginBottom: 8 }}>${(selectedDeal.value || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#8896a8', marginBottom: 8 }}>
                {getClientName(selectedDeal.client_id)} · {selectedDeal.source} · {new Date(selectedDeal.created_at).toLocaleDateString()}
              </div>
              {selectedDeal.notes && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', lineHeight: 1.7 }}>
                  {selectedDeal.notes}
                </div>
              )}
            </div>
            <button onClick={() => setSelectedDeal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 20 }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}