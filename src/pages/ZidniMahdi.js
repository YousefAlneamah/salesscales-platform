import React, { useState, useEffect } from 'react';
import axios from 'axios';

const NICHES = ['Personal Finance', 'AI Tools', 'Productivity', 'Digital Marketing', 'Health & Wellness', 'E-Commerce'];

const STREAMS = [
  { id: 'etsy', label: 'Etsy Products' },
  { id: 'kdp', label: 'KDP Books' },
  { id: 'gumroad', label: 'Gumroad Products' },
  { id: 'pinterest', label: 'Pinterest Pins' },
  { id: 'affiliate', label: 'Affiliate Content' },
  { id: 'shopify', label: 'Shopify Products' },
  { id: 'redbubble', label: 'Redbubble Designs' },
];

const KB_FIELDS = [
  { key: 'target_audience', label: 'Target Audience', placeholder: 'Who is this content for? Demographics, pain points, motivations...' },
  { key: 'top_products', label: 'Top Products', placeholder: 'Best-performing products and formats for this niche...' },
  { key: 'affiliate_programs', label: 'Affiliate Programs', placeholder: 'Recommended programs, commissions, and best angles...' },
  { key: 'content_hooks', label: 'Content Hooks', placeholder: 'Proven headlines, angles, and conversion triggers...' },
  { key: 'forbidden_phrases', label: 'Forbidden Phrases', placeholder: 'Words and phrases Mahdi should never use...' },
];

function authHeaders() {
  return { Authorization: 'Bearer ' + localStorage.getItem('token') };
}

export default function ZidniMahdi() {
  const [authed, setAuthed] = useState(false);
  const [kbNiche, setKbNiche] = useState(NICHES[0]);
  const [kb, setKb] = useState({});
  const [kbSaving, setKbSaving] = useState(false);
  const [kbMsg, setKbMsg] = useState('');
  const [genNiche, setGenNiche] = useState(NICHES[0]);
  const [genStream, setGenStream] = useState('etsy');
  const [genQty, setGenQty] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [queue, setQueue] = useState([]);
  const [queueFilter, setQueueFilter] = useState('pending');
  const [expanded, setExpanded] = useState(null);
  const [loadingQueue, setLoadingQueue] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
    if (!token || !raw) { window.location.href = '/'; return; }
    try {
      const u = JSON.parse(raw);
      if (u.role !== 'owner') { window.location.href = '/'; return; }
    } catch { window.location.href = '/'; return; }
    setAuthed(true);
    loadKB();
    loadQueue('pending');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadKB = async () => {
    try {
      const { data } = await axios.get('http://localhost:3001/zidni/mahdi/knowledge-base', { headers: authHeaders() });
      const map = {};
      (data.knowledge_base || []).forEach(e => { map[e.niche] = e; });
      setKb(map);
    } catch {}
  };

  const loadQueue = async (status) => {
    setLoadingQueue(true);
    try {
      const { data } = await axios.get('http://localhost:3001/zidni/mahdi/queue', {
        headers: authHeaders(),
        params: { status },
      });
      setQueue(data.items || []);
    } catch {}
    setLoadingQueue(false);
  };

  const handleKbChange = (field, value) => {
    setKb(prev => ({
      ...prev,
      [kbNiche]: { ...(prev[kbNiche] || {}), [field]: value },
    }));
  };

  const saveKB = async () => {
    setKbSaving(true);
    setKbMsg('');
    try {
      const entry = kb[kbNiche] || {};
      await axios.post('https://salesscales-server.onrender.com/zidni/mahdi/knowledge-base', {
        niche: kbNiche,
        target_audience: entry.target_audience || '',
        top_products: entry.top_products || '',
        affiliate_programs: entry.affiliate_programs || '',
        content_hooks: entry.content_hooks || '',
        forbidden_phrases: entry.forbidden_phrases || '',
      }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      setKbMsg('Saved');
      setTimeout(() => setKbMsg(''), 2500);
    } catch (err) {
      console.error('[ZidniMahdi] saveKB failed:', err.response?.status, err.response?.data || err.message);
      setKbMsg('Error');
    }
    setKbSaving(false);
  };

  const generate = async () => {
    setGenerating(true);
    setGenError('');
    try {
      await axios.post('https://salesscales-server.onrender.com/zidni/mahdi/generate', {
        niche: genNiche,
        stream: genStream,
        qty: genQty,
      }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      setQueueFilter('pending');
      loadQueue('pending');
    } catch (err) {
      console.error('[ZidniMahdi] generate failed:', err.response?.status, err.response?.data || err.message);
      setGenError(err.response?.data?.error || 'Generation failed. Try again.');
    }
    setGenerating(false);
  };

  const approve = async (id) => {
    try {
      await axios.post(`http://localhost:3001/zidni/mahdi/approve/${id}`, {}, { headers: authHeaders() });
      setQueue(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const reject = async (id) => {
    try {
      await axios.post(`http://localhost:3001/zidni/mahdi/reject/${id}`, {}, { headers: authHeaders() });
      setQueue(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const handleFilterChange = (f) => {
    setQueueFilter(f);
    loadQueue(f);
    setExpanded(null);
  };

  if (!authed) return null;

  const kbEntry = kb[kbNiche] || {};
  const pendingCount = queueFilter === 'pending' ? queue.length : 0;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 0 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #1a3050 0%, #050d1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(201,168,76,0.25)', flexShrink: 0 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 20, color: '#c9a84c' }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Mahdi — Zidni Knowledge Engine</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Knowledge base + AI content generation for passive income streams</p>
        </div>
      </div>

      {/* Section 1 — Knowledge Base */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Knowledge Base</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Teach Mahdi about each niche so generated content hits harder</div>
          </div>
          <button
            className="btn btn-gold"
            onClick={saveKB}
            disabled={kbSaving}
            style={{ fontSize: 12, padding: '8px 18px', flexShrink: 0 }}
          >
            {kbSaving ? 'Saving...' : kbMsg === 'Saved' ? '✓ Saved' : kbMsg === 'Error' ? 'Error' : 'Save KB'}
          </button>
        </div>

        {/* Niche tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {NICHES.map(n => (
            <button
              key={n}
              onClick={() => setKbNiche(n)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: kbNiche === n ? '#c9a84c' : 'var(--border)',
                background: kbNiche === n ? 'rgba(201,168,76,0.12)' : 'transparent',
                color: kbNiche === n ? '#c9a84c' : 'var(--muted)',
                fontSize: 12,
                fontWeight: kbNiche === n ? 700 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {n}
              {kb[n] && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {KB_FIELDS.map(f => (
            <div key={f.key} style={f.key === 'forbidden_phrases' ? { gridColumn: '1 / -1' } : {}}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{f.label}</label>
              <textarea
                value={kbEntry[f.key] || ''}
                onChange={e => handleKbChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={f.key === 'forbidden_phrases' ? 2 : 4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--bg)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 — Content Generator */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Content Generator</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>Mahdi generates ready-to-use content for any Zidni passive income stream</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Niche</label>
            <select
              value={genNiche}
              onChange={e => setGenNiche(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
            >
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Stream</label>
            <select
              value={genStream}
              onChange={e => setGenStream(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
            >
              {STREAMS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Quantity</label>
            <select
              value={genQty}
              onChange={e => setGenQty(parseInt(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
            >
              {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} items</option>)}
            </select>
          </div>
          <div>
            <button
              className="btn btn-navy"
              onClick={generate}
              disabled={generating}
              style={{ padding: '10px 20px', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              {generating ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: 'white', animation: 'zspin 0.7s linear infinite', display: 'inline-block' }} />
                  Generating...
                </span>
              ) : (
                <><i className="ti ti-sparkles" style={{ marginRight: 6 }} />Generate</>
              )}
            </button>
          </div>
        </div>
        {genError && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--red)', background: 'rgba(220,38,38,0.08)', padding: '9px 13px', borderRadius: 8 }}>
            {genError}
          </div>
        )}
      </div>

      {/* Section 3 — Approval Queue */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Approval Queue
              {pendingCount > 0 && (
                <span style={{ background: '#c9a84c', color: '#050d1a', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{pendingCount}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Review and approve AI-generated content before use</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['pending', 'approved', 'rejected'].map(f => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 16,
                  border: '1px solid',
                  borderColor: queueFilter === f ? '#c9a84c' : 'var(--border)',
                  background: queueFilter === f ? 'rgba(201,168,76,0.12)' : 'transparent',
                  color: queueFilter === f ? '#c9a84c' : 'var(--muted)',
                  fontSize: 11,
                  fontWeight: queueFilter === f ? 700 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loadingQueue ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>Loading...</div>
        ) : queue.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 0', color: 'var(--muted)' }}>
            <i className="ti ti-inbox" style={{ fontSize: 30, display: 'block', marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>No {queueFilter} items</div>
            {queueFilter === 'pending' && <div style={{ fontSize: 12, marginTop: 5, opacity: 0.7 }}>Use the generator above to create content</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {queue.map(item => (
              <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                {/* Row header */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: expanded === item.id ? 'var(--bg)' : 'var(--surface)', userSelect: 'none' }}
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title || (item.content && item.content.title) || 'Untitled'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {item.niche} &middot; {(STREAMS.find(s => s.id === item.stream) || {}).label || item.stream} &middot; {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <span
                    className={item.status === 'approved' ? 'badge-green' : item.status === 'rejected' ? 'badge-red' : 'badge-gold'}
                    style={{ fontSize: 10 }}
                  >
                    {item.status}
                  </span>
                  <i className={`ti ${expanded === item.id ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 14, color: 'var(--muted)', flexShrink: 0 }} />
                </div>

                {/* Expanded content */}
                {expanded === item.id && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)', padding: 18 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                      {Object.entries(item.content || {}).map(([key, val]) => {
                        const isFullWidth = Array.isArray(val) || key === 'description' || key === 'content_hook' || key === 'tagline' || key === 'concept';
                        return (
                          <div key={key} style={isFullWidth ? { gridColumn: '1 / -1' } : {}}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>
                              {key.replace(/_/g, ' ')}
                            </div>
                            {Array.isArray(val) ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {val.map((v, i) => (
                                  <span key={i} style={{ padding: '3px 10px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)' }}>
                                    {String(v)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{String(val)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {item.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-gold"
                          style={{ fontSize: 12, padding: '7px 18px' }}
                          onClick={() => approve(item.id)}
                        >
                          <i className="ti ti-check" style={{ marginRight: 5 }} />Approve
                        </button>
                        <button
                          style={{ fontSize: 12, padding: '7px 18px', borderRadius: 8, border: '1px solid var(--red)', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}
                          onClick={() => reject(item.id)}
                        >
                          <i className="ti ti-x" style={{ marginRight: 5 }} />Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes zspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
