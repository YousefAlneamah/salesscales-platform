require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.use(cors());
app.use(express.json());

// ─── AUDIT ENDPOINT ───────────────────────────────────────
app.post('/audit', async (req, res) => {
  const { url } = req.body;

  console.log('API Key loaded:', !!process.env.ANTHROPIC_API_KEY);
  console.log('Audit requested for:', url);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
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
        messages: [
          {
            role: 'user',
            content: `Audit this Shopify store and identify all revenue gaps: ${url}`
          }
        ]
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
    console.log('Audit complete for:', audit.brandName);
    res.json(audit);

  } catch (e) {
    console.error('Audit error:', e.message);
    if (e.response) {
      console.error('Response status:', e.response.status);
      console.error('Response data:', JSON.stringify(e.response.data));
    }
    res.status(500).json({ error: 'Audit failed', details: e.message });
  }
});

// ─── SHOPIFY OAUTH ────────────────────────────────────────

// Step 1 — redirect merchant to Shopify login
app.get('/shopify/install', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Missing shop parameter');

  const state = crypto.randomBytes(16).toString('hex');
  const scopes = 'read_analytics,write_checkouts,read_checkouts,read_customers,write_customers,read_price_rules,write_price_rules,read_discounts,write_discounts,write_draft_orders,read_draft_orders,read_fulfillments,write_fulfillments,write_inventory,read_inventory,write_marketing_events,read_marketing_events,read_orders,write_orders,read_products,write_products,read_shipping';
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

  console.log('Redirecting to Shopify OAuth:', installUrl);
  res.redirect(installUrl);
});

// Step 2 — Shopify redirects back here with code
app.get('/shopify/callback', async (req, res) => {
  const { shop, code, state } = req.query;

  if (!shop || !code) {
    return res.status(400).send('Missing required parameters');
  }

  try {
    const tokenResponse = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code: code
      }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log('Shopify access token received for:', shop);

    // Return success to frontend
    res.json({
      success: true,
      shop: shop,
      accessToken: accessToken,
      message: 'Shopify connected successfully'
    });

  } catch (e) {
    console.error('Shopify callback error:', e.message);
    res.status(500).json({ error: 'Failed to get access token', details: e.message });
  }
});

// Step 3 — sync customers from Shopify
app.post('/shopify/sync-customers', async (req, res) => {
  const { shop, accessToken, clientId } = req.body;

  if (!shop || !accessToken) {
    return res.status(400).json({ error: 'Missing shop or accessToken' });
  }

  try {
    const response = await axios.get(
      `https://${shop}/admin/api/2026-01/customers.json?limit=250`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    const customers = response.data.customers;
    console.log(`Synced ${customers.length} customers from ${shop}`);

    res.json({
      success: true,
      count: customers.length,
      customers: customers
    });

  } catch (e) {
    console.error('Sync error:', e.message);
    res.status(500).json({ error: 'Sync failed', details: e.message });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));
