import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function KnowledgeBase() {
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

  const aiMembers = ['All Team', 'Ali', 'Hassan', 'Mahdi', 'Hussain', 'Zainab', 'Fatima'];

  useEffect(() => {
    fetchDocuments();
    fetchClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDocuments = async () => {
    setLoading(true);
    const { data } = await supabase.from('knowledge_base').select('*').order('created_at', { ascending: false });
    if (data) setDocuments(data);
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

    let finalContent = content;
    let finalSource = 'Manual';

    if (url && url.includes('youtube.com') && !pdfFile) {
      try {
        const response = await fetch('http://localhost:3001/youtube-transcript', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (data.success) { finalContent = data.text; finalSource = 'YouTube'; }
        else { alert('YouTube transcript failed: ' + data.error); setProcessing(false); return; }
      } catch (e) { alert('YouTube error: ' + e.message); setProcessing(false); return; }
    }

    if (pdfFile) {
      try {
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        const response = await fetch('http://localhost:3001/upload-pdf', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) { finalContent = data.text; finalSource = 'PDF Upload'; }
        else { alert('PDF failed: ' + data.error); setProcessing(false); return; }
      } catch (e) { alert('PDF error: ' + e.message); setProcessing(false); return; }
    }

    const { data, error } = await supabase.from('knowledge_base').insert([{
      title, content: finalContent, url, type,
      source: finalSource, client_id: clientId,
      status: 'trained', notes: aiMember
    }]).select();

    if (!error && data) {
      try {
        await fetch('http://localhost:3001/generate-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: finalContent,
            documentId: data[0].id
          })
        });
        console.log('Embedding generated for:', title);
      } catch (e) {
        console.log('Embedding generation failed — document saved without embedding');
      }

      fetchDocuments();
      setShowForm(false);
      setTitle(''); setContent(''); setUrl(''); setType('document');
      setClientId(''); setPdfFile(null); setAiMember('All Team');
    } else {
      alert('Error: ' + error?.message);
    }
    setProcessing(false);
  };

  const searchKnowledge = async () => {
    if (!searchQuery) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const response = await fetch('http://localhost:3001/search-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          clientId: filterClient !== 'All' ? filterClient : null
        })
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

  const typeIcon = (t) => ({ document: '📄', website: '🌐', faq: '❓', product: '📦', review: '⭐', script: '📝', case_study: '🏆' }[t] || '📋');
  const typeLabel = (t) => ({ document: 'Document', website: 'Website', faq: 'FAQ', product: 'Product', review: 'Review', script: 'Script', case_study: 'Case Study' }[t] || t);

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

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Knowledge Base</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{documents.length} documents · {clients.length} AI brains active</div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          + Add Document
        </button>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Documents', value: documents.length, sub: 'in knowledge base', color: '#c9a84c' },
          { label: 'AI Brains', value: clients.length, sub: 'active client brains', color: '#c9a84c' },
          { label: 'With Embeddings', value: documents.filter(d => d.embedding).length, sub: 'RAG ready', color: '#10b981' },
          { label: 'Processing', value: documents.filter(d => d.status === 'processing').length, sub: 'being ingested', color: '#d97706' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 18px', borderTop: `2px solid ${stat.color}`, boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: stat.color, fontWeight: 500 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* RAG SEARCH */}
      <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px', border: '1px solid rgba(201,168,76,0.2)' }}>
        <div style={{ fontSize: '9px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>RAG Search — Search by Meaning</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>Search your knowledge base using AI — finds relevant content even when exact words do not match</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchKnowledge()}
            placeholder="e.g. How to handle cart abandonment objections..."
            style={{ flex: 1, border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'white', outline: 'none', background: 'rgba(255,255,255,0.08)', fontFamily: 'DM Sans, sans-serif' }} />
          <button onClick={searchKnowledge} disabled={searching || !searchQuery}
            style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {searching ? 'Searching...' : '🔍 Search'}
          </button>
        </div>

        {searchResults && (
          <div style={{ marginTop: '14px' }}>
            {searchResults.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '10px' }}>No relevant documents found</div>
            ) : searchResults.map((result, i) => (
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
                  <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '2px' }}>{documents.filter(d => d.client_id === client.id).length} documents · {documents.filter(d => d.client_id === client.id && d.embedding).length} RAG ready</div>
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
                {aiMembers.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>YouTube or Website URL</div>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=... or https://example.com" style={inputStyle} />
              {url && url.includes('youtube.com') && (
                <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>✓ YouTube URL — transcript will be pulled automatically</div>
              )}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upload PDF</div>
              <input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} style={{ ...inputStyle, padding: '7px 12px', cursor: 'pointer' }} />
              {pdfFile && <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>✓ {pdfFile.name} selected</div>}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Content — paste text directly</div>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Paste content here — brand guidelines, FAQs, scripts, or anything the AI should know..."
                rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addDocument} disabled={processing}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              {processing ? 'Processing & Training...' : 'Add to Knowledge Base'}
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
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#8896a8' }}>{filtered.length} documents</div>
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
                  {selectedDoc.embedding && <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>● RAG Ready</div>}
                  {!selectedDoc.embedding && <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 600 }}>○ No Embedding</div>}
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
          {selectedDoc.content && (
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', fontSize: '11px', color: '#475569', lineHeight: '1.7', maxHeight: '200px', overflowY: 'auto', border: '1px solid #f0f3f8' }}>
              {selectedDoc.content}
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTS LIST */}
      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧠</div>
          <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '6px', fontSize: '14px' }}>Knowledge base is empty</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Add documents, PDFs, or paste content to train the AI team</div>
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
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{doc.title}</div>
                  {doc.content && <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '1px' }}>{doc.content.substring(0, 50)}...</div>}
                </div>
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
  );
}