import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';
import { supabase } from '../supabase';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [filterTag, setFilterTag] = useState('');
  const [filterSeqStatus, setFilterSeqStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterDateAdded, setFilterDateAdded] = useState('');
  const [enrollmentMap, setEnrollmentMap] = useState({});
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTag, setBulkTag] = useState('');
  const [bulkWorkflow, setBulkWorkflow] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('Shopify');
  const [channel, setChannel] = useState('Email');
  const [stage, setStage] = useState('New Lead');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState('');
  const [unenrolling, setUnenrolling] = useState(false);

  useEffect(() => {
    fetchContacts();
    fetchClients();
  }, []);

  useEffect(() => {
    if (contacts.length === 0) return;
    supabase.from('workflow_enrollments').select('contact_id, status').then(({ data }) => {
      const map = {};
      (data || []).forEach(e => {
        if (!map[e.contact_id]) map[e.contact_id] = { active: 0, completed: 0 };
        if (e.status === 'active') map[e.contact_id].active++;
        if (e.status === 'completed') map[e.contact_id].completed++;
      });
      setEnrollmentMap(map);
    });
  }, [contacts]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setContacts(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const addContact = async () => {
    if (!firstName || !email) {
      alert('Please fill in First Name and Email');
      return;
    }
    const { error } = await supabase.from('contacts').insert([{
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      source,
      channel,
      pipeline_stage: stage,
      notes,
      client_id: clientId || null,
      last_activity: new Date().toISOString()
    }]);
    if (!error) {
      fetchContacts();
      setShowForm(false);
      setFirstName(''); setLastName(''); setEmail(''); setPhone('');
      setSource('Shopify'); setChannel('Email'); setStage('New Lead');
      setNotes(''); setClientId('');
    } else {
      alert('Error: ' + error.message);
    }
  };

  const csvInputRef = useRef(null);

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const clientId = clients[0]?.id;
    if (!clientId) { alert('No clients found — cannot import.'); return; }
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('client_id', clientId);
    try {
      const res = await fetch(`${API_BASE}/contacts/import`, { method: 'POST', body: formData });
      const data = await res.json();
      setImportResult(data);
      if (data.imported > 0) fetchContacts();
    } catch (err) {
      setImportResult({ error: err.message });
    }
    setImporting(false);
    e.target.value = '';
  };

  const enrollContact = async (contact) => {
    const { data: workflows } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('client_id', contact.client_id)
      .eq('status', 'active');

    if (!workflows || workflows.length === 0) {
      alert('No active workflows found for this client.');
      return;
    }

    const workflowNames = workflows.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
    const choice = prompt(`Select workflow for ${contact.first_name}:\n\n${workflowNames}\n\nEnter number:`);
    if (!choice) return;

    const selectedWorkflow = workflows[parseInt(choice) - 1];
    if (!selectedWorkflow) { alert('Invalid selection'); return; }

    try {
      const response = await fetch(`${API_BASE}/enroll-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: selectedWorkflow.id,
          contactId: contact.id,
          clientId: contact.client_id,
          contactEmail: contact.email,
          contactPhone: contact.phone,
          contactName: contact.first_name
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(`${contact.first_name} enrolled. First message sent.`);
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const unenrollContact = async (contact) => {
    if (!window.confirm(`Remove ${contact.first_name} from all active sequences?`)) return;
    setUnenrolling(true);
    try {
      const res = await fetch(`${API_BASE}/enrollments/unenroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contact.id, client_id: contact.client_id }),
      });
      const data = await res.json();
      if (data.ok) {
        alert(data.cancelled > 0
          ? `Unenrolled ${contact.first_name} from ${data.cancelled} sequence${data.cancelled !== 1 ? 's' : ''}.`
          : `${contact.first_name} had no active sequence enrollments.`
        );
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setUnenrolling(false);
    }
  };

  const loadTimeline = async (contact) => {
    setTimelineLoading(true);
    setTimeline([]);
    try {
      const [msgsRes, activityRes, enrollRes] = await Promise.all([
        supabase.from('messages').select('id, channel, direction, content, status, opened_at, clicked_at, created_at').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('activity').select('type, description, created_at').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('workflow_enrollments').select('workflow_id, status, enrolled_at, completed_at, workflows(name)').eq('contact_id', contact.id).order('enrolled_at', { ascending: false }),
      ]);
      const events = [
        ...(msgsRes.data || []).map(m => ({ ts: m.created_at, kind: 'message', label: `${m.direction === 'outbound' ? '→' : '←'} ${m.channel}`, sub: (m.content || '').slice(0, 80), meta: m.opened_at ? '✉ Opened' : m.clicked_at ? '🔗 Clicked' : '', id: m.id })),
        ...(activityRes.data || []).map(a => ({ ts: a.created_at, kind: 'activity', label: a.type?.replace(/_/g, ' '), sub: a.description, id: a.created_at + a.type })),
        ...(enrollRes.data || []).map(e => ({ ts: e.enrolled_at, kind: 'enrollment', label: `Enrolled: ${e.workflows?.name || e.workflow_id}`, sub: `Status: ${e.status}${e.completed_at ? ` · Completed ${new Date(e.completed_at).toLocaleDateString()}` : ''}`, id: e.workflow_id + e.enrolled_at })),
      ].sort((a, b) => new Date(b.ts) - new Date(a.ts));
      setTimeline(events);
    } catch (e) { console.error('Timeline error:', e.message); }
    setTimelineLoading(false);
  };

  const toggleSelect = (id) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSelectAll = () => setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));

  const bulkEnroll = async () => {
    if (!bulkWorkflow || selectedIds.size === 0) return;
    setBulkWorking(true);
    for (const id of selectedIds) {
      const c = contacts.find(c => c.id === id);
      if (!c) continue;
      await fetch(`${API_BASE}/contacts/enroll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: id, workflow_id: bulkWorkflow, client_id: c.client_id }) }).catch(() => {});
    }
    setBulkWorking(false);
    setSelectedIds(new Set());
    setBulkWorkflow('');
    alert(`Enrolled ${selectedIds.size} contacts`);
  };

  const bulkAddTag = async () => {
    if (!bulkTag.trim() || selectedIds.size === 0) return;
    setBulkWorking(true);
    for (const id of selectedIds) {
      const c = contacts.find(c => c.id === id);
      const existing = Array.isArray(c?.tags) ? c.tags : [];
      if (!existing.includes(bulkTag)) await supabase.from('contacts').update({ tags: [...existing, bulkTag] }).eq('id', id);
    }
    setBulkWorking(false);
    setSelectedIds(new Set());
    setBulkTag('');
    fetchContacts();
  };

  const bulkExport = () => {
    const selected = contacts.filter(c => selectedIds.has(c.id));
    const headers = ['first_name', 'last_name', 'email', 'phone', 'pipeline_stage', 'source'];
    const rows = selected.map(c => headers.map(h => { const v = c[h]; return v && String(v).includes(',') ? `"${v}"` : (v || ''); }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'selected-contacts.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected contact(s)? This cannot be undone.`)) return;
    setBulkWorking(true);
    await supabase.from('contacts').delete().in('id', [...selectedIds]);
    setBulkWorking(false);
    setSelectedIds(new Set());
    fetchContacts();
  };

  const filtered = contacts.filter(c => {
    const searchMatch = !search || `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase());
    const tagMatch = !filterTag || (Array.isArray(c.tags) && c.tags.includes(filterTag));
    const channelMatch = !filterChannel || c.channel === filterChannel;
    const dateMatch = !filterDateAdded || new Date(c.created_at) >= new Date(filterDateAdded);
    const enroll = enrollmentMap[c.id];
    const seqMatch = !filterSeqStatus ||
      (filterSeqStatus === 'enrolled' && enroll?.active > 0) ||
      (filterSeqStatus === 'completed' && enroll?.completed > 0) ||
      (filterSeqStatus === 'never_enrolled' && !enroll);
    return searchMatch && tagMatch && channelMatch && dateMatch && seqMatch;
  });

  const stageColor = (stage) => {
    const map = {
      'Converted': { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
      'Hot Lead': { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
      'Lost': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
      'Proposal Sent': { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
      'Nurturing': { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
    };
    return map[stage] || { bg: '#f8fafc', color: '#64748b', border: '#e4e9f0' };
  };

  const getClientName = (cId) => {
    const client = clients.find(c => c.id === cId);
    return client ? client.name : '—';
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Contact Database</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{contacts.length} contacts across all stores</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCSVImport} style={{ display: 'none' }} />
          <button onClick={() => csvInputRef.current?.click()} disabled={importing}
            style={{ background: 'white', color: '#0a1628', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {importing ? 'Importing…' : '↑ Import CSV'}
          </button>
          <button onClick={() => { const url = `${API_BASE}/contacts/export${clients[0] ? `?client_id=${clients[0].id}` : ''}`; window.open(url, '_blank'); }}
            style={{ background: 'white', color: '#0a1628', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            ↓ Export CSV
          </button>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Add Contact
          </button>
        </div>
        {importResult && (
          <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', background: importResult.error ? '#fef2f2' : '#ecfdf5', color: importResult.error ? '#dc2626' : '#059669', border: `1px solid ${importResult.error ? '#fecaca' : '#a7f3d0'}` }}>
            {importResult.error ? `Import failed: ${importResult.error}` : `✓ Imported ${importResult.imported} of ${importResult.total} contacts${importResult.errors?.length ? ` · ${importResult.errors.length} skipped` : ''}`}
          </div>
        )}
      </div>

      {/* ADD CONTACT FORM */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>New Contact</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>First Name</div>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Name</div>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@store.com" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</div>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+965 XXXX XXXX" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client Store</div>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                <option value="">Select store</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</div>
              <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                <option>Shopify</option>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>WhatsApp</option>
                <option>SMS</option>
                <option>Form</option>
                <option>Referral</option>
                <option>Manual</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pipeline Stage</div>
              <select value={stage} onChange={e => setStage(e.target.value)} style={inputStyle}>
                <option>New Lead</option>
                <option>Contacted</option>
                <option>Nurturing</option>
                <option>Hot Lead</option>
                <option>Proposal Sent</option>
                <option>Converted</option>
                <option>Lost</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Channel</div>
              <select value={channel} onChange={e => setChannel(e.target.value)} style={inputStyle}>
                <option>Email</option>
                <option>SMS</option>
                <option>WhatsApp</option>
                <option>Instagram</option>
                <option>Facebook</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about this contact..." rows={2}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addContact}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Save Contact
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SEARCH + FILTERS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          style={{ ...inputStyle, width: '240px' }} />
        <input type="text" value={filterTag} onChange={e => setFilterTag(e.target.value)} placeholder="Filter by tag…"
          style={{ ...inputStyle, width: '140px' }} />
        <select value={filterSeqStatus} onChange={e => setFilterSeqStatus(e.target.value)} style={{ ...inputStyle, width: '160px', cursor: 'pointer' }}>
          <option value="">All statuses</option>
          <option value="enrolled">Currently enrolled</option>
          <option value="completed">Completed sequence</option>
          <option value="never_enrolled">Never enrolled</option>
        </select>
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={{ ...inputStyle, width: '130px', cursor: 'pointer' }}>
          <option value="">All channels</option>
          <option value="Email">Email</option>
          <option value="SMS">SMS</option>
          <option value="WhatsApp">WhatsApp</option>
        </select>
        <input type="date" value={filterDateAdded} onChange={e => setFilterDateAdded(e.target.value)}
          title="Added on or after" style={{ ...inputStyle, width: '150px' }} />
        {(filterTag || filterSeqStatus || filterChannel || filterDateAdded) && (
          <button onClick={() => { setFilterTag(''); setFilterSeqStatus(''); setFilterChannel(''); setFilterDateAdded(''); }}
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '9px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#8896a8' }}>{filtered.length} contacts</div>
      </div>

      {/* BULK ACTION TOOLBAR */}
      {selectedIds.size > 0 && (
        <div style={{ background: '#0a1628', borderRadius: '10px', padding: '10px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#c9a84c', flexShrink: 0 }}>{selectedIds.size} selected</span>
          <select value={bulkWorkflow} onChange={e => setBulkWorkflow(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', outline: 'none' }}>
            <option value="">Pick sequence…</option>
            {clients.flatMap(c => []).concat([])}
          </select>
          <button onClick={bulkEnroll} disabled={!bulkWorkflow || bulkWorking}
            style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            Enroll All
          </button>
          <input value={bulkTag} onChange={e => setBulkTag(e.target.value)} placeholder="Tag name…"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', outline: 'none', width: '100px' }} />
          <button onClick={bulkAddTag} disabled={!bulkTag.trim() || bulkWorking}
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            Add Tag
          </button>
          <button onClick={bulkExport}
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            Export Selected
          </button>
          <button onClick={bulkDelete} disabled={bulkWorking}
            style={{ background: 'rgba(220,38,38,0.25)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px' }}>×</button>
        </div>
      )}

      {/* CONTACT DETAIL */}
      {selectedContact && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>
                {selectedContact.first_name?.[0]}{selectedContact.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a1628', marginBottom: '2px' }}>{selectedContact.first_name} {selectedContact.last_name}</div>
                <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '10px' }}>{selectedContact.email} · {selectedContact.phone || 'No phone'}</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(() => { const s = stageColor(selectedContact.pipeline_stage); return (
                    <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600 }}>{selectedContact.pipeline_stage}</span>
                  );})()}
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#f8fafc', color: '#64748b', border: '1px solid #e4e9f0', fontWeight: 500 }}>
                    {selectedContact.source}
                  </span>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#f8fafc', color: '#64748b', border: '1px solid #e4e9f0', fontWeight: 500 }}>
                    {getClientName(selectedContact.client_id)}
                  </span>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: '#f8fafc', color: '#64748b', border: '1px solid #e4e9f0', fontWeight: 500 }}>
                    Added {formatDate(selectedContact.created_at)}
                  </span>
                </div>
                {selectedContact.notes && (
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '10px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e4e9f0', lineHeight: '1.6' }}>
                    {selectedContact.notes}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => enrollContact(selectedContact)}
                style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '7px', fontSize: '11px', padding: '7px 14px', cursor: 'pointer', fontWeight: 600 }}>
                Enroll in Workflow
              </button>
              <button
                onClick={() => unenrollContact(selectedContact)}
                disabled={unenrolling}
                style={{ background: unenrolling ? '#f3f4f6' : '#fef2f2', color: unenrolling ? '#9ca3af' : '#dc2626', border: '1px solid #fecaca', borderRadius: '7px', fontSize: '11px', padding: '7px 14px', cursor: unenrolling ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {unenrolling ? 'Unenrolling...' : 'Unenroll'}
              </button>
              <button onClick={() => setSelectedContact(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Fix 7: Activity timeline */}
          <div style={{ borderTop: '1px solid #f0f3f8', paddingTop: '16px', marginTop: '14px' }}>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>Activity Timeline</div>
            {timelineLoading ? (
              <div style={{ fontSize: '11px', color: '#8896a8', padding: '8px 0' }}>Loading…</div>
            ) : timeline.length === 0 ? (
              <div style={{ fontSize: '11px', color: '#8896a8' }}>No activity recorded yet</div>
            ) : (
              <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0' }}>
                {timeline.map((ev, i) => (
                  <div key={ev.id || i} style={{ display: 'flex', gap: '10px', paddingBottom: '10px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ev.kind === 'message' ? '#3b82f6' : ev.kind === 'enrollment' ? '#c9a84c' : '#10b981', marginTop: '4px', flexShrink: 0 }} />
                      {i < timeline.length - 1 && <div style={{ width: '1px', flex: 1, minHeight: '14px', background: '#e4e9f0', margin: '2px 0' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628', textTransform: 'capitalize' }}>{ev.label}</span>
                        <span style={{ fontSize: '9px', color: '#8896a8', flexShrink: 0 }}>{new Date(ev.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      {ev.sub && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.sub}</div>}
                      {ev.meta && <div style={{ fontSize: '10px', color: '#10b981', marginTop: '1px', fontWeight: 500 }}>{ev.meta}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTACTS TABLE */}
      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👤</div>
          <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '6px', fontSize: '14px' }}>No contacts yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Add contacts manually or connect a Shopify store to import automatically</div>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 2.5fr 1.2fr 1fr 1fr 1fr', padding: '12px 18px', background: '#0a1628' }}>
            <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
              style={{ accentColor: '#c9a84c', cursor: 'pointer', width: '14px', height: '14px', margin: 'auto 0' }} />
            {['CONTACT', 'STORE', 'SOURCE', 'STAGE', 'ADDED'].map(h => (
              <div key={h} style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', fontWeight: 700 }}>{h}</div>
            ))}
          </div>
          {filtered.map(contact => {
            const s = stageColor(contact.pipeline_stage);
            return (
              <div key={contact.id}
                style={{ display: 'grid', gridTemplateColumns: '32px 2.5fr 1.2fr 1fr 1fr 1fr', padding: '13px 18px', borderBottom: '1px solid #f4f6fa', cursor: 'pointer', background: selectedContact?.id === contact.id || selectedIds.has(contact.id) ? '#fafbfd' : 'white', transition: 'background 0.1s', alignItems: 'center' }}
                onClick={() => { const c = selectedContact?.id === contact.id ? null : contact; setSelectedContact(c); if (c) loadTimeline(c); }}>
                <div onClick={e => { e.stopPropagation(); toggleSelect(contact.id); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelect(contact.id)}
                    style={{ accentColor: '#c9a84c', cursor: 'pointer', width: '14px', height: '14px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>
                    {contact.first_name?.[0]}{contact.last_name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{contact.first_name} {contact.last_name}</div>
                    <div style={{ fontSize: '10px', color: '#8896a8' }}>{contact.email}</div>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#4a5568', display: 'flex', alignItems: 'center' }}>{getClientName(contact.client_id)}</div>
                <div style={{ fontSize: '11px', color: '#4a5568', display: 'flex', alignItems: 'center' }}>{contact.source}</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600 }}>
                    {contact.pipeline_stage}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#8896a8', display: 'flex', alignItems: 'center' }}>{formatDate(contact.created_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}