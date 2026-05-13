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
  const [source, setSource] = useState('Manual');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [aiMember, setAiMember] = useState('All Team');

  const types = ['All', 'document', 'website', 'faq', 'product', 'review', 'script', 'case_study'];
  
  const aiMembers = ['All Team', 'Ali', 'Hassan', 'Mahdi', 'Hussain', 'Zainab', 'Fatima'];

  useEffect(() => {
    fetchDocuments();
    fetchClients();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setDocuments(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const addDocument = async () => {
    if (!title || !clientId) {
      alert('Please fill in title and select a client');
      return;
    }
    if (!content && !url && !pdfFile) {
      alert('Please add content, a URL, or upload a PDF');
      return;
    }
    setProcessing(true);

    let finalContent = content;
    let finalSource = source;

    // YouTube transcript
    if (url && url.includes('youtube.com') && !pdfFile) {
      try {
        const response = await fetch('http://localhost:3001/youtube-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (data.success) {
          finalContent = data.text;
          finalSource = 'YouTube';
          console.log('YouTube transcript extracted:', data.wordCount, 'words');
        } else {
          alert('YouTube transcript failed: ' + data.error);
          setProcessing(false);
          return;
        }
      } catch (e) {
        alert('YouTube error: ' + e.message);
        setProcessing(false);
        return;
      }
    }

    // PDF upload
    if (pdfFile) {
      try {
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        const response = await fetch('http://localhost:3001/upload-pdf', {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.success) {
          finalContent = data.text;
          finalSource = 'PDF Upload';
          console.log('PDF extracted:', data.pageCount, 'pages,', data.wordCount, 'words');
        } else {
          alert('PDF extraction failed: ' + data.error);
          setProcessing(false);
          return;
        }
      } catch (e) {
        alert('PDF upload error: ' + e.message);
        setProcessing(false);
        return;
      }
    }

    const { error } = await supabase.from('knowledge_base').insert([{
      title,
      content: finalContent,
      url,
      type,
      source: finalSource,
      client_id: clientId,
      status: 'trained',
      notes: aiMember
    }]);

    if (!error) {
      fetchDocuments();
      setShowForm(false);
      setTitle('');
      setContent('');
      setUrl('');
      setType('document');
      setClientId('');
      setSource('Manual');
      setPdfFile(null);
      setAiMember('All Team');
    } else {
      alert('Error saving: ' + error.message);
    }
    setProcessing(false);
  };

  const deleteDocument = async (id) => {
    await supabase.from('knowledge_base').delete().eq('id', id);
    fetchDocuments();
    if (selectedDoc?.id === id) setSelectedDoc(null);
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : '—';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const typeIcon = (type) => {
    const icons = {
      document: '📄', website: '🌐', faq: '❓',
      product: '📦', review: '⭐', script: '📝', case_study: '🏆'
    };
    return icons[type] || '📋';
  };

  const typeLabel = (type) => {
    const labels = {
      document: 'Document', website: 'Website', faq: 'FAQ',
      product: 'Product', review: 'Review', script: 'Script', case_study: 'Case Study'
    };
    return labels[type] || type;
  };

  const filtered = documents.filter(d => {
    const matchClient = filterClient === 'All' || d.client_id === filterClient;
    const matchType = filterType === 'All' || d.type === filterType;
    return matchClient && matchType;
  });

  const totalByClient = (clientId) => documents.filter(d => d.client_id === clientId).length;

  const inputStyle = {
    width: '100%', border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>KNOWLEDGE BASE</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{documents.length} documents · {clients.length} client brains</div>
        </div>
        <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>+ Add Document</button>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'TOTAL DOCUMENTS', value: documents.length, sub: 'in knowledge base' },
          { label: 'CLIENT BRAINS', value: clients.length, sub: 'active AI brains' },
          { label: 'TRAINED', value: documents.filter(d => d.status === 'trained').length, sub: 'ready for AI' },
          { label: 'PROCESSING', value: documents.filter(d => d.status === 'processing').length, sub: 'being ingested' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', borderTop: '2px solid #10b981' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a3c5e' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* CLIENT BRAINS */}
      {clients.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>CLIENT AI BRAINS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {clients.map(client => (
              <div key={client.id} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ecfdf5', border: '0.5px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🧠</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a3c5e' }}>{client.name}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{totalByClient(client.id)} documents trained</div>
                  <div style={{ fontSize: '9px', color: '#10b981', marginTop: '2px' }}>● AI Brain Active</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD DOCUMENT FORM */}
      {showForm && (
        <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '14px' }}>ADD TO KNOWLEDGE BASE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>TITLE</div>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. $100M Offers — Alex Hormozi" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>CLIENT</div>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>TYPE</div>
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
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>AI TEAM MEMBER</div>
              <select value={aiMember} onChange={e => setAiMember(e.target.value)} style={inputStyle}>
                {aiMembers.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>YOUTUBE OR WEBSITE URL (optional)</div>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://example.com" style={inputStyle} />
              {url && url.includes('youtube.com') && (
                <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>✓ YouTube URL detected — transcript will be pulled automatically</div>
              )}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>UPLOAD PDF (optional)</div>
              <input
                type="file"
                accept=".pdf"
                onChange={e => setPdfFile(e.target.files[0])}
                style={{ ...inputStyle, padding: '6px 12px', cursor: 'pointer' }}
              />
              {pdfFile && (
                <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>✓ {pdfFile.name} selected</div>
              )}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>CONTENT (paste text directly)</div>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Paste content here — brand guidelines, FAQs, scripts, transcripts, or anything the AI should know..."
                rows={6} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-green" onClick={addDocument} disabled={processing}>
              {processing ? 'Processing...' : 'Add to Knowledge Base'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ ...inputStyle, width: '160px' }}>
          <option value="All">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ ...inputStyle, width: '140px' }}>
          {types.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : typeLabel(t)}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>{filtered.length} documents</div>
      </div>

      {/* DOCUMENT DETAIL PANEL */}
      {selectedDoc && (
        <div style={{ background: '#fafffe', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '28px' }}>{typeIcon(selectedDoc.type)}</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a3c5e' }}>{selectedDoc.title}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  {getClientName(selectedDoc.client_id)} · {typeLabel(selectedDoc.type)} · Added {formatDate(selectedDoc.created_at)}
                </div>
                {selectedDoc.notes && (
                  <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>AI Member: {selectedDoc.notes}</div>
                )}
                {selectedDoc.url && (
                  <a href={selectedDoc.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: '10px', color: '#10b981', marginTop: '4px', display: 'block' }}>
                    {selectedDoc.url}
                  </a>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => deleteDocument(selectedDoc.id)}
                style={{ background: '#fef2f2', border: '0.5px solid #fecaca', color: '#dc2626', borderRadius: '7px', padding: '5px 10px', fontSize: '10px', cursor: 'pointer' }}>
                Delete
              </button>
              <button onClick={() => setSelectedDoc(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px' }}>×</button>
            </div>
          </div>
          {selectedDoc.content && (
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '11px', color: '#475569', lineHeight: '1.7', maxHeight: '200px', overflowY: 'auto' }}>
              {selectedDoc.content}
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTS LIST */}
      {loading ? (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading knowledge base...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧠</div>
          <div style={{ fontWeight: 600, color: '#1a3c5e', marginBottom: '6px' }}>Knowledge base is empty</div>
          <div style={{ fontSize: '11px' }}>Add documents, PDFs, or paste content to train the AI team</div>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-header" style={{ gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 1fr 1fr' }}>
            <div className="th">DOCUMENT</div>
            <div className="th">CLIENT</div>
            <div className="th">TYPE</div>
            <div className="th">AI MEMBER</div>
            <div className="th">STATUS</div>
            <div className="th">ADDED</div>
          </div>
          {filtered.map(doc => (
            <div key={doc.id} className="table-row"
              style={{ gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 1fr 1fr', cursor: 'pointer', background: selectedDoc?.id === doc.id ? '#fafffe' : 'white' }}
              onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '20px' }}>{typeIcon(doc.type)}</div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#1a3c5e' }}>{doc.title}</div>
                  {doc.url && <div style={{ fontSize: '9px', color: '#10b981' }}>{doc.url}</div>}
                  {doc.content && <div style={{ fontSize: '9px', color: '#94a3b8' }}>{doc.content.substring(0, 60)}...</div>}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#475569' }}>{getClientName(doc.client_id)}</div>
              <div style={{ fontSize: '11px', color: '#475569' }}>{typeLabel(doc.type)}</div>
              <div style={{ fontSize: '11px', color: '#10b981' }}>{doc.notes || 'All Team'}</div>
              <div>
                <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: doc.status === 'trained' ? '#ecfdf5' : '#fffbeb', color: doc.status === 'trained' ? '#059669' : '#d97706', border: `0.5px solid ${doc.status === 'trained' ? '#a7f3d0' : '#fde68a'}` }}>
                  {doc.status === 'trained' ? '✓ Trained' : 'Processing'}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>{formatDate(doc.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}