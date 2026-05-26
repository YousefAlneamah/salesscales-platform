import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function HubSpot() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [clientData, setClientData] = useState(null);
  const [contactCount, setContactCount] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [syncHistory, setSyncHistory] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name, hubspot_api_key, hubspot_portal_id')
      .order('name')
      .then(({ data }) => { if (data) setClients(data); });
  }, []);

  useEffect(() => {
    if (!selectedClient) {
      setClientData(null);
      setContactCount(null);
      setSyncResult(null);
      setSyncError('');
      setContacts([]);
      return;
    }
    const found = clients.find(c => c.id === selectedClient);
    setClientData(found || null);
    setSyncResult(null);
    setSyncError('');

    // Load contact count with email
    axios.get(`${API_BASE}/hubspot/contact-count?client_id=${selectedClient}`)
      .then(({ data }) => setContactCount(data.count))
      .catch(() => setContactCount(null));

    // Load contacts preview
    setLoadingContacts(true);
    supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, pipeline_stage, source')
      .eq('client_id', selectedClient)
      .not('email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { setContacts(data || []); setLoadingContacts(false); });
  }, [selectedClient, clients]);

  const configuredClients = clients.filter(c => c.hubspot_api_key);

  const sync = async () => {
    if (!selectedClient) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError('');
    try {
      const { data } = await axios.post(`${API_BASE}/hubspot/sync-contacts`, { client_id: selectedClient });
      const entry = { ...data, client: clientData?.name, ts: new Date().toISOString() };
      setSyncResult(entry);
      setSyncHistory(prev => [entry, ...prev.slice(0, 9)]);
    } catch (e) {
      setSyncError(e.response?.data?.error || e.message);
    } finally {
      setSyncing(false);
    }
  };

  const isConfigured = clientData?.hubspot_api_key;

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-label">HubSpot MCP</div>
        <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>CRM Contact Sync</div>
        <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '3px' }}>
          Sync Sales Scales contacts to HubSpot CRM. Upserts by email — creates new, updates existing.
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row" style={{ marginBottom: '20px' }}>
        <div className="stat-card gold-top">
          <div className="stat-label">Clients with HubSpot</div>
          <div className="stat-value">{configuredClients.length}</div>
          <div className="stat-sub-gold">of {clients.length} total</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">Contacts to Sync</div>
          <div className="stat-value">{contactCount !== null ? contactCount : '—'}</div>
          <div className="stat-sub-blue">{selectedClient ? 'with email address' : 'select a client'}</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Last Sync — Synced</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{syncResult ? syncResult.synced : '—'}</div>
          <div className="stat-sub-green">{syncResult ? 'contacts pushed to HubSpot' : 'run a sync to see results'}</div>
        </div>
        <div className="stat-card" style={{ borderTop: `3px solid ${syncResult?.failed > 0 ? '#dc2626' : '#e4e9f0'}` }}>
          <div className="stat-label">Last Sync — Failed</div>
          <div className="stat-value" style={{ color: syncResult?.failed > 0 ? '#dc2626' : '#0a1628' }}>{syncResult ? syncResult.failed : '—'}</div>
          <div className="stat-sub" style={{ color: syncResult?.failed > 0 ? '#dc2626' : '#8896a8' }}>{syncResult?.failed > 0 ? 'check API key' : 'no failures'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* LEFT — CONTROLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* CLIENT SELECTOR */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Select Client</div>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box' }}
            >
              <option value="">— Choose a client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.hubspot_api_key ? ' ✓' : ''}</option>
              ))}
            </select>
            <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '6px' }}>✓ = HubSpot configured</div>
          </div>

          {/* CONNECTION STATUS */}
          {selectedClient && (
            <div className="card">
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Connection Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isConfigured ? '10px' : '0' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConfigured ? '#10b981' : '#dc2626', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>
                  {isConfigured ? 'HubSpot Connected' : 'Not Configured'}
                </span>
              </div>
              {isConfigured ? (
                <>
                  <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '8px', lineHeight: '1.5' }}>
                    Private app token configured. Contacts sync via HubSpot v3 Contacts API with email deduplication.
                  </div>
                  {clientData?.hubspot_portal_id && (
                    <a
                      href={`https://app.hubspot.com/contacts/${clientData.hubspot_portal_id}/contacts`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                      style={{ fontSize: '10px', padding: '5px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <i className="ti ti-external-link" style={{ fontSize: '11px' }} />
                      Open HubSpot CRM
                    </a>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '10px', color: '#dc2626', lineHeight: '1.5' }}>
                  Add a HubSpot Private App token in <strong>Settings → Email Domains</strong> for this client.
                </div>
              )}
            </div>
          )}

          {/* SYNC BUTTON */}
          <button
            onClick={sync}
            disabled={!selectedClient || !isConfigured || syncing}
            className="btn btn-gold"
            style={{ width: '100%', padding: '12px', fontSize: '13px', opacity: !selectedClient || !isConfigured || syncing ? 0.6 : 1 }}
          >
            {syncing ? (
              <><i className="ti ti-loader" style={{ marginRight: '8px' }} />Syncing to HubSpot...</>
            ) : (
              <><i className="ti ti-refresh" style={{ marginRight: '8px' }} />Sync Contacts to HubSpot</>
            )}
          </button>

          {syncError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', fontSize: '11px', color: '#dc2626' }}>
              <i className="ti ti-alert-circle" style={{ marginRight: '6px' }} />{syncError}
            </div>
          )}

          {/* SYNC HISTORY */}
          {syncHistory.length > 0 && (
            <div className="card">
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Sync History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {syncHistory.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #f0f3f8' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628' }}>{h.client}</div>
                      <div style={{ fontSize: '9px', color: '#8896a8', marginTop: '2px' }}>{fmtDate(h.ts)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>{h.synced} synced</span>
                      {h.failed > 0 && <span style={{ fontSize: '11px', color: '#dc2626', marginLeft: '6px' }}>{h.failed} failed</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — RESULTS & PREVIEW */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* SYNC RESULT */}
          {syncResult && (
            <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '18px 22px', border: '1px solid rgba(201,168,76,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <i className="ti ti-circle-check" style={{ fontSize: '22px', color: '#10b981' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Sync Complete — {syncResult.client}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{fmtDate(syncResult.ts)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { label: 'Total Contacts', val: syncResult.total, color: 'rgba(255,255,255,0.7)' },
                  { label: 'Synced to HubSpot', val: syncResult.synced, color: '#10b981' },
                  { label: 'Failed', val: syncResult.failed, color: syncResult.failed > 0 ? '#dc2626' : 'rgba(255,255,255,0.3)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {syncResult.message && (
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  <i className="ti ti-info-circle" style={{ marginRight: '5px' }} />{syncResult.message}
                </div>
              )}
            </div>
          )}

          {/* CONTACTS PREVIEW */}
          {!selectedClient && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <i className="ti ti-brand-hubspot" style={{ fontSize: '40px', color: '#e4e9f0', display: 'block', marginBottom: '14px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>Select a client to begin</div>
              <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: '1.7' }}>
                Choose a client from the left to see their contacts<br />and sync them to HubSpot CRM.
              </div>
            </div>
          )}

          {selectedClient && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f3f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0a1628', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Contacts Preview
                </div>
                <span style={{ fontSize: '10px', color: '#8896a8' }}>
                  {contactCount !== null ? `${contactCount} with email` : '—'} · showing 10
                </span>
              </div>

              <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '0 20px' }}>
                <div className="th">Name</div>
                <div className="th">Email</div>
                <div className="th">Stage</div>
                <div className="th">Source</div>
              </div>

              {loadingContacts ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
                  <i className="ti ti-loader" style={{ marginRight: '7px' }} />Loading contacts...
                </div>
              ) : contacts.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
                  No contacts with email addresses for this client.
                </div>
              ) : (
                contacts.map((c, i) => (
                  <div key={c.id} className="table-row" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '0 20px', borderBottom: i < contacts.length - 1 ? '1px solid #f0f3f8' : 'none' }}>
                    <div className="td">
                      <span style={{ fontWeight: 600, fontSize: '12px', color: '#0a1628' }}>
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                      </span>
                    </div>
                    <div className="td">
                      <span style={{ fontSize: '11px', color: '#4a5568', fontFamily: 'DM Mono, monospace' }}>{c.email}</span>
                    </div>
                    <div className="td">
                      {c.pipeline_stage ? (
                        <span className="badge-blue" style={{ fontSize: '9px', textTransform: 'capitalize' }}>{c.pipeline_stage}</span>
                      ) : <span style={{ fontSize: '11px', color: '#c4c9d4' }}>—</span>}
                    </div>
                    <div className="td">
                      <span style={{ fontSize: '10px', color: '#8896a8', textTransform: 'capitalize' }}>{c.source || '—'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* INFO */}
          <div className="card" style={{ background: '#f8fafc' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#0a1628', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>How it works</div>
            {[
              { icon: 'ti-key', text: 'Create a HubSpot Private App in your portal and copy the access token.' },
              { icon: 'ti-settings', text: 'Paste the token (and portal ID) in Settings → Email Domains for the client.' },
              { icon: 'ti-refresh', text: 'Click Sync — contacts are upserted to HubSpot by email. New contacts are created, existing ones are updated.' },
              { icon: 'ti-brand-hubspot', text: 'Open HubSpot CRM to see all contacts with their pipeline stage and source mapped.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: i < 3 ? '10px' : '0' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'rgba(255,122,89,0.1)', border: '1px solid rgba(255,122,89,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: '12px', color: '#ff7a59' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#4a5568', lineHeight: '1.6', paddingTop: '4px' }}>{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
