import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';

const API = 'http://localhost:3001';

export default function CaseStudies() {
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ client_id: '', title: '', results: '', timeline: '' });

  useEffect(() => { fetchCases(); fetchClients(); }, []);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/casestudies/list`);
      setCases(data.case_studies || []);
    } catch (_) {}
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const generate = async () => {
    if (!form.title || !form.results) { alert('Title and results are required'); return; }
    setGenerating(true);
    try {
      const { data } = await axios.post(`${API}/casestudies/create`, form);
      const newCase = data.case_study;
      setCases([newCase, ...cases]);
      setSelectedCase(newCase);
      setShowForm(false);
      setForm({ client_id: '', title: '', results: '', timeline: '' });
    } catch (_) { alert('Failed to generate case study'); }
    setGenerating(false);
  };

  const togglePublish = async (c) => {
    const newStatus = c.status === 'published' ? 'draft' : 'published';
    await supabase.from('case_studies').update({ status: newStatus }).eq('id', c.id);
    setCases(cases.map(cs => cs.id === c.id ? { ...cs, status: newStatus } : cs));
    if (selectedCase?.id === c.id) setSelectedCase({ ...selectedCase, status: newStatus });
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const inputStyle = { width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', height: 'calc(100vh - 120px)' }}>
      {/* LEFT — LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-label" style={{ margin: 0 }}>CASE STUDIES ({cases.length})</div>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-navy" style={{ fontSize: '10px', padding: '5px 12px' }}>+ Generate</button>
        </div>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px' }}>
            <div className="section-label" style={{ marginBottom: '12px' }}>NEW CASE STUDY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Client (optional)</div>
                <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} style={inputStyle}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Title *</div>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Luux Bags — 10x ROI in 30 Days" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Results *</div>
                <textarea value={form.results} onChange={e => setForm({ ...form, results: e.target.value })} placeholder="e.g. $16,200 revenue, 10.8x ROI, 340 emails sent, 28% open rate" rows={3} style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Timeline</div>
                <input value={form.timeline} onChange={e => setForm({ ...form, timeline: e.target.value })} placeholder="e.g. 30 days" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={generate} disabled={generating} className="btn btn-gold" style={{ flex: 1, fontSize: '11px' }}>
                  {generating ? 'Hussain is writing...' : 'Generate with Hussain'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn btn-outline" style={{ fontSize: '11px' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: '#8896a8', fontSize: '12px', textAlign: 'center', padding: '40px 0' }}>Loading...</div>
        ) : cases.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏆</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>No case studies yet</div>
            <div style={{ fontSize: '11px' }}>Generate your first one above</div>
          </div>
        ) : cases.map(c => (
          <div key={c.id} onClick={() => setSelectedCase(c)}
            style={{ background: 'white', border: `1px solid ${selectedCase?.id === c.id ? '#c9a84c' : '#e4e9f0'}`, borderLeft: `3px solid ${selectedCase?.id === c.id ? '#c9a84c' : '#e4e9f0'}`, borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', flex: 1, paddingRight: '8px' }}>{c.title}</div>
              <span className={c.status === 'published' ? 'badge-green' : 'badge-yellow'}>{c.status || 'draft'}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#8896a8' }}>
              {c.clients?.name && `${c.clients.name} · `}
              {c.timeline && `${c.timeline} · `}
              {new Date(c.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT — DETAIL */}
      {selectedCase ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: '#0a1628', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>{selectedCase.title}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                {selectedCase.clients?.name && `${selectedCase.clients.name} · `}
                {(selectedCase.content?.split(/\s+/).length || 0)} words
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => copy(selectedCase.content)} style={{ fontSize: '10px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button onClick={() => togglePublish(selectedCase)} style={{ fontSize: '10px', padding: '5px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: selectedCase.status === 'published' ? '#fde68a' : '#c9a84c', color: '#0a1628', fontWeight: 600 }}>
                {selectedCase.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </div>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, fontSize: '12px', color: '#0a1628', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontFamily: 'DM Sans, sans-serif' }}>
            {selectedCase.content}
          </div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#8896a8', gap: '8px' }}>
          <div style={{ fontSize: '32px' }}>🏆</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>Select a case study to view</div>
          <div style={{ fontSize: '11px' }}>Or generate a new one from the panel on the left</div>
        </div>
      )}
    </div>
  );
}
