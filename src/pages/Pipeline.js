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
  const [source, setSource] = useState('Manual');
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(null);

  const stages = [
    { id: 'New Lead', color: '#94a3b8', light: '#f8fafc' },
    { id: 'Contacted', color: '#3b82f6', light: '#eff6ff' },
    { id: 'Nurturing', color: '#8b5cf6', light: '#f5f3ff' },
    { id: 'Hot Lead', color: '#f59e0b', light: '#fffbeb' },
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
    const { data, error } = await supabase
      .from('pipeline_deals')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setDeals(data);
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
    if (!title || !clientId) {
      alert('Please fill in deal title and select a client');
      return;
    }
    const { error } = await supabase.from('pipeline_deals').insert([{
      title,
      value: parseFloat(value) || 0,
      stage,
      client_id: clientId,
      contact_id: contactId || null,
      source,
      notes
    }]);
    if (!error) {
      fetchDeals();
      setShowForm(false);
      setTitle('');
      setValue('');
      setStage('New Lead');
      setClientId('');
      setContactId('');
      setSource('Manual');
      setNotes('');
    }
  };

  const moveDeal = async (dealId, newStage) => {
    await supabase.from('pipeline_deals').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', dealId);
    fetchDeals();
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : '—';
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact ? `${contact.first_name} ${contact.last_name}` : '—';
  };

  const filtered = filterClient === 'All' ? deals : deals.filter(d => d.client_id === filterClient);

  const getDealsForStage = (stageId) => filtered.filter(d => d.stage === stageId);

  const getTotalValue = (stageId) => {
    return getDealsForStage(stageId).reduce((sum, d) => sum + (d.value || 0), 0);
  };

  const totalPipelineValue = filtered.reduce((sum, d) => sum + (d.value || 0), 0);
  const totalDeals = filtered.length;
  const convertedDeals = filtered.filter(d => d.stage === 'Converted').length;
  const hotLeads = filtered.filter(d => d.stage === 'Hot Lead').length;

  const inputStyle = {
    width: '100%', border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  const handleDragStart = (e, deal) => {
    setDragging(deal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    if (dragging && dragging.stage !== stageId) {
      moveDeal(dragging.id, stageId);
    }
    setDragging(null);
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>PIPELINE</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{totalDeals} deals · ${totalPipelineValue.toLocaleString()} total value</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            style={{ ...inputStyle, width: '160px' }}>
            <option value="All">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>+ Add Deal</button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'TOTAL DEALS', value: totalDeals, sub: 'in pipeline' },
          { label: 'PIPELINE VALUE', value: '$' + totalPipelineValue.toLocaleString(), sub: 'total value' },
          { label: 'HOT LEADS', value: hotLeads, sub: 'ready to close' },
          { label: 'CONVERTED', value: convertedDeals, sub: 'this pipeline' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', borderTop: '2px solid #10b981' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a3c5e' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ADD DEAL FORM */}
      {showForm && (
        <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '14px' }}>ADD NEW DEAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>DEAL TITLE</div>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Adam — Cart Recovery" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>DEAL VALUE ($)</div>
              <input type="number" value={value} onChange={e => setValue(e.target.value)}
                placeholder="0" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>CLIENT</div>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>CONTACT</div>
              <select value={contactId} onChange={e => setContactId(e.target.value)} style={inputStyle}>
                <option value="">Select contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>STAGE</div>
              <select value={stage} onChange={e => setStage(e.target.value)} style={inputStyle}>
                {stages.map(s => <option key={s.id}>{s.id}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>SOURCE</div>
              <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                <option>Manual</option>
                <option>Shopify</option>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>LinkedIn</option>
                <option>Referral</option>
                <option>Form</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>NOTES</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about this deal..." rows={2}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-green" onClick={addDeal}>Save Deal</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* KANBAN BOARD */}
      {loading ? (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading pipeline...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', overflowX: 'auto' }}>
          {stages.map(stageObj => {
            const stageDeals = getDealsForStage(stageObj.id);
            const stageValue = getTotalValue(stageObj.id);
            return (
              <div
                key={stageObj.id}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, stageObj.id)}
                style={{ background: stageObj.light, borderRadius: '10px', padding: '12px', minHeight: '400px', border: `0.5px solid ${stageObj.color}20` }}
              >
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: stageObj.color, letterSpacing: '0.5px' }}>{stageObj.id.toUpperCase()}</div>
                    <div style={{ fontSize: '10px', background: stageObj.color, color: 'white', borderRadius: '10px', padding: '1px 7px', fontWeight: 600 }}>{stageDeals.length}</div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>${stageValue.toLocaleString()}</div>
                </div>

                {stageDeals.map(deal => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={e => handleDragStart(e, deal)}
                    style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#1a3c5e', marginBottom: '4px' }}>{deal.title}</div>
                    <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 500, marginBottom: '4px' }}>
                      {deal.value > 0 ? '$' + deal.value.toLocaleString() : 'No value set'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '2px' }}>{getClientName(deal.client_id)}</div>
                    {deal.contact_id && (
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>{getContactName(deal.contact_id)}</div>
                    )}
                    <div style={{ fontSize: '9px', color: '#cbd5e1', marginTop: '6px' }}>
                      {new Date(deal.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 10px', color: '#cbd5e1', fontSize: '11px', border: '0.5px dashed #e2e8f0', borderRadius: '8px' }}>
                    Drop deals here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}