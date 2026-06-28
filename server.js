require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const multer = require('multer');
const PDF2Json = require('pdf2json');
const { YoutubeTranscript } = require('youtube-transcript');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const compression = require('compression');

const JWT_SECRET = process.env.JWT_SECRET || 'salesscales-jwt-secret-change-in-production';

// Fix 4: country→timezone mapping for contact send-window enforcement
const COUNTRY_TIMEZONE = {
  US:'America/New_York', CA:'America/Toronto', GB:'Europe/London', AU:'Australia/Sydney',
  NZ:'Pacific/Auckland', DE:'Europe/Berlin', FR:'Europe/Paris', NL:'Europe/Amsterdam',
  ES:'Europe/Madrid', IT:'Europe/Rome', SE:'Europe/Stockholm', NO:'Europe/Oslo',
  DK:'Europe/Copenhagen', CH:'Europe/Zurich', AT:'Europe/Vienna', BE:'Europe/Brussels',
  PT:'Europe/Lisbon', IE:'Europe/Dublin', PL:'Europe/Warsaw', CZ:'Europe/Prague',
  JP:'Asia/Tokyo', KR:'Asia/Seoul', CN:'Asia/Shanghai', HK:'Asia/Hong_Kong',
  TW:'Asia/Taipei', SG:'Asia/Singapore', MY:'Asia/Kuala_Lumpur', PH:'Asia/Manila',
  TH:'Asia/Bangkok', ID:'Asia/Jakarta', IN:'Asia/Kolkata', PK:'Asia/Karachi',
  AE:'Asia/Dubai', SA:'Asia/Riyadh', IL:'Asia/Jerusalem', TR:'Europe/Istanbul',
  ZA:'Africa/Johannesburg', NG:'Africa/Lagos', EG:'Africa/Cairo', KE:'Africa/Nairobi',
  BR:'America/Sao_Paulo', MX:'America/Mexico_City', AR:'America/Argentina/Buenos_Aires',
  CO:'America/Bogota', CL:'America/Santiago',
};

const localHourInTz = (timezone) => {
  try {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(new Date()), 10);
  } catch { return null; }
};

const nextSendWindowAt = (timezone) => {
  const hour = localHourInTz(timezone);
  if (hour === null) return null;
  const hoursUntil9 = hour < 9 ? 9 - hour : 24 - hour + 9;
  return new Date(Date.now() + hoursUntil9 * 3600_000).toISOString();
};

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Fix 4: Slack alert helper — reads SLACK_WEBHOOK_URL from env (set in Vercel/Railway env vars)
const sendSlackAlert = async (text) => {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try { await axios.post(url, { text }); }
  catch (e) { console.error('Slack alert failed:', e.message); }
};

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const createClientNotification = async (clientId, title, message, type = 'info') => {
  if (!clientId) return;
  try {
    await supabase.from('client_notifications').insert([{
      client_id: clientId, title, message, type, read: false,
      created_at: new Date().toISOString(),
    }]);
  } catch { /* notifications are non-critical — never throw */ }
};

const inferApprovalPriority = (type = '', title = '', fromMember = '') => {
  const t = type.toLowerCase();
  const ti = title.toLowerCase();
  if (/refund|return|complaint|dispute|money.?back/.test(ti)) return 'urgent';
  if (/refund|complaint/.test(t)) return 'urgent';
  if (['prospect', 'outreach', 'outreach_message', 'brand_deal', 'competitor_report', 'client_request'].includes(t)) return 'high';
  if (/prospect|outreach|brand.?deal/.test(t)) return 'high';
  return 'normal';
};

const onUrgentApproval = (approval) => {
  if (!approval || approval.priority !== 'urgent') return;
  sgMail.send({
    to: 'yousef@aisalesscales.com',
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
    subject: `🚨 Urgent Approval — ${approval.title}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#dc2626;padding:16px 24px;border-radius:8px 8px 0 0">
        <div style="color:white;font-size:14px;font-weight:700">⚠ Urgent Approval Requires Your Attention</div>
      </div>
      <div style="background:#fff;border:1px solid #fecaca;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px">
        <div style="font-size:14px;color:#0a1628;font-weight:600;margin-bottom:10px">${approval.title}</div>
        <div style="font-size:12px;color:#4a5568;line-height:1.7;margin-bottom:16px">${(approval.content || '').slice(0, 300)}${approval.content && approval.content.length > 300 ? '...' : ''}</div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:12px;color:#dc2626;font-weight:600">
          This approval has been marked urgent — please review it immediately in the Approval Queue.
        </div>
      </div>
    </div>`,
  }).catch(e => console.error('Urgent approval email failed:', e.message));
  sendSlackAlert(`🚨 *Urgent Approval* — ${approval.title}\n${(approval.content || '').slice(0, 200)}`);
};

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.use(compression());

// CORS allowed origins — front-ends permitted to call this API
const allowedOrigins = [
  'http://localhost:3000',
  'https://aisalesscales.com',
  'https://www.aisalesscales.com',
  'https://api.aisalesscales.com',
  'https://api-staging.aisalesscales.com',
  'https://joinzidni.com',
  'https://www.joinzidni.com',
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin (curl, server-to-server, Twilio/SendGrid webhooks)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// joinzidni.com domain routing — serve the Zidni pages from this platform.
// Only rewrites browser page navigations (GET); API calls, assets, and the
// already-correct /zidni* and /login paths pass straight through.
app.use((req, res, next) => {
  const host = req.hostname || '';
  if (!host.includes('joinzidni.com')) return next();
  if (req.method !== 'GET') return next();
  const p = req.path;
  if (p === '/login' || p === '/zidni' || p.startsWith('/zidni/')) return next();
  if (p.startsWith('/static') || p.includes('.')) return next();
  if (p === '/mahdi') return res.redirect(302, '/zidni/mahdi');
  return res.redirect(302, '/zidni');
});

app.use(express.json({ limit: '50mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// ─── RATE LIMITING ────────────────────────────────────────
// Fix 2: log every rate-limit hit to rate_limit_hits table
const logRateLimitHit = async (req, limiterName) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  try {
    await supabase.from('rate_limit_hits').insert([{ ip, endpoint: `${limiterName}:${req.method} ${req.path}`, created_at: new Date().toISOString() }]);
  } catch {}
};

const makeHandler = (limiterName, msg) => (req, res, next, options) => {
  logRateLimitHit(req, limiterName);
  res.status(options.statusCode).json({ error: msg });
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false,
  handler: makeHandler('general', 'Too many requests, please try again later.'),
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  handler: makeHandler('ai', 'AI team rate limit exceeded. Maximum 20 requests per 15 minutes.'),
});

const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  handler: makeHandler('import', 'Import rate limit exceeded. Maximum 5 imports per hour.'),
});

app.use(generalLimiter);

// Fix 3: response-time logging middleware — only logs requests >500ms
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (ms > 500) {
      (async () => {
        try {
          await supabase.from('request_logs').insert([{
            method: req.method, path: req.path,
            status_code: res.statusCode, response_time_ms: ms,
            created_at: new Date().toISOString(),
          }]);
        } catch {}
      })();
    }
  });
  next();
});

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── JWT MIDDLEWARE ───────────────────────────────────────
const verifyToken = (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── HELPER: AI CALL WITH RAG CONTEXT ────────────────────
const aiCall = async (systemPrompt, userPrompt, context = '') => {
  const fullSystem = context
    ? `${systemPrompt}\n\nRelevant knowledge base context:\n${context}`
    : systemPrompt;
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: fullSystem,
      messages: [{ role: 'user', content: userPrompt }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }
  );
  return response.data.content[0].text;
};

// ─── HELPER: RAG SEARCH ───────────────────────────────────
const ragSearch = async (query, clientId = null) => {
  try {
    const embeddingResponse = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: query.substring(0, 500), model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    const queryEmbedding = embeddingResponse.data.data[0].embedding;

    const allResults = [];

    if (clientId) {
      const { data: clientResults } = await supabase.rpc('search_knowledge_base', {
        query_embedding: queryEmbedding,
        client_id_filter: clientId,
        match_count: 20
      });
      if (clientResults) allResults.push(...clientResults);
    }

    const { data: globalResults } = await supabase.rpc('search_knowledge_base', {
      query_embedding: queryEmbedding,
      client_id_filter: null,
      match_count: 20
    });
    if (globalResults) allResults.push(...globalResults);

    const seen = new Set();
    const combined = allResults.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    combined.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    const top5 = combined.slice(0, 5);
    const vectorText = top5.length > 0
      ? top5.map(r => `${r.title}:\n${r.content?.substring(0, 800)}`).join('\n\n')
      : '';

    // Always surface this client's recent winning content & insights directly,
    // so the AI team references proven templates even before vectors match.
    let winningText = '';
    if (clientId) {
      try {
        const { data: winning } = await supabase
          .from('knowledge_base')
          .select('title, content, source')
          .eq('client_id', clientId)
          .in('source', ['winning_sequence', 'monthly_insight', 'call_transcript'])
          .order('created_at', { ascending: false })
          .limit(5);
        if (winning && winning.length) {
          winningText = 'Client winning content & insights:\n' +
            winning.map(w => `[${w.source}] ${w.title}:\n${(w.content || '').substring(0, 800)}`).join('\n\n');
        }
      } catch (wErr) {
        console.log('Winning-content fetch skipped:', wErr.message);
      }
    }

    return [winningText, vectorText].filter(Boolean).join('\n\n');
  } catch (e) {
    console.log('RAG search skipped:', e.message);
  }
  return '';
};

// ─── HELPER: STORE KNOWLEDGE (feedback loop) ─────────────
// Inserts a knowledge_base row and embeds it in the background so it becomes
// searchable via ragSearch. Fire-and-forget safe — never throws to the caller.
const storeKnowledge = async ({ title, content, source, clientId = null, type = 'reference', notes = null }) => {
  if (!content || !content.trim()) return null;
  try {
    const { data: row, error } = await supabase.from('knowledge_base').insert([{
      title: (title || 'Untitled').substring(0, 200),
      content,
      type,
      source,
      client_id: clientId,
      status: 'trained',
      notes,
      created_at: new Date().toISOString(),
    }]).select('id').single();
    if (error) throw error;
    try {
      const emb = await axios.post(
        'https://api.openai.com/v1/embeddings',
        { input: content.substring(0, 2000), model: 'text-embedding-3-small' },
        { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      await supabase.from('knowledge_base').update({ embedding: emb.data.data[0].embedding }).eq('id', row.id);
    } catch (embErr) {
      console.error('storeKnowledge embed error:', embErr.message);
    }
    return row.id;
  } catch (e) {
    console.error('storeKnowledge error:', e.message);
    return null;
  }
};

// ─── FIX 4: HOT LEAD ENGAGEMENT TAGGER ───────────────────
const checkAndTagHotLead = async (contactId, clientId, newScore) => {
  if ((newScore || 0) < 80) return;
  try {
    const { data: contact } = await supabase.from('contacts').select('tags, first_name, last_name, email').eq('id', contactId).maybeSingle();
    if (!contact) return;
    const tags = contact.tags || [];
    if (tags.includes('hot_lead')) return;
    await supabase.from('contacts').update({ tags: [...tags, 'hot_lead'] }).eq('id', contactId);
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'A contact';
    await storeBriefing('fatima', 'hassan',
      `Hot Lead Detected — ${name}`,
      `A contact reached engagement score ${newScore} and has been tagged as a hot lead.\n\nContact: ${name}\nEmail: ${contact.email || 'N/A'}\nScore: ${newScore}\n\nHighly engaged — prioritize for personalized outreach.`,
      'high', clientId
    ).catch(e => console.error('Hot lead briefing failed:', e.message));
    console.log(`[Engagement] Hot lead tagged: ${name} (score: ${newScore})`);
  } catch (e) {
    console.error('checkAndTagHotLead error:', e.message);
  }
};

// ─── FIX 10: VERIFY CLIENT OWNERSHIP ─────────────────────
const verifyClientOwnership = (req) => {
  if (!req.user) return false;
  return req.user.role === 'owner';
};

// ─── HELPER: TEAM BRIEFINGS CONTEXT ──────────────────────
const getBriefingsContext = async (memberName) => {
  try {
    const { data: briefings } = await supabase
      .from('team_briefings')
      .select('from_member, subject, content, priority, created_at')
      .eq('to_member', memberName)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!briefings || briefings.length === 0) return '';
    const lines = briefings.map(b => {
      const ageHours = Math.round((Date.now() - new Date(b.created_at)) / 3_600_000);
      return `[Briefing from ${b.from_member} — ${b.priority.toUpperCase()} — ${ageHours}h ago]\nSubject: ${b.subject}\n${b.content}`;
    });
    return `Recent team briefings for you:\n${lines.join('\n\n')}`;
  } catch (e) {
    console.log('Briefings context skipped:', e.message);
    return '';
  }
};

// ─── HELPER: GET CLIENT EMAIL SENDER ─────────────────────
const getClientSender = async (clientId) => {
  const fallback = { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' };
  if (!clientId) return fallback;
  try {
    const { data: client } = await supabase.from('clients').select('from_email, from_name').eq('id', clientId).maybeSingle();
    return {
      email: client?.from_email || fallback.email,
      name: client?.from_name || fallback.name,
    };
  } catch {
    return fallback;
  }
};

// ─── HELPER: NOTIFY CLIENT PORTAL USERS BY EMAIL ─────────
// Looks up the client_users for a client and emails them a platform notification.
const notifyClientUser = async (clientId, subject, bodyHtml) => {
  if (!clientId) return;
  try {
    const { data: users } = await supabase.from('client_users').select('email, name').eq('client_id', clientId);
    const recipients = (users || []).map(u => u.email).filter(Boolean);
    if (recipients.length === 0) return;
    const from = { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' };
    await Promise.all(recipients.map(to => sgMail.send({
      to, from, subject,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0a1628;line-height:1.6">${bodyHtml}<p style="margin-top:20px;color:#8896a8;font-size:12px">— Sales Scales</p></div>`,
    }).catch(e => console.error(`notifyClientUser send to ${to} failed:`, e.message))));
  } catch (e) {
    console.error('notifyClientUser error:', e.message);
  }
};

// ─── HELPER: PER-CLIENT TWILIO CREDENTIALS ───────────────
const getClientTwilio = async (clientId) => {
  if (clientId) {
    try {
      const { data: c } = await supabase
        .from('clients')
        .select('twilio_subaccount_sid, twilio_subaccount_token, twilio_phone_number')
        .eq('id', clientId).maybeSingle();
      if (c?.twilio_subaccount_sid && c?.twilio_subaccount_token && c?.twilio_phone_number) {
        return { tc: twilio(c.twilio_subaccount_sid, c.twilio_subaccount_token), from: c.twilio_phone_number };
      }
    } catch {}
  }
  return {
    tc: twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN),
    from: process.env.TWILIO_PHONE_NUMBER,
  };
};

// ─── HELPER: CLIENT CART LINK ────────────────────────────
const getClientCartLink = async (clientId) => {
  if (!clientId) return '';
  try {
    const { data: conn } = await supabase.from('shopify_connections')
      .select('shop').eq('client_id', clientId).maybeSingle();
    if (!conn?.shop) return '';
    return `https://${conn.shop}/cart`;
  } catch {
    return '';
  }
};

// ─── HELPER: RENDER MESSAGE TEMPLATE ─────────────────────
const renderTemplate = (text, contact, cartLink) => {
  if (!text) return text;
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, contact?.first_name || 'there')
    .replace(/\{\{\s*cart_link\s*\}\}/gi, cartLink || '');
};

// ─── HELPER: CLIENT EMAIL BRANDING ───────────────────────
// Returns the store name (logo text) and header brand color for white-label emails.
const getClientBranding = async (clientId) => {
  const fallback = { brandColor: '#0a1628', storeName: '' };
  if (!clientId) return fallback;
  try {
    const [{ data: client }, { data: profile }] = await Promise.all([
      supabase.from('clients').select('name, from_name').eq('id', clientId).maybeSingle(),
      supabase.from('client_profiles').select('brand_color').eq('client_id', clientId).maybeSingle(),
    ]);
    return {
      brandColor: profile?.brand_color || '#0a1628',
      storeName: client?.name || client?.from_name || '',
    };
  } catch {
    return fallback;
  }
};

// ─── FIX 2: EMAIL PLAIN TEXT VERSION ─────────────────────
const buildEmailText = (content) => {
  if (!content) return '';
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// ─── HELPER: WHITE-LABEL HTML EMAIL TEMPLATE ─────────────
// Renders the client's own branded email — no Sales Scales branding is shown to the end customer.
const buildEmailHtml = ({ content, subject, clientName, cartLink, contactName, brandColor = '#0a1628', logoText, contactId, clientId, preheader }) => {
  const store = logoText || clientName || 'Your Store';
  const year = new Date().getFullYear();
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  const unsubUrl = contactId && clientId
    ? `${apiBase}/email/unsubscribe?contact_id=${contactId}&client_id=${clientId}`
    : `${apiBase}/email/unsubscribe`;
  const safe = (content || '').trim();
  const preheaderText = preheader || (safe.slice(0, 100).replace(/<[^>]+>/g, ''));

  const bodyHtml = safe
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 18px;color:#1f2937;font-size:16px;line-height:1.8;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const ctaHtml = cartLink ? `
        <tr><td style="padding:8px 32px 36px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
            <td style="border-radius:12px;background:#c9a84c;box-shadow:0 4px 14px rgba(201,168,76,0.35);">
              <a href="${cartLink}" target="_blank" style="display:inline-block;padding:18px 42px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:#0a1628;text-decoration:none;border-radius:12px;letter-spacing:0.3px;">Complete Your Order →</a>
            </td>
          </tr></table>
        </td></tr>` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${subject || store}</title>
</head>
<body style="margin:0;padding:0;background:#f0f3f8;font-family:Arial,Helvetica,sans-serif;">
  <!-- Preheader text (hidden, shows as email preview in inboxes) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f0f3f8;">${preheaderText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <!-- View in browser -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f3f8;padding:8px 16px 0;">
    <tr><td align="center"><div style="font-size:11px;color:#8896a8;padding:6px 0;">Having trouble viewing this email? <a href="${apiBase}/email/view?contact_id=${contactId || ''}" style="color:#c9a84c;text-decoration:underline;">View in browser</a></div></td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f3f8;padding:16px 16px 32px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(10,22,40,0.10);">
        <tr><td style="background:${brandColor};padding:32px 32px 28px;text-align:center;">
          <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">${store}</div>
          <div style="width:48px;height:3px;background:#c9a84c;border-radius:2px;margin:12px auto 0;"></div>
        </td></tr>
        ${subject ? `<tr><td style="padding:32px 32px 0;"><div style="color:#0a1628;font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-0.3px;">${subject}</div></td></tr>` : ''}
        <tr><td style="padding:24px 32px 8px;">${bodyHtml}</td></tr>
        ${ctaHtml}
        <tr><td style="background:#f8fafc;border-top:1px solid #e4e9f0;padding:24px 32px;text-align:center;">
          <div style="color:#8896a8;font-size:12px;line-height:1.7;">You're receiving this email because you shopped with ${store}.</div>
          <div style="color:#aab4c0;font-size:11px;margin-top:8px;">© ${year} ${store}. All rights reserved.</div>
          <div style="margin-top:12px;"><a href="${unsubUrl}" style="color:#8896a8;font-size:11px;text-decoration:underline;">Unsubscribe</a><span style="color:#d0d7df;margin:0 8px">·</span><a href="/privacy" style="color:#8896a8;font-size:11px;text-decoration:underline;">Privacy Policy</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ─── HELPER: CLIENT KNOWLEDGE BASE CONTEXT ───────────────
const getClientProfile = async (clientId) => {
  if (!clientId) return '';
  try {
    const { data: p } = await supabase.from('client_profiles')
      .select('brand_voice, key_products, faqs, return_policy').eq('client_id', clientId).maybeSingle();
    if (!p) return '';
    const parts = [];
    if (p.brand_voice) parts.push(`Brand voice & tone:\n${p.brand_voice}`);
    if (p.key_products) parts.push(`Key products:\n${p.key_products}`);
    if (p.faqs) parts.push(`Frequently asked questions:\n${p.faqs}`);
    if (p.return_policy) parts.push(`Return / refund policy:\n${p.return_policy}`);
    if (parts.length === 0) return '';
    return `Client knowledge base — use this when writing any content, replies, or sequences for this client:\n${parts.join('\n\n')}`;
  } catch (e) {
    console.log('Client profile context skipped:', e.message);
    return '';
  }
};

// ─── HELPER: KLAVIYO PERFORMANCE CONTEXT ─────────────────
const getKlaviyoContext = async (clientId) => {
  if (!clientId) return '';
  try {
    const { data: client } = await supabase.from('clients').select('klaviyo_api_key').eq('id', clientId).maybeSingle();
    const apiKey = client?.klaviyo_api_key;
    if (!apiKey) return '';
    const headers = { Authorization: `Klaviyo-API-Key ${apiKey}`, revision: '2024-10-15', 'Content-Type': 'application/json' };
    const reportRes = await axios.post('https://a.klaviyo.com/api/campaign-values-reports/', {
      data: {
        type: 'campaign-values-report',
        attributes: {
          timeframe: { key: 'last_30_days' },
          conversion_metric_id: null,
          statistics: ['open_rate', 'click_rate', 'revenue', 'unsubscribe_rate'],
        },
      },
    }, { headers });
    const stats = reportRes.data?.data?.attributes?.results?.[0]?.statistics || {};
    const pct = (v) => v != null ? `${Math.round(v * 100 * 10) / 10}%` : 'n/a';
    return [
      `Live Klaviyo email performance (last 30 days) — reference this real data when writing email content:`,
      `  Open rate: ${pct(stats.open_rate)}`,
      `  Click rate: ${pct(stats.click_rate)}`,
      `  Unsubscribe rate: ${pct(stats.unsubscribe_rate)}`,
      `  Revenue attributed: ${stats.revenue != null ? '$' + Number(stats.revenue).toFixed(2) : 'n/a'}`,
    ].join('\n');
  } catch (e) {
    console.log('Klaviyo context skipped:', e.message);
    return '';
  }
};

// ─── HELPER: ASSESS INBOUND MESSAGE CONFIDENCE ───────────
const assessInboundConfidence = async (channel, content, clientName) => {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `You triage inbound customer messages for an ecommerce brand. Decide whether an AI can safely auto-respond with confidence, or whether a human should handle it. Escalate (not confident) when the message involves: refunds/disputes, complaints, legal/compliance, pricing negotiation, anything angry or sensitive, or anything ambiguous you cannot answer accurately. Respond ONLY with JSON: {"confident": true|false, "reason": "short reason"}.`,
        messages: [{ role: 'user', content: `Channel: ${channel}\nBrand: ${clientName || 'unknown'}\nCustomer message: ${content}` }]
      },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }
    );
    const raw = response.data.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { confident: false, reason: 'Could not assess message' };
    const parsed = JSON.parse(match[0]);
    return { confident: parsed.confident === true, reason: parsed.reason || '' };
  } catch (e) {
    console.log('Inbound assessment failed:', e.message);
    return { confident: false, reason: 'AI assessment unavailable' };
  }
};

// ─── HELPER: SHOPIFY LIVE STORE CONTEXT ──────────────────
const getShopifyContext = async (clientId) => {
  if (!clientId) return '';
  try {
    const { data: conn } = await supabase.from('shopify_connections')
      .select('shop, access_token').eq('client_id', clientId).maybeSingle();
    if (!conn) return '';
    const { shop, access_token } = conn;
    const headers = { 'X-Shopify-Access-Token': access_token, 'Content-Type': 'application/json' };
    const base = `https://${shop}/admin/api/2026-01`;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [recentRes, monthRes, countRes, abandonedRes] = await Promise.all([
      axios.get(`${base}/orders.json?status=any&limit=5&order=created_at+desc`, { headers }),
      axios.get(`${base}/orders.json?status=any&created_at_min=${monthStart}&limit=250`, { headers }),
      axios.get(`${base}/orders/count.json?status=any`, { headers }),
      axios.get(`${base}/checkouts/count.json`, { headers }),
    ]);
    const monthOrders = monthRes.data.orders || [];
    const monthRevenue = monthOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
    const recentLines = (recentRes.data.orders || []).map(o =>
      `  - ${o.name} | ${o.email} | $${o.total_price} | ${o.financial_status} | ${new Date(o.created_at).toLocaleDateString()}`
    );
    return [
      `Live Shopify store data for ${shop}:`,
      `  Total orders (all time): ${countRes.data.count}`,
      `  Orders this month: ${monthOrders.length}`,
      `  Revenue this month: $${monthRevenue.toFixed(2)}`,
      `  Abandoned checkouts: ${abandonedRes.data.count}`,
      `  5 most recent orders:`,
      ...recentLines,
    ].join('\n');
  } catch (e) {
    console.log('Shopify context skipped:', e.message);
    return '';
  }
};

// ─── HELPER: GENERATE ALL CLIENT SEQUENCES VIA MAHDI ─────
const generateAllClientSequences = async (shop, accessToken, clientId) => {
  console.log(`[Mahdi] Starting sequence generation — shop: ${shop}, client: ${clientId}`);
  const hdrs = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };
  const base = `https://${shop}/admin/api/2026-01`;

  let storeName = shop, productList = '', aov = '0';
  try {
    const [productsRes, ordersRes, shopRes] = await Promise.all([
      axios.get(`${base}/products.json?limit=10&fields=id,title,variants`, { headers: hdrs }),
      axios.get(`${base}/orders.json?status=any&limit=50&fields=total_price&financial_status=paid`, { headers: hdrs }),
      axios.get(`${base}/shop.json`, { headers: hdrs }),
    ]);
    const products = productsRes.data.products || [];
    const orders   = ordersRes.data.orders || [];
    storeName   = shopRes.data.shop?.name || shop;
    const total = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
    aov         = orders.length ? (total / orders.length).toFixed(2) : '0';
    productList = products.slice(0, 6).map(p => `${p.title} ($${p.variants?.[0]?.price || '0'})`).join(', ');
    console.log(`[Mahdi] Store data — ${storeName}, ${products.length} products, AOV $${aov}`);
  } catch (e) {
    console.error('[Mahdi] Failed to fetch store data:', e.message);
    return;
  }

  const storeCtx   = `Store: ${storeName}\nProducts: ${productList}\nAverage order value: $${aov}`;
  const mahdiSys   = `You are Mahdi, the Marketing and Content AI at Sales Scales. Return ONLY valid JSON. Short sentences, no exclamation marks, reference real product names. Use {{first_name}}.`;
  const parseEmails = (raw) => {
    try {
      const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const m = clean.match(/\{[\s\S]*\}/);
      return (JSON.parse(m ? m[0] : clean).emails || []).slice(0, 3);
    } catch { return []; }
  };

  const queueApproval = async (type, title, body, steps, trigger) => {
    try {
      await supabase.from('approvals').insert([{
        type, title, content: body,
        metadata: { steps, trigger_type: trigger, shop, aov },
        from_member: 'mahdi', client_id: clientId,
        priority: 'normal', status: 'pending',
        created_at: new Date().toISOString(),
      }]);
      console.log(`[Mahdi] Approval queued: ${title}`);
    } catch (e) {
      console.error(`[Mahdi] Approval insert failed (${title}):`, e.message);
    }
  };

  const createWorkflow = async (name, trigger, steps) => {
    const { data: wf, error } = await supabase.from('workflows').insert([{
      name, client_id: clientId, trigger_type: trigger, status: 'paused', enrolled_count: 0,
    }]).select('id').single();
    if (error || !wf) { console.error(`[Mahdi] Workflow insert failed (${name}):`, error?.message); return; }
    const rows = steps.map((s, i) => ({
      workflow_id: wf.id, step_order: i + 1,
      step_type: s.step_type, content: s.content || '',
      subject: s.subject || '', wait_hours: s.wait_hours || 0,
    }));
    if (rows.length) {
      const { error: stepErr } = await supabase.from('workflow_steps').insert(rows);
      if (stepErr) console.error('[Mahdi] workflow_steps insert failed:', stepErr.message);
    }
    console.log(`[Mahdi] Workflow saved: "${name}" — ${rows.length} steps`);
  };

  const buildSteps = (emails, waits) =>
    emails.flatMap((e, i) => {
      const out = [];
      if (waits[i]) out.push({ step_type: 'wait', content: '', wait_hours: waits[i] });
      out.push({ step_type: 'email', subject: e.subject || '', content: e.content || '', wait_hours: 0 });
      return out;
    });

  const SEQUENCES = [
    {
      key: 'cart_recovery',
      trigger: 'cart_abandoned',
      name: `Cart Recovery — ${storeName}`,
      approvalTitle: `Cart Recovery Emails (3) — ${storeName}`,
      approvalBody: `Mahdi built a 3-email cart recovery sequence for ${storeName}. AOV: $${aov}. Approve to activate.`,
      waits: [1, 23, 48],
      prompt: `Write 3 cart recovery emails.\n\n${storeCtx}\n\nEmail 1 (1h after abandonment): urgency — cart is waiting\nEmail 2 (24h later): social proof — reviews and bestseller status\nEmail 3 (72h later): final nudge\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."}]}\nUnder 120 words each. Reference product names.`,
    },
    {
      key: 'lead_nurture',
      trigger: 'new_contact',
      name: `Lead Nurture — ${storeName}`,
      approvalTitle: `Lead Nurture Emails (3) — ${storeName}`,
      approvalBody: `Mahdi built a 3-email welcome nurture sequence for new ${storeName} subscribers. Approve to activate.`,
      waits: [0, 72, 96],
      prompt: `Write 3 lead nurture welcome emails for new subscribers.\n\n${storeCtx}\n\nEmail 1 (immediately): warm welcome, introduce brand story\nEmail 2 (3 days): spotlight your best product and key benefits\nEmail 3 (7 days): social proof and first-purchase encouragement\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."}]}\nUnder 120 words each.`,
    },
    {
      key: 'win_back',
      trigger: 'lapsed_customer',
      name: `Win-Back — ${storeName}`,
      approvalTitle: `Win-Back Emails (3) — ${storeName}`,
      approvalBody: `Mahdi built a 3-email win-back sequence for lapsed ${storeName} customers. Approve to activate.`,
      waits: [0, 72, 96],
      prompt: `Write 3 win-back emails for customers who haven't purchased in 60+ days.\n\n${storeCtx}\n\nEmail 1 (immediately): personal "we miss you", no pressure\nEmail 2 (3 days): new arrivals or bestsellers since their last visit\nEmail 3 (7 days): last attempt, exclusivity angle\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."}]}\nUnder 120 words each.`,
    },
    {
      key: 'post_purchase',
      trigger: 'purchase_made',
      name: `Post-Purchase — ${storeName}`,
      approvalTitle: `Post-Purchase Emails (3) — ${storeName}`,
      approvalBody: `Mahdi built a 3-email post-purchase sequence for ${storeName}. Approve to activate.`,
      waits: [24, 144, 336],
      prompt: `Write 3 post-purchase follow-up emails.\n\n${storeCtx}\n\nEmail 1 (1 day after purchase): thank you, set expectations\nEmail 2 (7 days): check-in, invite review\nEmail 3 (21 days): upsell or cross-sell a complementary product\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."}]}\nUnder 120 words each.`,
    },
  ];

  const done = [];
  for (const seq of SEQUENCES) {
    try {
      const raw   = await aiCall(mahdiSys, seq.prompt, '');
      const steps = buildSteps(parseEmails(raw), seq.waits);
      if (steps.length === 0) { console.warn(`[Mahdi] No steps parsed for ${seq.key}`); continue; }
      await Promise.all([
        createWorkflow(seq.name, seq.trigger, steps),
        queueApproval('email_sequence', seq.approvalTitle, seq.approvalBody, steps, seq.trigger),
      ]);
      done.push(seq.key);
    } catch (e) {
      console.error(`[Mahdi] ${seq.key} generation failed:`, e.message);
    }
  }
  console.log(`[Mahdi] Generation complete for ${storeName} — sequences: ${done.join(', ') || 'none'}`);

  if (done.length > 0 && clientId) {
    await createClientNotification(
      clientId,
      'Your sequences are ready to review',
      `Mahdi built ${done.length} personalised sequence${done.length !== 1 ? 's' : ''} for ${storeName} — cart recovery, lead nurture, win-back, and post-purchase. Go to Approvals to review and activate them.`,
      'success'
    );
    console.log(`[Mahdi] Client notification sent for ${clientId}`);
  }
};

// ─── HELPER: ENROLL CONTACT IN WORKFLOW ──────────────────
const enrollContactInWorkflow = async (workflowId, contactId, clientId, contactEmail, contactPhone, contactName) => {
  // Fix 6: check contact blacklist before enrolling
  if (contactEmail) {
    const { data: blacklisted } = await supabase.from('contact_blacklist')
      .select('id').eq('email', contactEmail.toLowerCase().trim())
      .or(`client_id.eq.${clientId},client_id.is.null`).maybeSingle();
    if (blacklisted) {
      console.log(`[Blacklist] Skipping enrollment: ${contactEmail} is blacklisted`);
      return null;
    }
  }

  const { data: steps } = await supabase.from('workflow_steps')
    .select('*').eq('workflow_id', workflowId).order('step_order');
  if (!steps || steps.length === 0) return null;

  const { data: existing } = await supabase.from('workflow_enrollments')
    .select('id').eq('workflow_id', workflowId).eq('contact_id', contactId).eq('status', 'active').maybeSingle();
  if (existing) return null;

  const { data: enrollment } = await supabase.from('workflow_enrollments').insert([{
    workflow_id: workflowId, contact_id: contactId, client_id: clientId,
    status: 'active', current_step: 1,
    enrolled_at: new Date().toISOString(), next_step_at: new Date().toISOString()
  }]).select().single();

  if (!enrollment) return null;

  const firstStep = steps[0];
  if (firstStep.step_type !== 'wait' && firstStep.content) {
    if (firstStep.step_type === 'sms' && contactPhone) {
      const { tc: twilioClient, from: twilioFrom } = await getClientTwilio(clientId);
      await twilioClient.messages.create({
        body: firstStep.content.replace('{{first_name}}', contactName || 'there'),
        from: twilioFrom, to: contactPhone
      });
    } else if (firstStep.step_type === 'whatsapp' && contactPhone) {
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twilioClient.messages.create({
        body: firstStep.content.replace('{{first_name}}', contactName || 'there'),
        from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
        to: 'whatsapp:' + contactPhone
      });
    } else if (firstStep.step_type === 'email' && contactEmail) {
      const sender = await getClientSender(clientId);
      await sgMail.send({
        to: contactEmail,
        from: sender,
        subject: firstStep.subject || 'Message for you',
        html: `<p>${firstStep.content.replace('{{first_name}}', contactName || 'there')}</p>`
      });
    }
    await supabase.from('messages').insert([{
      client_id: clientId, contact_id: contactId,
      channel: firstStep.step_type, direction: 'outbound',
      sender_name: 'Sales Scales AI', content: firstStep.content, status: 'sent'
    }]);
  }
  await supabase.from('workflow_enrollments').update({ current_step: 2 }).eq('id', enrollment.id);
  return enrollment;
};

// ─── HELPER: PROCESS SHOPIFY WEBHOOK EVENT ───────────────
const TOPIC_TRIGGER_MAP = {
  'checkouts/create': 'cart_abandoned',
  'orders/create': 'order_placed',
  'orders/fulfilled': 'order_fulfilled',
};

const processWebhookEvent = async (topic, shop, payload) => {
  let webhookSuccess = true;
  let webhookError = null;
  const { data: connection } = await supabase
    .from('shopify_connections').select('*').eq('shop', shop).single();
  if (!connection) {
    console.log('No Shopify connection for shop:', shop);
    logWebhook(shop, topic, false, 'No Shopify connection found').catch(() => {});
    return;
  }

  const clientId = connection.client_id;

  let triggerType = TOPIC_TRIGGER_MAP[topic] || null;
  let customerData = null;

  if (topic === 'checkouts/create') {
    if (!payload.email) return;
    customerData = {
      email: payload.email,
      first_name: payload.billing_address?.first_name || payload.shipping_address?.first_name || '',
      last_name: payload.billing_address?.last_name || payload.shipping_address?.last_name || '',
      phone: payload.phone || ''
    };
  } else if (topic === 'orders/create' || topic === 'orders/fulfilled') {
    customerData = payload.customer;
  } else if (topic === 'orders/updated') {
    const failedStatuses = ['pending', 'partially_paid', 'voided'];
    if (!failedStatuses.includes(payload.financial_status)) return;
    triggerType = 'payment_failed';
    customerData = payload.customer;
  }

  if (!customerData || !customerData.email || !triggerType) return;

  let { data: contact } = await supabase.from('contacts')
    .select('*').eq('email', customerData.email).eq('client_id', clientId).maybeSingle();

  if (!contact) {
    // Fix 4: detect timezone from shipping country
    const countryCode = payload.shipping_address?.country_code
      || payload.billing_address?.country_code
      || customerData.default_address?.country_code || null;
    const detectedTz = countryCode ? (COUNTRY_TIMEZONE[countryCode] || null) : null;
    const { data: newContact } = await supabase.from('contacts').insert([{
      first_name: customerData.first_name || '',
      last_name: customerData.last_name || '',
      email: customerData.email,
      phone: customerData.phone || customerData.default_address?.phone || '',
      source: 'Shopify', channel: 'Email',
      pipeline_stage: 'New Lead',
      client_id: clientId,
      shopify_customer_id: customerData.id?.toString() || null,
      timezone: detectedTz,
      last_activity: new Date().toISOString()
    }]).select().single();
    contact = newContact;
  } else {
    // Duplicate detected — update stale fields without overwriting existing data
    const updates = { last_activity: new Date().toISOString() };
    if (customerData.phone && !contact.phone) updates.phone = customerData.phone;
    if (customerData.first_name && !contact.first_name) updates.first_name = customerData.first_name;
    if (customerData.id && !contact.shopify_customer_id) updates.shopify_customer_id = customerData.id.toString();
    await supabase.from('contacts').update(updates).eq('id', contact.id);
    contact = { ...contact, ...updates };
  }

  if (!contact) return;

  // On purchase: complete all active sequences before enrolling in post-purchase flow
  if (topic === 'orders/create') {
    const now = new Date().toISOString();
    const { data: active } = await supabase.from('workflow_enrollments')
      .update({ status: 'completed', completed_at: now })
      .eq('contact_id', contact.id).eq('client_id', clientId).eq('status', 'active')
      .select('id');
    const unenrolledCount = active?.length || 0;
    if (unenrolledCount > 0) {
      await supabase.from('activity').insert([{
        contact_id: contact.id, client_id: clientId,
        type: 'unenrolled',
        description: `Unenrolled from ${unenrolledCount} active sequence${unenrolledCount !== 1 ? 's' : ''} — customer purchased`,
        created_at: now,
      }]);
      console.log(`Purchase unenroll: ${contact.email} removed from ${unenrolledCount} sequence(s)`);
    }

    // Fix 9: tag as converted on purchase
    try {
      const purchaseTags = contact.tags || [];
      if (!purchaseTags.includes('converted')) {
        await supabase.from('contacts').update({ tags: [...purchaseTags.filter(t => t !== 'did_not_convert'), 'converted'] }).eq('id', contact.id);
      }
    } catch (tagErr) { console.error('Purchase tag error:', tagErr.message); }

    // Fix 4: engagement score +50 for Shopify purchase
    try {
      const purchaseScore = (contact.engagement_score || 0) + 50;
      await supabase.from('contacts').update({ engagement_score: purchaseScore }).eq('id', contact.id);
      await checkAndTagHotLead(contact.id, clientId, purchaseScore);
    } catch (scoreErr) { console.error('Purchase engagement score error:', scoreErr.message); }

    // Fix 6: VIP detection — 3+ orders → tag contact + generate VIP sequence
    const orderCount = payload.customer?.orders_count || 0;
    if (orderCount >= 3) {
      const existingTags = contact.tags || [];
      if (!existingTags.includes('vip')) {
        await supabase.from('contacts').update({ tags: [...existingTags, 'vip'] }).eq('id', contact.id);
        const { data: shopClient } = await supabase.from('clients').select('name, niche').eq('id', clientId).maybeSingle();
        const vipSeqJson = await aiCall(
          `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown.`,
          `Write a 2-email VIP appreciation sequence for a loyal customer of ${shopClient?.name || 'the store'} (${shopClient?.niche || 'ecommerce'}) who has just placed their ${orderCount}th order.\n\nEmail 1: Thank you + exclusive offer just for them\nEmail 2: Loyalty reward — early access, bonus, or gift\n\nReturn JSON: {"steps":[{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":72},{"step_type":"email","subject":"...","content":"...","wait_hours":0}]}`
        );
        let vipParsed = { steps: [] };
        try { const v = vipSeqJson.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim(); const vm = v.match(/\{[\s\S]*\}/); vipParsed = JSON.parse(vm ? vm[0] : v); } catch {}
        await supabase.from('approvals').insert([{
          type: 'email_sequence', title: `VIP Sequence — ${contact.first_name || contact.email} (${orderCount} orders)`,
          content: `Customer has placed ${orderCount} orders and has been tagged as VIP. Approve to send VIP appreciation sequence.`,
          metadata: { steps: vipParsed.steps || [], trigger_type: 'manual', contact_id: contact.id, vip: true },
          from_member: 'mahdi', client_id: clientId, priority: 'high', status: 'pending', created_at: now,
        }]);
        console.log(`VIP: ${contact.email} tagged + VIP sequence submitted (${orderCount} orders)`);
      }
    }

    // Fix 7: Post-purchase upsell — 3-day delayed sequence based on what they bought
    try {
      const productNames = (payload.line_items || []).slice(0, 3).map(li => li.title || li.name).filter(Boolean).join(', ');
      const { data: shopClient7 } = await supabase.from('clients').select('name, niche').eq('id', clientId).maybeSingle();
      const upsellJson = await aiCall(
        `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown.`,
        `Write a 2-email post-purchase upsell sequence for a customer who just bought: ${productNames || 'a product'} from ${shopClient7?.name || 'the store'} (${shopClient7?.niche || 'ecommerce'}).\n\nEmail 1 (sent 3 days after purchase): Product care tips + how to get the most from their purchase. Warm, helpful tone.\nEmail 2 (5 days after purchase): Recommend a complementary product that pairs well with what they bought.\n\nReturn JSON: {"steps":[{"step_type":"wait","content":"","wait_hours":72},{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":48},{"step_type":"email","subject":"...","content":"...","wait_hours":0}]}`
      );
      let upsellParsed = { steps: [] };
      try { const u = upsellJson.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim(); const um = u.match(/\{[\s\S]*\}/); upsellParsed = JSON.parse(um ? um[0] : u); } catch {}
      await supabase.from('approvals').insert([{
        type: 'email_sequence', title: `Post-Purchase Upsell — ${contact.first_name || contact.email}`,
        content: `Purchased: ${productNames || 'product'}. Approve to start a 2-email post-purchase upsell — starts with a 3-day wait then product care + complementary product emails.`,
        metadata: { steps: upsellParsed.steps || [], trigger_type: 'order_placed', contact_id: contact.id, products: productNames },
        from_member: 'mahdi', client_id: clientId, priority: 'normal', status: 'pending', created_at: now,
      }]);
      console.log(`Post-purchase upsell submitted for ${contact.email}`);
    } catch (upsellErr) {
      console.error('Post-purchase upsell failed:', upsellErr.message);
    }
  }

  const { data: workflows } = await supabase.from('workflows')
    .select('*').eq('client_id', clientId).eq('trigger_type', triggerType).eq('status', 'active');

  if (!workflows || workflows.length === 0) {
    console.log(`No active ${triggerType} workflow for client ${clientId}`);
    return;
  }

  const workflow = workflows[0];
  await enrollContactInWorkflow(workflow.id, contact.id, clientId, contact.email, contact.phone, contact.first_name);

  await supabase.from('activity').insert([{
    contact_id: contact.id, client_id: clientId,
    type: 'webhook_trigger',
    description: `Shopify webhook: ${triggerType.replace(/_/g, ' ')} — enrolled in "${workflow.name}"`,
    created_at: new Date().toISOString()
  }]);

  sendSlackAlert(`🛒 *Shopify webhook* — ${topic.replace('/', ': ')} | ${contact.email} → "${workflow.name}"`);
  console.log(`Webhook processed: ${contact.email} → ${triggerType} → ${workflow.name}`);
  logWebhook(shop, topic, true, null).catch(() => {});
};

// ─── HELPER: PIPELINE STAGE AUTO-PROGRESSION ─────────────
const PIPELINE_PROGRESSION = { 'New Lead': 'Engaged', 'Engaged': 'Qualified' };

const advancePipelineStage = async (contactId) => {
  try {
    const { data: contact } = await supabase.from('contacts')
      .select('id, pipeline_stage').eq('id', contactId).maybeSingle();
    if (!contact) return;
    const next = PIPELINE_PROGRESSION[contact.pipeline_stage];
    if (!next) return;
    await supabase.from('contacts').update({ pipeline_stage: next }).eq('id', contactId);
    console.log(`Pipeline: contact ${contactId} → ${next}`);
  } catch (e) {
    console.error('advancePipelineStage error:', e.message);
  }
};

// ─── SCHEDULER ────────────────────────────────────────────
cron.schedule('*/15 * * * *', async () => {
  console.log('Scheduler running — checking pending workflow steps...');
  try {
    const now = new Date().toISOString();

    // Fix 7: activate scheduled workflows whose scheduled_start has arrived
    // SQL: ALTER TABLE workflows ADD COLUMN IF NOT EXISTS scheduled_start timestamptz;
    const { data: scheduledWfs } = await supabase.from('workflows')
      .select('id, name').eq('status', 'scheduled').lte('scheduled_start', now);
    if (scheduledWfs && scheduledWfs.length > 0) {
      for (const wf of scheduledWfs) {
        await supabase.from('workflows').update({ status: 'active' }).eq('id', wf.id);
        console.log(`[Scheduler] Activated scheduled workflow: ${wf.name}`);
      }
    }
    const { data: enrollments } = await supabase
      .from('workflow_enrollments')
      .select('*')
      .eq('status', 'active')
      .lte('next_step_at', now);

    if (!enrollments || enrollments.length === 0) {
      console.log('No pending steps found');
      return;
    }

    console.log(`Found ${enrollments.length} enrollments to process`);

    for (const enrollment of enrollments) {
      const { data: steps } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('workflow_id', enrollment.workflow_id)
        .order('step_order');

      if (!steps || steps.length === 0) continue;

      const currentStep = steps[enrollment.current_step - 1];
      if (!currentStep) {
        await supabase.from('workflow_enrollments')
          .update({ status: 'completed', completed_at: now })
          .eq('id', enrollment.id);
        continue;
      }

      const { data: contact } = await supabase
        .from('contacts').select('*').eq('id', enrollment.contact_id).single();

      if (!contact) continue;

      // Fix 9: skip_next_step tag — manual branch control
      if (Array.isArray(contact.tags) && contact.tags.includes('skip_next_step')) {
        const newTags = contact.tags.filter(t => t !== 'skip_next_step');
        await supabase.from('contacts').update({ tags: newTags }).eq('id', contact.id);
        const nextStepRef = steps[enrollment.current_step];
        const skipAt = new Date();
        if (nextStepRef && nextStepRef.step_type === 'wait') skipAt.setHours(skipAt.getHours() + (nextStepRef.wait_hours || 1));
        await supabase.from('workflow_enrollments').update({ current_step: enrollment.current_step + 1, next_step_at: skipAt.toISOString() }).eq('id', enrollment.id);
        console.log(`Step skipped for ${contact.first_name} — skip_next_step tag removed`);
        continue;
      }

      const cartLink = await getClientCartLink(enrollment.client_id);

      // Fix 4: timezone-aware send window (9am–8pm contact local time)
      if (contact.timezone && ['sms', 'whatsapp', 'email'].includes(currentStep.step_type)) {
        const hour = localHourInTz(contact.timezone);
        if (hour !== null && (hour < 9 || hour >= 20)) {
          const delayUntil = nextSendWindowAt(contact.timezone);
          await supabase.from('workflow_enrollments').update({ next_step_at: delayUntil }).eq('id', enrollment.id);
          console.log(`Send delayed for ${contact.first_name} (${contact.timezone}, hour ${hour}) — next window: ${delayUntil}`);
          continue;
        }
      }

      if (currentStep.step_type === 'wait') {
        const nextStepAt = new Date();
        nextStepAt.setHours(nextStepAt.getHours() + (currentStep.wait_hours || 1));
        await supabase.from('workflow_enrollments').update({
          current_step: enrollment.current_step + 1,
          next_step_at: nextStepAt.toISOString()
        }).eq('id', enrollment.id);
        console.log(`Wait step processed for ${contact.first_name}`);

      } else if (currentStep.step_type === 'sms' && contact.phone && currentStep.content) {
        // Fix 1: skip SMS for opted-out contacts
        if (Array.isArray(contact.tags) && contact.tags.includes('opted_out_sms')) {
          const skipNext = steps[enrollment.current_step];
          const skipAt = new Date();
          if (skipNext && skipNext.step_type === 'wait') skipAt.setHours(skipAt.getHours() + (skipNext.wait_hours || 1));
          await supabase.from('workflow_enrollments').update({ current_step: enrollment.current_step + 1, next_step_at: skipAt.toISOString() }).eq('id', enrollment.id);
          console.log(`SMS skipped — ${contact.first_name} has opted out of SMS`);
          continue;
        }
        let stepFailed = false, failureMsg = '';
        try {
          const { tc: twilioClient, from: twilioFrom } = await getClientTwilio(enrollment.client_id);
          await twilioClient.messages.create({
            body: renderTemplate(currentStep.content, contact, cartLink),
            from: twilioFrom,
            to: contact.phone
          });
          console.log(`SMS sent to ${contact.first_name} — step ${enrollment.current_step}`);
        } catch (e) {
          console.error('SMS step error:', e.message);
          stepFailed = true; failureMsg = e.message;
        }
        if (stepFailed) {
          const newRetry = (enrollment.retry_count || 0) + 1;
          if (newRetry < 3) {
            await supabase.from('workflow_enrollments').update({ retry_count: newRetry, next_step_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }).eq('id', enrollment.id);
            console.log(`SMS step failed for ${contact.first_name} — retry ${newRetry}/3 in 30min`);
          } else {
            await supabase.from('workflow_enrollments').update({ status: 'cancelled', failure_reason: `SMS failed after 3 attempts: ${failureMsg}` }).eq('id', enrollment.id);
            console.log(`SMS permanently failed for ${contact.first_name} — enrollment cancelled`);
          }
        } else {
          const nextStep = steps[enrollment.current_step];
          const nextStepAt = new Date();
          if (nextStep && nextStep.step_type === 'wait') {
            nextStepAt.setHours(nextStepAt.getHours() + (nextStep.wait_hours || 1));
          }
          await supabase.from('workflow_enrollments').update({
            current_step: enrollment.current_step + 1,
            next_step_at: nextStepAt.toISOString(),
            retry_count: 0,
          }).eq('id', enrollment.id);
          await supabase.from('messages').insert([{
            client_id: enrollment.client_id,
            contact_id: enrollment.contact_id,
            channel: 'sms', direction: 'outbound',
            sender_name: 'Sales Scales AI',
            content: currentStep.content, status: 'sent'
          }]);
        }

      } else if (currentStep.step_type === 'whatsapp' && contact.phone && currentStep.content) {
        // Fix 1: check whatsapp_enabled on client before sending
        const { data: clientWa } = await supabase.from('clients').select('whatsapp_enabled').eq('id', enrollment.client_id).maybeSingle();
        if (!clientWa?.whatsapp_enabled) {
          await supabase.from('messages').insert([{
            client_id: enrollment.client_id,
            contact_id: enrollment.contact_id,
            channel: 'WhatsApp', direction: 'outbound',
            sender_name: 'Sales Scales AI',
            content: currentStep.content, status: 'whatsapp_pending'
          }]);
          const waSkipNext = steps[enrollment.current_step];
          const waSkipAt = new Date();
          if (waSkipNext && waSkipNext.step_type === 'wait') waSkipAt.setHours(waSkipAt.getHours() + (waSkipNext.wait_hours || 1));
          await supabase.from('workflow_enrollments').update({ current_step: enrollment.current_step + 1, next_step_at: waSkipAt.toISOString() }).eq('id', enrollment.id);
          console.log(`WhatsApp skipped (not enabled) for ${contact.first_name} — logged as whatsapp_pending`);
          continue;
        }
        let stepFailed = false, failureMsg = '';
        try {
          const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await twilioClient.messages.create({
            body: renderTemplate(currentStep.content, contact, cartLink),
            from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
            to: 'whatsapp:' + contact.phone
          });
          console.log(`WhatsApp sent to ${contact.first_name} — step ${enrollment.current_step}`);
        } catch (e) {
          console.error('WhatsApp step error:', e.message);
          stepFailed = true; failureMsg = e.message;
        }
        if (stepFailed) {
          const newRetry = (enrollment.retry_count || 0) + 1;
          if (newRetry < 3) {
            await supabase.from('workflow_enrollments').update({ retry_count: newRetry, next_step_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }).eq('id', enrollment.id);
            console.log(`WhatsApp step failed for ${contact.first_name} — retry ${newRetry}/3 in 30min`);
          } else {
            await supabase.from('workflow_enrollments').update({ status: 'cancelled', failure_reason: `WhatsApp failed after 3 attempts: ${failureMsg}` }).eq('id', enrollment.id);
            console.log(`WhatsApp permanently failed for ${contact.first_name} — enrollment cancelled`);
          }
        } else {
          const nextStep = steps[enrollment.current_step];
          const nextStepAt = new Date();
          if (nextStep && nextStep.step_type === 'wait') {
            nextStepAt.setHours(nextStepAt.getHours() + (nextStep.wait_hours || 1));
          }
          await supabase.from('workflow_enrollments').update({
            current_step: enrollment.current_step + 1,
            next_step_at: nextStepAt.toISOString(),
            retry_count: 0,
          }).eq('id', enrollment.id);
          await supabase.from('messages').insert([{
            client_id: enrollment.client_id,
            contact_id: enrollment.contact_id,
            channel: 'WhatsApp', direction: 'outbound',
            sender_name: 'Sales Scales AI',
            content: currentStep.content, status: 'sent'
          }]);
        }

      } else if (currentStep.step_type === 'email' && contact.email && currentStep.content) {
        let stepFailed = false, failureMsg = '';
        try {
          const sender = await getClientSender(enrollment.client_id);
          const branding = await getClientBranding(enrollment.client_id);
          const emailSubject = renderTemplate(currentStep.subject || 'Message for you', contact, cartLink);
          const emailContent = renderTemplate(currentStep.content, contact, cartLink);
          await sgMail.send({
            to: contact.email,
            from: sender,
            subject: emailSubject,
            text: buildEmailText(emailContent),
            html: buildEmailHtml({
              content: emailContent,
              subject: emailSubject,
              clientName: branding.storeName || sender.name,
              cartLink,
              contactName: contact.first_name,
              brandColor: branding.brandColor,
              logoText: branding.storeName,
              contactId: contact.id,
              clientId: enrollment.client_id,
            })
          });
          console.log(`Email sent to ${contact.first_name} — step ${enrollment.current_step}`);
          // Fix 5: cross-sell at day 14 of post_purchase workflow — generate approval once
          const daysSinceEnroll = enrollment.enrolled_at ? Math.floor((Date.now() - new Date(enrollment.enrolled_at)) / 86400000) : 0;
          if (daysSinceEnroll >= 14) {
            (async () => {
              try {
                const { data: wf } = await supabase.from('workflows').select('trigger_type, name').eq('id', enrollment.workflow_id).maybeSingle();
                if (wf?.trigger_type === 'post_purchase') {
                  const { count } = await supabase.from('approvals').select('id', { count: 'exact', head: true })
                    .eq('client_id', enrollment.client_id)
                    .contains('metadata', { enrollment_id: enrollment.id });
                  if (!count || count === 0) {
                    const { data: cl } = await supabase.from('clients').select('id, name, niche').eq('id', enrollment.client_id).maybeSingle();
                    if (cl) await generateCrossSellApproval(enrollment, contact, cl);
                  }
                }
              } catch (csErr) { console.error('[cross-sell] Scheduler check error:', csErr.message); }
            })();
          }
        } catch (e) {
          console.error('Email step error:', e.message);
          stepFailed = true; failureMsg = e.message;
        }
        if (stepFailed) {
          const newRetry = (enrollment.retry_count || 0) + 1;
          if (newRetry < 3) {
            await supabase.from('workflow_enrollments').update({ retry_count: newRetry, next_step_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }).eq('id', enrollment.id);
            console.log(`Email step failed for ${contact.first_name} — retry ${newRetry}/3 in 30min`);
          } else {
            await supabase.from('workflow_enrollments').update({ status: 'cancelled', failure_reason: `Email failed after 3 attempts: ${failureMsg}` }).eq('id', enrollment.id);
            console.log(`Email permanently failed for ${contact.first_name} — enrollment cancelled`);
          }
        } else {
          const nextStep = steps[enrollment.current_step];
          const nextStepAt = new Date();
          if (nextStep && nextStep.step_type === 'wait') {
            nextStepAt.setHours(nextStepAt.getHours() + (nextStep.wait_hours || 1));
          }
          await supabase.from('workflow_enrollments').update({
            current_step: enrollment.current_step + 1,
            next_step_at: nextStepAt.toISOString(),
            retry_count: 0,
          }).eq('id', enrollment.id);
          await supabase.from('messages').insert([{
            client_id: enrollment.client_id,
            contact_id: enrollment.contact_id,
            channel: 'email', direction: 'outbound',
            sender_name: 'Sales Scales AI',
            content: currentStep.content, status: 'sent'
          }]);
        }

      } else if (currentStep.step_type === 'set_tag' && currentStep.content) {
        // Fix 9: set_tag step — add tag to contact
        const tagToSet = currentStep.content.trim();
        const existingTags = contact.tags || [];
        if (!existingTags.includes(tagToSet)) {
          await supabase.from('contacts').update({ tags: [...existingTags, tagToSet] }).eq('id', contact.id);
        }
        const tagNext = steps[enrollment.current_step];
        const tagAt = new Date();
        if (tagNext && tagNext.step_type === 'wait') tagAt.setHours(tagAt.getHours() + (tagNext.wait_hours || 1));
        await supabase.from('workflow_enrollments').update({ current_step: enrollment.current_step + 1, next_step_at: tagAt.toISOString() }).eq('id', enrollment.id);
        console.log(`Tag '${tagToSet}' set on ${contact.first_name}`);

      } else {
        const nextStepAt = new Date();
        await supabase.from('workflow_enrollments').update({
          current_step: enrollment.current_step + 1,
          next_step_at: nextStepAt.toISOString()
        }).eq('id', enrollment.id);
      }

      if (enrollment.current_step >= steps.length) {
        await supabase.from('workflow_enrollments')
          .update({ status: 'completed', completed_at: now })
          .eq('id', enrollment.id);
        console.log(`Enrollment completed for ${contact.first_name}`);
        await advancePipelineStage(contact.id);
        // Fix 9: tag contact based on conversion status
        try {
          const existingTags = contact.tags || [];
          const converted = contact.pipeline_stage === 'Converted' || existingTags.includes('vip') || existingTags.includes('converted');
          const newTag = converted ? 'converted' : 'did_not_convert';
          if (!existingTags.includes(newTag)) {
            await supabase.from('contacts').update({ tags: [...existingTags, newTag] }).eq('id', contact.id);
          }
        } catch (tagErr) { console.error('Completion tag error:', tagErr.message); }
        const contactLabel = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || 'a contact';
        await notifyClientUser(
          enrollment.client_id,
          'A sequence just completed',
          `<p>Good news — an automated sequence has finished running for <strong>${contactLabel}</strong>.</p><p>Log in to your Sales Scales portal to see the results.</p>`
        );
        createClientNotification(
          enrollment.client_id,
          'Sequence completed',
          `An automated sequence finished running for ${contactLabel}`,
          'sequence'
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Scheduler error:', e.message);
  }
});

// ─── HELPER: STORE TEAM BRIEFING ─────────────────────────
const storeBriefing = async (from_member, to_member, subject, content, priority = 'normal', client_id = null, contact_id = null) => {
  const { error } = await supabase.from('team_briefings').insert([{
    from_member, to_member, subject, content,
    priority, client_id, contact_id: contact_id || null, is_read: false,
    created_at: new Date().toISOString()
  }]);
  if (error) throw new Error(`storeBriefing failed: ${error.message}`);
  if (priority === 'urgent') {
    try {
      const preview = content.length > 400 ? content.substring(0, 400) + '...' : content;
      await sgMail.send({
        to: 'yousef@salesscales.com',
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
        subject: `Urgent Alert: ${subject}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0;border-left:4px solid #dc2626;">
            <div style="color:#dc2626;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Urgent Alert — Sales Scales</div>
            <div style="color:white;font-size:16px;font-weight:600;">${subject}</div>
          </div>
          <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px;">
            <p style="color:#4a5568;font-size:13px;margin:0 0 12px;">Fatima has flagged an urgent issue that requires your immediate attention.</p>
            <div style="background:#f8fafc;border-radius:6px;padding:14px;font-size:12px;color:#0a1628;line-height:1.7;white-space:pre-wrap;">${preview}</div>
            <p style="color:#8896a8;font-size:11px;margin:14px 0 0;">Log in to Sales Scales → Team Briefings to view the full briefing and respond.</p>
          </div>
        </div>`,
      });
    } catch (mailErr) {
      console.error('Urgent briefing email failed:', mailErr.message);
    }
  }
};

// ─── HELPER: REFUND / RETURN AUTO-HANDLING ───────────────
const handleBrandDeal = async (channel, contact, body) => {
  if (!/\b(deal|partner|collab|sponsor|collaborat|opportunit|work together|campaign|brand)\b/i.test(body || '')) return;
  createClientNotification(
    contact.client_id,
    'Brand deal inquiry',
    `${contact.first_name || 'A contact'} may have sent a deal or partnership inquiry via ${channel}`,
    'deal'
  ).catch(() => {});
};

const handleRefundRequest = async (channel, contact, fromNumber, body) => {
  if (!/refund|return|money back/i.test(body || '')) return;
  createClientNotification(
    contact.client_id,
    'Refund request received',
    `${[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'A customer'} sent a refund request via ${channel}`,
    'refund'
  ).catch(() => {});
  const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Customer';
  await storeBriefing('fatima', 'yousef',
    `Refund/Return request from ${name}`,
    `A customer has requested a refund or return and needs a follow-up.\n\nCustomer: ${name}\nPhone: ${fromNumber}\nChannel: ${channel}\n\nMessage:\n${body}\n\nReply via the Inbox — promised follow-up window is 24 hours.`,
    'urgent', contact.client_id
  ).catch(e => console.error('Refund briefing failed:', e.message));
  try {
    const { tc, from } = await getClientTwilio(contact.client_id);
    const replyText = `Hi ${contact.first_name || 'there'}, we've received your request and a member of our team will follow up within 24 hours. Thank you for your patience.`;
    await tc.messages.create({
      from: channel === 'WhatsApp' ? 'whatsapp:' + from : from,
      to: channel === 'WhatsApp' ? 'whatsapp:' + fromNumber : fromNumber,
      body: replyText,
    });
    await supabase.from('messages').insert([{
      client_id: contact.client_id, contact_id: contact.id,
      channel, direction: 'outbound',
      sender_name: 'Sales Scales', content: replyText, status: 'sent',
    }]);
    console.log(`Refund auto-reply sent to ${name} via ${channel}`);
  } catch (e) {
    console.error('Refund auto-reply failed:', e.message);
  }
};

// ─── AUTO: CASE STUDY CAPTURE (daily 10am) ───────────────
const AOV_MAP = { 'Under $30': 25, '$30–$75': 52, '$75–$150': 112, '$150–$300': 225, 'Over $300': 350 };
cron.schedule('0 10 * * *', async () => {
  console.log('[AUTO] Case study capture scan starting...');
  try {
    const { data: clients } = await supabase.from('clients').select('id, name, niche');
    if (!clients) return;
    for (const c of clients) {
      const { count: existing } = await supabase.from('case_studies')
        .select('id', { count: 'exact', head: true }).eq('client_id', c.id);
      if (existing && existing > 0) continue;
      const { data: enrollments } = await supabase.from('workflow_enrollments')
        .select('id').eq('client_id', c.id).eq('status', 'completed');
      const completed = enrollments?.length || 0;
      if (completed <= 10) continue;
      const { data: onboarding } = await supabase.from('client_onboarding')
        .select('average_order_value').eq('client_id', c.id).maybeSingle();
      const aov = AOV_MAP[onboarding?.average_order_value] || 75;
      const revenue = completed * aov;
      if (revenue <= 1000) continue;
      const results = `${completed} completed automated sequences and an estimated $${revenue.toLocaleString()} in recovered revenue in the ${c.niche || 'ecommerce'} space.`;
      const context = await ragSearch(`${c.name} results ${results}`, c.id).catch(() => '');
      const content = await aiCall(
        `You are Hussain, Intelligence & Strategy AI at Sales Scales. You write compelling, data-driven case studies that showcase client wins. Never break character or mention Claude.`,
        `Write a concise case study for ${c.name} (${c.niche || 'ecommerce'}).\nResults: ${results}\n\nSections:\n1. Executive Summary (lead with the biggest result)\n2. The Challenge\n3. Our Strategy\n4. The Results\n5. Key Takeaways (3 bullets)`,
        context
      );
      await supabase.from('case_studies').insert([{
        client_id: c.id,
        title: `${c.name} — ${completed} Sequences, $${revenue.toLocaleString()} Recovered`,
        results, timeline: null, content, status: 'draft',
      }]);
      console.log(`[AUTO] Case study generated for ${c.name}`);
    }
  } catch (e) {
    console.error('[AUTO] Case study capture error:', e.message);
  }
});

// ─── AUTO: UPSELL AUTOMATION (daily 2pm) ─────────────────
cron.schedule('0 14 * * *', async () => {
  console.log('[AUTO] Upsell scan starting...');
  try {
    const { data: clients } = await supabase.from('clients')
      .select('id, name, tier, niche').in('status', ['active', 'live']);
    if (!clients) return;
    for (const c of clients) {
      if (c.tier !== 'starter') continue;
      const { data: enrollments } = await supabase.from('workflow_enrollments')
        .select('id').eq('client_id', c.id).eq('status', 'completed');
      const completed = enrollments?.length || 0;
      const { data: onboarding } = await supabase.from('client_onboarding')
        .select('average_order_value').eq('client_id', c.id).maybeSingle();
      const aov = AOV_MAP[onboarding?.average_order_value] || 75;
      const revenue = completed * aov;
      if (revenue <= 5000) continue;
      // Skip if an upsell has already been flagged for this client
      const { count: existing } = await supabase.from('team_briefings')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', c.id).ilike('subject', '%Upgrade%Growth%');
      if (existing && existing > 0) continue;
      const content = await aiCall(
        `You are Hussain, Intelligence & Strategy AI at Sales Scales. You spot revenue expansion opportunities and write sharp, persuasive internal recommendations. Never break character or mention Claude.`,
        `Write an internal upsell recommendation for Yousef (agency owner) about upgrading a client from Starter to Growth tier.\n\nClient: ${c.name} (${c.niche || 'ecommerce'})\nCurrent tier: Starter\nRevenue recovered so far: $${revenue.toLocaleString()} (${completed} completed sequences)\n\nWrite:\n1. The Opportunity (lead with the revenue numbers)\n2. Why Growth Tier Now — specific features they'd unlock (WhatsApp automation, unlimited sequences, Klaviyo integration, weekly strategy calls)\n3. Why The Timing Is Right (their momentum and results)\n4. Talking Points for the upgrade conversation`,
        ''
      );
      await storeBriefing('hussain', 'yousef',
        `Upsell Opportunity: Upgrade ${c.name} to Growth tier`,
        content, 'high', c.id
      ).catch(e => console.error('Upsell briefing failed:', e.message));
      console.log(`[AUTO] Upsell briefing generated for ${c.name}`);
    }
  } catch (e) {
    console.error('[AUTO] Upsell scan error:', e.message);
  }
});

// ─── ONE-TIME: LINKEDIN DAY 6 "BEHIND THE BUILD" POST ────
(async () => {
  try {
    const subject = 'LinkedIn Day 6 — Behind the Build';
    const { data: existing } = await supabase.from('team_briefings')
      .select('id').eq('subject', subject).limit(1).maybeSingle();
    if (existing) return;
    const post = await aiCall(
      `You are Mahdi, Marketing & Content AI at Sales Scales. You write scroll-stopping LinkedIn content in a founder's authentic voice. Never break character or mention Claude.`,
      `Write Day 6 of a "Behind the Build" LinkedIn series documenting the journey of building Sales Scales — an AI-powered revenue system for ecommerce agencies.\n\nDay 6 theme: a specific lesson or milestone from building the platform. Make it personal, concrete, and engaging.\n\nFormat:\n- A strong hook line\n- Short punchy paragraphs with line breaks between them (LinkedIn style)\n- A genuine lesson learned\n- A closing line that invites engagement\n- 3-5 relevant hashtags`,
      ''
    );
    await storeBriefing('mahdi', 'yousef', subject, post, 'normal', null)
      .catch(e => console.error('LinkedIn Day 6 briefing failed:', e.message));
    console.log('[INIT] LinkedIn Day 6 post generated and stored');
  } catch (e) {
    console.error('[INIT] LinkedIn Day 6 generation error:', e.message);
  }
})();

// ─── ONE-TIME: LINKEDIN DAY 7 "CALL TO ACTION" POST ──────
(async () => {
  try {
    const subject = 'LinkedIn Day 7 — Call to Action';
    const { data: existing } = await supabase.from('team_briefings')
      .select('id').eq('subject', subject).limit(1).maybeSingle();
    if (existing) return;
    const post = await aiCall(
      `You are Mahdi, Marketing & Content AI at Sales Scales. You write scroll-stopping LinkedIn content in a founder's authentic voice. Never break character or mention Claude.`,
      `Write Day 7 — the FINAL post — of a "Behind the Build" LinkedIn series documenting the journey of building Sales Scales, an AI-powered revenue system for ecommerce agencies.\n\nDay 7 theme: wrap up the series and make a strong, direct call to action. Sales Scales is now live and ready for ecommerce agencies. Invite readers to book a call or reach out to learn how Sales Scales can run their revenue operations with an AI team.\n\nFormat:\n- A strong hook line that signals this is the finale of the 7-day series\n- Short punchy paragraphs with line breaks between them (LinkedIn style)\n- A clear, confident CTA inviting people to book a call or DM/reach out about Sales Scales\n- A closing line that drives action\n- 3-5 relevant hashtags`,
      ''
    );
    await storeBriefing('mahdi', 'yousef', subject, post, 'high', null)
      .catch(e => console.error('LinkedIn Day 7 briefing failed:', e.message));
    console.log('[INIT] LinkedIn Day 7 post generated and stored');
  } catch (e) {
    console.error('[INIT] LinkedIn Day 7 generation error:', e.message);
  }
})();

// ─── AUTO SCHEDULER: HUSSAIN — WEEKLY INTELLIGENCE ───────
// Every Monday at 9am
cron.schedule('0 9 * * 1', async () => {
  console.log('[AUTO] Hussain — weekly intelligence briefing starting...');
  try {
    const { data: clients, error } = await supabase
      .from('clients').select('id, name, niche, tier, health_score')
      .eq('status', 'active');
    if (error || !clients || clients.length === 0) {
      console.log('[AUTO] Hussain weekly — no active clients');
      return;
    }

    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const clientData = await Promise.all(clients.map(async (client) => {
      const [ragCtx, enrollRes, contactRes, pipelineRes] = await Promise.all([
        ragSearch(`weekly performance insights ${client.name}`, client.id),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).gte('enrolled_at', weekStart),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).gte('created_at', weekStart),
        supabase.from('pipeline_deals').select('value').eq('client_id', client.id),
      ]);
      return {
        ...client,
        enrollments: enrollRes.count || 0,
        newContacts: contactRes.count || 0,
        pipelineValue: (pipelineRes.data || []).reduce((s, d) => s + parseFloat(d.value || 0), 0),
        ragCtx,
      };
    }));

    const sorted = [...clientData].sort((a, b) => b.enrollments - a.enrollments);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const summaryLines = clientData.map(c =>
      `${c.name} (${c.niche || 'ecommerce'}): ${c.enrollments} enrollments, ${c.newContacts} new contacts, $${c.pipelineValue.toFixed(0)} pipeline`
    ).join('\n');
    const ragContext = clientData.map(c => c.ragCtx).filter(Boolean).join('\n\n');

    const briefing = await aiCall(
      `You are Hussain, the Intelligence and Strategy AI at Sales Scales. You think like a founder and talk to Yousef like a trusted advisor and co-founder — plainly, directly, peer to peer. No corporate language, no consultant-speak, no hedging. Say what you actually think. If something is going wrong, say it straight. If something is working, say why in concrete terms. You are Hussain — never mention Claude.`,
      `It's ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Give Yousef his Monday briefing.\n\nClient performance this week:\n${summaryLines}\n\nTop performer: ${top.name} (${top.enrollments} enrollments)\nNeeds attention: ${bottom.name} (${bottom.enrollments} enrollments)\n\nCover these, in plain language:\n1. TOP PERFORMER — what's actually driving ${top.name} and how to do more of it\n2. NEEDS ATTENTION — what's really going wrong with ${bottom.name} and the one fix that matters most\n3. WEEKLY PRIORITIES — the 3 highest-leverage things Yousef should do this week, in order\n4. MARKET INSIGHTS — 1–2 real patterns or openings you see across the book\n\nWrite the way you'd talk to a co-founder over coffee. Short sentences. Get to the point. Skip the throat-clearing — open with the thing that matters most. No filler, no buzzwords, no exclamation marks.`,
      ragContext
    );

    await storeBriefing('hussain', 'yousef',
      `Weekly Intelligence Briefing — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      briefing, 'normal'
    );
    console.log(`[AUTO] Hussain weekly briefing stored — ${clients.length} clients analyzed`);

    // Hussain→Mahdi: generate email + SMS sequence approvals for each client
    for (const client of clientData) {
      try {
        const emailSeqJson = await aiCall(
          `You are Mahdi, the Marketing and Content AI at Sales Scales. You write high-converting sequences. Return ONLY valid JSON, no markdown, no explanation.`,
          `Generate a 3-step email sequence for ${client.name} (niche: ${client.niche || 'ecommerce'}, weekly enrollments this week: ${client.enrollments}).
Return JSON exactly: {"trigger_type":"manual","steps":[{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":24},{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":48},{"step_type":"email","subject":"...","content":"...","wait_hours":0}]}`,
          client.ragCtx || ''
        );
        let emailParsed;
        try {
          const ec = emailSeqJson.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const em = ec.match(/\{[\s\S]*\}/);
          emailParsed = JSON.parse(em ? em[0] : ec);
        } catch { emailParsed = { steps: [] }; }
        await supabase.from('approvals').insert([{
          type: 'email_sequence',
          title: `Email Sequence — ${client.name}`,
          content: `Mahdi drafted a ${(emailParsed.steps || []).filter(s => s.step_type === 'email').length}-email sequence for ${client.name} based on this week's performance.`,
          metadata: { steps: emailParsed.steps || [], trigger_type: emailParsed.trigger_type || 'manual' },
          from_member: 'mahdi',
          client_id: client.id,
          priority: 'normal',
          status: 'pending',
          created_at: new Date().toISOString()
        }]);

        const smsSeqJson = await aiCall(
          `You are Mahdi, the Marketing and Content AI at Sales Scales. Return ONLY valid JSON, no markdown, no explanation.`,
          `Generate a 2-step SMS sequence for ${client.name} (niche: ${client.niche || 'ecommerce'}).
Return JSON exactly: {"trigger_type":"cart_abandoned","steps":[{"step_type":"sms","content":"Hi {{first_name}}, ...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":48},{"step_type":"sms","content":"...","wait_hours":0}]}`,
          client.ragCtx || ''
        );
        let smsParsed;
        try {
          const sc = smsSeqJson.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const sm = sc.match(/\{[\s\S]*\}/);
          smsParsed = JSON.parse(sm ? sm[0] : sc);
        } catch { smsParsed = { steps: [] }; }
        await supabase.from('approvals').insert([{
          type: 'sms_sequence',
          title: `SMS Sequence — ${client.name}`,
          content: `Mahdi drafted a ${(smsParsed.steps || []).filter(s => s.step_type === 'sms').length}-step SMS sequence for ${client.name}.`,
          metadata: { steps: smsParsed.steps || [], trigger_type: smsParsed.trigger_type || 'cart_abandoned' },
          from_member: 'mahdi',
          client_id: client.id,
          priority: 'normal',
          status: 'pending',
          created_at: new Date().toISOString()
        }]);
        console.log(`[AUTO] Hussain→Mahdi sequences queued for ${client.name}`);
        await notifyClientUser(
          client.id,
          'New content is ready for your review',
          `<p>Hi ${client.name},</p><p>Your AI team has drafted new email and SMS sequences for your approval.</p><p>Log in to your Sales Scales portal to review and approve them.</p>`
        );
      } catch (clientErr) {
        console.error(`[AUTO] Hussain→Mahdi sequences failed for ${client.name}:`, clientErr.message);
      }
    }
  } catch (e) {
    console.error('[AUTO] Hussain weekly error:', e.message);
  }
});

// ─── AUTO SCHEDULER: FATIMA — HOURLY ENROLLMENT MONITOR ──
// Every hour
cron.schedule('0 * * * *', async () => {
  console.log('[AUTO] Fatima — hourly enrollment health check...');
  try {
    const { data: clients } = await supabase
      .from('clients').select('id, name').eq('status', 'active');
    if (!clients || clients.length === 0) return;

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const alerts = [];

    await Promise.all(clients.map(async (client) => {
      const [recentRes, workflowsRes] = await Promise.all([
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).gte('enrolled_at', since24h),
        supabase.from('workflows').select('id, name, enrolled_count')
          .eq('client_id', client.id).eq('status', 'active'),
      ]);

      if ((recentRes.count || 0) === 0) {
        alerts.push(`ZERO ENROLLMENTS: ${client.name} has had 0 workflow enrollments in the past 24 hours. Sequences may be inactive or audience is not being reached.`);
      }

      for (const wf of (workflowsRes.data || [])) {
        const total = wf.enrolled_count || 0;
        if (total < 10) continue;
        const { count: cancelled } = await supabase
          .from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('workflow_id', wf.id).eq('status', 'cancelled');
        const dropOff = ((cancelled || 0) / total) * 100;
        if (dropOff > 40) {
          alerts.push(`HIGH DROP-OFF: ${client.name} → "${wf.name}" has ${dropOff.toFixed(0)}% drop-off (${cancelled} cancelled / ${total} total). Sequence content may need revision.`);
        }
      }
    }));

    if (alerts.length === 0) {
      console.log('[AUTO] Fatima hourly — all clients healthy');
      return;
    }

    await storeBriefing('fatima', 'yousef',
      `Operations Alert — ${alerts.length} Issue(s) Detected`,
      `Fatima has flagged ${alerts.length} operational issue(s) requiring your attention:\n\n${alerts.join('\n\n')}\n\nReview the Sequences and Contacts pages to take action.`,
      'urgent'
    );
    console.log(`[AUTO] Fatima flagged ${alerts.length} alert(s)`);

    // Fatima→Hussain: draft a client_checkin approval for each flagged client
    const seenClientIds = new Set();
    for (const alert of alerts) {
      const flaggedClient = clients.find(c => alert.includes(c.name));
      if (!flaggedClient || seenClientIds.has(flaggedClient.id)) continue;
      seenClientIds.add(flaggedClient.id);
      try {
        const { data: clientUser } = await supabase.from('client_users')
          .select('email, name').eq('client_id', flaggedClient.id).maybeSingle();
        if (!clientUser?.email) continue;
        const checkinContent = await aiCall(
          `You are Hussain, the Intelligence and Strategy AI at Sales Scales. Write brief, professional check-in emails. Be helpful and specific, not alarming.`,
          `Write a 3–4 sentence check-in email to ${flaggedClient.name}'s team. Context: ${alert}. Offer specific help. Do not mention internal metrics or system alerts.`,
          ''
        );
        await supabase.from('approvals').insert([{
          type: 'client_checkin',
          title: `Client Check-in — ${flaggedClient.name}`,
          content: checkinContent,
          metadata: { to_email: clientUser.email, to_name: clientUser.name || flaggedClient.name, subject: `Quick check-in from Sales Scales` },
          from_member: 'fatima',
          client_id: flaggedClient.id,
          priority: 'normal',
          status: 'pending',
          created_at: new Date().toISOString()
        }]);
        console.log(`[AUTO] Fatima — check-in approval drafted for ${flaggedClient.name}`);
      } catch (clientErr) {
        console.error(`[AUTO] Fatima check-in failed for ${flaggedClient.name}:`, clientErr.message);
      }
    }
  } catch (e) {
    console.error('[AUTO] Fatima hourly error:', e.message);
  }
});

// ─── AUTO SCHEDULER: ZAINAB — MONTHLY REPORTS ────────────
// 1st of every month at 8am
cron.schedule('0 8 1 * *', async () => {
  console.log('[AUTO] Zainab — monthly report generation starting...');
  try {
    const { data: clients } = await supabase
      .from('clients').select('id, name, niche, tier').eq('status', 'active');
    if (!clients || clients.length === 0) {
      console.log('[AUTO] Zainab monthly — no active clients');
      return;
    }

    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStart = prevMonthStart.toISOString();
    const monthEnd = thisMonthStart.toISOString();
    const period = prevMonthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const ZAINAB_TIER_FEE = { starter: 199, growth: 299, scale: 399, elite: 399, enterprise: 399 };
    let reportsGenerated = 0;
    let emailsSentCount = 0;
    let invoicesGenerated = 0;

    for (const client of clients) {
      try {
        const [
          emailRes, smsRes, waRes, contactsRes, enrollRes,
          seqRes, ragContext, briefingsCtx, clientUsersRes,
        ] = await Promise.all([
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('channel', 'email').eq('direction', 'outbound').gte('created_at', monthStart).lt('created_at', monthEnd),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('channel', 'sms').eq('direction', 'outbound').gte('created_at', monthStart).lt('created_at', monthEnd),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('channel', 'whatsapp').eq('direction', 'outbound').gte('created_at', monthStart).lt('created_at', monthEnd),
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('created_at', monthStart).lt('created_at', monthEnd),
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('enrolled_at', monthStart).lt('enrolled_at', monthEnd),
          supabase.from('workflows').select('name, enrolled_count').eq('client_id', client.id).eq('status', 'active').order('enrolled_count', { ascending: false }).limit(1),
          ragSearch(`monthly report ${client.name}`, client.id),
          getBriefingsContext('zainab'),
          supabase.from('client_users').select('email, name').eq('client_id', client.id).limit(1),
        ]);

        const emailsSent    = emailRes.count    || 0;
        const smsSent       = smsRes.count      || 0;
        const whatsappSent  = waRes.count       || 0;
        const contactsAdded = contactsRes.count || 0;
        const enrollments   = enrollRes.count   || 0;
        const topSequence   = seqRes.data?.[0]?.name || 'None';
        const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');

        const summary = await aiCall(
          `You are Zainab, the Client Partner AI at Sales Scales. You write monthly performance reports that are honest, insightful, and actionable. Never break character or mention Claude.`,
          `Write a monthly performance report for ${client.name} (${client.niche || 'ecommerce'}) for ${period}.\n\nData:\n- Emails sent: ${emailsSent}\n- SMS sent: ${smsSent}\n- WhatsApp sent: ${whatsappSent}\n- New contacts: ${contactsAdded}\n- Workflow enrollments: ${enrollments}\n- Top sequence: ${topSequence}\n\n5 sections:\n1. MONTHLY OVERVIEW\n2. CHANNEL PERFORMANCE\n3. GROWTH & CONTACTS\n4. SEQUENCE PERFORMANCE\n5. RECOMMENDATIONS FOR NEXT MONTH\n\nBe specific, warm, actionable.\n\nHOW TO WRITE:\nWrite like a real human being, not a marketing robot. Use short sentences. Use line breaks generously. Never use words like "we understand" or "we know how you feel" or "don't miss out" or "limited time". Never use exclamation marks. Write the way a thoughtful friend who works at the brand would write. Open with one clear emotional hook in the first two sentences that makes the reader feel something.`,
          context
        );

        await supabase.from('reports').insert({
          client_id: client.id, period,
          emails_sent: emailsSent, sms_sent: smsSent,
          whatsapp_sent: whatsappSent, contacts_added: contactsAdded,
          workflow_enrollments: enrollments, top_sequence: topSequence, summary,
        });
        reportsGenerated++;

        const clientUser = clientUsersRes.data?.[0];
        if (clientUser?.email) {
          try {
            await sgMail.send({
              to: clientUser.email,
              from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
              subject: `Your ${period} Performance Report — ${client.name}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:32px;background:#f0f3f8;">
                <div style="background:#0a1628;padding:24px 32px;border-radius:8px 8px 0 0;">
                  <h1 style="color:#c9a84c;margin:0;font-size:20px;">Sales Scales</h1>
                  <p style="color:#8896a8;margin:8px 0 0;font-size:14px;">Monthly Performance Report — ${period}</p>
                </div>
                <div style="background:#ffffff;padding:32px;border-radius:0 0 8px 8px;">
                  <p style="color:#4a5568;margin:0 0 16px;">Hi ${clientUser.name || client.name},</p>
                  <p style="color:#4a5568;margin:0 0 24px;">Here is your ${period} performance report from Zainab, your Sales Scales Client Partner.</p>
                  <div style="background:#f0f3f8;padding:24px;border-radius:6px;white-space:pre-wrap;font-size:14px;color:#0a1628;line-height:1.7;">${summary}</div>
                  <p style="color:#8896a8;font-size:12px;margin:24px 0 0;">Log in to your Sales Scales portal to view your full dashboard.</p>
                </div>
              </div>`,
            });
            emailsSentCount++;
          } catch (mailErr) {
            console.error(`[AUTO] Zainab email failed for ${client.name}:`, mailErr.message);
          }
        }
        // Generate invoice for this client
        try {
          const { data: contract } = await supabase.from('contracts')
            .select('monthly_fee').eq('client_id', client.id)
            .in('status', ['signed', 'sent'])
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          const amount = contract?.monthly_fee
            ? parseFloat(contract.monthly_fee)
            : (ZAINAB_TIER_FEE[(client.tier || '').toLowerCase()] || 199);
          const invoiceNumber = `SS-${Date.now().toString(36).toUpperCase()}`;
          const issuedDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
          const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
          const fmtAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const tierLabel = client.tier ? client.tier.charAt(0).toUpperCase() + client.tier.slice(1) : 'Starter';
          const invoice_html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Invoice ${invoiceNumber} — ${client.name}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f3f8;padding:40px;color:#0a1628}.inv{max-width:760px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(10,22,40,.12)}.hd{background:#0a1628;padding:36px 40px;display:flex;justify-content:space-between;align-items:flex-start}.brand{color:#c9a84c;font-size:22px;font-weight:700}.inv-lbl .title{color:white;font-size:26px;font-weight:700}.inv-lbl .num{color:#c9a84c;font-size:13px;margin-top:4px;font-family:monospace}.bd{padding:36px 40px}.meta{display:flex;justify-content:space-between;margin-bottom:32px}.mb h4{font-size:9px;color:#8896a8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px}.mb p{font-size:13px;color:#0a1628;line-height:1.6}.mb .co{font-size:15px;font-weight:700;margin-bottom:4px}table{width:100%;border-collapse:collapse}thead tr{background:#0a1628}thead th{padding:12px 16px;text-align:left;font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1.5px;font-weight:700}tbody tr{border-bottom:1px solid #f0f3f8}tbody td{padding:16px;font-size:13px;color:#0a1628}.tots{margin:16px 0 0 auto;width:280px}.tr{display:flex;justify-content:space-between;padding:8px 0;font-size:13px}.tr.grand{border-top:2px solid #0a1628;margin-top:8px;padding-top:14px}.tr.grand .val{font-size:15px;font-weight:700;color:#c9a84c}.ft{background:#f8fafc;padding:24px 40px;border-top:1px solid #e4e9f0;display:flex;justify-content:space-between;align-items:center}.fn{font-size:11px;color:#8896a8;line-height:1.6}.badge{background:#fffbeb;color:#d97706;border:1px solid #fde68a;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700}</style>
</head><body><div class="inv"><div class="hd"><div><div class="brand">Sales Scales</div></div><div class="inv-lbl"><div class="title">INVOICE</div><div class="num">${invoiceNumber}</div></div></div>
<div class="bd"><div class="meta"><div class="mb"><h4>Bill To</h4><p class="co">${client.name}</p><p>${tierLabel} Plan</p><p>Period: ${period}</p></div><div class="mb" style="text-align:right"><p>Issued: ${issuedDate}</p><p>Due: ${dueDate}</p></div></div>
<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody><tr><td>${tierLabel} Plan — ${period}<br><span style="font-size:11px;color:#8896a8">AI-powered revenue system: email, SMS, workflows, AI team access</span></td><td style="text-align:right;font-weight:600">$${fmtAmount}</td></tr></tbody></table>
<div class="tots"><div class="tr"><span style="color:#8896a8">Subtotal</span><span>$${fmtAmount}</span></div><div class="tr"><span style="color:#8896a8">Tax (0%)</span><span>$0.00</span></div><div class="tr grand"><span style="font-size:15px;font-weight:700">Total Due</span><span class="val">$${fmtAmount}</span></div></div></div>
<div class="ft"><div class="fn">Payment due within 7 days.<br>Questions? billing@salesscales.com</div><div class="badge">Unpaid</div></div></div></body></html>`;
          await supabase.from('invoices').insert({
            client_id: client.id, client_name: client.name, amount, period,
            status: 'unpaid', invoice_html,
          });
          invoicesGenerated++;
        } catch (invoiceErr) {
          console.error(`[AUTO] Zainab invoice failed for ${client.name}:`, invoiceErr.message);
        }

      } catch (clientErr) {
        console.error(`[AUTO] Zainab report failed for ${client.name}:`, clientErr.message);
      }
    }

    await storeBriefing('zainab', 'yousef',
      `Monthly Reports Complete — ${period}`,
      `Zainab has automatically generated and sent ${period} reports.\n\n- Reports generated: ${reportsGenerated}/${clients.length}\n- Invoices generated: ${invoicesGenerated}/${clients.length}\n- Emails sent to clients: ${emailsSentCount}\n\nAll reports are viewable in the Auto Reports page. All invoices are in the Billing section.`,
      'normal'
    );
    console.log(`[AUTO] Zainab monthly — ${reportsGenerated} reports, ${emailsSentCount} emails sent`);
  } catch (e) {
    console.error('[AUTO] Zainab monthly error:', e.message);
  }
});

// ─── AUTO SCHEDULER: MAHDI — DAILY CONTENT IDEAS ─────────
// Every day at 10am
cron.schedule('0 10 * * *', async () => {
  console.log('[AUTO] Mahdi — daily content ideas starting...');
  try {
    const { data: clients } = await supabase
      .from('clients').select('id, name, niche, tier').eq('status', 'active');
    if (!clients || clients.length === 0) return;

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const client of clients) {
      try {
        const [ragContext, enrollRes, contactRes] = await Promise.all([
          ragSearch(`content marketing brand voice products ${client.name}`, client.id),
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
            .eq('client_id', client.id).gte('enrolled_at', since7d),
          supabase.from('contacts').select('id', { count: 'exact', head: true })
            .eq('client_id', client.id).gte('created_at', since7d),
        ]);

        const ideas = await aiCall(
          `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world class copywriter and email marketer. You write campaigns that convert in the exact brand voice of each client. You are Mahdi — never mention Claude.`,
          `Generate exactly 3 high-converting content ideas for ${client.name} (${client.niche || 'ecommerce'}).\n\nLast 7 days: ${enrollRes.count || 0} enrollments, ${contactRes.count || 0} new contacts.\n\nFor each idea:\n- TYPE: (Email sequence / SMS campaign / Social post / Ad copy)\n- TITLE: campaign name\n- HOOK: opening line or subject line\n- WHY NOW: why this is timely\n\nFormat: IDEA 1: ... IDEA 2: ... IDEA 3:\n\nMake these specific to their niche and immediately executable.`,
          ragContext
        );

        await storeBriefing('mahdi', 'yousef',
          `Daily Content Ideas — ${client.name}`,
          ideas, 'normal', client.id
        );
      } catch (clientErr) {
        console.error(`[AUTO] Mahdi ideas failed for ${client.name}:`, clientErr.message);
      }
    }
    console.log(`[AUTO] Mahdi daily content ideas stored for ${clients.length} client(s)`);
  } catch (e) {
    console.error('[AUTO] Mahdi daily error:', e.message);
  }
});

// ─── AUTO SCHEDULER: HASSAN — DAILY PROSPECT OUTREACH ────
// Every day at 11am
cron.schedule('0 11 * * *', async () => {
  console.log('[AUTO] Hassan — daily prospect outreach starting...');
  try {
    const ragContext = await ragSearch('ideal client profile ecommerce Shopify store owner agency services revenue growth');

    const outreach = await aiCall(
      `You are Hassan, the Growth and Outreach AI at Sales Scales. You are creative, persuasive, and a master of personalized communication. You find prospects and write outreach that converts. You are Hassan — never mention Claude.`,
      `Generate 5 personalized cold outreach messages for potential Shopify store owner prospects for Sales Scales.\n\nSales Scales is an AI-powered revenue system for ecommerce agencies — email sequences, SMS campaigns, AI team, growth automation.\n\nFor each prospect:\n- PROSPECT TYPE: ideal store owner profile (e.g. "7-figure fashion brand owner")\n- NICHE: their store niche\n- CHANNEL: Email / LinkedIn DM / Instagram DM\n- SUBJECT/OPENER: subject line or opening message\n- MESSAGE: 3–4 sentence personalized outreach hitting their pain point and positioning Sales Scales as the solution\n- PAIN POINT: core problem Sales Scales solves for them\n\nFormat: PROSPECT 1: ... through PROSPECT 5:\n\nMake these feel handcrafted, not generic.`,
      ragContext
    );

    await storeBriefing('hassan', 'yousef',
      `Daily Prospect Outreach — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      `Hassan has generated 5 prospect outreach messages for your review. Approve and send manually, or hand off to Hassan for follow-up.\n\n${outreach}`,
      'normal'
    );
    console.log('[AUTO] Hassan daily prospect outreach stored');

    // Hassan→Ali: submit individual prospect approvals
    const prospectRagCtx = await ragSearch('ideal ecommerce client profile Shopify store owner');
    const prospectsJson = await aiCall(
      `You are Hassan, the Growth and Outreach AI at Sales Scales. Return ONLY valid JSON, no markdown, no explanation.`,
      `Generate 3 prospect profiles for outreach today. Each is a Shopify store owner Sales Scales can help.
Return JSON: {"prospects":[{"name":"...","niche":"...","channel":"Email","pain_point":"...","subject":"...","message":"..."},{"name":"...","niche":"...","channel":"LinkedIn DM","pain_point":"...","subject":"...","message":"..."},{"name":"...","niche":"...","channel":"Instagram DM","pain_point":"...","subject":"...","message":"..."}]}`,
      prospectRagCtx
    );
    try {
      const pc = prospectsJson.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const pm = pc.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(pm ? pm[0] : pc);
      const prospects = parsed.prospects || [];
      for (const p of prospects) {
        await supabase.from('approvals').insert([{
          type: 'prospect',
          title: `Prospect: ${p.name || (p.niche + ' store owner')}`,
          content: p.message || '',
          metadata: { prospect_name: p.name, niche: p.niche, channel: p.channel, pain_point: p.pain_point, subject: p.subject },
          from_member: 'hassan',
          client_id: null,
          priority: 'high',
          status: 'pending',
          created_at: new Date().toISOString()
        }]);
      }
      console.log(`[AUTO] Hassan — ${prospects.length} prospect(s) submitted for approval`);

      // Generate LinkedIn connection request messages for each prospect (max 300 chars)
      if (prospects.length > 0) {
        const prospectList = prospects.map((p, i) =>
          `${i + 1}. Name: ${p.name || p.niche + ' store owner'} | Niche: ${p.niche || 'ecommerce'} | Pain point: ${p.pain_point || 'scaling revenue'}`
        ).join('\n');
        const linkedinRaw = await aiCall(
          `You are Hassan, the Growth and Outreach AI at Sales Scales. Return ONLY valid JSON, no markdown, no explanation.`,
          `Write a LinkedIn connection request message for each of these prospects. Each message must be under 300 characters, professional, direct, and personalized to their niche and pain point. Do NOT pitch — just make a genuine connection.\n\nProspects:\n${prospectList}\n\nReturn JSON: {"linkedin":[{"prospect":"name or niche label","message":"under 300 char message"}]}`
        );
        try {
          const lc = linkedinRaw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const lm = lc.match(/\{[\s\S]*\}/);
          const linkedinParsed = JSON.parse(lm ? lm[0] : lc);
          for (const item of (linkedinParsed.linkedin || [])) {
            const msg = (item.message || '').slice(0, 300);
            if (!msg) continue;
            await storeBriefing('hassan', 'yousef',
              `LinkedIn Outreach — ${item.prospect || 'Prospect'}`,
              msg,
              'normal'
            );
          }
          console.log(`[AUTO] Hassan — ${(linkedinParsed.linkedin || []).length} LinkedIn message(s) stored`);
        } catch (liErr) {
          console.error('[AUTO] Hassan LinkedIn parse error:', liErr.message);
        }
      }

      // Fix 7: Cold email outreach per prospect
      if (prospects.length > 0) {
        const emailProspectList = prospects.map((p, i) =>
          `${i + 1}. Name: ${p.name || (p.niche + ' store owner')} | Niche: ${p.niche || 'ecommerce'} | Pain point: ${p.pain_point || 'scaling revenue'}`
        ).join('\n');
        try {
          const emailRaw = await aiCall(
            `You are Hassan, the Growth and Outreach AI at Sales Scales. Return ONLY valid JSON, no markdown.`,
            `Write a cold email under 200 words for each prospect, with a compelling subject line and personalized body targeting their pain point.\n\nProspects:\n${emailProspectList}\n\nReturn JSON: {"emails":[{"prospect":"name or niche label","subject":"subject line","body":"email body under 200 words"}]}`
          );
          const ec = emailRaw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const em = ec.match(/\{[\s\S]*\}/);
          const emailParsed = JSON.parse(em ? em[0] : ec);
          for (const item of (emailParsed.emails || [])) {
            if (!item.subject || !item.body) continue;
            await storeBriefing('hassan', 'yousef',
              `Cold Email — ${item.prospect || 'Prospect'}`,
              `Subject: ${item.subject}\n\n${item.body}`,
              'normal'
            );
          }
          console.log(`[AUTO] Hassan — ${(emailParsed.emails || []).length} cold email(s) stored`);
        } catch (emailErr) {
          console.error('[AUTO] Hassan cold email error:', emailErr.message);
        }
      }
    } catch (parseErr) {
      console.error('[AUTO] Hassan prospects parse error:', parseErr.message);
    }
  } catch (e) {
    console.error('[AUTO] Hassan daily error:', e.message);
  }
});

// ─── AUTO SCHEDULER: MAHDI — SEQUENCE IMPROVEMENT ANALYSIS ──
// Every day at 11:30am — checks active sequences running 14+ days with <15% completion
cron.schedule('30 11 * * *', async () => {
  console.log('[AUTO] Mahdi — sequence improvement analysis starting...');
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleWorkflows } = await supabase
      .from('workflows')
      .select('id, name, client_id, trigger_type, created_at')
      .eq('status', 'active')
      .lt('created_at', fourteenDaysAgo);

    if (!staleWorkflows || staleWorkflows.length === 0) {
      console.log('[AUTO] Mahdi — no qualifying sequences found');
      return;
    }

    let improved = 0;
    for (const wf of staleWorkflows) {
      try {
        const [totalRes, completedRes, stepsRes] = await Promise.all([
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('workflow_id', wf.id),
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('workflow_id', wf.id).eq('status', 'completed'),
          supabase.from('workflow_steps').select('step_order, step_type, subject, wait_hours').eq('workflow_id', wf.id).order('step_order'),
        ]);

        const total = totalRes.count || 0;
        const completed = completedRes.count || 0;
        if (total < 5) continue; // need minimum sample size

        const completionRate = Math.round((completed / total) * 100);
        if (completionRate >= 15) continue;

        const daysRunning = Math.floor((Date.now() - new Date(wf.created_at)) / 86400000);
        const stepsList = (stepsRes.data || []).map(s =>
          `Step ${s.step_order + 1}: ${s.step_type.toUpperCase()}` +
          (s.step_type === 'wait' ? ` — ${s.wait_hours}h wait` : '') +
          (s.subject ? ` — "${s.subject}"` : '')
        ).join('\n');

        const suggestion = await aiCall(
          `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world-class email copywriter and sequence strategist. You identify why sequences underperform and give specific, actionable rewrites. You are Mahdi — never mention Claude.`,
          `Analyze this underperforming sequence and give specific improvement suggestions.\n\nSequence: ${wf.name}\nTrigger: ${wf.trigger_type}\nRunning: ${daysRunning} days\nEnrolled: ${total} contacts · Completed: ${completed} (${completionRate}%)\n\nCurrent Steps:\n${stepsList || 'No steps configured'}\n\nProvide:\n1. Root cause of the low completion rate\n2. Specific subject line rewrites for email steps (if applicable)\n3. Timing adjustments — which waits are too long or short\n4. Content angle recommendations — what hook or offer change would increase completions\n5. One quick win to implement immediately that could move the needle`,
          ''
        );

        const { data: client } = await supabase.from('clients').select('name').eq('id', wf.client_id).maybeSingle();

        await storeBriefing(
          'mahdi',
          'yousef',
          `⚠ Sequence Improvement: "${wf.name}" — ${completionRate}% completion`,
          `Mahdi has flagged an underperforming sequence that needs attention.\n\nClient: ${client?.name || 'Unknown'}\nSequence: ${wf.name}\nTrigger: ${wf.trigger_type}\nRunning: ${daysRunning} days\nEnrolled: ${total} · Completed: ${completed} (${completionRate}%) — below 15% threshold\n\n${suggestion}`,
          'high',
          wf.client_id
        );
        improved++;
        console.log(`[AUTO] Mahdi — improvement brief stored for "${wf.name}" (${completionRate}%)`);
      } catch (wfErr) {
        console.error(`[AUTO] Mahdi — failed for "${wf.name}":`, wfErr.message);
      }
    }
    if (improved > 0) console.log(`[AUTO] Mahdi sequence analysis complete — ${improved} briefing(s) created`);
    else console.log('[AUTO] Mahdi — all qualifying sequences are performing well');
  } catch (e) {
    console.error('[AUTO] Mahdi sequence analysis error:', e.message);
  }
});

// ─── AUTO SCHEDULER: SHOPIFY PRODUCT SYNC — 6AM DAILY ────
cron.schedule('0 6 * * *', async () => {
  console.log('[AUTO] Shopify sync — checking product changes...');
  try {
    const { data: connections } = await supabase
      .from('shopify_connections')
      .select('id, shop, access_token, client_id, last_product_hash')
      .not('client_id', 'is', null);
    if (!connections || connections.length === 0) {
      console.log('[AUTO] Shopify sync — no connections found');
      return;
    }

    // Only process connections where the client is active
    const { data: activeClients } = await supabase
      .from('clients').select('id').eq('status', 'active');
    const activeIds = new Set((activeClients || []).map(c => c.id));
    const toSync = connections.filter(c => activeIds.has(c.client_id));

    const mahdiSystem = `You are Mahdi, the Marketing and Content AI at Sales Scales. You write high-converting cart recovery copy. Return ONLY valid JSON, no markdown, no explanation.`;

    const parseSeqJson = (raw) => {
      const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : clean);
    };

    let changed = 0, skipped = 0;

    for (const conn of toSync) {
      try {
        const { shop, access_token, client_id } = conn;
        const headers = { 'X-Shopify-Access-Token': access_token, 'Content-Type': 'application/json' };
        const base = `https://${shop}/admin/api/2026-01`;

        const [productsRes, ordersRes, shopRes] = await Promise.all([
          axios.get(`${base}/products.json?limit=10&fields=id,title,variants,product_type`, { headers }),
          axios.get(`${base}/orders.json?status=any&limit=50&fields=total_price&financial_status=paid`, { headers }),
          axios.get(`${base}/shop.json`, { headers }),
        ]);

        const products = productsRes.data.products || [];
        const orders = ordersRes.data.orders || [];
        const shopInfo = shopRes.data.shop || {};

        // Build a stable hash string from product titles + prices
        const hashInput = products.slice(0, 6).map(p => {
          const price = p.variants?.[0]?.price || '0';
          return `${p.title}:${price}`;
        }).join('|');
        const newHash = crypto.createHash('sha256').update(hashInput).digest('hex');

        if (conn.last_product_hash === newHash) {
          skipped++;
          console.log(`[AUTO] Shopify sync — no change for ${shop}`);
          continue;
        }

        // Products or prices changed — regenerate sequences
        const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
        const aov = orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0';
        const productList = products.slice(0, 6).map(p => {
          const price = p.variants?.[0]?.price || '0';
          return `${p.title} ($${price})`;
        }).join(', ');
        const storeName = shopInfo.name || shop;
        const ctx = `Store: ${storeName}\nCurrency: ${shopInfo.currency || 'USD'}\nTop products: ${productList}\nAverage order value: $${aov}`;

        // Email: two parallel calls (7 emails total)
        const [emails1to3Raw, emails4to7Raw] = await Promise.all([
          aiCall(mahdiSystem,
            `Write 3 cart recovery emails for this store.\n\n${ctx}\n\nAngles:\nEmail 1 (1h after abandonment): urgency — cart items waiting\nEmail 2 (24h): social proof — customer reviews\nEmail 3 (72h): product benefits\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."}]}\nUse {{first_name}}. Under 120 words per email. Reference real product names and updated prices.`,
            ''),
          aiCall(mahdiSystem,
            `Write 4 cart recovery emails for this store.\n\n${ctx}\n\nAngles:\nEmail 4 (5 days): objection handling\nEmail 5 (7 days): scarcity\nEmail 6 (10 days): value + guarantee\nEmail 7 (14 days): final offer\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."}]}\nUse {{first_name}}. Under 120 words per email. Reference real product names and updated prices.`,
            ''),
        ]);

        let e1to3 = { emails: [] }, e4to7 = { emails: [] };
        try { e1to3 = parseSeqJson(emails1to3Raw); } catch { /* use default */ }
        try { e4to7 = parseSeqJson(emails4to7Raw); } catch { /* use default */ }

        const allEmails = [...(e1to3.emails || []), ...(e4to7.emails || [])];
        const emailWaits = [1, 23, 48, 48, 48, 72, 96];
        const emailSteps = [];
        allEmails.forEach((email, i) => {
          emailSteps.push({ step_type: 'wait', content: '', wait_hours: emailWaits[i] || 24 });
          emailSteps.push({ step_type: 'email', subject: email.subject || '', content: email.content || '', wait_hours: 0 });
        });

        // SMS: 4 messages
        const smsRaw = await aiCall(mahdiSystem,
          `Write 4 cart recovery SMS messages for this store.\n\n${ctx}\n\nTiming: immediate, 24h, 72h, 7 days.\nReturn JSON: {"messages":["...","...","...","..."]}\nEach under 160 chars. Use {{first_name}}. Reference updated product names and prices.`,
          '');
        let smsParsed = { messages: [] };
        try { smsParsed = parseSeqJson(smsRaw); } catch { /* use default */ }
        const smsMessages = (smsParsed.messages || []).slice(0, 4);
        const smsWaits = [0, 24, 48, 96];
        const smsSteps = [];
        smsMessages.forEach((msg, i) => {
          if (smsWaits[i] > 0) smsSteps.push({ step_type: 'wait', content: '', wait_hours: smsWaits[i] });
          smsSteps.push({ step_type: 'sms', content: msg, wait_hours: 0 });
        });

        // WhatsApp: 3 messages
        const waRaw = await aiCall(mahdiSystem,
          `Write 3 cart recovery WhatsApp messages for this store.\n\n${ctx}\n\nTiming: 2h, 48h, 7 days.\nReturn JSON: {"messages":["...","...","..."]}\nEach under 200 chars. Use {{first_name}}. Reference updated product names and prices.`,
          '');
        let waParsed = { messages: [] };
        try { waParsed = parseSeqJson(waRaw); } catch { /* use default */ }
        const waMessages = (waParsed.messages || []).slice(0, 3);
        const waWaits = [2, 46, 120];
        const waSteps = [];
        waMessages.forEach((msg, i) => {
          waSteps.push({ step_type: 'wait', content: '', wait_hours: waWaits[i] });
          waSteps.push({ step_type: 'whatsapp', content: msg, wait_hours: 0 });
        });

        // Submit all three to approvals
        await supabase.from('approvals').insert([
          {
            type: 'email_sequence',
            title: `Updated Cart Recovery Emails (7) — ${storeName}`,
            content: `Product data changed for ${storeName}. Mahdi regenerated a 7-email cart recovery sequence with updated product names and prices. Products: ${productList.slice(0, 100)}. AOV: $${aov}. Approve to replace the previous version.`,
            metadata: { steps: emailSteps, trigger_type: 'cart_abandoned', shop, aov, regenerated: true },
            from_member: 'mahdi',
            client_id,
            priority: 'normal',
            status: 'pending',
            created_at: new Date().toISOString()
          },
          {
            type: 'sms_sequence',
            title: `Updated Cart Recovery SMS (4) — ${storeName}`,
            content: `Mahdi regenerated the 4-message SMS sequence for ${storeName} with updated product data. Approve to activate.`,
            metadata: { steps: smsSteps, trigger_type: 'cart_abandoned', shop, aov, regenerated: true },
            from_member: 'mahdi',
            client_id,
            priority: 'normal',
            status: 'pending',
            created_at: new Date().toISOString()
          },
          {
            type: 'whatsapp_sequence',
            title: `Updated Cart Recovery WhatsApp (3) — ${storeName}`,
            content: `Mahdi regenerated the 3-message WhatsApp sequence for ${storeName} with updated product data. Approve to activate.`,
            metadata: { steps: waSteps, trigger_type: 'cart_abandoned', shop, aov, regenerated: true },
            from_member: 'mahdi',
            client_id,
            priority: 'normal',
            status: 'pending',
            created_at: new Date().toISOString()
          },
        ]);

        // Update hash so we don't regenerate tomorrow unless something changes again
        await supabase.from('shopify_connections')
          .update({ last_product_hash: newHash })
          .eq('id', conn.id);

        changed++;
        console.log(`[AUTO] Shopify sync — sequences regenerated for ${shop} (hash changed)`);
        await notifyClientUser(
          client_id,
          'New content is ready for your review',
          `<p>Your product catalog changed, so your AI team regenerated the cart recovery sequences for <strong>${storeName}</strong>.</p><p>Log in to your Sales Scales portal to review and approve the updated content.</p>`
        );
      } catch (connErr) {
        console.error(`[AUTO] Shopify sync failed for ${conn.shop}:`, connErr.message);
      }
    }

    console.log(`[AUTO] Shopify sync complete — ${changed} updated, ${skipped} unchanged`);
  } catch (e) {
    console.error('[AUTO] Shopify sync error:', e.message);
  }
});

// ─── AUTO SCHEDULER: ZAINAB — DAILY CLIENT HEALTH ────────
// Every day at 9am
cron.schedule('0 9 * * *', async () => {
  console.log('[AUTO] Zainab — daily client health check starting...');
  try {
    const { data: clients } = await supabase.from('clients').select('id, name, tier').eq('status', 'active');
    if (!clients || clients.length === 0) return;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    for (const client of clients) {
      try {
        const [enrollRes, clientUserRes] = await Promise.all([
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
            .eq('client_id', client.id).gte('enrolled_at', sevenDaysAgo),
          supabase.from('client_users').select('email, name, last_login').eq('client_id', client.id).maybeSingle(),
        ]);
        const enrollCount = enrollRes.count || 0;
        const clientUser = clientUserRes.data;

        if (enrollCount === 0 && clientUser?.email) {
          const checkinContent = await aiCall(
            `You are Zainab, the Client Partner AI at Sales Scales. Write warm, professional check-in emails that feel personal.`,
            `Write a brief check-in email to ${client.name}. They have had zero workflow enrollments in the past 7 days. Offer to review their sequences together. 3–4 sentences, friendly tone.`,
            ''
          );
          await supabase.from('approvals').insert([{
            type: 'client_checkin',
            title: `Low Engagement Check-in — ${client.name}`,
            content: checkinContent,
            metadata: { to_email: clientUser.email, to_name: clientUser.name || client.name, subject: `Checking in — ${client.name}` },
            from_member: 'zainab',
            client_id: client.id,
            priority: 'normal',
            status: 'pending',
            created_at: new Date().toISOString()
          }]);
          console.log(`[AUTO] Zainab — check-in drafted for ${client.name} (0 enrollments this week)`);
        }

        if (clientUser?.email && clientUser.last_login && new Date(clientUser.last_login) < new Date(fourteenDaysAgo)) {
          const daysSince = Math.floor((Date.now() - new Date(clientUser.last_login)) / 86400000);
          const reengageContent = await aiCall(
            `You are Zainab, the Client Partner AI at Sales Scales. Write warm re-engagement emails that bring clients back.`,
            `Write a re-engagement email to ${client.name}. They haven't logged in for ${daysSince} days. Remind them of the value they're missing, mention their AI team is ready, include a CTA to log in and review their active sequences. 4–5 sentences.`,
            ''
          );
          await supabase.from('approvals').insert([{
            type: 'client_checkin',
            title: `Re-engagement Email — ${client.name}`,
            content: reengageContent,
            metadata: { to_email: clientUser.email, to_name: clientUser.name || client.name, subject: `We miss you — ${client.name}` },
            from_member: 'zainab',
            client_id: client.id,
            priority: 'normal',
            status: 'pending',
            created_at: new Date().toISOString()
          }]);
          console.log(`[AUTO] Zainab — re-engagement drafted for ${client.name} (${daysSince}d inactive)`);
        }
      } catch (clientErr) {
        console.error(`[AUTO] Zainab daily failed for ${client.name}:`, clientErr.message);
      }
    }
    console.log(`[AUTO] Zainab daily health check complete — ${clients.length} clients reviewed`);
  } catch (e) {
    console.error('[AUTO] Zainab daily error:', e.message);
  }
});

// ─── AUTO SCHEDULER: ZAINAB — DAY 7 NEW CLIENT CHECK-IN ──
// Every day at 9:15am — sends first-week congratulations to clients who joined exactly 7 days ago
cron.schedule('15 9 * * *', async () => {
  console.log('[AUTO] Zainab — day 7 new client check-in starting...');
  try {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - 7);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const { data: newClients } = await supabase
      .from('clients')
      .select('id, name, tier')
      .gte('created_at', dayStart.toISOString())
      .lt('created_at', dayEnd.toISOString())
      .eq('status', 'active');

    if (!newClients || newClients.length === 0) {
      console.log('[AUTO] Zainab day 7 — no clients joined 7 days ago');
      return;
    }

    for (const client of newClients) {
      try {
        const [enrollRes, emailRes, clientUserRes] = await Promise.all([
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('channel', 'Email').eq('direction', 'outbound'),
          supabase.from('client_users').select('email, name').eq('client_id', client.id).maybeSingle(),
        ]);

        const enrollCount = enrollRes.count || 0;
        const emailCount = emailRes.count || 0;
        const clientUser = clientUserRes.data;

        const emailContent = await aiCall(
          `You are Zainab, the Client Partner AI at Sales Scales. You write warm, encouraging emails that make clients feel supported and excited. Write like a real person, not a marketing bot. Short sentences, genuine tone. You are Zainab — never break character.`,
          `Write a first-week check-in email to ${client.name} (${client.tier || 'Starter'} plan). They joined Sales Scales 7 days ago.\n\nThis week so far:\n- Contacts enrolled in sequences: ${enrollCount}\n- Emails sent by AI team: ${emailCount}\n\nCongratulate them on their first week. Highlight the activity above. Mention that the system takes 2–4 weeks to hit its stride and they should start seeing real results soon. Let them know the full AI team — Hassan, Hussain, Ali, Mahdi, and Fatima — are all actively working on their account. Encourage them to log in and check their sequences. Keep it under 150 words.`,
          ''
        );

        if (clientUser?.email) {
          const sender = await getClientSender(client.id);
          await sgMail.send({
            to: clientUser.email,
            from: sender,
            subject: `Your first week with Sales Scales — here's what happened`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0">
                <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Sales Scales</div>
                <div style="color:white;font-size:16px;font-weight:600">Your first week ✓</div>
              </div>
              <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 8px 8px;padding:24px">
                <div style="color:#4a5568;font-size:13px;line-height:1.8;white-space:pre-wrap">${emailContent}</div>
                <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid #c9a84c">
                  <div style="font-size:11px;color:#8896a8;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">This week at a glance</div>
                  <div style="display:flex;gap:24px">
                    <div><div style="font-size:22px;font-weight:700;color:#0a1628">${enrollCount}</div><div style="font-size:10px;color:#8896a8">contacts enrolled</div></div>
                    <div><div style="font-size:22px;font-weight:700;color:#0a1628">${emailCount}</div><div style="font-size:10px;color:#8896a8">emails sent</div></div>
                  </div>
                </div>
                <hr style="border:none;border-top:1px solid #e4e9f0;margin:18px 0" />
                <p style="color:#8896a8;font-size:11px;margin:0">Zainab — AI Client Partner · Sales Scales</p>
              </div>
            </div>`,
          });
          console.log(`[AUTO] Zainab day 7 check-in sent to ${client.name} (${emailCount} emails, ${enrollCount} enrollments)`);
        }

        await storeBriefing('zainab', 'yousef',
          `Day 7 Check-in: ${client.name} — Flag for Personal Call`,
          `${client.name} completed their first 7 days on the ${client.tier || 'Starter'} plan.\n\nWeek 1 stats:\n- Contacts enrolled: ${enrollCount}\n- Emails sent: ${emailCount}\n\nZainab sent them an automated first-week check-in email. Recommend scheduling a personal check-in call this week to review their results, answer questions, and lock in retention. Clients contacted personally in week 1 have higher 90-day retention.\n\nAction: ${enrollCount > 0 ? 'Sequences are running — strong start. Book a quick 15-min check-in call.' : 'No enrollments yet — sequences may not be set up. Prioritise this call urgently.'}`,
          'high'
        );
      } catch (clientErr) {
        console.error(`[AUTO] Zainab day 7 failed for ${client.name}:`, clientErr.message);
      }
    }
    console.log(`[AUTO] Zainab day 7 — processed ${newClients.length} new client(s)`);
  } catch (e) {
    console.error('[AUTO] Zainab day 7 error:', e.message);
  }
});

// ─── AUTO SCHEDULER: RETENTION — DAILY HEALTH ALERT ─────
// Every day at 8am — alert Yousef for any client below health score 50
cron.schedule('0 8 * * *', async () => {
  console.log('[AUTO] Retention alert — checking at-risk clients...');
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: atRisk } = await supabase
      .from('clients')
      .select('id, name, tier, health_score')
      .eq('status', 'active')
      .lt('health_score', 50)
      .not('health_score', 'is', null);

    if (!atRisk || atRisk.length === 0) {
      console.log('[AUTO] Retention alert — no at-risk clients today');
      return;
    }

    const enriched = await Promise.all(atRisk.map(async (c) => {
      const [enrollRecent, enrollLast7, completedRes] = await Promise.all([
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('client_id', c.id).gte('enrolled_at', fourteenDaysAgo),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('client_id', c.id).gte('enrolled_at', sevenDaysAgo),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('client_id', c.id).eq('status', 'completed'),
      ]);

      const enroll14d = enrollRecent.count || 0;
      const enroll7d = enrollLast7.count || 0;
      const completed = completedRes.count || 0;

      const issues = [];
      if (enroll14d === 0) issues.push('Zero enrollments in last 14 days — high churn risk');
      else if (enroll7d === 0) issues.push('Zero enrollments in last 7 days');
      if ((c.health_score || 0) < 30) issues.push(`Critical health score: ${c.health_score}/100`);
      else issues.push(`Low health score: ${c.health_score}/100`);
      if (completed === 0) issues.push('No sequences have ever completed');

      return { ...c, enroll14d, enroll7d, completed, issues };
    }));

    const rows = enriched.map(c =>
      `<tr>
        <td style="padding:10px 14px;font-weight:600;color:#0a1628">${c.name}</td>
        <td style="padding:10px 14px;color:#dc2626;font-weight:700">${c.health_score ?? '—'}</td>
        <td style="padding:10px 14px;color:#4a5568">${c.tier || '—'}</td>
        <td style="padding:10px 14px;font-size:12px;color:#4a5568">${c.issues.join('<br>')}</td>
      </tr>`
    ).join('');

    await sgMail.send({
      to: 'yousef@aisalesscales.com',
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
      subject: `⚠ ${atRisk.length} At-Risk Client${atRisk.length !== 1 ? 's' : ''} — Retention Alert`,
      html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px">
        <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0">
          <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Sales Scales</div>
          <div style="color:white;font-size:16px;font-weight:600;margin-top:6px">Daily Retention Alert — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
          <div style="padding:16px 24px;background:#fef2f2;border-bottom:1px solid #fecaca">
            <span style="font-size:13px;color:#dc2626;font-weight:600">${atRisk.length} client${atRisk.length !== 1 ? 's' : ''} with health score below 50 require your attention today.</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#f8fafc">
              <th style="padding:10px 14px;text-align:left;font-size:10px;color:#8896a8;letter-spacing:1.5px;font-weight:700;text-transform:uppercase">Client</th>
              <th style="padding:10px 14px;text-align:left;font-size:10px;color:#8896a8;letter-spacing:1.5px;font-weight:700;text-transform:uppercase">Score</th>
              <th style="padding:10px 14px;text-align:left;font-size:10px;color:#8896a8;letter-spacing:1.5px;font-weight:700;text-transform:uppercase">Tier</th>
              <th style="padding:10px 14px;text-align:left;font-size:10px;color:#8896a8;letter-spacing:1.5px;font-weight:700;text-transform:uppercase">What Dropped</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="padding:16px 24px;border-top:1px solid #e4e9f0;font-size:12px;color:#8896a8">
            Log in to the Retention Dashboard to generate check-in messages for these clients.
          </div>
        </div>
      </div>`,
    });

    console.log(`[AUTO] Retention alert sent — ${atRisk.length} at-risk client(s)`);
  } catch (e) {
    console.error('[AUTO] Retention alert error:', e.message);
  }
});

// ─── AUTO SCHEDULER: HUSSAIN — FRIDAY STRATEGY REPORT ────
// Every Friday at 4pm
cron.schedule('0 16 * * 5', async () => {
  console.log('[AUTO] Hussain — Friday strategy report starting...');
  try {
    const { data: clients } = await supabase
      .from('clients').select('id, name, niche, tier, health_score').eq('status', 'active');
    if (!clients || clients.length === 0) {
      console.log('[AUTO] Hussain Friday — no active clients');
      return;
    }

    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const weeklyData = await Promise.all(clients.map(async (client) => {
      const [ragCtx, enrollRes, contactRes, msgRes, completedRes] = await Promise.all([
        ragSearch(`weekly strategy performance ${client.name}`, client.id),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).gte('enrolled_at', weekStart),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).gte('created_at', weekStart),
        supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).eq('direction', 'outbound').gte('created_at', weekStart),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).eq('status', 'completed').gte('completed_at', weekStart),
      ]);
      return {
        name: client.name, niche: client.niche || 'ecommerce',
        enrollments: enrollRes.count || 0,
        newContacts: contactRes.count || 0,
        messagesSent: msgRes.count || 0,
        completedWorkflows: completedRes.count || 0,
        ragCtx,
      };
    }));

    const weekSummary = weeklyData.map(c =>
      `${c.name}: ${c.enrollments} enrollments, ${c.newContacts} contacts, ${c.messagesSent} messages, ${c.completedWorkflows} completed workflows`
    ).join('\n');
    const sortedByEnrolls = [...weeklyData].sort((a, b) => b.enrollments - a.enrollments);
    const bestClient = sortedByEnrolls[0];
    const weakestClient = sortedByEnrolls[sortedByEnrolls.length - 1];
    const ragContext = weeklyData.map(c => c.ragCtx).filter(Boolean).join('\n\n');

    const report = await aiCall(
      `You are Hussain, the Intelligence and Strategy AI at Sales Scales. You are sharp, data-driven, and think like a founder. Direct, actionable, no fluff. You are Hussain — never mention Claude.`,
      `Generate a Friday end-of-week strategy report for Yousef. Week ending ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.\n\nThis week:\n${weekSummary}\n\nBest: ${bestClient.name} | Needs work: ${weakestClient.name}\n\nWrite a sharp strategy report:\n1. WHAT WORKED THIS WEEK — top 2–3 wins with client names and numbers\n2. WHAT NEEDS FIXING — 2–3 problems to address immediately\n3. OPPORTUNITIES — 2–3 specific growth plays for next week\n4. PRIORITIES FOR NEXT WEEK — ranked list of 4–5 actions, most impactful first\n5. FOUNDER NOTE — one forward-looking strategic insight for Yousef\n\nBe direct. Name names. Use the numbers.`,
      ragContext
    );

    await storeBriefing('hussain', 'yousef',
      `Friday Strategy Report — Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      report, 'high'
    );
    console.log(`[AUTO] Hussain Friday strategy report stored — ${clients.length} clients analyzed`);
  } catch (e) {
    console.error('[AUTO] Hussain Friday error:', e.message);
  }
});

// ─── INBOUND SMS WEBHOOK ──────────────────────────────────
const SMS_OPT_OUT_KEYWORDS = new Set(['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'OPTOUT', 'OPT OUT', 'OPT-OUT']);

app.post('/sms/inbound', async (req, res) => {
  const { From, Body } = req.body;
  console.log('Inbound SMS from:', From, '— Message:', Body);
  const bodyNorm = (Body || '').trim().toUpperCase();
  try {
    // Fix 1: SMS opt-out handling
    if (SMS_OPT_OUT_KEYWORDS.has(bodyNorm)) {
      const { data: optContact } = await supabase.from('contacts').select('id, tags').eq('phone', From).maybeSingle();
      if (optContact) {
        await supabase.from('workflow_enrollments').update({ status: 'cancelled' }).eq('contact_id', optContact.id).eq('status', 'active');
        const updatedTags = Array.isArray(optContact.tags) ? optContact.tags : [];
        if (!updatedTags.includes('opted_out_sms')) {
          await supabase.from('contacts').update({ tags: [...updatedTags, 'opted_out_sms'] }).eq('id', optContact.id);
        }
      }
      res.set('Content-Type', 'text/xml');
      res.send('<Response><Message>You have been unsubscribed from all messages.</Message></Response>');
      return;
    }

    const { data: contact } = await supabase
      .from('contacts').select('*').eq('phone', From).single();
    if (contact) {
      await supabase.from('messages').insert([{
        client_id: contact.client_id,
        contact_id: contact.id,
        channel: 'SMS', direction: 'inbound',
        sender_name: contact.first_name + ' ' + contact.last_name,
        sender_phone: From, content: Body, status: 'unread'
      }]);
      // Fix 4: engagement score +30 for SMS reply
      const smsNewScore = (contact.engagement_score || 0) + 30;
      await supabase.from('contacts').update({ engagement_score: smsNewScore }).eq('id', contact.id);
      await checkAndTagHotLead(contact.id, contact.client_id, smsNewScore);
      await supabase.from('workflow_enrollments')
        .update({ status: 'paused' })
        .eq('contact_id', contact.id)
        .eq('status', 'active');
      console.log('Inbound SMS saved and workflow paused for:', contact.first_name);
      // Fix 1: human takeover — skip all automated responses if a human is handling this conversation
      if (contact.human_takeover) {
        console.log(`[human-takeover] Skipping automated SMS response for ${contact.first_name} — human is handling`);
        res.set('Content-Type', 'text/xml');
        res.send('<Response></Response>');
        return;
      }
      const { data: smsClient } = await supabase.from('clients').select('name').eq('id', contact.client_id).maybeSingle();
      const smsAssessment = await assessInboundConfidence('SMS', Body, smsClient?.name);
      if (!smsAssessment.confident) {
        await storeBriefing('fatima', 'yousef',
          `Unhandled SMS from ${contact.first_name} ${contact.last_name || ''}`.trim(),
          `An inbound SMS needs your manual response — the AI could not respond confidently.\n\nReason: ${smsAssessment.reason}\nContact: ${contact.first_name} ${contact.last_name || ''} (${From})\nClient: ${smsClient?.name || 'unknown'}\n\nMessage:\n${Body}\n\nReply via the Inbox.`,
          'urgent', contact.client_id
        ).catch(e => console.error('Unhandled SMS briefing failed:', e.message));
      }
      await handleRefundRequest('SMS', contact, From, Body);
      await handleBrandDeal('SMS', contact, Body);
    } else {
      await supabase.from('messages').insert([{
        channel: 'SMS', direction: 'inbound',
        sender_name: From, sender_phone: From,
        content: Body, status: 'unread'
      }]);
      console.log('Inbound SMS from unknown contact:', From);
    }
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (e) {
    console.error('Inbound SMS error:', e.message);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }
});

// ─── INBOUND WHATSAPP WEBHOOK ──────────────────────────────
app.post('/whatsapp/inbound', async (req, res) => {
  const { From, Body } = req.body;
  const phone = From.replace('whatsapp:', '');
  console.log('Inbound WhatsApp from:', phone, '— Message:', Body);
  try {
    const { data: contact } = await supabase
      .from('contacts').select('*').eq('phone', phone).single();
    if (contact) {
      await supabase.from('messages').insert([{
        client_id: contact.client_id,
        contact_id: contact.id,
        channel: 'WhatsApp', direction: 'inbound',
        sender_name: contact.first_name + ' ' + contact.last_name,
        sender_phone: phone, content: Body, status: 'unread'
      }]);
      await supabase.from('workflow_enrollments')
        .update({ status: 'paused' })
        .eq('contact_id', contact.id)
        .eq('status', 'active');
      // Fix 4: engagement score +30 for WhatsApp reply
      const waNewScore = (contact.engagement_score || 0) + 30;
      await supabase.from('contacts').update({ engagement_score: waNewScore }).eq('id', contact.id);
      await checkAndTagHotLead(contact.id, contact.client_id, waNewScore);
      console.log('Inbound WhatsApp saved and workflow paused for:', contact.first_name);
      // Fix 1: human takeover — skip all automated responses if a human is handling this conversation
      if (contact.human_takeover) {
        console.log(`[human-takeover] Skipping automated WhatsApp response for ${contact.first_name} — human is handling`);
        res.set('Content-Type', 'text/xml');
        res.send('<Response></Response>');
        return;
      }
      const { data: waClient } = await supabase.from('clients').select('name').eq('id', contact.client_id).maybeSingle();
      const waAssessment = await assessInboundConfidence('WhatsApp', Body, waClient?.name);
      if (!waAssessment.confident) {
        await storeBriefing('fatima', 'yousef',
          `Unhandled WhatsApp from ${contact.first_name} ${contact.last_name || ''}`.trim(),
          `An inbound WhatsApp message needs your manual response — the AI could not respond confidently.\n\nReason: ${waAssessment.reason}\nContact: ${contact.first_name} ${contact.last_name || ''} (${phone})\nClient: ${waClient?.name || 'unknown'}\n\nMessage:\n${Body}\n\nReply via the Inbox.`,
          'urgent', contact.client_id
        ).catch(e => console.error('Unhandled WhatsApp briefing failed:', e.message));
      }
      await handleRefundRequest('WhatsApp', contact, phone, Body);
      await handleBrandDeal('WhatsApp', contact, Body);
    } else {
      await supabase.from('messages').insert([{
        channel: 'WhatsApp', direction: 'inbound',
        sender_name: phone, sender_phone: phone,
        content: Body, status: 'unread'
      }]);
      console.log('Inbound WhatsApp from unknown contact:', phone);
    }
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (e) {
    console.error('Inbound WhatsApp error:', e.message);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }
});

// ─── FIX 2: EMAIL INBOUND REPLY DETECTION ─────────────────
// SendGrid inbound parse webhook — configure in SendGrid dashboard:
// Settings → Inbound Parse → Add Host & URL → https://your-domain.com/email/inbound
app.post('/email/inbound', upload.any(), async (req, res) => {
  res.sendStatus(200); // acknowledge immediately
  try {
    const from = (req.body.from || '').match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]+/)?.[0];
    const text  = req.body.text || req.body.html || '';
    const subject = req.body.subject || '';
    if (!from) return;

    const { data: contact } = await supabase.from('contacts').select('*').eq('email', from).maybeSingle();
    if (!contact) return;

    // Pause active enrollments
    await supabase.from('workflow_enrollments').update({ status: 'paused' })
      .eq('contact_id', contact.id).eq('status', 'active');

    // Store as inbound message
    await supabase.from('messages').insert([{
      client_id: contact.client_id, contact_id: contact.id,
      channel: 'Email', direction: 'inbound',
      sender_name: contact.first_name ? `${contact.first_name} ${contact.last_name || ''}`.trim() : from,
      content: subject ? `Subject: ${subject}\n\n${text.slice(0, 2000)}` : text.slice(0, 2000),
      status: 'unread',
    }]);

    // Fatima briefing for manual review
    await storeBriefing('fatima', 'yousef',
      `Email Reply — ${contact.first_name || from}`,
      `${contact.first_name || from} replied to a sequence email. Their active enrollments have been paused pending review.\n\nSubject: ${subject || '(no subject)'}\n\nMessage:\n${text.slice(0, 800)}`,
      'high', contact.client_id
    );
    console.log(`Email reply detected from ${from} — enrollments paused, Fatima briefed`);
  } catch (e) {
    console.error('Email inbound error:', e.message);
  }
});

// ─── FIX 4: WORKFLOW STEP EDITOR ──────────────────────────
app.put('/workflow-steps/:id', async (req, res) => {
  const { content, subject, wait_hours, step_type } = req.body;
  try {
    const updates = {};
    if (content !== undefined) updates.content = content;
    if (subject !== undefined) updates.subject = subject;
    if (wait_hours !== undefined) updates.wait_hours = parseInt(wait_hours, 10) || 0;
    if (step_type !== undefined) updates.step_type = step_type;
    const { data, error } = await supabase.from('workflow_steps').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ step: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/workflow-steps/:workflow_id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('workflow_steps').select('*').eq('workflow_id', req.params.workflow_id).order('step_order');
    if (error) throw error;
    res.json({ steps: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 3: WORKFLOW PAUSE / RESUME ENROLLMENTS ───────────
app.post('/workflows/pause', verifyToken, async (req, res) => {
  if (!verifyClientOwnership(req)) return res.status(403).json({ error: 'Forbidden' });
  const { workflow_id, client_id } = req.body;
  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });
  try {
    const { count } = await supabase.from('workflow_enrollments')
      .update({ status: 'paused' })
      .eq('workflow_id', workflow_id)
      .eq('status', 'active')
      .select('id', { count: 'exact', head: true });
    res.json({ ok: true, paused: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/workflows/resume', verifyToken, async (req, res) => {
  if (!verifyClientOwnership(req)) return res.status(403).json({ error: 'Forbidden' });
  const { workflow_id } = req.body;
  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });
  try {
    const { count } = await supabase.from('workflow_enrollments')
      .update({ status: 'active' })
      .eq('workflow_id', workflow_id)
      .eq('status', 'paused')
      .select('id', { count: 'exact', head: true });
    res.json({ ok: true, resumed: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 4: MANUAL CONTACT ENROLLMENT ─────────────────────
app.post('/contacts/enroll', verifyToken, async (req, res) => {
  if (!verifyClientOwnership(req)) return res.status(403).json({ error: 'Forbidden' });
  const { contact_id, workflow_id, client_id } = req.body;
  if (!contact_id || !workflow_id || !client_id) return res.status(400).json({ error: 'contact_id, workflow_id, and client_id are required' });
  try {
    const { data: existing } = await supabase.from('workflow_enrollments')
      .select('id, status').eq('contact_id', contact_id).eq('workflow_id', workflow_id).maybeSingle();
    if (existing && existing.status === 'active') return res.status(409).json({ error: 'Contact is already actively enrolled in this workflow' });

    const { data: steps } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflow_id).order('step_order');
    if (!steps || steps.length === 0) return res.status(400).json({ error: 'Workflow has no steps' });

    const firstStep = steps[0];
    const nextStepAt = new Date();
    if (firstStep.step_type === 'wait') nextStepAt.setHours(nextStepAt.getHours() + (firstStep.wait_hours || 1));

    const { data: enrollment, error } = await supabase.from('workflow_enrollments').insert([{
      workflow_id, contact_id, client_id,
      status: 'active', current_step: 1,
      enrolled_at: new Date().toISOString(),
      next_step_at: nextStepAt.toISOString(),
    }]).select().single();
    if (error) throw error;
    res.json({ ok: true, enrollment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 5: CSV CONTACT IMPORT ────────────────────────────
// SQL: no new columns needed — uses existing contacts table
const parseCSV = (text) => {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const cols = []; let cur = ''; let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(l => {
    const vals = parseLine(l);
    return headers.reduce((obj, h, i) => { obj[h] = vals[i] || ''; return obj; }, {});
  });
  return { headers, rows };
};

// Fix 3: validates rows without importing — returns preview of first 5 rows + validation errors
app.post('/contacts/import/preview', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  try {
    const text = req.file.buffer.toString('utf-8');
    const { rows } = parseCSV(text);
    if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty or has no data rows' });
    const preview = rows.slice(0, 5);
    const validation = rows.map((row, idx) => {
      const issues = [];
      const email = (row.email || '').trim();
      if (!email) issues.push('email is required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('email format invalid');
      if (!(row.first_name || '').trim()) issues.push('first_name is required');
      const phone = (row.phone || '').trim();
      if (phone && phone.replace(/\D/g, '').length < 10) issues.push('phone must be 10+ digits or blank');
      return { row: idx + 2, email: email || '(missing)', issues };
    }).filter(v => v.issues.length > 0);
    res.json({ total: rows.length, preview, validation, valid: rows.length - validation.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/contacts/import', upload.single('file'), async (req, res) => {
  const { client_id } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  try {
    const text = req.file.buffer.toString('utf-8');
    const { rows } = parseCSV(text);
    if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty or has no data rows' });

    let imported = 0;
    const errors = [];
    for (const [idx, row] of rows.entries()) {
      const rowNum = idx + 2;
      const email = (row.email || '').trim().toLowerCase();
      const firstName = (row.first_name || '').trim();
      const phone = (row.phone || '').replace(/\D/g, '');

      // Fix 3: detailed per-row validation
      if (!firstName) { errors.push({ row: rowNum, field: 'first_name', message: 'first_name is required' }); continue; }
      if (!email) { errors.push({ row: rowNum, field: 'email', message: 'email is required' }); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push({ row: rowNum, field: 'email', message: `"${email}" is not a valid email address` }); continue; }
      if (phone && phone.length < 10) { errors.push({ row: rowNum, field: 'phone', message: `phone "${row.phone}" must be 10+ digits or left blank` }); continue; }

      const { error } = await supabase.from('contacts').upsert([{
        first_name: firstName,
        last_name:  (row.last_name  || '').trim(),
        email,
        phone: phone ? (row.phone || '').trim() : null,
        client_id,
        source: 'CSV Import', channel: 'Email',
        pipeline_stage: 'New Lead',
        last_activity: new Date().toISOString(),
      }], { onConflict: 'email,client_id' });
      if (error) { errors.push({ row: rowNum, field: 'db', message: error.message }); }
      else { imported++; }
    }
    res.json({ ok: true, imported, errors, total: rows.length, skipped: errors.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SENDGRID EMAIL TRACKING ──────────────────────────────
app.post('/email/tracking', async (req, res) => {
  const events = req.body;
  console.log('Email tracking events received:', events.length);
  try {
    for (const event of events) {
      const { email, event: eventType, timestamp, url } = event;
      console.log(`Email event: ${eventType} — ${email}`);
      const { data: contact } = await supabase
        .from('contacts').select('*').eq('email', email).single();
      if (contact) {
        await supabase.from('activity').insert([{
          contact_id: contact.id, client_id: contact.client_id,
          type: eventType,
          description: eventType === 'open' ? 'Opened email' : eventType === 'click' ? `Clicked link: ${url}` : eventType,
          created_at: new Date(timestamp * 1000).toISOString()
        }]);
        if (eventType === 'open' || eventType === 'click') {
          // Fix 4: update engagement_score (+10 open, +20 click)
          const scoreIncrement = eventType === 'open' ? 10 : 20;
          const emailNewScore = (contact.engagement_score || 0) + scoreIncrement;
          await supabase.from('contacts').update({
            last_activity: new Date(timestamp * 1000).toISOString(),
            engagement_score: emailNewScore,
          }).eq('id', contact.id);
          await checkAndTagHotLead(contact.id, contact.client_id, emailNewScore);
          // Fix 9: auto-tag based on behaviour
          const behavTag = eventType === 'open' ? 'email_opener' : 'link_clicker';
          const existTags = contact.tags || [];
          if (!existTags.includes(behavTag)) {
            await supabase.from('contacts').update({ tags: [...existTags, behavTag] }).eq('id', contact.id);
          }
        }
        if (eventType === 'click') {
          await supabase.from('workflow_enrollments')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('contact_id', contact.id).eq('status', 'active');
        }
        if (eventType === 'unsubscribe' || eventType === 'group_unsubscribe') {
          await supabase.from('contacts').update({ status: 'unsubscribed' }).eq('id', contact.id);
          await supabase.from('workflow_enrollments')
            .update({ status: 'cancelled' })
            .eq('contact_id', contact.id).eq('status', 'active');
        }
        if (eventType === 'bounce' || eventType === 'dropped') {
          await supabase.from('contacts').update({ status: 'bounced' }).eq('id', contact.id);
          await supabase.from('workflow_enrollments')
            .update({ status: 'cancelled' })
            .eq('contact_id', contact.id).eq('status', 'active');
        }
      }
    }
    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Email tracking error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── EMAIL OPEN / CLICK TRACKING ─────────────────────────
app.post('/email/track-open', async (req, res) => {
  const { message_id } = req.body;
  if (!message_id) return res.status(400).json({ error: 'message_id required' });
  try {
    await supabase.from('messages')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', message_id).is('opened_at', null);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/email/track-click', async (req, res) => {
  const { message_id } = req.body;
  if (!message_id) return res.status(400).json({ error: 'message_id required' });
  try {
    await supabase.from('messages')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', message_id).is('clicked_at', null);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── AUDIT ────────────────────────────────────────────────
app.post('/audit', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `You are a Shopify store analyst for Sales Scales. Analyze the store and return JSON only — no markdown, no explanation, no extra text. Return this exact structure:
{
  "brandName": "Brand Name",
  "niche": "e.g. Travel Bags",
  "estimatedAOV": "$XX",
  "score": 35,
  "hasEmailPopup": true,
  "hasCartRecovery": "likely",
  "hasSMS": false,
  "hasWhatsApp": false,
  "hasAIVoice": false,
  "estimatedMonthlyRevenue": "$XXK",
  "biggestGap": "one sentence describing the biggest revenue gap",
  "pitchMessage": "personalised outreach message to the founder explaining what they are missing and how Sales Scales can fix it"
}`,
        messages: [{ role: 'user', content: `Audit this Shopify store and identify all revenue gaps: ${url}` }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    const text = response.data.content[0].text.trim().replace(/```json|```/g, '');
    const audit = JSON.parse(text);
    res.json(audit);
  } catch (e) {
    console.error('Audit error:', e.message);
    res.status(500).json({ error: 'Audit failed', details: e.message });
  }
});

// ─── GENERATE AI REPLY ────────────────────────────────────
app.post('/generate-reply', async (req, res) => {
  const { channel, senderName, content, clientName } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `You are an AI assistant for Sales Scales helping respond to customer messages on behalf of clients. Write a professional, friendly, and helpful reply. Keep it concise and appropriate for the channel. Do not use placeholders like [name] - write a complete ready to send message.`,
        messages: [{ role: 'user', content: `Channel: ${channel}\nClient: ${clientName}\nCustomer name: ${senderName}\nCustomer message: ${content}\n\nWrite a reply to this message.` }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    const reply = response.data.content[0].text.trim();
    res.json({ reply });
  } catch (e) {
    console.error('Generate reply error:', e.message);
    res.status(500).json({ error: 'Failed to generate reply', details: e.message });
  }
});

// ─── TWILIO SUB-ACCOUNT PROVISIONING ─────────────────────
app.post('/twilio/provision-number', async (req, res) => {
  const { client_id, area_code } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return res.status(500).json({ error: 'Master Twilio credentials not configured' });
  }
  try {
    const { data: client } = await supabase
      .from('clients').select('id, name, twilio_subaccount_sid').eq('id', client_id).maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (client.twilio_subaccount_sid) {
      return res.status(409).json({ error: 'Client already has a Twilio sub-account. Release it before provisioning a new one.' });
    }

    const masterClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Create sub-account under master
    const subAccount = await masterClient.api.accounts.create({
      friendlyName: `Sales Scales — ${client.name}`,
    });
    const { sid: subSid, authToken: subToken } = subAccount;

    // Use sub-account credentials to search for a local US number
    const subClient = twilio(subSid, subToken);
    const searchParams = { smsEnabled: true, limit: 1 };
    if (area_code) searchParams.areaCode = area_code;
    const available = await subClient.availablePhoneNumbers('US').local.list(searchParams);
    if (!available || available.length === 0) {
      // Clean up the sub-account we just created since we can't get a number
      await masterClient.api.accounts(subSid).update({ status: 'closed' });
      return res.status(404).json({ error: 'No available phone numbers found for that area code. Try a different area code or leave it blank.' });
    }

    // Purchase the number inside the sub-account
    const purchased = await subClient.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
    });

    // Persist all three values to the clients table
    const { error: updateErr } = await supabase.from('clients').update({
      twilio_subaccount_sid: subSid,
      twilio_subaccount_token: subToken,
      twilio_phone_number: purchased.phoneNumber,
    }).eq('id', client_id);
    if (updateErr) throw updateErr;

    console.log(`Twilio number provisioned for ${client.name}: ${purchased.phoneNumber} (sub-account ${subSid})`);
    res.json({
      ok: true,
      phone_number: purchased.phoneNumber,
      subaccount_sid: subSid,
      friendly_name: purchased.friendlyName,
    });
  } catch (e) {
    console.error('Twilio provision error:', e.message);
    res.status(500).json({ error: 'Failed to provision number', details: e.message });
  }
});

// ─── SEND SMS ─────────────────────────────────────────────
app.post('/send-sms', async (req, res) => {
  const { to, message, clientId } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });
  try {
    const { tc: client, from } = await getClientTwilio(clientId);
    const result = await client.messages.create({ body: message, from, to });
    console.log('SMS sent:', result.sid);
    res.json({ success: true, sid: result.sid });
  } catch (e) {
    console.error('SMS error:', e.message);
    res.status(500).json({ error: 'Failed to send SMS', details: e.message });
  }
});

// ─── SEND WHATSAPP ────────────────────────────────────────
app.post('/send-whatsapp', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({
      body: message,
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: 'whatsapp:' + to
    });
    console.log('WhatsApp sent:', result.sid);
    res.json({ success: true, sid: result.sid });
  } catch (e) {
    console.error('WhatsApp error:', e.message);
    res.status(500).json({ error: 'Failed to send WhatsApp message', details: e.message });
  }
});

// ─── SEND EMAIL ───────────────────────────────────────────
app.post('/send-email', async (req, res) => {
  const { to, subject, html, from, fromName, clientId } = req.body;
  if (!to || !subject || !html) return res.status(400).json({ error: 'Missing to, subject, or html' });
  try {
    const fallbackSender = await getClientSender(clientId);
    await sgMail.send({ to, from: { email: from || fallbackSender.email, name: fromName || fallbackSender.name }, subject, html });
    console.log('Email sent to:', to);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (e) {
    console.error('Email error:', e.message);
    res.status(500).json({ error: 'Failed to send email', details: e.message });
  }
});

// ─── EXECUTE WORKFLOW STEP ────────────────────────────────
app.post('/execute-step', async (req, res) => {
  const { stepType, to, subject, message, contactName, clientName, clientId } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });
  try {
    if (stepType === 'sms') {
      const { tc: client, from } = await getClientTwilio(clientId);
      const result = await client.messages.create({ body: message, from, to });
      res.json({ success: true, channel: 'sms', sid: result.sid });
    } else if (stepType === 'whatsapp') {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const result = await client.messages.create({ body: message, from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, to: 'whatsapp:' + to });
      res.json({ success: true, channel: 'whatsapp', sid: result.sid });
    } else if (stepType === 'email') {
      const sender = await getClientSender(clientId);
      await sgMail.send({ to, from: { email: sender.email, name: clientName || sender.name }, subject: subject || 'Message from ' + (clientName || sender.name), html: `<p>Hi ${contactName || 'there'},</p><p>${message}</p>` });
      res.json({ success: true, channel: 'email' });
    } else {
      res.json({ success: true, channel: stepType, note: 'Channel logged' });
    }
  } catch (e) {
    console.error('Execute step error:', e.message);
    res.status(500).json({ error: 'Failed to execute step', details: e.message });
  }
});

// ─── UNENROLL CONTACT FROM ALL ACTIVE SEQUENCES ──────────
app.post('/enrollments/unenroll', async (req, res) => {
  const { contact_id, client_id } = req.body;
  if (!contact_id) return res.status(400).json({ error: 'contact_id required' });
  try {
    const now = new Date().toISOString();
    let query = supabase.from('workflow_enrollments')
      .update({ status: 'cancelled', completed_at: now })
      .eq('contact_id', contact_id).eq('status', 'active');
    if (client_id) query = query.eq('client_id', client_id);
    const { data, error } = await query.select('id');
    if (error) throw error;
    const count = data?.length || 0;
    if (count > 0) {
      await supabase.from('activity').insert([{
        contact_id,
        client_id: client_id || null,
        type: 'unenrolled',
        description: `Manually unenrolled from ${count} active sequence${count !== 1 ? 's' : ''}`,
        created_at: now,
      }]);
    }
    res.json({ ok: true, cancelled: count });
  } catch (e) {
    console.error('Unenroll error:', e.message);
    res.status(500).json({ error: 'Failed to unenroll', details: e.message });
  }
});

// ─── ENROLL CONTACT IN WORKFLOW ───────────────────────────
app.post('/enroll-contact', async (req, res) => {
  const { workflowId, contactId, clientId, contactEmail, contactPhone, contactName } = req.body;
  if (!workflowId || !contactId) return res.status(400).json({ error: 'Missing workflowId or contactId' });
  try {
    const { data: steps } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflowId).order('step_order');
    if (!steps || steps.length === 0) return res.status(400).json({ error: 'No steps found for this workflow' });
    const { data: enrollment } = await supabase.from('workflow_enrollments').insert([{
      workflow_id: workflowId, contact_id: contactId, client_id: clientId,
      status: 'active', current_step: 1,
      enrolled_at: new Date().toISOString(), next_step_at: new Date().toISOString()
    }]).select().single();
    const firstStep = steps[0];
    if (firstStep.step_type !== 'wait' && firstStep.content) {
      if (firstStep.step_type === 'sms' && contactPhone) {
        const { tc: twilioClient, from: twilioFrom } = await getClientTwilio(clientId);
        await twilioClient.messages.create({ body: firstStep.content.replace('{{first_name}}', contactName || 'there'), from: twilioFrom, to: contactPhone });
      } else if (firstStep.step_type === 'whatsapp' && contactPhone) {
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await twilioClient.messages.create({ body: firstStep.content.replace('{{first_name}}', contactName || 'there'), from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, to: 'whatsapp:' + contactPhone });
      } else if (firstStep.step_type === 'email' && contactEmail) {
        const sender = await getClientSender(clientId);
        await sgMail.send({ to: contactEmail, from: sender, subject: firstStep.subject || 'Message for you', html: `<p>${firstStep.content.replace('{{first_name}}', contactName || 'there')}</p>` });
      }
      await supabase.from('messages').insert([{ client_id: clientId, contact_id: contactId, channel: firstStep.step_type, direction: 'outbound', sender_name: 'Sales Scales AI', content: firstStep.content, status: 'sent' }]);
    }
    await supabase.from('workflow_enrollments').update({ current_step: 2 }).eq('id', enrollment.id);
    await supabase.from('workflows').update({ enrolled_count: steps.length }).eq('id', workflowId);
    res.json({ success: true, enrollmentId: enrollment?.id, stepsCount: steps.length });
  } catch (e) {
    console.error('Enrollment error:', e.message);
    res.status(500).json({ error: 'Failed to enroll contact', details: e.message });
  }
});

// ─── GENERATE EMBEDDING ───────────────────────────────────
app.post('/generate-embedding', async (req, res) => {
  const { text, documentId } = req.body;
  if (!text || !documentId) return res.status(400).json({ error: 'Missing text or documentId' });
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: `Summarize this text in 2 sentences: ${text.substring(0, 1000)}` }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    const summary = response.data.content[0].text;
    const embeddingResponse = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: summary, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    const embedding = embeddingResponse.data.data[0].embedding;
    await supabase.from('knowledge_base').update({ embedding }).eq('id', documentId);
    res.json({ success: true });
  } catch (e) {
    console.error('Embedding error:', e.message);
    res.status(500).json({ error: 'Embedding failed', details: e.message });
  }
});

// ─── SEARCH KNOWLEDGE BASE ────────────────────────────────
app.post('/search-knowledge', async (req, res) => {
  const { query, clientId } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });
  try {
    const embeddingResponse = await axios.post(
      'https://api.openai.com/v1/embeddings',
      { input: query, model: 'text-embedding-3-small' },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    const queryEmbedding = embeddingResponse.data.data[0].embedding;
    const { data: results } = await supabase.rpc('search_knowledge_base', {
      query_embedding: queryEmbedding,
      client_id_filter: clientId || null,
      match_count: 5
    });
    res.json({ success: true, results: results || [] });
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ error: 'Search failed', details: e.message });
  }
});

// ─── TEAM BRIEFING ENDPOINTS ─────────────────────────────
app.post('/team/brief', async (req, res) => {
  const { from_member, to_member, subject, content, priority, client_id, scheduled_for } = req.body;
  if (!from_member || !to_member || !subject || !content) {
    return res.status(400).json({ error: 'Missing required fields: from_member, to_member, subject, content' });
  }
  try {
    const { data: briefing, error } = await supabase.from('team_briefings').insert([{
      from_member, to_member, subject, content,
      priority: priority || 'normal',
      client_id: client_id || null,
      scheduled_for: scheduled_for || null,
      is_read: false,
      created_at: new Date().toISOString()
    }]).select().single();
    if (error) throw error;
    console.log(`Team briefing: ${from_member} → ${to_member} [${priority || 'normal'}] "${subject}"`);
    res.json({ success: true, briefing });
  } catch (e) {
    console.error('Create briefing error:', e.message);
    res.status(500).json({ error: 'Failed to create briefing', details: e.message });
  }
});

app.get('/team/briefings', async (req, res) => {
  const { recipient, sender } = req.query;
  try {
    let query = supabase.from('team_briefings').select('*').order('created_at', { ascending: false });
    if (recipient && recipient !== 'all') query = query.eq('to_member', recipient);
    if (sender) query = query.eq('from_member', sender);
    const { data: briefings, error } = await query;
    if (error) throw error;
    res.json({ briefings: briefings || [] });
  } catch (e) {
    console.error('Briefings fetch error:', e.message);
    res.status(500).json({ error: 'Failed to fetch briefings', details: e.message });
  }
});

app.get('/team/performance', async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const emptyStats = {
    mahdi:   { sequences_generated: 0, content_pieces: 0 },
    hassan:  { prospects_found: 0, outreach_sent: 0 },
    hussain: { briefings_generated: 0, competitor_reports: 0 },
    fatima:  { issues_flagged: 0, refunds_handled: 0 },
    zainab:  { reports_sent: 0, client_chats: 0 },
    ali:     { closing_scripts: 0 },
  };
  try {
    const [briefingsRes, approvalsRes] = await Promise.all([
      supabase.from('team_briefings').select('from_member, subject, created_at').gte('created_at', weekAgo),
      supabase.from('approvals').select('from_member, type, created_at').gte('created_at', weekAgo),
    ]);

    if (briefingsRes.error) console.error('/team/performance briefings error:', briefingsRes.error.message);
    if (approvalsRes.error) console.error('/team/performance approvals error:', approvalsRes.error.message);

    const briefings = briefingsRes.data || [];
    const approvals = approvalsRes.data || [];

    const stats = {
      mahdi: {
        sequences_generated: approvals.filter(a => a.from_member === 'mahdi' && ['email_sequence', 'sms_sequence', 'whatsapp_sequence'].includes(a.type)).length,
        content_pieces: briefings.filter(b => b.from_member === 'mahdi').length,
      },
      hassan: {
        prospects_found: approvals.filter(a => a.from_member === 'hassan' && a.type === 'prospect').length,
        outreach_sent: briefings.filter(b => b.from_member === 'hassan').length,
      },
      hussain: {
        briefings_generated: briefings.filter(b => b.from_member === 'hussain').length,
        competitor_reports: approvals.filter(a => a.from_member === 'hussain' && a.type === 'competitor_report').length,
      },
      fatima: {
        issues_flagged: briefings.filter(b => b.from_member === 'fatima').length,
        refunds_handled: approvals.filter(a => a.from_member === 'fatima' && /refund|return/.test(a.type || '')).length,
      },
      zainab: {
        reports_sent: briefings.filter(b => b.from_member === 'zainab').length,
        client_chats: approvals.filter(a => a.from_member === 'zainab').length,
      },
      ali: {
        closing_scripts: briefings.filter(b => b.from_member === 'ali').length,
      },
    };

    res.json({ stats, week_start: weekAgo });
  } catch (e) {
    console.error('/team/performance error:', e.message);
    res.json({ stats: emptyStats, week_start: weekAgo, error: e.message });
  }
});

// ─── APPROVAL ENDPOINTS ──────────────────────────────────
const notifyAfterSubmit = (data, title) => {
  if (!data) return;
  (async () => {
    try {
      let clientName = null;
      if (data.client_id) {
        const { data: cl } = await supabase.from('clients').select('name').eq('id', data.client_id).maybeSingle();
        clientName = cl?.name || null;
      }
      await sendApprovalSlackNotification(data, clientName);
    } catch {}
  })();
  if (data.client_id) {
    notifyClientUserBranded(
      data.client_id,
      'New content is ready for your review',
      `<p>Your AI team has prepared new content — <strong>${title}</strong> — that is ready for your review.</p><p>Log in to your Sales Scales portal to review and approve it.</p>`
    ).catch(() => {});
    createClientNotification(data.client_id, 'New approval pending', `"${title}" is ready for your review`, 'approval').catch(() => {});
  }
};

app.post('/approvals/submit', async (req, res) => {
  const { type, title, content, metadata, from_member, client_id } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title are required' });
  try {
    const priority = inferApprovalPriority(type, title, from_member);
    const isSequence = ['email_sequence', 'sms_sequence', 'whatsapp_sequence'].includes(type);
    const isUrgent = priority === 'urgent' || /refund|return|complaint|dispute|money.?back|brand.?deal/i.test(title + ' ' + (content || ''));

    // ─── Auto-approval logic (Fix 1) ──────────────────────
    if (isSequence && !isUrgent) {
      const [confidenceScore, autoEnabled] = await Promise.all([
        calculateConfidenceScore(type, title, content, metadata, from_member),
        getAutoApproveEnabled(),
      ]);

      if (autoEnabled && confidenceScore >= 9) {
        // High confidence → activate workflow directly, log as auto_approved
        const meta = metadata || {};
        const steps = Array.isArray(meta.steps) ? meta.steps : [];
        const { data: wf } = await supabase.from('workflows').insert([{
          name: title,
          client_id: client_id || null,
          trigger_type: meta.trigger_type || 'manual',
          status: 'active',
          enrolled_count: 0,
        }]).select().single();
        if (wf && steps.length > 0) {
          await supabase.from('workflow_steps').insert(
            steps.map((s, i) => ({
              workflow_id: wf.id, step_order: i,
              step_type: s.step_type || (type === 'sms_sequence' ? 'sms' : 'email'),
              content: s.content || '', subject: s.subject || null, wait_hours: s.wait_hours || 0,
            }))
          );
        }
        const { data: autoData } = await supabase.from('approvals').insert([{
          type, title, content: content || '',
          metadata: { ...(metadata || {}), workflow_id: wf?.id },
          from_member: from_member || 'system',
          client_id: client_id || null,
          priority, status: 'auto_approved',
          confidence_score: confidenceScore, auto_approved: true,
          created_at: new Date().toISOString()
        }]).select().single();
        console.log(`[AutoApprove] "${title}" — score ${confidenceScore}/10`);
        return res.json({ approval: autoData, auto_approved: true, confidence_score: confidenceScore });
      }

      if (confidenceScore < 7) {
        // Low confidence → Mahdi rewrites before submitting
        try {
          const pseudoApproval = { type, title, content, metadata, client_id: client_id || null, from_member, priority };
          const revised = await reviseApprovalWithMahdi(pseudoApproval, 'Content scored below quality threshold — improve clarity, brand voice, and persuasiveness.');
          if (revised) return res.json({ approval: revised, rewritten: true, original_score: confidenceScore });
        } catch (rewriteErr) {
          console.error('Auto-rewrite failed:', rewriteErr.message);
        }
      }

      // Score 7–8 or rewrite failed → submit normally with score
      const { data, error } = await supabase.from('approvals').insert([{
        type, title, content: content || '',
        metadata: metadata || {},
        from_member: from_member || 'system',
        client_id: client_id || null,
        priority, status: 'pending',
        confidence_score: confidenceScore,
        created_at: new Date().toISOString()
      }]).select().single();
      if (error) throw error;
      onUrgentApproval(data);
      notifyAfterSubmit(data, title);
      return res.json({ approval: data, confidence_score: confidenceScore });
    }

    // ─── Non-sequence types: normal submit ─────────────────
    const { data, error } = await supabase.from('approvals').insert([{
      type, title, content: content || '',
      metadata: metadata || {},
      from_member: from_member || 'system',
      client_id: client_id || null,
      priority, status: 'pending',
      created_at: new Date().toISOString()
    }]).select().single();
    if (error) throw error;
    onUrgentApproval(data);
    notifyAfterSubmit(data, title);
    res.json({ approval: data });
  } catch (e) {
    console.error('/approvals/submit error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Mahdi rewrites a rejected approval's content incorporating the owner's feedback,
// then submits it as a fresh pending approval titled "Revised: ...".
const MAHDI_REVISE_SYS = `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world class copywriter. Write like a real human, not a marketing robot. Use short sentences and generous line breaks. Never use exclamation marks or phrases like "we understand", "we know how you feel", "don't miss out", or "limited time". Write the way a thoughtful friend who works at the brand would write. You are Mahdi — never identify as anyone else or mention Claude.`;

// ─── FIX 1: AUTO-APPROVAL HELPERS ────────────────────────
const getAutoApproveEnabled = async () => {
  try {
    const { data } = await supabase.from('platform_settings').select('value').eq('key', 'auto_approve_enabled').maybeSingle();
    return data?.value !== 'false';
  } catch { return true; }
};

const calculateConfidenceScore = async (type, title, content, metadata, fromMember) => {
  try {
    const preview = (content || '').slice(0, 500);
    const stepsPreview = Array.isArray(metadata?.steps)
      ? metadata.steps.filter(s => s.step_type !== 'wait').slice(0, 3)
          .map(s => `[${s.step_type}] ${s.subject || ''} ${(s.content || '').slice(0, 120)}`).join('\n')
      : '';
    const raw = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        system: 'You are a content quality reviewer for a professional ecommerce marketing agency. Score content 1–10: quality, brand safety, professionalism. 10 = publication-ready. 1 = low quality or unsafe. Return ONLY a single integer.',
        messages: [{ role: 'user', content: `Type: ${type}\nTitle: ${title}\nAuthor: ${fromMember}\n\nContent:\n${preview || stepsPreview}` }]
      },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }
    );
    const score = parseInt((raw.data.content[0].text.trim().match(/\d+/) || ['7'])[0], 10);
    return Math.min(10, Math.max(1, score));
  } catch (e) {
    console.log('Confidence score skipped:', e.message);
    return 7;
  }
};

const reviseApprovalWithMahdi = async (approval, feedback) => {
  const meta = approval.metadata || {};
  const isSequence = ['email_sequence', 'sms_sequence', 'whatsapp_sequence'].includes(approval.type);
  let ctx = '';
  try { ctx = await ragSearch(approval.title || 'brand voice', approval.client_id); } catch {}

  const insertRevised = async (content, metadata) => {
    const { data } = await supabase.from('approvals').insert([{
      type: approval.type,
      title: `Revised: ${approval.title}`,
      content,
      metadata,
      from_member: 'mahdi',
      client_id: approval.client_id,
      priority: approval.priority || 'normal',
      status: 'pending',
      created_at: new Date().toISOString(),
    }]).select().single();
    return data;
  };

  if (isSequence && Array.isArray(meta.steps) && meta.steps.length) {
    const raw = await aiCall(
      `${MAHDI_REVISE_SYS} Return ONLY valid JSON, no markdown, no explanation.`,
      `This ${approval.type.replace('_', ' ')} was rejected with this feedback:\n"${feedback}"\n\nRewrite it to fully incorporate the feedback. Keep the exact same JSON shape and the same number of steps (including any "wait" steps). Existing sequence:\n${JSON.stringify({ trigger_type: meta.trigger_type || 'manual', steps: meta.steps })}\n\nReturn JSON exactly in this shape: {"trigger_type":"...","steps":[{"step_type":"...","subject":"...","content":"...","wait_hours":0}]}`,
      ctx
    );
    let parsed;
    try {
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : cleaned);
    } catch { parsed = { steps: meta.steps, trigger_type: meta.trigger_type }; }
    const newSteps = Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps : meta.steps;
    const msgCount = newSteps.filter(s => s.step_type !== 'wait').length;
    const newMeta = { ...meta, steps: newSteps, trigger_type: parsed.trigger_type || meta.trigger_type || 'manual', revised_from: approval.id, original_feedback: feedback };
    const content = `Revised based on rejection feedback: "${feedback}"\n\nMahdi rewrote this ${approval.type.replace('_', ' ')} (${msgCount} message step${msgCount === 1 ? '' : 's'}) to address the feedback.`;
    return insertRevised(content, newMeta);
  }

  const rewritten = await aiCall(
    MAHDI_REVISE_SYS,
    `The following content was rejected with this feedback:\n"${feedback}"\n\nOriginal content:\n${approval.content || '(no content)'}\n\nRewrite it to fully address the feedback. Return only the revised content — no preamble, no surrounding quotes.`,
    ctx
  );
  const content = `Revised based on rejection feedback: "${feedback}"\n\n${(rewritten || '').trim()}`;
  return insertRevised(content, { ...meta, revised_from: approval.id, original_feedback: feedback });
};

app.post('/approvals/action', async (req, res) => {
  const { approval_id, action, feedback, edited_content, edited_steps } = req.body;
  if (!approval_id || !action) return res.status(400).json({ error: 'approval_id and action required' });
  try {
    const { data: approval, error: fetchErr } = await supabase.from('approvals').select('*').eq('id', approval_id).single();
    if (fetchErr || !approval) return res.status(404).json({ error: 'Approval not found' });

    if (action === 'reject') {
      await supabase.from('approvals').update({
        status: 'rejected', feedback: feedback || null, actioned_at: new Date().toISOString()
      }).eq('id', approval_id);

      let revised = null;
      const REVISABLE = ['email_sequence', 'sms_sequence', 'whatsapp_sequence', 'client_request'];
      if (feedback && REVISABLE.includes(approval.type)) {
        try { revised = await reviseApprovalWithMahdi(approval, feedback); }
        catch (e) { console.error('Mahdi revision failed:', e.message); }
      }
      return res.json({ ok: true, revised });
    }

    if (action !== 'approve') return res.status(400).json({ error: 'action must be approve or reject' });

    const meta = approval.metadata || {};
    const effectiveContent = (typeof edited_content === 'string' && edited_content.trim()) ? edited_content : approval.content;

    if (approval.type === 'email_sequence' || approval.type === 'sms_sequence' || approval.type === 'whatsapp_sequence') {
      const steps = (Array.isArray(edited_steps) && edited_steps.length) ? edited_steps : (meta.steps || []);
      const { data: workflow, error: wfErr } = await supabase.from('workflows').insert([{
        name: approval.title,
        client_id: approval.client_id,
        trigger_type: meta.trigger_type || 'manual',
        status: 'active',
        enrolled_count: 0,
      }]).select().single();
      if (wfErr) throw wfErr;
      if (steps.length > 0) {
        await supabase.from('workflow_steps').insert(
          steps.map((s, i) => ({
            workflow_id: workflow.id,
            step_order: i,
            step_type: s.step_type || (approval.type === 'sms_sequence' ? 'sms' : 'email'),
            content: s.content || '',
            subject: s.subject || null,
            wait_hours: s.wait_hours || 0,
          }))
        );
      }

      // Feedback loop: store the approved (winning) sequence so the AI team can
      // reference proven templates when writing new content.
      try {
        const { data: seqClient } = await supabase.from('clients').select('name, niche').eq('id', approval.client_id).maybeSingle();
        const niche = seqClient?.niche || 'ecommerce';
        const typeLabel = approval.type.replace('_', ' ');
        const templateText = steps
          .filter(s => s.step_type !== 'wait')
          .map((s, i) => `Step ${i + 1} (${s.step_type || 'message'}):${s.subject ? `\nSubject: ${s.subject}` : ''}\n${s.content || ''}`)
          .join('\n\n');
        if (templateText.trim()) {
          storeKnowledge({
            title: `Winning ${typeLabel} — ${seqClient?.name || 'Client'} (${niche})`,
            content: `Approved ${typeLabel} for the ${niche} niche.\n\n${templateText}`,
            source: 'winning_sequence',
            clientId: approval.client_id,
            type: approval.type,
            notes: `winning_sequence | ${approval.type} | niche:${niche}`,
          });
        }
      } catch (kErr) {
        console.error('Winning-sequence knowledge store skipped:', kErr.message);
      }
    } else if (approval.type === 'outreach_message') {
      if (meta.channel === 'sms' && meta.to_phone) {
        const { tc: twilioClient, from } = await getClientTwilio(approval.client_id);
        await twilioClient.messages.create({ body: effectiveContent, from, to: meta.to_phone });
      } else if (meta.to_email) {
        const sender = await getClientSender(approval.client_id);
        await sgMail.send({
          to: meta.to_email, from: sender,
          subject: meta.subject || 'Message from Sales Scales',
          html: `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#374151;">${effectiveContent}</p>`
        });
      }
    } else if (approval.type === 'client_checkin') {
      const sender = await getClientSender(approval.client_id);
      await sgMail.send({
        to: meta.to_email, from: sender,
        subject: meta.subject || 'Check-in from Sales Scales',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0;">
            <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Sales Scales</div>
            <div style="color:white;font-size:16px;font-weight:600;">${meta.subject || 'A message for you'}</div>
          </div>
          <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
            <div style="color:#4a5568;font-size:13px;line-height:1.8;white-space:pre-wrap;">${effectiveContent}</div>
            <hr style="border:none;border-top:1px solid #e4e9f0;margin:18px 0;" />
            <p style="color:#8896a8;font-size:11px;margin:0;">Sales Scales — AI Revenue System</p>
          </div>
        </div>`
      });
    } else if (approval.type === 'prospect') {
      const prospectName = meta.prospect_name || approval.title;
      await supabase.from('my_pipeline').insert([{
        name: prospectName,
        niche: meta.niche || null,
        channel: meta.channel || null,
        pain_point: meta.pain_point || null,
        source: 'hassan_ai',
        notes: effectiveContent,
        stage: 'new',
      }]);
      await storeBriefing('hassan', 'ali',
        `New Prospect to Close: ${prospectName}`,
        `Hassan has sourced a new prospect that Yousef approved.\n\nProspect: ${prospectName}\nNiche: ${meta.niche || 'unknown'}\nChannel: ${meta.channel || 'unknown'}\nPain Point: ${meta.pain_point || 'unknown'}\n\nOutreach message sent:\n${effectiveContent}\n\nDraft a NEPQ-based closing script for this prospect and prepare follow-up questions.`,
        'high'
      );

      // Ali generates closing script then schedules 3 follow-up briefings to Yousef
      try {
        const closingScript = await aiCall(
          `You are Ali, the Sales Closer AI at Sales Scales. You use the NEPQ (Neuro-Emotional Persuasion Questioning) framework. You are direct, confident, and focused on high-ticket closing. Never break character.`,
          `Generate a concise NEPQ-based closing script for this prospect:\n\nName: ${prospectName}\nNiche: ${meta.niche || 'ecommerce'}\nPain Point: ${meta.pain_point || 'scaling their store'}\nChannel: ${meta.channel || 'outreach'}\n\nInclude: opening NEPQ questions, a problem-agitation frame, and 2 key objection-handling lines. Keep it under 300 words.`
        );

        // Fix 10: Objection handling playbook
        try {
          const objectionPlaybook = await aiCall(
            `You are Ali, the Sales Closer AI at Sales Scales. You use the NEPQ framework. You are direct, confident, and focused on high-ticket closing. Never break character.`,
            `Generate an objection handling playbook for this prospect:\n\nName: ${prospectName}\nNiche: ${meta.niche || 'ecommerce'}\nPain Point: ${meta.pain_point || 'scaling their store'}\n\nCover exactly 5 common objections they will raise. For each:\n- OBJECTION: the exact words they'll say\n- REFRAME: one sentence to shift their perspective\n- RESPONSE: 2-3 sentence NEPQ-based counter\n- CLOSE: the follow-up question that moves them forward\n\nBe tactical and specific to their niche.`
          );
          await storeBriefing('ali', 'yousef',
            `Objection Playbook — ${prospectName}`,
            objectionPlaybook,
            'high'
          );
        } catch (objErr) {
          console.error('[prospect-approval] Ali objection playbook failed:', objErr.message);
        }

        const outreachDate = new Date();
        const day3Date = new Date(outreachDate.getTime() + 3 * 24 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const day7Date = new Date(outreachDate.getTime() + 7 * 24 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const day14Date = new Date(outreachDate.getTime() + 14 * 24 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        await Promise.all([
          storeBriefing('ali', 'yousef',
            `Day 3 Follow-up: Value Add — ${prospectName}`,
            `Send on: ${day3Date}\n\nAngle: Value Add\nDo not pitch. Send a specific insight, tip, or mini-resource that directly addresses their pain point (${meta.pain_point || 'scaling their store'}). Frame it as something useful you thought of after your first message. No CTA beyond a soft "happy to go deeper on this."\n\nProspect niche: ${meta.niche || 'ecommerce'} | Channel: ${meta.channel || 'outreach'}\n\n--- Closing Script (for reference) ---\n${closingScript}`,
            'high'
          ),
          storeBriefing('ali', 'yousef',
            `Day 7 Follow-up: Case Study Share — ${prospectName}`,
            `Send on: ${day7Date}\n\nAngle: Case Study Share\nShare a relevant Sales Scales case study from the ${meta.niche || 'ecommerce'} niche. Lead with the measurable result (e.g. "3.2x ROAS in 6 weeks"), then connect it directly to ${prospectName}'s situation. End with a single question: "Would results like this be useful for you right now?"`,
            'high'
          ),
          storeBriefing('ali', 'yousef',
            `Day 14 Follow-up: Final Attempt — ${prospectName}`,
            `Send on: ${day14Date}\n\nAngle: Final Attempt\nThis is the last touch in the sequence. Keep it short. Acknowledge you've reached out a couple of times. Let them know the door stays open whenever the timing is right. Give one clear CTA: a 15-minute call. If no reply after this, mark the prospect as nurture-only in the pipeline.`,
            'high'
          ),
        ]);
        console.log(`[prospect-approval] Ali follow-up sequence created for ${prospectName}`);
      } catch (followUpErr) {
        console.error('[prospect-approval] Ali follow-up sequence failed:', followUpErr.message);
      }
    }

    await supabase.from('approvals').update({
      status: 'approved', content: effectiveContent, feedback: feedback || null, actioned_at: new Date().toISOString()
    }).eq('id', approval_id);

    res.json({ ok: true });
  } catch (e) {
    console.error('/approvals/action error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── CLIENT KNOWLEDGE BASE (PROFILE) ──────────────────────
app.get('/client-profile', async (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { data, error } = await supabase.from('client_profiles')
      .select('*').eq('client_id', client_id).maybeSingle();
    if (error) throw error;
    res.json({ profile: data || null });
  } catch (e) {
    console.error('/client-profile GET error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/client-profile', async (req, res) => {
  const { client_id, brand_voice, key_products, faqs, return_policy } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { data, error } = await supabase.from('client_profiles').upsert([{
      client_id,
      brand_voice: brand_voice || null,
      key_products: key_products || null,
      faqs: faqs || null,
      return_policy: return_policy || null,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'client_id' }).select().single();
    if (error) throw error;
    res.json({ profile: data });
  } catch (e) {
    console.error('/client-profile POST error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── CLIENT PORTAL ZAINAB CHAT (no JWT) ───────────────────
app.post('/client/zainab', async (req, res) => {
  const { client_id, message, client_name } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  try {
    const [ragContext, shopifyCtx, profileCtx] = await Promise.all([
      ragSearch(message, client_id),
      getShopifyContext(client_id),
      getClientProfile(client_id),
    ]);
    const context = [ragContext, shopifyCtx, profileCtx].filter(Boolean).join('\n\n');
    const store = client_name || 'their store';
    const systemPrompt = `You are Zainab, the dedicated AI Client Partner at Sales Scales. You are warm, professional, and genuinely care about client success. You are speaking directly with the owner of ${store}. Your job is to help them understand their AI revenue system, answer questions about their sequences and results, explain their reports, and make them feel confident that Sales Scales is delivering real value. Use the store data and knowledge base context below to give specific, personalized answers. Keep responses concise, friendly, and encouraging. You are Zainab — never identify as anyone else or mention Claude.`;
    let result = await aiCall(systemPrompt, message, context);

    // Action routing — if the client is requesting a change, flag it for the team via approvals.
    const actionKeywords = /\b(change|update|edit|fix|remove|add|rewrite)\b/i;
    if (actionKeywords.test(message)) {
      try {
        const { data: crData } = await supabase.from('approvals').insert([{
          type: 'client_request',
          title: `Client request from ${store}`,
          content: message,
          from_member: 'zainab',
          client_id: client_id || null,
          priority: /refund|return|complaint|dispute|money.?back/i.test(message) ? 'urgent' : 'high',
          status: 'pending',
          created_at: new Date().toISOString()
        }]).select().single();
        if (crData) onUrgentApproval(crData);
        result += `\n\nI've flagged this for the Sales Scales team to action — they'll get it handled and you'll see it move through your approvals.`;
      } catch (apprErr) {
        console.error('Zainab approval submit error:', apprErr.message);
      }
    }

    res.json({ reply: result });
  } catch (e) {
    console.error('/client/zainab error:', e.message);
    res.status(500).json({ error: 'Zainab is unavailable right now', details: e.message });
  }
});

// ─── VOICE AGENT (ELEVENLABS) ─────────────────────────────
app.get('/voice-agent/voices', async (req, res) => {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });
    const voices = (response.data.voices || []).map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category
    }));
    res.json({ voices });
  } catch (e) {
    console.error('ElevenLabs voices error:', e.message);
    res.status(500).json({ error: 'Failed to fetch voices', details: e.message });
  }
});

app.post('/voice-agent/save-agent', async (req, res) => {
  const { agentId, name, voiceId, firstMessage, systemPrompt } = req.body;
  if (!name || !firstMessage || !systemPrompt) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const payload = {
      name,
      conversation_config: {
        agent: {
          prompt: { prompt: systemPrompt },
          first_message: firstMessage,
          language: 'en'
        },
        tts: { voice_id: voiceId }
      }
    };
    if (agentId) {
      await axios.patch(
        `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
        payload,
        { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' } }
      );
      console.log('ElevenLabs agent updated:', agentId);
      res.json({ success: true, agentId });
    } else {
      const response = await axios.post(
        'https://api.elevenlabs.io/v1/convai/agents/create',
        payload,
        { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' } }
      );
      const newAgentId = response.data.agent_id;
      console.log('ElevenLabs agent created:', newAgentId);
      res.json({ success: true, agentId: newAgentId });
    }
  } catch (e) {
    console.error('Save agent error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to save agent', details: e.response?.data?.detail || e.message });
  }
});

// ─── ALI CALL SCRIPT GENERATOR ───────────────────────────
const generateAliCallScript = async (contact, recentMessages, ragContext, clientName) => {
  const name = contact.first_name || 'the customer';
  const products = contact.abandoned_products || 'products';
  const cartValue = contact.cart_value ? `$${contact.cart_value}` : 'their cart items';
  const msgHistory = recentMessages.length
    ? recentMessages.slice(0, 5).map(m => `[${m.direction}/${m.channel}] ${(m.content || '').slice(0, 100)}`).join('\n')
    : 'No prior messages';

  const raw = await aiCall(
    `You are Ali, the Sales Closer AI at Sales Scales. You use the NEPQ (Neuro-Emotional Persuasion Questioning) framework. You speak with confidence, warmth, and precision. You never use pressure tactics — only insightful questions that help prospects sell themselves. You are Ali — never mention Claude.

Return ONLY valid JSON. No markdown, no explanation.`,
    `Generate a personalized NEPQ call script for this contact. You are calling on behalf of ${clientName || 'the store'}.

Contact: ${name}
Abandoned: ${products}
Cart value: ${cartValue}
Recent interactions:\n${msgHistory}

Return exactly this JSON shape:
{
  "opening": "...",
  "situation_questions": ["...", "...", "..."],
  "problem_questions": ["...", "..."],
  "consequence_questions": ["...", "..."],
  "close": "...",
  "objections": {
    "too_expensive": "...",
    "need_to_think": "...",
    "quality_concerns": "...",
    "shipping_concerns": "...",
    "wrong_time": "..."
  }
}

Each objection response must be 1–2 sentences, personalized to the specific product. The opening must be a confident pattern interrupt — do not start with 'Hi' or 'How are you'.`,
    ragContext || ''
  );

  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : cleaned);
  } catch {
    return { opening: raw.slice(0, 200), situation_questions: [], problem_questions: [], consequence_questions: [], close: '', objections: {} };
  }
};

// ─── ALI POST-CALL FOLLOW-UP ANALYZER ────────────────────
const generateAliFollowUp = async (transcript, contact, clientName) => {
  const name = contact?.first_name || 'the contact';
  const raw = await aiCall(
    `You are Ali, the Sales Closer AI at Sales Scales. You analyze sales call transcripts and recommend the best follow-up action. You are Ali — never mention Claude. Return ONLY valid JSON.`,
    `Analyze this call transcript for ${name} and determine if they converted.

Transcript:\n${transcript.slice(0, 3000)}

Return exactly this JSON:
{
  "converted": true | false,
  "action": "follow_up_call" | "send_sms" | "mark_not_interested",
  "timing": "24h" | "48h" | "1 week" | null,
  "sms_message": "..." | null,
  "reason": "..."
}

If converted = true, set action to null.
If the contact seemed uninterested or hostile, set action to mark_not_interested.
sms_message must be under 160 chars and use {{first_name}} for personalization.`
  );
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : cleaned);
  } catch {
    return { converted: false, action: 'follow_up_call', timing: '24h', sms_message: null, reason: raw.slice(0, 200) };
  }
};

app.post('/voice-agent/outbound-call', async (req, res) => {
  const { phone, agentId, contact_id, client_id } = req.body;
  if (!phone || !agentId) return res.status(400).json({ error: 'Missing phone or agentId' });
  try {
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
      {
        agent_id: agentId,
        agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
        to_number: phone
      },
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' } }
    );
    const callId = response.data.callsid || response.data.call_sid || response.data.call_id;
    console.log('ElevenLabs outbound call initiated:', callId, '→', phone);

    // Fire Ali script generation in background — does not block the call response
    if (contact_id || client_id) {
      (async () => {
        try {
          const [contactRes, messagesRes, ragCtx, clientRes] = await Promise.all([
            contact_id ? supabase.from('contacts').select('*').eq('id', contact_id).maybeSingle() : { data: null },
            contact_id ? supabase.from('messages').select('channel, direction, content, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(10) : { data: [] },
            ragSearch(phone, client_id),
            client_id ? supabase.from('clients').select('name').eq('id', client_id).maybeSingle() : { data: null },
          ]);
          const contact = contactRes.data || { first_name: 'Customer', phone };
          const messages = messagesRes.data || [];
          const clientName = clientRes.data?.name || '';

          const script = await generateAliCallScript(contact, messages, ragCtx, clientName);
          const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || phone;

          // Format the briefing content
          const objLines = Object.entries(script.objections || {}).map(([k, v]) =>
            `• ${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v}`
          ).join('\n');

          const briefingContent = [
            `NEPQ CALL SCRIPT — ${contactName}`,
            `Phone: ${phone}`,
            contact.email ? `Email: ${contact.email}` : null,
            contact_id ? `Contact ID: ${contact_id}` : null,
            '',
            '── OPENING ──',
            script.opening || '—',
            '',
            '── SITUATION QUESTIONS ──',
            (script.situation_questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n'),
            '',
            '── PROBLEM AWARENESS ──',
            (script.problem_questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n'),
            '',
            '── CONSEQUENCE QUESTIONS ──',
            (script.consequence_questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n'),
            '',
            '── CLOSE ──',
            script.close || '—',
            '',
            '── OBJECTION HANDLERS ──',
            objLines || '—',
          ].filter(l => l !== null).join('\n');

          await storeBriefing(
            'ali', 'yousef',
            `Call Script — ${contactName} — ${new Date().toLocaleDateString()}`,
            briefingContent,
            'high',
            client_id || null,
            contact_id || null
          );

          // Create a pending call_log record so the webhook can attach transcript to it
          await supabase.from('call_logs').insert([{
            client_id: client_id || null,
            contact_id: contact_id || null,
            contact_phone: phone,
            direction: 'outbound',
            call_script: briefingContent,
            objection_handlers: script.objections || {},
            status: 'initiated',
            created_at: new Date().toISOString(),
          }]);

          console.log(`[Ali] Call script generated for ${contactName}`);
        } catch (scriptErr) {
          console.error('[Ali] Call script generation failed:', scriptErr.message);
        }
      })();
    }

    res.json({ success: true, callId });
  } catch (e) {
    console.error('Outbound call error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to initiate call', details: e.response?.data?.detail || e.message });
  }
});

// ElevenLabs webhook — fires when a call ends. Fetches transcript, summarizes, logs.
app.post('/calls/log', async (req, res) => {
  try {
    // ElevenLabs may wrap the payload as { type, data: {...} }
    const body = req.body?.data || req.body || {};
    const conversationId = body.conversation_id || body.conversationId || req.body?.conversation_id;
    const direction = (body.direction || body.call_direction || req.body?.direction || 'outbound').toLowerCase();
    let contactPhone = body.contact_phone || body.to_number || body.from_number || body.phone || req.body?.contact_phone || null;
    let clientId = body.client_id || req.body?.client_id || null;

    if (!conversationId) {
      return res.status(400).json({ error: 'Missing conversation_id' });
    }

    // Fetch the full conversation (transcript turns + metadata) from ElevenLabs
    let transcript = '';
    let durationSeconds = body.duration_seconds || null;
    try {
      const convo = await axios.get(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
      );
      const data = convo.data || {};
      durationSeconds = data.metadata?.call_duration_secs ?? durationSeconds;
      const turns = data.transcript || [];
      transcript = turns
        .map(t => {
          const speaker = t.role === 'agent' ? 'Agent' : 'Caller';
          const text = t.message || t.text || '';
          return text ? `${speaker}: ${text}` : '';
        })
        .filter(Boolean)
        .join('\n');
      if (!contactPhone) {
        contactPhone = data.metadata?.phone_call?.external_number || data.metadata?.to_number || contactPhone;
      }
    } catch (fetchErr) {
      console.error('ElevenLabs transcript fetch error:', fetchErr.response?.data || fetchErr.message);
    }

    // Generate a 2-sentence summary
    let summary = '';
    if (transcript) {
      try {
        summary = await aiCall(
          'You summarize sales call transcripts. Respond with exactly 2 sentences capturing what was discussed and the outcome. No preamble.',
          `Summarize this call transcript:\n\n${transcript}`
        );
        summary = (summary || '').trim();
      } catch (sumErr) {
        console.error('Call summary error:', sumErr.message);
      }
    }

    // Look up contact_id by phone + client_id (for linking)
    let contactId = body.contact_id || req.body?.contact_id || null;
    if (!contactId && contactPhone && clientId) {
      try {
        const { data: contactMatch } = await supabase.from('contacts')
          .select('id, first_name, last_name').eq('phone', contactPhone).eq('client_id', clientId).maybeSingle();
        if (contactMatch) contactId = contactMatch.id;
      } catch {}
    }

    // Try to find a pending initiated call_log for this phone + client to update instead of insert
    let inserted = null;
    let existingId = null;
    if (contactPhone && clientId) {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      const { data: pending } = await supabase.from('call_logs')
        .select('id').eq('contact_phone', contactPhone).eq('client_id', clientId)
        .eq('status', 'initiated').gte('created_at', twoHoursAgo)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (pending) existingId = pending.id;
    }

    if (existingId) {
      const { data: updated, error } = await supabase.from('call_logs').update({
        contact_id: contactId,
        direction: direction === 'inbound' ? 'inbound' : 'outbound',
        duration_seconds: durationSeconds,
        transcript: transcript || null,
        summary: summary || null,
        status: 'completed',
      }).eq('id', existingId).select().single();
      if (!error) inserted = updated;
    }

    if (!inserted) {
      const { data: fresh, error } = await supabase.from('call_logs').insert({
        client_id: clientId,
        contact_id: contactId,
        contact_phone: contactPhone,
        direction: direction === 'inbound' ? 'inbound' : 'outbound',
        duration_seconds: durationSeconds,
        transcript: transcript || null,
        summary: summary || null,
        status: 'completed',
      }).select().single();
      if (error) {
        console.error('call_logs insert error:', error.message);
        return res.status(500).json({ error: 'Failed to log call', details: error.message });
      }
      inserted = fresh;
    }

    console.log('Call logged:', inserted.id, direction, contactPhone);

    // Feedback loop: store the transcript in the knowledge base
    if (transcript && transcript.trim()) {
      storeKnowledge({
        title: `Call Transcript — ${contactPhone || 'Unknown'} (${direction === 'inbound' ? 'inbound' : 'outbound'})`,
        content: summary ? `Summary: ${summary}\n\n${transcript}` : transcript,
        source: 'call_transcript',
        clientId: clientId,
        type: 'call_transcript',
        notes: 'call_transcript',
      });
    }

    // Ali analyses the transcript and generates a follow-up recommendation
    if (transcript && transcript.trim() && clientId) {
      (async () => {
        try {
          let contact = { first_name: contactPhone };
          if (contactId) {
            const { data: c } = await supabase.from('contacts').select('first_name, last_name, email').eq('id', contactId).maybeSingle();
            if (c) contact = c;
          }
          const { data: cl } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
          const followUp = await generateAliFollowUp(transcript, contact, cl?.name || '');
          const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contactPhone;

          const followUpContent = [
            `POST-CALL ANALYSIS — ${contactName}`,
            `Phone: ${contactPhone}`,
            contactId ? `Contact ID: ${contactId}` : null,
            `Converted: ${followUp.converted ? 'Yes ✓' : 'No'}`,
            '',
            `Recommended Action: ${(followUp.action || '—').replace(/_/g, ' ').toUpperCase()}`,
            followUp.timing ? `Timing: ${followUp.timing}` : null,
            followUp.sms_message ? `\nSMS to send:\n"${followUp.sms_message}"` : null,
            '',
            `Ali's reasoning: ${followUp.reason || '—'}`,
          ].filter(l => l !== null).join('\n');

          await storeBriefing(
            'ali', 'yousef',
            `Post-Call Action — ${contactName} — ${followUp.converted ? 'Converted' : followUp.action?.replace(/_/g, ' ')}`,
            followUpContent,
            'normal',
            clientId,
            contactId
          );

          // Save follow-up action back to the call_log
          const followUpStr = followUp.action
            ? `${followUp.action.replace(/_/g, ' ')}${followUp.timing ? ` in ${followUp.timing}` : ''}${followUp.sms_message ? ` — SMS: "${followUp.sms_message}"` : ''}`
            : null;
          if (followUpStr) {
            await supabase.from('call_logs').update({ follow_up_action: followUpStr }).eq('id', inserted.id);
          }
          console.log(`[Ali] Follow-up action generated: ${followUpStr || 'none'}`);
        } catch (fuErr) {
          console.error('[Ali] Follow-up generation failed:', fuErr.message);
        }
      })();
    }

    res.json({ success: true, call: inserted });
  } catch (e) {
    console.error('Call log error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to log call', details: e.message });
  }
});

// List all call logs (main platform). Optional ?client_id= filter.
app.get('/calls/list', async (req, res) => {
  try {
    let query = supabase
      .from('call_logs')
      .select('*, clients(name)')
      .neq('status', 'initiated')
      .order('created_at', { ascending: false });
    if (req.query.client_id) query = query.eq('client_id', req.query.client_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ calls: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SOCIAL MEDIA AUTOMATION ─────────────────────────────
let socialConfig = {
  verifyToken: process.env.META_VERIFY_TOKEN || 'salesscales_meta_verify',
  instagram: { pageId: process.env.INSTAGRAM_PAGE_ID || null, accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || null },
  facebook: { pageId: process.env.FACEBOOK_PAGE_ID || null, accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || null },
  dm: { enabled: true, tone: 'friendly', customReply: '', workflowId: null, enrollContacts: true },
  comments: { enabled: true, tone: 'friendly', customReply: '' }
};

const generateSocialReply = async (message, tone = 'friendly', customReply = '') => {
  if (customReply && customReply.trim()) return customReply.trim();
  const tones = {
    friendly: 'warm, casual, and genuinely helpful',
    professional: 'polished, business-focused, and respectful',
    casual: 'relaxed, fun, and conversational',
    enthusiastic: 'energetic, positive, and exciting'
  };
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You are a social media manager. Tone: ${tones[tone] || tones.friendly}. Reply in 1-2 sentences max. Be genuine and direct. No hashtags unless the original message used them. No filler openers.`,
      messages: [{ role: 'user', content: `Reply to this social media message: "${message}"` }]
    },
    { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }
  );
  return response.data.content[0].text.trim();
};

const sendGraphDM = async (recipientId, message, accessToken) => {
  await axios.post(
    'https://graph.facebook.com/v18.0/me/messages',
    { recipient: { id: recipientId }, message: { text: message } },
    { params: { access_token: accessToken } }
  );
};

const replyToGraphComment = async (commentId, message, accessToken) => {
  await axios.post(
    `https://graph.facebook.com/v18.0/${commentId}/replies`,
    { message },
    { params: { access_token: accessToken } }
  );
};

const processSocialEvent = async (platform, payload) => {
  const entries = payload.entry || [];
  for (const entry of entries) {
    if (entry.messaging && socialConfig.dm.enabled) {
      for (const event of entry.messaging) {
        if (!event.message || event.message.is_echo || !event.message.text) continue;
        const senderId = event.sender.id;
        const messageText = event.message.text;
        const accessToken = platform === 'instagram' ? socialConfig.instagram.accessToken : socialConfig.facebook.accessToken;
        if (!accessToken) continue;
        try {
          const reply = await generateSocialReply(messageText, socialConfig.dm.tone, socialConfig.dm.customReply);
          await sendGraphDM(senderId, reply, accessToken);
          await supabase.from('messages').insert([
            { channel: platform, direction: 'inbound', sender_name: senderId, sender_phone: senderId, content: messageText, status: 'read' },
            { channel: platform, direction: 'outbound', sender_name: 'Sales Scales AI', content: reply, status: 'sent' }
          ]);
          // Fix 6: track contact, enroll in existing workflow if configured, generate DM nurture approval for new contacts
          let socialContact = null;
          let isNewContact = false;
          { const { data: existingC } = await supabase.from('contacts').select('*').eq('phone', senderId).maybeSingle();
            if (existingC) { socialContact = existingC; }
            else {
              isNewContact = true;
              const { data: nc } = await supabase.from('contacts').insert([{
                first_name: platform === 'instagram' ? 'Instagram' : 'Facebook',
                last_name: 'User',
                phone: senderId,
                source: platform === 'instagram' ? 'Instagram' : 'Facebook',
                channel: platform === 'instagram' ? 'Instagram' : 'Facebook',
                pipeline_stage: 'New Lead',
                last_activity: new Date().toISOString()
              }]).select().single();
              socialContact = nc;
            }
          }
          if (socialConfig.dm.enrollContacts && socialConfig.dm.workflowId && socialContact) {
            await enrollContactInWorkflow(socialConfig.dm.workflowId, socialContact.id, null, socialContact.email, null, socialContact.first_name);
          }
          if (isNewContact) {
            const clientId = socialContact?.client_id || null;
            generateSocialNurtureApproval(platform, senderId, clientId).catch(e => console.error('[social-nurture]', e.message));
          }
          console.log(`Social DM auto-replied [${platform}]: ${senderId}`);
        } catch (e) {
          console.error(`Social DM error [${platform}]:`, e.response?.data || e.message);
        }
      }
    }

    if (entry.changes && socialConfig.comments.enabled) {
      for (const change of entry.changes) {
        const val = change.value;
        if (!val || val.item !== 'comment' || !val.message || !val.comment_id) continue;
        const accessToken = platform === 'instagram' ? socialConfig.instagram.accessToken : socialConfig.facebook.accessToken;
        if (!accessToken) continue;
        try {
          const reply = await generateSocialReply(val.message, socialConfig.comments.tone, socialConfig.comments.customReply);
          await replyToGraphComment(val.comment_id, reply, accessToken);
          await supabase.from('messages').insert([
            { channel: `${platform}_comment`, direction: 'inbound', sender_name: val.from?.name || 'Unknown', content: val.message, status: 'read' },
            { channel: `${platform}_comment`, direction: 'outbound', sender_name: 'Sales Scales AI', content: reply, status: 'sent' }
          ]);
          console.log(`Comment auto-replied [${platform}]: ${val.comment_id}`);
        } catch (e) {
          console.error(`Comment reply error [${platform}]:`, e.response?.data || e.message);
        }
      }
    }
  }
};

app.get('/social/instagram-webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === socialConfig.verifyToken) {
    console.log('Instagram webhook verified');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Forbidden');
});

app.post('/social/instagram-webhook', async (req, res) => {
  res.status(200).json({ status: 'ok' });
  processSocialEvent('instagram', req.body).catch(e => console.error('IG webhook error:', e.message));
});

app.get('/social/facebook-webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === socialConfig.verifyToken) {
    console.log('Facebook webhook verified');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Forbidden');
});

app.post('/social/facebook-webhook', async (req, res) => {
  res.status(200).json({ status: 'ok' });
  processSocialEvent('facebook', req.body).catch(e => console.error('FB webhook error:', e.message));
});

app.post('/social/send-dm', async (req, res) => {
  const { recipientId, message, platform } = req.body;
  if (!recipientId || !message || !platform) return res.status(400).json({ error: 'Missing fields' });
  const accessToken = platform === 'instagram' ? socialConfig.instagram.accessToken : socialConfig.facebook.accessToken;
  if (!accessToken) return res.status(400).json({ error: `${platform} not connected` });
  try {
    await sendGraphDM(recipientId, message, accessToken);
    res.json({ success: true });
  } catch (e) {
    console.error('Send DM error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to send DM', details: e.response?.data || e.message });
  }
});

app.post('/social/reply-comment', async (req, res) => {
  const { commentId, message, platform } = req.body;
  if (!commentId || !message || !platform) return res.status(400).json({ error: 'Missing fields' });
  const accessToken = platform === 'instagram' ? socialConfig.instagram.accessToken : socialConfig.facebook.accessToken;
  if (!accessToken) return res.status(400).json({ error: `${platform} not connected` });
  try {
    await replyToGraphComment(commentId, message, accessToken);
    res.json({ success: true });
  } catch (e) {
    console.error('Reply comment error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to reply to comment', details: e.response?.data || e.message });
  }
});

app.get('/social/config', (req, res) => {
  res.json({
    verifyToken: socialConfig.verifyToken,
    dm: socialConfig.dm,
    comments: socialConfig.comments,
    instagramConnected: !!socialConfig.instagram.accessToken,
    facebookConnected: !!socialConfig.facebook.accessToken
  });
});

app.post('/social/config', (req, res) => {
  const { instagram, facebook, dm, comments } = req.body;
  if (instagram) socialConfig.instagram = { ...socialConfig.instagram, ...instagram };
  if (facebook) socialConfig.facebook = { ...socialConfig.facebook, ...facebook };
  if (dm) socialConfig.dm = { ...socialConfig.dm, ...dm };
  if (comments) socialConfig.comments = { ...socialConfig.comments, ...comments };
  console.log('Social config updated');
  res.json({ success: true });
});

// ─── TEST ENDPOINTS ───────────────────────────────────────
app.get('/test/ping', (req, res) => {
  res.json({ ok: true, msg: 'Server is running the current build', ts: new Date().toISOString() });
});

app.post('/test/trigger-webhook', async (req, res) => {
  const { email, client_id, first_name } = req.body;
  const log = [];
  const step = (msg, data) => {
    const entry = { msg, ...(data ? { data } : {}) };
    log.push(entry);
    console.log(`[TEST WEBHOOK] ${msg}`, data ? JSON.stringify(data) : '');
  };

  if (!email || !client_id) {
    return res.status(400).json({ ok: false, error: 'email and client_id are required', log });
  }

  step('Starting abandoned cart webhook simulation', { email, client_id, first_name });

  try {
    const { data: client } = await supabase.from('clients').select('id, name').eq('id', client_id).maybeSingle();
    if (!client) {
      step('ERROR: Client not found', { client_id });
      return res.status(422).json({ ok: false, error: 'Client not found', log });
    }
    step('Client verified', { name: client.name });

    let { data: contact } = await supabase.from('contacts')
      .select('*').eq('email', email).eq('client_id', client_id).maybeSingle();

    if (contact) {
      step('Existing contact found', { id: contact.id, name: contact.first_name, email: contact.email });
    } else {
      const { data: newContact, error: insertErr } = await supabase.from('contacts').insert([{
        first_name: first_name || '',
        last_name: '',
        email,
        phone: '',
        source: 'Test',
        channel: 'Email',
        pipeline_stage: 'New Lead',
        client_id,
        last_activity: new Date().toISOString()
      }]).select().single();
      if (insertErr || !newContact) {
        step('ERROR: Failed to create contact', { error: insertErr?.message });
        return res.status(500).json({ ok: false, error: 'Failed to create contact', log });
      }
      contact = newContact;
      step('New contact created', { id: contact.id, email: contact.email });
    }

    const { data: workflows } = await supabase.from('workflows')
      .select('id, name, trigger_type, status')
      .eq('client_id', client_id)
      .eq('trigger_type', 'cart_abandoned')
      .eq('status', 'active');

    if (!workflows || workflows.length === 0) {
      step('ERROR: No active cart_abandoned workflow found for this client', { client_id });
      return res.status(422).json({ ok: false, error: 'No active cart_abandoned workflow for this client. Create a workflow with trigger_type = cart_abandoned and status = active.', log });
    }

    const workflow = workflows[0];
    step('Workflow found', { id: workflow.id, name: workflow.name, trigger_type: workflow.trigger_type });

    const { data: steps } = await supabase.from('workflow_steps')
      .select('step_order, step_type, subject, content, wait_hours')
      .eq('workflow_id', workflow.id)
      .order('step_order');
    step(`Workflow has ${steps?.length || 0} steps`, (steps || []).map(s => ({
      order: s.step_order, type: s.step_type,
      subject: s.subject || null,
      wait_hours: s.wait_hours || null
    })));

    const firstStep = steps?.[0];
    step('Enrolling contact and firing first step', {
      step_type: firstStep?.step_type,
      subject: firstStep?.subject || null,
      to: contact.email
    });

    const enrollment = await enrollContactInWorkflow(
      workflow.id, contact.id, client_id,
      contact.email, contact.phone, contact.first_name
    );

    if (!enrollment) {
      step('Enrollment skipped — contact is already actively enrolled in this workflow');
      return res.json({ ok: true, skipped: true, reason: 'already_enrolled', log });
    }

    step('Contact enrolled successfully', { enrollment_id: enrollment.id });

    // Fire-and-forget: Ali generates personalized NEPQ call script for cart recovery
    (async () => {
      try {
        const [clientData, msgData, ragCtx] = await Promise.all([
          supabase.from('clients').select('name, niche').eq('id', client_id).maybeSingle().then(r => r.data),
          supabase.from('messages').select('channel, direction, content, created_at').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(10).then(r => r.data || []),
          ragSearch(`cart recovery NEPQ ${client?.name || ''} call script`, client_id).catch(() => ''),
        ]);
        const script = await generateAliCallScript(contact, msgData, ragCtx, clientData?.name || '');
        const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || email;
        const objLines = Object.entries(script.objections || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
        const briefingContent = [`NEPQ CART RECOVERY BRIEF — ${contactName}`, `Store: ${clientData?.name || ''} (${clientData?.niche || 'ecommerce'})`, '', '── OPENING ──', script.opening || '', '', '── SITUATION QUESTIONS ──', (script.situation_questions || []).join('\n'), '', '── PROBLEM AWARENESS ──', (script.problem_questions || []).join('\n'), '', '── CONSEQUENCE QUESTIONS ──', (script.consequence_questions || []).join('\n'), '', '── CLOSE ──', script.close || '', '', '── OBJECTION HANDLERS ──', objLines].join('\n');
        await storeBriefing('ali', 'yousef', `Cart Recovery Brief — ${contactName} (${clientData?.name || 'Client'})`, briefingContent, 'high', client_id, contact.id);
        console.log(`[TriggerWebhook] Ali call brief stored for ${contactName}`);
      } catch (e) {
        console.error('[TriggerWebhook] Ali script generation failed:', e.message);
      }
    })();

    await supabase.from('activity').insert([{
      contact_id: contact.id, client_id,
      type: 'test_webhook',
      description: `Test webhook: cart_abandoned — enrolled in "${workflow.name}"`,
      created_at: new Date().toISOString()
    }]);
    step('Activity logged');

    const emailSent = firstStep?.step_type === 'email' && contact.email;
    const smsSent = firstStep?.step_type === 'sms' && contact.phone;
    const wasSent = firstStep?.step_type === 'whatsapp' && contact.phone;
    const wasWait = firstStep?.step_type === 'wait';

    if (emailSent) step('First step: email fired', { to: contact.email, subject: firstStep.subject });
    else if (smsSent) step('First step: SMS fired', { to: contact.phone });
    else if (wasSent) step('First step: WhatsApp fired', { to: contact.phone });
    else if (wasWait) step('First step: wait — no message sent yet, scheduler will advance on schedule');
    else step('First step: no message sent (missing contact info or unhandled step type)');

    step('Test complete — full flow executed successfully');
    res.json({ ok: true, contact_id: contact.id, enrollment_id: enrollment.id, workflow: workflow.name, log });

  } catch (e) {
    step('FATAL ERROR', { message: e.message });
    console.error('[TEST WEBHOOK] Fatal:', e.message);
    res.status(500).json({ ok: false, error: e.message, log });
  }
});

// ─── FIX 2: OPT-IN SEQUENCE WEBHOOK ─────────────────────
// POST /shopify/optin — creates a contact from a web form opt-in and enrolls in opt_in_sequence
app.post('/shopify/optin', async (req, res) => {
  const { email, client_id, first_name, last_name } = req.body;
  if (!email || !client_id) return res.status(400).json({ error: 'email and client_id required' });
  try {
    const { contact } = await upsertContact({
      first_name: first_name || email.split('@')[0],
      last_name: last_name || '',
      email,
      source: 'Opt-in',
      channel: 'Email',
      pipeline_stage: 'New Lead',
      client_id,
    });

    const { data: wfs } = await supabase.from('workflows')
      .select('*').eq('client_id', client_id).eq('trigger_type', 'opt_in').eq('status', 'active');
    if (!wfs || wfs.length === 0) {
      return res.json({ ok: true, contact_id: contact.id, enrolled: false, reason: 'No active opt_in workflow found' });
    }
    const wf = wfs[0];
    const enrollment = await enrollContactInWorkflow(wf, contact, client_id);
    res.json({ ok: true, contact_id: contact.id, enrollment_id: enrollment?.id, workflow: wf.name });
  } catch (e) {
    console.error('/shopify/optin error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── CREATE DEMO CLIENT ──────────────────────────────────
// Fixed credentials — idempotent: cleans up any previous demo and rebuilds
app.post('/clients/create-demo', async (req, res) => {
  const DEMO_EMAIL    = 'demo@salesscales.com';
  const DEMO_PASSWORD = 'demo123';
  try {
    // Clean up any previous demo with this exact email
    const { data: existingUser } = await supabase
      .from('client_users').select('id, client_id').eq('email', DEMO_EMAIL).maybeSingle();
    if (existingUser?.client_id) {
      const oldCid = existingUser.client_id;
      const { data: oldWfs } = await supabase.from('workflows').select('id').eq('client_id', oldCid);
      const oldWfIds = (oldWfs || []).map(w => w.id);
      await Promise.all([
        supabase.from('workflow_enrollments').delete().eq('client_id', oldCid),
        oldWfIds.length ? supabase.from('workflow_steps').delete().in('workflow_id', oldWfIds) : Promise.resolve(),
        supabase.from('workflows').delete().eq('client_id', oldCid),
        supabase.from('messages').delete().eq('client_id', oldCid),
        supabase.from('contacts').delete().eq('client_id', oldCid),
        supabase.from('client_onboarding').delete().eq('client_id', oldCid),
      ]);
      await supabase.from('client_users').delete().eq('client_id', oldCid);
      await supabase.from('clients').delete().eq('id', oldCid);
    }

    // Create client
    const { data: client, error: clientErr } = await supabase.from('clients').insert([{
      name: 'Demo Store',
      business_type: 'Ecommerce',
      niche: 'Travel Bags',
      tier: 'elite',
      status: 'active',
    }]).select().single();
    if (clientErr) throw clientErr;

    // Create fixed demo login — try with verified/accepted_terms, fall back if columns missing
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const baseUser = { name: 'Demo Owner', email: DEMO_EMAIL, password: passwordHash, client_id: client.id };
    let clientUser;
    const { data: cu1, error: ue1 } = await supabase.from('client_users')
      .insert([{ ...baseUser, verified: true, accepted_terms: true }])
      .select('id, name, email, client_id').single();
    if (ue1) {
      const { data: cu2, error: ue2 } = await supabase.from('client_users').insert([baseUser]).select('id, name, email, client_id').single();
      if (ue2) throw ue2;
      clientUser = cu2;
    } else {
      clientUser = cu1;
    }

    // 5 realistic contacts
    const ts = Date.now();
    const { data: contacts } = await supabase.from('contacts').insert([
      { first_name: 'Emma',   last_name: 'Johnson', email: `emma.j.${ts}@example.com`,    phone: '+15551230001', source: 'Shopify',  channel: 'Email', pipeline_stage: 'Customer',  client_id: client.id, last_activity: new Date().toISOString() },
      { first_name: 'Liam',   last_name: 'Smith',   email: `liam.s.${ts}@example.com`,    phone: '+15551230002', source: 'Shopify',  channel: 'Email', pipeline_stage: 'Lead',      client_id: client.id, last_activity: new Date().toISOString() },
      { first_name: 'Sophia', last_name: 'Davis',   email: `sophia.d.${ts}@example.com`,  phone: '+15551230003', source: 'Opt-in',   channel: 'SMS',   pipeline_stage: 'New Lead',  client_id: client.id, last_activity: new Date().toISOString() },
      { first_name: 'Noah',   last_name: 'Wilson',  email: `noah.w.${ts}@example.com`,    phone: '+15551230004', source: 'Shopify',  channel: 'Email', pipeline_stage: 'Customer',  client_id: client.id, last_activity: new Date().toISOString() },
      { first_name: 'Olivia', last_name: 'Brown',   email: `olivia.b.${ts}@example.com`,  phone: '+15551230005', source: 'Referral', channel: 'Email', pipeline_stage: 'Qualified', client_id: client.id, last_activity: new Date().toISOString() },
    ]).select();

    // 3 workflows: Cart Recovery, Lead Nurture, Win Back
    const { data: workflows } = await supabase.from('workflows').insert([
      { name: 'Cart Recovery', trigger_type: 'cart_abandoned', client_id: client.id, status: 'active', enrolled_count: 23 },
      { name: 'Lead Nurture',  trigger_type: 'New Customer',   client_id: client.id, status: 'active', enrolled_count: 15 },
      { name: 'Win Back',      trigger_type: 'Win-Back',       client_id: client.id, status: 'active', enrolled_count: 9  },
    ]).select();

    if (workflows && workflows.length) {
      const stepSets = {
        'Cart Recovery': [
          { step_order: 0, step_type: 'email', subject: 'You left something in your bag, {{first_name}}', content: "Hi {{first_name}},\n\nYour travel bag is still waiting. We saved your cart — grab it before it sells out.", wait_hours: 0 },
          { step_order: 1, step_type: 'wait',  content: '', wait_hours: 1 },
          { step_order: 2, step_type: 'email', subject: 'Still thinking it over?', content: "Hi {{first_name}},\n\nYour bag is almost gone. We can't hold it much longer. Complete your order today.", wait_hours: 0 },
          { step_order: 3, step_type: 'wait',  content: '', wait_hours: 24 },
          { step_order: 4, step_type: 'sms',   content: "Hi {{first_name}}! Last chance — your cart expires tonight. Reply SHOP to complete.", wait_hours: 0 },
        ],
        'Lead Nurture': [
          { step_order: 0, step_type: 'email', subject: 'Welcome to Luux Bags, {{first_name}}', content: "Hi {{first_name}},\n\nThank you for joining us. We make travel bags that last a lifetime.", wait_hours: 0 },
          { step_order: 1, step_type: 'wait',  content: '', wait_hours: 48 },
          { step_order: 2, step_type: 'email', subject: 'How we make every bag', content: "Hi {{first_name}},\n\nEach bag is handcrafted from full-grain leather and built to outlast your passport.", wait_hours: 0 },
          { step_order: 3, step_type: 'wait',  content: '', wait_hours: 72 },
          { step_order: 4, step_type: 'email', subject: 'Your first order — 10% off', content: "Hi {{first_name}},\n\nAs a new member, here's 10% off your first order. Use code WELCOME10 at checkout.", wait_hours: 0 },
        ],
        'Win Back': [
          { step_order: 0, step_type: 'email', subject: "We miss you, {{first_name}}", content: "Hi {{first_name}},\n\nIt's been a while. We've added new styles since you last visited — worth a look.", wait_hours: 0 },
          { step_order: 1, step_type: 'wait',  content: '', wait_hours: 72 },
          { step_order: 2, step_type: 'email', subject: "Come back — 15% just for you", content: "Hi {{first_name}},\n\nWe'd love to have you back. Use code COMEBACK15 for 15% off your next order.", wait_hours: 0 },
        ],
      };
      const allSteps = [];
      for (const wf of workflows) {
        (stepSets[wf.name] || []).forEach(s => allSteps.push({ ...s, workflow_id: wf.id }));
      }
      if (allSteps.length) await supabase.from('workflow_steps').insert(allSteps);

      // 47 completed enrollments spread across the 3 workflows
      if (contacts && contacts.length) {
        const enrollments = [];
        const wfCounts = { 'Cart Recovery': 23, 'Lead Nurture': 15, 'Win Back': 9 };
        let ci = 0;
        for (const wf of workflows) {
          const count = wfCounts[wf.name] || 0;
          for (let i = 0; i < count; i++) {
            const c = contacts[ci % contacts.length];
            const enrolledAt = new Date(Date.now() - (count - i) * 6 * 3600000).toISOString();
            const completedAt = new Date(Date.now() - i * 2 * 3600000).toISOString();
            enrollments.push({
              workflow_id: wf.id, contact_id: c.id, client_id: client.id,
              status: 'completed', current_step: (stepSets[wf.name] || []).length,
              enrolled_at: enrolledAt, next_step_at: completedAt, completed_at: completedAt,
            });
            ci++;
          }
        }
        await supabase.from('workflow_enrollments').insert(enrollments);
      }
    }

    // 20 messages showing sent and opened, + 2 inbound replies
    if (contacts && contacts.length) {
      const now = Date.now();
      const subjects = [
        'You left something in your bag',
        'Still thinking it over?',
        'Last chance — cart expires tonight',
        'Welcome to Luux Bags',
        'How we make every bag',
        'Your first order — 10% off',
        'We miss you',
        'Come back — 15% just for you',
        'New arrivals: weekend bags',
        'Your order has shipped',
      ];
      const msgs = [];
      for (let i = 0; i < 20; i++) {
        const contact = contacts[i % contacts.length];
        const daysAgo = Math.floor(i / 3);
        msgs.push({
          client_id: client.id,
          contact_id: contact.id,
          channel: i % 5 === 4 ? 'SMS' : 'Email',
          direction: 'outbound',
          sender_name: 'Demo Store',
          content: subjects[i % subjects.length],
          status: 'sent',
          created_at: new Date(now - daysAgo * 86400000 - i * 1800000).toISOString(),
        });
      }
      msgs.push(
        { client_id: client.id, contact_id: contacts[0].id, channel: 'Email', direction: 'inbound', sender_name: 'Emma Johnson', content: 'Just received my bag and it is absolutely stunning. Best purchase this year.', status: 'unread', created_at: new Date(now - 86400000).toISOString() },
        { client_id: client.id, contact_id: contacts[1].id, channel: 'SMS',   direction: 'inbound', sender_name: 'Liam Smith',   content: 'SHOP', status: 'unread', created_at: new Date(now - 3600000).toISOString() },
      );
      await supabase.from('messages').insert(msgs);
    }

    // Onboarding completed — AOV $30–$75 (= $52) × 47 completions ≈ $2,444 revenue shown in portal
    await supabase.from('client_onboarding').upsert([{
      client_id: client.id,
      store_url: 'luuxbags.myshopify.com',
      monthly_revenue: '$25,000–$50,000',
      average_order_value: '$30–$75',
      main_products: 'Leather weekender bags, laptop bags, passport holders, travel accessories',
      brand_voice: 'Premium, refined, minimal — quality over quantity',
      target_customer: 'Frequent travellers aged 28–45 who value craftsmanship and timeless design',
      biggest_challenge: 'Cart abandonment and converting first-time visitors',
      current_tools: ['Shopify', 'Klaviyo'],
      main_competitors: 'Tumi, Bellroy, Filson',
      goals: 'Recover abandoned carts and grow repeat purchase rate to 40%',
      completed_at: new Date().toISOString(),
    }], { onConflict: 'client_id' });

    console.log(`[Demo] Account created — ${DEMO_EMAIL} → client ${client.id}`);
    res.json({
      ok: true,
      client_id: client.id,
      demo_email: DEMO_EMAIL,
      demo_password: DEMO_PASSWORD,
      client_name: 'Demo Store',
      stats: { contacts_enrolled: 47, revenue_recovered: 2340, emails_sent: 156, open_rate: 34, active_sequences: 3 },
    });
  } catch (e) {
    console.error('/clients/create-demo error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── CLIENT ONBOARDING ───────────────────────────────────
app.post('/clients/onboard', async (req, res) => {
  const { name, email, password, business_type, niche, tier } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, and password required' });
  try {
    const { data: client, error: clientErr } = await supabase.from('clients').insert([{
      name,
      business_type: business_type || null,
      niche: niche || null,
      tier: tier || 'Starter',
      status: 'active',
    }]).select().single();
    if (clientErr) throw clientErr;

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: clientUser, error: userErr } = await supabase.from('client_users').insert([{
      name, email, password: passwordHash, client_id: client.id,
    }]).select('id, name, email, client_id').single();
    if (userErr) throw userErr;

    try {
      await sgMail.send({
        to: email,
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Zainab — Sales Scales' },
        subject: `Welcome to Sales Scales, ${name}!`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f3f8;padding:32px;">
          <div style="background:#0a1628;padding:24px 32px;border-radius:8px 8px 0 0;">
            <h1 style="color:#c9a84c;margin:0;font-size:20px;">Sales Scales</h1>
            <p style="color:#8896a8;margin:6px 0 0;font-size:13px;">AI-Powered Revenue System</p>
          </div>
          <div style="background:#ffffff;padding:32px;border-radius:0 0 8px 8px;">
            <h2 style="color:#0a1628;margin:0 0 16px;">Welcome, ${name}!</h2>
            <p style="color:#4a5568;line-height:1.7;margin:0 0 14px;">I'm Zainab, your dedicated Client Partner at Sales Scales. I'm thrilled to have you on board and will be with you every step of the way.</p>
            <p style="color:#4a5568;line-height:1.7;margin:0 0 14px;">Here are your login credentials:</p>
            <div style="background:#f0f3f8;padding:16px 20px;border-radius:8px;margin:0 0 20px;font-family:monospace;font-size:13px;">
              <div><strong>Email:</strong> ${email}</div>
              <div style="margin-top:8px;"><strong>Password:</strong> ${password}</div>
            </div>
            <p style="color:#4a5568;line-height:1.7;margin:0 0 10px;"><strong>Getting started:</strong></p>
            <ol style="color:#4a5568;line-height:2;margin:0 0 20px;padding-left:20px;">
              <li>Log in to your Sales Scales dashboard</li>
              <li>Complete your onboarding questionnaire</li>
              <li>Connect your Shopify store</li>
              <li>Your AI team (Hussain, Mahdi, Ali, Hassan, Fatima, and I) start working for you immediately</li>
            </ol>
            <p style="color:#4a5568;line-height:1.7;margin:0 0 24px;">Reply to this email anytime — I personally monitor it and will get back to you within the hour.</p>
            <p style="color:#4a5568;margin:0;">Warmly,<br><strong>Zainab</strong><br><span style="color:#8896a8;font-size:12px;">Client Partner — Sales Scales AI Team</span></p>
          </div>
        </div>`,
      });
    } catch (mailErr) {
      console.error('Welcome email failed (non-fatal):', mailErr.message);
    }

    // Fix 6: Welcome sequence — email 2 (day 3) and email 3 (day 7)
    const firstName = name.split(' ')[0];
    setTimeout(async () => {
      try {
        await sgMail.send({
          to: email,
          from: { email: 'yousef@aisalesscales.com', name: 'Yousef — Sales Scales' },
          subject: `How to get the most from Sales Scales, ${firstName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f3f8;padding:32px 16px">
            <div style="background:#0a1628;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
              <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase">Sales Scales</div>
            </div>
            <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 12px 12px;padding:32px">
              <p style="font-size:17px;font-weight:700;color:#0a1628;margin:0 0 16px">Day 3 — How to get the most from Sales Scales, ${firstName}</p>
              <p style="color:#4a5568;line-height:1.8;margin:0 0 16px">It's been 3 days since you joined — here are the 3 things that make the biggest difference for new clients:</p>
              <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:0 0 20px;border-left:3px solid #c9a84c">
                <p style="margin:0 0 12px;font-weight:700;color:#0a1628">1. Connect your Shopify store</p>
                <p style="margin:0;color:#4a5568;font-size:14px;line-height:1.7">This unlocks cart abandonment recovery, your live store data dashboard, and lets the AI team personalise every message with real product names and order history.</p>
              </div>
              <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:0 0 20px;border-left:3px solid #c9a84c">
                <p style="margin:0 0 12px;font-weight:700;color:#0a1628">2. Complete your onboarding questionnaire</p>
                <p style="margin:0;color:#4a5568;font-size:14px;line-height:1.7">Takes 5 minutes and tells your AI team everything they need to write in your exact brand voice. Skip it and the sequences will be generic. Complete it and they'll sound exactly like you.</p>
              </div>
              <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:0 0 24px;border-left:3px solid #c9a84c">
                <p style="margin:0 0 12px;font-weight:700;color:#0a1628">3. Review and approve your first sequences</p>
                <p style="margin:0;color:#4a5568;font-size:14px;line-height:1.7">Check the Approvals page — your AI team has already started drafting sequences for you. Read through, approve or edit, and they'll go live immediately.</p>
              </div>
              <p style="color:#4a5568;line-height:1.8;margin:0 0 24px">Any questions? Just reply to this email — I personally monitor it.</p>
              <p style="color:#4a5568;margin:0">Yousef<br><span style="color:#8896a8;font-size:12px">Founder, Sales Scales</span></p>
            </div>
          </div>`,
        });
        console.log(`[Welcome] Day 3 email sent to ${email}`);
      } catch (e) { console.error('[Welcome] Day 3 email failed:', e.message); }
    }, 3 * 24 * 60 * 60 * 1000);

    setTimeout(async () => {
      try {
        await sgMail.send({
          to: email,
          from: { email: 'yousef@aisalesscales.com', name: 'Yousef — Sales Scales' },
          subject: `Day 7 check-in — your first results, ${firstName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f3f8;padding:32px 16px">
            <div style="background:#0a1628;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
              <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase">Sales Scales</div>
            </div>
            <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 12px 12px;padding:32px">
              <p style="font-size:17px;font-weight:700;color:#0a1628;margin:0 0 16px">Day 7 — how's it going, ${firstName}?</p>
              <p style="color:#4a5568;line-height:1.8;margin:0 0 16px">It's been one week. I wanted to check in personally and see how things are going.</p>
              <p style="color:#4a5568;line-height:1.8;margin:0 0 16px">If your sequences are live, you should be seeing your first recovered carts in the Revenue Dashboard. If you haven't connected your store yet or haven't approved your sequences, now is the time — most clients see results within 24 hours of going live.</p>
              <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:18px;margin:0 0 24px">
                <p style="margin:0;color:#059669;font-size:14px;line-height:1.7;font-weight:600">Quick checklist for week 1:</p>
                <ul style="color:#059669;margin:8px 0 0;padding-left:18px;font-size:14px;line-height:1.8">
                  <li>Shopify connected ✓</li>
                  <li>Onboarding questionnaire completed ✓</li>
                  <li>First sequences approved ✓</li>
                  <li>First contacts enrolled ✓</li>
                </ul>
              </div>
              <p style="color:#4a5568;line-height:1.8;margin:0 0 24px">If any of those aren't done yet, reply to this email and tell me where you're stuck. I'll personally help you get unblocked.</p>
              <p style="color:#4a5568;margin:0">Yousef<br><span style="color:#8896a8;font-size:12px">Founder, Sales Scales</span></p>
            </div>
          </div>`,
        });
        console.log(`[Welcome] Day 7 email sent to ${email}`);
      } catch (e) { console.error('[Welcome] Day 7 email failed:', e.message); }
    }, 7 * 24 * 60 * 60 * 1000);

    // Issue email verification code
    try {
      const verifyCode = String(Math.floor(100000 + Math.random() * 900000));
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('email_verifications').insert([{
        email: email.toLowerCase(), code: verifyCode, expires_at: verifyExpires,
      }]);
      await sgMail.send({
        to: email,
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
        subject: 'Verify your Sales Scales account',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0">
            <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Sales Scales</div>
            <div style="color:white;font-size:16px;font-weight:600;margin-top:6px">Email Verification</div>
          </div>
          <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 8px 8px;padding:28px 24px">
            <p style="color:#4a5568;font-size:13px;margin:0 0 20px;line-height:1.6">Hi ${name}, enter this code to verify your Sales Scales account.</p>
            <div style="background:#f0f3f8;border:1px solid #e4e9f0;border-radius:10px;padding:20px;text-align:center;font-size:36px;font-weight:800;letter-spacing:12px;color:#0a1628;font-family:monospace">${verifyCode}</div>
            <p style="color:#8896a8;font-size:11px;margin:18px 0 0;line-height:1.6">This code expires in 24 hours. If you didn't create a Sales Scales account, you can safely ignore this email.</p>
          </div>
        </div>`,
      });
    } catch (verifyErr) {
      console.error('Verification email failed (non-fatal):', verifyErr.message);
    }

    // Fix 3: Auto-provision dedicated Twilio phone number for the new client
    (async () => {
      try {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return;
        const { data: existing } = await supabase.from('clients').select('twilio_subaccount_sid').eq('id', client.id).maybeSingle();
        if (existing?.twilio_subaccount_sid) return;
        const masterClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const subAccount = await masterClient.api.accounts.create({ friendlyName: `Sales Scales — ${name}` });
        const subClient = twilio(subAccount.sid, subAccount.authToken);
        const available = await subClient.availablePhoneNumbers('US').local.list({ smsEnabled: true, limit: 1 });
        if (!available || available.length === 0) return;
        const purchased = await subClient.incomingPhoneNumbers.create({ phoneNumber: available[0].phoneNumber });
        await supabase.from('clients').update({
          twilio_subaccount_sid: subAccount.sid,
          twilio_subaccount_token: subAccount.authToken,
          twilio_phone_number: purchased.phoneNumber,
        }).eq('id', client.id);
        console.log(`[Twilio] Provisioned ${purchased.phoneNumber} for ${name}`);
      } catch (twErr) {
        console.error('[Twilio] Auto-provision failed (non-fatal):', twErr.message);
      }
    })();

    console.log(`Client onboarded: ${name} (${email}) — client_id ${client.id}`);
    res.json({ ok: true, client, client_user: clientUser });
  } catch (e) {
    console.error('Client onboard error:', e.message);
    res.status(500).json({ error: 'Failed to onboard client', details: e.message });
  }
});

// ─── CREATE CONTACT (with dedup) ─────────────────────────
const upsertContact = async ({ first_name, last_name, email, phone, source, channel, pipeline_stage, notes, client_id }) => {
  const { data: existing } = await supabase.from('contacts')
    .select('*').eq('email', email).eq('client_id', client_id).maybeSingle();
  if (existing) {
    const updates = {
      first_name: first_name || existing.first_name,
      last_name: last_name ?? existing.last_name,
      phone: phone || existing.phone,
      source: source || existing.source,
      channel: channel || existing.channel,
      pipeline_stage: pipeline_stage || existing.pipeline_stage,
      notes: notes ?? existing.notes,
      last_activity: new Date().toISOString(),
    };
    await supabase.from('contacts').update(updates).eq('id', existing.id);
    return { contact: { ...existing, ...updates }, duplicate_found: true };
  }
  const { data: contact, error } = await supabase.from('contacts').insert([{
    first_name, last_name, email, phone: phone || null,
    source: source || 'Manual', channel: channel || 'Email',
    pipeline_stage: pipeline_stage || 'New Lead',
    notes: notes || null, client_id: client_id || null,
    last_activity: new Date().toISOString(),
  }]).select().single();
  if (error) throw error;
  return { contact, duplicate_found: false };
};

app.post('/contacts', async (req, res) => {
  const { first_name, email } = req.body;
  if (!first_name || !email) return res.status(400).json({ error: 'first_name and email required' });
  try {
    const result = await upsertContact(req.body);
    res.json(result);
  } catch (e) {
    console.error('Create contact error:', e.message);
    res.status(500).json({ error: 'Failed to create contact', details: e.message });
  }
});

app.post('/contacts/create', async (req, res) => {
  const { first_name, email } = req.body;
  if (!first_name || !email) return res.status(400).json({ error: 'first_name and email required' });
  try {
    const result = await upsertContact(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ONBOARDING COMPLETION NOTIFICATION ───────────────────
app.post('/onboarding/complete', async (req, res) => {
  const { client_id, client_name, shopify_connected } = req.body;
  try {
    const name = client_name || 'A client';
    await sgMail.send({
      to: 'yousef@salesscales.com',
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
      subject: `Client Fully Onboarded — ${name}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0;border-left:4px solid #c9a84c;">
          <div style="color:#c9a84c;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Onboarding Complete — Sales Scales</div>
          <div style="color:white;font-size:16px;font-weight:600;">${name} is ready to go live</div>
        </div>
        <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px;">
          <p style="color:#4a5568;font-size:13px;margin:0 0 12px;">${name} has completed all onboarding steps and is ready for the AI team to begin work.</p>
          <div style="background:#f8fafc;border-radius:6px;padding:14px;font-size:12px;color:#0a1628;line-height:1.7;">
            <strong>Shopify connection:</strong> ${shopify_connected ? '✅ Connected' : '⚠️ Not connected (skipped)'}
          </div>
          <p style="color:#8896a8;font-size:11px;margin:14px 0 0;">Log in to Sales Scales to review their profile and activate their sequences.</p>
        </div>
      </div>`,
    });
    sendSlackAlert(`✅ *New client onboarded* — ${name}${shopify_connected ? ' (Shopify connected)' : ''}`);
    console.log('Onboarding completion email sent for client:', client_id);
    res.json({ ok: true });
  } catch (e) {
    console.error('Onboarding notification failed:', e.message);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ─── AUTO SCHEDULER: DATA RETENTION — 90-DAY PURGE ───────
// Runs daily at 3am — purges PII for clients cancelled 90+ days ago
cron.schedule('0 3 * * *', async () => {
  console.log('[AUTO] Data retention — scanning for clients due for purge...');
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: markers } = await supabase.from('team_briefings')
      .select('id, subject, content, created_at')
      .like('subject', '[DATA_RETENTION]%')
      .lt('created_at', cutoff);

    if (!markers || markers.length === 0) {
      console.log('[AUTO] Data retention — no clients due for purge');
      return;
    }

    let purged = 0;
    for (const marker of markers) {
      const clientId = marker.subject.replace('[DATA_RETENTION]', '').trim();
      if (!clientId) continue;
      try {
        const { data: client } = await supabase.from('clients')
          .select('id, name, status').eq('id', clientId).maybeSingle();
        if (!client || client.status !== 'cancelled') {
          await supabase.from('team_briefings').delete().eq('id', marker.id);
          continue;
        }
        // Delete PII and operational data — keep contracts, reports, case_studies for records
        const { data: wfs } = await supabase.from('workflows').select('id').eq('client_id', clientId);
        if (wfs && wfs.length > 0) {
          await supabase.from('workflow_steps').delete().in('workflow_id', wfs.map(w => w.id));
        }
        await Promise.all([
          supabase.from('contacts').delete().eq('client_id', clientId),
          supabase.from('messages').delete().eq('client_id', clientId),
          supabase.from('workflow_enrollments').delete().eq('client_id', clientId),
          supabase.from('workflows').delete().eq('client_id', clientId),
          supabase.from('activity').delete().eq('client_id', clientId),
          supabase.from('approvals').delete().eq('client_id', clientId),
          supabase.from('client_onboarding').delete().eq('client_id', clientId),
          supabase.from('client_users').delete().eq('client_id', clientId),
          supabase.from('shopify_connections').delete().eq('client_id', clientId),
          supabase.from('knowledge_base').delete().eq('client_id', clientId),
          supabase.from('pipeline_deals').delete().eq('client_id', clientId),
        ]);
        await supabase.from('clients').update({ status: 'data_purged' }).eq('id', clientId);
        await supabase.from('team_briefings').delete().eq('id', marker.id);
        console.log(`[AUTO] Data retention — purged data for ${client.name} (${clientId})`);
        purged++;
      } catch (purgeErr) {
        console.error(`[AUTO] Data retention — failed for ${clientId}:`, purgeErr.message);
      }
    }
    if (purged > 0) console.log(`[AUTO] Data retention — ${purged} client(s) purged`);
  } catch (e) {
    console.error('[AUTO] Data retention error:', e.message);
  }
});

// ─── FIX 2: RATE LIMIT STATS ──────────────────────────────
app.get('/admin/rate-limit-stats', async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data } = await supabase.from('rate_limit_hits').select('ip, endpoint, created_at').gte('created_at', weekAgo);
    const byEndpoint = {}, byIp = {};
    (data || []).forEach(h => {
      byEndpoint[h.endpoint] = (byEndpoint[h.endpoint] || 0) + 1;
      byIp[h.ip] = (byIp[h.ip] || 0) + 1;
    });
    const topEndpoints = Object.entries(byEndpoint).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([endpoint, hits]) => ({ endpoint, hits }));
    const topIps = Object.entries(byIp).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ip, hits]) => ({ ip, hits }));
    res.json({ total: data?.length || 0, topEndpoints, topIps, week_start: weekAgo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 3: SLOW ENDPOINT STATS ───────────────────────────
app.get('/admin/slow-endpoints', async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data } = await supabase.from('request_logs').select('method, path, response_time_ms').gte('created_at', weekAgo);
    const grouped = {};
    (data || []).forEach(r => {
      const key = `${r.method} ${r.path}`;
      if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
      grouped[key].total += r.response_time_ms;
      grouped[key].count++;
    });
    const stats = Object.entries(grouped).map(([endpoint, { total, count }]) => ({ endpoint, avg_ms: Math.round(total / count), count })).sort((a, b) => b.avg_ms - a.avg_ms).slice(0, 20);
    res.json({ slow_endpoints: stats, week_start: weekAgo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 5: CALENDLY UPCOMING CALLS ───────────────────────
// REPLACE_WITH_REAL_CALENDLY_API_KEY — set CALENDLY_API_KEY in your hosting env vars (not .env)
app.get('/calendly/upcoming', async (req, res) => {
  const apiKey = process.env.CALENDLY_API_KEY;
  if (!apiKey) return res.json({ events: [], configured: false, note: 'Set CALENDLY_API_KEY env var to activate' });
  try {
    const userRes = await axios.get('https://api.calendly.com/users/me', { headers: { Authorization: `Bearer ${apiKey}` } });
    const userUri = userRes.data.resource?.uri;
    const eventsRes = await axios.get('https://api.calendly.com/scheduled_events', {
      headers: { Authorization: `Bearer ${apiKey}` },
      params: { user: userUri, status: 'active', count: 10, sort: 'start_time:asc', min_start_time: new Date().toISOString() },
    });
    const events = (eventsRes.data.collection || []).map(e => ({
      id: e.uri.split('/').pop(),
      name: e.name,
      start_time: e.start_time,
      end_time: e.end_time,
      status: e.status,
      join_url: e.location?.join_url || null,
    }));
    res.json({ events, configured: true });
  } catch (e) {
    console.error('Calendly fetch error:', e.response?.data || e.message);
    res.json({ events: [], configured: true, error: e.response?.data?.message || e.message });
  }
});

// ─── FIX 6: PLATFORM SETTINGS ─────────────────────────────
// SQL: create table if not exists platform_settings (key text primary key, value text, updated_at timestamptz default now());
app.get('/settings/platform', async (req, res) => {
  try {
    const { data } = await supabase.from('platform_settings').select('key, value');
    const settings = (data || []).reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
    res.json({ settings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/settings/platform', async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' });
  try {
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }));
    await supabase.from('platform_settings').upsert(rows, { onConflict: 'key' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 8: REFERRALS ALL (owner view) ────────────────────
app.get('/referrals/all', async (req, res) => {
  try {
    const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false });
    const referrals = data || [];
    const converted = referrals.filter(r => r.status === 'converted').length;
    const pending = referrals.filter(r => r.status === 'pending').length;
    res.json({ referrals, stats: { total: referrals.length, converted, pending, estimated_revenue: converted * 1500 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 9: INVOICE GENERATION ────────────────────────────
// SQL: create table if not exists invoices (id uuid default gen_random_uuid() primary key, invoice_number text unique, client_id uuid, client_name text, plan text, amount numeric, due_date date, status text default 'unpaid', line_items jsonb default '[]', created_at timestamptz default now());
const nextInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true });
  return `INV-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
};

app.post('/invoices/generate', async (req, res) => {
  const { client_id, plan, amount, due_date, line_items } = req.body;
  if (!client_id || !amount) return res.status(400).json({ error: 'client_id and amount required' });
  try {
    const { data: client } = await supabase.from('clients').select('name, tier').eq('id', client_id).maybeSingle();
    const invoice_number = await nextInvoiceNumber();
    const { data, error } = await supabase.from('invoices').insert([{
      invoice_number, client_id,
      client_name: client?.name || 'Unknown Client',
      plan: plan || client?.tier || 'starter',
      amount: parseFloat(amount),
      due_date: due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      line_items: line_items || [{ description: `${plan || client?.tier || 'Starter'} Plan — Monthly Subscription`, amount }],
      status: 'unpaid',
      created_at: new Date().toISOString(),
    }]).select().single();
    if (error) throw error;
    res.json({ invoice: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/invoices/list', async (req, res) => {
  const { client_id } = req.query;
  try {
    let q = supabase.from('invoices').select('*').order('created_at', { ascending: false });
    if (client_id) q = q.eq('client_id', client_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ invoices: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/invoices/pdf', async (req, res) => {
  const { invoice_id } = req.query;
  if (!invoice_id) return res.status(400).send('invoice_id required');
  try {
    const { data: inv } = await supabase.from('invoices').select('*').eq('id', invoice_id).maybeSingle();
    if (!inv) return res.status(404).send('Invoice not found');
    const items = Array.isArray(inv.line_items) ? inv.line_items : [];
    const itemRows = items.map(li => `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f3f8;font-size:13px;color:#4a5568">${li.description || ''}</td><td style="padding:10px 0;border-bottom:1px solid #f0f3f8;text-align:right;font-size:13px;font-weight:600;color:#0a1628">$${parseFloat(li.amount).toLocaleString()}</td></tr>`).join('');
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv.invoice_number}</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#0a1628}@media print{body{margin:0}}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #0a1628">
        <div><div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#0a1628">SALES SCALES</div><div style="font-size:10px;color:#8896a8;letter-spacing:2px;margin-top:4px">AI REVENUE SYSTEM</div></div>
        <div style="text-align:right"><div style="font-size:28px;font-weight:700;color:#c9a84c">${inv.invoice_number}</div><div style="font-size:11px;color:#8896a8;margin-top:4px">Invoice</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:40px">
        <div><div style="font-size:9px;font-weight:700;color:#8896a8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Billed To</div><div style="font-size:14px;font-weight:600">${inv.client_name}</div></div>
        <div style="text-align:right"><div style="font-size:9px;font-weight:700;color:#8896a8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Details</div><div style="font-size:12px;color:#4a5568">Issue Date: ${new Date(inv.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div><div style="font-size:12px;color:#4a5568;margin-top:4px">Due Date: ${inv.due_date || '—'}</div><div style="margin-top:6px"><span style="background:${inv.status==='paid'?'#ecfdf5':'#fffbeb'};color:${inv.status==='paid'?'#059669':'#d97706'};border:1px solid ${inv.status==='paid'?'#a7f3d0':'#fde68a'};padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700">${inv.status?.toUpperCase()}</span></div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px"><thead><tr><th style="text-align:left;font-size:9px;font-weight:700;color:#8896a8;letter-spacing:2px;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #e4e9f0">Description</th><th style="text-align:right;font-size:9px;font-weight:700;color:#8896a8;letter-spacing:2px;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid #e4e9f0">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
      <div style="text-align:right;padding:16px 0;border-top:2px solid #0a1628"><span style="font-size:18px;font-weight:700;color:#0a1628">Total: $${parseFloat(inv.amount).toLocaleString()}</span></div>
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #f0f3f8;font-size:10px;color:#8896a8;text-align:center">Sales Scales · AI Revenue System · support@aisalesscales.com</div>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
  } catch (e) { res.status(500).send('Error generating invoice'); }
});

app.patch('/invoices/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    const { data, error } = await supabase.from('invoices').update({ status }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ invoice: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 7: CLIENT ONBOARDING CHECKLIST DAILY ALERT ───────
cron.schedule('30 9 * * *', async () => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const { data: newClients } = await supabase.from('clients').select('id, name').eq('status', 'active').gte('created_at', eightDaysAgo).lte('created_at', sevenDaysAgo);
    if (!newClients || newClients.length === 0) return;
    for (const client of newClients) {
      const [shopifyRes, approvedRes, enrolledRes, emailRes] = await Promise.all([
        supabase.from('shopify_connections').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
        supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', 'approved'),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', client.id),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('channel', 'email').eq('direction', 'outbound'),
      ]);
      const checks = { shopify: (shopifyRes.count || 0) > 0, approved: (approvedRes.count || 0) > 0, enrolled: (enrolledRes.count || 0) > 0, email_sent: (emailRes.count || 0) > 0 };
      const done = Object.values(checks).filter(Boolean).length;
      if (done < 4) {
        const missing = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k.replace(/_/g, ' ')).join(', ');
        await storeBriefing('fatima', 'yousef',
          `Onboarding Incomplete — ${client.name} (7 days in)`,
          `${client.name} has been onboarded for 7 days but has not completed all setup steps.\n\nCompleted: ${done}/4\nMissing: ${missing}\n\nRecommend scheduling a check-in call to help them complete setup.`,
          'high', client.id);
      }
    }
  } catch (e) { console.error('[AUTO] Onboarding checklist cron error:', e.message); }
});

// ─── FIX 5: RE-ENGAGEMENT SEQUENCE CRON — DAILY 3PM ──────
cron.schedule('0 15 * * *', async () => {
  console.log('[AUTO] Re-engagement scan starting...');
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    // Contacts who opened an email, had an enrollment 30+ days ago, not currently active, not converted
    const { data: candidates } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, client_id')
      .not('pipeline_stage', 'eq', 'Converted')
      .not('email', 'is', null);

    if (!candidates || candidates.length === 0) return;

    for (const c of candidates) {
      try {
        const [openedRes, oldEnrollRes, activeRes] = await Promise.all([
          supabase.from('messages').select('id', { count: 'exact', head: true })
            .eq('contact_id', c.id).eq('direction', 'outbound').not('opened_at', 'is', null),
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
            .eq('contact_id', c.id).lte('enrolled_at', thirtyDaysAgo),
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
            .eq('contact_id', c.id).eq('status', 'active'),
        ]);
        if ((openedRes.count || 0) === 0) continue;
        if ((oldEnrollRes.count || 0) === 0) continue;
        if ((activeRes.count || 0) > 0) continue;

        const { data: client } = await supabase.from('clients').select('name, niche').eq('id', c.client_id).maybeSingle();
        const seqJson = await aiCall(
          `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown.`,
          `Write a 3-email re-engagement sequence for ${c.first_name || 'a contact'} of ${client?.name || 'the store'} (${client?.niche || 'ecommerce'}). They engaged before but haven't purchased.\n\nEmail 1 (day 1): What you missed — highlight best products/offers since their last visit\nEmail 2 (day 4): New arrivals — show fresh inventory relevant to them\nEmail 3 (day 7): Final offer — time-sensitive deal to drive action\n\nReturn JSON: {"steps":[{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":72},{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":72},{"step_type":"email","subject":"...","content":"...","wait_hours":0}]}`
        );
        let parsed = { steps: [] };
        try { const s = seqJson.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim(); const m = s.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : s); } catch {}
        await supabase.from('approvals').insert([{
          type: 'email_sequence',
          title: `Re-engagement Sequence — ${c.first_name || c.email}`,
          content: `${c.first_name || c.email} opened emails but has not purchased in 30+ days. Approve to send a 3-email re-engagement campaign.`,
          metadata: { steps: parsed.steps || [], trigger_type: 'manual', contact_id: c.id },
          from_member: 'mahdi', client_id: c.client_id, priority: 'normal', status: 'pending',
          created_at: new Date().toISOString(),
        }]);
        console.log(`[AUTO] Re-engagement queued for ${c.email}`);
      } catch (contactErr) {
        console.error(`[AUTO] Re-engagement failed for ${c.email}:`, contactErr.message);
      }
    }
  } catch (e) {
    console.error('[AUTO] Re-engagement cron error:', e.message);
  }
});

// ─── FIX 1: BROWSE TRACK SCRIPT ───────────────────────────
// Returns a JS snippet to paste into Shopify theme.liquid before </body>
app.get('/shopify/browse-track', (req, res) => {
  const { client_id } = req.query;
  const apiBase = process.env.REACT_APP_API_URL || 'https://api.aisalesscales.com';
  // HOW TO INSTALL IN SHOPIFY:
  // 1. Go to Shopify Admin → Online Store → Themes → Edit code
  // 2. Open layout/theme.liquid
  // 3. Paste the script before the closing </body> tag
  // 4. Replace YOUR_CLIENT_ID with the actual client_id from your Sales Scales platform
  // 5. Save — the tracker fires automatically on product pages for logged-in customers
  const snippet = `<script>
/* Sales Scales Browse Abandonment Tracker — installed via GET /shopify/browse-track */
(function() {
  try {
    if (!window.Shopify || !Shopify.customer || !Shopify.customer.email) return;
    if (!window.location.pathname.startsWith('/products/')) return;
    var email = Shopify.customer.email;
    var productTitle = document.querySelector('h1.product__title')?.innerText
      || document.querySelector('h1')?.innerText
      || document.title;
    setTimeout(function() {
      fetch(${JSON.stringify(apiBase)} + '/shopify/browse-abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          product_title: productTitle,
          product_url: window.location.href,
          client_id: ${JSON.stringify(client_id || 'YOUR_CLIENT_ID')}
        })
      }).catch(function(){});
    }, 30000);
  } catch(e) {}
})();
</script>`;
  res.setHeader('Content-Type', 'text/plain');
  res.send(snippet.trim());
});

// ─── FIX 8 (orig): BROWSE ABANDONMENT WEBHOOK ─────────────
app.post('/shopify/browse-abandon', async (req, res) => {
  res.sendStatus(200);
  const { email, product_title, product_id, client_id } = req.body;
  if (!email || !client_id) return;
  try {
    const { data: contact } = await supabase.from('contacts').select('*').eq('email', email).eq('client_id', client_id).maybeSingle();
    if (!contact) { console.log('[browse-abandon] Unknown contact:', email); return; }

    const { data: client } = await supabase.from('clients').select('name, niche').eq('id', client_id).maybeSingle();
    const seqJson = await aiCall(
      `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown.`,
      `Write a 2-email browse abandonment sequence. A customer of ${client?.name || 'the store'} (${client?.niche || 'ecommerce'}) viewed "${product_title || 'a product'}" but did not add to cart.\n\nEmail 1 (1 hour after browse): Warm, curious opener — "noticed you were looking at something" — reference the product by name, highlight one key benefit\nEmail 2 (24 hours later): "Still thinking about it?" — social proof, nudge, soft CTA\n\nReturn JSON: {"steps":[{"step_type":"wait","content":"","wait_hours":1},{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":23},{"step_type":"email","subject":"...","content":"...","wait_hours":0}]}`
    );
    let parsed = { steps: [] };
    try { const s = seqJson.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim(); const m = s.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : s); } catch {}

    const { data: workflow } = await supabase.from('workflows').insert([{
      name: `Browse Abandonment — ${product_title || 'Product'}`,
      client_id, trigger_type: 'browse_abandonment', status: 'active', enrolled_count: 0,
    }]).select().single();
    if (workflow && parsed.steps?.length) {
      await supabase.from('workflow_steps').insert(parsed.steps.map((s, i) => ({ workflow_id: workflow.id, step_order: i, step_type: s.step_type, content: s.content || '', subject: s.subject || null, wait_hours: s.wait_hours || 0 })));
      await enrollContactInWorkflow(workflow.id, contact.id, client_id, contact.email, contact.phone, contact.first_name);
    }
    console.log(`[browse-abandon] Enrolled ${email} in browse abandonment for "${product_title}"`);
  } catch (e) {
    console.error('[browse-abandon] Error:', e.message);
  }
});

// ─── FIX 9: NPS SURVEY — MONTHLY CRON + SUBMIT ────────────
// SQL: create table nps_responses (id uuid default gen_random_uuid() primary key, client_id uuid, score integer, comment text, created_at timestamptz default now());
cron.schedule('0 10 28 * *', async () => {
  console.log('[AUTO] NPS survey sending...');
  try {
    const { data: clients } = await supabase.from('clients').select('id, name').eq('status', 'active');
    if (!clients || clients.length === 0) return;
    for (const client of clients) {
      try {
        const { data: users } = await supabase.from('client_users').select('email, name').eq('client_id', client.id);
        if (!users || users.length === 0) continue;
        const apiBase = process.env.REACT_APP_API_URL || 'https://api.aisalesscales.com';
        const scores = [0,1,2,3,4,5,6,7,8,9,10].map(n => {
          const bg = n <= 6 ? (n <= 3 ? '#fee2e2' : '#fef3c7') : '#dcfce7';
          const color = n <= 6 ? (n <= 3 ? '#dc2626' : '#d97706') : '#059669';
          const border = n <= 6 ? (n <= 3 ? '#fecaca' : '#fde68a') : '#a7f3d0';
          return `<a href="${apiBase}/nps/submit?client_id=${client.id}&score=${n}" style="display:inline-block;width:46px;height:46px;line-height:46px;text-align:center;background:${bg};border:2px solid ${border};border-radius:10px;color:${color};font-size:16px;font-weight:800;text-decoration:none;margin:3px;font-family:Arial,sans-serif">${n}</a>`;
        }).join('');
        for (const u of users) {
          await sgMail.send({
            to: u.email,
            from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
            subject: `${u.name?.split(' ')[0] || 'Quick question'} — how is Sales Scales working for you?`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f3f8;padding:24px">
              <div style="background:#0a1628;padding:22px 28px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between">
                <div>
                  <div style="color:#c9a84c;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:2px">Sales Scales</div>
                  <div style="color:rgba(255,255,255,0.4);font-size:10px">AI Revenue System</div>
                </div>
                <div style="background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:20px;padding:4px 12px;color:#c9a84c;font-size:10px;font-weight:700">Monthly Survey</div>
              </div>
              <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 12px 12px;padding:32px 28px">
                <div style="font-size:18px;font-weight:700;color:#0a1628;margin:0 0 6px">Hi ${u.name?.split(' ')[0] || 'there'} 👋</div>
                <div style="font-size:13px;color:#4a5568;line-height:1.7;margin:0 0 28px">We want to make sure Sales Scales is delivering real value for ${client.name}. One quick question:</div>
                <div style="background:#f8fafc;border-radius:10px;padding:20px 24px;margin-bottom:24px;border:1px solid #f0f3f8">
                  <div style="font-size:14px;font-weight:700;color:#0a1628;text-align:center;margin-bottom:20px">How likely are you to recommend Sales Scales to another ecommerce brand?</div>
                  <div style="text-align:center;margin-bottom:10px">${scores}</div>
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:#8896a8;padding:0 4px">
                    <span>🙁 Not at all</span><span>😐 Neutral</span><span>😍 Extremely likely</span>
                  </div>
                </div>
                <div style="display:flex;gap:8px;margin-bottom:24px">
                  <div style="flex:1;background:#fee2e2;border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:#dc2626;font-weight:700;letter-spacing:1px">0–6</div><div style="font-size:10px;color:#dc2626">Detractor</div></div>
                  <div style="flex:1;background:#fef3c7;border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:#d97706;font-weight:700;letter-spacing:1px">7–8</div><div style="font-size:10px;color:#d97706">Passive</div></div>
                  <div style="flex:1;background:#dcfce7;border-radius:8px;padding:8px;text-align:center"><div style="font-size:9px;color:#059669;font-weight:700;letter-spacing:1px">9–10</div><div style="font-size:10px;color:#059669">Promoter</div></div>
                </div>
                <div style="border-top:1px solid #f0f3f8;padding-top:18px;font-size:11px;color:#8896a8;line-height:1.6;text-align:center">This takes 5 seconds. Your honest feedback helps us improve.<br>Your score is anonymous and never shared.</div>
              </div>
              <div style="text-align:center;padding:16px;font-size:10px;color:#8896a8">Sales Scales · AI Revenue System · <a href="${apiBase}/nps/submit?client_id=${client.id}&score=9" style="color:#c9a84c">Unsubscribe</a></div>
            </div>`,
          });
        }
        console.log(`[AUTO] NPS sent to ${users.length} user(s) for ${client.name}`);
      } catch (clientErr) {
        console.error(`[AUTO] NPS failed for ${client.name}:`, clientErr.message);
      }
    }
  } catch (e) {
    console.error('[AUTO] NPS cron error:', e.message);
  }
});

app.get('/nps/submit', async (req, res) => {
  const { client_id, score, comment } = req.query;
  if (!client_id || score === undefined) return res.status(400).send('Missing parameters');
  const scoreInt = parseInt(score, 10);
  if (isNaN(scoreInt) || scoreInt < 0 || scoreInt > 10) return res.status(400).send('Invalid score');
  try {
    await supabase.from('nps_responses').insert([{ client_id, score: scoreInt, comment: comment || null }]);
    if (scoreInt < 7) {
      const { data: client } = await supabase.from('clients').select('name').eq('id', client_id).maybeSingle();
      await sgMail.send({
        to: 'yousef@aisalesscales.com',
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
        subject: `⚠️ Low NPS Score — ${client?.name || client_id} gave ${scoreInt}/10`,
        html: `<p><strong>${client?.name || client_id}</strong> submitted an NPS score of <strong>${scoreInt}/10</strong>.</p>${comment ? `<p>Comment: "${comment}"</p>` : ''}<p>Follow up promptly to resolve their concern.</p>`,
      }).catch(e => console.error('NPS alert email failed:', e.message));
    }
    const label = scoreInt >= 9 ? 'Promoter' : scoreInt >= 7 ? 'Passive' : 'Detractor';
    const color = scoreInt >= 9 ? '#059669' : scoreInt >= 7 ? '#d97706' : '#dc2626';
    const msg = scoreInt >= 9 ? "We're thrilled you're happy! Consider referring us to another brand." : scoreInt >= 7 ? "Thanks for your feedback. We're always working to improve." : "We're sorry to hear that. Our team will reach out shortly.";
    res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,sans-serif;background:#f0f3f8;margin:0;padding:40px 20px;min-height:100vh;display:flex;align-items:center;justify-content:center"><div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(10,22,40,0.12)"><div style="background:#0a1628;padding:28px;text-align:center"><div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Sales Scales</div><div style="width:60px;height:60px;border-radius:50%;background:${color}22;border:2px solid ${color}66;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:24px">${scoreInt >= 9 ? '🎉' : scoreInt >= 7 ? '👍' : '💛'}</div></div><div style="padding:32px;text-align:center"><div style="font-size:20px;font-weight:700;color:#0a1628;margin-bottom:8px">Thank you for your feedback!</div><div style="display:inline-block;background:${color}15;color:${color};border:1px solid ${color}40;border-radius:20px;padding:4px 16px;font-size:11px;font-weight:700;margin-bottom:16px">Score: ${scoreInt}/10 · ${label}</div><p style="font-size:13px;color:#4a5568;line-height:1.7;margin:0 0 24px">${msg}</p><div style="background:#f8fafc;border-radius:8px;padding:14px;font-size:11px;color:#8896a8;line-height:1.6">Your response has been recorded. We review every score and use them to improve your experience.</div></div></div></body></html>`);
  } catch (e) {
    console.error('NPS submit error:', e.message);
    res.status(500).send('Error saving response');
  }
});

// ─── FIX 5: CLIENT LTV ENDPOINT ───────────────────────────
// SQL: no new tables needed — uses existing clients + workflow_enrollments
const TIER_PRICES = { starter: 199, growth: 299, elite: 399, scale: 399, 'Starter': 199, 'Growth': 299, 'Elite': 399, 'Scale': 399 };
app.get('/clients/ltv', async (req, res) => {
  try {
    const { data: clients } = await supabase.from('clients').select('id, name, tier, created_at, status');
    if (!clients || clients.length === 0) return res.json({ clients: [] });
    const results = await Promise.all(clients.map(async (client) => {
      const monthsActive = Math.max(1, Math.floor((Date.now() - new Date(client.created_at)) / (30.44 * 86400000)));
      const monthlyFee = TIER_PRICES[client.tier] || TIER_PRICES[client.tier?.toLowerCase()] || 199;
      const totalSubscription = monthlyFee * monthsActive;
      const { count: completedEnrollments } = await supabase
        .from('workflow_enrollments').select('id', { count: 'exact', head: true })
        .eq('client_id', client.id).eq('status', 'completed');
      const totalRecovered = (completedEnrollments || 0) * 75;
      const roi = totalSubscription > 0 ? (totalRecovered / totalSubscription).toFixed(2) : '0.00';
      return { id: client.id, name: client.name, tier: client.tier, monthlyFee, monthsActive, totalSubscription, totalRecovered, roi: parseFloat(roi) };
    }));
    res.json({ clients: results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 7: WEBHOOK DELIVERY MONITORING ───────────────────
// SQL: CREATE TABLE IF NOT EXISTS webhook_logs (id uuid default gen_random_uuid() primary key, shop text, topic text, received_at timestamptz default now(), success boolean DEFAULT true, error_message text);
const logWebhook = async (shop, topic, success, errorMsg) => {
  try {
    await supabase.from('webhook_logs').insert([{
      shop, topic, received_at: new Date().toISOString(), success, error_message: errorMsg || null
    }]);
  } catch (e) { /* non-critical */ }
};

app.get('/webhooks/logs', async (req, res) => {
  try {
    const { data, error } = await supabase.from('webhook_logs').select('*').order('received_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ logs: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 6: CONTACT MERGE ─────────────────────────────────
app.post('/contacts/merge', async (req, res) => {
  const { primary_contact_id, duplicate_contact_id } = req.body;
  if (!primary_contact_id || !duplicate_contact_id) return res.status(400).json({ error: 'primary_contact_id and duplicate_contact_id required' });
  if (primary_contact_id === duplicate_contact_id) return res.status(400).json({ error: 'Cannot merge a contact with itself' });
  try {
    await Promise.all([
      supabase.from('messages').update({ contact_id: primary_contact_id }).eq('contact_id', duplicate_contact_id),
      supabase.from('workflow_enrollments').update({ contact_id: primary_contact_id }).eq('contact_id', duplicate_contact_id),
      supabase.from('activity').update({ contact_id: primary_contact_id }).eq('contact_id', duplicate_contact_id),
    ]);
    await supabase.from('contacts').delete().eq('id', duplicate_contact_id);
    res.json({ ok: true });
  } catch (e) {
    console.error('/contacts/merge error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 10: BRIEFINGS ARCHIVE ────────────────────────────
// SQL: alter table team_briefings add column if not exists is_archived boolean default false;
app.post('/briefings/archive', async (req, res) => {
  const { briefing_id } = req.body;
  if (!briefing_id) return res.status(400).json({ error: 'briefing_id required' });
  try {
    const { error } = await supabase.from('team_briefings').update({ is_archived: true }).eq('id', briefing_id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 3: TASKS CRUD ────────────────────────────────────
// SQL: create table tasks (id uuid default gen_random_uuid() primary key, title text not null, description text, due_date date, priority text default 'normal', status text default 'open', client_id uuid, created_at timestamptz default now());
app.post('/tasks', async (req, res) => {
  const { title, description, due_date, priority, client_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const { data, error } = await supabase.from('tasks').insert([{
      title, description: description || null, due_date: due_date || null,
      priority: priority || 'normal', status: 'open',
      client_id: client_id || null, created_at: new Date().toISOString(),
    }]).select().single();
    if (error) throw error;
    res.json({ task: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/tasks', async (req, res) => {
  const { client_id, status } = req.query;
  try {
    let q = supabase.from('tasks').select('*, clients(name)').order('due_date', { ascending: true, nullsFirst: false });
    if (client_id) q = q.eq('client_id', client_id);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ tasks: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/tasks/:id', async (req, res) => {
  const { title, description, due_date, priority, status, client_id } = req.body;
  try {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (due_date !== undefined) updates.due_date = due_date;
    if (priority !== undefined) updates.priority = priority;
    if (status !== undefined) updates.status = status;
    if (client_id !== undefined) updates.client_id = client_id;
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ task: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 1: EXPORT ENDPOINTS ──────────────────────────────
const toCSVRow = (fields, obj) => fields.map(f => {
  const v = obj[f];
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',');

app.get('/contacts/export', async (req, res) => {
  const { client_id } = req.query;
  try {
    let q = supabase.from('contacts').select('first_name, last_name, email, phone, tags, pipeline_stage, source, channel, created_at').order('created_at', { ascending: false });
    if (client_id) q = q.eq('client_id', client_id);
    const { data, error } = await q;
    if (error) throw error;
    const fields = ['first_name', 'last_name', 'email', 'phone', 'tags', 'pipeline_stage', 'source', 'channel', 'created_at'];
    const csv = [fields.join(','), ...(data || []).map(r => toCSVRow(fields, r))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/clients/export', async (req, res) => {
  try {
    const { data, error } = await supabase.from('clients').select('name, niche, tier, status, health_score, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    const fields = ['name', 'niche', 'tier', 'status', 'health_score', 'created_at'];
    const csv = [fields.join(','), ...(data || []).map(r => toCSVRow(fields, r))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 3: PIPELINE STAGE CUSTOMIZATION ──────────────────
// SQL: create table if not exists pipeline_stages (id uuid default gen_random_uuid() primary key, client_id uuid not null unique, stages text[] not null, updated_at timestamptz default now());
app.put('/pipeline/stages', async (req, res) => {
  const { client_id, stages } = req.body;
  if (!client_id || !Array.isArray(stages) || stages.length === 0) return res.status(400).json({ error: 'client_id and stages[] required' });
  try {
    const { data, error } = await supabase.from('pipeline_stages').upsert([{ client_id, stages, updated_at: new Date().toISOString() }], { onConflict: 'client_id' }).select().single();
    if (error) throw error;
    res.json({ pipeline_stages: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/pipeline/stages', async (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { data } = await supabase.from('pipeline_stages').select('stages').eq('client_id', client_id).maybeSingle();
    res.json({ stages: data?.stages || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 5: CLIENT DATA EXPORT (GDPR) ─────────────────────
app.get('/client/export-data', async (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const [contactsRes, messagesRes, enrollmentsRes, reportsRes] = await Promise.all([
      supabase.from('contacts').select('first_name, last_name, email, phone, source, pipeline_stage, created_at').eq('client_id', client_id),
      supabase.from('messages').select('channel, direction, content, created_at').eq('client_id', client_id).order('created_at', { ascending: false }).limit(500),
      supabase.from('workflow_enrollments').select('workflow_id, status, enrolled_at, completed_at').eq('client_id', client_id).order('enrolled_at', { ascending: false }).limit(200),
      supabase.from('reports').select('period, emails_sent, sms_sent, contacts_added, summary').eq('client_id', client_id).order('created_at', { ascending: false }),
    ]);
    res.json({
      exported_at: new Date().toISOString(),
      client_id,
      contacts: contactsRes.data || [],
      messages: messagesRes.data || [],
      enrollments: enrollmentsRes.data || [],
      reports: reportsRes.data || [],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 6: EMAIL UNSUBSCRIBE ──────────────────────────────
// SQL: alter table contacts add column if not exists email_opted_out boolean default false;
app.get('/email/unsubscribe', async (req, res) => {
  const { contact_id, client_id } = req.query;
  if (!contact_id) return res.status(400).send('Missing contact_id');
  try {
    await supabase.from('contacts').update({ email_opted_out: true, status: 'unsubscribed' }).eq('id', contact_id);
    await supabase.from('workflow_enrollments').update({ status: 'cancelled' }).eq('contact_id', contact_id).eq('status', 'active');
    const { data: c } = await supabase.from('contacts').select('email, first_name').eq('id', contact_id).maybeSingle();
    if (c?.email && process.env.SENDGRID_FROM_EMAIL) {
      await sgMail.send({
        to: c.email,
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
        subject: 'You\'ve been unsubscribed',
        html: `<p>Hi ${c.first_name || 'there'},</p><p>You have been successfully unsubscribed from all email sequences. You won't receive any further marketing emails from us.</p><p>If this was a mistake, please contact our support team.</p>`,
      }).catch(e => console.error('Unsubscribe confirm email failed:', e.message));
    }
    res.send('<html><body style="font-family:Arial;text-align:center;padding:60px"><h2>Unsubscribed</h2><p style="color:#666">You have been successfully unsubscribed from all emails.</p></body></html>');
  } catch (e) { res.status(500).send('Error processing unsubscribe request'); }
});

app.post('/email/unsubscribe', async (req, res) => {
  const { contact_id, client_id } = req.body;
  if (!contact_id) return res.status(400).json({ error: 'contact_id required' });
  try {
    await supabase.from('contacts').update({ email_opted_out: true, status: 'unsubscribed' }).eq('id', contact_id);
    await supabase.from('workflow_enrollments').update({ status: 'cancelled' }).eq('contact_id', contact_id).eq('status', 'active');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── FIX 4: SLACK on onboarding/complete ──────────────────
// (Patched into existing endpoint — see /onboarding/complete handler above)
// Shopify webhook Slack alert added in processWebhookEvent below

// ─── FIX 8: SEQUENCE PERFORMANCE ALERTS — MONDAY 8AM ──────
cron.schedule('0 8 * * 1', async () => {
  console.log('[AUTO] Sequence performance alert scan starting...');
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: workflows } = await supabase.from('workflows').select('id, name, client_id').eq('status', 'active');
    if (!workflows || workflows.length === 0) return;
    for (const wf of workflows) {
      try {
        const [totalMsgRes, openedMsgRes, totalEnrollRes, completedEnrollRes] = await Promise.all([
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('channel', 'email').eq('direction', 'outbound').gte('created_at', sevenDaysAgo),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('channel', 'email').eq('direction', 'outbound').gte('created_at', sevenDaysAgo).not('opened_at', 'is', null),
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('workflow_id', wf.id),
          supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('workflow_id', wf.id).eq('status', 'completed'),
        ]);
        const totalMsg = totalMsgRes.count || 0;
        const openedMsg = openedMsgRes.count || 0;
        const totalEnroll = totalEnrollRes.count || 0;
        const completedEnroll = completedEnrollRes.count || 0;
        const openRate = totalMsg > 0 ? Math.round((openedMsg / totalMsg) * 100) : null;
        const completionRate = totalEnroll > 0 ? Math.round((completedEnroll / totalEnroll) * 100) : null;
        if (openRate !== null && openRate < 15) {
          await storeBriefing('mahdi', 'yousef',
            `Low Open Rate Alert — "${wf.name}" (${openRate}%)`,
            `Sequence "${wf.name}" has an open rate of ${openRate}% over the last 7 days (${openedMsg}/${totalMsg} emails opened). This is below the 15% threshold.\n\n3 Suggestions to improve:\n1. Rewrite subject lines — try curiosity-based or personal openers instead of promotional ones\n2. Test sending at a different time of day (try 9–11am or 6–8pm local time)\n3. Add the recipient's first name to the subject line using {{first_name}}\n\nConsider A/B testing two subject line styles on the next send.`,
            'high', wf.client_id
          );
          console.log(`[AUTO] Low open rate alert: ${wf.name} (${openRate}%)`);
        }
        if (completionRate !== null && completionRate < 10 && totalEnroll >= 5) {
          await storeBriefing('mahdi', 'yousef',
            `Low Completion Rate — "${wf.name}" needs rewrite (${completionRate}%)`,
            `Sequence "${wf.name}" has a ${completionRate}% completion rate (${completedEnroll}/${totalEnroll} enrolled). This is below the 10% threshold.\n\nRecommended action: Full sequence rewrite.\n\nCommon causes:\n1. Emails are too long — aim for under 120 words per email\n2. The offer isn't compelling enough in email 2 or 3\n3. The send timing is off — contacts are losing interest by step 3\n\nSuggest reviewing and rewriting the weakest performing steps first.`,
            'high', wf.client_id
          );
          console.log(`[AUTO] Low completion rate alert: ${wf.name} (${completionRate}%)`);
        }
      } catch (wfErr) { console.error(`[AUTO] Sequence alert failed for ${wf.name}:`, wfErr.message); }
    }
  } catch (e) { console.error('[AUTO] Sequence performance cron error:', e.message); }
});

// ─── FIX 8: FATIMA DELIVERABILITY MONITORING — DAILY 7AM ──
// SQL: ALTER TABLE team_briefings ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
// SQL: ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS content text;
cron.schedule('0 7 * * *', async () => {
  console.log('[AUTO] Fatima — deliverability monitoring starting...');
  if (!process.env.SENDGRID_API_KEY) return;
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const sgStatsRes = await axios.get('https://api.sendgrid.com/v3/stats', {
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
      params: { start_date: yesterday, end_date: yesterday, aggregated_by: 'day' }
    });
    const stats = sgStatsRes.data;
    if (!stats || stats.length === 0) return;
    const metrics = stats[0]?.stats?.[0]?.metrics || {};
    const requests = metrics.requests || 0;
    if (requests === 0) return;
    const bounceRate = ((metrics.bounces || 0) / requests * 100).toFixed(2);
    const spamRate = ((metrics.spam_reports || 0) / requests * 100).toFixed(3);
    const flags = [];
    if (parseFloat(bounceRate) > 5) flags.push(`Bounce rate: ${bounceRate}% (threshold: 5%)`);
    if (parseFloat(spamRate) > 0.1) flags.push(`Spam rate: ${spamRate}% (threshold: 0.1%)`);
    if (flags.length === 0) {
      console.log(`[AUTO] Fatima deliverability OK — bounce: ${bounceRate}%, spam: ${spamRate}%`);
      return;
    }
    await storeBriefing('fatima', 'yousef',
      `Deliverability Alert — ${new Date(yesterday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      `SendGrid deliverability thresholds exceeded for ${yesterday}.\n\n${flags.join('\n')}\n\nRequests: ${requests} | Bounces: ${metrics.bounces || 0} | Spam reports: ${metrics.spam_reports || 0}\n\nRequired actions:\n1. Review and remove invalid/stale addresses from your contact lists\n2. Check for spam trigger words in recent email subject lines and content\n3. Verify domain DKIM/DMARC alignment in SendGrid settings\n4. Pause any sequences sending to unverified contacts\n5. Run a list hygiene pass on all client contact lists`,
      'urgent'
    );
    console.log(`[AUTO] Fatima deliverability alert — bounce: ${bounceRate}%, spam: ${spamRate}%`);
  } catch (e) {
    console.error('[AUTO] Fatima deliverability error:', e.message);
  }
});

// ─── FIX 9: HUSSAIN COMPETITOR MONITORING — WEEKLY TUESDAY 6AM ──
cron.schedule('0 6 * * 2', async () => {
  console.log('[AUTO] Hussain — competitor monitoring starting...');
  try {
    const { data: competitorDocs } = await supabase
      .from('knowledge_base')
      .select('client_id, content, title')
      .or('content.ilike.%competitor%,content.ilike.%competition%,title.ilike.%competitor%')
      .eq('status', 'active');
    if (!competitorDocs || competitorDocs.length === 0) {
      console.log('[AUTO] Hussain competitor — no competitor docs found');
      return;
    }
    const byClient = {};
    for (const doc of competitorDocs) {
      if (!doc.client_id) continue;
      if (!byClient[doc.client_id]) byClient[doc.client_id] = [];
      byClient[doc.client_id].push(doc);
    }
    for (const [clientId, docs] of Object.entries(byClient)) {
      try {
        const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
        const clientName = client?.name || clientId;
        const competitorSnippet = docs.slice(0, 3).map(d => d.title || d.content.slice(0, 200)).join('\n---\n');
        const ragContext = await ragSearch(`competitor analysis positioning ${clientName}`, clientId);
        const analysis = await aiCall(
          `You are Hussain, Intelligence & Strategy AI for Sales Scales. You are a sharp, data-driven analyst with a founder mindset. Never break character.`,
          `Run a competitor analysis for client "${clientName}" based on this intelligence from their knowledge base:\n\n${competitorSnippet}\n\nKnowledge base context:\n${ragContext}\n\nProvide:\n1. Who their top 2–3 competitors are (inferred from context)\n2. Each competitor's positioning and weaknesses\n3. How ${clientName} can differentiate and win market share\n4. 3 immediate actions to outmanoeuvre the competition\n\nBe specific to their niche. Think like a strategic advisor.`
        );
        await supabase.from('approvals').insert([{
          type: 'competitor_report',
          title: `Weekly Competitor Analysis — ${clientName} — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
          content: analysis,
          metadata: { client_name: clientName, generated_by: 'hussain_auto' },
          from_member: 'hussain',
          client_id: clientId,
          priority: 'normal',
          status: 'pending',
          created_at: new Date().toISOString()
        }]);
        console.log(`[AUTO] Hussain competitor report submitted for ${clientName}`);
      } catch (clientErr) {
        console.error(`[AUTO] Hussain competitor error for ${clientId}:`, clientErr.message);
      }
    }
  } catch (e) {
    console.error('[AUTO] Hussain competitor cron error:', e.message);
  }
});

// ─── FIX 1: CHURN PREDICTION — WEEKLY WEDNESDAY 9AM ──────
// SQL: ALTER TABLE clients ADD COLUMN IF NOT EXISTS churn_risk text;
cron.schedule('0 9 * * 3', async () => {
  console.log('[AUTO] Churn prediction scan starting...');
  try {
    const now = new Date();
    const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();

    const { data: clients } = await supabase.from('clients').select('id, name, tier, health_score').eq('status', 'active');
    if (!clients || clients.length === 0) return;

    const highRisk = [];
    const mediumRisk = [];

    for (const client of clients) {
      const reasons = [];
      let risk = 'low';

      if ((client.health_score || 0) < 50) reasons.push(`Health score ${client.health_score || 0}/100 (below 50)`);

      const [enrollRes, approvedRes, loginRes] = await Promise.all([
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('enrolled_at', sevenDaysAgo),
        supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('client_id', client.id).eq('status', 'approved').gte('created_at', fourteenDaysAgo),
        supabase.from('client_users').select('last_login').eq('client_id', client.id).order('last_login', { ascending: false }).limit(1),
      ]);

      const lastLogin = loginRes.data?.[0]?.last_login;
      if (!lastLogin || new Date(lastLogin) < new Date(fourteenDaysAgo)) reasons.push(`No login in 14+ days (last: ${lastLogin ? new Date(lastLogin).toLocaleDateString() : 'never'})`);
      if ((enrollRes.count || 0) === 0) reasons.push('Zero sequence enrollments in last 7 days');
      if ((approvedRes.count || 0) === 0) reasons.push('No approved content in last 14 days');

      const highSignals = reasons.filter(r => r.includes('Health score') || r.includes('No login'));
      if (highSignals.length >= 1 && reasons.length >= 2) risk = 'high';
      else if (reasons.length >= 1) risk = 'medium';

      await supabase.from('clients').update({ churn_risk: risk }).eq('id', client.id);

      if (risk === 'high') highRisk.push({ name: client.name, tier: client.tier, reasons });
      else if (risk === 'medium') mediumRisk.push({ name: client.name, tier: client.tier, reasons });
    }

    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
      const rows = [...highRisk.map(c => `<tr><td style="padding:10px 14px;font-weight:700;color:#dc2626">${c.name}</td><td style="padding:10px 14px"><span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">HIGH</span></td><td style="padding:10px 14px;font-size:12px;color:#4a5568">${c.reasons.join('<br>')}</td></tr>`),
        ...mediumRisk.map(c => `<tr><td style="padding:10px 14px;font-weight:600;color:#d97706">${c.name}</td><td style="padding:10px 14px"><span style="background:#fffbeb;color:#d97706;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">MEDIUM</span></td><td style="padding:10px 14px;font-size:12px;color:#4a5568">${c.reasons.join('<br>')}</td></tr>`)].join('');

      await sgMail.send({
        to: 'yousef@aisalesscales.com',
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
        subject: `⚠️ Weekly Churn Report — ${highRisk.length} high risk client${highRisk.length !== 1 ? 's' : ''}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#f0f3f8;padding:24px">
          <div style="background:#0a1628;padding:20px 28px;border-radius:10px 10px 0 0">
            <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Sales Scales — Weekly Churn Report</div>
            <div style="color:white;font-size:16px;font-weight:600;margin-top:4px">${highRisk.length} high risk · ${mediumRisk.length} medium risk · ${clients.length - highRisk.length - mediumRisk.length} healthy</div>
          </div>
          <div style="background:white;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 10px 10px;padding:24px">
            ${highRisk.length === 0 && mediumRisk.length === 0 ? '<p style="color:#059669;font-weight:600">✓ All clients are healthy this week. No churn risk detected.</p>' : `
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:#0a1628"><th style="padding:10px 14px;text-align:left;color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase">Client</th><th style="padding:10px 14px;text-align:left;color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase">Risk</th><th style="padding:10px 14px;text-align:left;color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase">Reasons</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:20px;background:#f8fafc;border-radius:8px;padding:14px;font-size:12px;color:#4a5568">
              <strong>Recommended actions for HIGH risk clients:</strong><br>• Book a check-in call within 48 hours<br>• Send a personalised value recap email<br>• Have Zainab generate a results summary showing their ROI<br>• Offer a strategy session to re-engage them
            </div>`}
          </div>
        </div>`,
      });
    }
    console.log(`[AUTO] Churn report sent — ${highRisk.length} high, ${mediumRisk.length} medium`);
  } catch (e) {
    console.error('[AUTO] Churn prediction error:', e.message);
  }
});

// ─── FIX 3: CLIENT COMMUNICATION LOG ─────────────────────
// SQL: CREATE TABLE IF NOT EXISTS client_comms (id uuid default gen_random_uuid() primary key, client_id uuid, date date, type text, summary text, next_action text, created_by text default 'yousef', created_at timestamptz default now());
app.post('/client-comms/log', async (req, res) => {
  const { client_id, date, type, summary, next_action } = req.body;
  if (!client_id || !summary) return res.status(400).json({ error: 'client_id and summary required' });
  try {
    const { data, error } = await supabase.from('client_comms').insert([{
      client_id, date: date || new Date().toISOString().slice(0, 10),
      type: type || 'note', summary, next_action: next_action || null,
    }]).select().single();
    if (error) throw error;
    res.json({ comm: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/client-comms', async (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { data, error } = await supabase.from('client_comms').select('*').eq('client_id', client_id).order('date', { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ comms: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 4: AUTOMATED INVOICE EMAIL — 1ST OF MONTH 9AM ───
cron.schedule('0 9 1 * *', async () => {
  console.log('[AUTO] Monthly invoice email sending starting...');
  const TIER_PRICES_MAP = { starter: 199, growth: 299, elite: 399, scale: 399, Starter: 199, Growth: 299, Elite: 399, Scale: 399 };
  try {
    const { data: clients } = await supabase.from('clients').select('id, name, tier, status').eq('status', 'active');
    if (!clients || clients.length === 0) return;
    const period = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let sent = 0;
    for (const client of clients) {
      try {
        const { data: users } = await supabase.from('client_users').select('email, name').eq('client_id', client.id);
        if (!users || users.length === 0) continue;
        const amount = TIER_PRICES_MAP[client.tier] || 199;
        const invNum = `SS-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${client.id.slice(0,6).toUpperCase()}`;
        const { data: inv } = await supabase.from('invoices').insert([{
          invoice_number: invNum, client_id: client.id, client_name: client.name,
          plan: `${client.tier} Plan`, amount, due_date: new Date(Date.now() + 7*86400000).toISOString().slice(0,10),
          status: 'sent',
        }]).select().single();

        for (const u of users) {
          await sgMail.send({
            to: u.email,
            from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales Billing' },
            subject: `Your Sales Scales Invoice — ${period} ($${amount.toLocaleString()})`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f3f8;padding:24px">
              <div style="background:#0a1628;padding:24px 32px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
                <div style="color:#c9a84c;font-size:18px;font-weight:800;letter-spacing:2px">SALES SCALES</div>
                <div style="text-align:right"><div style="color:white;font-size:20px;font-weight:700">INVOICE</div><div style="color:#c9a84c;font-size:11px;font-family:monospace">${invNum}</div></div>
              </div>
              <div style="background:white;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 10px 10px;padding:28px">
                <div style="display:flex;justify-content:space-between;margin-bottom:24px;font-size:12px;color:#4a5568">
                  <div><strong>Bill To:</strong><br>${u.name}<br>${client.name}</div>
                  <div style="text-align:right"><strong>Invoice Date:</strong><br>${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}<br><strong>Due:</strong> ${new Date(Date.now()+7*86400000).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
                </div>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                  <thead><tr style="background:#0a1628"><th style="padding:10px 14px;text-align:left;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px">Description</th><th style="padding:10px 14px;text-align:right;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px">Amount</th></tr></thead>
                  <tbody><tr><td style="padding:16px 14px;font-size:13px;color:#0a1628">${client.tier} Plan — ${period}<br><span style="font-size:11px;color:#8896a8">AI revenue system: email, SMS, sequences, AI team</span></td><td style="padding:16px 14px;text-align:right;font-size:15px;font-weight:700;color:#c9a84c">$${amount.toLocaleString()}</td></tr></tbody>
                </table>
                <div style="font-size:11px;color:#8896a8;border-top:1px solid #e4e9f0;padding-top:16px">Questions? Reply to this email or contact billing@salesscales.com</div>
              </div>
            </div>`,
          });
          sent++;
        }
      } catch (clientErr) {
        console.error(`[AUTO] Invoice email failed for ${client.name}:`, clientErr.message);
      }
    }
    console.log(`[AUTO] Monthly invoices sent to ${sent} client users`);
  } catch (e) {
    console.error('[AUTO] Monthly invoice email error:', e.message);
  }
});

// ─── FIX 5: PLATFORM USAGE ANALYTICS ─────────────────────
app.get('/admin/usage', async (req, res) => {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  try {
    const { data: logs } = await supabase.from('request_logs').select('method, path, created_at, response_time_ms').gte('created_at', monthStart);
    const allLogs = logs || [];
    const totalCalls = allLogs.length;
    const byPath = {};
    let totalRespTime = 0;
    for (const l of allLogs) {
      const key = `${l.method} ${l.path}`;
      byPath[key] = (byPath[key] || 0) + 1;
      totalRespTime += l.response_time_ms || 0;
    }
    const topEndpoints = Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([endpoint, calls]) => ({ endpoint, calls }));
    const avgResponseMs = totalCalls > 0 ? Math.round(totalRespTime / totalCalls) : 0;
    res.json({ totalCalls, topEndpoints, avgResponseMs, monthStart });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 7: REFERRAL CREDIT SYSTEM ───────────────────────
// SQL: CREATE TABLE IF NOT EXISTS credits (id uuid default gen_random_uuid() primary key, client_id uuid, amount numeric, reason text, applied boolean DEFAULT false, created_at timestamptz default now());
app.post('/credits/issue', async (req, res) => {
  const { client_id, amount, reason } = req.body;
  if (!client_id || !amount) return res.status(400).json({ error: 'client_id and amount required' });
  try {
    const { data, error } = await supabase.from('credits').insert([{ client_id, amount, reason: reason || 'Manual credit', applied: false }]).select().single();
    if (error) throw error;
    res.json({ credit: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/credits', async (req, res) => {
  const { client_id } = req.query;
  try {
    let q = supabase.from('credits').select('*').order('created_at', { ascending: false });
    if (client_id) q = q.eq('client_id', client_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ credits: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Called when a referral is marked 'converted' — issues 1 month credit to referrer
app.post('/referrals/process-reward', async (req, res) => {
  const { referral_id } = req.body;
  if (!referral_id) return res.status(400).json({ error: 'referral_id required' });
  try {
    const { data: referral } = await supabase.from('referrals').select('*').eq('id', referral_id).maybeSingle();
    if (!referral) return res.status(404).json({ error: 'Referral not found' });
    const { data: referrerClient } = await supabase.from('client_users').select('client_id').eq('email', referral.referrer_email).maybeSingle();
    if (!referrerClient) return res.json({ ok: false, note: 'Referrer not a platform client — cannot auto-credit' });
    const { data: clientData } = await supabase.from('clients').select('tier').eq('id', referrerClient.client_id).maybeSingle();
    const TIER_P = { starter: 199, growth: 299, elite: 399, scale: 399, Starter: 199, Growth: 299, Elite: 399, Scale: 399 };
    const creditAmount = TIER_P[clientData?.tier] || 199;
    const { data: credit, error } = await supabase.from('credits').insert([{
      client_id: referrerClient.client_id, amount: creditAmount,
      reason: `Referral reward — ${referral.referred_business} converted`, applied: false,
    }]).select().single();
    if (error) throw error;
    await supabase.from('referrals').update({ status: 'converted' }).eq('id', referral_id);
    res.json({ ok: true, credit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 10: MOBILE APP FOUNDATION ───────────────────────
// SQL: CREATE TABLE IF NOT EXISTS device_tokens (id uuid default gen_random_uuid() primary key, client_id uuid, device_token text unique, platform text, created_at timestamptz default now());
app.get('/mobile/config', (req, res) => {
  res.json({
    api_base: process.env.REACT_APP_API_URL || 'https://api.aisalesscales.com',
    app_version: '1.0.0',
    min_app_version: '1.0.0',
    features: {
      dark_mode: true,
      push_notifications: true,
      arabic_support: true,
      referral_rewards: true,
      sequence_analytics: true,
    },
    support_email: 'yousef@aisalesscales.com',
  });
});

app.post('/mobile/register-device', async (req, res) => {
  const { client_id, device_token, platform } = req.body;
  if (!client_id || !device_token || !platform) return res.status(400).json({ error: 'client_id, device_token, and platform required' });
  try {
    await supabase.from('device_tokens').upsert([{ client_id, device_token, platform }], { onConflict: 'device_token' });
    res.json({ ok: true, registered: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 1: ZAPIER WEBHOOK INTEGRATION ───────────────────
// SQL: ALTER TABLE clients ADD COLUMN IF NOT EXISTS zapier_webhook_url text;
app.get('/zapier/events', (req, res) => {
  res.json({ events: [
    { type: 'new_contact', description: 'Fires when a new contact is added or synced from Shopify' },
    { type: 'sequence_completed', description: 'Fires when a contact finishes all steps in a sequence' },
    { type: 'purchase_made', description: 'Fires when an order is created via Shopify webhook' },
    { type: 'approval_created', description: 'Fires when the AI team creates a new approval item' },
  ]});
});

app.post('/zapier/trigger', async (req, res) => {
  const { event_type, data, client_id } = req.body;
  if (!event_type || !data) return res.status(400).json({ error: 'event_type and data required' });
  try {
    const { data: client } = await supabase.from('clients').select('zapier_webhook_url, name').eq('id', client_id).maybeSingle();
    const webhookUrl = client?.zapier_webhook_url;
    if (!webhookUrl) return res.status(400).json({ error: 'No Zapier webhook URL configured for this client. Add it in Settings → Integrations.' });
    const response = await axios.post(webhookUrl, {
      event_type, data, client_id, client_name: client?.name, timestamp: new Date().toISOString(),
    }, { timeout: 10000 });
    res.json({ ok: true, status: response.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/clients/:id/zapier-url', async (req, res) => {
  const { zapier_webhook_url } = req.body;
  try {
    const { data, error } = await supabase.from('clients').update({ zapier_webhook_url: zapier_webhook_url || null }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ ok: true, client: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 5: SEQUENCE DUPLICATION ─────────────────────────
app.post('/workflows/duplicate', verifyToken, async (req, res) => {
  if (!verifyClientOwnership(req)) return res.status(403).json({ error: 'Forbidden' });
  const { workflow_id, client_id } = req.body;
  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });
  try {
    const { data: original } = await supabase.from('workflows').select('*').eq('id', workflow_id).single();
    if (!original) return res.status(404).json({ error: 'Workflow not found' });
    const { data: newWf, error } = await supabase.from('workflows').insert([{
      name: `${original.name} (Copy)`,
      client_id: client_id || original.client_id,
      trigger_type: original.trigger_type,
      status: 'draft',
    }]).select().single();
    if (error) throw error;
    const { data: steps } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflow_id).order('step_order');
    if (steps && steps.length > 0) {
      const newSteps = steps.map(({ id, workflow_id: _wid, ...rest }) => ({ ...rest, workflow_id: newWf.id }));
      await supabase.from('workflow_steps').insert(newSteps);
    }
    res.json({ workflow: newWf, steps_copied: steps?.length || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 6: CONTACT BLACKLIST ─────────────────────────────
// SQL: CREATE TABLE IF NOT EXISTS contact_blacklist (id uuid default gen_random_uuid() primary key, email text not null, client_id uuid, reason text, created_at timestamptz default now(), UNIQUE(email, client_id));
app.post('/contacts/blacklist', verifyToken, async (req, res) => {
  if (!verifyClientOwnership(req)) return res.status(403).json({ error: 'Forbidden' });
  const { email, client_id, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const { data, error } = await supabase.from('contact_blacklist').upsert([{
      email: email.toLowerCase().trim(), client_id: client_id || null, reason: reason || null,
    }], { onConflict: 'email,client_id' }).select().single();
    if (error) throw error;
    res.json({ blacklisted: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/contacts/blacklist', async (req, res) => {
  const { client_id } = req.query;
  try {
    let q = supabase.from('contact_blacklist').select('*').order('created_at', { ascending: false });
    if (client_id) q = q.or(`client_id.eq.${client_id},client_id.is.null`);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ blacklist: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/contacts/blacklist/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('contact_blacklist').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 7: SEQUENCE SCHEDULE START ──────────────────────
app.patch('/workflows/:id/schedule', async (req, res) => {
  const { scheduled_start } = req.body;
  if (!scheduled_start) return res.status(400).json({ error: 'scheduled_start required (ISO date string)' });
  try {
    const ts = new Date(scheduled_start);
    if (isNaN(ts)) return res.status(400).json({ error: 'Invalid date format' });
    const status = ts > new Date() ? 'scheduled' : 'active';
    const { data, error } = await supabase.from('workflows').update({ scheduled_start: ts.toISOString(), status }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ workflow: data, status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 8: CLIENT TIER MANAGEMENT ───────────────────────
app.put('/clients/:id/tier', async (req, res) => {
  const { tier } = req.body;
  const valid = ['starter', 'growth', 'elite'];
  if (!tier || !valid.includes(tier.toLowerCase())) return res.status(400).json({ error: 'tier must be starter, growth, or elite' });
  const tierFormatted = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const TIER_PRICES = { Starter: 199, Growth: 299, Elite: 399, Scale: 399 };
  try {
    const { data: client, error } = await supabase.from('clients').update({ tier: tierFormatted }).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
      const { data: users } = await supabase.from('client_users').select('email, name').eq('client_id', req.params.id);
      for (const u of (users || [])) {
        sgMail.send({
          to: u.email,
          from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
          subject: `Your plan has been updated to ${tierFormatted}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;background:#f0f3f8;padding:24px">
            <div style="background:#0a1628;padding:22px 28px;border-radius:10px 10px 0 0">
              <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Sales Scales</div>
            </div>
            <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 10px 10px;padding:28px">
              <p style="font-size:16px;font-weight:700;color:#0a1628;margin:0 0 12px">Hi ${u.name?.split(' ')[0] || 'there'}, your plan has been updated</p>
              <p style="color:#4a5568;line-height:1.7;margin:0 0 20px">Your Sales Scales plan for <strong>${client.name}</strong> has been updated to the <strong>${tierFormatted} Plan</strong> at <strong>$${TIER_PRICES[tierFormatted].toLocaleString()}/month</strong>.</p>
              <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px;border-left:3px solid #c9a84c">
                <div style="font-size:13px;font-weight:700;color:#0a1628">${tierFormatted} Plan</div>
                <div style="font-size:13px;color:#c9a84c;font-weight:700">$${TIER_PRICES[tierFormatted].toLocaleString()}/month</div>
              </div>
              <p style="color:#4a5568;margin:0">Questions? Reply to this email and we'll help immediately.</p>
            </div>
          </div>`,
        }).catch(e => console.error('Tier change email failed:', e.message));
      }
    }
    res.json({ client });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 9: BULK EMAIL BROADCAST ─────────────────────────
app.post('/email/broadcast', async (req, res) => {
  const { client_id, subject, content, tag } = req.body;
  if (!client_id || !subject || !content) return res.status(400).json({ error: 'client_id, subject, and content required' });
  try {
    let query = supabase.from('contacts').select('id, email, first_name, last_name, tags').eq('client_id', client_id).not('email', 'is', null);
    const { data: contacts } = await query;
    if (!contacts || contacts.length === 0) return res.json({ sent: 0, skipped: 0, total: 0 });
    const filtered = tag ? contacts.filter(c => Array.isArray(c.tags) && c.tags.includes(tag)) : contacts;
    const sender = await getClientSender(client_id);
    let sent = 0;
    for (const contact of filtered) {
      if (!contact.email) continue;
      try {
        const personalised = content.replace(/{{first_name}}/g, contact.first_name || 'there');
        await sgMail.send({
          to: contact.email, from: sender, subject,
          html: buildEmailHtml({ content: personalised, subject, clientName: sender.name, contactName: contact.first_name, contactId: contact.id, clientId: client_id }),
        });
        await supabase.from('messages').insert([{
          client_id, contact_id: contact.id, channel: 'email', direction: 'outbound',
          sender_name: sender.name, content: content.slice(0, 250), status: 'sent',
        }]);
        sent++;
      } catch (err) { console.error(`Broadcast failed for ${contact.email}:`, err.message); }
    }
    res.json({ sent, skipped: filtered.length - sent, total: filtered.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ROUTE MODULES ────────────────────────────────────────
app.use('/auth',    require('./routes/auth')({ supabase, jwt, bcrypt, JWT_SECRET, verifyToken, sgMail }));
app.use('/',        require('./routes/ai-team')({ aiCall, ragSearch, getBriefingsContext, getShopifyContext, getClientProfile, getKlaviyoContext, verifyToken, aiLimiter }));
app.use('/shopify', require('./routes/shopify')({ supabase, axios, crypto, processWebhookEvent, aiCall, generateAllClientSequences }));

// ─── POST /mahdi/generate-sequences ──────────────────────
app.post('/mahdi/generate-sequences', async (req, res) => {
  const { client_id } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { data: conn } = await supabase.from('shopify_connections')
      .select('shop, access_token').eq('client_id', client_id).maybeSingle();
    if (!conn) return res.status(404).json({ error: 'No Shopify store connected for this client' });
    res.json({ ok: true, message: 'Sequence generation started — check Approvals in ~60 seconds', shop: conn.shop });
    console.log(`[mahdi/generate-sequences] Triggered for client ${client_id} — ${conn.shop}`);
    generateAllClientSequences(conn.shop, conn.access_token, client_id)
      .catch(e => console.error('[mahdi/generate-sequences] Background generation failed:', e.message));
  } catch (e) {
    console.error('/mahdi/generate-sequences error:', e.message);
    res.status(500).json({ error: e.message });
  }
});
app.use('/',        require('./routes/knowledge')({ supabase, axios, importLimiter, upload, PDF2Json, YoutubeTranscript }));
app.use('/',        require('./routes/analytics')({ supabase, aiCall }));
app.use('/',        require('./routes/integrations')({ supabase, axios, aiCall, ragSearch, getBriefingsContext, verifyToken }));
app.use('/',        require('./routes/operations')({ supabase, aiCall, ragSearch, getBriefingsContext, verifyToken, storeKnowledge, notifyClientUser, sgMail }));
app.use('/',        require('./routes/notifications')({ supabase }));
app.use('/billing', require('./routes/billing')({ supabase, axios, sgMail, storeBriefing }));

// ─── ERROR MONITORING ─────────────────────────────────────
// SQL to create errors table in Supabase:
// create table errors (
//   id uuid default gen_random_uuid() primary key,
//   message text not null,
//   stack text,
//   endpoint text,
//   created_at timestamptz default now()
// );
const logError = async (err, endpoint = 'unknown') => {
  const ts = new Date().toISOString();
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack || '') : '';

  try {
    await supabase.from('errors').insert([{ message: msg, stack, endpoint, created_at: ts }]);
  } catch (dbErr) {
    console.error('Failed to log error to DB:', dbErr.message);
  }

  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    try {
      await sgMail.send({
        to: 'yousef@aisalesscales.com',
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales Errors' },
        subject: `Server Error — ${endpoint} — ${new Date(ts).toLocaleString()}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px"><div style="background:#dc2626;padding:16px 24px;border-radius:8px 8px 0 0"><div style="color:white;font-size:14px;font-weight:700">Server Error Detected</div></div><div style="background:#fff;border:1px solid #fecaca;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px"><p style="font-size:12px;color:#8896a8;margin:0 0 4px">Timestamp: ${ts}</p><p style="font-size:12px;color:#8896a8;margin:0 0 16px">Endpoint: ${endpoint}</p><div style="font-size:13px;font-weight:600;color:#dc2626;margin-bottom:14px">${msg}</div><pre style="font-size:11px;color:#4a5568;background:#f9fafb;border:1px solid #e4e9f0;padding:12px;border-radius:6px;overflow-x:auto;white-space:pre-wrap;margin:0">${stack.slice(0, 2000)}</pre></div></div>`,
      });
    } catch (mailErr) {
      console.error('Error notification email failed:', mailErr.message);
    }
  }
};

// ─── FIX 5: PLATFORM HEALTH DETAILED ─────────────────────
app.get('/health/detailed', async (req, res) => {
  const checks = {};
  const t = async (name, fn) => {
    const start = Date.now();
    try { await fn(); checks[name] = { ok: true, ms: Date.now() - start }; }
    catch (e) { checks[name] = { ok: false, ms: Date.now() - start, error: e.message }; }
  };
  await Promise.all([
    t('supabase', async () => { const { error } = await supabase.from('clients').select('id').limit(1); if (error) throw error; }),
    t('sendgrid', async () => {
      const r = await axios.get('https://api.sendgrid.com/v3/scopes', { headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` } });
      if (r.status !== 200) throw new Error('SendGrid status ' + r.status);
    }),
    t('twilio', async () => {
      if (!process.env.TWILIO_ACCOUNT_SID) throw new Error('Not configured');
      const r = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, {
        auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN }
      });
      if (r.status !== 200) throw new Error('Twilio status ' + r.status);
    }),
    t('elevenlabs', async () => {
      if (!process.env.ELEVENLABS_API_KEY) throw new Error('Not configured');
      const r = await axios.get('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
      if (r.status !== 200) throw new Error('ElevenLabs status ' + r.status);
    }),
  ]);
  checks.server = { ok: true, uptime: Math.floor(process.uptime()), ms: 0 };
  const allOk = Object.values(checks).every(c => c.ok);
  res.json({ ok: allOk, checks, timestamp: new Date().toISOString() });
});

// ─── FIX 6: CLIENT SUCCESS SCORES ────────────────────────
const TIER_PRICE = { starter: 199, growth: 299, scale: 399, elite: 399, enterprise: 399 };
app.get('/clients/success-scores', async (req, res) => {
  try {
    const { data: clients } = await supabase.from('clients').select('id, name, tier, health_score, created_at, status');
    if (!clients) return res.json({ clients: [] });
    const now = new Date();
    const scores = await Promise.all(clients.map(async (c) => {
      const monthsActive = Math.max(1, Math.round((now - new Date(c.created_at)) / (30 * 24 * 3600 * 1000)));
      const monthlyFee = TIER_PRICE[c.tier?.toLowerCase()] || 199;
      const totalPaid = monthlyFee * monthsActive;

      const [enrollRes, contactRes, prevContactRes] = await Promise.all([
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', c.id).eq('status', 'completed'),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', c.id)
          .lt('created_at', new Date(now - 30 * 24 * 3600 * 1000).toISOString()),
      ]);
      const completedEnrollments = enrollRes.count || 0;
      const totalContacts = contactRes.count || 0;
      const prevContacts = prevContactRes.count || 0;
      const contactGrowthRate = prevContacts > 0 ? Math.round(((totalContacts - prevContacts) / prevContacts) * 100) : 0;

      const totalRevenue = completedEnrollments * 75;
      const roi = totalPaid > 0 ? Math.round((totalRevenue / totalPaid) * 100) / 100 : 0;

      const totalEnrollRes = await supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', c.id);
      const totalEnrollments = totalEnrollRes.count || 0;
      const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

      return { ...c, roi, completionRate, contactGrowthRate, totalContacts, completedEnrollments, totalPaid, estimatedRevenue: totalRevenue };
    }));
    scores.sort((a, b) => b.roi - a.roi);
    res.json({ clients: scores });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 3: A/B TEST WINNER AUTO-SELECT (Fridays 8am) ────
cron.schedule('0 8 * * 5', async () => {
  console.log('[AUTO] A/B test winner selection starting...');
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: workflows } = await supabase.from('workflows')
      .select('id, name, client_id, metadata').not('metadata->ab_test_group', 'is', null);
    if (!workflows || workflows.length === 0) return;

    const groups = {};
    for (const wf of workflows) {
      const group = wf.metadata?.ab_test_group;
      if (!['A', 'B'].includes(group)) continue;
      const pairId = wf.metadata?.ab_pair_id || wf.name.replace(/ \([AB]\)$/, '');
      if (!groups[pairId]) groups[pairId] = {};
      groups[pairId][group] = wf;
    }

    for (const [pairId, pair] of Object.entries(groups)) {
      if (!pair.A || !pair.B) continue;
      if (pair.A.metadata?.ab_winner_selected || pair.B.metadata?.ab_winner_selected) continue;

      const getOpenRate = async (wfId) => {
        const { count: sent } = await supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('workflow_id', wfId).eq('channel', 'email').eq('direction', 'outbound').gte('created_at', sevenDaysAgo);
        const { count: opened } = await supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('workflow_id', wfId).eq('channel', 'email').eq('direction', 'outbound').not('opened_at', 'is', null).gte('created_at', sevenDaysAgo);
        return sent > 0 ? (opened || 0) / sent : 0;
      };

      const [rateA, rateB] = await Promise.all([getOpenRate(pair.A.id), getOpenRate(pair.B.id)]);
      if (rateA === 0 && rateB === 0) continue;

      const winner = rateA >= rateB ? pair.A : pair.B;
      const loser = rateA >= rateB ? pair.B : pair.A;

      await Promise.all([
        supabase.from('workflows').update({ metadata: { ...winner.metadata, ab_winner_selected: true, ab_winner: true } }).eq('id', winner.id),
        supabase.from('workflows').update({ status: 'paused', metadata: { ...loser.metadata, ab_winner_selected: true, ab_winner: false } }).eq('id', loser.id),
      ]);

      const pct = (r) => `${Math.round(r * 100)}%`;
      await storeBriefing('hussain', 'yousef',
        `A/B Test Winner Selected — ${winner.name}`,
        `A/B test results after 7 days for pair "${pairId}":\n\nVariant A (${pair.A.name}): ${pct(rateA)} open rate\nVariant B (${pair.B.name}): ${pct(rateB)} open rate\n\nWinner: ${winner.name} (${pct(Math.max(rateA, rateB))} open rate)\nLoser: ${loser.name} has been paused.\n\nThe winning variant continues running.`,
        'normal', winner.client_id
      ).catch(e => console.error('A/B briefing failed:', e.message));
      console.log(`[AUTO] A/B winner selected: ${winner.name} over ${loser.name}`);
    }
  } catch (e) {
    console.error('[AUTO] A/B test selection error:', e.message);
  }
});

// ─── FIX 7: AUTOMATED TESTIMONIAL REQUEST (daily 10am) ───
// SQL: CREATE TABLE IF NOT EXISTS testimonial_requests (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, client_id uuid, sent_at timestamptz DEFAULT now(), responded boolean DEFAULT false);
cron.schedule('0 10 * * *', async () => {
  console.log('[AUTO] Testimonial request scan starting...');
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const windowStart = new Date(thirtyDaysAgo.setHours(0, 0, 0, 0)).toISOString();
    const windowEnd = new Date(thirtyDaysAgo.setHours(23, 59, 59, 999)).toISOString();

    const { data: clients } = await supabase.from('clients')
      .select('id, name, from_email, from_name, health_score')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .gt('health_score', 70);

    if (!clients || clients.length === 0) return;

    for (const c of clients) {
      const { count: existing } = await supabase.from('testimonial_requests')
        .select('id', { count: 'exact', head: true }).eq('client_id', c.id);
      if (existing && existing > 0) continue;

      const { data: clientUsers } = await supabase.from('client_users').select('email, name').eq('client_id', c.id);
      const recipients = (clientUsers || []).map(u => u.email).filter(Boolean);
      if (recipients.length === 0) continue;

      const contactName = clientUsers?.[0]?.name || c.name || 'there';
      for (const email of recipients) {
        await sgMail.send({
          to: email,
          from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
          subject: 'How has Sales Scales been working for you?',
          text: `Hi ${contactName},\n\nIt's been 30 days since you joined Sales Scales, and we'd love to hear how things are going.\n\nIf the platform has been delivering value for you, we'd really appreciate a short testimonial — it helps other agency owners understand what's possible.\n\nJust reply to this email with a few sentences about your experience and we'll take care of the rest.\n\nThank you,\nYousef\nSales Scales`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0a1628"><p>Hi ${contactName},</p><p>It's been 30 days since you joined Sales Scales, and we'd love to hear how things are going.</p><p>If the platform has been delivering value for you, we'd really appreciate a short testimonial — it helps other agency owners understand what's possible.</p><p>Just reply to this email with a few sentences about your experience and we'll take care of the rest.</p><p>Thank you,<br>Yousef<br><strong>Sales Scales</strong></p></div>`,
        }).catch(e => console.error(`Testimonial email to ${email} failed:`, e.message));
      }

      await supabase.from('testimonial_requests').insert([{ client_id: c.id, sent_at: new Date().toISOString(), responded: false }]);
      console.log(`[AUTO] Testimonial request sent for ${c.name}`);
    }
  } catch (e) {
    console.error('[AUTO] Testimonial request error:', e.message);
  }
});

// ─── FIX 8: ROADMAP VOTES ENDPOINT ───────────────────────
// SQL: CREATE TABLE IF NOT EXISTS roadmap_votes (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, feature_id text NOT NULL, ip_address text NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(feature_id, ip_address));
app.post('/roadmap/vote', async (req, res) => {
  const { feature_id } = req.body;
  if (!feature_id) return res.status(400).json({ error: 'feature_id required' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  try {
    const { error } = await supabase.from('roadmap_votes').insert([{ feature_id, ip_address: ip }]);
    if (error && error.code === '23505') return res.status(409).json({ error: 'Already voted' });
    if (error) throw error;
    const { count } = await supabase.from('roadmap_votes').select('id', { count: 'exact', head: true }).eq('feature_id', feature_id);
    res.json({ ok: true, votes: count || 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/roadmap/votes', async (req, res) => {
  try {
    const { data } = await supabase.from('roadmap_votes').select('feature_id');
    const counts = {};
    for (const row of data || []) counts[row.feature_id] = (counts[row.feature_id] || 0) + 1;
    res.json({ votes: counts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 1: HUMAN TAKEOVER — CONTACTS ENDPOINT ───────────
// SQL: ALTER TABLE contacts ADD COLUMN IF NOT EXISTS human_takeover boolean DEFAULT false;
app.patch('/contacts/:id/takeover', async (req, res) => {
  const { id } = req.params;
  const { human_takeover } = req.body;
  if (typeof human_takeover !== 'boolean') return res.status(400).json({ error: 'human_takeover must be boolean' });
  try {
    const { data, error } = await supabase.from('contacts').update({ human_takeover }).eq('id', id).select().single();
    if (error) throw error;
    res.json({ ok: true, contact: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 2: SHOPIFY REFUND ────────────────────────────────
app.post('/shopify/refund', async (req, res) => {
  const { client_id, contact_id, contact_email } = req.body;
  if (!client_id || !contact_email) return res.status(400).json({ error: 'client_id and contact_email required' });
  try {
    const { data: conn } = await supabase.from('shopify_connections').select('shop, access_token').eq('client_id', client_id).maybeSingle();
    if (!conn) return res.status(400).json({ error: 'No Shopify store connected for this client' });

    const { shop, access_token } = conn;
    const headers = { 'X-Shopify-Access-Token': access_token, 'Content-Type': 'application/json' };

    const ordersRes = await axios.get(
      `https://${shop}/admin/api/2024-01/orders.json?email=${encodeURIComponent(contact_email)}&status=any&limit=1&order=created_at+desc`,
      { headers }
    );
    const order = ordersRes.data?.orders?.[0];
    if (!order) return res.status(404).json({ error: 'No orders found for this contact' });

    const lineItems = order.line_items.map(li => ({
      line_item_id: li.id, quantity: li.quantity,
      restock_type: 'return',
    }));
    const refundCalcRes = await axios.post(
      `https://${shop}/admin/api/2024-01/orders/${order.id}/refunds/calculate.json`,
      { refund: { shipping: { full_refund: true }, refund_line_items: lineItems } },
      { headers }
    );
    const transactions = refundCalcRes.data?.refund?.transactions?.map(t => ({
      parent_id: t.parent_id, amount: t.amount, kind: 'refund', gateway: t.gateway,
    })) || [];

    await axios.post(
      `https://${shop}/admin/api/2024-01/orders/${order.id}/refunds.json`,
      { refund: { notify: true, shipping: { full_refund: true }, refund_line_items: lineItems, transactions } },
      { headers }
    );

    const sender = await getClientSender(client_id);
    await sgMail.send({
      to: contact_email,
      from: { email: sender.email, name: sender.name },
      subject: 'Your refund has been processed',
      html: `<p>Hi,</p><p>Your refund for order <strong>#${order.order_number}</strong> of <strong>$${order.total_price}</strong> has been processed. It will appear on your original payment method within 5–10 business days.</p><p>Thank you for your patience.</p>`,
    });

    if (contact_id) {
      await supabase.from('messages').insert([{
        client_id, contact_id, channel: 'Refund', direction: 'outbound',
        sender_name: 'Sales Scales', content: `Refund issued for order #${order.order_number} — $${order.total_price}`,
        status: 'sent', created_at: new Date().toISOString(),
      }]);
    }

    res.json({ ok: true, order_number: order.order_number, amount: order.total_price });
  } catch (e) {
    console.error('/shopify/refund error:', e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data?.errors || e.message });
  }
});

// ─── FIX 3: FLASH SALE SEQUENCE ──────────────────────────
app.post('/workflows/flash-sale', async (req, res) => {
  const { client_id, offer_percentage, offer_end_date } = req.body;
  if (!client_id || !offer_percentage || !offer_end_date) return res.status(400).json({ error: 'client_id, offer_percentage, and offer_end_date required' });
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: contacts } = await supabase.from('contacts').select('id, email, first_name')
      .eq('client_id', client_id).not('email', 'is', null)
      .or(`last_activity.lt.${thirtyDaysAgo},last_activity.is.null`);
    const eligibleCount = (contacts || []).length;

    const { data: client } = await supabase.from('clients').select('name, niche').eq('id', client_id).maybeSingle();
    const ctx = await ragSearch(`flash sale ${offer_percentage}% off`, client_id).catch(() => '');

    const seqRaw = await aiCall(
      `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown. Write urgent, time-limited copy — short sentences, real urgency, no exclamation marks. Never mention Claude.`,
      `Write a 3-email flash sale sequence for ${client?.name || 'the store'} (${client?.niche || 'ecommerce'}). Offer: ${offer_percentage}% off. Sale ends: ${offer_end_date}. Target: customers who haven't purchased in 30+ days.\n\nEmail 1 (immediate): Announce the sale — urgency, clear offer, deadline\nEmail 2 (24h later): "Sale ends soon" — strongest products, social proof\nEmail 3 (48h later): Final hours warning\n\nReturn JSON: {"trigger_type":"flash_sale","steps":[{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":24},{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":24},{"step_type":"email","subject":"...","content":"...","wait_hours":0}]}`,
      ctx
    );
    let parsed = { steps: [], trigger_type: 'flash_sale' };
    try { const s = seqRaw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim(); const m = s.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : s); } catch {}

    const steps = Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps : [];
    const emailSteps = steps.filter(s => s.step_type === 'email').length;

    await supabase.from('approvals').insert([{
      type: 'email_sequence', from_member: 'mahdi', client_id,
      title: `Flash Sale ${offer_percentage}% Off — ends ${offer_end_date}`,
      content: `Mahdi generated a ${emailSteps}-email flash sale sequence targeting ${eligibleCount} contacts who haven't purchased in 30+ days.`,
      metadata: { steps, trigger_type: 'flash_sale', offer_percentage, offer_end_date, eligible_contacts: eligibleCount },
      priority: 'high', status: 'pending', created_at: new Date().toISOString(),
    }]);

    res.json({ ok: true, eligible_contacts: eligibleCount, steps: emailSteps, message: 'Flash sale sequence submitted for approval' });
  } catch (e) {
    console.error('/workflows/flash-sale error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 4: BACK IN STOCK NOTIFICATION ───────────────────
app.post('/shopify/back-in-stock', async (req, res) => {
  const { client_id, product_title } = req.body;
  if (!client_id || !product_title) return res.status(400).json({ error: 'client_id and product_title required' });
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const { data: enrollments } = await supabase.from('workflow_enrollments')
      .select('contact_id').eq('client_id', client_id).gte('enrolled_at', sixtyDaysAgo);
    const contactIds = [...new Set((enrollments || []).map(e => e.contact_id))];

    let eligibleContacts = [];
    if (contactIds.length > 0) {
      const { data: cts } = await supabase.from('contacts').select('id, email, first_name')
        .in('id', contactIds).not('email', 'is', null);
      eligibleContacts = cts || [];
    }

    const { data: client } = await supabase.from('clients').select('name, niche').eq('id', client_id).maybeSingle();
    const ctx = await ragSearch(`back in stock ${product_title}`, client_id).catch(() => '');

    const emailRaw = await aiCall(
      `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown. Write warmly and directly — no exclamation marks, no hype. Never mention Claude.`,
      `Write a back-in-stock notification email for "${product_title}" at ${client?.name || 'the store'} (${client?.niche || 'ecommerce'}). Recipients browsed or were active within 60 days. Write a single warm email announcing the product is available again, what makes it worth buying, and a clear CTA. Return JSON: {"subject":"...","content":"..."}`,
      ctx
    );
    let parsed = { subject: `${product_title} is back in stock`, content: '' };
    try { const s = emailRaw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim(); const m = s.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : s); } catch {}

    await supabase.from('approvals').insert([{
      type: 'email_sequence', from_member: 'mahdi', client_id,
      title: `Back in Stock — ${product_title}`,
      content: parsed.content || '',
      metadata: { subject: parsed.subject, product_title, eligible_contacts: eligibleContacts.length, steps: [{ step_type: 'email', subject: parsed.subject, content: parsed.content || '', wait_hours: 0 }] },
      priority: 'normal', status: 'pending', created_at: new Date().toISOString(),
    }]);

    res.json({ ok: true, eligible_contacts: eligibleContacts.length, message: 'Back in stock notification submitted for approval' });
  } catch (e) {
    console.error('/shopify/back-in-stock error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 5: CROSS-SELL SEQUENCE (day-14 post-purchase) ────
// Called by the scheduler when current_step hits the cross-sell threshold in a post_purchase workflow
const generateCrossSellApproval = async (enrollment, contact, client) => {
  try {
    const [ctx, shopifyCtx] = await Promise.all([
      ragSearch(`cross sell products ${client.name}`, client.id).catch(() => ''),
      getShopifyContext(client.id).catch(() => ''),
    ]);
    const combinedCtx = [ctx, shopifyCtx].filter(Boolean).join('\n\n');

    const emailRaw = await aiCall(
      `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown. Write like a thoughtful friend at the brand — no exclamation marks, no hype. Never mention Claude.`,
      `Write a cross-sell email for a customer of ${client.name} who completed a purchase 14 days ago. Suggest complementary products based on what's available. Email should feel personal, reference their recent purchase, and naturally introduce 2–3 related products they'd likely love. Return JSON: {"subject":"...","content":"..."}`,
      combinedCtx
    );
    let parsed = { subject: 'You might also like these', content: '' };
    try { const s = emailRaw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim(); const m = s.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : s); } catch {}

    await supabase.from('approvals').insert([{
      type: 'email_sequence', from_member: 'mahdi', client_id: client.id,
      title: `Cross-sell — ${contact.first_name || contact.email} (day 14)`,
      content: parsed.content || '',
      metadata: { subject: parsed.subject, contact_id: contact.id, enrollment_id: enrollment.id, steps: [{ step_type: 'email', subject: parsed.subject, content: parsed.content || '', wait_hours: 0 }] },
      priority: 'normal', status: 'pending', created_at: new Date().toISOString(),
    }]);
    console.log(`[cross-sell] Approval submitted for ${contact.first_name} (enrollment ${enrollment.id})`);
  } catch (e) {
    console.error('[cross-sell] Error:', e.message);
  }
};

// ─── FIX 6: FB/IG DM NURTURE SEQUENCE ────────────────────
const generateSocialNurtureApproval = async (platform, senderId, clientId) => {
  try {
    const platformLabel = platform === 'instagram' ? 'Instagram' : 'Facebook';
    const ctx = clientId ? await ragSearch(`social media DM welcome ${platformLabel}`, clientId).catch(() => '') : '';

    const seqRaw = await aiCall(
      `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown. Write DMs that feel personal and genuine — no exclamation marks, no spam language. Never mention Claude.`,
      `Write a 3-message DM nurture sequence for a new ${platformLabel} follower who just messaged us.\n\nMessage 1 (immediate welcome): Warm greeting, 1–2 sentences, acknowledge they reached out, hint at what we offer\nMessage 2 (day 3): Recommend our bestseller or top product — 2 sentences, natural tone\nMessage 3 (day 7): Special offer or next step — 2–3 sentences, soft CTA, not pushy\n\nReturn JSON: {"steps":[{"step_type":"dm","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":72},{"step_type":"dm","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":96},{"step_type":"dm","content":"...","wait_hours":0}]}`,
      ctx
    );
    let parsed = { steps: [] };
    try { const s = seqRaw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim(); const m = s.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : s); } catch {}

    const steps = Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps : [];

    await supabase.from('approvals').insert([{
      type: 'dm_sequence', from_member: 'mahdi', client_id: clientId || null,
      title: `${platformLabel} DM Nurture — new contact ${senderId}`,
      content: `Mahdi generated a 3-message ${platformLabel} DM nurture sequence for a new contact.`,
      metadata: { steps, platform, sender_id: senderId, trigger: 'new_dm_contact' },
      priority: 'normal', status: 'pending', created_at: new Date().toISOString(),
    }]);
    console.log(`[social-nurture] Approval submitted for new ${platformLabel} contact ${senderId}`);
  } catch (e) {
    console.error('[social-nurture] Error:', e.message);
  }
};

// ─── WORKFLOW GENERATE (Mahdi auto-creates full sequence) ─
const WORKFLOW_TYPE_PROMPTS = {
  'Cart Recovery':       { trigger: 'Cart Abandoned',     desc: 'abandoned their cart without checking out' },
  'Lead Nurture':        { trigger: 'New Customer',        desc: 'just signed up or opted in' },
  'Win Back':            { trigger: 'Win-Back',            desc: "haven't purchased in 90+ days" },
  'Post Purchase':       { trigger: 'Order Placed',        desc: 'just completed a purchase' },
  'Browse Abandonment':  { trigger: 'Browse Abandonment',  desc: "browsed a product but didn't add to cart" },
  'VIP Customer':        { trigger: 'Manual',              desc: 'are high-value repeat buyers' },
  'Re-engagement':       { trigger: 'Win-Back',            desc: "haven't opened an email in 60+ days" },
  'Flash Sale':          { trigger: 'Manual',              desc: 'are being targeted with a time-limited offer' },
  'Back in Stock':       { trigger: 'Back In Stock',       desc: 'previously viewed an out-of-stock product' },
  'Cross-sell':          { trigger: 'Post Purchase',       desc: 'recently purchased and may want related products' },
};

app.post('/workflows/generate', async (req, res) => {
  const { client_id, workflow_type } = req.body;
  if (!client_id || !workflow_type) return res.status(400).json({ error: 'client_id and workflow_type required' });
  const typeConfig = WORKFLOW_TYPE_PROMPTS[workflow_type];
  if (!typeConfig) return res.status(400).json({ error: `Unknown workflow_type: ${workflow_type}` });
  try {
    const { data: client } = await supabase.from('clients').select('name, niche').eq('id', client_id).maybeSingle();
    const ctx = await ragSearch(`${workflow_type} sequence ${client?.niche || 'ecommerce'}`, client_id).catch(() => '');

    const seqRaw = await aiCall(
      `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown. Write like a thoughtful friend at the brand — short sentences, genuine tone, no exclamation marks, no spam language. Use {{first_name}} for personalization. Never mention Claude.`,
      `Create a complete ${workflow_type} email/SMS sequence for ${client?.name || 'an ecommerce store'} (${client?.niche || 'ecommerce'}) targeting customers who ${typeConfig.desc}.\n\nWrite 3–5 message steps with appropriate wait steps between them. Mix email and SMS where it makes sense for this type of sequence. Each message should feel personal and serve a clear purpose in the journey.\n\nReturn JSON exactly in this shape:\n{"name":"...","trigger_type":"${typeConfig.trigger}","steps":[{"step_type":"email|sms|wait","subject":"...or empty","content":"...or empty","wait_hours":0}]}\n\nFor wait steps: step_type="wait", content="", subject="", wait_hours=number\nFor email steps: step_type="email", subject="...", content="full email body"\nFor SMS steps: step_type="sms", subject="", content="short SMS text under 160 chars"`,
      ctx
    );

    let parsed = { name: `${workflow_type} — ${client?.name || 'Store'}`, trigger_type: typeConfig.trigger, steps: [] };
    try {
      const s = seqRaw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const m = s.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : s);
    } catch { /* keep defaults */ }

    const steps = Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps : [];
    const wfName = parsed.name || `${workflow_type} — ${client?.name || 'Store'}`;

    const { data: workflow, error: wfErr } = await supabase.from('workflows').insert([{
      name: wfName,
      client_id,
      trigger_type: parsed.trigger_type || typeConfig.trigger,
      status: 'draft',
      enrolled_count: 0,
    }]).select().single();
    if (wfErr) throw wfErr;

    const stepRows = steps.map((s, i) => ({
      workflow_id: workflow.id,
      step_order: i + 1,
      step_type: s.step_type || 'email',
      subject: s.subject || null,
      content: s.content || '',
      wait_hours: s.wait_hours || 0,
    }));
    if (stepRows.length > 0) {
      await supabase.from('workflow_steps').insert(stepRows);
    }

    res.json({ ok: true, workflow, steps: stepRows });
  } catch (e) {
    console.error('/workflows/generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── FIX 2: IN-MEMORY RESPONSE CACHE ─────────────────────
// Simple 60-second TTL cache for expensive read endpoints.
const _cache = {};
const CACHE_TTL = 60 * 1000;

const cacheGet = (key) => {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { delete _cache[key]; return null; }
  return entry.data;
};

const cacheSet = (key, data) => { _cache[key] = { data, ts: Date.now() }; };

const cacheClear = (...keys) => { keys.forEach(k => { delete _cache[k]; }); };

// Middleware factory: caches JSON responses under the given key
const withCache = (key) => async (req, res, next) => {
  const cached = cacheGet(key);
  if (cached) return res.json(cached);
  const origJson = res.json.bind(res);
  res.json = (body) => { cacheSet(key, body); return origJson(body); };
  next();
};

// Cached GET /clients
app.get('/clients', withCache('clients'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ clients: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cached GET /contacts
app.get('/contacts', withCache('contacts'), async (req, res) => {
  try {
    const { client_id } = req.query;
    let q = supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (client_id) q = q.eq('client_id', client_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ contacts: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Clear relevant caches when writes happen
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const path = req.path.toLowerCase();
    if (path.startsWith('/clients')) cacheClear('clients');
    if (path.startsWith('/contacts')) cacheClear('contacts');
    if (path.startsWith('/analytics')) cacheClear('analytics_stats');
  }
  next();
});

// ─── FIX 3: BRANDED NOTIFICATION EMAILS ──────────────────
// Wrap notifyClientUser to use buildEmailHtml — keep the function name but upgrade the template
const _legacyNotifyClientUser = notifyClientUser;
const notifyClientUserBranded = async (clientId, subject, bodyHtml) => {
  if (!clientId) return;
  try {
    const { data: clientRow } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
    const { data: users } = await supabase.from('client_users').select('email, name').eq('client_id', clientId);
    const recipients = (users || []).map(u => u.email).filter(Boolean);
    if (recipients.length === 0) return;
    const from = { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' };
    const html = buildEmailHtml({
      content: bodyHtml.replace(/<p>/g, '').replace(/<\/p>/g, '\n').replace(/<strong>/g, '').replace(/<\/strong>/g, ''),
      subject,
      clientName: clientRow?.name || 'Sales Scales',
      brandColor: '#0a1628',
    });
    await Promise.all(recipients.map(to => sgMail.send({ to, from, subject, html })
      .catch(e => console.error(`notifyClientUser send to ${to} failed:`, e.message))));
  } catch (e) {
    console.error('notifyClientUserBranded error:', e.message);
  }
};

// ─── FIX 4: SLACK NOTIFICATION ON APPROVAL SUBMIT ────────
// Wired into POST /approvals/submit — send Slack message with approval details
const sendApprovalSlackNotification = async (approval, clientName) => {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  const priorityEmoji = { urgent: '🚨', high: '⚠️', normal: '📋', low: '💤' }[approval.priority] || '📋';
  const text = `${priorityEmoji} *New approval waiting* — ${approval.type} from *${approval.from_member || 'system'}*${clientName ? ` for ${clientName}` : ''}\n*${approval.title}*\nPriority: ${approval.priority || 'normal'}\nReview at https://aisalesscales.com`;
  try { await axios.post(url, { text }); }
  catch (e) { console.error('Approval Slack notification failed:', e.message); }
};

// ─── FIX 5: DAILY OWNER SUMMARY EMAIL — 7AM ──────────────
cron.schedule('0 7 * * *', async () => {
  console.log('[AUTO] Daily owner summary email starting...');
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return;
  try {
    const yesterdayStart = new Date(Date.now() - 86400000);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd   = new Date(yesterdayStart.getTime() + 86400000);
    const ysISO = yesterdayStart.toISOString();
    const yeISO = yesterdayEnd.toISOString();

    const [
      activeClientsRes, newContactsRes,
      completedEnrollmentsRes, urgentApprovalsRes,
      lowHealthClientsRes, recentErrorsRes,
    ] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('contacts').select('id', { count: 'exact', head: true })
        .gte('created_at', ysISO).lt('created_at', yeISO),
      supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
        .eq('status', 'completed').gte('completed_at', ysISO).lt('completed_at', yeISO),
      supabase.from('approvals').select('id, title, from_member, priority, clients(name)')
        .eq('status', 'pending').eq('priority', 'urgent').order('created_at', { ascending: false }).limit(5),
      supabase.from('clients').select('id, name, health_score')
        .lt('health_score', 50).not('health_score', 'is', null).order('health_score').limit(5),
      supabase.from('errors').select('message, endpoint, created_at')
        .gte('created_at', ysISO).order('created_at', { ascending: false }).limit(10),
    ]);

    const activeClients   = activeClientsRes.count || 0;
    const newContacts     = newContactsRes.count || 0;
    const completedEnroll = completedEnrollmentsRes.count || 0;
    const urgentApprovals = urgentApprovalsRes.data || [];
    const lowHealthClients = lowHealthClientsRes.data || [];
    const recentErrors    = recentErrorsRes.data || [];
    const dateStr = yesterdayStart.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const urgentRows = urgentApprovals.length > 0
      ? urgentApprovals.map(a => `<tr><td style="padding:6px 0;font-size:13px;color:#dc2626;font-weight:600">${a.title}</td><td style="padding:6px 0 6px 16px;font-size:12px;color:#4a5568">${a.from_member}</td></tr>`).join('')
      : '<tr><td colspan="2" style="padding:8px 0;font-size:13px;color:#10b981">✓ No urgent approvals</td></tr>';

    const lowHealthRows = lowHealthClients.length > 0
      ? lowHealthClients.map(c => `<tr><td style="padding:6px 0;font-size:13px;color:#0a1628;font-weight:600">${c.name}</td><td style="padding:6px 0 6px 16px;font-size:12px;color:#dc2626;font-weight:700">${c.health_score}/100</td></tr>`).join('')
      : '<tr><td colspan="2" style="padding:8px 0;font-size:13px;color:#10b981">✓ All clients healthy</td></tr>';

    const errorRows = recentErrors.length > 0
      ? recentErrors.slice(0, 5).map(e => `<tr><td style="padding:4px 0;font-size:11px;color:#dc2626;font-family:monospace">${(e.message || '').slice(0, 80)}</td><td style="padding:4px 0 4px 12px;font-size:10px;color:#8896a8">${e.endpoint}</td></tr>`).join('')
      : '<tr><td colspan="2" style="padding:8px 0;font-size:13px;color:#10b981">✓ No errors recorded</td></tr>';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f3f8;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f3f8;padding:24px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(10,22,40,0.10);">
  <tr><td style="background:#0a1628;padding:28px 32px;text-align:center;">
    <div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:1px;">SALES SCALES</div>
    <div style="width:40px;height:3px;background:#c9a84c;border-radius:2px;margin:10px auto 0;"></div>
    <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:10px;font-weight:600;letter-spacing:1px;">DAILY OWNER SUMMARY</div>
  </td></tr>
  <tr><td style="padding:24px 32px 8px;">
    <div style="font-size:13px;color:#8896a8;">${dateStr}</div>
    <div style="font-size:20px;font-weight:700;color:#0a1628;margin-top:4px;">Good morning, Yousef 👋</div>
  </td></tr>
  <tr><td style="padding:20px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="25%" style="text-align:center;background:#f8fafc;border-radius:10px;padding:16px 8px;border:1px solid #e4e9f0;">
          <div style="font-size:28px;font-weight:800;color:#0a1628;">${activeClients}</div>
          <div style="font-size:10px;color:#8896a8;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Active Clients</div>
        </td>
        <td width="4%"></td>
        <td width="25%" style="text-align:center;background:#f8fafc;border-radius:10px;padding:16px 8px;border:1px solid #e4e9f0;">
          <div style="font-size:28px;font-weight:800;color:#3b82f6;">${newContacts}</div>
          <div style="font-size:10px;color:#8896a8;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">New Contacts</div>
        </td>
        <td width="4%"></td>
        <td width="25%" style="text-align:center;background:#f8fafc;border-radius:10px;padding:16px 8px;border:1px solid #e4e9f0;">
          <div style="font-size:28px;font-weight:800;color:#10b981;">${completedEnroll}</div>
          <div style="font-size:10px;color:#8896a8;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Sequences Done</div>
        </td>
        <td width="4%"></td>
        <td width="25%" style="text-align:center;background:#f8fafc;border-radius:10px;padding:16px 8px;border:1px solid #e4e9f0;">
          <div style="font-size:28px;font-weight:800;color:${urgentApprovals.length > 0 ? '#dc2626' : '#10b981'};">${urgentApprovals.length}</div>
          <div style="font-size:10px;color:#8896a8;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Urgent Approvals</div>
        </td>
      </tr>
    </table>
  </td></tr>
  ${urgentApprovals.length > 0 ? `
  <tr><td style="padding:20px 32px 0;">
    <div style="font-size:11px;font-weight:700;color:#dc2626;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">⚠ Urgent Approvals Waiting</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${urgentRows}</table>
  </td></tr>` : ''}
  ${lowHealthClients.length > 0 ? `
  <tr><td style="padding:20px 32px 0;">
    <div style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">⚡ Clients Needing Attention</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lowHealthRows}</table>
  </td></tr>` : ''}
  <tr><td style="padding:20px 32px 0;">
    <div style="font-size:11px;font-weight:700;color:#4a5568;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">🖥 Server Errors Yesterday</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${errorRows}</table>
  </td></tr>
  <tr><td style="padding:20px 32px 32px;text-align:center;">
    <a href="https://aisalesscales.com" style="display:inline-block;background:#c9a84c;color:#0a1628;font-weight:700;font-size:13px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">Open Platform →</a>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e4e9f0;padding:20px 32px;text-align:center;">
    <div style="color:#8896a8;font-size:11px;">Sales Scales · Daily Summary · ${new Date().toLocaleString()}</div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

    await sgMail.send({
      to: 'yousef@aisalesscales.com',
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
      subject: `Daily Summary — ${dateStr} · ${activeClients} clients · ${newContacts} new contacts`,
      html,
    });
    console.log(`[AUTO] Daily owner summary sent — ${activeClients} clients, ${newContacts} contacts, ${completedEnroll} completed enrollments`);
  } catch (e) {
    console.error('[AUTO] Daily summary email error:', e.message);
  }
}, { timezone: 'Asia/Riyadh' });

// ─── FIX 1: BIRTHDAY SEQUENCE ─────────────────────────────
// SQL: ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday date;
cron.schedule('0 8 * * *', async () => {
  console.log('[AUTO] Birthday sequence check starting...');
  try {
    // Target contacts whose birthday month+day = today + 7 days
    const target = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');

    // Supabase doesn't support month/day extraction directly — fetch all with birthday set
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('id, first_name, email, client_id, birthday')
      .not('birthday', 'is', null)
      .not('email', 'is', null);

    if (!allContacts || allContacts.length === 0) return;

    // Filter to contacts whose birthday month/day matches the target
    const upcoming = allContacts.filter(c => {
      if (!c.birthday) return false;
      const [, cMm, cDd] = c.birthday.split('-');
      return cMm === mm && cDd === dd;
    });

    if (upcoming.length === 0) {
      console.log('[AUTO] Birthday check — no upcoming birthdays in 7 days');
      return;
    }

    for (const contact of upcoming) {
      try {
        // Only generate for contacts who have made a purchase (completed enrollment)
        const { count } = await supabase.from('workflow_enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contact.id)
          .eq('status', 'completed');
        if (!count || count === 0) continue;

        // Check if we already submitted a birthday approval for this contact this year
        const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
        const { count: existing } = await supabase.from('approvals')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', contact.client_id)
          .ilike('title', `%Birthday%${contact.first_name}%`)
          .gte('created_at', yearStart);
        if (existing && existing > 0) continue;

        const { data: client } = await supabase.from('clients').select('name, niche').eq('id', contact.client_id).maybeSingle();
        const ctx = await ragSearch(`birthday offer ${client?.niche || 'ecommerce'}`, contact.client_id).catch(() => '');

        const emailRaw = await aiCall(
          `You are Mahdi, Marketing & Content AI at Sales Scales. Return ONLY valid JSON, no markdown. Write warmly and personally — like a friend at the brand wishing them happy birthday. Include a special discount offer. No exclamation marks. Never mention Claude.`,
          `Write a birthday offer email for ${contact.first_name}, a customer of ${client?.name || 'the store'} (${client?.niche || 'ecommerce'}). Their birthday is in 7 days. Offer a special birthday discount — suggest a % off (choose 15%, 20%, or 25% based on what feels right for the brand). Warm, personal tone. One clear CTA. Return JSON: {"subject":"...","content":"...","discount_percentage":"20"}`,
          ctx
        );
        let parsed = { subject: `Happy Birthday, ${contact.first_name} 🎂`, content: '', discount_percentage: '20' };
        try {
          const s = emailRaw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const m = s.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(m ? m[0] : s);
        } catch { /* keep defaults */ }

        await supabase.from('approvals').insert([{
          type: 'email_sequence', from_member: 'mahdi', client_id: contact.client_id,
          title: `Birthday Offer — ${contact.first_name} (${mm}/${dd})`,
          content: parsed.content || '',
          metadata: {
            subject: parsed.subject,
            contact_id: contact.id,
            contact_email: contact.email,
            discount_percentage: parsed.discount_percentage,
            birthday: contact.birthday,
            steps: [{ step_type: 'email', subject: parsed.subject, content: parsed.content || '', wait_hours: 0 }],
          },
          priority: 'normal', status: 'pending', created_at: new Date().toISOString(),
        }]);
        console.log(`[AUTO] Birthday approval submitted for ${contact.first_name} (${contact.client_id})`);
      } catch (contactErr) {
        console.error(`[AUTO] Birthday error for contact ${contact.id}:`, contactErr.message);
      }
    }
  } catch (e) {
    console.error('[AUTO] Birthday cron error:', e.message);
  }
});

// ─── FIX 2: CALENDLY WEBHOOK ──────────────────────────────
// SQL: CREATE TABLE IF NOT EXISTS calendly_bookings (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   invitee_name text, invitee_email text,
//   event_name text, start_time timestamptz,
//   cancel_url text, reschedule_url text,
//   created_at timestamptz DEFAULT now()
// );
app.post('/calendly/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const event = req.body;
    if (event.event !== 'invitee.created') return;

    const payload      = event.payload || {};
    const invitee      = payload.invitee || {};
    const eventType    = payload.event_type || {};
    const name         = invitee.name || 'Prospect';
    const email        = invitee.email || '';
    const eventName    = eventType.name || 'Sales Call';
    const startTime    = payload.event?.start_time || payload.scheduled_event?.start_time || '';
    const cancelUrl    = invitee.cancel_url || '';
    const rescheduleUrl = invitee.reschedule_url || '';

    // Store booking
    await supabase.from('calendly_bookings').insert([{
      invitee_name: name, invitee_email: email,
      event_name: eventName, start_time: startTime || null,
      cancel_url: cancelUrl, reschedule_url: rescheduleUrl,
      created_at: new Date().toISOString(),
    }]);

    const formattedTime = startTime
      ? new Date(startTime).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
      : 'time TBC';

    // Send confirmation email to prospect
    if (email && process.env.SENDGRID_FROM_EMAIL) {
      const confirmHtml = buildEmailHtml({
        subject: `You're booked — ${eventName}`,
        content: `Hi ${name},\n\nYour call is confirmed. Here are your booking details:\n\nEvent: ${eventName}\nTime: ${formattedTime}\n\nWe're looking forward to showing you exactly how Sales Scales works and how quickly you can start recovering revenue.\n\nIf you need to reschedule, use the link below.`,
        clientName: 'Sales Scales',
        brandColor: '#0a1628',
        cartLink: rescheduleUrl || '',
      }).replace('Complete Your Order →', 'Reschedule if needed');
      await sgMail.send({
        to: email,
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
        subject: `You're booked — ${eventName}`,
        html: confirmHtml,
      }).catch(e => console.error('Calendly confirmation email failed:', e.message));
    }

    // Hassan briefing with talking points
    const talkingPoints = await aiCall(
      `You are Hassan, Growth & Outreach AI at Sales Scales. You are sharp, personable, and know how to open a great sales conversation. You are Hassan — never mention Claude.`,
      `A prospect named ${name} (${email || 'email unknown'}) just booked a ${eventName} for ${formattedTime}.\n\nGenerate a concise briefing for Yousef with:\n1. A recommended opening line for the call\n2. 3 qualifying questions to understand their situation\n3. Key pain points to probe for (cart abandonment, low email open rates, manual follow-up)\n4. How to position Sales Scales specifically for an ecommerce agency prospect\n5. A suggested close and next step\n\nKeep it tight and actionable — this is a pre-call prep note, not an essay.`
    ).catch(() => `New booking: ${name} — ${formattedTime}`);

    await storeBriefing(
      'hassan', 'yousef',
      `New Booking — ${name} · ${eventName} · ${formattedTime}`,
      `Prospect: ${name}\nEmail: ${email || '—'}\nEvent: ${eventName}\nTime: ${formattedTime}\n\n${talkingPoints}`,
      'high'
    ).catch(e => console.error('Calendly briefing error:', e.message));

    console.log(`[calendly] Booking stored and briefing sent for ${name} (${email})`);
  } catch (e) {
    console.error('/calendly/webhook error:', e.message);
  }
});

// ─── FIX 3: CONTRACT PDF GENERATOR ───────────────────────
app.get('/contracts/generate', async (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { data: client } = await supabase.from('clients').select('name, tier').eq('id', client_id).maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const TIER_FEES   = { starter: '$199', growth: '$299', elite: '$399', scale: '$399', enterprise: 'Custom' };
    const TIER_SVCS   = {
      starter:    'Email automation, SMS automation, CRM & contacts, AI team (6 members), up to 3 active sequences',
      growth:     'Everything in Starter, plus WhatsApp automation, unlimited sequences, Klaviyo, Meta Ads, HubSpot CRM integrations',
      elite:      'Everything in Growth, plus Voice AI agents, Shopify live data, Canva design briefs, Higgsfield video briefs',
      enterprise: 'Custom scope as agreed in writing',
    };
    const tier        = (client.tier || 'starter').toLowerCase();
    const fee         = TIER_FEES[tier] || '$199';
    const services    = TIER_SVCS[tier] || TIER_SVCS.starter;
    const today       = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const year        = new Date().getFullYear();

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Service Agreement — ${client.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; color: #0a1628; background: #fff; padding: 48px 60px; line-height: 1.7; }
    .header { text-align: center; border-bottom: 3px solid #0a1628; padding-bottom: 24px; margin-bottom: 32px; }
    .logo { font-size: 22pt; font-weight: 700; letter-spacing: 2px; color: #0a1628; font-family: Arial, sans-serif; }
    .logo span { color: #c9a84c; }
    .subtitle { font-size: 9pt; color: #8896a8; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; font-family: Arial, sans-serif; }
    .doc-title { font-size: 16pt; font-weight: 700; margin-top: 20px; color: #0a1628; font-family: Arial, sans-serif; }
    .section { margin-bottom: 22px; }
    .section-num { font-size: 9pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #c9a84c; font-family: Arial, sans-serif; margin-bottom: 6px; }
    .section-title { font-size: 12pt; font-weight: 700; margin-bottom: 8px; font-family: Arial, sans-serif; }
    p { margin-bottom: 8px; }
    .parties-table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; }
    .parties-table td { padding: 10px 14px; border: 1px solid #e4e9f0; font-size: 11pt; }
    .parties-table td:first-child { font-weight: 700; font-family: Arial, sans-serif; width: 30%; background: #f8fafc; font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; color: #4a5568; }
    .fee-box { background: #f8fafc; border: 1px solid #e4e9f0; border-left: 4px solid #c9a84c; border-radius: 4px; padding: 16px 20px; margin: 12px 0; }
    .fee-amount { font-size: 20pt; font-weight: 700; color: #0a1628; font-family: Arial, sans-serif; }
    .fee-label { font-size: 9pt; color: #8896a8; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, sans-serif; }
    ol { padding-left: 20px; }
    ol li { margin-bottom: 6px; }
    .sig-block { margin-top: 48px; display: flex; gap: 60px; }
    .sig-col { flex: 1; }
    .sig-line { border-bottom: 1px solid #0a1628; height: 36px; margin-bottom: 6px; }
    .sig-label { font-size: 9pt; color: #8896a8; font-family: Arial, sans-serif; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e4e9f0; text-align: center; font-size: 9pt; color: #8896a8; font-family: Arial, sans-serif; }
    @media print {
      body { padding: 24px 36px; }
      @page { margin: 0.75in; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">SALES <span>SCALES</span></div>
    <div class="subtitle">AI Revenue System</div>
    <div class="doc-title">Service Agreement</div>
    <div style="font-size:10pt;color:#8896a8;margin-top:8px;font-family:Arial,sans-serif;">Effective Date: ${today}</div>
  </div>

  <div class="section">
    <div class="section-num">1. Parties</div>
    <div class="section-title">Service Provider &amp; Client</div>
    <table class="parties-table">
      <tr><td>Service Provider</td><td>Sales Scales · aisalesscales.com</td></tr>
      <tr><td>Client</td><td>${client.name}</td></tr>
      <tr><td>Plan</td><td>${tier.charAt(0).toUpperCase() + tier.slice(1)}</td></tr>
      <tr><td>Effective Date</td><td>${today}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-num">2. Services</div>
    <div class="section-title">Scope of Work</div>
    <p>Sales Scales will provide the following services under the <strong>${tier.charAt(0).toUpperCase() + tier.slice(1)}</strong> plan:</p>
    <p>${services}.</p>
    <p>Services are delivered via the Sales Scales platform and AI team, operating on behalf of the Client's store automatically and continuously.</p>
  </div>

  <div class="section">
    <div class="section-num">3. Fees &amp; Payment</div>
    <div class="section-title">Monthly Retainer</div>
    <div class="fee-box">
      <div class="fee-label">Monthly Fee</div>
      <div class="fee-amount">${fee}</div>
      <div style="font-size:10pt;color:#4a5568;margin-top:4px;">per month, billed monthly in advance</div>
    </div>
    <p>Payment is due on the same day each calendar month. Late payments beyond 7 days may result in service suspension. All fees are in USD.</p>
  </div>

  <div class="section">
    <div class="section-num">4. Term &amp; Termination</div>
    <div class="section-title">Duration</div>
    <p>This Agreement commences on the Effective Date and continues on a month-to-month basis. Either party may terminate with 30 days' written notice. Sales Scales may terminate immediately for non-payment or material breach.</p>
  </div>

  <div class="section">
    <div class="section-num">5. Intellectual Property</div>
    <div class="section-title">Ownership</div>
    <p>All content generated by Sales Scales on behalf of the Client (emails, SMS copy, sequences) is the property of the Client upon payment. The Sales Scales platform, AI systems, and proprietary technology remain the sole property of Sales Scales.</p>
  </div>

  <div class="section">
    <div class="section-num">6. Confidentiality</div>
    <div class="section-title">Non-Disclosure</div>
    <p>Both parties agree to keep confidential any non-public information received from the other party and to use such information solely for the purposes of this Agreement.</p>
  </div>

  <div class="section">
    <div class="section-num">7. Limitation of Liability</div>
    <div class="section-title">Cap on Damages</div>
    <p>Sales Scales' total liability shall not exceed the fees paid in the three months preceding the claim. Sales Scales is not liable for indirect, incidental, or consequential damages. Revenue estimates shown in the platform are illustrative and not guaranteed.</p>
  </div>

  <div class="section">
    <div class="section-num">8. Governing Law</div>
    <div class="section-title">Jurisdiction</div>
    <p>This Agreement is governed by the laws of the jurisdiction in which Sales Scales operates. Any disputes shall be resolved through binding arbitration before resorting to litigation.</p>
  </div>

  <div class="section">
    <div class="section-num">9. Entire Agreement</div>
    <p>This document constitutes the entire agreement between the parties and supersedes all prior discussions. Amendments must be in writing and signed by both parties.</p>
  </div>

  <div class="sig-block">
    <div class="sig-col">
      <div class="sig-line"></div>
      <div class="sig-label">Sales Scales — Authorised Signatory</div>
      <div style="font-size:9pt;color:#8896a8;font-family:Arial,sans-serif;margin-top:4px;">Date: _______________</div>
    </div>
    <div class="sig-col">
      <div class="sig-line"></div>
      <div class="sig-label">${client.name} — Client Signatory</div>
      <div style="font-size:9pt;color:#8896a8;font-family:Arial,sans-serif;margin-top:4px;">Date: _______________</div>
    </div>
  </div>

  <div class="footer">
    &copy; ${year} Sales Scales &nbsp;·&nbsp; aisalesscales.com &nbsp;·&nbsp; Generated ${today}
    <br/>To save as PDF: File &rarr; Print &rarr; Save as PDF
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="Sales-Scales-Agreement-${client.name.replace(/\s+/g, '-')}.html"`);
    res.send(html);
  } catch (e) {
    console.error('/contracts/generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── CLIENT TEAM MANAGEMENT ──────────────────────────────
const VALID_TEAM_ROLES = ['admin', 'viewer', 'approver'];

app.post('/client-team/invite', async (req, res) => {
  const { client_id, email, name, role } = req.body;
  if (!client_id || !email || !name) return res.status(400).json({ error: 'client_id, email, and name required' });
  const memberRole = VALID_TEAM_ROLES.includes(role) ? role : 'viewer';
  try {
    const { data: existing } = await supabase.from('client_users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const { data: newUser, error: insertErr } = await supabase.from('client_users').insert([{
      name, email: email.toLowerCase(), password: passwordHash, client_id, role: memberRole,
    }]).select('id, name, email, client_id, role').single();
    if (insertErr) throw insertErr;

    const { data: client } = await supabase.from('clients').select('name').eq('id', client_id).maybeSingle();
    const storeName = client?.name || 'Sales Scales';
    const roleLabel = memberRole.charAt(0).toUpperCase() + memberRole.slice(1);
    const roleDesc = memberRole === 'admin' ? 'full access including settings and approvals'
      : memberRole === 'approver' ? 'can review and approve content, view sequences and reports'
      : 'read-only access to the dashboard and reports';

    sgMail.send({
      to: email,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
      subject: `You've been invited to ${storeName} on Sales Scales`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f3f8;padding:32px 16px">
        <div style="background:#0a1628;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
          <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase">Sales Scales</div>
          <div style="color:white;font-size:18px;font-weight:700;margin-top:8px">You've been invited</div>
        </div>
        <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 12px 12px;padding:28px 32px">
          <p style="color:#0a1628;font-size:14px;line-height:1.7;margin:0 0 16px">Hi ${name},</p>
          <p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0 0 16px">You've been added to <strong>${storeName}</strong>'s Sales Scales portal as a <strong>${roleLabel}</strong> — ${roleDesc}.</p>
          <div style="background:#f0f3f8;border-radius:8px;padding:18px 20px;margin:0 0 20px">
            <div style="font-size:12px;color:#4a5568;margin-bottom:6px"><strong>Login URL:</strong> <a href="http://localhost:3000" style="color:#c9a84c">localhost:3000</a></div>
            <div style="font-size:12px;color:#4a5568;margin-bottom:6px"><strong>Email:</strong> ${email.toLowerCase()}</div>
            <div style="font-size:12px;color:#4a5568"><strong>Temporary password:</strong> <span style="font-family:monospace;background:#e4e9f0;padding:2px 6px;border-radius:4px">${tempPassword}</span></div>
          </div>
          <p style="color:#8896a8;font-size:12px;margin:0">Please change your password after your first login.</p>
        </div>
      </div>`,
    }).catch(e => console.error('Team invite email failed:', e.message));

    res.json({ ok: true, member: newUser, temp_password: tempPassword });
  } catch (e) {
    console.error('/client-team/invite error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/client-team/members', async (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { data, error } = await supabase.from('client_users')
      .select('id, name, email, role, last_login, created_at')
      .eq('client_id', client_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ members: (data || []).map(m => ({ ...m, role: m.role || 'admin' })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/client-team/remove', async (req, res) => {
  const { client_user_id, client_id } = req.body;
  if (!client_user_id || !client_id) return res.status(400).json({ error: 'client_user_id and client_id required' });
  try {
    const { error } = await supabase.from('client_users')
      .delete().eq('id', client_user_id).eq('client_id', client_id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/client-team/update-role', async (req, res) => {
  const { client_user_id, client_id, role } = req.body;
  if (!client_user_id || !client_id || !role) return res.status(400).json({ error: 'client_user_id, client_id, and role required' });
  if (!VALID_TEAM_ROLES.includes(role)) return res.status(400).json({ error: 'role must be admin, viewer, or approver' });
  try {
    const { data, error } = await supabase.from('client_users')
      .update({ role }).eq('id', client_user_id).eq('client_id', client_id)
      .select('id, name, email, role').single();
    if (error) throw error;
    res.json({ ok: true, member: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REVENUE ATTRIBUTION ─────────────────────────────────
// SQL (run once in Supabase SQL editor):
// ALTER TABLE clients ADD COLUMN IF NOT EXISTS recovered_revenue numeric DEFAULT 0;
// ALTER TABLE clients ADD COLUMN IF NOT EXISTS performance_fee_enabled boolean DEFAULT true;
// CREATE TABLE IF NOT EXISTS performance_fees (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, client_id uuid REFERENCES clients(id), month text, revenue_amount numeric DEFAULT 0, fee_amount numeric DEFAULT 0, status text DEFAULT 'pending', created_at timestamptz DEFAULT now());
// CREATE TABLE IF NOT EXISTS revenue_attribution (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, client_id uuid REFERENCES clients(id), contact_id uuid REFERENCES contacts(id), order_id text, order_value numeric DEFAULT 0, channel text, workflow_id uuid, attributed_at timestamptz DEFAULT now());
const ATTR_TIER_FEES = { starter: 199, growth: 299, elite: 399, scale: 399, enterprise: 399 };

app.get('/revenue/attribution', async (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [clientRes, onboardingRes] = await Promise.all([
      supabase.from('clients').select('id, name, tier, recovered_revenue').eq('id', client_id).maybeSingle(),
      supabase.from('client_onboarding').select('average_order_value').eq('client_id', client_id).maybeSingle(),
    ]);
    const client = clientRes.data;
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const parseAovLocal = (text) => {
      if (!text) return 75;
      if (text.includes('Under')) return 25;
      const n = text.replace(/[^0-9–-]/g, '');
      if (n.includes('30') || n.includes('75')) return 52;
      if (n.includes('75') || n.includes('150')) return 112;
      if (n.includes('150') || n.includes('300')) return 225;
      if (text.includes('Over')) return 350;
      return 75;
    };
    const aov = parseAovLocal(onboardingRes.data?.average_order_value);
    const monthlyCost = ATTR_TIER_FEES[(client.tier || '').toLowerCase()] || 199;

    // ── 1. Shopify store total revenue this month ────────────
    let storeRevenue = 0;
    try {
      const { data: conn } = await supabase.from('shopify_connections')
        .select('shop, access_token').eq('client_id', client_id).maybeSingle();
      if (conn) {
        const hdrs = { 'X-Shopify-Access-Token': conn.access_token };
        const base = `https://${conn.shop}/admin/api/2026-01`;
        const { data: ord } = await axios.get(
          `${base}/orders.json?status=any&financial_status=paid&created_at_min=${monthStart}&limit=250`,
          { headers: hdrs, timeout: 8000 }
        );
        storeRevenue = Math.round((ord.orders || []).reduce((s, o) => s + parseFloat(o.total_price || 0), 0) * 100) / 100;
      }
    } catch { /* Shopify unreachable — non-fatal */ }

    // ── 2. Platform recovered revenue ───────────────────────
    // Primary: revenue_attribution table (contacts who purchased within 7 days of a sequence message)
    const { data: attrRows } = await supabase.from('revenue_attribution')
      .select('order_value, channel').eq('client_id', client_id).gte('attributed_at', monthStart);
    const attrTotal = (attrRows || []).reduce((s, r) => s + parseFloat(r.order_value || 0), 0);

    // Fallback: completed enrollments × AOV when attribution table is empty
    let platformRevenue = attrTotal;
    let completedEnrollments = 0;
    if (platformRevenue === 0) {
      const { count: cm } = await supabase.from('workflow_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client_id).eq('status', 'completed').gte('completed_at', monthStart);
      completedEnrollments = cm || 0;
      platformRevenue = completedEnrollments * aov;
    }
    // Also pick up any webhook-attributed total stored on the client record
    const dbRecovered = parseFloat(client.recovered_revenue || 0);
    if (dbRecovered > platformRevenue) platformRevenue = dbRecovered;

    // ── 3. Revenue by channel from attribution table ─────────
    const attrByChannel = {};
    for (const r of (attrRows || [])) {
      const ch = (r.channel || 'Email').charAt(0).toUpperCase() + (r.channel || 'Email').slice(1);
      attrByChannel[ch] = (attrByChannel[ch] || 0) + parseFloat(r.order_value || 0);
    }
    const hasChannelAttr = Object.keys(attrByChannel).length > 0;

    // ── 4. Email / SMS / WhatsApp metrics ────────────────────
    const msgChannels = [
      { channel: 'Email',    label: 'Email Sequences',    rateLabel: 'Open Rate',   db: 'Email',    useOpened: true  },
      { channel: 'SMS',      label: 'SMS Sequences',      rateLabel: 'Reply Rate',  db: 'SMS',      useOpened: false },
      { channel: 'WhatsApp', label: 'WhatsApp Sequences', rateLabel: 'Reply Rate',  db: 'WhatsApp', useOpened: false },
    ];
    const msgBreakdown = await Promise.all(msgChannels.map(async ({ channel, label, rateLabel, db, useOpened }) => {
      const [sentRes, openedRes, repliedRes] = await Promise.all([
        supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('client_id', client_id).eq('channel', db).eq('direction', 'outbound').gte('created_at', monthStart),
        useOpened
          ? supabase.from('messages').select('id', { count: 'exact', head: true })
              .eq('client_id', client_id).eq('channel', db).eq('direction', 'outbound')
              .not('opened_at', 'is', null).gte('created_at', monthStart)
          : Promise.resolve({ count: 0 }),
        supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('client_id', client_id).eq('channel', db).eq('direction', 'inbound').gte('created_at', monthStart),
      ]);
      const sent = sentRes.count || 0;
      const engaged = useOpened ? (openedRes.count || 0) : (repliedRes.count || 0);
      const rate = sent > 0 ? Math.round((engaged / sent) * 100) : 0;
      // Revenue: from attribution table, or proportional split of platform revenue
      let revenue = Math.round(attrByChannel[channel] || 0);
      if (!hasChannelAttr && platformRevenue > 0) {
        const weights = { Email: 0.50, SMS: 0.30, WhatsApp: 0.15 };
        revenue = sent > 0 ? Math.round(platformRevenue * (weights[channel] || 0)) : 0;
      }
      return { channel, label, sent, rateLabel, rate, revenue };
    }));

    // ── 5. Voice calls ───────────────────────────────────────
    const { data: callRows } = await supabase.from('call_logs')
      .select('id, status').eq('client_id', client_id).gte('created_at', monthStart);
    const callsMade = (callRows || []).length;
    const callsAnswered = (callRows || []).filter(c => ['completed', 'answered'].includes(c.status)).length;
    const voiceRate = callsMade > 0 ? Math.round((callsAnswered / callsMade) * 100) : 0;
    const voiceRevenue = hasChannelAttr
      ? Math.round(attrByChannel['Voice'] || 0)
      : (platformRevenue > 0 && callsMade > 0 ? Math.round(platformRevenue * 0.05) : 0);
    msgBreakdown.push({ channel: 'Voice', label: 'Voice Calls', sent: callsMade, rateLabel: 'Answer Rate', rate: voiceRate, revenue: voiceRevenue });

    const totalAttributed = msgBreakdown.reduce((s, c) => s + c.revenue, 0);
    const roi = monthlyCost > 0 ? parseFloat((platformRevenue / monthlyCost).toFixed(2)) : 0;

    res.json({
      store_revenue: storeRevenue,
      platform_revenue: platformRevenue,
      monthly_cost: monthlyCost,
      roi,
      aov,
      completed_enrollments: completedEnrollments,
      channel_breakdown: msgBreakdown,
      total_attributed: totalAttributed,
    });
  } catch (e) {
    console.error('/revenue/attribution error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── SHOPIFY ORDER WEBHOOK (purchase attribution) ─────────
app.post('/shopify/order-webhook', async (req, res) => {
  const payload = req.body;
  try {
    const email = payload.email || payload.contact_email || '';
    const shopDomain = req.headers['x-shopify-shop-domain'] || '';
    const orderValue = parseFloat(payload.total_price || payload.subtotal_price || '0') || 0;
    const orderId = String(payload.id || payload.order_number || Date.now());
    if (!email) return res.json({ ok: false, reason: 'no_email' });
    const { data: conn } = await supabase.from('shopify_connections').select('client_id').eq('shop', shopDomain).maybeSingle();
    const client_id = conn?.client_id;
    if (!client_id) return res.json({ ok: false, reason: 'shop_not_linked' });
    const { data: contact } = await supabase.from('contacts').select('id').eq('email', email).eq('client_id', client_id).maybeSingle();
    if (!contact) return res.json({ ok: false, reason: 'contact_not_found' });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    const { data: enrollment } = await supabase.from('workflow_enrollments')
      .select('id, workflow_id').eq('contact_id', contact.id).eq('client_id', client_id)
      .gte('enrolled_at', sevenDaysAgo).maybeSingle();
    if (!enrollment) return res.json({ ok: false, reason: 'no_recent_enrollment' });
    // Store attribution
    await supabase.from('revenue_attribution').insert([{
      client_id, contact_id: contact.id, order_id: orderId,
      order_value: orderValue, workflow_id: enrollment.workflow_id,
    }]);
    // Increment recovered_revenue
    const { data: cl } = await supabase.from('clients').select('recovered_revenue').eq('id', client_id).maybeSingle();
    await supabase.from('clients').update({ recovered_revenue: ((cl?.recovered_revenue || 0) + orderValue) }).eq('id', client_id);
    console.log(`[Attribution] $${orderValue} attributed to client ${client_id} from order ${orderId}`);
    res.json({ ok: true, attributed: orderValue });
  } catch (e) {
    console.error('/shopify/order-webhook error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── PERFORMANCE FEE LIST ─────────────────────────────────
app.get('/performance-fees/list', async (req, res) => {
  const { client_id } = req.query;
  try {
    let query = supabase.from('performance_fees').select('*, clients(name)').order('created_at', { ascending: false });
    if (client_id) query = query.eq('client_id', client_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ fees: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ALI GENERATE CALL SCRIPT (standalone endpoint) ───────
app.post('/ali/generate-call-script', async (req, res) => {
  const { contact_id, client_id, product_name, cart_value } = req.body;
  if (!contact_id || !client_id) return res.status(400).json({ error: 'contact_id and client_id required' });
  try {
    const [contactRes, clientRes] = await Promise.all([
      supabase.from('contacts').select('first_name, last_name, email, phone, pipeline_stage').eq('id', contact_id).maybeSingle(),
      supabase.from('clients').select('name, niche').eq('id', client_id).maybeSingle(),
    ]);
    const contact = contactRes.data;
    const client = clientRes.data;
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    const [ragCtx, briefCtx] = await Promise.all([
      ragSearch(`cart recovery NEPQ sales call ${product_name || ''} ${client?.niche || ''}`, client_id).catch(() => ''),
      getBriefingsContext('ali').catch(() => ''),
    ]);
    const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email || 'the customer';
    const context = [ragCtx, briefCtx].filter(Boolean).join('\n\n');
    const productInfo = product_name ? `Abandoned product: ${product_name}` : '';
    const valueInfo = cart_value ? `Cart value: $${cart_value}` : '';
    const script = await generateAliCallScript(
      { ...contact, abandoned_products: product_name || 'their cart items', cart_value: cart_value || null },
      [],
      context,
      client?.name || ''
    );
    const briefingLines = [
      `NEPQ CART RECOVERY CALL BRIEF — ${contactName}`,
      `Store: ${client?.name || ''} (${client?.niche || 'ecommerce'})`,
      productInfo, valueInfo, '',
      '── OPENING ──', script.opening || '',
      '', '── SITUATION QUESTIONS ──', (script.situation_questions || []).join('\n'),
      '', '── PROBLEM AWARENESS ──', (script.problem_questions || []).join('\n'),
      '', '── CONSEQUENCE QUESTIONS ──', (script.consequence_questions || []).join('\n'),
      '', '── CLOSE ──', script.close || '',
      '', '── OBJECTION HANDLERS ──',
      ...Object.entries(script.objections || {}).map(([k, v]) => `${k}: ${v}`),
    ].filter(l => l !== null).join('\n');
    await storeBriefing('ali', 'yousef', `Cart Recovery Brief — ${contactName} (${client?.name || 'Client'})`, briefingLines, 'high', client_id, contact_id);
    const { data: callRecord } = await supabase.from('call_logs').select('id').eq('contact_id', contact_id).eq('client_id', client_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (callRecord) {
      await supabase.from('call_logs').update({ call_script: briefingLines, objection_handlers: script.objections || {} }).eq('id', callRecord.id);
    }
    res.json({ ok: true, script, briefing: briefingLines });
  } catch (e) {
    console.error('/ali/generate-call-script error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── MONTHLY PERFORMANCE FEE CRON (1st of month at 2am) ───
cron.schedule('0 2 1 * *', async () => {
  console.log('[CRON] Monthly performance fee calculation starting...');
  try {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const monthLabel = lastMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const { data: clients } = await supabase.from('clients').select('id, name, recovered_revenue, performance_fee_enabled').gt('recovered_revenue', 0);
    if (!clients || clients.length === 0) return;
    for (const client of clients) {
      if (client.performance_fee_enabled === false) continue;
      const recovered = parseFloat(client.recovered_revenue || 0);
      if (recovered <= 0) continue;
      const feeAmount = Math.round(recovered * 0.10 * 100) / 100;
      const { error: feeErr } = await supabase.from('performance_fees').insert([{
        client_id: client.id, month: monthLabel,
        revenue_amount: recovered, fee_amount: feeAmount, status: 'pending',
      }]);
      if (feeErr) console.error(`Perf fee insert failed for ${client.name}:`, feeErr.message);
      await supabase.from('clients').update({ recovered_revenue: 0 }).eq('id', client.id);
      console.log(`[CRON] Performance fee for ${client.name}: $${feeAmount} (10% of $${recovered})`);
    }
  } catch (e) {
    console.error('[CRON] Performance fee calculation error:', e.message);
  }
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────
app.use((err, req, res, next) => {
  const endpoint = `${req.method} ${req.path}`;
  console.error(`[${new Date().toISOString()}] Unhandled error — ${endpoint} — ${err.message}`);
  console.error(err.stack);
  logError(err, endpoint);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ─── ZIDNI ────────────────────────────────────────────────

function paypalBase() {
  return (process.env.PAYPAL_MODE || 'sandbox') === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken() {
  const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const { data } = await axios.post(
    `${paypalBase()}/v1/oauth2/token`,
    'grant_type=client_credentials',
    { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data.access_token;
}

app.get('/zidni/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/zidni/paypal-config', (req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID || '', mode: process.env.PAYPAL_MODE || 'sandbox' });
});

app.post('/zidni/paypal/create-order', async (req, res) => {
  const { tier } = req.body;
  const amount = tier === 'elite' ? '200.00' : '100.00';
  try {
    const ppToken = await getPayPalAccessToken();
    const { data } = await axios.post(
      `${paypalBase()}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: amount },
          description: `Zidni ${tier === 'elite' ? 'Elite' : 'Starter'} Membership`,
        }],
      },
      { headers: { Authorization: `Bearer ${ppToken}`, 'Content-Type': 'application/json' } }
    );
    res.json({ orderId: data.id });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(500).json({ error: 'Failed to create PayPal order: ' + msg });
  }
});

app.post('/zidni/signup', async (req, res) => {
  const { tier, name, email, password, whatsapp, country, niche, paypalOrderId } = req.body;
  if (!email || !password || !tier || !paypalOrderId) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Capture PayPal payment
  try {
    const ppToken = await getPayPalAccessToken();
    await axios.post(
      `${paypalBase()}/v2/checkout/orders/${paypalOrderId}/capture`,
      {},
      { headers: { Authorization: `Bearer ${ppToken}`, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const ppErrName = err.response?.data?.name;
    if (ppErrName !== 'ORDER_ALREADY_CAPTURED') {
      return res.status(402).json({ error: 'Payment capture failed. Please contact support.' });
    }
    // idempotent: already captured on a retry — allow through
  }

  // Hash password + generate referral code
  const passwordHash = await bcrypt.hash(password, 10);
  const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  // Create client record
  const { data: client, error: clientErr } = await supabase
    .from('zidni_clients')
    .insert({ name, email, password: passwordHash, tier, whatsapp, country, niche, referral_code: referralCode, verified: true, accepted_terms: true })
    .select()
    .single();
  if (clientErr) {
    if (clientErr.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
    return res.status(500).json({ error: 'Failed to create account.' });
  }

  // Assign pool spots (non-fatal if no pool exists yet)
  const spots = tier === 'elite' ? 1.5 : 1;
  try {
    const { data: pool } = await supabase
      .from('zidni_pools')
      .select('id, current_spots')
      .eq('niche', niche)
      .in('status', ['building', 'active'])
      .limit(1)
      .maybeSingle();
    if (pool) {
      await supabase.from('zidni_client_spots').insert({ client_id: client.id, pool_id: pool.id, spots, multiplier: 1 });
      await supabase.from('zidni_pools').update({ current_spots: (pool.current_spots || 0) + 1 }).eq('id', pool.id);
    }
  } catch (_) {}

  // Send welcome email (non-fatal)
  try {
    await sgMail.send({
      to: email,
      from: { email: 'yousef@joinzidni.com', name: 'Zidni' },
      subject: `Welcome to Zidni${name ? ', ' + name : ''}! Your income system is building.`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#f0f4f8;padding:40px 32px;border-radius:16px;">
          <div style="margin-bottom:28px;">
            <span style="background:#c9a84c;color:#050d1a;font-weight:800;font-size:16px;padding:6px 14px;border-radius:8px;">Zidni</span>
          </div>
          <h1 style="font-size:26px;font-weight:800;margin:0 0 12px;letter-spacing:-0.5px;">Welcome${name ? ', ' + name : ''}! 🎉</h1>
          <p style="font-size:15px;color:#8896a8;line-height:1.6;margin:0 0 24px;">
            Your <strong style="color:#c9a84c;">${tier === 'elite' ? 'Elite' : 'Starter'}</strong> membership is confirmed. We're building your <strong style="color:#f0f4f8;">${niche}</strong> income system across all 6 streams right now.
          </p>
          <div style="background:#0a1628;border:1px solid rgba(201,168,76,0.2);border-radius:12px;padding:24px;margin-bottom:24px;">
            <p style="font-size:11px;font-weight:700;color:#c9a84c;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Your membership</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><td style="padding:6px 0;color:#8896a8;">Plan</td><td style="padding:6px 0;font-weight:700;text-align:right;">${tier === 'elite' ? 'Elite — $200/mo' : 'Starter — $100/mo'}</td></tr>
              <tr><td style="padding:6px 0;color:#8896a8;">Niche</td><td style="padding:6px 0;font-weight:700;text-align:right;">${niche}</td></tr>
              <tr><td style="padding:6px 0;color:#8896a8;">Pool spots</td><td style="padding:6px 0;font-weight:700;text-align:right;">${spots}</td></tr>
              <tr><td style="padding:6px 0;color:#8896a8;">Referral code</td><td style="padding:6px 0;font-weight:700;color:#c9a84c;text-align:right;">${referralCode}</td></tr>
            </table>
          </div>
          <div style="background:#0a1628;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:24px;margin-bottom:28px;">
            <p style="font-size:11px;font-weight:700;color:#c9a84c;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">Your 6 income streams</p>
            <ul style="margin:0;padding-left:18px;font-size:13px;color:#8896a8;line-height:2.1;">
              <li>Etsy digital product shop</li><li>Gumroad downloadable guides</li>
              <li>Amazon KDP low-content books</li><li>Pinterest traffic engine</li>
              <li>Affiliate program integrations</li><li>Shopify digital storefront</li>
            </ul>
          </div>
          <a href="https://joinzidni.com/zidni/dashboard" style="display:block;background:linear-gradient(135deg,#c9a84c,#e8c96a);color:#050d1a;text-align:center;padding:14px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;margin-bottom:24px;">View Your Dashboard →</a>
          <p style="font-size:12px;color:#4a5568;margin:0;">Questions? Reply to this email or WhatsApp us directly.</p>
        </div>
      `,
    });
  } catch (_) {}

  const token = jwt.sign({ id: client.id, email, role: 'zidni_client' }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ ok: true, clientId: client.id, token, name, email, tier });
});

app.post('/zidni/waitlist', async (req, res) => {
  const { name, email, whatsapp, country, niche } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const { error: dbErr } = await supabase
    .from('zidni_waitlist')
    .insert({ name, email, whatsapp, country, niche });
  if (dbErr) {
    if (dbErr.code === '23505') return res.status(409).json({ error: 'This email is already on the waitlist.' });
    return res.status(500).json({ error: 'Failed to save. Please try again.' });
  }

  try {
    await sgMail.send({
      to: email,
      from: { email: 'yousef@joinzidni.com', name: 'Zidni' },
      subject: "You're on the Zidni waitlist 🎉",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#050d1a;color:#f0f4f8;padding:40px 32px;border-radius:16px;">
          <div style="margin-bottom:32px;">
            <span style="background:#c9a84c;color:#050d1a;font-weight:800;font-size:16px;padding:6px 14px;border-radius:8px;">Zidni</span>
          </div>
          <h1 style="font-size:28px;font-weight:800;margin:0 0 16px;letter-spacing:-0.5px;">You're in${name ? ', ' + name : ''}.</h1>
          <p style="font-size:15px;color:#8896a8;line-height:1.6;margin:0 0 24px;">
            We've added you to our waitlist. We onboard a limited number of members each month — you'll hear from us when your spot is ready.
          </p>
          <div style="background:#0a1628;border:1px solid rgba(201,168,76,0.2);border-radius:12px;padding:24px;margin-bottom:32px;">
            <p style="font-size:13px;font-weight:600;color:#c9a84c;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">What happens next</p>
            <ul style="font-size:14px;color:#8896a8;line-height:1.8;margin:0;padding-left:18px;">
              <li>We review your application</li>
              <li>We reach out to confirm your niche and tier</li>
              <li>We build and launch your 6 income streams</li>
              <li>You start earning</li>
            </ul>
          </div>
          <p style="font-size:13px;color:#4a5568;">© 2026 Zidni. All rights reserved.</p>
        </div>
      `,
    });
  } catch (_) {
    // confirmation email failure is non-fatal
  }

  res.json({ ok: true });
});

// ── Zidni client auth middleware ───────────────────────────
const verifyZidniToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth required.' });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    if (decoded.role !== 'zidni_client') return res.status(403).json({ error: 'Access denied.' });
    req.zidniClient = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

app.get('/zidni/client/me', verifyZidniToken, async (req, res) => {
  const { id } = req.zidniClient;
  const [clientRes, notifsRes] = await Promise.all([
    supabase.from('zidni_clients').select('id,name,email,tier,niche,status,whatsapp,country,referral_code,payout_email,payout_method,joined_at').eq('id', id).single(),
    supabase.from('zidni_notifications').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  if (clientRes.error) return res.status(404).json({ error: 'Client not found.' });
  res.json({ client: clientRes.data, notifications: notifsRes.data || [] });
});

app.get('/zidni/client/earnings', verifyZidniToken, async (req, res) => {
  const { id } = req.zidniClient;
  const [earningsRes, payoutsRes] = await Promise.all([
    supabase.from('zidni_earnings').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(6),
    supabase.from('zidni_payouts').select('amount').eq('client_id', id).eq('status', 'completed'),
  ]);
  const earnings = earningsRes.data || [];
  const thisMonth = earnings[0] || null;
  const totalEarned = earnings.reduce((s, e) => s + (e.total || 0), 0);
  const totalPaid = (payoutsRes.data || []).reduce((s, p) => s + (p.amount || 0), 0);
  const availableBalance = Math.max(0, totalEarned - totalPaid);
  res.json({ earnings, thisMonth, availableBalance });
});

app.get('/zidni/client/pools', verifyZidniToken, async (req, res) => {
  const { id } = req.zidniClient;
  const { data, error } = await supabase
    .from('zidni_client_spots')
    .select('id,spots,multiplier,created_at,zidni_pools(id,niche,name,max_spots,current_spots,status,monthly_revenue)')
    .eq('client_id', id);
  if (error) return res.status(500).json({ error: 'Failed to fetch pools.' });
  const pools = (data || []).map(row => ({
    spot_id: row.id,
    spots: row.spots,
    multiplier: row.multiplier,
    created_at: row.created_at,
    pool: row.zidni_pools,
  }));
  res.json({ pools });
});

app.get('/zidni/client/streams', verifyZidniToken, async (req, res) => {
  const { id } = req.zidniClient;
  const { data, error } = await supabase
    .from('zidni_personal_streams')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch streams.' });
  res.json({ streams: data || [] });
});

app.post('/zidni/client/request-payout', verifyZidniToken, async (req, res) => {
  const { id } = req.zidniClient;
  const [earningsRes, payoutsRes] = await Promise.all([
    supabase.from('zidni_earnings').select('total').eq('client_id', id),
    supabase.from('zidni_payouts').select('amount').eq('client_id', id).eq('status', 'completed'),
  ]);
  const totalEarned = (earningsRes.data || []).reduce((s, e) => s + (e.total || 0), 0);
  const totalPaid = (payoutsRes.data || []).reduce((s, p) => s + (p.amount || 0), 0);
  const available = Math.max(0, totalEarned - totalPaid);
  if (available <= 0) return res.status(400).json({ error: 'No balance available for payout.' });
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const { data: payout, error: payoutErr } = await supabase
    .from('zidni_payouts')
    .insert({ client_id: id, amount: available, month, status: 'pending' })
    .select()
    .single();
  if (payoutErr) return res.status(500).json({ error: 'Failed to create payout request.' });
  res.json({ ok: true, payout });
});

// ── Zidni owner auth middleware ────────────────────────────
const verifyZidniOwner = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user?.role !== 'owner') return res.status(403).json({ error: 'Owner access required.' });
    next();
  });
};

app.get('/zidni/owner/stats', verifyZidniOwner, async (req, res) => {
  const [totalRes, starterRes, eliteRes, poolRes, payoutRes, waitlistRes] = await Promise.all([
    supabase.from('zidni_clients').select('id', { count: 'exact', head: true }),
    supabase.from('zidni_clients').select('id', { count: 'exact', head: true }).eq('tier', 'starter'),
    supabase.from('zidni_clients').select('id', { count: 'exact', head: true }).eq('tier', 'elite'),
    supabase.from('zidni_pools').select('id', { count: 'exact', head: true }),
    supabase.from('zidni_payouts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('zidni_waitlist').select('id', { count: 'exact', head: true }),
  ]);
  const starter = starterRes.count || 0;
  const elite   = eliteRes.count || 0;
  res.json({
    totalClients:   totalRes.count || 0,
    byTier:         { starter, elite },
    mrr:            starter * 100 + elite * 200,
    totalPools:     poolRes.count || 0,
    pendingPayouts: payoutRes.count || 0,
    waitlistCount:  waitlistRes.count || 0,
  });
});

app.get('/zidni/owner/clients', verifyZidniOwner, async (req, res) => {
  const { data, error } = await supabase
    .from('zidni_clients')
    .select('id,name,email,tier,niche,status,whatsapp,country,referral_code,joined_at')
    .order('joined_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch clients.' });
  res.json({ clients: data || [] });
});

app.get('/zidni/owner/pools', verifyZidniOwner, async (req, res) => {
  const { data, error } = await supabase
    .from('zidni_pools')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch pools.' });
  res.json({ pools: data || [] });
});

app.post('/zidni/owner/pools', verifyZidniOwner, async (req, res) => {
  const { niche, name, max_spots } = req.body;
  if (!niche || !name) return res.status(400).json({ error: 'niche and name are required.' });
  const { data: pool, error } = await supabase
    .from('zidni_pools')
    .insert({ niche, name, max_spots: max_spots || 100, status: 'building' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to create pool.' });
  res.json({ pool });
});

app.post('/zidni/owner/revenue', verifyZidniOwner, async (req, res) => {
  const { pool_id, month, etsy = 0, gumroad = 0, kdp = 0, pinterest = 0, affiliate = 0, shopify = 0 } = req.body;
  if (!pool_id || !month) return res.status(400).json({ error: 'pool_id and month are required.' });

  const poolTotal = [etsy, gumroad, kdp, pinterest, affiliate, shopify].reduce((s, v) => s + (parseFloat(v) || 0), 0);

  // Upsert pool revenue record
  await supabase.from('zidni_pool_revenue').upsert(
    { pool_id, month, etsy: parseFloat(etsy) || 0, gumroad: parseFloat(gumroad) || 0, kdp: parseFloat(kdp) || 0, pinterest: parseFloat(pinterest) || 0, affiliate: parseFloat(affiliate) || 0, shopify: parseFloat(shopify) || 0, total: poolTotal },
    { onConflict: 'pool_id,month' }
  );

  // Update pool's monthly_revenue snapshot
  await supabase.from('zidni_pools').update({ monthly_revenue: poolTotal }).eq('id', pool_id);

  // Get all client spots for this pool
  const { data: spots } = await supabase
    .from('zidni_client_spots')
    .select('client_id, spots, multiplier')
    .eq('pool_id', pool_id);

  if (!spots || spots.length === 0) return res.json({ ok: true, poolTotal, month, distributions: [] });

  const totalWeight = spots.reduce((s, cs) => s + (cs.spots * cs.multiplier), 0);

  // Fetch client names + existing earnings for this month in parallel
  const clientIds = spots.map(cs => cs.client_id);
  const [clientsRes, existingRes] = await Promise.all([
    supabase.from('zidni_clients').select('id,name').in('id', clientIds),
    supabase.from('zidni_earnings').select('client_id,personal_etsy,personal_gumroad,personal_kdp,personal_affiliate,personal_shopify,personal_redbubble').eq('month', month).in('client_id', clientIds),
  ]);

  const nameMap     = {};
  const existingMap = {};
  (clientsRes.data || []).forEach(c => { nameMap[c.id] = c.name; });
  (existingRes.data || []).forEach(e => { existingMap[e.client_id] = e; });

  // Build earnings rows
  const earningsRows = spots.map(cs => {
    const poolShare    = totalWeight > 0 ? Math.round((cs.spots * cs.multiplier / totalWeight) * poolTotal * 100) / 100 : 0;
    const ex           = existingMap[cs.client_id] || {};
    const personalSum  = (ex.personal_etsy || 0) + (ex.personal_gumroad || 0) + (ex.personal_kdp || 0) + (ex.personal_affiliate || 0) + (ex.personal_shopify || 0) + (ex.personal_redbubble || 0);
    return {
      client_id:          cs.client_id,
      month,
      pool_share:         poolShare,
      personal_etsy:      ex.personal_etsy      || 0,
      personal_gumroad:   ex.personal_gumroad   || 0,
      personal_kdp:       ex.personal_kdp       || 0,
      personal_affiliate: ex.personal_affiliate || 0,
      personal_shopify:   ex.personal_shopify   || 0,
      personal_redbubble: ex.personal_redbubble || 0,
      total:              Math.round((poolShare + personalSum) * 100) / 100,
    };
  });

  await supabase.from('zidni_earnings').upsert(earningsRows, { onConflict: 'client_id,month' });

  // Send notifications
  const notifRows = earningsRows.map(e => ({
    client_id: e.client_id,
    title:     `${month} earnings posted`,
    message:   `Your pool share for ${month} is $${e.pool_share.toFixed(2)}. Total earnings: $${e.total.toFixed(2)}.`,
  }));
  await supabase.from('zidni_notifications').insert(notifRows);

  const distributions = earningsRows.map(e => ({ client_id: e.client_id, name: nameMap[e.client_id] || e.client_id, pool_share: e.pool_share }));
  res.json({ ok: true, poolTotal, month, distributions });
});

app.get('/zidni/owner/payouts', verifyZidniOwner, async (req, res) => {
  const { data, error } = await supabase
    .from('zidni_payouts')
    .select('*,zidni_clients(name,email,payout_method,payout_email)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch payouts.' });
  res.json({ payouts: data || [] });
});

app.post('/zidni/owner/payouts/:id/approve', verifyZidniOwner, async (req, res) => {
  const { id } = req.params;
  const { data: payout, error } = await supabase
    .from('zidni_payouts')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to approve payout.' });
  res.json({ payout });
});

app.get('/zidni/owner/waitlist', verifyZidniOwner, async (req, res) => {
  const { data, error } = await supabase
    .from('zidni_waitlist')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch waitlist.' });
  res.json({ waitlist: data || [] });
});

// ─── ZIDNI MAHDI — Knowledge Base & Content Automation ───────────────────────

app.get('/zidni/mahdi/knowledge-base', verifyZidniOwner, async (req, res) => {
  const { data, error } = await supabase
    .from('zidni_knowledge_base')
    .select('*')
    .order('niche');
  if (error) return res.status(500).json({ error: 'Failed to load knowledge base.' });
  res.json({ knowledge_base: data || [] });
});

app.post('/zidni/mahdi/knowledge-base', verifyZidniOwner, async (req, res) => {
  const { niche, target_audience, top_products, affiliate_programs, content_hooks, forbidden_phrases, full_document } = req.body;
  if (!niche) return res.status(400).json({ error: 'Niche is required.' });

  const { data, error } = await supabase
    .from('zidni_knowledge_base')
    .upsert(
      { niche, target_audience, top_products, affiliate_programs, content_hooks, forbidden_phrases, full_document: full_document || null, updated_at: new Date().toISOString() },
      { onConflict: 'niche', ignoreDuplicates: false }
    )
    .select()
    .single();

  console.log('[Mahdi KB] niche:', niche, 'error:', error, 'data:', data);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ entry: data });
});

const ZIDNI_STREAM_SCHEMAS = {
  etsy: 'title (catchy SEO-optimized product title), description (150-200 word listing description), tags (array of 13 tags), price_range (e.g. "$5-15")',
  kdp: 'title (compelling book title), subtitle (clarifying subtitle), chapters (array of 8-10 chapter titles), keywords (array of 7 Amazon keywords)',
  gumroad: 'title (product name), tagline (one sentence hook under 15 words), description (100-150 word sales description), suggested_price (e.g. "$27")',
  pinterest: 'title (pin title under 100 chars), description (pin description with 2-3 hashtags), board_suggestion (board name), cta (call-to-action text)',
  affiliate: 'title (content piece title), angle (unique positioning angle), content_hook (opening hook sentence), cta (affiliate CTA), programs (array of 2-3 suggested affiliate program names)',
  shopify: 'title (product name), description (100-word product description), features (array of 4-5 bullet points), tags (array of 8 tags)',
  redbubble: 'title (design collection title), concept (visual concept description in 2 sentences), description (50-word marketplace description), tags (array of 15 tags)',
};

const ZIDNI_STREAM_LABELS = {
  etsy: 'Etsy digital product listings',
  kdp: 'Kindle Direct Publishing book concepts',
  gumroad: 'Gumroad digital product ideas',
  pinterest: 'Pinterest pin descriptions',
  affiliate: 'affiliate content pieces',
  shopify: 'Shopify product descriptions',
  redbubble: 'Redbubble design concepts',
};

app.post('/zidni/mahdi/generate', verifyZidniOwner, async (req, res) => {
  const { niche, stream, qty = 5 } = req.body;
  if (!niche || !stream) return res.status(400).json({ error: 'niche and stream are required.' });
  const count = Math.min(Math.max(parseInt(qty) || 5, 1), 10);

  const [{ data: kbData }, { data: winnerData }] = await Promise.all([
    supabase.from('zidni_knowledge_base').select('*').eq('niche', niche).maybeSingle(),
    supabase.from('zidni_mahdi_winner_kb').select('*').eq('niche', niche).maybeSingle(),
  ]);

  const schema = ZIDNI_STREAM_SCHEMAS[stream] || 'title, description';
  const streamLabel = ZIDNI_STREAM_LABELS[stream] || stream;

  const systemPrompt = `You are Mahdi, Zidni's elite passive income content strategist. You generate professional, market-winning content for ${streamLabel}. You have deep expertise in passive income psychology, SEO, marketplace algorithms, and buyer behavior.

WINNER SCORECARD STANDARD (63/70 minimum to pass):
Every product you generate must score 63 or above across these 7 dimensions (each scored 1–10):
1. Problem Specificity — targets a concrete, felt pain not a vague topic
2. Transformation Clarity — the before/after is unmistakable from the title alone
3. Identity Match — speaks to who the buyer believes (or wants to believe) they are
4. Emotional Pain Intensity — taps high-intensity emotions: fear, urgency, or financial stress
5. SEO Keyword Depth — primary and secondary keywords embedded naturally
6. Competition Gap — fills a gap competitors are missing or doing poorly
7. Professional Completeness — a complete, ready-to-sell product, not an average template

GENERATION RULES:
- Target identity communities with high emotional pain scores — they buy fastest
- Every product must have a clear transformation statement (from X to Y in Z without W)
- Never produce average templates — produce professional, complete, battle-tested products
- Use the full knowledge base documents as primary context; they override generic assumptions

You only respond with valid JSON arrays — no markdown, no explanation, just the raw JSON array.`;

  const kbDocBlock = kbData?.full_document ? `=== FULL KNOWLEDGE BASE DOCUMENT ===\n${kbData.full_document}\n=== END ===\n\n` : '';
  const winnerDocBlock = winnerData?.full_document ? `=== WINNER KB DOCUMENT ===\n${winnerData.full_document}\n=== END ===\n\n` : '';

  const kbBlock = kbData ? `Core Knowledge Base:
- Target Audience: ${kbData.target_audience || 'N/A'}
- Top Products: ${kbData.top_products || 'N/A'}
- Affiliate Programs: ${kbData.affiliate_programs || 'N/A'}
- Content Hooks: ${kbData.content_hooks || 'N/A'}
- Forbidden Phrases: ${kbData.forbidden_phrases || 'None'}` : '';

  const winnerBlock = winnerData ? `Winner Intelligence:
- Community: FB: ${winnerData.community_facebook || 'N/A'} | Reddit: ${winnerData.community_reddit || 'N/A'} | YouTube: ${winnerData.community_youtube || 'N/A'}
- Community Language: ${winnerData.community_language || 'N/A'}
- Pain Phrases: ${winnerData.community_pain_phrases || 'N/A'}
- Pain Scores — Fear: ${winnerData.emotional_pain_fear ?? 'N/A'}/10 | Stress: ${winnerData.emotional_pain_stress ?? 'N/A'}/10 | Urgency: ${winnerData.emotional_pain_urgency ?? 'N/A'}/10 | Financial: ${winnerData.emotional_pain_financial ?? 'N/A'}/10 | Identity: ${winnerData.emotional_pain_identity ?? 'N/A'}/10
- Transformation: ${winnerData.transformation_statement || 'N/A'}
- Primary Keyword: ${winnerData.keyword_primary || 'N/A'} | Secondary: ${winnerData.keyword_secondary || 'N/A'}
- Competition Gap: ${winnerData.competition_gap || 'N/A'}
- Pricing Sweet Spot: ${winnerData.pricing_sweet_spot || 'N/A'}
- Seasonal Timing: ${winnerData.seasonal_timing || 'N/A'}
- Series Strategy: ${winnerData.series_strategy || 'N/A'}
- Scale Methods: ${winnerData.scale_methods || 'N/A'}
- Forbidden Concepts: ${winnerData.forbidden_concepts || 'None'}` : '';

  const fallback = !kbData && !winnerData ? `No knowledge base saved for "${niche}" yet — apply best passive income practices and produce winner-standard content.` : '';

  const userPrompt = `Generate ${count} market-winning ${streamLabel} for the "${niche}" niche. Every item must pass the 63/70 winner scorecard.

${kbDocBlock}${winnerDocBlock}${[kbBlock, winnerBlock, fallback].filter(Boolean).join('\n\n')}

Each item in the array must have these exact fields: ${schema}

You MUST respond with ONLY a valid JSON array. No markdown. No backticks. No explanation. Start your response with [ and end with ]. Nothing before or after the array.`;

  try {
    const aiRes = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });

    const raw = aiRes.data.content[0].text.trim();
    let items;
    try {
      items = JSON.parse(raw);
    } catch {
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        try {
          items = JSON.parse(raw.slice(start, end + 1));
        } catch {
          console.error('[Mahdi Generate] JSON parse failed. Raw response:', raw);
          return res.status(500).json({ error: 'Failed to parse AI response as JSON.', raw: raw.slice(0, 500) });
        }
      } else {
        console.error('[Mahdi Generate] No JSON array found in response. Raw response:', raw);
        return res.status(500).json({ error: 'AI did not return a valid array.', raw: raw.slice(0, 500) });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(500).json({ error: 'AI returned an empty result.' });
    }

    const rows = items.map(item => {
      // Guard against malformed array elements (e.g. a bare string) so the
      // jsonb `content` column always receives an object.
      const obj = (item && typeof item === 'object' && !Array.isArray(item)) ? item : { value: item };
      return {
        niche,
        stream,
        title: obj.title || null,
        content: obj,
        status: 'pending',
      };
    });

    console.log(`[Mahdi Generate] Inserting ${rows.length} row(s) into zidni_content_queue (niche="${niche}", stream="${stream}"). First row column keys:`, Object.keys(rows[0] || {}));

    const { data: inserted, error: insertError } = await supabase
      .from('zidni_content_queue')
      .insert(rows)
      .select();

    if (insertError) {
      console.error('[Mahdi Generate] Supabase insert error:', JSON.stringify({
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      }));
      console.error('[Mahdi Generate] First row that failed to insert:', JSON.stringify(rows[0]));
      return res.status(500).json({
        error: insertError.message || 'Failed to save generated content.',
        details: insertError.details || null,
        hint: insertError.hint || null,
        code: insertError.code || null,
      });
    }
    console.log(`[Mahdi Generate] Successfully inserted ${inserted.length} item(s) into zidni_content_queue.`);
    res.json({ items: inserted, count: inserted.length });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message || 'Generation failed.';
    res.status(500).json({ error: msg });
  }
});

app.get('/zidni/mahdi/queue', verifyZidniOwner, async (req, res) => {
  const { status, niche, stream } = req.query;
  let q = supabase
    .from('zidni_content_queue')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (niche) q = q.eq('niche', niche);
  if (stream) q = q.eq('stream', stream);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: 'Failed to fetch queue.' });
  res.json({ items: data || [] });
});

app.post('/zidni/mahdi/approve/:id', verifyZidniOwner, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('zidni_content_queue')
    .update({ status: 'approved' })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to approve item.' });
  res.json({ item: data });
});

app.post('/zidni/mahdi/reject/:id', verifyZidniOwner, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('zidni_content_queue')
    .update({ status: 'rejected' })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: 'Failed to reject item.' });
  res.json({ item: data });
});

// Generate a 1280x720 product cover PNG for a Zidni product. Returns a PNG
// Buffer, or null if the canvas package is unavailable or rendering fails —
// callers treat the thumbnail as best-effort and must not block on it.
function generateZidniThumbnail({ name, niche, priceLabel }) {
  let createCanvas;
  try {
    ({ createCanvas } = require('canvas'));
  } catch (e) {
    console.error('[Mahdi Auto-Publish] canvas package unavailable:', e.message);
    return null;
  }
  try {
    const W = 1280, H = 720;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background — dark navy.
    ctx.fillStyle = '#0A1628';
    ctx.fillRect(0, 0, W, H);

    // Gold accent bar across the top (8px).
    ctx.fillStyle = '#C9A84C';
    ctx.fillRect(0, 0, W, 8);

    // Niche badge — gold pill with navy text, centered near the top.
    const nicheText = (niche || '').toString().trim();
    if (nicheText) {
      ctx.font = 'bold 22px sans-serif';
      const label = nicheText.toUpperCase();
      const padX = 26, badgeH = 46;
      const badgeW = ctx.measureText(label).width + padX * 2;
      const badgeX = (W - badgeW) / 2;
      const badgeY = 120;
      const r = badgeH / 2;
      ctx.fillStyle = '#C9A84C';
      ctx.beginPath();
      ctx.moveTo(badgeX + r, badgeY);
      ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r);
      ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r);
      ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r);
      ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0A1628';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, W / 2, badgeY + badgeH / 2 + 1);
    }

    // Product name — white bold, centered, word-wrapped to a max of 2 lines.
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = W - 200;
    const words = (name || 'Untitled Product').toString().split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
        if (lines.length === 2) { current = ''; break; }
      } else {
        current = test;
      }
    }
    if (current && lines.length < 2) lines.push(current);
    // Add an ellipsis if the name overflowed two lines.
    if (lines.length === 2 && current && words.length) {
      let last = lines[1];
      while (last && ctx.measureText(last + '…').width > maxWidth) {
        last = last.replace(/\s*\S*$/, '');
      }
      lines[1] = (last || lines[1]) + '…';
    }
    const lineHeight = 56;
    const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * lineHeight));

    // Price — gold, bottom left.
    if (priceLabel) {
      ctx.fillStyle = '#C9A84C';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(priceLabel, 60, H - 52);
    }

    // Branding — gray, bottom right.
    ctx.fillStyle = '#8896A8';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('joinzidni.com', W - 60, H - 52);

    return canvas.toBuffer('image/png');
  } catch (e) {
    console.error('[Mahdi Auto-Publish] Thumbnail render failed:', e.message);
    return null;
  }
}

// Generate a professional A4 product PDF for a Zidni product. Resolves to a
// PDF Buffer, or null if pdfkit is unavailable or rendering fails — callers
// treat the PDF as best-effort and must not block on it.
function generateZidniPDF({ name, tagline, description }) {
  return new Promise((resolve) => {
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (e) {
      console.error('[Mahdi Auto-Publish] pdfkit package unavailable:', e.message);
      return resolve(null);
    }
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (e) => {
        console.error('[Mahdi Auto-Publish] PDF stream error:', e.message);
        resolve(null);
      });

      const W = doc.page.width;
      const H = doc.page.height;
      const M = 50;
      const headerH = 120;

      // Navy header bar with the product title in white bold text.
      doc.rect(0, 0, W, headerH).fill('#0A1628');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24)
        .text(name || 'Untitled Product', M, 44, { width: W - M * 2 });

      // Gold accent line directly below the header.
      doc.rect(0, headerH, W, 4).fill('#C9A84C');

      let y = headerH + 40;

      // Tagline — italic gray.
      if (tagline) {
        doc.fillColor('#8896A8').font('Helvetica-Oblique').fontSize(14)
          .text(tagline, M, y, { width: W - M * 2 });
        y = doc.y + 24;
      }

      // Description — clean body text.
      doc.fillColor('#0A1628').font('Helvetica').fontSize(12)
        .text(description || '', M, y, { width: W - M * 2, lineGap: 4 });

      // Footer branding.
      doc.fillColor('#8896A8').font('Helvetica').fontSize(10)
        .text('joinzidni.com', M, H - 50, { width: W - M * 2, align: 'center' });

      doc.end();
    } catch (e) {
      console.error('[Mahdi Auto-Publish] PDF generation failed:', e.message);
      resolve(null);
    }
  });
}

// Auto-publish a generated product to Gumroad, then mark it published in the queue.
app.post('/zidni/mahdi/auto-publish', verifyZidniOwner, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required.' });

  // GUMROAD_API_KEY is a required environment variable for this endpoint.
  if (!process.env.GUMROAD_API_KEY) {
    return res.status(400).json({ error: 'Gumroad API key not configured.' });
  }

  // 1. Pull the generated product from the queue.
  const { data: item, error: fetchError } = await supabase
    .from('zidni_content_queue')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError || !item) return res.status(404).json({ error: 'Queue item not found.' });

  // Derive Gumroad product fields from the generated content.
  const content = item.content || {};
  console.log('[Mahdi Auto-Publish] Content fields:', JSON.stringify(content));
  const name = item.title || content.title || 'Untitled Product';
  const description = content.description || content.summary || content.body || '';

  // Extract a numeric price from the generated content. The price may live in
  // several fields and be formatted as "$27", "27", "$5-15", etc., so strip
  // any currency symbols/text and parse the first number found.
  const extractPrice = (...vals) => {
    for (const v of vals) {
      if (v == null) continue;
      const match = String(v).replace(/,/g, '').match(/\d+(\.\d+)?/);
      if (match) {
        const n = parseFloat(match[0]);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return 0;
  };
  const dollars = extractPrice(
    content.suggested_price,
    content.price,
    content.pricing,
    content.price_sweet_spot,
    content.pricing_sweet_spot,
    content.price_range,
  );
  // Default to $27 (2700 cents) when no valid price is found in the content.
  const priceCents = dollars > 0 ? Math.round(dollars * 100) : 2700;

  // Generate the product cover image up front (best-effort — never blocks).
  const priceLabel = '$' + (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
  const thumbnailBuffer = generateZidniThumbnail({ name, niche: item.niche, priceLabel });
  console.log('[Mahdi Auto-Publish] Thumbnail generated:', thumbnailBuffer ? `${thumbnailBuffer.length} bytes` : 'failed/skipped');

  // Generate the downloadable product PDF up front (best-effort — never blocks).
  const tagline = content.tagline || content.subtitle || content.hook || '';
  const pdfBuffer = await generateZidniPDF({ name, tagline, description });
  console.log('[Mahdi Auto-Publish] PDF generated:', pdfBuffer ? `${pdfBuffer.length} bytes` : 'failed/skipped');

  try {
    // 2. Publish to Gumroad via the Gumroad API. Gumroad expects
    // form-encoded params with access_token passed as a field, not a header.
    const form = new URLSearchParams({
      access_token: process.env.GUMROAD_API_KEY,
      name,
      description,
      price: String(priceCents),
      published: 'true',
    });

    console.log('[Mahdi Auto-Publish] Sending to Gumroad:', { name, priceCents, published: true });

    const gumRes = await axios.post('https://api.gumroad.com/v2/products', form, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    console.log('[Mahdi Auto-Publish] Gumroad create response:', JSON.stringify(gumRes.data));

    const product = gumRes.data?.product || {};
    const gumroadId = product.permalink || product.id || null;
    const publishedUrl = product.short_url || product.preview_url || null;

    // 2b. Upload the generated cover image as the product thumbnail. Best-effort:
    // any failure is logged but must not block the publish.
    if (product.id && thumbnailBuffer) {
      try {
        const FormData = require('form-data');
        const imgForm = new FormData();
        imgForm.append('access_token', process.env.GUMROAD_API_KEY);
        imgForm.append('preview_url', thumbnailBuffer, { filename: 'cover.png', contentType: 'image/png' });
        imgForm.append('thumbnail', thumbnailBuffer, { filename: 'cover.png', contentType: 'image/png' });
        await axios.put(`https://api.gumroad.com/v2/products/${product.id}`, imgForm, {
          headers: imgForm.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });
      } catch (thumbErr) {
        console.error('[Mahdi Auto-Publish] Thumbnail upload failed:', thumbErr.response?.data?.message || thumbErr.message);
      }
    }

    // 2c. Upload the generated PDF as the product's downloadable file. Best-effort:
    // any failure is logged but must not block the publish.
    if (product.permalink && pdfBuffer) {
      try {
        const FormData = require('form-data');
        const safeTitle = (name || 'product').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'product';
        const fileForm = new FormData();
        fileForm.append('access_token', process.env.GUMROAD_API_KEY);
        fileForm.append('file', pdfBuffer, { filename: `${safeTitle}.pdf`, contentType: 'application/pdf' });
        console.log(`[Mahdi Auto-Publish] Uploading PDF file (${pdfBuffer.length} bytes) to product ${product.permalink}...`);
        await axios.post(`https://api.gumroad.com/v2/products/${product.permalink}/files`, fileForm, {
          headers: fileForm.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });
        console.log('[Mahdi Auto-Publish] PDF file uploaded successfully.');
      } catch (fileErr) {
        console.error('[Mahdi Auto-Publish] PDF file upload failed:', fileErr.response?.data?.message || fileErr.message);
      }
    }

    // 2d. Enable/publish the product now that it has a file attached. Best-effort.
    if (product.permalink) {
      try {
        const enableForm = new URLSearchParams({
          access_token: process.env.GUMROAD_API_KEY,
          published: 'true',
          price: String(priceCents),
        });
        console.log(`[Mahdi Auto-Publish] Enabling product ${product.permalink} (price ${priceCents}, published true)...`);
        await axios.put(`https://api.gumroad.com/v2/products/${product.permalink}`, enableForm, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        console.log('[Mahdi Auto-Publish] Product enabled/published.');
      } catch (enableErr) {
        console.error('[Mahdi Auto-Publish] Failed to enable product:', enableErr.response?.data?.message || enableErr.message);
      }
    }

    // 3. Update the queue record with published status + Gumroad refs.
    const { data: updated, error: updateError } = await supabase
      .from('zidni_content_queue')
      .update({ status: 'published', gumroad_id: gumroadId, published_url: publishedUrl })
      .eq('id', id)
      .select()
      .single();
    if (updateError) {
      console.error('[Mahdi Auto-Publish] Supabase update error:', JSON.stringify(updateError));
      return res.status(500).json({ error: 'Published to Gumroad but failed to update the queue.' });
    }

    res.json({ item: updated, gumroad_id: gumroadId, published_url: publishedUrl });
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Gumroad publish failed.';
    console.error('[Mahdi Auto-Publish] Gumroad error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ─── ZIDNI MAHDI — Winner KB ────────────────────────────────────────────────

app.get('/zidni/mahdi/winner-kb', verifyZidniOwner, async (req, res) => {
  const { data, error } = await supabase
    .from('zidni_mahdi_winner_kb')
    .select('*')
    .order('niche');
  if (error) return res.status(500).json({ error: 'Failed to load winner KB.' });
  res.json({ winner_kb: data || [] });
});

app.post('/zidni/mahdi/winner-kb', verifyZidniOwner, async (req, res) => {
  const {
    niche, community_facebook, community_reddit, community_youtube,
    community_language, community_pain_phrases,
    emotional_pain_fear, emotional_pain_stress, emotional_pain_urgency,
    emotional_pain_financial, emotional_pain_identity,
    transformation_statement, keyword_primary, keyword_secondary,
    competition_gap, pricing_sweet_spot, seasonal_timing,
    series_strategy, scale_methods, forbidden_concepts, full_document,
  } = req.body;
  if (!niche) return res.status(400).json({ error: 'Niche is required.' });

  const parseScore = (v) => (v != null && v !== '' ? parseInt(v) : null);

  const { data, error } = await supabase
    .from('zidni_mahdi_winner_kb')
    .upsert({
      niche,
      community_facebook: community_facebook || null,
      community_reddit: community_reddit || null,
      community_youtube: community_youtube || null,
      community_language: community_language || null,
      community_pain_phrases: community_pain_phrases || null,
      emotional_pain_fear: parseScore(emotional_pain_fear),
      emotional_pain_stress: parseScore(emotional_pain_stress),
      emotional_pain_urgency: parseScore(emotional_pain_urgency),
      emotional_pain_financial: parseScore(emotional_pain_financial),
      emotional_pain_identity: parseScore(emotional_pain_identity),
      transformation_statement: transformation_statement || null,
      keyword_primary: keyword_primary || null,
      keyword_secondary: keyword_secondary || null,
      competition_gap: competition_gap || null,
      pricing_sweet_spot: pricing_sweet_spot || null,
      seasonal_timing: seasonal_timing || null,
      series_strategy: series_strategy || null,
      scale_methods: scale_methods || null,
      forbidden_concepts: forbidden_concepts || null,
      full_document: full_document || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'niche' })
    .select()
    .single();
  if (error) {
    console.error('[WinnerKB] Supabase error:', JSON.stringify(error));
    return res.status(500).json({ error: error.message, code: error.code, details: error.details });
  }
  res.json({ entry: data });
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('Scheduler active — checking workflow steps every 15 minutes');
});

// ─── PROCESS ERROR HANDLERS ───────────────────────────────
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] uncaughtException — ${err.message}`);
  console.error(err.stack);
  logError(err, 'uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error(`[${new Date().toISOString()}] unhandledRejection — ${msg}`);
  if (reason instanceof Error) console.error(reason.stack);
  logError(reason instanceof Error ? reason : new Error(msg), 'unhandledRejection');
});
