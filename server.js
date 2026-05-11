require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const multer = require('multer');
const PDF2Json = require('pdf2json');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.use(cors());
app.use(express.json());

// ─── AUDIT ────────────────────────────────────────────────
app.post('/audit', async (req, res) => {
  const { url } = req.body;
  console.log('Audit requested for:', url);
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
  console.log('Generating reply for:', senderName, 'on', channel);
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
    console.log('PDF received:', req.file.originalname, req.file.size, 'bytes');

    const pdfParser = new PDF2Json();

    pdfParser.on('pdfParser_dataError', errData => {
      console.error('PDF parse error:', errData.parserError);
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
            try {
              word = decodeURIComponent(word);
            } catch (e) {
              // keep original if decode fails
            }
            text += word + ' ';
          });
          text += '\n';
        });
      });

      text = text.trim();
      const wordCount = text.split(/\s+/).length;
      console.log('PDF extracted:', pages.length, 'pages,', wordCount, 'words');

      res.json({
        success: true,
        filename: req.file.originalname,
        pageCount: pages.length,
        wordCount: wordCount,
        text: text.substring(0, 50000)
      });
    });

    pdfParser.parseBuffer(req.file.buffer);

  } catch (e) {
    console.error('PDF upload error:', e.message);
    res.status(500).json({ error: 'Failed to parse PDF', details: e.message });
  }
});

// ─── YOUTUBE TRANSCRIPT ───────────────────────────────────
app.post('/youtube-transcript', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    console.log('Fetching transcript for:', url);
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    const text = transcript.map(t => t.text).join(' ').trim();
    const wordCount = text.split(/\s+/).length;
    console.log('Transcript extracted:', wordCount, 'words');
    res.json({
      success: true,
      wordCount,
      text: text.substring(0, 50000)
    });
  } catch (e) {
    console.error('YouTube transcript error:', e.message);
    res.status(500).json({ error: 'Failed to fetch transcript', details: e.message });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));
