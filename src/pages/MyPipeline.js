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
  const [dragging, setDragging] = useState(null);

  const stages = [
    { id: 'New Prospect', color: '#8896a8', light: '#f8fafc' },
    { id: 'Audit Sent', color: '#3b82f6', light: '#eff6ff' },
    { id: 'Call Booked', color: '#7c3aed', light: '#f5f3ff' },
    { id: 'Proposal Sent', color: '#d97706', light: '#fffbeb' },
    { id: 'Negotiating', color: '#f97316', light: '#fff7ed' },
    { id: 'Closed', color: '#10b981', light: '#ecfdf5' },
  ];

  useEffect(() => { fetchProspects(); }, []);

  const fetchProspects = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('source', 'Prospect')
      .order('created_at', { ascending: false });
    if (data) setProspects(data);
    else {
      const { data: all } = await supabase.from('contacts').select('*').is('client_id', null).order('created_at', { ascending: false });
      if (all) setProspects(all);
    }
    setLoading(false);
  };

  const addProspect = async () => {
    if (!name || !email) { alert('Please fill in name and email'); return; }
    const parts = name.trim().split(' ');
    const { error } = await supabase.from('contacts').insert([{
      first_name: parts[0],
      last_name: parts.slice(1).join(' '),
      email, phone, source: 'Prospect', channel: source,
      pipeline_stage: stage,
      notes: `Business: ${business}\nNiche: ${niche}\nEst Revenue: ${revenue}\nTier Target: ${tier}\n\n${notes}`,
      last_activity: new Date().toISOString()
    }]);
    if (!error) {
      fetchProspects();
      setShowForm(false);
      setName(''); setEmail(''); setPhone(''); setBusiness('');
      setNiche(''); setRevenue(''); setStage('New Prospect');
      setSource('LinkedIn'); setNotes(''); setTier('starter');
    }
  };

  const moveStage = async (id, newStage) => {
    await supabase.from('contacts').update({ pipeline_stage: newStage }).eq('id', id);
    fetchProspects();
  };

  const getProspectsForStage = (s) => prospects.filter(p => p.pipeline_stage === s);
  const closedValue = prospects.filter(p => p.pipeline_stage === 'Closed').length * 3000;

  const handleDragStart = (e, prospect) => { setDragging(prospect); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e, stageId) => {
    e.preventDefault();
    if (dragging && dragging.pipeline_stage !== stageId) moveStage(dragging.id, stageId);
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
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Sales Scales — My Pipeline</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{prospects.length} prospects · ${closedValue.toLocaleString()} closed value</div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          + Add Prospect
        </button>
      </div>

      {/* STAGE STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {stages.map(s => (
          <div key={s.id} style={{ background: 'white', border: `1px solid ${s.color}25`, borderRadius: '10px', padding: '12px 14px', borderTop: `2px solid ${s.color}` }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0a1628' }}>{getProspectsForStage(s.id).length}</div>
            <div style={{ fontSize: '9px', color: '#8896a8', marginTop: '2px', fontWeight: 500 }}>{s.id}</div>
          </div>
        ))}
      </div>

      {/* ADD PROSPECT FORM */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>New Prospect</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</div>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@store.com" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</div>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+965 XXXX XXXX" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Store Name</div>
              <input type="text" value={business} onChange={e => setBusiness(e.target.value)} placeholder="e.g. Peak Fitness" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Niche</div>
              <input type="text" value={niche} onChange={e => setNiche(e.target.value)} placeholder="e.g. Fitness Supplements" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Est. Monthly Revenue</div>
              <input type="text" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="e.g. $50K/mo" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</div>
              <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                <option>LinkedIn</option>
                <option>Instagram</option>
                <option>Referral</option>
                <option>Audit Tool</option>
                <option>Cold Email</option>
                <option>Manual</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Tier</div>
              <select value={tier} onChange={e => setTier(e.target.value)} style={inputStyle}>
                <option value="starter">Starter — $1,500/mo</option>
                <option value="growth">Growth — $3,000/mo</option>
                <option value="elite">Elite — $6,000/mo</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage</div>
              <select value={stage} onChange={e => setStage(e.target.value)} style={inputStyle}>
                {stages.map(s => <option key={s.id}>{s.id}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addProspect} style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Save Prospect</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* KANBAN */}
      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          {stages.map(stageObj => {
            const stageProspects = getProspectsForStage(stageObj.id);
            return (
              <div key={stageObj.id}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, stageObj.id)}
                style={{ background: stageObj.light, borderRadius: '10px', padding: '12px', minHeight: '280px', border: `1px solid ${stageObj.color}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: stageObj.color, letterSpacing: '1px', textTransform: 'uppercase' }}>{stageObj.id}</div>
                  <div style={{ fontSize: '9px', background: stageObj.color, color: 'white', borderRadius: '10px', padding: '1px 7px', fontWeight: 700 }}>{stageProspects.length}</div>
                </div>

                {stageProspects.map(prospect => (
                  <div key={prospect.id}
                    draggable
                    onDragStart={e => handleDragStart(e, prospect)}
                    onClick={() => setSelectedProspect(selectedProspect?.id === prospect.id ? null : prospect)}
                    style={{ background: 'white', border: `1px solid ${selectedProspect?.id === prospect.id ? stageObj.color : '#e4e9f0'}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', cursor: 'grab', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628', marginBottom: '3px' }}>{prospect.first_name} {prospect.last_name}</div>
                    <div style={{ fontSize: '9px', color: '#8896a8', marginBottom: '3px' }}>{prospect.email}</div>
                    <div style={{ fontSize: '9px', color: stageObj.color, fontWeight: 500 }}>{prospect.channel}</div>
                    <div style={{ fontSize: '9px', color: '#c4cdd6', marginTop: '5px' }}>{new Date(prospect.created_at).toLocaleDateString()}</div>
                  </div>
                ))}

                {stageProspects.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 8px', color: '#c4cdd6', fontSize: '10px', border: '1px dashed #e4e9f0', borderRadius: '8px' }}>
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
        <div style={{ marginTop: '16px', background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '18px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>{selectedProspect.first_name} {selectedProspect.last_name}</div>
              <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '10px' }}>{selectedProspect.email} · {selectedProspect.phone}</div>
              {selectedProspect.notes && (
                <div style={{ fontSize: '11px', color: '#475569', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f0f3f8', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {selectedProspect.notes}
                </div>
              )}
            </div>
            <button onClick={() => setSelectedProspect(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}