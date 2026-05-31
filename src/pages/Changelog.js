import React, { useState } from 'react';

const ENTRIES = [
  {
    version: 'v2.10', date: '2025-05-31', category: 'Feature',
    title: 'NPS email redesign, sequence analytics, webhook monitoring, LTV tracking',
    changes: [
      'NPS survey email — branded navy/gold design with color-coded rating buttons and segmented thank-you page',
      'Sequence Analytics dashboard — funnel chart showing enrolled → active → completed → drop-off per sequence',
      'Webhook delivery monitoring — log table for all incoming Shopify webhooks with success/fail status',
      'Client LTV tracking — monthly subscription value, total subscription revenue, and ROI ratio in Clients page',
      'Welcome email sequence — 3 automated emails (day 0, day 3, day 7) triggered when a new client is onboarded',
      'Contact engagement score — points added for email opens (+10), clicks (+20), SMS replies (+30)',
      'Case study email notification — automatic email to owner when a new case study is generated',
      'Platform changelog — this page',
    ],
  },
  {
    version: 'v2.9', date: '2025-05-31', category: 'Feature',
    title: 'Sequence templates, AI team profiles, onboarding progress, notification bell',
    changes: [
      'Sequence Template Library — 5 pre-built templates (Cart Recovery, Post Purchase, Win Back, Lead Nurture, VIP)',
      'AI team member profiles — stats row, last-10-briefings activity feed, Configure button per member',
      'Client portal onboarding progress bar — 5-step checklist visible to clients until complete',
      'Notification bell — owner topbar bell aggregates pending approvals, new contacts, completed enrollments',
      'Contact merge — Merge Duplicates panel groups contacts by matching email for one-click merge',
      'Knowledge Base real-time search — local search bar with gold term highlighting and source filter',
      'Approvals priority filter — filter by Urgent / High / Normal plus sort by Newest, Oldest, Client, Priority',
      'Dashboard new metrics — Revenue Recovered This Month, Active Sequences, Enrolled This Week, Avg Health Score',
    ],
  },
  {
    version: 'v2.8', date: '2025-05-30', category: 'Feature',
    title: 'Sequence step editor, health tooltips, content calendar, cron improvements',
    changes: [
      'Sequence step editor — click workflow row to expand inline steps; per-step Edit modal saves via PUT endpoint',
      'Client health score tooltip — hover reveals score breakdown (enrollments, messages, sequences, activity)',
      'Team Briefings calendar tab — 7-day grid showing briefings by scheduled_for date colored by priority',
      'Hassan daily cron — now generates cold email under 200 words per prospect',
      'Fatima deliverability monitoring — daily 7am cron checks SendGrid bounce/spam rates',
      'Hussain competitor monitoring — weekly Tuesday cron auto-runs competitor analysis per client',
      'Ali objection playbook — generates 5-objection NEPQ playbook alongside closing script on prospect approval',
    ],
  },
  {
    version: 'v2.7', date: '2025-05-29', category: 'Feature',
    title: 'Platform search, AI agent actions, email tracking, PayPal, 2FA',
    changes: [
      'Global search — contacts, clients, approvals searchable from topbar',
      '2FA for owner login — TOTP-based two-factor authentication',
      'Rate limit monitoring — dashboard showing blocked endpoints and IPs',
      'PayPal payment validation — validates payment_method_id before subscription creation',
      'Calendly upcoming calls — live call schedule in Dashboard from Calendly API',
      'Performance logging — server request timing and memory usage tracked',
    ],
  },
  {
    version: 'v2.6', date: '2025-05-28', category: 'Feature',
    title: 'Revenue dashboard, referrals, invoices, bulk contacts',
    changes: [
      'Revenue Dashboard — revenue attribution by channel, sequence type, and per-client breakdown',
      'Referrals system — refer-and-earn program with tracking and status management',
      'Auto Reports — Zainab generates monthly client reports stored in reports table',
      'Contracts — AI-generated service agreements with PDF download',
      'Case Studies — Hussain generates client case studies with 7-section structure',
      'Bulk contact import — CSV import with preview and validation',
    ],
  },
  {
    version: 'v2.5', date: '2025-05-25', category: 'Feature',
    title: 'Client portal, Shopify OAuth, Meta Ads, Klaviyo',
    changes: [
      'Client portal — full client-facing dashboard with their own sequences, results, and Zainab chat',
      'Shopify OAuth — one-click store connection with customer sync and abandoned cart webhooks',
      'Meta Ads dashboard — spend, impressions, CTR, ROAS with top-5 ads breakdown',
      'Klaviyo stats — open rate, click rate, revenue attribution, list breakdown',
      'HubSpot CRM sync — batch upsert contacts to HubSpot with field mapping',
      'Store Audit Tool — AI-scored audit across email, cart recovery, SMS, social, ads',
    ],
  },
  {
    version: 'v2.4', date: '2025-05-20', category: 'Feature',
    title: 'AI team automation, sequences, approvals workflow',
    changes: [
      'Sequences — full workflow builder with email, SMS, WhatsApp, wait, tag, pipeline, notify steps',
      'Approvals queue — AI-generated content routed through human approval before execution',
      'Team Briefings — inter-AI cross-briefings injected into each member\'s session context',
      'Mahdi sequence improvement cron — auto-detects low completion and rewrites sequences',
      'Hassan prospect outreach cron — daily automated prospect generation and LinkedIn messages',
      'Scheduler — 15-minute cron processes active workflow enrollments and fires steps',
    ],
  },
  {
    version: 'v2.3', date: '2025-05-15', category: 'Feature',
    title: 'Knowledge base, RAG search, PDF ingestion',
    changes: [
      'Knowledge Base — full RAG document manager with PDF upload, YouTube transcript import',
      'Vector embeddings — OpenAI text-embedding-3-small embeds all documents for semantic search',
      'Bulk YouTube channel import — SSE progress stream for bulk transcript ingestion',
      'AI team context injection — all 6 AI members receive relevant RAG context per request',
      'Semantic search — search across all knowledge base chunks by meaning',
    ],
  },
  {
    version: 'v2.2', date: '2025-05-10', category: 'Feature',
    title: 'Billing, Stripe, voice agents, transcription',
    changes: [
      'Stripe billing — subscription management with status tracking per client',
      'ElevenLabs voice agents — create and manage inbound/outbound AI voice agents',
      'Call transcription — OpenAI Whisper-powered audio upload and transcript generation',
      'Invoice generation — PDF-ready invoice emails with branded HTML templates',
      'NPS survey system — monthly survey emails to client users with score tracking',
    ],
  },
  {
    version: 'v2.1', date: '2025-05-05', category: 'Feature',
    title: 'CRM, pipeline, inbox, analytics',
    changes: [
      'CRM Contacts — full contact database with pipeline stages, tags, and activity timeline',
      'Pipeline — Kanban-style deals pipeline with value tracking',
      'Unified Inbox — SMS, email, WhatsApp messages in one interface with AI reply suggestions',
      'Analytics — monthly stats, channel breakdown, workflow performance table',
      'SMS and WhatsApp — Twilio-powered two-way messaging with inbound reply detection',
    ],
  },
  {
    version: 'v2.0', date: '2025-05-01', category: 'Launch',
    title: 'Initial platform launch — AI team, clients, dashboard',
    changes: [
      'Six AI team members — Hussain (Strategy), Hassan (Outreach), Ali (Closer), Mahdi (Content), Fatima (Ops), Zainab (Client Partner)',
      'Client management — add, manage, and track ecommerce clients with health scores',
      'Owner dashboard — platform overview with key metrics and AI morning briefing',
      'JWT authentication — secure owner login with 7-day tokens',
      'Supabase backend — PostgreSQL database with row-level security',
      'SendGrid email — transactional email delivery with tracking webhooks',
    ],
  },
];

const CATEGORY_COLORS = {
  Feature: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  Fix: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Enhancement: { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff' },
  Launch: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
};

export default function Changelog() {
  const [expanded, setExpanded] = useState(new Set([ENTRIES[0].version]));

  const toggle = (v) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(v) ? next.delete(v) : next.add(v);
    return next;
  });

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Platform History</div>
        <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{ENTRIES.length} releases · Sales Scales AI Revenue System</div>
      </div>

      <div style={{ position: 'relative', paddingLeft: '32px' }}>
        <div style={{ position: 'absolute', left: '10px', top: 0, bottom: 0, width: '2px', background: 'linear-gradient(180deg, #c9a84c, #e4e9f0)' }} />

        {ENTRIES.map((entry, i) => {
          const isOpen = expanded.has(entry.version);
          const catStyle = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Feature;
          return (
            <div key={entry.version} style={{ marginBottom: '20px', position: 'relative' }}>
              {/* Timeline dot */}
              <div style={{ position: 'absolute', left: '-27px', top: '18px', width: '14px', height: '14px', borderRadius: '50%', background: i === 0 ? '#c9a84c' : 'white', border: `2px solid ${i === 0 ? '#c9a84c' : '#e4e9f0'}`, boxShadow: i === 0 ? '0 0 0 4px rgba(201,168,76,0.15)' : 'none' }} />

              <div style={{ background: 'white', border: `1px solid ${isOpen ? '#c9a84c' : '#e4e9f0'}`, borderRadius: '12px', overflow: 'hidden', boxShadow: isOpen ? '0 4px 16px rgba(10,22,40,0.08)' : '0 1px 3px rgba(10,22,40,0.05)', transition: 'border-color 0.2s' }}>
                <button
                  onClick={() => toggle(entry.version)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
                  <code style={{ fontSize: '10px', fontWeight: 700, color: '#c9a84c', background: 'rgba(201,168,76,0.1)', padding: '3px 8px', borderRadius: '6px', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>{entry.version}</code>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}`, flexShrink: 0 }}>{entry.category}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', flex: 1 }}>{entry.title}</span>
                  <span style={{ fontSize: '10px', color: '#8896a8', flexShrink: 0 }}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span style={{ fontSize: '16px', color: isOpen ? '#c9a84c' : '#8896a8', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none', flexShrink: 0, marginLeft: '4px' }}>›</span>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #f0f3f8', padding: '16px 20px' }}>
                    <ul style={{ margin: 0, paddingLeft: '18px', listStyleType: 'disc' }}>
                      {entry.changes.map((change, j) => (
                        <li key={j} style={{ fontSize: '12px', color: '#4a5568', lineHeight: '1.9', paddingLeft: '4px' }}>
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
