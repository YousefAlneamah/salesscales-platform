import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

const TIERS = ['starter', 'growth', 'scale', 'enterprise'];

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n) => `$${parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}/mo`;

const STATUS_BADGE = {
  draft:     <span className="badge-yellow">Draft</span>,
  sent:      <span className="badge-blue">Sent</span>,
  signed:    <span className="badge-green">Signed</span>,
  cancelled: <span className="badge-red">Cancelled</span>,
};

const downloadPDF = (contract) => {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Service Agreement — ${contract.client_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 48px auto; padding: 0 32px; color: #111; line-height: 1.75; font-size: 13px; }
  h1 { text-align: center; font-size: 22px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .meta { text-align: center; font-size: 11px; color: #555; margin-bottom: 48px; border-bottom: 1px solid #ccc; padding-bottom: 20px; }
  pre { white-space: pre-wrap; font-family: Georgia, serif; font-size: 13px; line-height: 1.75; }
  @media print {
    body { margin: 24px; }
    @page { margin: 20mm; }
  }
</style>
</head>
<body>
<h1>Service Agreement</h1>
<div class="meta">
  ${contract.client_name} &nbsp;·&nbsp; ${contract.tier.charAt(0).toUpperCase() + contract.tier.slice(1)} Plan &nbsp;·&nbsp; ${fmtMoney(contract.monthly_fee)} &nbsp;·&nbsp; From ${fmtDate(contract.start_date)}
</div>
<pre>${contract.contract_text}</pre>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 300);
    };
  }
};

export default function Contracts() {
  const [clients, setClients] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState({ client_id: '', tier: 'starter', monthly_fee: '', start_date: new Date().toISOString().split('T')[0] });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [signModal, setSignModal] = useState(false);
  const [signeeName, setSigneeName] = useState('');
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('id, name, tier').order('name').then(({ data }) => {
      if (data) {
        setClients(data);
        if (data[0]) setForm(f => ({ ...f, client_id: data[0].id, tier: data[0].tier || 'starter' }));
      }
    });
    loadContracts();
  }, []);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/contracts/list`);
      setContracts(data.contracts || []);
    } catch { setContracts([]); }
    finally { setLoading(false); }
  };

  const generate = async () => {
    if (!form.client_id || !form.monthly_fee || !form.start_date) return;
    setGenerating(true);
    setGenError('');
    try {
      const { data } = await axios.post(`${API_BASE}/contracts/create`, {
        client_id: form.client_id,
        tier: form.tier,
        monthly_fee: parseFloat(form.monthly_fee),
        start_date: form.start_date,
      });
      setContracts(prev => [data.contract, ...prev]);
      setSelectedId(data.contract.id);
    } catch (e) {
      setGenError(e.response?.data?.error || e.message);
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id, status) => {
    setUpdatingStatus(id);
    try {
      await axios.patch(`${API_BASE}/contracts/${id}/status`, { status });
      setContracts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    } catch {}
    finally { setUpdatingStatus(null); }
  };

  const signContract = async () => {
    if (!signeeName.trim() || !selectedId) return;
    setSigning(true);
    try {
      const { data } = await axios.patch(`${API_BASE}/contracts/${selectedId}/sign`, {
        signee_name: signeeName.trim(),
        signed_at: new Date().toISOString(),
      });
      setContracts(prev => prev.map(c => c.id === selectedId ? { ...c, ...data.contract } : c));
      setSignModal(false);
      setSigneeName('');
    } catch {}
    finally { setSigning(false); }
  };

  const selected = contracts.find(c => c.id === selectedId);
  const signed = contracts.filter(c => c.status === 'signed').length;
  const drafts = contracts.filter(c => c.status === 'draft').length;
  const mrr = contracts.filter(c => c.status === 'signed').reduce((s, c) => s + parseFloat(c.monthly_fee || 0), 0);

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-label">Zainab AI</div>
        <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Client Contracts</div>
        <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '3px' }}>
          Zainab generates professional service agreements. Download as PDF and send to clients for signing.
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row" style={{ marginBottom: '20px' }}>
        <div className="stat-card gold-top">
          <div className="stat-label">Total Contracts</div>
          <div className="stat-value">{contracts.length}</div>
          <div className="stat-sub-gold">all time</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Signed</div>
          <div className="stat-value">{signed}</div>
          <div className="stat-sub-green">active agreements</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">Drafts</div>
          <div className="stat-value">{drafts}</div>
          <div className="stat-sub-blue">pending review</div>
        </div>
        <div className="stat-card navy-top">
          <div className="stat-label">MRR (Signed)</div>
          <div className="stat-value" style={{ fontSize: '18px' }}>${mrr.toLocaleString()}</div>
          <div className="stat-sub">from signed contracts</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* LEFT — GENERATE FORM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>Generate New Contract</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</div>
                <select
                  value={form.client_id}
                  onChange={e => {
                    const c = clients.find(c => c.id === e.target.value);
                    setForm(f => ({ ...f, client_id: e.target.value, tier: c?.tier || f.tier }));
                  }}
                  style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                >
                  <option value="">— Select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Service Tier</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {TIERS.map(t => (
                    <div
                      key={t}
                      onClick={() => setForm(f => ({ ...f, tier: t }))}
                      style={{ padding: '8px 10px', borderRadius: '7px', cursor: 'pointer', textAlign: 'center', border: `1px solid ${form.tier === t ? '#c9a84c' : '#e4e9f0'}`, background: form.tier === t ? 'rgba(201,168,76,0.06)' : 'white', fontSize: '11px', fontWeight: form.tier === t ? 700 : 500, color: form.tier === t ? '#c9a84c' : '#4a5568', textTransform: 'capitalize', transition: 'all 0.15s' }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Fee (USD)</div>
                <input
                  type="number"
                  value={form.monthly_fee}
                  onChange={e => setForm(f => ({ ...f, monthly_fee: e.target.value }))}
                  placeholder="e.g. 1997"
                  min="0"
                  style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Date</div>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {genError && (
              <div style={{ marginTop: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#dc2626' }}>
                <i className="ti ti-alert-circle" style={{ marginRight: '6px' }} />{genError}
              </div>
            )}

            <button
              onClick={generate}
              disabled={!form.client_id || !form.monthly_fee || generating}
              className="btn btn-gold"
              style={{ width: '100%', padding: '11px', fontSize: '12px', marginTop: '12px', opacity: !form.client_id || !form.monthly_fee || generating ? 0.6 : 1 }}
            >
              {generating ? (
                <><i className="ti ti-loader" style={{ marginRight: '7px' }} />Zainab is drafting...</>
              ) : (
                <><i className="ti ti-file-text" style={{ marginRight: '7px' }} />Generate Contract</>
              )}
            </button>

            {generating && (
              <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', fontSize: '10px', color: '#92400e', lineHeight: '1.6' }}>
                <i className="ti ti-sparkles" style={{ marginRight: '5px', color: '#c9a84c' }} />
                Zainab is writing a full professional service agreement — this takes 15–30 seconds.
              </div>
            )}
          </div>

          {/* CONTRACT LIST */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f3f8' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                All Contracts ({contracts.length})
              </div>
            </div>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#8896a8', fontSize: '11px' }}>
                <i className="ti ti-loader" style={{ marginRight: '7px' }} />Loading...
              </div>
            ) : contracts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#8896a8', fontSize: '11px' }}>
                No contracts yet. Generate one above.
              </div>
            ) : (
              <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                {contracts.map((c, i) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < contracts.length - 1 ? '1px solid #f0f3f8' : 'none', background: selectedId === c.id ? 'rgba(201,168,76,0.05)' : 'white', borderLeft: selectedId === c.id ? '3px solid #c9a84c' : '3px solid transparent', transition: 'all 0.1s' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, fontSize: '12px', color: '#0a1628' }}>{c.client_name}</div>
                      {STATUS_BADGE[c.status] || <span className="badge-yellow">{c.status}</span>}
                    </div>
                    <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '3px', textTransform: 'capitalize' }}>
                      {c.tier} · {fmtMoney(c.monthly_fee)} · {fmtDate(c.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — CONTRACT VIEWER */}
        <div>
          {!selected ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <i className="ti ti-file-text" style={{ fontSize: '40px', color: '#e4e9f0', display: 'block', marginBottom: '14px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', marginBottom: '6px' }}>No contract selected</div>
              <div style={{ fontSize: '11px', color: '#8896a8', lineHeight: '1.7' }}>
                Generate a new contract or select one from the list on the left.
              </div>
            </div>
          ) : (
            <>
              {/* CONTRACT HEADER BAR */}
              <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '12px', padding: '16px 20px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(201,168,76,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <i className="ti ti-file-text" style={{ fontSize: '20px', color: '#c9a84c' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>
                      {selected.client_name} — {selected.tier.charAt(0).toUpperCase() + selected.tier.slice(1)} Plan
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                      {fmtMoney(selected.monthly_fee)} · From {fmtDate(selected.start_date)} · {selected.contract_text?.split(/\s+/).filter(Boolean).length} words
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* STATUS CHANGER */}
                  <select
                    value={selected.status}
                    onChange={e => updateStatus(selected.id, e.target.value)}
                    disabled={updatingStatus === selected.id}
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '7px', padding: '6px 10px', fontSize: '11px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="signed">Signed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  {selected.status !== 'signed' && (
                    <button
                      onClick={() => { setSigneeName(''); setSignModal(true); }}
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '7px', padding: '7px 14px', fontSize: '11px', fontWeight: 700, color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                    >
                      <i className="ti ti-signature" style={{ fontSize: '12px' }} />
                      Sign Contract
                    </button>
                  )}
                  <button
                    onClick={() => downloadPDF(selected)}
                    style={{ background: '#c9a84c', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '11px', fontWeight: 700, color: '#0a1628', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                  >
                    <i className="ti ti-download" style={{ fontSize: '12px' }} />
                    Download PDF
                  </button>
                </div>
              </div>

              {/* CONTRACT TEXT */}
              <div className="card">
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ti ti-robot" style={{ fontSize: '13px', color: '#c9a84c' }} />
                  Drafted by Zainab · {fmtDate(selected.created_at)}
                </div>
                <div style={{ fontSize: '12px', color: '#0a1628', lineHeight: '1.95', whiteSpace: 'pre-wrap', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '20px 24px', maxHeight: '620px', overflowY: 'auto', fontFamily: 'Georgia, serif' }}>
                  {selected.contract_text}
                </div>
                <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', fontSize: '10px', color: '#92400e', lineHeight: '1.6' }}>
                  <i className="ti ti-info-circle" style={{ marginRight: '5px', color: '#c9a84c' }} />
                  Click <strong>Download PDF</strong> to open a print-ready version. In the print dialog, select "Save as PDF" to download. Mark as <strong>Sent</strong> once dispatched to the client, and <strong>Signed</strong> once executed.
                </div>

                {selected.status === 'signed' && selected.signee_name && (
                  <div style={{ marginTop: '12px', padding: '12px 16px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className="ti ti-circle-check" style={{ fontSize: '18px', color: '#10b981' }} />
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46' }}>Signed by {selected.signee_name}</div>
                      <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>
                        {selected.signed_at ? new Date(selected.signed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {signModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '380px', boxShadow: '0 20px 60px rgba(10,22,40,0.25)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-signature" style={{ color: '#10b981' }} />
                  Sign Contract
                </div>
                <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '20px', lineHeight: '1.6' }}>
                  Enter the full name of the signee. This will be recorded with a timestamp as the electronic signature.
                </div>
                <div style={{ fontSize: '10px', color: '#8896a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Signee Name</div>
                <input
                  type="text"
                  value={signeeName}
                  onChange={e => setSigneeName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && signContract()}
                  placeholder="Full name of signee"
                  autoFocus
                  style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#0a1628', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setSignModal(false)}
                    style={{ flex: 1, padding: '10px', border: '1px solid #e4e9f0', borderRadius: '8px', background: 'white', fontSize: '12px', fontWeight: 600, color: '#4a5568', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={signContract}
                    disabled={!signeeName.trim() || signing}
                    style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: signing || !signeeName.trim() ? '#a7f3d0' : '#10b981', fontSize: '12px', fontWeight: 700, color: 'white', cursor: signing || !signeeName.trim() ? 'not-allowed' : 'pointer' }}
                  >
                    {signing ? 'Signing...' : 'Confirm Signature'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
