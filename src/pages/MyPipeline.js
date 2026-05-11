import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function MyPipeline() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [business, setBusiness] = useState('');
  const [niche, setNiche] = useState('');
  const [revenue, setRevenue] = useState('');
  const [stage, setStage] = useState('New Prospect');
  const [source, setSource] = useState('LinkedIn');
  const [notes, setNotes] = useState('');
  const [tier, setTier] = useState('starter');

  const stages = [
    { id: 'New Prospect', color: '#94a3b8', light: '#f8fafc' },
    { id: 'Audit Sent', color: '#3b82f6', light: '#eff6ff' },
    { id: 'Call Booked', color: '#8b5cf6', light: '#f5f3ff' },
    { id: 'Proposal Sent', color: '#f59e0b', light: '#fffbeb' },
    { id: 'Negotiating', color: '#f97316', light: '#fff7ed' },
    { id: 'Closed', color: '#10b981', light: '#ecfdf5' },
  ];

  const sources = ['LinkedIn', 'Instagram', 'TikTok', 'Referral', 'Audit Tool', 'Cold Email', 'Facebook', 'Twitter', 'Manual'];

  useEffect(() => {
    fetchProspects();
  }, []);

  const fetchProspects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('source', 'Prospect')
      .order('created_at', { ascending: false });
    if (!error && data) setProspects(data);
    else {
      const { data: allContacts } = await supabase
        .from('contacts')
        .select('*')
        .is('client_id', null)
        .order('created_at', { ascending: false });
      if (allContacts) setProspects(allContacts);
    }
    setLoading(false);
  };

  const addProspect = async () => {
    if (!name || !email) {
      alert('Please fill in name and email');
      return;
    }
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    const { error } = await supabase.from('contacts').insert([{
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      source: 'Prospect',
      channel: source,
      pipeline_stage: stage,
      notes: `Business: ${business}\nNiche: ${niche}\nEst Revenue: ${revenue}\nTier Target: ${tier}\n\n${notes}`,
      last_activity: new Date().toISOString()
    }]);
    if (!error) {
      fetchProspects();
      setShowForm(false);
      setName(''); setEmail(''); setPhone('');
      setBusiness(''); setNiche(''); setRevenue('');
      setStage('New Prospect'); setSource('LinkedIn');
      setNotes(''); setTier('starter');
    }
  };

  const moveStage = async (prospectId, newStage) => {
    await supabase.from('contacts').update({ pipeline_stage: newStage }).eq('id', prospectId);
    fetchProspects();
  };

  const getProspectsForStage = (stageId) => prospects.filter(p => p.pipeline_stage === stageId);

  const totalValue = () => {
    
    return prospects.filter(p => p.pipeline_stage === 'Closed').length * 3000;
  };

  const inputStyle = {
    width: '100%', border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  const [dragging, setDragging] = useState(null);

  const handleDragStart = (e, prospect) => {
    setDragging(prospect);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    if (dragging && dragging.pipeline_stage !== stageId) {
      moveStage(dragging.id, stageId);
    }
    setDragging(null);
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>MY PIPELINE — SALES SCALES</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            {prospects.length} prospects · ${totalValue().toLocaleString()} closed value
          </div>
        </div>
        <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>+ Add Prospect</button>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {stages.map(s => (
          <div key={s.id} style={{ background: 'white', border: `0.5px solid ${s.color}30`, borderRadius: '10px', padding: '12px 14px', borderTop: `2px solid ${s.color}` }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a3c5e' }}>{getProspectsForStage(s.id).length}</div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{s.id}</div>
          </div>
        ))}
      </div>

      {/* ADD PROSPECT FORM */}
      {showForm && (
        <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '14px' }}>ADD NEW PROSPECT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>FULL NAME</div>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>EMAIL</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>PHONE</div>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>BUSINESS NAME</div>
              <input type="text" value={business} onChange={e => setBusiness(e.target.value)} placeholder="e.g. Peak Fitness" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>NICHE</div>
              <input type="text" value={niche} onChange={e => setNiche(e.target.value)} placeholder="e.g. Ecommerce — Fitness" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>EST. MONTHLY REVENUE</div>
              <input type="text" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="e.g. $50K/mo" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>SOURCE</div>
              <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                {sources.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>TARGET TIER</div>
              <select value={tier} onChange={e => setTier(e.target.value)} style={inputStyle}>
                <option value="starter">Starter — $1,500/mo</option>
                <option value="growth">Growth — $3,000/mo</option>
                <option value="elite">Elite — $6,000/mo</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>STAGE</div>
              <select value={stage} onChange={e => setStage(e.target.value)} style={inputStyle}>
                {stages.map(s => <option key={s.id}>{s.id}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>NOTES</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about this prospect..." rows={2}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-green" onClick={addProspect}>Save Prospect</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* KANBAN */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading pipeline...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', overflowX: 'auto' }}>
          {stages.map(stageObj => {
            const stageProspects = getProspectsForStage(stageObj.id);
            return (
              <div key={stageObj.id}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, stageObj.id)}
                style={{ background: stageObj.light, borderRadius: '10px', padding: '12px', minHeight: '300px', border: `0.5px solid ${stageObj.color}20` }}>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: stageObj.color, letterSpacing: '0.5px' }}>{stageObj.id.toUpperCase()}</div>
                    <div style={{ fontSize: '9px', background: stageObj.color, color: 'white', borderRadius: '10px', padding: '1px 6px', fontWeight: 600 }}>{stageProspects.length}</div>
                  </div>
                </div>

                {stageProspects.map(prospect => (
                  <div key={prospect.id}
                    draggable
                    onDragStart={e => handleDragStart(e, prospect)}
                    onClick={() => setSelectedProspect(selectedProspect?.id === prospect.id ? null : prospect)}
                    style={{ background: 'white', border: `0.5px solid ${selectedProspect?.id === prospect.id ? stageObj.color : '#e2e8f0'}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#1a3c5e', marginBottom: '3px' }}>{prospect.first_name} {prospect.last_name}</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '3px' }}>{prospect.email}</div>
                    <div style={{ fontSize: '9px', color: '#10b981' }}>{prospect.channel}</div>
                    <div style={{ fontSize: '9px', color: '#cbd5e1', marginTop: '5px' }}>
                      {new Date(prospect.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}

                {stageProspects.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 8px', color: '#cbd5e1', fontSize: '10px', border: '0.5px dashed #e2e8f0', borderRadius: '8px' }}>
                    Drop here
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* PROSPECT DETAIL */}
      {selectedProspect && (
        <div style={{ marginTop: '16px', background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a3c5e', marginBottom: '4px' }}>{selectedProspect.first_name} {selectedProspect.last_name}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>{selectedProspect.email} · {selectedProspect.phone}</div>
              {selectedProspect.notes && (
                <div style={{ fontSize: '11px', color: '#475569', background: '#f8f9fc', padding: '10px', borderRadius: '8px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {selectedProspect.notes}
                </div>
              )}
            </div>
            <button onClick={() => setSelectedProspect(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px' }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}
