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

// ─── SCHEDULER — runs every 15 minutes ───────────────────
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
        await supabase
          .from('workflow_enrollments')
          .update({ status: 'completed', completed_at: now })
          .eq('id', enrollment.id);
        continue;
      }

      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', enrollment.contact_id)
        .single();

      if (!contact) continue;

      if (currentStep.step_type === 'wait') {
        const nextStepAt = new Date();
        nextStepAt.setHours(nextStepAt.getHours() + (currentStep.wait_hours || 1));
        await supabase
          .from('workflow_enrollments')
          .update({
            current_step: enrollment.current_step + 1,
            next_step_at: nextStepAt.toISOString()
          })
          .eq('id', enrollment.id);
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

        await supabase
          .from('workflow_enrollments')
          .update({
            current_step: enrollment.current_step + 1,
            next_step_at: nextStepAt.toISOString()
          })
          .eq('id', enrollment.id);

        await supabase.from('messages').insert([{
          client_id: enrollment.client_id,
          contact_id: enrollment.contact_id,
          channel: 'sms',
          direction: 'outbound',
          sender_name: 'Sales Scales AI',
          content: currentStep.content,
          status: 'sent'
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

        await supabase
          .from('workflow_enrollments')
          .update({
            current_step: enrollment.current_step + 1,
            next_step_at: nextStepAt.toISOString()
          })
          .eq('id', enrollment.id);

        await supabase.from('messages').insert([{
          client_id: enrollment.client_id,
          contact_id: enrollment.contact_id,
          channel: 'email',
          direction: 'outbound',
          sender_name: 'Sales Scales AI',
          content: currentStep.content,
          status: 'sent'
        }]);

      } else {
        const nextStepAt = new Date();
        await supabase
          .from('workflow_enrollments')
          .update({
            current_step: enrollment.current_step + 1,
            next_step_at: nextStepAt.toISOString()
          })
          .eq('id', enrollment.id);
      }

      if (enrollment.current_step >= steps.length) {
        await supabase
          .from('workflow_enrollments')
          .update({ status: 'completed', completed_at: now })
          .eq('id', enrollment.id);
        console.log(`Enrollment completed for ${contact.first_name}`);
      }
    }
  } catch (e) {
    console.error('Scheduler error:', e.message);
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
        messages: [{
          role: 'user',
          content: `Channel: ${channel}\nClient: ${clientName}\nCustomer name: ${senderName}\nCustomer message: ${content}\n\nWrite a reply to this message.`
        }]
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
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Missing shop parameter');
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = 'read_analytics,write_checkouts,read_checkouts,read_customers,write_customers,read_price_rules,write_price_rules,read_discounts,write_discounts,write_draft_orders,read_draft_orders,read_fulfillments,write_fulfillments,write_inventory,read_inventory,write_marketing_events,read_marketing_events,read_orders,write_orders,read_products,write_products,read_shipping';
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI}&state=${state}`;
  res.redirect(installUrl);
});

app.get('/shopify/callback', async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send('Missing required parameters');
  try {
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code: code
    });
    res.json({ success: true, shop, accessToken: tokenResponse.data.access_token });
  } catch (e) {
    console.error('Shopify callback error:', e.message);
    res.status(500).json({ error: 'Failed to get access token', details: e.message });
  }
});

app.post('/shopify/sync-customers', async (req, res) => {
  const { shop, accessToken } = req.body;
  if (!shop || !accessToken) return res.status(400).json({ error: 'Missing shop or accessToken' });
  try {
    const response = await axios.get(
      `https://${shop}/admin/api/2026-01/customers.json?limit=250`,
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );
    res.json({ success: true, count: response.data.customers.length, customers: response.data.customers });
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
    pdfParser.on('pdfParser_dataError', () => {
      res.status(500).json({ error: 'Failed to parse PDF' });
    });
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
      res.json({
        success: true,
        filename: req.file.originalname,
        pageCount: pages.length,
        wordCount: text.split(/\s+/).length,
        text: text.substring(0, 50000)
      });
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
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    });
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
    await sgMail.send({
      to,
      from: {
        email: from || process.env.SENDGRID_FROM_EMAIL,
        name: fromName || 'Sales Scales'
      },
      subject,
      html
    });
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
      const result = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      res.json({ success: true, channel: 'sms', sid: result.sid });
    } else if (stepType === 'email') {
      await sgMail.send({
        to,
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: clientName || 'Sales Scales' },
        subject: subject || 'Message from ' + (clientName || 'Sales Scales'),
        html: `<p>Hi ${contactName || 'there'},</p><p>${message}</p>`
      });
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
    const { data: steps } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('step_order');

    if (!steps || steps.length === 0) {
      return res.status(400).json({ error: 'No steps found for this workflow' });
    }

    const nextStepAt = new Date().toISOString();

    const { data: enrollment } = await supabase
      .from('workflow_enrollments')
      .insert([{
        workflow_id: workflowId,
        contact_id: contactId,
        client_id: clientId,
        status: 'active',
        current_step: 1,
        enrolled_at: new Date().toISOString(),
        next_step_at: nextStepAt
      }])
      .select()
      .single();

    const firstStep = steps[0];
    if (firstStep.step_type !== 'wait' && firstStep.content) {
      if (firstStep.step_type === 'sms' && contactPhone) {
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await twilioClient.messages.create({
          body: firstStep.content.replace('{{first_name}}', contactName || 'there'),
          from: process.env.TWILIO_PHONE_NUMBER,
          to: contactPhone
        });
        console.log('Step 1 SMS sent to:', contactPhone);
      } else if (firstStep.step_type === 'email' && contactEmail) {
        await sgMail.send({
          to: contactEmail,
          from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
          subject: firstStep.subject || 'Message for you',
          html: `<p>${firstStep.content.replace('{{first_name}}', contactName || 'there')}</p>`
        });
        console.log('Step 1 email sent to:', contactEmail);
      }

      await supabase.from('messages').insert([{
        client_id: clientId,
        contact_id: contactId,
        channel: firstStep.step_type,
        direction: 'outbound',
        sender_name: 'Sales Scales AI',
        content: firstStep.content,
        status: 'sent'
      }]);
    }

    await supabase
      .from('workflow_enrollments')
      .update({ current_step: 2 })
      .eq('id', enrollment.id);

    await supabase
      .from('workflows')
      .update({ enrolled_count: steps.length })
      .eq('id', workflowId);

    res.json({ success: true, enrollmentId: enrollment?.id, stepsCount: steps.length });

  } catch (e) {
    console.error('Enrollment error:', e.message);
    res.status(500).json({ error: 'Failed to enroll contact', details: e.message });
  }
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
  console.log('Scheduler active — checking workflow steps every 15 minutes');
});
