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

const PAIN_FIELDS = [
  { key: 'emotional_pain_fear', label: 'Fear' },
  { key: 'emotional_pain_stress', label: 'Stress' },
  { key: 'emotional_pain_urgency', label: 'Urgency' },
  { key: 'emotional_pain_financial', label: 'Financial' },
  { key: 'emotional_pain_identity', label: 'Identity' },
];

function authHeaders() {
  return { Authorization: 'Bearer ' + localStorage.getItem('token') };
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--bg)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const textareaStyle = { ...inputStyle, resize: 'vertical', lineHeight: 1.5 };
const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 };
const sectionLabelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, marginTop: 20, paddingBottom: 6, borderBottom: '1px solid var(--border)' };

export default function ZidniMahdi() {
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState('kb');

  const [kbNiche, setKbNiche] = useState(NICHES[0]);
  const [kb, setKb] = useState({});
  const [kbSaving, setKbSaving] = useState(false);
  const [kbMsg, setKbMsg] = useState('');

  const [winnerNiche, setWinnerNiche] = useState(NICHES[0]);
  const [winnerKb, setWinnerKb] = useState({});
  const [winnerSaving, setWinnerSaving] = useState(false);
  const [winnerMsg, setWinnerMsg] = useState('');

  const [genNiche, setGenNiche] = useState(NICHES[0]);
  const [genStream, setGenStream] = useState('etsy');
  const [genQty, setGenQty] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [queue, setQueue] = useState([]);
  const [queueFilter, setQueueFilter] = useState('pending');
  const [expanded, setExpanded] = useState(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [publishing, setPublishing] = useState({});
  const [publishResult, setPublishResult] = useState({});

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
    loadWinnerKB();
    loadQueue('pending');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadKB = async () => {
    try {
      const { data } = await axios.get('https://salesscales-server.onrender.com/zidni/mahdi/knowledge-base', { headers: authHeaders() });
      const map = {};
      (data.knowledge_base || []).forEach(e => { map[e.niche] = e; });
      setKb(map);
    } catch {}
  };

  const loadWinnerKB = async () => {
    try {
      const { data } = await axios.get('https://salesscales-server.onrender.com/zidni/mahdi/winner-kb', { headers: authHeaders() });
      const map = {};
      (data.winner_kb || []).forEach(e => { map[e.niche] = e; });
      setWinnerKb(map);
    } catch {}
  };

  const loadQueue = async (status) => {
    setLoadingQueue(true);
    try {
      const { data } = await axios.get('https://salesscales-server.onrender.com/zidni/mahdi/queue', {
        headers: authHeaders(),
        params: { status },
      });
      setQueue(data.items || []);
    } catch {}
    setLoadingQueue(false);
  };

  const handleKbChange = (field, value) => {
    setKb(prev => ({ ...prev, [kbNiche]: { ...(prev[kbNiche] || {}), [field]: value } }));
  };

  const handleWinnerChange = (field, value) => {
    setWinnerKb(prev => ({ ...prev, [winnerNiche]: { ...(prev[winnerNiche] || {}), [field]: value } }));
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
        full_document: entry.full_document || '',
      }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      setKbMsg('Saved');
      setTimeout(() => setKbMsg(''), 2500);
    } catch (err) {
      console.error('[ZidniMahdi] saveKB failed:', err.response?.status, err.response?.data || err.message);
      setKbMsg('Error');
    }
    setKbSaving(false);
  };

  const saveWinnerKB = async () => {
    setWinnerSaving(true);
    setWinnerMsg('');
    try {
      const entry = winnerKb[winnerNiche] || {};
      const parseScore = (v) => (v != null && v !== '' ? parseInt(v) : null);
      await axios.post('https://salesscales-server.onrender.com/zidni/mahdi/winner-kb', {
        niche: winnerNiche,
        community_facebook: entry.community_facebook || '',
        community_reddit: entry.community_reddit || '',
        community_youtube: entry.community_youtube || '',
        community_language: entry.community_language || '',
        community_pain_phrases: entry.community_pain_phrases || '',
        emotional_pain_fear: parseScore(entry.emotional_pain_fear),
        emotional_pain_stress: parseScore(entry.emotional_pain_stress),
        emotional_pain_urgency: parseScore(entry.emotional_pain_urgency),
        emotional_pain_financial: parseScore(entry.emotional_pain_financial),
        emotional_pain_identity: parseScore(entry.emotional_pain_identity),
        transformation_statement: entry.transformation_statement || '',
        keyword_primary: entry.keyword_primary || '',
        keyword_secondary: entry.keyword_secondary || '',
        competition_gap: entry.competition_gap || '',
        pricing_sweet_spot: entry.pricing_sweet_spot || '',
        seasonal_timing: entry.seasonal_timing || '',
        series_strategy: entry.series_strategy || '',
        scale_methods: entry.scale_methods || '',
        forbidden_concepts: entry.forbidden_concepts || '',
        full_document: entry.full_document || '',
      }, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
      setWinnerMsg('Saved');
      setTimeout(() => setWinnerMsg(''), 2500);
    } catch (err) {
      console.error('[ZidniMahdi] saveWinnerKB failed:', err.response?.status, err.response?.data || err.message);
      setWinnerMsg('Error');
    }
    setWinnerSaving(false);
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
      await axios.post(`https://salesscales-server.onrender.com/zidni/mahdi/approve/${id}`, {}, { headers: authHeaders() });
      setQueue(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const reject = async (id) => {
    try {
      await axios.post(`https://salesscales-server.onrender.com/zidni/mahdi/reject/${id}`, {}, { headers: authHeaders() });
      setQueue(prev => prev.filter(i => i.id !== id));
    } catch {}
  };

  const publishGumroad = async (id) => {
    setPublishing(prev => ({ ...prev, [id]: true }));
    setPublishResult(prev => ({ ...prev, [id]: null }));
    try {
      const { data } = await axios.post('https://salesscales-server.onrender.com/zidni/mahdi/auto-publish', { id }, { headers: authHeaders() });
      setPublishResult(prev => ({ ...prev, [id]: { url: data?.published_url || '' } }));
      setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'published', published_url: data?.published_url, gumroad_id: data?.gumroad_id } : i));
    } catch (err) {
      setPublishResult(prev => ({ ...prev, [id]: { error: err.response?.data?.error || 'Publish failed. Try again.' } }));
    }
    setPublishing(prev => ({ ...prev, [id]: false }));
  };

  const handleFilterChange = (f) => {
    setQueueFilter(f);
    loadQueue(f);
    setExpanded(null);
  };

  if (!authed) return null;

  const kbEntry = kb[kbNiche] || {};
  const winnerEntry = winnerKb[winnerNiche] || {};
  const pendingCount = queueFilter === 'pending' ? queue.length : 0;

  const nichePills = (active, setActive, filled) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
      {NICHES.map(n => (
        <button
          key={n}
          onClick={() => setActive(n)}
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid',
            borderColor: active === n ? '#c9a84c' : 'var(--border)',
            background: active === n ? 'rgba(201,168,76,0.12)' : 'transparent',
            color: active === n ? '#c9a84c' : 'var(--muted)',
            fontSize: 12, fontWeight: active === n ? 700 : 400, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {n}
          {filled[n] && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />}
        </button>
      ))}
    </div>
  );

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

      {/* Section 1 — Knowledge Base / Winner KB tabs */}
      <div className="card" style={{ marginBottom: 20 }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {[
            { id: 'kb', label: 'Knowledge Base', icon: 'ti-book' },
            { id: 'winner-kb', label: 'Winner KB', icon: 'ti-trophy' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 20px', border: 'none',
                borderBottom: activeTab === t.id ? '2px solid #c9a84c' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === t.id ? '#c9a84c' : 'var(--muted)',
                fontWeight: activeTab === t.id ? 700 : 400,
                fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'inherit', marginBottom: -1,
              }}
            >
              <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Knowledge Base tab ── */}
        {activeTab === 'kb' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Knowledge Base</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Teach Mahdi about each niche so generated content hits harder</div>
              </div>
              <button className="btn btn-gold" onClick={saveKB} disabled={kbSaving} style={{ fontSize: 12, padding: '8px 18px', flexShrink: 0 }}>
                {kbSaving ? 'Saving...' : kbMsg === 'Saved' ? '✓ Saved' : kbMsg === 'Error' ? 'Error' : 'Save KB'}
              </button>
            </div>

            {nichePills(kbNiche, setKbNiche, kb)}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {KB_FIELDS.map(f => (
                <div key={f.key} style={f.key === 'forbidden_phrases' ? { gridColumn: '1 / -1' } : {}}>
                  <label style={labelStyle}>{f.label}</label>
                  <textarea
                    value={kbEntry[f.key] || ''}
                    onChange={e => handleKbChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={f.key === 'forbidden_phrases' ? 2 : 4}
                    style={textareaStyle}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Full Knowledge Base Document</label>
              <textarea
                value={kbEntry.full_document || ''}
                onChange={e => handleKbChange('full_document', e.target.value)}
                placeholder="Paste your complete knowledge base document here."
                rows={20}
                style={textareaStyle}
              />
            </div>
          </>
        )}

        {/* ── Winner KB tab ── */}
        {activeTab === 'winner-kb' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Winner KB</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Deep market intelligence — community mapping, pain scoring, keywords, and scale strategy</div>
              </div>
              <button className="btn btn-gold" onClick={saveWinnerKB} disabled={winnerSaving} style={{ fontSize: 12, padding: '8px 18px', flexShrink: 0 }}>
                {winnerSaving ? 'Saving...' : winnerMsg === 'Saved' ? '✓ Saved' : winnerMsg === 'Error' ? 'Error' : 'Save Winner KB'}
              </button>
            </div>

            {nichePills(winnerNiche, setWinnerNiche, winnerKb)}

            {/* Community Mapping */}
            <div style={sectionLabelStyle}>Community Mapping</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { key: 'community_facebook', label: 'Facebook Groups', placeholder: 'Key Facebook groups and pages for this niche...' },
                { key: 'community_reddit', label: 'Reddit Communities', placeholder: 'Subreddits where the audience hangs out...' },
                { key: 'community_youtube', label: 'YouTube Channels', placeholder: 'Top YouTube channels in this niche...' },
                { key: 'community_language', label: 'Community Language', placeholder: 'Slang, jargon, and phrases the audience uses...' },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <textarea value={winnerEntry[f.key] || ''} onChange={e => handleWinnerChange(f.key, e.target.value)} placeholder={f.placeholder} rows={3} style={textareaStyle} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Pain Phrases</label>
                <textarea value={winnerEntry.community_pain_phrases || ''} onChange={e => handleWinnerChange('community_pain_phrases', e.target.value)} placeholder="Exact phrases the community uses to express their pain..." rows={3} style={textareaStyle} />
              </div>
            </div>

            {/* Emotional Pain Analysis */}
            <div style={sectionLabelStyle}>Emotional Pain Analysis (0 – 10)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
              {PAIN_FIELDS.map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={winnerEntry[f.key] != null ? winnerEntry[f.key] : ''}
                    onChange={e => handleWinnerChange(f.key, e.target.value === '' ? null : parseInt(e.target.value))}
                    placeholder="0–10"
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            {/* Transformation Statement */}
            <div style={sectionLabelStyle}>Transformation Statement</div>
            <textarea
              value={winnerEntry.transformation_statement || ''}
              onChange={e => handleWinnerChange('transformation_statement', e.target.value)}
              placeholder="From [current painful state] to [desired outcome] in [timeframe] without [biggest objection]..."
              rows={3}
              style={textareaStyle}
            />

            {/* Keywords and Competition */}
            <div style={sectionLabelStyle}>Keywords and Competition</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Primary Keyword</label>
                <input type="text" value={winnerEntry.keyword_primary || ''} onChange={e => handleWinnerChange('keyword_primary', e.target.value)} placeholder="Main keyword to own in this niche..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Secondary Keyword</label>
                <input type="text" value={winnerEntry.keyword_secondary || ''} onChange={e => handleWinnerChange('keyword_secondary', e.target.value)} placeholder="Supporting keyword or long-tail variation..." style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Competition Gap</label>
                <textarea value={winnerEntry.competition_gap || ''} onChange={e => handleWinnerChange('competition_gap', e.target.value)} placeholder="What competitors are missing or doing poorly that we can exploit..." rows={3} style={textareaStyle} />
              </div>
            </div>

            {/* Pricing and Timing */}
            <div style={sectionLabelStyle}>Pricing and Timing</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Pricing Sweet Spot</label>
                <input type="text" value={winnerEntry.pricing_sweet_spot || ''} onChange={e => handleWinnerChange('pricing_sweet_spot', e.target.value)} placeholder="Optimal price point that converts best for this niche..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Seasonal Timing</label>
                <input type="text" value={winnerEntry.seasonal_timing || ''} onChange={e => handleWinnerChange('seasonal_timing', e.target.value)} placeholder="Best months, seasons, or events to push this niche..." style={inputStyle} />
              </div>
            </div>

            {/* Scale Strategy */}
            <div style={sectionLabelStyle}>Scale Strategy</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Series Strategy</label>
                <textarea value={winnerEntry.series_strategy || ''} onChange={e => handleWinnerChange('series_strategy', e.target.value)} placeholder="How to build a content series that compounds over time..." rows={4} style={textareaStyle} />
              </div>
              <div>
                <label style={labelStyle}>Scale Methods</label>
                <textarea value={winnerEntry.scale_methods || ''} onChange={e => handleWinnerChange('scale_methods', e.target.value)} placeholder="Proven methods to scale output and revenue in this niche..." rows={4} style={textareaStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Forbidden Concepts</label>
                <textarea value={winnerEntry.forbidden_concepts || ''} onChange={e => handleWinnerChange('forbidden_concepts', e.target.value)} placeholder="Angles, claims, or concepts to never use for this niche..." rows={2} style={textareaStyle} />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Full Knowledge Base Document</label>
              <textarea
                value={winnerEntry.full_document || ''}
                onChange={e => handleWinnerChange('full_document', e.target.value)}
                placeholder="Paste your complete knowledge base document here."
                rows={20}
                style={textareaStyle}
              />
            </div>
          </>
        )}
      </div>

      {/* Section 2 — Content Generator */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Content Generator</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>Mahdi generates ready-to-use content for any Zidni passive income stream</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Niche</label>
            <select value={genNiche} onChange={e => setGenNiche(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Stream</label>
            <select value={genStream} onChange={e => setGenStream(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}>
              {STREAMS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Quantity</label>
            <select value={genQty} onChange={e => setGenQty(parseInt(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}>
              {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} items</option>)}
            </select>
          </div>
          <div>
            <button className="btn btn-navy" onClick={generate} disabled={generating} style={{ padding: '10px 20px', fontSize: 13, whiteSpace: 'nowrap' }}>
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
                  padding: '5px 14px', borderRadius: 16, border: '1px solid',
                  borderColor: queueFilter === f ? '#c9a84c' : 'var(--border)',
                  background: queueFilter === f ? 'rgba(201,168,76,0.12)' : 'transparent',
                  color: queueFilter === f ? '#c9a84c' : 'var(--muted)',
                  fontSize: 11, fontWeight: queueFilter === f ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize',
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
                  <span className={item.status === 'approved' ? 'badge-green' : item.status === 'rejected' ? 'badge-red' : 'badge-gold'} style={{ fontSize: 10 }}>
                    {item.status}
                  </span>
                  <i className={`ti ${expanded === item.id ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 14, color: 'var(--muted)', flexShrink: 0 }} />
                </div>

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
                        <button className="btn btn-gold" style={{ fontSize: 12, padding: '7px 18px' }} onClick={() => approve(item.id)}>
                          <i className="ti ti-check" style={{ marginRight: 5 }} />Approve
                        </button>
                        <button style={{ fontSize: 12, padding: '7px 18px', borderRadius: 8, border: '1px solid var(--red)', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => reject(item.id)}>
                          <i className="ti ti-x" style={{ marginRight: 5 }} />Reject
                        </button>
                      </div>
                    )}
                    {item.status === 'approved' && (
                      <div>
                        <button
                          className="btn btn-gold"
                          style={{ fontSize: 12, padding: '7px 18px', opacity: publishing[item.id] ? 0.6 : 1, cursor: publishing[item.id] ? 'default' : 'pointer' }}
                          disabled={publishing[item.id]}
                          onClick={() => publishGumroad(item.id)}
                        >
                          <i className={`ti ${publishing[item.id] ? 'ti-loader-2' : 'ti-shopping-cart-up'}`} style={{ marginRight: 5 }} />
                          {publishing[item.id] ? 'Publishing…' : 'Publish to Gumroad'}
                        </button>
                        {publishResult[item.id]?.url && (
                          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--green)' }}>
                            <i className="ti ti-check" style={{ marginRight: 5 }} />
                            Published —{' '}
                            <a href={publishResult[item.id].url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>
                              {publishResult[item.id].url}
                            </a>
                          </div>
                        )}
                        {publishResult[item.id]?.error && (
                          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--red)' }}>
                            <i className="ti ti-alert-triangle" style={{ marginRight: 5 }} />
                            {publishResult[item.id].error}
                          </div>
                        )}
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
