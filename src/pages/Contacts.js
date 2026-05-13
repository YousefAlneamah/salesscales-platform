import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('Manual');
  const [channel, setChannel] = useState('Email');
  const [stage, setStage] = useState('New Lead');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    fetchContacts();
    fetchClients();
  }, []);

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
      setSource('Manual'); setChannel('Email'); setStage('New Lead');
      setNotes(''); setClientId('');
    } else {
      alert('Error saving contact: ' + error.message);
    }
  };

  const enrollContact = async (contact) => {
    const { data: workflows } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('client_id', contact.client_id)
      .eq('status', 'active');

    if (!workflows || workflows.length === 0) {
      alert('No active workflows found for this client. Create and activate a workflow first.');
      return;
    }

    const workflowNames = workflows.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
    const choice = prompt(`Select a workflow to enroll ${contact.first_name} in:\n\n${workflowNames}\n\nEnter number:`);

    if (!choice) return;

    const selectedWorkflow = workflows[parseInt(choice) - 1];
    if (!selectedWorkflow) {
      alert('Invalid selection');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/enroll-contact', {
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
        alert(`${contact.first_name} enrolled in ${selectedWorkflow.name}. First message sent.`);
      } else {
        alert('Enrollment failed: ' + data.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const full = `${c.first_name} ${c.last_name} ${c.email} ${c.phone}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  const stageColor = (stage) => {
    if (stage === 'Converted') return { background: '#ecfdf5', color: '#059669', border: '0.5px solid #a7f3d0' };
    if (stage === 'Hot Lead') return { background: '#fffbeb', color: '#d97706', border: '0.5px solid #fde68a' };
    if (stage === 'Lost') return { background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca' };
    if (stage === 'Proposal Sent') return { background: '#eff6ff', color: '#3b82f6', border: '0.5px solid #bfdbfe' };
    return { background: '#f8f9fc', color: '#64748b', border: '0.5px solid #e2e8f0' };
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : '—';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const inputStyle = {
    width: '100%',
    border: '0.5px solid #e2e8f0',
    borderRadius: '7px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#1a3c5e',
    outline: 'none',
    background: 'white',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    fontSize: '10px',
    color: '#94a3b8',
    marginBottom: '5px',
    fontWeight: 500,
    display: 'block'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>ALL CONTACTS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{contacts.length} total contacts</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" style={{ fontSize: '11px' }}>Import CSV</button>
          <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>+ Add Contact</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '14px' }}>ADD NEW CONTACT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>FIRST NAME</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>LAST NAME</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>PHONE</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+965 XXXX XXXX" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CLIENT</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>SOURCE</label>
              <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                <option>Manual</option>
                <option>Shopify</option>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>WhatsApp</option>
                <option>SMS</option>
                <option>Form</option>
                <option>LinkedIn</option>
                <option>Referral</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>PIPELINE STAGE</label>
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
              <label style={labelStyle}>CHANNEL</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} style={inputStyle}>
                <option>Email</option>
                <option>SMS</option>
                <option>WhatsApp</option>
                <option>Instagram</option>
                <option>Facebook</option>
                <option>Voice</option>
                <option>LinkedIn</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>NOTES</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about this contact..." rows={2}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-green" onClick={addContact}>Save Contact</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts..."
          style={{ ...inputStyle, width: '220px' }}
        />
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>{filtered.length} contacts</div>
      </div>

      {selectedContact && (
        <div style={{ background: '#fafffe', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ecfdf5', border: '0.5px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#10b981', fontWeight: 600, flexShrink: 0 }}>
                {selectedContact.first_name?.[0]}{selectedContact.last_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a3c5e' }}>{selectedContact.first_name} {selectedContact.last_name}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{selectedContact.email} · {selectedContact.phone || 'No phone'}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', ...stageColor(selectedContact.pipeline_stage) }}>{selectedContact.pipeline_stage}</span>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: '#f8f9fc', color: '#64748b', border: '0.5px solid #e2e8f0' }}>Source: {selectedContact.source}</span>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: '#f8f9fc', color: '#64748b', border: '0.5px solid #e2e8f0' }}>Client: {getClientName(selectedContact.client_id)}</span>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', background: '#f8f9fc', color: '#64748b', border: '0.5px solid #e2e8f0' }}>Added: {formatDate(selectedContact.created_at)}</span>
                </div>
                {selectedContact.notes && (
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '10px', background: '#f8f9fc', padding: '8px 10px', borderRadius: '6px', border: '0.5px solid #e2e8f0' }}>{selectedContact.notes}</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-green" style={{ fontSize: '10px', padding: '5px 10px' }}>Send Message</button>
              <button className="btn btn-outline" style={{ fontSize: '10px', padding: '5px 10px' }}>Add Task</button>
              <button
                onClick={() => enrollContact(selectedContact)}
                style={{ background: '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', fontSize: '10px', padding: '5px 10px', cursor: 'pointer' }}>
                Enroll in Workflow
              </button>
              <button onClick={() => setSelectedContact(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px', padding: '0 4px' }}>×</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👤</div>
          <div style={{ fontWeight: 600, color: '#1a3c5e', marginBottom: '6px' }}>No contacts yet</div>
          <div style={{ fontSize: '11px' }}>Add contacts manually or connect Shopify to import automatically</div>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-header" style={{ gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 1fr 1fr' }}>
            <div className="th">CONTACT</div>
            <div className="th">CLIENT</div>
            <div className="th">SOURCE</div>
            <div className="th">STAGE</div>
            <div className="th">CHANNEL</div>
            <div className="th">ADDED</div>
          </div>
          {filtered.map(contact => (
            <div
              key={contact.id}
              className="table-row"
              style={{ gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 1fr 1fr', cursor: 'pointer', background: selectedContact?.id === contact.id ? '#fafffe' : 'white' }}
              onClick={() => setSelectedContact(selectedContact?.id === contact.id ? null : contact)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#ecfdf5', border: '0.5px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#10b981', fontWeight: 600, flexShrink: 0 }}>
                  {contact.first_name?.[0]}{contact.last_name?.[0]}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#1a3c5e' }}>{contact.first_name} {contact.last_name}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>{contact.email}</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#475569' }}>{getClientName(contact.client_id)}</div>
              <div style={{ fontSize: '11px', color: '#475569' }}>{contact.source}</div>
              <div>
                <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', ...stageColor(contact.pipeline_stage) }}>
                  {contact.pipeline_stage}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#475569' }}>{contact.channel}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>{formatDate(contact.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}