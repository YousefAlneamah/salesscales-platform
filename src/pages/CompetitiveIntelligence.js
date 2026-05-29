import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

export default function CompetitiveIntelligence() {
  const [analyses, setAnalyses] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ client_id: '', competitor_url: '' });

  useEffect(() => { fetchAnalyses(); fetchClients(); }, []);

  const fetchAnalyses = async () => {
    setLoading(true);
    const { data } = await supabase.from('competitor_analysis').select('*').order('created_at', { ascending: false });
    if (data) setAnalyses(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const analyze = async () => {
    if (!form.competitor_url) { alert('Competitor URL is required'); return; }
    setAnalyzing(true);
    try {
      const { data } = await axios.post(`${API_BASE}/competitors/analyze`, form);
      const row = data.analysis;
      if (row) { setAnalyses([row, ...analyses]); setSelected(row); }
      setShowForm(false);
      setForm({ client_id: '', competitor_url: '' });
    } catch (_) { alert('Analysis failed'); }
    setAnalyzing(false);
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
  const social = selected?.social_presence || {};
  const ads = Array.isArray(selected?.active_ads) ? selected.active_ads : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', height: 'calc(100vh - 120px)' }}>
      {/* LEFT — LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-label" style={{ margin: 0 }}>COMPETITORS ({analyses.length})</div>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-navy" style={{ fontSize: '10px', padding: '5px 12px' }}>+ Analyze</button>
        </div>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px' }}>
            <div className="section-label" style={{ marginBottom: '12px' }}>NEW ANALYSIS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Client (optional)</div>
                <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} style={inputStyle}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Competitor URL *</div>
                <input value={form.competitor_url} onChange={e => setForm({ ...form, competitor_url: e.target.value })} placeholder="e.g. https://competitor.com" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={analyze} disabled={analyzing} className="btn btn-gold" style={{ flex: 1, fontSize: '11px' }}>
                  {analyzing ? 'Hussain is analyzing...' : 'Analyze with Hussain'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn btn-outline" style={{ fontSize: '11px' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: '#8896a8', fontSize: '12px', textAlign: 'center', padding: '40px 0' }}>Loading...</div>
        ) : analyses.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎯</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>No competitor analyses yet</div>
            <div style={{ fontSize: '11px' }}>Analyze your first competitor above</div>
          </div>
        ) : analyses.map(a => (
          <div key={a.id} onClick={() => setSelected(a)}
            style={{ background: 'white', border: `1px solid ${selected?.id === a.id ? '#c9a84c' : '#e4e9f0'}`, borderLeft: `3px solid ${selected?.id === a.id ? '#c9a84c' : '#e4e9f0'}`, borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', flex: 1, paddingRight: '8px', textTransform: 'capitalize' }}>{a.competitor_name || a.competitor_url}</div>
              <span className={(a.active_ads?.length || 0) > 0 ? 'badge-green' : 'badge-yellow'}>{a.active_ads?.length || 0} ads</span>
            </div>
            <div style={{ fontSize: '10px', color: '#8896a8' }}>{new Date(a.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>

      {/* RIGHT — DETAIL */}
      {selected ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: '#0a1628', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '2px', textTransform: 'capitalize' }}>{selected.competitor_name || selected.competitor_url}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                {ads.length} active ads · {(selected.report?.split(/\s+/).length || 0)} words
              </div>
            </div>
            <button onClick={() => copy(selected.report)} style={{ fontSize: '10px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer' }}>
              {copied ? '✓ Copied' : 'Copy Report'}
            </button>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            {/* Social presence */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {social.facebook_ad_library && <a href={social.facebook_ad_library} target="_blank" rel="noreferrer" style={{ fontSize: '10px', padding: '5px 10px', borderRadius: '8px', background: '#f0f3f8', color: '#0a1628', textDecoration: 'none', fontWeight: 600 }}>Ad Library →</a>}
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" style={{ fontSize: '10px', padding: '5px 10px', borderRadius: '8px', background: '#f0f3f8', color: '#0a1628', textDecoration: 'none', fontWeight: 600 }}>Instagram →</a>}
              {social.tiktok && <a href={social.tiktok} target="_blank" rel="noreferrer" style={{ fontSize: '10px', padding: '5px 10px', borderRadius: '8px', background: '#f0f3f8', color: '#0a1628', textDecoration: 'none', fontWeight: 600 }}>TikTok →</a>}
              {social.twitter && <a href={social.twitter} target="_blank" rel="noreferrer" style={{ fontSize: '10px', padding: '5px 10px', borderRadius: '8px', background: '#f0f3f8', color: '#0a1628', textDecoration: 'none', fontWeight: 600 }}>Twitter/X →</a>}
            </div>

            {/* Active ads */}
            {ads.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div className="section-label" style={{ marginBottom: '8px' }}>ACTIVE ADS ({ads.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ads.map((ad, i) => (
                    <div key={i} style={{ background: '#f0f3f8', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#0a1628' }}>
                      {ad.title && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{ad.title}</div>}
                      <div style={{ color: '#4a5568', lineHeight: 1.5 }}>{ad.body || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hussain report */}
            <div className="section-label" style={{ marginBottom: '8px' }}>HUSSAIN'S REPORT</div>
            <div style={{ fontSize: '12px', color: '#0a1628', lineHeight: '1.8', whiteSpace: 'pre-wrap', fontFamily: 'DM Sans, sans-serif' }}>
              {selected.report}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#8896a8', gap: '8px' }}>
          <div style={{ fontSize: '32px' }}>🎯</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>Select a competitor to view the report</div>
          <div style={{ fontSize: '11px' }}>Or analyze a new one from the panel on the left</div>
        </div>
      )}
    </div>
  );
}
