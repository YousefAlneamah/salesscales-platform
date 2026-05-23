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

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    const { data: results } = await supabase.rpc('search_knowledge_base', {
      query_embedding: queryEmbedding,
      client_id_filter: clientId || null,
      match_count: 3
    });
    if (results && results.length > 0) {
      return results.map(r => `${r.title}:\n${r.content?.substring(0, 500)}`).join('\n\n');
    }
  } catch (e) {
    console.log('RAG search skipped:', e.message);
  }
  return '';
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

      } else if (currentStep.step_type === 'email' && contact.email && currentStep.content) {
        try {
          await sgMail.send({
            to: contact.email,
            from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
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
          await supabase.from('contacts').update({ last_activity: new Date(timestamp * 1000).toISOString() }).eq('id', contact.id);
        }
        if (eventType === 'click') {
          await supabase.from('workflow_enrollments')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('contact_id', contact.id).eq('status', 'active');
          console.log('Contact clicked — workflow completed for:', contact.first_name);
        }
        if (eventType === 'unsubscribe' || eventType === 'group_unsubscribe') {
          await supabase.from('contacts').update({ status: 'unsubscribed' }).eq('id', contact.id);
          await supabase.from('workflow_enrollments')
            .update({ status: 'cancelled' })
            .eq('contact_id', contact.id).eq('status', 'active');
          console.log('Contact unsubscribed — sequences cancelled for:', contact.first_name);
        }
        if (eventType === 'bounce' || eventType === 'dropped') {
          await supabase.from('contacts').update({ status: 'bounced' }).eq('id', contact.id);
          await supabase.from('workflow_enrollments')
            .update({ status: 'cancelled' })
            .eq('contact_id', contact.id).eq('status', 'active');
          console.log('Email bounced — sequences cancelled for:', contact.first_name);
        }
        console.log(`Activity logged for ${contact.first_name} — ${eventType}`);
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
    console.log('Shopify access token received for:', shop);
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

// ─── PDF UPLOAD ───────────────────────────────────────────
app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const pdfParser = new PDF2Json();
    pdfParser.on('pdfParser_dataError', () => res.status(500).json({ error: 'Failed to parse PDF' }));
    pdfParser.on('pdfParser_dataReady', pdfData => {
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
      res.json({ success: true, filename: req.file.originalname, pageCount: pages.length, wordCount: text.split(/\s+/).length, text: text.substring(0, 500000) });
    });
    pdfParser.parseBuffer(req.file.buffer);
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse PDF', details: e.message });
  }
});

// ─── YOUTUBE TRANSCRIPT ───────────────────────────────────
app.post('/youtube-transcript', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    const text = transcript.map(t => t.text).join(' ').trim();
    res.json({ success: true, wordCount: text.split(/\s+/).length, text: text.substring(0, 50000) });
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

// ─── SEND EMAIL ───────────────────────────────────────────
app.post('/send-email', async (req, res) => {
  const { to, subject, html, from, fromName } = req.body;
  if (!to || !subject || !html) return res.status(400).json({ error: 'Missing to, subject, or html' });
  try {
    await sgMail.send({ to, from: { email: from || process.env.SENDGRID_FROM_EMAIL, name: fromName || 'Sales Scales' }, subject, html });
    console.log('Email sent to:', to);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (e) {
    console.error('Email error:', e.message);
    res.status(500).json({ error: 'Failed to send email', details: e.message });
  }
});

// ─── EXECUTE WORKFLOW STEP ────────────────────────────────
app.post('/execute-step', async (req, res) => {
  const { stepType, to, subject, message, contactName, clientName } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });
  try {
    if (stepType === 'sms') {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const result = await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to });
      res.json({ success: true, channel: 'sms', sid: result.sid });
    } else if (stepType === 'email') {
      await sgMail.send({ to, from: { email: process.env.SENDGRID_FROM_EMAIL, name: clientName || 'Sales Scales' }, subject: subject || 'Message from ' + (clientName || 'Sales Scales'), html: `<p>Hi ${contactName || 'there'},</p><p>${message}</p>` });
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
        console.log('Step 1 SMS sent to:', contactPhone);
      } else if (firstStep.step_type === 'email' && contactEmail) {
        await sgMail.send({ to: contactEmail, from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' }, subject: firstStep.subject || 'Message for you', html: `<p>${firstStep.content.replace('{{first_name}}', contactName || 'there')}</p>` });
        console.log('Step 1 email sent to:', contactEmail);
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
    console.log('Embedding generated for document:', documentId);
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

// ─── AI TEAM ENDPOINTS ────────────────────────────────────
app.post('/hussain', async (req, res) => {
  const { prompt, clientId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    const context = await ragSearch(prompt, clientId);
    const result = await aiCall(
      `You are Hussain, the Intelligence and Strategy AI at Sales Scales. You are sharp, data-driven, and think like a founder. You analyze platform data and give direct, actionable insights. You speak in a confident, concise style — no fluff, no filler. You are reporting to Yousef, the founder of Sales Scales. You are Hussain — never identify as anyone else or mention Claude.`,
      prompt, context
    );
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
    const context = await ragSearch(prompt, clientId);
    const result = await aiCall(
      `You are Hassan, the Growth and Outreach AI at Sales Scales. You are creative, persuasive, and a master of personalized communication. You find prospects, write outreach that converts, follow up strategically, and create content that attracts ecommerce founders. You speak in a confident, direct style. You are Hassan — never identify as anyone else or mention Claude.`,
      prompt, context
    );
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
    const context = await ragSearch(prompt, clientId);
    const result = await aiCall(
      `You are Ali, the Sales Closer AI at Sales Scales. You are a master of the NEPQ framework and high ticket closing. You take warm leads and close them with precision. You generate sales strategies, handle objections without flinching, and write call scripts that convert. You speak with confidence and authority. You are Ali — never identify as anyone else or mention Claude.`,
      prompt, context
    );
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
    const context = await ragSearch(prompt, clientId);
    const result = await aiCall(
      `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world class copywriter and email marketer. You write email sequences, SMS campaigns, and ad copy that converts — all in the exact brand voice of each client. You understand ecommerce psychology deeply. You speak with creativity and precision. You are Mahdi — never identify as anyone else or mention Claude.`,
      prompt, context
    );
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
    const context = await ragSearch(prompt, clientId);
    const result = await aiCall(
      `You are Fatima, the Operations Manager AI at Sales Scales. You are systematic, detail-oriented, and keep everything running smoothly. You monitor platform operations, track client health, identify bottlenecks, and generate operational reports. You speak in a clear, organized, actionable style. You are Fatima — never identify as anyone else or mention Claude.`,
      prompt, context
    );
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
    const context = await ragSearch(prompt, clientId);
    const result = await aiCall(
      `You are Zainab, the Client Partner AI at Sales Scales. You are warm, professional, and deeply care about client success. You manage client relationships, handle onboarding, write client communications, and ensure every client feels valued and supported. You speak with empathy and confidence. You are Zainab — never identify as anyone else or mention Claude.`,
      prompt, context
    );
    res.json({ result });
  } catch (e) {
    console.error('Zainab error:', e.message);
    res.status(500).json({ error: 'Zainab failed', details: e.message });
  }
});
// ─── CHUNK AND EMBED DOCUMENT ─────────────────────────────
app.post('/chunk-document', async (req, res) => {
  const { documentId, content, title, clientId, type, aiMember } = req.body;
  if (!content || !documentId) return res.status(400).json({ error: 'Missing content or documentId' });

  try {
    const chunkSize = 1000;
    const overlap = 100;
    const chunks = [];

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunk = content.substring(i, i + chunkSize);
      if (chunk.trim().length > 50) chunks.push(chunk);
    }

    console.log(`Chunking document into ${chunks.length} chunks`);

    let embedded = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const { data: newDoc } = await supabase.from('knowledge_base').insert([{
          title: `${title} — Part ${i + 1}`,
          content: chunks[i],
          type: type || 'document',
          source: 'PDF Chunk',
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

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        console.error(`Chunk ${i} embedding failed:`, e.message);
      }
    }

    await supabase.from('knowledge_base').delete().eq('id', documentId);

    console.log(`Chunking complete: ${embedded} of ${chunks.length} chunks embedded`);
    res.json({ success: true, chunks: chunks.length, embedded });
  } catch (e) {
    console.error('Chunking error:', e.message);
    res.status(500).json({ error: 'Chunking failed', details: e.message });
  }
});
app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('Scheduler active — checking workflow steps every 15 minutes');
});