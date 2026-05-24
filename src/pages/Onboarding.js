import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

function DetailBlock({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '9px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: '1.65' }}>{value || '—'}</div>
    </div>
  );
}

export default function Onboarding() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { fetchResponses(); }, []);

  const fetchResponses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('client_onboarding')
      .select('*, clients(name, niche, tier)')
      .order('created_at', { ascending: false });
    if (data) setResponses(data);
    setLoading(false);
  };

  const completed = responses.filter(r => r.completed_at);

  const thisWeek = responses.filter(r => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(r.created_at) >= weekAgo;
  });

  const completionRate = responses.length > 0
    ? Math.round((completed.length / responses.length) * 100)
    : 0;

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card gold-top">
          <div className="stat-label">Total Responses</div>
          <div className="stat-value">{responses.length}</div>
          <div className="stat-sub-gold">All submissions</div>
        </div>
        <div className="stat-card green-top">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{completed.length}</div>
          <div className="stat-sub-green">Fully submitted</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">This Week</div>
          <div className="stat-value">{thisWeek.length}</div>
          <div className="stat-sub-blue">New responses</div>
        </div>
        <div className="stat-card navy-top">
          <div className="stat-label">Completion Rate</div>
          <div className="stat-value">{completionRate}%</div>
          <div className="stat-sub">Of all submissions</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>Client Onboarding Responses</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Click any row to expand full answers</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: '13px' }}>Loading responses...</div>
        ) : responses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px' }}>
            <i className="ti ti-clipboard-list" style={{ fontSize: '34px', color: 'var(--muted)', display: 'block', marginBottom: '12px' }} aria-hidden="true"></i>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No onboarding responses yet. Clients will appear here once they complete the questionnaire on first login.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-header">
              <div className="th" style={{ flex: '0 0 160px' }}>Client</div>
              <div className="th" style={{ flex: '0 0 150px' }}>Store URL</div>
              <div className="th" style={{ flex: '0 0 115px' }}>Revenue</div>
              <div className="th" style={{ flex: '0 0 90px' }}>AOV</div>
              <div className="th" style={{ flex: 1 }}>Biggest Challenge</div>
              <div className="th" style={{ flex: '0 0 76px' }}>Status</div>
              <div className="th" style={{ flex: '0 0 104px' }}>Completed</div>
            </div>

            {responses.map(r => (
              <React.Fragment key={r.id}>
                <div
                  className="table-row"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  style={{ cursor: 'pointer', background: expanded === r.id ? 'rgba(201,168,76,0.04)' : undefined }}
                >
                  <div className="td" style={{ flex: '0 0 160px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.clients?.name || '—'}</div>
                    {r.clients?.tier && <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>{r.clients.tier} plan</div>}
                  </div>
                  <div className="td" style={{ flex: '0 0 150px', fontSize: '12px', color: 'var(--muted)' }}>{r.store_url || '—'}</div>
                  <div className="td" style={{ flex: '0 0 115px', fontSize: '12px' }}>{r.monthly_revenue || '—'}</div>
                  <div className="td" style={{ flex: '0 0 90px', fontSize: '12px' }}>{r.average_order_value || '—'}</div>
                  <div className="td" style={{ flex: 1, fontSize: '12px' }}>{r.biggest_challenge || '—'}</div>
                  <div className="td" style={{ flex: '0 0 76px' }}>
                    <span className={r.completed_at ? 'badge-green' : 'badge-yellow'}>
                      {r.completed_at ? 'done' : 'partial'}
                    </span>
                  </div>
                  <div className="td" style={{ flex: '0 0 104px', fontSize: '11px', color: 'var(--muted)' }}>
                    {formatDate(r.completed_at)}
                  </div>
                </div>

                {expanded === r.id && (
                  <div style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', padding: '22px 28px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                      <DetailBlock label="Main Products" value={r.main_products} />
                      <DetailBlock label="Brand Voice" value={r.brand_voice} />
                      <DetailBlock label="Target Customer" value={r.target_customer} />
                      <DetailBlock
                        label="Current Tools"
                        value={r.current_tools?.length ? r.current_tools.join(', ') : 'None selected'}
                      />
                      <DetailBlock label="Main Competitors" value={r.main_competitors} />
                      <DetailBlock label="90-Day Goals" value={r.goals} />
                    </div>
                    <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--muted)' }}>
                      Submitted {formatDate(r.created_at)} · client_id: {r.client_id}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
