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

      if (currentStep.step_type === 'wait') {
        const nextStepAt = new Date();
        nextStepAt.setHours(nextStepAt.getHours() + (currentStep.wait_hours || 1));
        await supabase.from('workflow_enrollments').update({
          current_step: enrollment.current_step + 1,
          next_step_at: nextStepAt.toISOString()
        }).eq('id', enrollment.id);
        console.log(`Wait step processed for ${contact.first_name}`);

      } else if (currentStep.step_type === 'sms' && contact.phone && currentStep.content) {
        try {
          const { tc: twilioClient, from: twilioFrom } = await getClientTwilio(enrollment.client_id);
          await twilioClient.messages.create({
            body: currentStep.content.replace('{{first_name}}', contact.first_name || 'there'),
            from: twilioFrom,
            to: contact.phone
          });
          console.log(`SMS sent to ${contact.first_name} — step ${enrollment.current_step}`);
        } catch (e) {
          console.error('SMS step error:', e.message);
        }
        const nextStep = steps[enrollment.current_step];
        const nextStepAt = new Date();
        if (nextStep && nextStep.step_type === 'wait') {
          nextStepAt.setHours(nextStepAt.getHours() + (nextStep.wait_hours || 1));
        }
        await supabase.from('workflow_enrollments').update({
          current_step: enrollment.current_step + 1,
          next_step_at: nextStepAt.toISOString()
        }).eq('id', enrollment.id);
        await supabase.from('messages').insert([{
          client_id: enrollment.client_id,
          contact_id: enrollment.contact_id,
          channel: 'sms', direction: 'outbound',
          sender_name: 'Sales Scales AI',
          content: currentStep.content, status: 'sent'
        }]);

      } else if (currentStep.step_type === 'whatsapp' && contact.phone && currentStep.content) {
        try {
          const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await twilioClient.messages.create({
            body: currentStep.content.replace('{{first_name}}', contact.first_name || 'there'),
            from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
            to: 'whatsapp:' + contact.phone
          });
          console.log(`WhatsApp sent to ${contact.first_name} — step ${enrollment.current_step}`);
        } catch (e) {
          console.error('WhatsApp step error:', e.message);
        }
        const nextStep = steps[enrollment.current_step];
        const nextStepAt = new Date();
        if (nextStep && nextStep.step_type === 'wait') {
          nextStepAt.setHours(nextStepAt.getHours() + (nextStep.wait_hours || 1));
        }
        await supabase.from('workflow_enrollments').update({
          current_step: enrollment.current_step + 1,
          next_step_at: nextStepAt.toISOString()
        }).eq('id', enrollment.id);
        await supabase.from('messages').insert([{
          client_id: enrollment.client_id,
          contact_id: enrollment.contact_id,
          channel: 'WhatsApp', direction: 'outbound',
          sender_name: 'Sales Scales AI',
          content: currentStep.content, status: 'sent'
        }]);

      } else if (currentStep.step_type === 'email' && contact.email && currentStep.content) {
        try {
          const sender = await getClientSender(enrollment.client_id);
          await sgMail.send({
            to: contact.email,
            from: sender,
            subject: currentStep.subject || 'Message for you',
            html: `<p>${currentStep.content.replace('{{first_name}}', contact.first_name || 'there')}</p>`
          });
          console.log(`Email sent to ${contact.first_name} — step ${enrollment.current_step}`);
        } catch (e) {
          console.error('Email step error:', e.message);
        }
        const nextStep = steps[enrollment.current_step];
        const nextStepAt = new Date();
        if (nextStep && nextStep.step_type === 'wait') {
          nextStepAt.setHours(nextStepAt.getHours() + (nextStep.wait_hours || 1));
        }
        await supabase.from('workflow_enrollments').update({
          current_step: enrollment.current_step + 1,
          next_step_at: nextStepAt.toISOString()
        }).eq('id', enrollment.id);
        await supabase.from('messages').insert([{
          client_id: enrollment.client_id,
          contact_id: enrollment.contact_id,
          channel: 'email', direction: 'outbound',
          sender_name: 'Sales Scales AI',
          content: currentStep.content, status: 'sent'
        }]);

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

    let reportsGenerated = 0;
    let emailsSentCount = 0;

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
      } catch (clientErr) {
        console.error(`[AUTO] Zainab report failed for ${client.name}:`, clientErr.message);
      }
    }

    await storeBriefing('zainab', 'yousef',
      `Monthly Reports Complete — ${period}`,
      `Zainab has automatically generated and sent ${period} reports.\n\n- Reports generated: ${reportsGenerated}/${clients.length}\n- Emails sent to clients: ${emailsSentCount}\n\nAll reports are viewable in the Auto Reports page.`,
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
  } catch (e) {
    console.error('[AUTO] Hassan daily error:', e.message);
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

// ─── ROUTE MODULES ────────────────────────────────────────
app.use('/auth',    require('./routes/auth')({ supabase, jwt, bcrypt, JWT_SECRET, verifyToken }));
app.use('/',        require('./routes/ai-team')({ aiCall, ragSearch, getBriefingsContext, getShopifyContext, verifyToken, aiLimiter }));
app.use('/shopify', require('./routes/shopify')({ supabase, axios, crypto, processWebhookEvent }));
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
