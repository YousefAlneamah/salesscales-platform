import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { supabase } from '../supabase';

const AI_MEMBERS = ['All Team', 'Ali', 'Hassan', 'Mahdi', 'Hussain', 'Zainab', 'Fatima'];

const SCORE_BADGE = (score) => {
  if (score >= 8) return 'badge-green';
  if (score >= 6) return 'badge-gold';
  if (score >= 4) return 'badge-yellow';
  return 'badge-red';
};

export default function KnowledgeBase() {
  // ─── documents tab state ─────────────────────────────────
  const [documents, setDocuments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterClient, setFilterClient] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [processing, setProcessing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('document');
  const [clientId, setClientId] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [aiMember, setAiMember] = useState('All Team');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // ─── bulk import tab state ────────────────────────────────
  const [activeTab, setActiveTab] = useState('documents');
  const [channelUrl, setChannelUrl] = useState('');
  const [importClientId, setImportClientId] = useState('');
  const [importAiMember, setImportAiMember] = useState('All Team');
  const [importing, setImporting] = useState(false);
  const [importJob, setImportJob] = useState(null);
  const logRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
    fetchClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [importJob?.log]);

  // SSE listener for import progress
  useEffect(() => {
    if (!importJob?.jobId) return;
    if (importJob.status === 'complete' || importJob.status === 'error') return;

    const es = new EventSource(
      `${API_BASE}/knowledge/import-channel/progress?jobId=${importJob.jobId}`
    );

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setImportJob(prev => ({
        ...prev,
        status: data.status,
        log: [...(prev.log || []), ...data.newLogs],
        videos: data.videos?.length ? data.videos : (prev.videos || []),
        videosQueued: data.videosQueued || prev.videosQueued,
        videosProcessed: data.videosProcessed,
        chunksAdded: data.chunksAdded,
        error: data.error,
      }));
      if (data.status === 'complete' || data.status === 'error') {
        es.close();
        setImporting(false);
        if (data.status === 'complete') fetchDocuments();
      }
    };

    es.onerror = () => { es.close(); setImporting(false); };
    return () => es.close();
  }, [importJob?.jobId, importJob?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/knowledge/count`);
      setTotalCount(data.count || 0);
      setDocuments([]);
    } catch (e) {
      console.error('Failed to fetch knowledge count:', e.message);
    }
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const addDocument = async () => {
    if (!title || !clientId) { alert('Please fill in title and select a client'); return; }
    if (!content && !url && !pdfFile) { alert('Please add content, a URL, or upload a PDF'); return; }
    setProcessing(true);

    try {
      if (pdfFile) {
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        formData.append('title', title);
        formData.append('clientId', clientId);
        formData.append('type', type);
        formData.append('aiMember', aiMember);
        const response = await fetch(`${API_BASE}/upload-pdf`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
          alert(`✅ ${data.chunks} chunks are being processed in the background. Refresh in a few minutes.`);
          setShowForm(false);
          setTitle(''); setContent(''); setUrl(''); setType('document');
          setClientId(''); setPdfFile(null); setAiMember('All Team');
        } else {
          alert('PDF upload failed: ' + (data.error || 'Unknown error'));
        }
        setProcessing(false);
        return;
      }

      let finalContent = content;
      let finalSource = 'Manual';

      if (url && url.includes('youtube.com')) {
        try {
          const response = await fetch(`${API_BASE}/youtube-transcript`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const data = await response.json();
          if (data.success) { finalContent = data.text; finalSource = 'YouTube'; }
          else { alert('YouTube transcript failed: ' + data.error); setProcessing(false); return; }
        } catch (e) { alert('YouTube error: ' + e.message); setProcessing(false); return; }
      }

      const { data, error } = await supabase.from('knowledge_base').insert([{
        title, content: finalContent, url, type,
        source: finalSource, client_id: clientId,
        status: 'trained', notes: aiMember
      }]).select();

      if (!error && data) {
        try {
          await fetch(`${API_BASE}/generate-embedding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: finalContent, documentId: data[0].id })
          });
        } catch (e) {
          console.log('Embedding failed — document saved without embedding');
        }
        fetchDocuments();
        setShowForm(false);
        setTitle(''); setContent(''); setUrl(''); setType('document');
        setClientId(''); setPdfFile(null); setAiMember('All Team');
      } else {
        alert('Error: ' + error?.message);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setProcessing(false);
  };

  const startImport = async () => {
    if (!channelUrl) return;
    setImporting(true);
    setImportJob({ jobId: null, status: 'starting', log: [], videos: [], videosQueued: 0, videosProcessed: 0, chunksAdded: 0, error: null });

    try {
      const res = await fetch(`${API_BASE}/knowledge/import-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl, clientId: importClientId || null, aiMember: importAiMember }),
      });
      const data = await res.json();
      if (data.error) {
        setImportJob(prev => ({ ...prev, status: 'error', error: data.error }));
        setImporting(false);
        return;
      }
      setImportJob(prev => ({ ...prev, jobId: data.jobId, status: 'running' }));
    } catch (e) {
      setImportJob(prev => ({ ...prev, status: 'error', error: e.message }));
      setImporting(false);
    }
  };

  const searchKnowledge = async () => {
    if (!searchQuery) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const response = await fetch(`${API_BASE}/search-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, clientId: filterClient !== 'All' ? filterClient : null })
      });
      const data = await response.json();
      if (data.success) setSearchResults(data.results);
    } catch (e) {
      console.error('Search error:', e.message);
    }
    setSearching(false);
  };

  const deleteDocument = async (id) => {
    await supabase.from('knowledge_base').delete().eq('id', id);
    fetchDocuments();
    if (selectedDoc?.id === id) setSelectedDoc(null);
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const typeIcon = (t) => ({ document: '📄', website: '🌐', faq: '❓', product: '📦', review: '⭐', script: '📝', case_study: '🏆', video: '🎬' }[t] || '📋');
  const typeLabel = (t) => ({ document: 'Document', website: 'Website', faq: 'FAQ', product: 'Product', review: 'Review', script: 'Script', case_study: 'Case Study', video: 'Video' }[t] || t);

  const filtered = documents.filter(d => {
    const matchClient = filterClient === 'All' || d.client_id === filterClient;
    const matchType = filterType === 'All' || d.type === filterType;
    return matchClient && matchType;
  });

  const inputStyle = {
    width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#0a1628',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif'
  };

  const qualifying = importJob?.videos?.filter(v => v.score >= 7) || [];

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Knowledge Base</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{totalCount.toLocaleString()} total chunks · {clients.length} AI brains active</div>
        </div>
        {activeTab === 'documents' && (
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Add Document
          </button>
        )}
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Chunks', value: totalCount.toLocaleString(), sub: 'in knowledge base', color: '#c9a84c' },
          { label: 'AI Brains', value: clients.length, sub: 'active client brains', color: '#c9a84c' },
          { label: 'RAG Ready', value: documents.filter(d => d.embedding).length, sub: 'of last 100 shown', color: '#10b981' },
          { label: 'Video Chunks', value: documents.filter(d => d.source === 'YouTube Channel Import').length, sub: 'from channel imports', color: '#3b82f6' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e4e9f0', marginBottom: '20px' }}>
        {[
          { key: 'documents', label: 'Documents', icon: 'ti-files' },
          { key: 'bulk', label: 'Bulk Import', icon: 'ti-brand-youtube' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${activeTab === tab.key ? '#c9a84c' : 'transparent'}`,
              color: activeTab === tab.key ? '#0a1628' : '#8896a8',
              fontWeight: activeTab === tab.key ? 700 : 400,
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              marginBottom: '-1px', transition: 'all 0.15s',
            }}>
            <i className={`ti ${tab.icon}`} style={{ fontSize: '14px' }} aria-hidden="true"></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── DOCUMENTS TAB ─────────────────────────────────── */}
      {activeTab === 'documents' && (
        <div>
          {/* RAG SEARCH */}
          <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>RAG Search — Search by Meaning</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>Search across all {totalCount.toLocaleString()} chunks using AI semantic search</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchKnowledge()}
                placeholder="e.g. How to handle price objections using NEPQ..."
                style={{ flex: 1, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'white', outline: 'none', background: 'rgba(255,255,255,0.08)', fontFamily: 'DM Sans, sans-serif' }} />
              <button onClick={searchKnowledge} disabled={searching || !searchQuery}
                style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {searching ? 'Searching...' : '🔍 Search'}
              </button>
            </div>
            {searchResults && (
              <div style={{ marginTop: '14px' }}>
                {searchResults.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '10px' }}>No relevant chunks found</div>
                ) : searchResults.map((result) => (
                  <div key={result.id} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>{result.title}</div>
                      <div style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 600 }}>{Math.round(result.similarity * 100)}% match</div>
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>{getClientName(result.client_id)} · {result.type}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {result.content?.substring(0, 200)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CLIENT BRAINS */}
          {clients.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Client AI Brains</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {clients.map(client => (
                  <div key={client.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🧠</div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{client.name}</div>
                      <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '2px' }}>{documents.filter(d => d.client_id === client.id).length} chunks visible</div>
                      <div style={{ fontSize: '9px', color: '#10b981', marginTop: '2px', fontWeight: 600 }}>● Active</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADD DOCUMENT FORM */}
          {showForm && (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>Add to Knowledge Base</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title</div>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. $100M Offers — Alex Hormozi" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client Store</div>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                    <option value="">Select store</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</div>
                  <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
                    <option value="document">Document</option>
                    <option value="website">Website</option>
                    <option value="faq">FAQ</option>
                    <option value="product">Product Info</option>
                    <option value="review">Customer Reviews</option>
                    <option value="script">Script</option>
                    <option value="case_study">Case Study</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Team Member</div>
                  <select value={aiMember} onChange={e => setAiMember(e.target.value)} style={inputStyle}>
                    {AI_MEMBERS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upload PDF — server handles chunking automatically</div>
                  <input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} style={{ ...inputStyle, padding: '7px 12px', cursor: 'pointer' }} />
                  {pdfFile && <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>✓ {pdfFile.name} selected — will be chunked automatically</div>}
                </div>
                {!pdfFile && (
                  <>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>YouTube URL</div>
                      <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." style={inputStyle} />
                      {url && url.includes('youtube.com') && (
                        <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>✓ YouTube URL — transcript will be pulled automatically</div>
                      )}
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Content — paste text directly</div>
                      <textarea value={content} onChange={e => setContent(e.target.value)}
                        placeholder="Paste content here — brand guidelines, FAQs, scripts, or anything the AI should know..."
                        rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addDocument} disabled={processing}
                  style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  {processing ? 'Uploading...' : pdfFile ? 'Upload & Chunk PDF' : 'Add to Knowledge Base'}
                </button>
                <button onClick={() => setShowForm(false)}
                  style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* FILTERS */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '160px' }}>
              <option value="All">All Stores</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inputStyle, width: '140px' }}>
              <option value="All">All Types</option>
              <option value="document">Document</option>
              <option value="website">Website</option>
              <option value="faq">FAQ</option>
              <option value="product">Product</option>
              <option value="review">Review</option>
              <option value="script">Script</option>
              <option value="case_study">Case Study</option>
              <option value="video">Video</option>
            </select>
            <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#8896a8' }}>Showing {filtered.length} of {totalCount.toLocaleString()} total</div>
          </div>

          {/* DOCUMENT DETAIL */}
          {selectedDoc && (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '28px' }}>{typeIcon(selectedDoc.type)}</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '3px' }}>{selectedDoc.title}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px' }}>
                      {getClientName(selectedDoc.client_id)} · {typeLabel(selectedDoc.type)} · {formatDate(selectedDoc.created_at)}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {selectedDoc.notes && <div style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 600 }}>AI Member: {selectedDoc.notes}</div>}
                      {selectedDoc.embedding ? (
                        <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>● RAG Ready</div>
                      ) : (
                        <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 600 }}>○ No Embedding</div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => deleteDocument(selectedDoc.id)}
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '7px', padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                    Delete
                  </button>
                  <button onClick={() => setSelectedDoc(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px', lineHeight: 1 }}>×</button>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTS LIST */}
          {loading ? (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧠</div>
              <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '6px', fontSize: '14px' }}>Knowledge base is empty</div>
              <div style={{ fontSize: '12px', color: '#8896a8' }}>Upload PDFs, paste content, or use Bulk Import to train the AI team</div>
            </div>
          ) : (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 1fr 1fr', padding: '12px 18px', background: '#0a1628' }}>
                {['DOCUMENT', 'STORE', 'TYPE', 'AI MEMBER', 'RAG', 'ADDED'].map(h => (
                  <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700 }}>{h}</div>
                ))}
              </div>
              {filtered.map(doc => (
                <div key={doc.id}
                  onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                  style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 1fr 1fr', padding: '13px 18px', borderBottom: '1px solid #f4f6fa', cursor: 'pointer', background: selectedDoc?.id === doc.id ? '#fafbfd' : 'white', transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (selectedDoc?.id !== doc.id) e.currentTarget.style.background = '#fafbfd'; }}
                  onMouseLeave={e => { if (selectedDoc?.id !== doc.id) e.currentTarget.style.background = 'white'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '20px', flexShrink: 0 }}>{typeIcon(doc.type)}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#4a5568', display: 'flex', alignItems: 'center' }}>{getClientName(doc.client_id)}</div>
                  <div style={{ fontSize: '11px', color: '#4a5568', display: 'flex', alignItems: 'center' }}>{typeLabel(doc.type)}</div>
                  <div style={{ fontSize: '11px', color: '#c9a84c', fontWeight: 500, display: 'flex', alignItems: 'center' }}>{doc.notes || 'All Team'}</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {doc.embedding ? (
                      <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 600 }}>● Ready</span>
                    ) : (
                      <span style={{ fontSize: '9px', color: '#d97706', fontWeight: 600 }}>○ Pending</span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8896a8', display: 'flex', alignItems: 'center' }}>{formatDate(doc.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── BULK IMPORT TAB ───────────────────────────────── */}
      {activeTab === 'bulk' && (
        <div>
          {/* IMPORT FORM */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <i className="ti ti-brand-youtube" style={{ fontSize: '18px', color: '#dc2626' }} aria-hidden="true"></i>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#0a1628' }}>Import YouTube Channel</div>
            </div>
            <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '20px', lineHeight: '1.6' }}>
              Paste a channel URL → Claude scores every video for relevance → transcripts for videos scoring 7+ are fetched, chunked into 1,000-char pieces, embedded, and saved to the knowledge base automatically.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <div className="section-label" style={{ marginBottom: '6px' }}>YouTube Channel URL</div>
                <input
                  style={inputStyle}
                  value={channelUrl}
                  onChange={e => setChannelUrl(e.target.value)}
                  placeholder="https://youtube.com/@ChannelName"
                  disabled={importing}
                />
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: '6px' }}>Client Store (optional)</div>
                <select style={inputStyle} value={importClientId} onChange={e => setImportClientId(e.target.value)} disabled={importing}>
                  <option value="">Global brain</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <div className="section-label" style={{ marginBottom: '6px' }}>Assign to AI Member</div>
                <select style={inputStyle} value={importAiMember} onChange={e => setImportAiMember(e.target.value)} disabled={importing}>
                  {AI_MEMBERS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button className="btn btn-gold" onClick={startImport} disabled={importing || !channelUrl}>
                <i className="ti ti-download" style={{ marginRight: '6px' }} aria-hidden="true"></i>
                {importing ? 'Importing...' : 'Import Channel'}
              </button>
              {importJob?.status === 'complete' && (
                <button className="btn btn-outline" onClick={() => { setImportJob(null); setChannelUrl(''); }}>
                  Import Another
                </button>
              )}
            </div>
          </div>

          {/* PROGRESS */}
          {importJob && (
            <div>
              {/* Mini stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Videos Found', value: importJob.videosQueued || 0, color: '#c9a84c' },
                  { label: 'Scored 7+', value: qualifying.length, color: '#10b981' },
                  { label: 'Processed', value: importJob.videosProcessed || 0, color: '#3b82f6' },
                  { label: 'Chunks Added', value: importJob.chunksAdded || 0, color: '#c9a84c' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '14px 16px', borderTop: `2px solid ${s.color}` }}>
                    <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>{s.label}</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {importJob.videosQueued > 0 && qualifying.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8896a8', marginBottom: '6px' }}>
                    <span>Processing qualifying videos</span>
                    <span>{importJob.videosProcessed} / {qualifying.length}</span>
                  </div>
                  <div className="pbar">
                    <div className="pfill-green" style={{ width: `${qualifying.length > 0 ? Math.round((importJob.videosProcessed / qualifying.length) * 100) : 0}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )}

              {/* Status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span className={
                  importJob.status === 'complete' ? 'badge-green' :
                  importJob.status === 'error' ? 'badge-red' :
                  'badge-gold'
                } style={{ padding: '5px 14px', borderRadius: '7px' }}>
                  {importJob.status === 'complete' ? '✓ Complete' :
                   importJob.status === 'error' ? '✕ Error' :
                   importJob.status === 'starting' ? '◌ Starting...' :
                   '● Running'}
                </span>
                {importJob.error && (
                  <span style={{ fontSize: '12px', color: '#dc2626' }}>{importJob.error}</span>
                )}
              </div>

              {/* Video scoring table */}
              {importJob.videos?.length > 0 && (
                <div className="card" style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Video Relevance Scores</span>
                    <span style={{ fontSize: '11px', color: '#8896a8', fontWeight: 400 }}>
                      {qualifying.length} of {importJob.videos.length} scored 7+ (importing)
                    </span>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    <div className="table-header">
                      <div className="th" style={{ flex: 1 }}>Video Title</div>
                      <div className="th" style={{ flex: '0 0 70px' }}>Score</div>
                      <div className="th" style={{ flex: '0 0 80px' }}>Status</div>
                    </div>
                    {importJob.videos.slice().sort((a, b) => (b.score || 0) - (a.score || 0)).map((v, i) => (
                      <div key={i} className="table-row" style={{ opacity: v.score < 7 ? 0.5 : 1 }}>
                        <div className="td" style={{ flex: 1, fontSize: '12px', fontWeight: v.score >= 7 ? 500 : 400 }}>{v.title}</div>
                        <div className="td" style={{ flex: '0 0 70px' }}>
                          <span className={SCORE_BADGE(v.score)}>{v.score}/10</span>
                        </div>
                        <div className="td" style={{ flex: '0 0 80px', fontSize: '11px', color: v.score >= 7 ? '#10b981' : '#8896a8' }}>
                          {v.score >= 7 ? 'importing' : 'skipped'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live log */}
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-terminal-2" style={{ color: '#8896a8' }} aria-hidden="true"></i>
                  Live Progress Log
                </div>
                <div ref={logRef} style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  lineHeight: '1.8',
                  color: '#4a5568',
                  background: '#f8fafc',
                  border: '1px solid #e4e9f0',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  minHeight: '80px',
                }}>
                  {importJob.log?.length === 0 && (
                    <span style={{ color: '#8896a8' }}>Waiting for server...</span>
                  )}
                  {importJob.log?.map((entry, i) => (
                    <div key={i}>
                      <span style={{ color: '#8896a8', marginRight: '8px' }}>{entry.time?.substring(11, 19)}</span>
                      <span style={{ color: entry.msg?.startsWith('✅') ? '#10b981' : entry.msg?.startsWith('❌') ? '#dc2626' : '#0a1628' }}>
                        {entry.msg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!importJob && (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <i className="ti ti-brand-youtube" style={{ fontSize: '40px', color: '#dc2626', display: 'block', marginBottom: '16px' }} aria-hidden="true"></i>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#0a1628', marginBottom: '8px' }}>Bulk YouTube Channel Importer</div>
              <div style={{ fontSize: '12px', color: '#8896a8', lineHeight: '1.7', maxWidth: '440px', margin: '0 auto' }}>
                Paste a channel URL above and click Import Channel. Every video gets scored by Claude Haiku — only those scoring 7/10 or higher get their transcripts chunked, embedded, and saved to the knowledge base.
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '20px', justifyContent: 'center', fontSize: '11px', color: '#8896a8' }}>
                <span>📊 AI relevance scoring</span>
                <span>🎯 7+ threshold filter</span>
                <span>🧩 1,000-char chunks</span>
                <span>🔢 Auto embeddings</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
