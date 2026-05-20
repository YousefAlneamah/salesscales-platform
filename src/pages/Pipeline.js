import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

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

  const stages = [
    { id: 'New Lead', color: '#8896a8', light: '#f8fafc' },
    { id: 'Contacted', color: '#3b82f6', light: '#eff6ff' },
    { id: 'Nurturing', color: '#7c3aed', light: '#f5f3ff' },
    { id: 'Hot Lead', color: '#d97706', light: '#fffbeb' },
    { id: 'Proposal Sent', color: '#10b981', light: '#ecfdf5' },
    { id: 'Converted', color: '#059669', light: '#d1fae5' },
  ];

  useEffect(() => {
    fetchDeals();
    fetchContacts();
    fetchClients();
  }, []);

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Deals', value: filtered.length, sub: 'in pipeline', color: '#c9a84c' },
          { label: 'Pipeline Value', value: '$' + totalValue.toLocaleString(), sub: 'total value', color: '#c9a84c' },
          { label: 'Hot Leads', value: hotLeads, sub: 'ready to close', color: '#d97706' },
          { label: 'Converted', value: convertedDeals, sub: 'this pipeline', color: '#10b981' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ADD DEAL FORM */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>New Deal</div>
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
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading pipeline...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          {stages.map(stageObj => {
            const stageDeals = getDealsForStage(stageObj.id);
            const stageValue = getTotalValue(stageObj.id);
            return (
              <div key={stageObj.id}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, stageObj.id)}
                style={{ background: stageObj.light, borderRadius: '10px', padding: '12px', minHeight: '320px', border: `1px solid ${stageObj.color}20` }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: stageObj.color, letterSpacing: '1px', textTransform: 'uppercase' }}>{stageObj.id}</div>
                    <div style={{ fontSize: '9px', background: stageObj.color, color: 'white', borderRadius: '10px', padding: '1px 7px', fontWeight: 700 }}>{stageDeals.length}</div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 500 }}>${stageValue.toLocaleString()}</div>
                </div>

                {stageDeals.map(deal => (
                  <div key={deal.id}
                    draggable
                    onDragStart={e => handleDragStart(e, deal)}
                    onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)}
                    style={{ background: 'white', border: `1px solid ${selectedDeal?.id === deal.id ? stageObj.color : '#e4e9f0'}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'grab', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', transition: 'border-color 0.1s' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>{deal.title}</div>
                    <div style={{ fontSize: '11px', color: '#c9a84c', fontWeight: 600, marginBottom: '4px' }}>
                      {deal.value > 0 ? '$' + deal.value.toLocaleString() : 'No value'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#8896a8' }}>{getClientName(deal.client_id)}</div>
                    {deal.contact_id && <div style={{ fontSize: '9px', color: '#8896a8' }}>{getContactName(deal.contact_id)}</div>}
                    <div style={{ fontSize: '9px', color: '#c4cdd6', marginTop: '6px' }}>{new Date(deal.created_at).toLocaleDateString()}</div>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 8px', color: '#c4cdd6', fontSize: '10px', border: '1px dashed #e4e9f0', borderRadius: '8px' }}>
                    Drop here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DEAL DETAIL */}
      {selectedDeal && (
        <div style={{ marginTop: '16px', background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '18px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>{selectedDeal.title}</div>
              <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '8px' }}>
                {getClientName(selectedDeal.client_id)} · {selectedDeal.source} · {new Date(selectedDeal.created_at).toLocaleDateString()}
              </div>
              {selectedDeal.notes && (
                <div style={{ fontSize: '11px', color: '#475569', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e4e9f0' }}>
                  {selectedDeal.notes}
                </div>
              )}
            </div>
            <button onClick={() => setSelectedDeal(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px' }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}