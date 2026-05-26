import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function AutoReports() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  const loadReports = async (clientId) => {
    setLoadingReports(true);
    try {
      const url = clientId
        ? `${API_BASE}/reports/list?client_id=${clientId}`
        : `${API_BASE}/reports/list`;
      const { data } = await axios.get(url);
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => { loadReports(selectedClient); }, [selectedClient]);

  const generate = async () => {
    if (!selectedClient) return;
    setGenerating(true);
    setGenError('');
    try {
      const { data } = await axios.post(`${API_BASE}/reports/generate`, { client_id: selectedClient });
      setReports(prev => [{ ...data.report, clients: { name: clients.find(c => c.id === selectedClient)?.name || '' } }, ...prev]);
      setExpandedId(data.report.id);
    } catch (e) {
      setGenError(e.response?.data?.error || e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyReport = (report) => {
    const text = `${report.period} — ${report.clients?.name || ''}\n\n${report.summary}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(report.id);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(report.id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const now = new Date();
  const thisMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const thisMonthCount = reports.filter(r => r.period === thisMonthLabel).length;
  const clientsWithReports = new Set(reports.map(r => r.client_id)).size;

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div className="section-label">Zainab AI</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Automated Monthly Reports</div>
          <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '3px' }}>
            Zainab generates comprehensive monthly performance reports with written summaries and recommendations.
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row" style={{ marginBottom: '20px' }}>
        <div className="stat-card gold-top">
          <div className="stat-label">Total Reports Generated</div>
          <div className="stat-value">{reports.length}</div>
          <div className="stat-sub-gold">all time</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">This Month</div>
          <div className="stat-value">{thisMonthCount}</div>
          <div className="stat-sub-blue">{thisMonthLabel}</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Clients Covered</div>
          <div className="stat-value">{clientsWithReports}</div>
          <div className="stat-sub-green">have at least one report</div>
        </div>
        <div className="stat-card navy-top">
          <div className="stat-label">Latest Report</div>
          <div className="stat-value" style={{ fontSize: '16px' }}>{reports[0]?.period || '—'}</div>
          <div className="stat-sub">{reports[0]?.clients?.name || 'No reports yet'}</div>
        </div>
      </div>

      {/* GENERATE PANEL */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>Generate New Report</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Client</div>
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white' }}
            >
              <option value="">— Choose a client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={!selectedClient || generating}
            className="btn btn-gold"
            style={{ padding: '9px 20px', fontSize: '12px', opacity: !selectedClient || generating ? 0.6 : 1, flexShrink: 0 }}
          >
            {generating ? (
              <><i className="ti ti-loader" style={{ marginRight: '7px' }} />Zainab is writing...</>
            ) : (
              <><i className="ti ti-file-report" style={{ marginRight: '7px' }} />Generate Report for {thisMonthLabel}</>
            )}
          </button>
        </div>
        {genError && (
          <div style={{ marginTop: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#dc2626' }}>
            <i className="ti ti-alert-circle" style={{ marginRight: '6px' }} />{genError}
          </div>
        )}
        {selectedClient && !generating && (
          <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', fontSize: '10px', color: '#92400e', lineHeight: '1.6' }}>
            <i className="ti ti-sparkles" style={{ marginRight: '5px', color: '#c9a84c' }} />
            Zainab will pull all channel stats for {thisMonthLabel}, identify the top performing sequence, and write a personalised 5-section summary with recommendations.
          </div>
        )}
      </div>

      {/* CLIENT FILTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>
          {selectedClient ? `Reports for ${clients.find(c => c.id === selectedClient)?.name || ''}` : 'All Reports'}
          <span style={{ fontSize: '10px', fontWeight: 400, color: '#8896a8', marginLeft: '8px' }}>({reports.length})</span>
        </div>
        {selectedClient && (
          <button onClick={() => setSelectedClient('')} className="btn btn-outline" style={{ fontSize: '10px', padding: '4px 10px' }}>
            Show All
          </button>
        )}
      </div>

      {/* REPORTS LIST */}
      {loadingReports ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
          <i className="ti ti-loader" style={{ marginRight: '8px' }} />Loading reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <i className="ti ti-file-report" style={{ fontSize: '40px', color: '#e4e9f0', display: 'block', marginBottom: '14px' }} />
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No reports yet</div>
          <div style={{ fontSize: '11px', color: '#8896a8' }}>Select a client above and generate your first monthly report.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reports.map(r => (
            <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* REPORT HEADER ROW */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', cursor: 'pointer', background: expandedId === r.id ? '#f8fafc' : 'white' }}
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="ti ti-file-report" style={{ fontSize: '16px', color: '#c9a84c' }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>
                    {r.period} — {r.clients?.name || ''}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '2px' }}>
                    Generated {fmtDate(r.created_at)}
                  </div>
                </div>

                {/* MINI STATS */}
                <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                  {[
                    { icon: 'ti-mail', val: r.emails_sent, label: 'emails' },
                    { icon: 'ti-message', val: r.sms_sent, label: 'SMS' },
                    { icon: 'ti-brand-whatsapp', val: r.whatsapp_sent, label: 'WA' },
                    { icon: 'ti-user-plus', val: r.contacts_added, label: 'contacts' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{s.val}</div>
                      <div style={{ fontSize: '9px', color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={e => { e.stopPropagation(); copyReport(r); }}
                    className="btn btn-outline"
                    style={{ fontSize: '10px', padding: '4px 10px' }}
                  >
                    <i className={`ti ${copied === r.id ? 'ti-check' : 'ti-copy'}`} style={{ marginRight: '4px' }} />
                    {copied === r.id ? 'Copied' : 'Copy'}
                  </button>
                  <i className={`ti ${expandedId === r.id ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: '14px', color: '#8896a8' }} />
                </div>
              </div>

              {/* EXPANDED CONTENT */}
              {expandedId === r.id && (
                <div style={{ borderTop: '1px solid #f0f3f8' }}>
                  {/* STATS BAR */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: '#f0f3f8', borderBottom: '1px solid #f0f3f8' }}>
                    {[
                      { label: 'Emails Sent', val: r.emails_sent, color: '#3b82f6' },
                      { label: 'SMS Sent', val: r.sms_sent, color: '#10b981' },
                      { label: 'WhatsApp', val: r.whatsapp_sent, color: '#25d366' },
                      { label: 'Contacts Added', val: r.contacts_added, color: '#c9a84c' },
                      { label: 'Enrollments', val: r.workflow_enrollments, color: '#8b5cf6' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'white', padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '9px', color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '3px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {r.top_sequence && r.top_sequence !== 'None' && (
                    <div style={{ padding: '10px 20px', background: 'rgba(201,168,76,0.04)', borderBottom: '1px solid #f0f3f8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ti ti-trophy" style={{ fontSize: '13px', color: '#c9a84c' }} />
                      <span style={{ fontSize: '11px', color: '#0a1628' }}>Top sequence: <strong>{r.top_sequence}</strong></span>
                    </div>
                  )}

                  {/* ZAINAB SUMMARY */}
                  <div style={{ padding: '20px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ti ti-robot" style={{ fontSize: '13px', color: '#c9a84c' }} />
                      Written by Zainab
                    </div>
                    <div style={{ fontSize: '12px', color: '#0a1628', lineHeight: '1.9', whiteSpace: 'pre-wrap' }}>
                      {r.summary}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
