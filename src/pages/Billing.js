import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';

const TIER_FEES = { starter: 199, growth: 299, scale: 399, elite: 399, enterprise: 0 };
const TIER_LABELS = { starter: 'Starter', growth: 'Growth', scale: 'Scale', enterprise: 'Enterprise' };

const fmtMoney = (n) => n === 0 ? 'Custom' : `$${n.toLocaleString()}/mo`;

const StatusBadge = ({ s }) => {
  if (!s) return <span className="badge-gold">No billing</span>;
  if (s === 'active') return <span className="badge-green">Active</span>;
  if (s === 'trialing') return <span className="badge-blue">Trialing</span>;
  if (s === 'past_due') return <span className="badge-red">Past Due</span>;
  if (s === 'unpaid') return <span className="badge-red">Unpaid</span>;
  if (s === 'canceled') return <span className="badge-red">Cancelled</span>;
  if (s === 'error') return <span className="badge-red">Error</span>;
  return <span className="badge-yellow">{s}</span>;
};

export default function Billing() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [priceId, setPriceId] = useState('');
  const [pmId, setPmId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API_BASE}/stripe/billing`);
      setClients(data.clients || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = (client) => {
    setModal(client);
    setPriceId('');
    setPmId('');
    setSubmitError('');
    setSubmitSuccess('');
  };

  const createSubscription = async () => {
    if (!priceId.trim() || !pmId.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      await axios.post(`${API_BASE}/stripe/create-subscription`, {
        client_id: modal.id,
        price_id: priceId.trim(),
        payment_method_id: pmId.trim(),
      });
      setSubmitSuccess('Subscription created successfully.');
      setTimeout(() => { setModal(null); load(); }, 1500);
    } catch (e) {
      setSubmitError(e.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = clients.filter(c => c.subscription_status === 'active').length;
  const overdueCount = clients.filter(c => ['past_due', 'unpaid'].includes(c.subscription_status)).length;
  const mrr = clients
    .filter(c => c.subscription_status === 'active')
    .reduce((sum, c) => sum + (TIER_FEES[c.tier] || 0), 0);

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-label">Stripe Billing</div>
        <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>Client Subscriptions</div>
        <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '3px' }}>
          Manage Stripe subscriptions and billing status for all agency clients.
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row" style={{ marginBottom: '20px' }}>
        <div className="stat-card green-top">
          <div className="stat-label">Monthly Recurring Revenue</div>
          <div className="stat-value">${mrr.toLocaleString()}</div>
          <div className="stat-sub-green">{activeCount} active subscription{activeCount !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card gold-top">
          <div className="stat-label">Total Clients</div>
          <div className="stat-value">{clients.length}</div>
          <div className="stat-sub-gold">{clients.filter(c => c.stripe_customer_id).length} linked to Stripe</div>
        </div>
        <div className="stat-card blue-top">
          <div className="stat-label">Active</div>
          <div className="stat-value">{activeCount}</div>
          <div className="stat-sub-blue">paying subscriptions</div>
        </div>
        <div className="stat-card" style={{ borderTop: `3px solid ${overdueCount > 0 ? '#dc2626' : '#e4e9f0'}` }}>
          <div className="stat-label">Overdue / Past Due</div>
          <div className="stat-value" style={{ color: overdueCount > 0 ? '#dc2626' : '#0a1628' }}>{overdueCount}</div>
          <div className="stat-sub" style={{ color: overdueCount > 0 ? '#dc2626' : '#8896a8' }}>require attention</div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: '#dc2626', marginBottom: '16px' }}>
          <i className="ti ti-alert-circle" style={{ marginRight: '6px' }} />
          {error === 'STRIPE_SECRET_KEY not configured'
            ? 'Stripe is not configured. Add STRIPE_SECRET_KEY to your .env file.'
            : error}
        </div>
      )}

      {/* TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.6fr 110px', padding: '0 20px' }}>
          <div className="th">Client</div>
          <div className="th">Tier</div>
          <div className="th">Monthly Fee</div>
          <div className="th">Status</div>
          <div className="th">Stripe Customer</div>
          <div className="th"></div>
        </div>

        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
            <i className="ti ti-loader" style={{ marginRight: '8px' }} />Loading billing data...
          </div>
        )}

        {!loading && clients.length === 0 && !error && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8896a8', fontSize: '12px' }}>
            No clients found.
          </div>
        )}

        {!loading && clients.map((c, i) => (
          <div
            key={c.id}
            className="table-row"
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.6fr 110px', padding: '0 20px', borderBottom: i < clients.length - 1 ? '1px solid #f0f3f8' : 'none' }}
          >
            <div className="td">
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#0a1628' }}>{c.name}</div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '2px', textTransform: 'capitalize' }}>{c.status || '—'}</div>
            </div>

            <div className="td">
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628' }}>
                {TIER_LABELS[c.tier] || c.tier || '—'}
              </span>
            </div>

            <div className="td">
              <span style={{ fontSize: '12px', fontWeight: 700, color: c.tier === 'enterprise' ? '#8896a8' : '#10b981' }}>
                {TIER_FEES[c.tier] !== undefined ? fmtMoney(TIER_FEES[c.tier]) : '—'}
              </span>
            </div>

            <div className="td">
              <StatusBadge s={c.subscription_status} />
            </div>

            <div className="td">
              {c.stripe_customer_id ? (
                <span style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: '#4a5568', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '4px', padding: '2px 7px' }}>
                  {c.stripe_customer_id}
                </span>
              ) : (
                <span style={{ fontSize: '11px', color: '#c4c9d4' }}>Not linked</span>
              )}
            </div>

            <div className="td" style={{ justifyContent: 'flex-end' }}>
              {c.stripe_customer_id ? (
                <a
                  href={`https://dashboard.stripe.com/customers/${c.stripe_customer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '10px', padding: '5px 10px', textDecoration: 'none' }}
                >
                  <i className="ti ti-external-link" style={{ marginRight: '4px', fontSize: '11px' }} />
                  Stripe
                </a>
              ) : (
                <button
                  className="btn btn-navy"
                  style={{ fontSize: '10px', padding: '5px 12px' }}
                  onClick={() => openModal(c)}
                >
                  Setup
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div style={{ background: 'white', borderRadius: '14px', padding: '28px 32px', width: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628' }}>Setup Billing</div>
                <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '3px' }}>{modal.name}</div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '18px', lineHeight: 1 }}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Stripe Price ID</div>
                <input
                  type="text"
                  value={priceId}
                  onChange={e => setPriceId(e.target.value)}
                  placeholder="price_xxxxxxxxxxxxxxxxxxxx"
                  style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace' }}
                />
                <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '4px' }}>Found in Stripe Dashboard → Products → your plan</div>
              </div>

              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Payment Method ID</div>
                <input
                  type="text"
                  value={pmId}
                  onChange={e => setPmId(e.target.value)}
                  placeholder="pm_xxxxxxxxxxxxxxxxxxxx"
                  style={{ width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace' }}
                />
                <div style={{ fontSize: '10px', color: '#8896a8', marginTop: '4px' }}>Stripe payment method ID from collected card details</div>
              </div>

              {submitError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#dc2626' }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: '6px' }} />{submitError}
                </div>
              )}

              {submitSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#15803d' }}>
                  <i className="ti ti-circle-check" style={{ marginRight: '6px' }} />{submitSuccess}
                </div>
              )}

              <button
                onClick={createSubscription}
                disabled={!priceId.trim() || !pmId.trim() || submitting}
                className="btn btn-gold"
                style={{ width: '100%', padding: '11px', fontSize: '12px', opacity: !priceId.trim() || !pmId.trim() || submitting ? 0.6 : 1 }}
              >
                {submitting ? (
                  <><i className="ti ti-loader" style={{ marginRight: '7px' }} />Creating Subscription...</>
                ) : (
                  <><i className="ti ti-credit-card" style={{ marginRight: '7px' }} />Create Subscription</>
                )}
              </button>

              <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '8px', fontSize: '10px', color: '#8896a8', lineHeight: '1.6' }}>
                <i className="ti ti-info-circle" style={{ marginRight: '5px' }} />
                This creates a Stripe Customer for <strong>{modal.name}</strong>, attaches the payment method, and starts the subscription immediately.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
