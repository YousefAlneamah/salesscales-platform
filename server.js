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

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// In-memory store for channel import jobs
const importJobs = new Map();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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

    // Client-specific knowledge first
    if (clientId) {
      const { data: clientResults } = await supabase.rpc('search_knowledge_base', {
        query_embedding: queryEmbedding,
        client_id_filter: clientId,
        match_count: 20
      });
      if (clientResults) allResults.push(...clientResults);
    }

    // Global brain (client_id = null)
    const { data: globalResults } = await supabase.rpc('search_knowledge_base', {
      query_embedding: queryEmbedding,
      client_id_filter: null,
      match_count: 20
    });
    if (globalResults) allResults.push(...globalResults);

    // Deduplicate by id, sort by similarity, take top 5
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

  // Skip if already actively enrolled
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
      const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twilioClient.messages.create({
        body: firstStep.content.replace('{{first_name}}', contactName || 'there'),
        from: process.env.TWILIO_PHONE_NUMBER, to: contactPhone
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

  // Find or create contact
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

  // Find active workflow matching trigger type
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
          const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await twilioClient.messages.create({
            body: currentStep.content.replace('{{first_name}}', contact.first_name || 'there'),
            from: process.env.TWILIO_PHONE_NUMBER,
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

// ─── SHOPIFY OAUTH ────────────────────────────────────────
app.get('/shopify/install', (req, res) => {
  const { shop, clientId } = req.query;
  if (!shop) return res.status(400).send('Missing shop parameter');
  const state = clientId || crypto.randomBytes(16).toString('hex');
  const scopes = 'read_analytics,write_checkouts,read_checkouts,read_customers,write_customers,read_price_rules,write_price_rules,read_discounts,write_discounts,write_draft_orders,read_draft_orders,read_fulfillments,write_fulfillments,write_inventory,read_inventory,write_marketing_events,read_marketing_events,read_orders,write_orders,read_products,write_products,read_shipping';
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI}&state=${state}`;
  res.redirect(installUrl);
});

app.get('/shopify/callback', async (req, res) => {
  const { shop, code, state } = req.query;
  if (!shop || !code) return res.status(400).send('Missing required parameters');
  try {
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code: code
    });
    const accessToken = tokenResponse.data.access_token;
    const clientId = state && state.length < 40 ? state : null;
    await supabase.from('shopify_connections').upsert([{
      shop, access_token: accessToken, client_id: clientId,
      scope: 'read_analytics,write_checkouts,read_checkouts,read_customers,write_customers',
      created_at: new Date().toISOString()
    }], { onConflict: 'shop' });
    console.log('Shopify connection saved for:', shop);
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5;">
          <div style="text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h2 style="color: #0f1f35; margin-bottom: 8px;">Shopify Connected</h2>
            <p style="color: #64748b; margin-bottom: 20px;">${shop} has been connected successfully.</p>
            <a href="http://localhost:3000" style="background: #0f1f35; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Return to Platform</a>
          </div>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('Shopify callback error:', e.message);
    res.status(500).json({ error: 'Failed to get access token', details: e.message });
  }
});

app.post('/shopify/sync-customers', async (req, res) => {
  const { shop, accessToken, clientId } = req.body;
  if (!shop || !accessToken) return res.status(400).json({ error: 'Missing shop or accessToken' });
  try {
    const response = await axios.get(
      `https://${shop}/admin/api/2026-01/customers.json?limit=250`,
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );
    const customers = response.data.customers;
    for (const customer of customers) {
      await supabase.from('contacts').upsert([{
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        source: 'Shopify', channel: 'Email',
        pipeline_stage: 'New Lead',
        client_id: clientId || null,
        shopify_customer_id: customer.id.toString(),
        last_activity: new Date().toISOString()
      }], { onConflict: 'shopify_customer_id' });
    }
    console.log(`Synced ${customers.length} customers from ${shop}`);
    res.json({ success: true, count: customers.length });
  } catch (e) {
    console.error('Sync error:', e.message);
    res.status(500).json({ error: 'Sync failed', details: e.message });
  }
});

// ─── SHOPIFY STORE DATA (LIVE) ───────────────────────────
app.post('/shopify/store-data', async (req, res) => {
  const { client_id } = req.body;
  if (!client_id) return res.status(400).json({ error: 'Missing client_id' });
  try {
    const { data: conn } = await supabase.from('shopify_connections')
      .select('*').eq('client_id', client_id).maybeSingle();
    if (!conn) return res.status(404).json({ error: 'No Shopify store connected for this client' });

    const { shop, access_token } = conn;
    const headers = { 'X-Shopify-Access-Token': access_token, 'Content-Type': 'application/json' };
    const base = `https://${shop}/admin/api/2026-01`;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [recentRes, monthRes, totalCountRes, abandonedCountRes] = await Promise.all([
      axios.get(`${base}/orders.json?status=any&limit=10&order=created_at+desc`, { headers }),
      axios.get(`${base}/orders.json?status=any&created_at_min=${monthStart}&limit=250`, { headers }),
      axios.get(`${base}/orders/count.json?status=any`, { headers }),
      axios.get(`${base}/checkouts/count.json`, { headers }),
    ]);

    const monthOrders = monthRes.data.orders || [];
    const monthRevenue = monthOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);

    const productMap = {};
    monthOrders.forEach(order => {
      (order.line_items || []).forEach(item => {
        const key = item.product_id || item.title;
        if (!productMap[key]) productMap[key] = { title: item.title, quantity: 0, revenue: 0 };
        productMap[key].quantity += item.quantity;
        productMap[key].revenue += parseFloat(item.price || 0) * item.quantity;
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    const recentOrders = (recentRes.data.orders || []).map(o => ({
      id: o.id, name: o.name, email: o.email,
      total: o.total_price, currency: o.currency,
      financial_status: o.financial_status,
      fulfillment_status: o.fulfillment_status || 'unfulfilled',
      item_count: (o.line_items || []).reduce((s, li) => s + li.quantity, 0),
      created_at: o.created_at,
    }));

    res.json({
      shop, connected: true,
      totalOrders: totalCountRes.data.count,
      monthOrderCount: monthOrders.length,
      monthRevenue: parseFloat(monthRevenue.toFixed(2)),
      abandonedCheckouts: abandonedCountRes.data.count,
      recentOrders,
      topProducts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Store data error:', e.message);
    res.status(500).json({ error: 'Failed to fetch store data', details: e.response?.data || e.message });
  }
});

// ─── SHOPIFY WEBHOOKS ────────────────────────────────────
app.post('/shopify/webhook', async (req, res) => {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];
  const shop = req.headers['x-shopify-shop-domain'];

  if (!hmac || !topic || !shop) return res.status(401).json({ error: 'Missing webhook headers' });

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const hash = crypto.createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
    .update(rawBody, 'utf8').digest('base64');

  if (hash !== hmac) {
    console.log('Shopify webhook HMAC verification failed for:', shop);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Acknowledge immediately — Shopify requires sub-5s response
  res.status(200).json({ received: true });

  processWebhookEvent(topic, shop, req.body).catch(e => {
    console.error(`Webhook error [${topic}]:`, e.message);
  });
});

app.post('/shopify/register-webhooks', async (req, res) => {
  const { shop, accessToken } = req.body;
  if (!shop || !accessToken) return res.status(400).json({ error: 'Missing shop or accessToken' });

  const baseUrl = process.env.WEBHOOK_BASE_URL ||
    (process.env.SHOPIFY_REDIRECT_URI ? process.env.SHOPIFY_REDIRECT_URI.replace('/shopify/callback', '') : null);

  if (!baseUrl) return res.status(400).json({ error: 'WEBHOOK_BASE_URL not set in environment' });

  const topics = [
    'checkouts/create',
    'orders/create',
    'orders/updated',
    'orders/fulfilled',
  ];

  const registered = [];
  const failed = [];

  for (const topic of topics) {
    try {
      await axios.post(
        `https://${shop}/admin/api/2026-01/webhooks.json`,
        { webhook: { topic, address: `${baseUrl}/shopify/webhook`, format: 'json' } },
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );
      registered.push(topic);
      console.log(`Webhook registered: ${topic} → ${shop}`);
    } catch (e) {
      const errDetail = e.response?.data?.errors || e.message;
      // Shopify returns 422 if webhook already exists — treat as success
      if (e.response?.status === 422) {
        registered.push(topic);
      } else {
        failed.push({ topic, error: errDetail });
      }
    }
  }

  res.json({ success: true, registered, failed });
});

app.post('/shopify/list-webhooks', async (req, res) => {
  const { shop, accessToken } = req.body;
  if (!shop || !accessToken) return res.status(400).json({ error: 'Missing shop or accessToken' });
  try {
    const response = await axios.get(
      `https://${shop}/admin/api/2026-01/webhooks.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );
    res.json({ success: true, webhooks: response.data.webhooks || [] });
  } catch (e) {
    console.error('List webhooks error:', e.message);
    res.status(500).json({ error: 'Failed to fetch webhooks', details: e.message });
  }
});

// ─── PDF UPLOAD + AUTO CHUNK + EMBED ─────────────────────
app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { title, clientId, type, aiMember } = req.body;

    const pdfParser = new PDF2Json();

    pdfParser.on('pdfParser_dataError', () => {
      res.status(500).json({ error: 'Failed to parse PDF' });
    });

    pdfParser.on('pdfParser_dataReady', async (pdfData) => {
      try {
        const pages = pdfData.Pages || [];
        let text = '';
        pages.forEach(page => {
          if (!page.Texts) return;
          page.Texts.forEach(textItem => {
            if (!textItem.R) return;
            textItem.R.forEach(run => {
              let word = run.T || '';
              try { word = decodeURIComponent(word); } catch (e) {}
              text += word + ' ';
            });
            text += '\n';
          });
        });
        text = text.trim();

        if (!text || text.length < 50) {
          return res.json({ success: true, message: 'PDF parsed but no text extracted', chunks: 0 });
        }

        console.log(`PDF parsed: ${pages.length} pages, ${text.length} characters`);

        const chunkSize = 1000;
        const overlap = 100;
        const chunks = [];

        for (let i = 0; i < text.length; i += chunkSize - overlap) {
          const chunk = text.substring(i, i + chunkSize);
          if (chunk.trim().length > 50) chunks.push(chunk);
        }

        console.log(`Chunking into ${chunks.length} chunks for: ${title}`);

        res.json({
          success: true,
          message: `Processing ${chunks.length} chunks in background`,
          chunks: chunks.length,
          pageCount: pages.length
        });

        let embedded = 0;
        for (let i = 0; i < chunks.length; i++) {
          try {
            const { data: newDoc } = await supabase.from('knowledge_base').insert([{
              title: `${title} — Part ${i + 1}`,
              content: chunks[i],
              type: type || 'document',
              source: 'PDF Upload',
              client_id: clientId || null,
              status: 'trained',
              notes: aiMember || 'All Team'
            }]).select().single();

            if (newDoc) {
              const embeddingResponse = await axios.post(
                'https://api.openai.com/v1/embeddings',
                { input: chunks[i].substring(0, 500), model: 'text-embedding-3-small' },
                { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
              );
              const embedding = embeddingResponse.data.data[0].embedding;
              await supabase.from('knowledge_base').update({ embedding }).eq('id', newDoc.id);
              embedded++;
            }

            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (e) {
            console.error(`Chunk ${i + 1} failed:`, e.message);
          }
        }

        console.log(`✅ Complete: ${embedded} of ${chunks.length} chunks embedded for: ${title}`);

      } catch (e) {
        console.error('PDF processing error:', e.message);
      }
    });

    pdfParser.parseBuffer(req.file.buffer);

  } catch (e) {
    res.status(500).json({ error: 'Failed to process PDF', details: e.message });
  }
});

// ─── YOUTUBE TRANSCRIPT ───────────────────────────────────
app.post('/youtube-transcript', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    const text = transcript.map(t => t.text).join(' ').trim();
    res.json({ success: true, wordCount: text.split(/\s+/).length, text: text.substring(0, 1000000) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch transcript', details: e.message });
  }
});

// ─── SEND SMS ─────────────────────────────────────────────
app.post('/send-sms', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to });
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
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const result = await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to });
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
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await twilioClient.messages.create({ body: firstStep.content.replace('{{first_name}}', contactName || 'there'), from: process.env.TWILIO_PHONE_NUMBER, to: contactPhone });
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
      from_member,
      to_member,
      subject,
      content,
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

// ─── YOUTUBE CHANNEL IMPORT ──────────────────────────────

const resolveChannelId = async (channelUrl) => {
  // Direct channel ID: /channel/UCxxxxx
  const directMatch = channelUrl.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (directMatch) return directMatch[1];

  // Handle: /@handle or /c/name or /user/name
  const handleMatch = channelUrl.match(/youtube\.com\/@([\w.-]+)/);
  if (handleMatch) {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'id', forHandle: handleMatch[1], key: process.env.YOUTUBE_API_KEY }
    });
    return res.data.items?.[0]?.id || null;
  }
  const customMatch = channelUrl.match(/youtube\.com\/(?:c|user)\/([\w.-]+)/);
  if (customMatch) {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'id', forUsername: customMatch[1], key: process.env.YOUTUBE_API_KEY }
    });
    return res.data.items?.[0]?.id || null;
  }
  return null;
};

const fetchChannelVideos = async (channelId) => {
  // Get uploads playlist ID first (more reliable than search)
  const chRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
    params: { part: 'contentDetails', id: channelId, key: process.env.YOUTUBE_API_KEY }
  });
  const uploadsId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];

  const videos = [];
  let nextPageToken = null;
  do {
    const params = { part: 'snippet', playlistId: uploadsId, maxResults: 50, key: process.env.YOUTUBE_API_KEY };
    if (nextPageToken) params.pageToken = nextPageToken;
    const res = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', { params });
    for (const item of res.data.items || []) {
      const vid = item.snippet.resourceId?.videoId;
      if (vid) videos.push({
        videoId: vid,
        title: item.snippet.title,
        description: (item.snippet.description || '').substring(0, 400),
        publishedAt: item.snippet.publishedAt,
      });
    }
    nextPageToken = res.data.nextPageToken || null;
  } while (nextPageToken && videos.length < 10000);

  return videos;
};

const scoreVideosWithClaude = async (videos) => {
  const BATCH = 15;
  const scored = [];
  for (let i = 0; i < videos.length; i += BATCH) {
    const batch = videos.slice(i, i + BATCH);
    const list = batch.map((v, idx) =>
      `${idx + 1}. "${v.title}" — ${v.description.substring(0, 150)}`
    ).join('\n');
    try {
      const res = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: 'You are a content relevance scorer for an ecommerce sales agency. Return ONLY a JSON array of integers (1-10), one per video, in order. No explanation.',
          messages: [{ role: 'user', content: `Score each video 1-10 for relevance to ecommerce sales, email/SMS marketing, paid ads, copywriting, customer retention, or business growth. Return ONLY a JSON array like [8,3,9,...] — ${batch.length} numbers:\n\n${list}` }]
        },
        { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } }
      );
      const text = res.data.content[0].text.trim();
      const arrMatch = text.match(/\[[\d\s,]+\]/);
      const scores = arrMatch ? JSON.parse(arrMatch[0]) : [];
      batch.forEach((v, idx) => scored.push({ ...v, score: scores[idx] ?? 0 }));
    } catch (e) {
      batch.forEach(v => scored.push({ ...v, score: 0 }));
    }
    await new Promise(r => setTimeout(r, 400));
  }
  return scored;
};

const runChannelImport = async (jobId, channelUrl, clientId, aiMember) => {
  const job = importJobs.get(jobId);
  const log = (msg) => {
    job.log.push({ time: new Date().toISOString(), msg });
    console.log(`[Import ${jobId.slice(0, 6)}] ${msg}`);
  };

  try {
    log('Resolving channel URL...');
    const channelId = await resolveChannelId(channelUrl.trim());
    if (!channelId) throw new Error('Cannot resolve channel ID. Check URL format — try https://youtube.com/@ChannelName');
    log(`Channel resolved → ${channelId}`);

    log('Fetching video list from YouTube Data API...');
    const videos = await fetchChannelVideos(channelId);
    if (videos.length === 0) throw new Error('No videos found on this channel. Check the API key and channel URL.');
    job.videosQueued = videos.length;
    log(`Found ${videos.length} videos. Scoring all for relevance with Claude Haiku...`);

    const scored = await scoreVideosWithClaude(videos);
    const qualifying = scored.filter(v => v.score >= 7);
    job.videos = scored;
    log(`Scoring complete. ${qualifying.length} of ${scored.length} videos scored 7+ and will be imported.`);

    // Phase 1: Fetch transcripts in parallel batches of 10
    const TRANSCRIPT_BATCH = 10;
    const videoChunksMap = [];

    for (let i = 0; i < qualifying.length; i += TRANSCRIPT_BATCH) {
      const batch = qualifying.slice(i, i + TRANSCRIPT_BATCH);
      log(`Fetching transcripts ${i + 1}–${Math.min(i + TRANSCRIPT_BATCH, qualifying.length)} of ${qualifying.length}...`);

      const results = await Promise.all(batch.map(async (video) => {
        try {
          const transcript = await YoutubeTranscript.fetchTranscript(
            `https://www.youtube.com/watch?v=${video.videoId}`
          );
          const text = transcript.map(t => t.text).join(' ').trim();
          if (!text || text.length < 100) return { video, chunks: null };
          const chunkSize = 1000, overlap = 100;
          const chunks = [];
          for (let pos = 0; pos < text.length; pos += chunkSize - overlap) {
            const chunk = text.substring(pos, pos + chunkSize);
            if (chunk.trim().length > 50) chunks.push(chunk);
          }
          return { video, chunks };
        } catch (e) {
          return { video, chunks: null, error: e.message };
        }
      }));

      for (const r of results) {
        if (r.error) log(`  ↳ "${r.video.title}" — Error: ${r.error}`);
        else if (!r.chunks) log(`  ↳ "${r.video.title}" — No transcript`);
        else videoChunksMap.push(r);
        job.videosProcessed++;
      }
    }

    log(`Transcripts done. ${videoChunksMap.length} videos with content.`);

    // Flatten all chunks into one array for batch processing
    const allChunks = [];
    for (const { video, chunks } of videoChunksMap) {
      for (let c = 0; c < chunks.length; c++) {
        allChunks.push({
          row: {
            title: `${video.title} — Part ${c + 1}`,
            content: chunks[c],
            type: 'video',
            source: 'YouTube Channel Import',
            client_id: clientId || null,
            status: 'trained',
            notes: aiMember || 'All Team',
          },
          content: chunks[c],
        });
      }
    }

    // Phase 2: Insert in batches of 50
    const INSERT_BATCH = 50;
    log(`Inserting ${allChunks.length} chunks in batches of ${INSERT_BATCH}...`);
    const insertedDocs = [];
    for (let i = 0; i < allChunks.length; i += INSERT_BATCH) {
      const batch = allChunks.slice(i, i + INSERT_BATCH);
      try {
        const { data: docs } = await supabase.from('knowledge_base').insert(batch.map(c => c.row)).select();
        if (docs) {
          docs.forEach((doc, idx) => insertedDocs.push({ id: doc.id, content: batch[idx].content }));
        }
      } catch (e) {
        console.error('Batch insert error:', e.message);
      }
    }

    // Phase 3: Generate embeddings in batches of 20 (OpenAI supports array input)
    const EMBED_BATCH = 20;
    log(`Generating embeddings for ${insertedDocs.length} chunks in batches of ${EMBED_BATCH}...`);
    for (let i = 0; i < insertedDocs.length; i += EMBED_BATCH) {
      const batch = insertedDocs.slice(i, i + EMBED_BATCH);
      try {
        const embRes = await axios.post(
          'https://api.openai.com/v1/embeddings',
          { input: batch.map(d => d.content.substring(0, 500)), model: 'text-embedding-3-small' },
          { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' } }
        );
        await Promise.all(batch.map((doc, idx) =>
          supabase.from('knowledge_base').update({ embedding: embRes.data.data[idx].embedding }).eq('id', doc.id)
        ));
        job.chunksAdded += batch.length;
        log(`  ↳ Embedded chunks ${i + 1}–${Math.min(i + EMBED_BATCH, insertedDocs.length)} of ${insertedDocs.length}`);
      } catch (e) {
        console.error('Batch embed error:', e.message);
      }
    }

    job.status = 'complete';
    log(`✅ Done — ${job.videosProcessed} videos processed, ${job.chunksAdded} chunks added to knowledge base.`);
    setTimeout(() => importJobs.delete(jobId), 3_600_000); // clean up after 1h
  } catch (e) {
    job.status = 'error';
    job.error = e.message;
    log(`❌ ${e.message}`);
  }
};

app.post('/knowledge/import-channel', async (req, res) => {
  const { channelUrl, clientId, aiMember } = req.body;
  if (!channelUrl) return res.status(400).json({ error: 'Missing channelUrl' });
  if (!process.env.YOUTUBE_API_KEY) return res.status(500).json({ error: 'YOUTUBE_API_KEY not set in environment' });

  const jobId = crypto.randomBytes(8).toString('hex');
  importJobs.set(jobId, {
    status: 'running',
    log: [],
    videos: [],
    videosQueued: 0,
    videosProcessed: 0,
    chunksAdded: 0,
    error: null,
  });

  res.json({ jobId });

  runChannelImport(jobId, channelUrl, clientId, aiMember).catch(e => {
    const job = importJobs.get(jobId);
    if (job) { job.status = 'error'; job.error = e.message; }
  });
});

app.get('/knowledge/import-channel/progress', (req, res) => {
  const { jobId } = req.query;
  const job = importJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let lastLogIdx = 0;

  const push = () => {
    const newLogs = job.log.slice(lastLogIdx);
    lastLogIdx = job.log.length;
    res.write(`data: ${JSON.stringify({
      status: job.status,
      newLogs,
      videos: job.videos,
      videosQueued: job.videosQueued,
      videosProcessed: job.videosProcessed,
      chunksAdded: job.chunksAdded,
      error: job.error,
    })}\n\n`);
    if (job.status === 'complete' || job.status === 'error') {
      clearInterval(timer);
      res.end();
    }
  };

  push();
  const timer = setInterval(push, 1000);
  req.on('close', () => clearInterval(timer));
});

// ─── AI TEAM ENDPOINTS ────────────────────────────────────
app.post('/hussain', async (req, res) => {
  const { prompt, clientId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const [ragContext, briefingsCtx, shopifyCtx] = await Promise.all([
      ragSearch(prompt, clientId),
      getBriefingsContext('hussain'),
      getShopifyContext(clientId),
    ]);
    const context = [ragContext, briefingsCtx, shopifyCtx].filter(Boolean).join('\n\n');
    const result = await aiCall(`You are Hussain, the Intelligence and Strategy AI at Sales Scales. You are sharp, data-driven, and think like a founder. You analyze platform data and give direct, actionable insights. You speak in a confident, concise style — no fluff, no filler. You are Hussain — never identify as anyone else or mention Claude.`, prompt, context);
    res.json({ result });
  } catch (e) {
    console.error('Hussain error:', e.message);
    res.status(500).json({ error: 'Hussain failed', details: e.message });
  }
});

app.post('/hassan', async (req, res) => {
  const { prompt, clientId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const [ragContext, briefingsCtx, shopifyCtx] = await Promise.all([
      ragSearch(prompt, clientId),
      getBriefingsContext('hassan'),
      getShopifyContext(clientId),
    ]);
    const context = [ragContext, briefingsCtx, shopifyCtx].filter(Boolean).join('\n\n');
    const result = await aiCall(`You are Hassan, the Growth and Outreach AI at Sales Scales. You are creative, persuasive, and a master of personalized communication. You find prospects, write outreach that converts, follow up strategically, and create content that attracts ecommerce founders. You are Hassan — never identify as anyone else or mention Claude.`, prompt, context);
    res.json({ result });
  } catch (e) {
    console.error('Hassan error:', e.message);
    res.status(500).json({ error: 'Hassan failed', details: e.message });
  }
});

app.post('/ali', async (req, res) => {
  const { prompt, clientId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const [ragContext, briefingsCtx, shopifyCtx] = await Promise.all([
      ragSearch(prompt, clientId),
      getBriefingsContext('ali'),
      getShopifyContext(clientId),
    ]);
    const context = [ragContext, briefingsCtx, shopifyCtx].filter(Boolean).join('\n\n');
    const result = await aiCall(`You are Ali, the Sales Closer AI at Sales Scales. You are a master of the NEPQ framework and high ticket closing. You take warm leads and close them with precision. You generate sales strategies, handle objections without flinching, and write call scripts that convert. You are Ali — never identify as anyone else or mention Claude.`, prompt, context);
    res.json({ result });
  } catch (e) {
    console.error('Ali error:', e.message);
    res.status(500).json({ error: 'Ali failed', details: e.message });
  }
});

app.post('/mahdi', async (req, res) => {
  const { prompt, clientId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const [ragContext, briefingsCtx, shopifyCtx] = await Promise.all([
      ragSearch(prompt, clientId),
      getBriefingsContext('mahdi'),
      getShopifyContext(clientId),
    ]);
    const context = [ragContext, briefingsCtx, shopifyCtx].filter(Boolean).join('\n\n');
    const result = await aiCall(`You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world class copywriter and email marketer. You write email sequences, SMS campaigns, and ad copy that converts — all in the exact brand voice of each client. You are Mahdi — never identify as anyone else or mention Claude.`, prompt, context);
    res.json({ result });
  } catch (e) {
    console.error('Mahdi error:', e.message);
    res.status(500).json({ error: 'Mahdi failed', details: e.message });
  }
});

app.post('/fatima', async (req, res) => {
  const { prompt, clientId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const [ragContext, briefingsCtx, shopifyCtx] = await Promise.all([
      ragSearch(prompt, clientId),
      getBriefingsContext('fatima'),
      getShopifyContext(clientId),
    ]);
    const context = [ragContext, briefingsCtx, shopifyCtx].filter(Boolean).join('\n\n');
    const result = await aiCall(`You are Fatima, the Operations Manager AI at Sales Scales. You are systematic, detail-oriented, and keep everything running smoothly. You monitor platform operations, track client health, identify bottlenecks, and generate operational reports. You are Fatima — never identify as anyone else or mention Claude.`, prompt, context);
    res.json({ result });
  } catch (e) {
    console.error('Fatima error:', e.message);
    res.status(500).json({ error: 'Fatima failed', details: e.message });
  }
});

app.post('/zainab', async (req, res) => {
  const { prompt, clientId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const [ragContext, briefingsCtx, shopifyCtx] = await Promise.all([
      ragSearch(prompt, clientId),
      getBriefingsContext('zainab'),
      getShopifyContext(clientId),
    ]);
    const context = [ragContext, briefingsCtx, shopifyCtx].filter(Boolean).join('\n\n');
    const result = await aiCall(`You are Zainab, the Client Partner AI at Sales Scales. You are warm, professional, and deeply care about client success. You manage client relationships, handle onboarding, write client communications, and ensure every client feels valued and supported. You are Zainab — never identify as anyone else or mention Claude.`, prompt, context);
    res.json({ result });
  } catch (e) {
    console.error('Zainab error:', e.message);
    res.status(500).json({ error: 'Zainab failed', details: e.message });
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
    // Handle DMs
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

    // Handle comments
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

// Meta webhook verification (GET) + event receiver (POST)
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

// ─── ANALYTICS STATS ─────────────────────────────────────
app.get('/analytics/stats', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      emailsRes, smsRes, whatsappRes,
      contactsRes, enrollmentsRes,
      activeSeqRes, totalContactsRes,
      activeEnrollmentsRes, dealsRes,
      inboundRes,
    ] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('direction', 'outbound').eq('channel', 'Email').gte('created_at', monthStart),
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('direction', 'outbound').eq('channel', 'SMS').gte('created_at', monthStart),
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('direction', 'outbound').eq('channel', 'WhatsApp').gte('created_at', monthStart),
      supabase.from('contacts').select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart),
      supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true })
        .gte('enrolled_at', monthStart),
      supabase.from('workflows').select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase.from('pipeline_deals').select('value, stage'),
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('direction', 'inbound').gte('created_at', monthStart),
    ]);

    const deals = dealsRes.data || [];
    const pipelineValue = deals.reduce((s, d) => s + (d.value || 0), 0);
    const convertedValue = deals.filter(d => d.stage === 'Converted').reduce((s, d) => s + (d.value || 0), 0);

    res.json({
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      emailsSentThisMonth: emailsRes.count || 0,
      smsSentThisMonth: smsRes.count || 0,
      whatsappSentThisMonth: whatsappRes.count || 0,
      contactsAddedThisMonth: contactsRes.count || 0,
      enrollmentsThisMonth: enrollmentsRes.count || 0,
      activeSequences: activeSeqRes.count || 0,
      totalContacts: totalContactsRes.count || 0,
      activeEnrollments: activeEnrollmentsRes.count || 0,
      inboundThisMonth: inboundRes.count || 0,
      pipelineValue,
      convertedValue,
    });
  } catch (e) {
    console.error('Analytics stats error:', e.message);
    res.status(500).json({ error: 'Failed to fetch analytics stats', details: e.message });
  }
});

// ─── REVENUE STATS ────────────────────────────────────────
app.get('/revenue/stats', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const [
      { data: deals },
      { data: allEnrollments },
      { data: workflows },
      { data: outboundMessages },
      { data: clients },
    ] = await Promise.all([
      supabase.from('pipeline_deals').select('id, value, stage, client_id, created_at'),
      supabase.from('workflow_enrollments').select('id, workflow_id, client_id, status, enrolled_at, completed_at'),
      supabase.from('workflows').select('id, name, trigger_type, client_id'),
      supabase.from('messages').select('id, channel, client_id, created_at').eq('direction', 'outbound').gte('created_at', monthStart),
      supabase.from('clients').select('id, name'),
    ]);

    const convertedDeals = (deals || []).filter(d => d.stage === 'Converted');
    const thisMonthDeals = convertedDeals.filter(d => d.created_at && d.created_at >= monthStart);
    const lastMonthDeals = convertedDeals.filter(d => d.created_at && d.created_at >= lastMonthStart && d.created_at < monthStart);
    const totalRevenue = thisMonthDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const lastMonthRevenue = lastMonthDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);

    const thisMonthEnrollments = (allEnrollments || []).filter(e => e.enrolled_at && e.enrolled_at >= monthStart);
    const completedThisMonth = thisMonthEnrollments.filter(e => e.status === 'completed').length;

    // Channel breakdown — outbound message counts → proportional revenue attribution
    const channelCounts = {};
    for (const m of (outboundMessages || [])) {
      const ch = (m.channel || 'other').toLowerCase();
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    }
    const CHANNELS = ['email', 'sms', 'whatsapp', 'voice'];
    const totalTracked = CHANNELS.reduce((s, ch) => s + (channelCounts[ch] || 0), 0) || 1;
    const byChannel = CHANNELS.map(ch => ({
      channel: ch.charAt(0).toUpperCase() + ch.slice(1),
      sent: channelCounts[ch] || 0,
      revenue: Math.round((channelCounts[ch] || 0) / totalTracked * totalRevenue),
    }));

    // Trigger breakdown — group all enrollments by workflow trigger_type
    const triggerMap = {};
    for (const e of (allEnrollments || [])) {
      const wf = (workflows || []).find(w => w.id === e.workflow_id);
      const t = wf?.trigger_type || 'Manual';
      if (!triggerMap[t]) triggerMap[t] = { trigger: t, enrolled: 0, completed: 0 };
      triggerMap[t].enrolled++;
      if (e.status === 'completed') triggerMap[t].completed++;
    }
    const byTrigger = Object.values(triggerMap)
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 7)
      .map(t => ({ ...t, conversionRate: t.enrolled > 0 ? Math.round((t.completed / t.enrolled) * 100) : 0 }));

    // Top sequences — by conversion rate, min 1 enrollment
    const topSequences = (workflows || []).map(wf => {
      const wfEnrollments = (allEnrollments || []).filter(e => e.workflow_id === wf.id);
      const completed = wfEnrollments.filter(e => e.status === 'completed').length;
      const enrolled = wfEnrollments.length;
      const client = (clients || []).find(c => c.id === wf.client_id);
      return {
        id: wf.id,
        name: wf.name,
        trigger: wf.trigger_type,
        clientName: client?.name || '—',
        enrolled,
        completed,
        conversionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
      };
    })
      .filter(s => s.enrolled > 0)
      .sort((a, b) => b.conversionRate - a.conversionRate || b.enrolled - a.enrolled)
      .slice(0, 8);

    // Per client breakdown — pipeline revenue + enrollment stats
    const clientRevenueMap = {};
    for (const d of convertedDeals) {
      if (!clientRevenueMap[d.client_id]) clientRevenueMap[d.client_id] = { revenue: 0, deals: 0 };
      clientRevenueMap[d.client_id].revenue += Number(d.value) || 0;
      clientRevenueMap[d.client_id].deals++;
    }
    const clientEnrollMap = {};
    for (const e of (allEnrollments || [])) {
      if (!clientEnrollMap[e.client_id]) clientEnrollMap[e.client_id] = { enrolled: 0, completed: 0 };
      clientEnrollMap[e.client_id].enrolled++;
      if (e.status === 'completed') clientEnrollMap[e.client_id].completed++;
    }
    const byClient = (clients || [])
      .map(c => ({
        id: c.id,
        name: c.name,
        revenue: clientRevenueMap[c.id]?.revenue || 0,
        deals: clientRevenueMap[c.id]?.deals || 0,
        enrolled: clientEnrollMap[c.id]?.enrolled || 0,
        completed: clientEnrollMap[c.id]?.completed || 0,
        conversionRate: clientEnrollMap[c.id]?.enrolled > 0
          ? Math.round((clientEnrollMap[c.id].completed / clientEnrollMap[c.id].enrolled) * 100)
          : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.enrolled - a.enrolled);

    const maxRevenue = byClient.reduce((m, c) => Math.max(m, c.revenue), 0) || 1;

    res.json({
      thisMonth: {
        totalRevenue,
        totalDeals: thisMonthDeals.length,
        completedEnrollments: completedThisMonth,
        totalEnrollments: thisMonthEnrollments.length,
        revenueChange: lastMonthRevenue > 0
          ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
          : null,
        conversionRate: thisMonthEnrollments.length > 0
          ? Math.round((completedThisMonth / thisMonthEnrollments.length) * 100)
          : 0,
      },
      byChannel,
      byTrigger,
      topSequences,
      byClient,
      maxRevenue,
    });
  } catch (e) {
    console.error('Revenue stats error:', e.message);
    res.status(500).json({ error: 'Failed to fetch revenue stats', details: e.message });
  }
});

// ─── REVENUE DASHBOARD ────────────────────────────────────
app.get('/revenue/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const [
      { data: deals },
      { data: allEnrollments },
      { data: workflows },
      { data: outboundMessages },
      { data: clients },
    ] = await Promise.all([
      supabase.from('pipeline_deals').select('id, value, stage, client_id, created_at'),
      supabase.from('workflow_enrollments').select('id, workflow_id, client_id, status, enrolled_at, completed_at'),
      supabase.from('workflows').select('id, name, trigger_type, client_id'),
      supabase.from('messages').select('id, channel, client_id, created_at').eq('direction', 'outbound').gte('created_at', monthStart),
      supabase.from('clients').select('id, name'),
    ]);

    const convertedDeals = (deals || []).filter(d => d.stage === 'Converted');
    const thisMonthDeals = convertedDeals.filter(d => d.created_at && d.created_at >= monthStart);
    const lastMonthDeals = convertedDeals.filter(d => d.created_at && d.created_at >= lastMonthStart && d.created_at < monthStart);
    const totalRevenue = thisMonthDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
    const lastMonthRevenue = lastMonthDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);

    const thisMonthEnrollments = (allEnrollments || []).filter(e => e.enrolled_at && e.enrolled_at >= monthStart);
    const completedThisMonth = thisMonthEnrollments.filter(e => e.status === 'completed').length;

    // Channel breakdown — outbound message volume + proportional revenue attribution
    const channelCounts = {};
    for (const m of (outboundMessages || [])) {
      const ch = (m.channel || 'other').toLowerCase();
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    }
    const CHANNELS = ['email', 'sms', 'whatsapp', 'voice'];
    const totalTracked = CHANNELS.reduce((s, ch) => s + (channelCounts[ch] || 0), 0) || 1;
    const byChannel = CHANNELS.map(ch => ({
      channel: ch.charAt(0).toUpperCase() + ch.slice(1),
      sent: channelCounts[ch] || 0,
      revenue: Math.round((channelCounts[ch] || 0) / totalTracked * totalRevenue),
    }));

    // Sequence type breakdown — map trigger_type to readable label
    const TRIGGER_LABELS = {
      cart_abandoned: 'Cart Recovery',
      post_purchase: 'Post Purchase',
      win_back: 'Win-Back',
      welcome: 'Welcome',
    };
    const triggerMap = {};
    for (const e of (allEnrollments || [])) {
      const wf = (workflows || []).find(w => w.id === e.workflow_id);
      const raw = wf?.trigger_type || 'manual';
      const label = TRIGGER_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (!triggerMap[label]) triggerMap[label] = { trigger: label, enrolled: 0, completed: 0 };
      triggerMap[label].enrolled++;
      if (e.status === 'completed') triggerMap[label].completed++;
    }
    const byTrigger = Object.values(triggerMap)
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 7)
      .map(t => ({ ...t, conversionRate: t.enrolled > 0 ? Math.round((t.completed / t.enrolled) * 100) : 0 }));

    // Top sequences by conversion rate
    const topSequences = (workflows || []).map(wf => {
      const wfEnrollments = (allEnrollments || []).filter(e => e.workflow_id === wf.id);
      const completed = wfEnrollments.filter(e => e.status === 'completed').length;
      const enrolled = wfEnrollments.length;
      const client = (clients || []).find(c => c.id === wf.client_id);
      const raw = wf.trigger_type || '';
      return {
        id: wf.id,
        name: wf.name,
        trigger: TRIGGER_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        clientName: client?.name || '—',
        enrolled,
        completed,
        conversionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
      };
    })
      .filter(s => s.enrolled > 0)
      .sort((a, b) => b.conversionRate - a.conversionRate || b.enrolled - a.enrolled)
      .slice(0, 8);

    // Per-client breakdown — pipeline revenue + enrollment stats
    const clientRevenueMap = {};
    for (const d of convertedDeals) {
      if (!clientRevenueMap[d.client_id]) clientRevenueMap[d.client_id] = { revenue: 0, deals: 0 };
      clientRevenueMap[d.client_id].revenue += Number(d.value) || 0;
      clientRevenueMap[d.client_id].deals++;
    }
    const clientEnrollMap = {};
    for (const e of (allEnrollments || [])) {
      if (!clientEnrollMap[e.client_id]) clientEnrollMap[e.client_id] = { enrolled: 0, completed: 0 };
      clientEnrollMap[e.client_id].enrolled++;
      if (e.status === 'completed') clientEnrollMap[e.client_id].completed++;
    }
    const byClient = (clients || [])
      .map(c => ({
        id: c.id,
        name: c.name,
        revenue: clientRevenueMap[c.id]?.revenue || 0,
        deals: clientRevenueMap[c.id]?.deals || 0,
        enrolled: clientEnrollMap[c.id]?.enrolled || 0,
        completed: clientEnrollMap[c.id]?.completed || 0,
        conversionRate: clientEnrollMap[c.id]?.enrolled > 0
          ? Math.round((clientEnrollMap[c.id].completed / clientEnrollMap[c.id].enrolled) * 100)
          : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.enrolled - a.enrolled);

    const maxRevenue = byClient.reduce((m, c) => Math.max(m, c.revenue), 0) || 1;

    res.json({
      thisMonth: {
        totalRevenue,
        totalDeals: thisMonthDeals.length,
        completedEnrollments: completedThisMonth,
        totalEnrollments: thisMonthEnrollments.length,
        revenueChange: lastMonthRevenue > 0
          ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
          : null,
        conversionRate: thisMonthEnrollments.length > 0
          ? Math.round((completedThisMonth / thisMonthEnrollments.length) * 100)
          : 0,
      },
      byChannel,
      byTrigger,
      topSequences,
      byClient,
      maxRevenue,
    });
  } catch (e) {
    console.error('Revenue dashboard error:', e.message);
    res.status(500).json({ error: 'Failed to fetch revenue data', details: e.message });
  }
});

// ─── CASE STUDIES, REFERRALS & SEQUENCE FEEDBACK ─────────

app.post('/casestudies/create', async (req, res) => {
  try {
    const { client_id, title, results, timeline } = req.body;
    if (!title || !results) return res.status(400).json({ error: 'title and results are required' });
    const { data: client } = await supabase.from('clients').select('name, niche').eq('id', client_id).maybeSingle();
    const clientName = client?.name || 'the client';
    const niche = client?.niche || 'ecommerce';
    const context = await ragSearch(title + ' ' + results, client_id);
    const caseStudy = await aiCall(
      `You are Hussain, Intelligence & Strategy AI at Sales Scales. You write compelling, data-driven case studies that showcase client wins. Write professionally and engagingly. Never break character or mention Claude.`,
      `Write a professional case study for ${clientName} (${niche}).
Title: ${title}
Results: ${results}
Timeline: ${timeline || 'not specified'}

Write with these sections:
1. Executive Summary (2-3 sentences, lead with the biggest result)
2. The Challenge (problem before Sales Scales)
3. Our Strategy (what we implemented — sequences, AI, automation)
4. Implementation (how we rolled it out)
5. The Results (specific numbers from the data)
6. Key Takeaways (3 bullet points)
7. Client Quote (realistic quote)`,
      context
    );
    const { data, error } = await supabase.from('case_studies').insert([{
      client_id: client_id || null, title, results, timeline: timeline || null, content: caseStudy, status: 'draft',
    }]).select();
    if (error) throw error;
    res.json({ case_study: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/casestudies/list', async (req, res) => {
  try {
    const { client_id } = req.query;
    let query = supabase.from('case_studies').select('*, clients(name)').order('created_at', { ascending: false });
    if (client_id) query = query.eq('client_id', client_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ case_studies: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/referrals/create', async (req, res) => {
  try {
    const { referrer_name, referrer_email, referred_business, notes } = req.body;
    if (!referrer_name || !referred_business) return res.status(400).json({ error: 'referrer_name and referred_business are required' });
    const { data, error } = await supabase.from('referrals').insert([{
      referrer_name, referrer_email: referrer_email || null, referred_business, notes: notes || null, status: 'pending',
    }]).select();
    if (error) throw error;
    res.json({ referral: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/referrals/list', async (req, res) => {
  try {
    const { data, error } = await supabase.from('referrals').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ referrals: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/referrals/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase.from('referrals').update({ status }).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ referral: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/sequences/feedback', async (req, res) => {
  try {
    const { workflow_id } = req.body;
    if (!workflow_id) return res.status(400).json({ error: 'workflow_id is required' });
    const { data: workflow } = await supabase.from('workflows').select('*, clients(name)').eq('id', workflow_id).maybeSingle();
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    const [totalR, completedR, cancelledR, activeR, stepsResult] = await Promise.all([
      supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow_id),
      supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow_id).eq('status', 'completed'),
      supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow_id).eq('status', 'cancelled'),
      supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow_id).eq('status', 'active'),
      supabase.from('workflow_steps').select('*').eq('workflow_id', workflow_id).order('step_order'),
    ]);
    const total = totalR.count || 0;
    const completed = completedR.count || 0;
    const cancelled = cancelledR.count || 0;
    const active = activeR.count || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const dropOffRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const stepList = stepsResult.data || [];
    const context = await ragSearch(workflow.trigger_type + ' sequence optimization', workflow.client_id);
    const analysis = await aiCall(
      `You are Hussain, Intelligence & Strategy AI at Sales Scales. You analyze automation sequence performance and deliver sharp, specific optimization recommendations. Be direct and data-driven. Never break character or mention Claude.`,
      `Analyze this sequence and provide improvement recommendations:

Sequence: ${workflow.name}
Client: ${workflow.clients?.name || 'Unknown'}
Trigger: ${workflow.trigger_type}

Performance:
- Enrolled: ${total} | Completed: ${completed} (${completionRate}%) | Dropped off: ${cancelled} (${dropOffRate}%) | Active: ${active}

Steps (${stepList.length}):
${stepList.map((s, i) => `Step ${i + 1}: ${s.step_type.toUpperCase()}${s.step_type === 'wait' ? ` — ${s.wait_hours}h wait` : s.subject ? ` — "${s.subject}"` : ''}`).join('\n') || 'No steps configured'}

Provide:
1. Performance Grade (A–F with reasoning)
2. Top 3 Problems hurting performance
3. Quick Wins (3 immediate changes)
4. Step-by-step recommendations
5. 30-Day projection if improvements made`,
      context
    );
    res.json({ analysis, stats: { total, completed, cancelled, active, completionRate, dropOffRate } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CONTRACT SYSTEM ──────────────────────────────────────
const TIER_SERVICE_MAP = {
  starter:    'AI-powered email marketing, SMS campaigns, workflow automation (up to 3 sequences), CRM contact management, monthly analytics report, and access to the full AI team (Hussain, Hassan, Ali, Mahdi, Fatima, Zainab)',
  growth:     'Everything in Starter, plus WhatsApp automation, unlimited sequences, Klaviyo integration, Meta Ads reporting, HubSpot CRM sync, weekly strategy calls, and priority AI team support',
  scale:      'Everything in Growth, plus dedicated account management, voice AI agents, custom workflow builds, Shopify live data integration, Canva & Higgsfield AI design briefs, competitor intelligence, and monthly executive reports',
  enterprise: 'Fully custom engagement — all platform features, white-label options, custom AI agent training, dedicated infrastructure, and a tailored SLA',
};

app.post('/contracts/create', async (req, res) => {
  const { client_id, tier, monthly_fee, start_date } = req.body;
  if (!client_id || !tier || !monthly_fee || !start_date)
    return res.status(400).json({ error: 'client_id, tier, monthly_fee, and start_date are required' });

  try {
    const { data: client } = await supabase.from('clients').select('id, name, niche').eq('id', client_id).maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const services = TIER_SERVICE_MAP[tier.toLowerCase()] || TIER_SERVICE_MAP.starter;
    const fmtFee = parseFloat(monthly_fee).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const fmtDate = new Date(start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

    const contractText = await aiCall(
      `You are Zainab, the Client Partner AI at Sales Scales. You draft professional, clear, and legally structured service agreements. You write in formal legal language, are thorough, and ensure both parties are fully protected. Never break character or mention Claude.`,
      `Generate a complete professional service agreement between Sales Scales (the Agency) and ${client.name} (the Client).

Contract Details:
- Client: ${client.name}${client.niche ? ` (${client.niche} industry)` : ''}
- Service Tier: ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan
- Monthly Fee: $${fmtFee} USD
- Commencement Date: ${fmtDate}
- Services Included: ${services}

Write the full agreement with all of these sections, each clearly headed:

1. PARTIES
   Full identification: Sales Scales (the Agency, a digital marketing and AI automation company) and ${client.name} (the Client). Include today's date as the agreement date.

2. SERVICES
   Describe the ${tier} tier services in detail. Be specific about what is and is not included.

3. PAYMENT TERMS
   Monthly fee of $${fmtFee} USD. Due on the 1st of each calendar month. 5-day grace period. 1.5% monthly late fee on overdue amounts. Payment via bank transfer or agreed method.

4. TERM AND RENEWAL
   Commences ${fmtDate}. Month-to-month, automatically renewing unless either party provides written notice of cancellation.

5. INTELLECTUAL PROPERTY
   All client data, brand assets, and existing intellectual property remain the exclusive property of the Client. Sales Scales retains all IP in its platform, AI systems, workflows, and methodologies.

6. CONFIDENTIALITY
   Mutual non-disclosure covering all business information, strategies, data, and communications. Obligation survives termination indefinitely.

7. PERFORMANCE AND RESULTS
   Agency commits to best-efforts service delivery. Marketing results depend on many factors outside the Agency's control and are not guaranteed.

8. LIMITATION OF LIABILITY
   Neither party liable for indirect or consequential damages. Agency's total liability capped at three (3) months of fees paid.

9. TERMINATION
   Either party may terminate with 30 days written notice. Agency may terminate immediately for non-payment exceeding 15 days. Upon termination, all client data is returned within 14 days.

10. GOVERNING LAW
    This agreement is governed by the laws of the State of Kuwait. Any disputes shall be resolved through arbitration in Kuwait City.

11. ENTIRE AGREEMENT
    This agreement constitutes the entire understanding between the parties and supersedes all prior communications, negotiations, and agreements relating to the subject matter.

12. SIGNATURES
    Include signature blocks for both parties with: Name, Title, Date, Signature lines. Agency signatory: Yousef Al-Neamah, Founder & CEO, Sales Scales.

Write the full agreement text. Use formal legal language throughout. Do not include any commentary outside the contract itself.`,
      ''
    );

    const { data: contract, error: insertErr } = await supabase.from('contracts').insert({
      client_id,
      client_name: client.name,
      tier,
      monthly_fee: parseFloat(monthly_fee),
      start_date,
      status: 'draft',
      contract_text: contractText,
    }).select().single();

    if (insertErr) throw insertErr;
    res.json({ contract });
  } catch (e) {
    console.error('contracts/create error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/contracts/list', async (req, res) => {
  const { client_id } = req.query;
  try {
    let q = supabase
      .from('contracts')
      .select('id, client_id, client_name, tier, monthly_fee, start_date, status, contract_text, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (client_id) q = q.eq('client_id', client_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ contracts: data || [] });
  } catch (e) {
    console.error('contracts/list error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/contracts/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['draft', 'sent', 'signed', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  try {
    const { data, error } = await supabase.from('contracts').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    res.json({ contract: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── HUBSPOT MCP ──────────────────────────────────────────
const HUBSPOT_API = 'https://api.hubapi.com';

app.post('/hubspot/sync-contacts', async (req, res) => {
  const { client_id } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { data: client } = await supabase.from('clients').select('id, name, hubspot_api_key').eq('id', client_id).maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.hubspot_api_key)
      return res.status(400).json({ error: 'HubSpot API key not configured. Add it in Settings → Email Domains.' });

    const { data: contacts } = await supabase
      .from('contacts')
      .select('first_name, last_name, email, phone, pipeline_stage, source')
      .eq('client_id', client_id)
      .not('email', 'is', null);

    if (!contacts || contacts.length === 0)
      return res.json({ synced: 0, failed: 0, total: 0, message: 'No contacts with email addresses to sync.' });

    const hsHeaders = { Authorization: `Bearer ${client.hubspot_api_key}`, 'Content-Type': 'application/json' };
    const BATCH = 100;
    let synced = 0, failed = 0;

    for (let i = 0; i < contacts.length; i += BATCH) {
      const slice = contacts.slice(i, i + BATCH);
      const inputs = slice.map(c => ({
        idProperty: 'email',
        id: c.email,
        properties: {
          email:       c.email,
          firstname:   c.first_name  || '',
          lastname:    c.last_name   || '',
          phone:       c.phone       || '',
          hs_lead_status: c.pipeline_stage || '',
          lead_source: c.source      || '',
        },
      }));
      try {
        await axios.post(`${HUBSPOT_API}/crm/v3/objects/contacts/batch/upsert`, { inputs }, { headers: hsHeaders });
        synced += slice.length;
      } catch (batchErr) {
        console.error('HubSpot batch upsert error:', batchErr.response?.data?.message || batchErr.message);
        failed += slice.length;
      }
    }

    res.json({ synced, failed, total: contacts.length });
  } catch (e) {
    console.error('hubspot/sync-contacts error:', e.message);
    res.status(500).json({ error: e.response?.data?.message || e.message });
  }
});

app.get('/hubspot/contact-count', async (req, res) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });
  try {
    const { count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client_id)
      .not('email', 'is', null);
    res.json({ count: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── AUTOMATED MONTHLY REPORTS ────────────────────────────
app.post('/reports/generate', async (req, res) => {
  const { client_id } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const period = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const { data: client } = await supabase.from('clients').select('id, name, niche, tier').eq('id', client_id).maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const [
      emailRes, smsRes, waRes, contactsRes, enrollRes, seqRes,
      ragContext, briefingsCtx,
    ] = await Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('channel', 'email').eq('direction', 'outbound').gte('created_at', monthStart),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('channel', 'sms').eq('direction', 'outbound').gte('created_at', monthStart),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('channel', 'whatsapp').eq('direction', 'outbound').gte('created_at', monthStart),
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', client_id).gte('created_at', monthStart),
      supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', client_id).gte('enrolled_at', monthStart),
      supabase.from('workflows').select('name, enrolled_count').eq('client_id', client_id).eq('status', 'active').order('enrolled_count', { ascending: false }).limit(1),
      ragSearch(`monthly report ${client.name}`, client_id),
      getBriefingsContext('zainab'),
    ]);

    const emailsSent   = emailRes.count   || 0;
    const smsSent      = smsRes.count     || 0;
    const whatsappSent = waRes.count      || 0;
    const contactsAdded = contactsRes.count || 0;
    const enrollments  = enrollRes.count  || 0;
    const topSequence  = seqRes.data?.[0]?.name || 'None';

    const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');

    const summary = await aiCall(
      `You are Zainab, the Client Partner AI at Sales Scales. You are warm, professional, and deeply invested in each client's success. You write monthly performance reports that are honest, insightful, and actionable. You celebrate wins, identify opportunities, and provide clear next steps. Your reports feel like they come from a trusted advisor who knows the client's business deeply. Never break character or mention Claude.`,
      `Write a comprehensive monthly performance report for ${client.name} (${client.niche || 'ecommerce'}) for ${period}.

Performance Data:
- Emails sent: ${emailsSent}
- SMS sent: ${smsSent}
- WhatsApp messages sent: ${whatsappSent}
- New contacts added: ${contactsAdded}
- Workflow enrollments: ${enrollments}
- Top performing sequence: ${topSequence}

Write a 5-section report with these exact headings:
1. MONTHLY OVERVIEW — 2–3 sentences summarising the month's performance in an honest, encouraging tone
2. CHANNEL PERFORMANCE — specific breakdown of email, SMS, and WhatsApp activity and what the numbers mean
3. GROWTH & CONTACTS — analysis of new contacts added and the pipeline impact
4. SEQUENCE PERFORMANCE — commentary on workflow activity and the top sequence
5. RECOMMENDATIONS FOR NEXT MONTH — 3–5 specific, actionable recommendations Yousef and the team should execute

Use the numbers directly. Be specific. Make the client feel supported and excited about what's coming next month.`,
      context
    );

    const { data: report, error: insertErr } = await supabase.from('reports').insert({
      client_id,
      period,
      emails_sent:           emailsSent,
      sms_sent:              smsSent,
      whatsapp_sent:         whatsappSent,
      contacts_added:        contactsAdded,
      workflow_enrollments:  enrollments,
      top_sequence:          topSequence,
      summary,
    }).select().single();

    if (insertErr) throw insertErr;
    res.json({ report });
  } catch (e) {
    console.error('reports/generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/reports/list', async (req, res) => {
  const { client_id } = req.query;
  try {
    let q = supabase.from('reports').select('id, client_id, period, emails_sent, sms_sent, whatsapp_sent, contacts_added, workflow_enrollments, top_sequence, summary, created_at, clients(name)').order('created_at', { ascending: false }).limit(100);
    if (client_id) q = q.eq('client_id', client_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ reports: data || [] });
  } catch (e) {
    console.error('reports/list error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── STRIPE BILLING ───────────────────────────────────────
const STRIPE_API = 'https://api.stripe.com/v1';
const stripeHeaders = () => ({ Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' });
const toQs = (obj) => new URLSearchParams(obj).toString();

app.post('/stripe/create-subscription', async (req, res) => {
  const { client_id, price_id, payment_method_id } = req.body;
  if (!client_id || !price_id || !payment_method_id)
    return res.status(400).json({ error: 'client_id, price_id, and payment_method_id are required' });
  if (!process.env.STRIPE_SECRET_KEY)
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  try {
    const { data: client } = await supabase.from('clients').select('id, name, stripe_customer_id').eq('id', client_id).maybeSingle();
    if (!client) return res.status(404).json({ error: 'Client not found' });

    let customerId = client.stripe_customer_id;
    if (!customerId) {
      const custResp = await axios.post(`${STRIPE_API}/customers`, toQs({ name: client.name }), { headers: stripeHeaders() });
      customerId = custResp.data.id;
      await supabase.from('clients').update({ stripe_customer_id: customerId }).eq('id', client_id);
    }

    await axios.post(`${STRIPE_API}/payment_methods/${payment_method_id}/attach`, toQs({ customer: customerId }), { headers: stripeHeaders() });
    await axios.post(`${STRIPE_API}/customers/${customerId}`, toQs({ 'invoice_settings[default_payment_method]': payment_method_id }), { headers: stripeHeaders() });

    const subResp = await axios.post(`${STRIPE_API}/subscriptions`,
      toQs({ customer: customerId, 'items[0][price]': price_id, default_payment_method: payment_method_id }),
      { headers: stripeHeaders() }
    );
    res.json({ ok: true, subscription_id: subResp.data.id, customer_id: customerId, status: subResp.data.status });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    console.error('Stripe create-subscription error:', msg);
    res.status(500).json({ error: msg });
  }
});

app.get('/stripe/billing', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY)
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  try {
    const { data: clients } = await supabase.from('clients').select('id, name, tier, status, stripe_customer_id').order('name');
    if (!clients) return res.json({ clients: [] });

    const withStripe = await Promise.all(clients.map(async (c) => {
      if (!c.stripe_customer_id) return { ...c, subscription_status: null, subscription_id: null };
      try {
        const subResp = await axios.get(`${STRIPE_API}/subscriptions?customer=${c.stripe_customer_id}&limit=1&status=all`, { headers: stripeHeaders() });
        const sub = subResp.data.data?.[0];
        return { ...c, subscription_status: sub?.status || null, subscription_id: sub?.id || null, current_period_end: sub?.current_period_end || null };
      } catch {
        return { ...c, subscription_status: 'error', subscription_id: null };
      }
    }));

    res.json({ clients: withStripe });
  } catch (e) {
    console.error('Stripe billing error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── HIGGSFIELD MCP ───────────────────────────────────────
const HIGGSFIELD_URLS = {
  product_showcase: 'https://higgsfield.ai/',
  ad_creative:      'https://higgsfield.ai/',
  brand_story:      'https://higgsfield.ai/',
};

const HIGGSFIELD_LABELS = {
  product_showcase: 'Product Showcase',
  ad_creative:      'Ad Creative',
  brand_story:      'Brand Story',
};

const HIGGSFIELD_SPECS = {
  product_showcase: '15–30s · 9:16 or 16:9 · cinematic product focus',
  ad_creative:      '6–15s · 9:16 · high-impact, scroll-stopping',
  brand_story:      '30–60s · 16:9 · narrative-driven, emotional',
};

app.post('/higgsfield/create-video', async (req, res) => {
  const { client_id, video_type = 'product_showcase', prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!HIGGSFIELD_LABELS[video_type]) {
    return res.status(400).json({ error: `Invalid video_type. Use: ${Object.keys(HIGGSFIELD_LABELS).join(', ')}` });
  }

  try {
    let clientName = '';
    if (client_id) {
      const { data: client } = await supabase.from('clients')
        .select('name')
        .eq('id', client_id)
        .maybeSingle();
      clientName = client?.name || '';
    }

    const [ragContext, briefingsCtx] = await Promise.all([
      ragSearch(prompt, client_id),
      getBriefingsContext('mahdi'),
    ]);
    const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');

    const brief = await aiCall(
      `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world-class video creative director who specialises in AI-generated video content for ecommerce brands. You produce precise, cinematic, production-ready video briefs optimised for Higgsfield.ai. You are Mahdi — never mention Claude.`,
      `Create a detailed Higgsfield.ai video production brief for the following:

Client: ${clientName || 'Not specified'}
Video Type: ${HIGGSFIELD_LABELS[video_type]}
Technical Specs: ${HIGGSFIELD_SPECS[video_type]}
Request: ${prompt}

${context ? `Brand & client context:\n${context}\n` : ''}
Your brief must include:
1. **Concept** — One-sentence creative hook and story angle
2. **Scene Breakdown** — Shot-by-shot description (3–6 scenes with timing)
3. **Visual Style** — Camera movement, lighting mood, colour grade, aesthetic references
4. **Motion Direction** — Specific AI motion prompts for Higgsfield (zoom, pan, pull, orbit, etc.)
5. **Text Overlays** — All on-screen text, timing, placement, and animation style
6. **Audio Mood** — Music tempo, genre, and sound design direction
7. **Call to Action** — Final frame CTA — exact wording and visual treatment

Make every scene description specific enough to paste directly into Higgsfield as a generation prompt. Output must be immediately usable.`,
      context
    );

    res.json({
      brief,
      higgsfield_url: HIGGSFIELD_URLS[video_type],
      video_type,
      video_label: HIGGSFIELD_LABELS[video_type],
      specs: HIGGSFIELD_SPECS[video_type],
    });
  } catch (e) {
    console.error('Higgsfield create-video error:', e.message);
    res.status(500).json({ error: 'Failed to generate video brief', details: e.message });
  }
});

// ─── CANVA MCP ────────────────────────────────────────────
const CANVA_URLS = {
  social_post:   'https://www.canva.com/social-media-graphics/templates/',
  email_header:  'https://www.canva.com/email-headers/templates/',
  ad_banner:     'https://www.canva.com/banner-ads/templates/',
};

const CANVA_LABELS = {
  social_post:  'Social Post (1080×1080)',
  email_header: 'Email Header (600×200)',
  ad_banner:    'Ad Banner (1200×628)',
};

app.post('/canva/create-design', async (req, res) => {
  const { client_id, design_type = 'social_post', brand_colors = [], prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!CANVA_URLS[design_type]) return res.status(400).json({ error: `Invalid design_type. Use: ${Object.keys(CANVA_URLS).join(', ')}` });

  try {
    let canva_brand_kit_id = null;
    let clientName = '';
    if (client_id) {
      const { data: client } = await supabase.from('clients')
        .select('name, canva_brand_kit_id')
        .eq('id', client_id)
        .maybeSingle();
      canva_brand_kit_id = client?.canva_brand_kit_id || null;
      clientName = client?.name || '';
    }

    const [ragContext, briefingsCtx] = await Promise.all([
      ragSearch(prompt, client_id),
      getBriefingsContext('mahdi'),
    ]);
    const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');

    const colorBlock = brand_colors.length > 0
      ? `Brand Colors: ${brand_colors.join(', ')}`
      : 'Brand Colors: not specified';

    const brief = await aiCall(
      `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world-class creative director and copywriter who specialises in visual content for ecommerce brands. You produce precise, actionable design briefs. You are Mahdi — never mention Claude.`,
      `Create a detailed Canva design brief for the following:

Client: ${clientName || 'Not specified'}
Design Type: ${CANVA_LABELS[design_type]}
${colorBlock}
Request: ${prompt}

${context ? `Brand & client context:\n${context}\n` : ''}
Your brief must include:
1. **Concept** — One sentence creative direction
2. **Visual Layout** — Exact layout structure (background, focal elements, placement)
3. **Color Usage** — How to apply each brand color and where
4. **Typography** — Font style, size hierarchy, and what text goes where
5. **Copy** — All text elements, headlines, subheads, CTA — ready to paste into Canva
6. **Imagery** — What photo or graphic style to use
7. **Mood** — 3 adjectives that define the feel

Be specific and production-ready. A designer should be able to open Canva and execute this immediately.`,
      context
    );

    const canva_url = CANVA_URLS[design_type];

    res.json({
      brief,
      canva_url,
      design_type,
      design_label: CANVA_LABELS[design_type],
      canva_brand_kit_id,
    });
  } catch (e) {
    console.error('Canva create-design error:', e.message);
    res.status(500).json({ error: 'Failed to generate design brief', details: e.message });
  }
});

// ─── WHISPER TRANSCRIPTION ────────────────────────────────
app.post('/whisper/transcribe', async (req, res) => {
  const { audio_base64, filename, mime_type } = req.body;
  if (!audio_base64) return res.status(400).json({ error: 'audio_base64 required' });
  try {
    const FormData = require('form-data');
    const audioBuffer = Buffer.from(audio_base64, 'base64');
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: filename || 'recording.mp3',
      contentType: mime_type || 'audio/mpeg',
    });
    form.append('model', 'whisper-1');
    const { data } = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders(),
      },
      maxBodyLength: 25 * 1024 * 1024,
    });
    res.json({ text: data.text || '' });
  } catch (e) {
    console.error('Whisper transcribe error:', e.message);
    res.status(500).json({ error: 'Transcription failed', details: e.response?.data?.error?.message || e.message });
  }
});

// ─── COMPETITOR ANALYSIS ──────────────────────────────────
app.post('/competitor/analyze', async (req, res) => {
  const { facebook_page_url, client_id } = req.body;
  if (!facebook_page_url) return res.status(400).json({ error: 'facebook_page_url required' });
  try {
    const ragContext = await ragSearch(`competitor analysis ecommerce agency positioning`, client_id);
    const analysis = await aiCall(
      `You are Hussain, Intelligence & Strategy AI for Sales Scales — a high-ticket ecommerce growth agency. You are a sharp, data-driven analyst with a founder mindset. You never break character.`,
      `Analyze this competitor based on their Facebook page URL: ${facebook_page_url}

Provide a structured competitive intelligence report covering:
1. Likely brand positioning and core value proposition
2. Target audience and customer segments
3. Estimated price point and market tier (budget / mid-market / premium / high-ticket)
4. Probable marketing channels, ad style, and messaging tone
5. Key weaknesses and vulnerabilities we can exploit
6. Strategic angles for Sales Scales to win against them

Be direct, specific, and actionable. Think like a founder preparing for battle.`,
      ragContext
    );
    res.json({ analysis });
  } catch (e) {
    console.error('Competitor analyze error:', e.message);
    res.status(500).json({ error: 'Analysis failed', details: e.message });
  }
});

// ─── META MCP ─────────────────────────────────────────────
app.post('/meta/ad-stats', async (req, res) => {
  const { client_id } = req.body;
  try {
    const { data: client } = await supabase.from('clients')
      .select('meta_access_token, meta_ad_account_id')
      .eq('id', client_id)
      .maybeSingle();

    if (!client?.meta_access_token) return res.status(400).json({ error: 'Meta access token not configured for this client' });
    if (!client?.meta_ad_account_id) return res.status(400).json({ error: 'Meta ad account ID not configured for this client' });

    const token = client.meta_access_token;
    const accountId = client.meta_ad_account_id.startsWith('act_') ? client.meta_ad_account_id : `act_${client.meta_ad_account_id}`;
    const base = 'https://graph.facebook.com/v21.0';

    const [accountRes, adsRes] = await Promise.all([
      axios.get(`${base}/${accountId}/insights`, {
        params: {
          access_token: token,
          fields: 'spend,impressions,clicks,ctr,purchase_roas,actions',
          date_preset: 'last_30_days',
          level: 'account',
        },
      }).catch(e => ({ error: e })),
      axios.get(`${base}/${accountId}/insights`, {
        params: {
          access_token: token,
          fields: 'ad_name,ad_id,spend,impressions,clicks,ctr,purchase_roas',
          date_preset: 'last_30_days',
          level: 'ad',
          sort: '["spend_descending"]',
          limit: 5,
        },
      }).catch(e => ({ error: e })),
    ]);

    if (accountRes.error) {
      const status = accountRes.error.response?.status;
      const errCode = accountRes.error.response?.data?.error?.code;
      if (status === 401 || status === 403 || errCode === 190 || errCode === 102) {
        return res.status(401).json({ error: 'Invalid Meta access token' });
      }
      throw accountRes.error;
    }

    const accountData = accountRes.data?.data?.[0] || {};
    const roasArr = accountData.purchase_roas || [];
    const roas = roasArr.length > 0 ? parseFloat(roasArr[0]?.value || 0) : null;

    const topAds = (adsRes.error ? [] : (adsRes.data?.data || [])).map(ad => {
      const adRoasArr = ad.purchase_roas || [];
      return {
        id: ad.ad_id,
        name: ad.ad_name || '—',
        spend: parseFloat(ad.spend || 0),
        impressions: parseInt(ad.impressions || 0, 10),
        clicks: parseInt(ad.clicks || 0, 10),
        ctr: parseFloat(ad.ctr || 0),
        roas: adRoasArr.length > 0 ? parseFloat(adRoasArr[0]?.value || 0) : null,
      };
    });

    res.json({
      ok: true,
      spend: parseFloat(accountData.spend || 0),
      impressions: parseInt(accountData.impressions || 0, 10),
      clicks: parseInt(accountData.clicks || 0, 10),
      ctr: parseFloat(accountData.ctr || 0),
      roas,
      topAds,
    });
  } catch (e) {
    const status = e.response?.status;
    const errCode = e.response?.data?.error?.code;
    if (status === 401 || status === 403 || errCode === 190 || errCode === 102) {
      return res.status(401).json({ error: 'Invalid Meta access token' });
    }
    console.error('Meta ad stats error:', e.message);
    res.status(500).json({ error: 'Failed to fetch Meta data', details: e.message });
  }
});

// ─── KLAVIYO MCP ──────────────────────────────────────────
app.post('/klaviyo/stats', async (req, res) => {
  const { client_id } = req.body;
  try {
    let apiKey = req.body.api_key;
    if (!apiKey && client_id) {
      const { data: client } = await supabase.from('clients').select('klaviyo_api_key').eq('id', client_id).maybeSingle();
      apiKey = client?.klaviyo_api_key;
    }
    if (!apiKey) return res.status(400).json({ error: 'Klaviyo API key required' });

    const headers = {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: '2024-10-15',
      'Content-Type': 'application/json',
    };
    const base = 'https://a.klaviyo.com/api';

    const [campaignsRes, listsRes, reportRes] = await Promise.all([
      axios.get(`${base}/campaigns/?filter=equals(messages.channel,'email')&sort=-created_at&page[size]=10`, { headers }).catch(e => ({ error: e })),
      axios.get(`${base}/lists/?fields[list]=name,profile_count`, { headers }).catch(e => ({ error: e })),
      axios.post(`${base}/campaign-values-reports/`, {
        data: {
          type: 'campaign-values-report',
          attributes: {
            timeframe: { key: 'last_30_days' },
            conversion_metric_id: null,
            statistics: ['open_rate', 'click_rate', 'revenue'],
          },
        },
      }, { headers }).catch(e => ({ error: e })),
    ]);

    if (campaignsRes.error || listsRes.error) {
      const err = campaignsRes.error || listsRes.error;
      const status = err.response?.status;
      if (status === 401 || status === 403) return res.status(401).json({ error: 'Invalid Klaviyo API key' });
      throw err;
    }

    const campaigns = (campaignsRes.data?.data || []).map(c => ({
      id: c.id,
      name: c.attributes?.name || '',
      status: c.attributes?.status || '',
      sent_at: c.attributes?.send_time || null,
    }));

    const lists = (listsRes.data?.data || []).map(l => ({
      id: l.id,
      name: l.attributes?.name || '',
      profile_count: l.attributes?.profile_count || 0,
    }));

    const stats = reportRes.error ? {} : (reportRes.data?.data?.attributes?.results?.[0]?.statistics || {});
    const openRate = stats.open_rate != null ? Math.round(stats.open_rate * 100 * 10) / 10 : null;
    const clickRate = stats.click_rate != null ? Math.round(stats.click_rate * 100 * 10) / 10 : null;
    const revenue = stats.revenue != null ? stats.revenue : null;

    res.json({
      ok: true,
      openRate,
      clickRate,
      revenue,
      totalLists: lists.length,
      totalSubscribers: lists.reduce((s, l) => s + l.profile_count, 0),
      lists,
      recentCampaigns: campaigns,
    });
  } catch (e) {
    const status = e.response?.status;
    if (status === 401 || status === 403) return res.status(401).json({ error: 'Invalid Klaviyo API key' });
    console.error('Klaviyo stats error:', e.message);
    res.status(500).json({ error: 'Failed to fetch Klaviyo data', details: e.message });
  }
});

// ─── TEST ENDPOINTS ───────────────────────────────────────
// Hit GET /test/ping first — if it 404s, the server process is stale and needs restart.
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
    // Step 1: Verify client exists
    const { data: client } = await supabase.from('clients').select('id, name').eq('id', client_id).maybeSingle();
    if (!client) {
      step('ERROR: Client not found', { client_id });
      return res.status(422).json({ ok: false, error: 'Client not found', log });
    }
    step('Client verified', { name: client.name });

    // Step 2: Find or create contact
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

    // Step 3: Find active cart_abandoned workflow
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

    // Step 4: Load workflow steps for preview
    const { data: steps } = await supabase.from('workflow_steps')
      .select('step_order, step_type, subject, content, wait_hours')
      .eq('workflow_id', workflow.id)
      .order('step_order');
    step(`Workflow has ${steps?.length || 0} steps`, (steps || []).map(s => ({
      order: s.step_order, type: s.step_type,
      subject: s.subject || null,
      wait_hours: s.wait_hours || null
    })));

    // Step 5: Enroll contact (fires first step immediately)
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

    // Step 6: Log activity
    await supabase.from('activity').insert([{
      contact_id: contact.id, client_id,
      type: 'test_webhook',
      description: `Test webhook: cart_abandoned — enrolled in "${workflow.name}"`,
      created_at: new Date().toISOString()
    }]);
    step('Activity logged');

    // Step 7: Confirm first step result
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

app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('Scheduler active — checking workflow steps every 15 minutes');
});