import React, { useState } from 'react';

const ENDPOINTS = [
  {
    category: 'Auth',
    items: [
      { method: 'POST', path: '/auth/login', desc: 'Owner login — returns 7-day JWT', params: ['email (string)', 'password (string)'], response: '{ token, user: { name, email, role } }' },
      { method: 'POST', path: '/auth/change-password', desc: 'Change owner password (requires JWT)', params: ['current_password (string)', 'new_password (string, min 8)'], response: '{ ok: true }' },
      { method: 'POST', path: '/auth/enable-2fa', desc: 'Enable 2FA for owner account', params: [], response: '{ twofa_enabled: true }' },
      { method: 'POST', path: '/auth/disable-2fa', desc: 'Disable 2FA', params: [], response: '{ twofa_enabled: false }' },
    ],
  },
  {
    category: 'Clients',
    items: [
      { method: 'POST', path: '/clients/onboard', desc: 'Create a new client account and client user', params: ['name (string)', 'email (string)', 'password (string)', 'tier? (string)', 'niche? (string)', 'business_type? (string)'], response: '{ client, client_user }' },
      { method: 'GET', path: '/clients/ltv', desc: 'Client lifetime value metrics — MRR, months active, ROI', params: [], response: '{ clients: [{ id, name, monthlyFee, monthsActive, totalSubscription, totalRecovered, roi }] }' },
      { method: 'PUT', path: '/clients/:id/tier', desc: 'Update client tier — sends notification email', params: ['tier (string: starter | growth | elite)'], response: '{ client }' },
      { method: 'PATCH', path: '/clients/:id/zapier-url', desc: 'Set Zapier webhook URL for a client', params: ['zapier_webhook_url (string)'], response: '{ ok: true, client }' },
      { method: 'GET', path: '/clients/export', desc: 'Export all clients as CSV', params: ['client_id? (query)'], response: 'CSV file download' },
    ],
  },
  {
    category: 'Contacts',
    items: [
      { method: 'POST', path: '/contacts/import/preview', desc: 'Preview CSV import — validate rows before importing', params: ['file (multipart CSV)', 'client_id (body)'], response: '{ total, preview, validation, valid }' },
      { method: 'POST', path: '/contacts/import', desc: 'Import contacts from CSV file', params: ['file (multipart CSV)', 'client_id (body)'], response: '{ imported, errors, total }' },
      { method: 'POST', path: '/contacts/merge', desc: 'Merge duplicate contact into primary', params: ['primary_contact_id (uuid)', 'duplicate_contact_id (uuid)'], response: '{ ok: true }' },
      { method: 'POST', path: '/contacts/blacklist', desc: 'Blacklist an email — blocks sequence enrollment', params: ['email (string)', 'client_id? (uuid)', 'reason? (string)'], response: '{ blacklisted }' },
      { method: 'GET', path: '/contacts/blacklist', desc: 'Get all blacklisted emails', params: ['client_id? (query)'], response: '{ blacklist: [{ id, email, client_id, reason, created_at }] }' },
      { method: 'DELETE', path: '/contacts/blacklist/:id', desc: 'Remove email from blacklist', params: [], response: '{ ok: true }' },
      { method: 'GET', path: '/contacts/export', desc: 'Export contacts as CSV', params: ['client_id? (query)'], response: 'CSV file download' },
    ],
  },
  {
    category: 'Sequences',
    items: [
      { method: 'POST', path: '/workflows/duplicate', desc: 'Duplicate a workflow and all its steps', params: ['workflow_id (uuid)', 'client_id? (uuid)'], response: '{ workflow, steps_copied }' },
      { method: 'PATCH', path: '/workflows/:id/schedule', desc: 'Schedule a workflow to activate at a future date', params: ['scheduled_start (ISO datetime string)'], response: '{ workflow, status }' },
      { method: 'PUT', path: '/workflow-steps/:id', desc: 'Update a single workflow step content or wait time', params: ['content? (string)', 'subject? (string)', 'wait_hours? (integer)', 'step_type? (string)'], response: '{ step }' },
      { method: 'GET', path: '/workflow-steps/:workflow_id', desc: 'Get all steps for a workflow', params: [], response: '{ steps: [] }' },
      { method: 'POST', path: '/workflows/pause', desc: 'Pause all active enrollments in a workflow', params: ['workflow_id (uuid)', 'client_id? (uuid)'], response: '{ ok: true, paused }' },
      { method: 'POST', path: '/workflows/resume', desc: 'Resume all paused enrollments', params: ['workflow_id (uuid)'], response: '{ ok: true, resumed }' },
      { method: 'POST', path: '/sequences/feedback', desc: 'Hussain AI analysis of sequence performance', params: ['workflow_id (uuid)'], response: '{ analysis, stats: { total, completed, cancelled, active, completionRate, dropOffRate } }' },
    ],
  },
  {
    category: 'Approvals',
    items: [
      { method: 'POST', path: '/approvals/action', desc: 'Approve or reject an AI approval item', params: ['approval_id (uuid)', 'action (approve | reject)', 'feedback? (string)', 'edited_content? (string)', 'edited_steps? (array)'], response: '{ ok: true }' },
    ],
  },
  {
    category: 'Knowledge Base',
    items: [
      { method: 'POST', path: '/upload-pdf', desc: 'Upload PDF — auto-chunked and embedded in background', params: ['pdf (multipart file)', 'title (string)', 'clientId (string)', 'type (string)', 'aiMember (string)'], response: '{ success, chunks }' },
      { method: 'POST', path: '/search-knowledge', desc: 'Semantic search across all knowledge chunks', params: ['query (string)', 'clientId? (string)'], response: '{ success, results: [{ id, title, content, similarity }] }' },
      { method: 'POST', path: '/generate-embedding', desc: 'Generate embedding for a knowledge document by ID', params: ['documentId (uuid)', 'text (string)'], response: '{ success }' },
    ],
  },
  {
    category: 'Email & Messaging',
    items: [
      { method: 'POST', path: '/send-email', desc: 'Send a one-off email via SendGrid', params: ['to (string)', 'subject (string)', 'html (string)', 'client_id? (uuid)'], response: '{ ok: true }' },
      { method: 'POST', path: '/send-sms', desc: 'Send SMS via Twilio', params: ['to (string)', 'body (string)', 'client_id? (uuid)'], response: '{ ok: true }' },
      { method: 'POST', path: '/email/broadcast', desc: 'Broadcast email to all client contacts (optionally filtered by tag)', params: ['client_id (uuid)', 'subject (string)', 'content (string)', 'tag? (string)'], response: '{ sent, skipped, total }' },
      { method: 'POST', path: '/generate-reply', desc: 'AI-suggested reply for an inbox message via Claude Haiku', params: ['content (string)', 'channel? (string)', 'senderName? (string)', 'clientName? (string)'], response: '{ reply }' },
    ],
  },
  {
    category: 'Billing',
    items: [
      { method: 'POST', path: '/stripe/create-subscription', desc: 'Create Stripe customer and subscription for a client', params: ['client_id (uuid)', 'price_id (string)', 'payment_method_id (string)'], response: '{ ok, subscription_id, customer_id, status }' },
      { method: 'GET', path: '/stripe/billing', desc: 'Fetch all clients with their Stripe subscription status', params: [], response: '{ clients: [{ id, name, tier, stripe_customer_id, subscription_status }] }' },
      { method: 'POST', path: '/invoices/generate', desc: 'Generate an invoice for a client', params: ['client_id (uuid)', 'amount (number)', 'plan (string)', 'line_items? (array)'], response: '{ invoice }' },
      { method: 'GET', path: '/invoices/list', desc: 'List all invoices, optionally filtered by client', params: ['client_id? (query)'], response: '{ invoices: [] }' },
      { method: 'POST', path: '/credits/issue', desc: 'Issue a credit to a client account', params: ['client_id (uuid)', 'amount (number)', 'reason? (string)'], response: '{ credit }' },
    ],
  },
  {
    category: 'AI Team',
    items: [
      { method: 'POST', path: '/hussain', desc: 'Hussain — Intelligence & Strategy AI response', params: ['prompt (string)', 'clientId? (string)'], response: '{ result }' },
      { method: 'POST', path: '/hassan', desc: 'Hassan — Growth & Outreach AI response', params: ['prompt (string)', 'clientId? (string)'], response: '{ result }' },
      { method: 'POST', path: '/ali', desc: 'Ali — Sales Closer AI response', params: ['prompt (string)', 'clientId? (string)'], response: '{ result }' },
      { method: 'POST', path: '/mahdi', desc: 'Mahdi — Marketing & Content AI response', params: ['prompt (string)', 'clientId? (string)'], response: '{ result }' },
      { method: 'POST', path: '/fatima', desc: 'Fatima — Operations Manager AI response', params: ['prompt (string)', 'clientId? (string)'], response: '{ result }' },
      { method: 'POST', path: '/zainab', desc: 'Zainab — Client Partner AI response', params: ['prompt (string)', 'clientId? (string)'], response: '{ result }' },
    ],
  },
  {
    category: 'Zapier & Mobile',
    items: [
      { method: 'GET', path: '/zapier/events', desc: 'List all supported Zapier event types', params: [], response: '{ events: [{ type, description }] }' },
      { method: 'POST', path: '/zapier/trigger', desc: 'Send a Zapier webhook event for a client', params: ['event_type (string)', 'data (object)', 'client_id (uuid)'], response: '{ ok: true, status }' },
      { method: 'GET', path: '/mobile/config', desc: 'Mobile app configuration — API base URL, features, version', params: [], response: '{ api_base, app_version, features }' },
      { method: 'POST', path: '/mobile/register-device', desc: 'Register a device token for push notifications', params: ['client_id (uuid)', 'device_token (string)', 'platform (ios | android)'], response: '{ ok: true, registered }' },
    ],
  },
  {
    category: 'Analytics & Admin',
    items: [
      { method: 'GET', path: '/analytics/stats', desc: 'Platform stats for current month — emails, SMS, WhatsApp, contacts, enrollments, sequences', params: ['month? (query, YYYY-MM)'], response: '{ emailsSent, smsSent, whatsappSent, contactsAdded, enrollments, activeSequences }' },
      { method: 'GET', path: '/admin/usage', desc: 'Platform API usage this month — call counts, top endpoints, avg response time', params: [], response: '{ totalCalls, topEndpoints, avgResponseMs }' },
      { method: 'GET', path: '/admin/rate-limit-stats', desc: 'Rate limit hit statistics for the last 7 days', params: [], response: '{ total, topEndpoints, topIps }' },
      { method: 'GET', path: '/webhooks/logs', desc: 'Recent Shopify webhook delivery logs', params: [], response: '{ logs: [{ shop, topic, received_at, success, error_message }] }' },
      { method: 'GET', path: '/health', desc: 'Server health check — uptime, memory', params: [], response: '{ status, uptime, memory }' },
    ],
  },
];

const METHOD_COLORS = {
  GET: { bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' },
  POST: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  PUT: { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff' },
  PATCH: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  DELETE: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

export default function ApiDocs() {
  const [openCategory, setOpenCategory] = useState(null);
  const [openEndpoint, setOpenEndpoint] = useState(null);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Developer Reference</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>API Documentation — Sales Scales v2</div>
        </div>
        <div style={{ fontSize: '11px', color: '#8896a8' }}>Base URL: <code style={{ fontFamily: 'DM Mono, monospace', color: '#c9a84c' }}>http://localhost:3001</code></div>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '11px', color: '#4a5568', lineHeight: 1.7 }}>
        <strong>Authentication:</strong> Protected endpoints require <code style={{ fontFamily: 'DM Mono, monospace', background: '#f0f3f8', padding: '1px 5px', borderRadius: '4px' }}>Authorization: Bearer &lt;token&gt;</code> header.
        Get a token via <code style={{ fontFamily: 'DM Mono, monospace', background: '#f0f3f8', padding: '1px 5px', borderRadius: '4px' }}>POST /auth/login</code>. Token expires in 7 days.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ENDPOINTS.map(cat => (
          <div key={cat.category} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
            <button
              onClick={() => setOpenCategory(openCategory === cat.category ? null : cat.category)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: openCategory === cat.category ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0a1628' }}>{cat.category}</span>
                <span style={{ fontSize: '9px', padding: '2px 7px', background: '#f0f3f8', color: '#8896a8', borderRadius: '20px', fontWeight: 600 }}>{cat.items.length} endpoint{cat.items.length !== 1 ? 's' : ''}</span>
              </div>
              <span style={{ fontSize: '16px', color: '#8896a8', transition: 'transform 0.2s', transform: openCategory === cat.category ? 'rotate(90deg)' : 'none' }}>›</span>
            </button>

            {openCategory === cat.category && (
              <div style={{ borderTop: '1px solid #f0f3f8' }}>
                {cat.items.map((ep, i) => {
                  const mc = METHOD_COLORS[ep.method] || METHOD_COLORS.GET;
                  const key = `${ep.method}${ep.path}`;
                  const isOpen = openEndpoint === key;
                  return (
                    <div key={i} style={{ borderBottom: i < cat.items.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <button
                        onClick={() => setOpenEndpoint(isOpen ? null : key)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', background: isOpen ? '#fafbfd' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
                        <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', fontWeight: 800, letterSpacing: '0.5px', background: mc.bg, color: mc.color, border: `1px solid ${mc.border}`, flexShrink: 0 }}>{ep.method}</span>
                        <code style={{ fontSize: '12px', fontFamily: 'DM Mono, monospace', color: '#0a1628', fontWeight: 500 }}>{ep.path}</code>
                        <span style={{ fontSize: '11px', color: '#8896a8', marginLeft: '8px', flex: 1, textAlign: 'left' }}>{ep.desc}</span>
                        <span style={{ fontSize: '14px', color: '#8896a8', flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                      </button>

                      {isOpen && (
                        <div style={{ padding: '12px 18px 16px 18px', background: '#fafbfd', borderTop: '1px solid #f0f3f8' }}>
                          {ep.params.length > 0 && (
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Parameters</div>
                              {ep.params.map((p, pi) => (
                                <div key={pi} style={{ fontSize: '11px', color: '#4a5568', padding: '3px 0', display: 'flex', gap: '6px' }}>
                                  <code style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6', fontSize: '11px' }}>{p.split(' (')[0]}</code>
                                  {p.includes('(') && <span style={{ color: '#8896a8' }}>({p.split('(')[1].replace(')', '')})</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '1.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Example Response</div>
                            <code style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#4a5568', background: '#f0f3f8', padding: '6px 10px', borderRadius: '6px', display: 'block' }}>{ep.response}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
