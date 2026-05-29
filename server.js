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

const JWT_SECRET = process.env.JWT_SECRET || 'salesscales-jwt-secret-change-in-production';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// ─── RATE LIMITING ────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI team rate limit exceeded. Maximum 20 requests per 15 minutes.' },
});

const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Import rate limit exceeded. Maximum 5 imports per hour.' },
});

app.use(generalLimiter);

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

    if (top5.length > 0) {
      return top5.map(r => `${r.title}:\n${r.content?.substring(0, 800)}`).join('\n\n');
    }
  } catch (e) {
    console.log('RAG search skipped:', e.message);
  }
  return '';
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

// ─── HELPER: BRANDED HTML EMAIL TEMPLATE ─────────────────
const buildEmailHtml = (content, clientName, subject) => {
  const safe = (content || '').trim();
  const bodyHtml = safe
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const brand = clientName || 'Sales Scales';
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0f3f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f3f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(10,22,40,0.08);">
        <tr><td style="background:#0a1628;padding:28px 32px;">
          <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">${brand}</div>
          <div style="width:32px;height:2px;background:#c9a84c;border-radius:1px;margin-top:10px;"></div>
        </td></tr>
        ${subject ? `<tr><td style="padding:28px 32px 0;"><div style="color:#0a1628;font-size:19px;font-weight:700;line-height:1.3;">${subject}</div></td></tr>` : ''}
        <tr><td style="padding:24px 32px 32px;">${bodyHtml}</td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e4e9f0;padding:20px 32px;">
          <div style="color:#8896a8;font-size:11px;line-height:1.6;">Sent by ${brand} via Sales Scales — AI Revenue System.</div>
          <div style="color:#c4ccd6;font-size:10px;margin-top:6px;">© ${year} ${brand}. All rights reserved.</div>
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

// ─── HELPER: ENROLL CONTACT IN WORKFLOW ──────────────────
const enrollContactInWorkflow = async (workflowId, contactId, clientId, contactEmail, contactPhone, contactName) => {
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
  const { data: connection } = await supabase
    .from('shopify_connections').select('*').eq('shop', shop).single();
  if (!connection) { console.log('No Shopify connection for shop:', shop); return; }

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
    const { data: newContact } = await supabase.from('contacts').insert([{
      first_name: customerData.first_name || '',
      last_name: customerData.last_name || '',
      email: customerData.email,
      phone: customerData.phone || customerData.default_address?.phone || '',
      source: 'Shopify', channel: 'Email',
      pipeline_stage: 'New Lead',
      client_id: clientId,
      shopify_customer_id: customerData.id?.toString() || null,
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

  console.log(`Webhook processed: ${contact.email} → ${triggerType} → ${workflow.name}`);
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

      const cartLink = await getClientCartLink(enrollment.client_id);

      if (currentStep.step_type === 'wait') {
        const nextStepAt = new Date();
        nextStepAt.setHours(nextStepAt.getHours() + (currentStep.wait_hours || 1));
        await supabase.from('workflow_enrollments').update({
          current_step: enrollment.current_step + 1,
          next_step_at: nextStepAt.toISOString()
        }).eq('id', enrollment.id);
        console.log(`Wait step processed for ${contact.first_name}`);

      } else if (currentStep.step_type === 'sms' && contact.phone && currentStep.content) {
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
          const emailSubject = renderTemplate(currentStep.subject || 'Message for you', contact, cartLink);
          await sgMail.send({
            to: contact.email,
            from: sender,
            subject: emailSubject,
            html: buildEmailHtml(renderTemplate(currentStep.content, contact, cartLink), sender.name, emailSubject)
          });
          console.log(`Email sent to ${contact.first_name} — step ${enrollment.current_step}`);
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
      }
    }
  } catch (e) {
    console.error('Scheduler error:', e.message);
  }
});

// ─── HELPER: STORE TEAM BRIEFING ─────────────────────────
const storeBriefing = async (from_member, to_member, subject, content, priority = 'normal', client_id = null) => {
  const { error } = await supabase.from('team_briefings').insert([{
    from_member, to_member, subject, content,
    priority, client_id, is_read: false,
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
      `You are Hussain, the Intelligence and Strategy AI at Sales Scales. You are sharp, data-driven, and think like a founder. You give direct, actionable insights with no fluff. You are Hussain — never mention Claude.`,
      `Generate a weekly intelligence briefing for Yousef. ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.\n\nClient performance this week:\n${summaryLines}\n\nTop performer: ${top.name} (${top.enrollments} enrollments)\nNeeds attention: ${bottom.name} (${bottom.enrollments} enrollments)\n\nWrite a briefing with these sections:\n1. TOP PERFORMER — what's working for ${top.name} and why\n2. NEEDS ATTENTION — specific issues with ${bottom.name} and immediate fixes\n3. WEEKLY PRIORITIES — 3 highest-impact actions Yousef should take this week\n4. MARKET INSIGHTS — 1–2 patterns or opportunities spotted across all clients\n\nBe direct, specific, no filler.`,
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
          status: 'pending',
          created_at: new Date().toISOString()
        }]);
        console.log(`[AUTO] Hussain→Mahdi sequences queued for ${client.name}`);
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

    const ZAINAB_TIER_FEE = { starter: 997, growth: 1997, scale: 3997, enterprise: 4997 };
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
          `Write a monthly performance report for ${client.name} (${client.niche || 'ecommerce'}) for ${period}.\n\nData:\n- Emails sent: ${emailsSent}\n- SMS sent: ${smsSent}\n- WhatsApp sent: ${whatsappSent}\n- New contacts: ${contactsAdded}\n- Workflow enrollments: ${enrollments}\n- Top sequence: ${topSequence}\n\n5 sections:\n1. MONTHLY OVERVIEW\n2. CHANNEL PERFORMANCE\n3. GROWTH & CONTACTS\n4. SEQUENCE PERFORMANCE\n5. RECOMMENDATIONS FOR NEXT MONTH\n\nBe specific, warm, actionable.`,
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
            : (ZAINAB_TIER_FEE[(client.tier || '').toLowerCase()] || 997);
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
      for (const p of (parsed.prospects || [])) {
        await supabase.from('approvals').insert([{
          type: 'prospect',
          title: `Prospect: ${p.name || (p.niche + ' store owner')}`,
          content: p.message || '',
          metadata: { prospect_name: p.name, niche: p.niche, channel: p.channel, pain_point: p.pain_point, subject: p.subject },
          from_member: 'hassan',
          client_id: null,
          status: 'pending',
          created_at: new Date().toISOString()
        }]);
      }
      console.log(`[AUTO] Hassan — ${(parsed.prospects || []).length} prospect(s) submitted for approval`);
    } catch (parseErr) {
      console.error('[AUTO] Hassan prospects parse error:', parseErr.message);
    }
  } catch (e) {
    console.error('[AUTO] Hassan daily error:', e.message);
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
app.post('/sms/inbound', async (req, res) => {
  const { From, Body } = req.body;
  console.log('Inbound SMS from:', From, '— Message:', Body);
  try {
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
      await supabase.from('workflow_enrollments')
        .update({ status: 'paused' })
        .eq('contact_id', contact.id)
        .eq('status', 'active');
      console.log('Inbound SMS saved and workflow paused for:', contact.first_name);
      const { data: smsClient } = await supabase.from('clients').select('name').eq('id', contact.client_id).maybeSingle();
      const smsAssessment = await assessInboundConfidence('SMS', Body, smsClient?.name);
      if (!smsAssessment.confident) {
        await storeBriefing('fatima', 'yousef',
          `Unhandled SMS from ${contact.first_name} ${contact.last_name || ''}`.trim(),
          `An inbound SMS needs your manual response — the AI could not respond confidently.\n\nReason: ${smsAssessment.reason}\nContact: ${contact.first_name} ${contact.last_name || ''} (${From})\nClient: ${smsClient?.name || 'unknown'}\n\nMessage:\n${Body}\n\nReply via the Inbox.`,
          'urgent', contact.client_id
        ).catch(e => console.error('Unhandled SMS briefing failed:', e.message));
      }
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
      console.log('Inbound WhatsApp saved and workflow paused for:', contact.first_name);
      const { data: waClient } = await supabase.from('clients').select('name').eq('id', contact.client_id).maybeSingle();
      const waAssessment = await assessInboundConfidence('WhatsApp', Body, waClient?.name);
      if (!waAssessment.confident) {
        await storeBriefing('fatima', 'yousef',
          `Unhandled WhatsApp from ${contact.first_name} ${contact.last_name || ''}`.trim(),
          `An inbound WhatsApp message needs your manual response — the AI could not respond confidently.\n\nReason: ${waAssessment.reason}\nContact: ${contact.first_name} ${contact.last_name || ''} (${phone})\nClient: ${waClient?.name || 'unknown'}\n\nMessage:\n${Body}\n\nReply via the Inbox.`,
          'urgent', contact.client_id
        ).catch(e => console.error('Unhandled WhatsApp briefing failed:', e.message));
      }
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
          await supabase.from('contacts').update({
            last_activity: new Date(timestamp * 1000).toISOString()
          }).eq('id', contact.id);
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
  const { from_member, to_member, subject, content, priority, client_id } = req.body;
  if (!from_member || !to_member || !subject || !content) {
    return res.status(400).json({ error: 'Missing required fields: from_member, to_member, subject, content' });
  }
  try {
    const { data: briefing, error } = await supabase.from('team_briefings').insert([{
      from_member, to_member, subject, content,
      priority: priority || 'normal',
      client_id: client_id || null,
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

// ─── APPROVAL ENDPOINTS ──────────────────────────────────
app.post('/approvals/submit', async (req, res) => {
  const { type, title, content, metadata, from_member, client_id } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title are required' });
  try {
    const { data, error } = await supabase.from('approvals').insert([{
      type, title, content: content || '',
      metadata: metadata || {},
      from_member: from_member || 'system',
      client_id: client_id || null,
      status: 'pending',
      created_at: new Date().toISOString()
    }]).select().single();
    if (error) throw error;
    res.json({ approval: data });
  } catch (e) {
    console.error('/approvals/submit error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/approvals/action', async (req, res) => {
  const { approval_id, action, feedback } = req.body;
  if (!approval_id || !action) return res.status(400).json({ error: 'approval_id and action required' });
  try {
    const { data: approval, error: fetchErr } = await supabase.from('approvals').select('*').eq('id', approval_id).single();
    if (fetchErr || !approval) return res.status(404).json({ error: 'Approval not found' });

    if (action === 'reject') {
      await supabase.from('approvals').update({
        status: 'rejected', feedback: feedback || null, actioned_at: new Date().toISOString()
      }).eq('id', approval_id);
      return res.json({ ok: true });
    }

    if (action !== 'approve') return res.status(400).json({ error: 'action must be approve or reject' });

    const meta = approval.metadata || {};

    if (approval.type === 'email_sequence' || approval.type === 'sms_sequence' || approval.type === 'whatsapp_sequence') {
      const steps = meta.steps || [];
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
    } else if (approval.type === 'outreach_message') {
      if (meta.channel === 'sms' && meta.to_phone) {
        const { tc: twilioClient, from } = await getClientTwilio(approval.client_id);
        await twilioClient.messages.create({ body: approval.content, from, to: meta.to_phone });
      } else if (meta.to_email) {
        const sender = await getClientSender(approval.client_id);
        await sgMail.send({
          to: meta.to_email, from: sender,
          subject: meta.subject || 'Message from Sales Scales',
          html: `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#374151;">${approval.content}</p>`
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
            <div style="color:#4a5568;font-size:13px;line-height:1.8;white-space:pre-wrap;">${approval.content}</div>
            <hr style="border:none;border-top:1px solid #e4e9f0;margin:18px 0;" />
            <p style="color:#8896a8;font-size:11px;margin:0;">Sales Scales — AI Revenue System</p>
          </div>
        </div>`
      });
    } else if (approval.type === 'prospect') {
      await supabase.from('my_pipeline').insert([{
        name: meta.prospect_name || approval.title,
        niche: meta.niche || null,
        channel: meta.channel || null,
        pain_point: meta.pain_point || null,
        source: 'hassan_ai',
        notes: approval.content,
        stage: 'new',
      }]);
      await storeBriefing('hassan', 'ali',
        `New Prospect to Close: ${meta.prospect_name || approval.title}`,
        `Hassan has sourced a new prospect that Yousef approved.\n\nProspect: ${meta.prospect_name || approval.title}\nNiche: ${meta.niche || 'unknown'}\nChannel: ${meta.channel || 'unknown'}\nPain Point: ${meta.pain_point || 'unknown'}\n\nOutreach message sent:\n${approval.content}\n\nDraft a NEPQ-based closing script for this prospect and prepare follow-up questions.`,
        'high'
      );
    }

    await supabase.from('approvals').update({
      status: 'approved', feedback: feedback || null, actioned_at: new Date().toISOString()
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
        await supabase.from('approvals').insert([{
          type: 'client_request',
          title: `Client request from ${store}`,
          content: message,
          from_member: 'zainab',
          client_id: client_id || null,
          status: 'pending',
          created_at: new Date().toISOString()
        }]);
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

app.post('/voice-agent/outbound-call', async (req, res) => {
  const { phone, agentId } = req.body;
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

    const { data: inserted, error } = await supabase
      .from('call_logs')
      .insert({
        client_id: clientId,
        contact_phone: contactPhone,
        direction: direction === 'inbound' ? 'inbound' : 'outbound',
        duration_seconds: durationSeconds,
        transcript: transcript || null,
        summary: summary || null
      })
      .select()
      .single();

    if (error) {
      console.error('call_logs insert error:', error.message);
      return res.status(500).json({ error: 'Failed to log call', details: error.message });
    }

    console.log('Call logged:', inserted.id, direction, contactPhone);
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
          if (socialConfig.dm.enrollContacts && socialConfig.dm.workflowId) {
            let { data: contact } = await supabase.from('contacts').select('*').eq('phone', senderId).maybeSingle();
            if (!contact) {
              const { data: nc } = await supabase.from('contacts').insert([{
                first_name: platform === 'instagram' ? 'Instagram' : 'Facebook',
                last_name: 'User',
                phone: senderId,
                source: platform === 'instagram' ? 'Instagram' : 'Facebook',
                channel: platform === 'instagram' ? 'Instagram' : 'Facebook',
                pipeline_stage: 'New Lead',
                last_activity: new Date().toISOString()
              }]).select().single();
              contact = nc;
            }
            if (contact) {
              await enrollContactInWorkflow(socialConfig.dm.workflowId, contact.id, null, contact.email, null, contact.first_name);
            }
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

    console.log(`Client onboarded: ${name} (${email}) — client_id ${client.id}`);
    res.json({ ok: true, client, client_user: clientUser });
  } catch (e) {
    console.error('Client onboard error:', e.message);
    res.status(500).json({ error: 'Failed to onboard client', details: e.message });
  }
});

// ─── CREATE CONTACT (with dedup) ─────────────────────────
app.post('/contacts', async (req, res) => {
  const { first_name, last_name, email, phone, source, channel, pipeline_stage, notes, client_id } = req.body;
  if (!first_name || !email) return res.status(400).json({ error: 'first_name and email required' });
  try {
    const { data: existing } = await supabase.from('contacts')
      .select('*').eq('email', email).eq('client_id', client_id).maybeSingle();
    if (existing) {
      await supabase.from('contacts').update({
        first_name: first_name || existing.first_name,
        last_name: last_name ?? existing.last_name,
        phone: phone || existing.phone,
        source: source || existing.source,
        channel: channel || existing.channel,
        pipeline_stage: pipeline_stage || existing.pipeline_stage,
        notes: notes ?? existing.notes,
        last_activity: new Date().toISOString(),
      }).eq('id', existing.id);
      return res.json({ contact: { ...existing, first_name, last_name, phone }, duplicate: true });
    }
    const { data: contact, error } = await supabase.from('contacts').insert([{
      first_name, last_name, email, phone,
      source: source || 'Manual',
      channel: channel || 'Email',
      pipeline_stage: pipeline_stage || 'New Lead',
      notes: notes || null,
      client_id: client_id || null,
      last_activity: new Date().toISOString(),
    }]).select().single();
    if (error) throw error;
    res.json({ contact, duplicate: false });
  } catch (e) {
    console.error('Create contact error:', e.message);
    res.status(500).json({ error: 'Failed to create contact', details: e.message });
  }
});

// ─── ROUTE MODULES ────────────────────────────────────────
app.use('/auth',    require('./routes/auth')({ supabase, jwt, bcrypt, JWT_SECRET, verifyToken }));
app.use('/',        require('./routes/ai-team')({ aiCall, ragSearch, getBriefingsContext, getShopifyContext, getClientProfile, verifyToken, aiLimiter }));
app.use('/shopify', require('./routes/shopify')({ supabase, axios, crypto, processWebhookEvent, aiCall }));
app.use('/',        require('./routes/knowledge')({ supabase, axios, importLimiter, upload, PDF2Json, YoutubeTranscript }));
app.use('/',        require('./routes/analytics')({ supabase }));
app.use('/',        require('./routes/integrations')({ supabase, axios, aiCall, ragSearch, getBriefingsContext, verifyToken }));
app.use('/',        require('./routes/operations')({ supabase, aiCall, ragSearch, getBriefingsContext, verifyToken }));

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────
app.use((err, req, res, next) => {
  const ts = new Date().toISOString();
  console.error(`[${ts}] Unhandled error — ${req.method} ${req.path} — ${err.message}`);
  console.error(err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('Scheduler active — checking workflow steps every 15 minutes');
});

// ─── PROCESS ERROR HANDLERS ───────────────────────────────
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] uncaughtException — ${err.message}`);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error(`[${new Date().toISOString()}] unhandledRejection — ${msg}`);
  if (reason instanceof Error) console.error(reason.stack);
});
