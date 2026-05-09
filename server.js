require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(cors());
app.use(express.json());
app.post('/audit', async (req, res) => {
  const { url } = req.body;
  console.log('Audit requested for:', url);
  console.log('Key loaded:', !!process.env.ANTHROPIC_API_KEY);
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: 'You are a Shopify store analyst for Sales Scales. Analyze the store and return JSON only, no markdown, no explanation. Return this exact structure: {"brandName":"string","niche":"string","estimatedAOV":"$XX","score":35,"hasEmailPopup":true,"hasCartRecovery":"likely","hasSMS":false,"hasWhatsApp":false,"hasAIVoice":false,"estimatedMonthlyRevenue":"$XXK","biggestGap":"one sentence","pitchMessage":"personalised outreach message to the founder"}',
        messages: [{ role: 'user', content: 'Audit this Shopify store and identify all revenue gaps: ' + url }]
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
    console.error('Error:', e.message);
    if (e.response) console.error('Status:', e.response.status);
    res.status(500).json({ error: 'Audit failed' });
  }
});
app.listen(3001, () => console.log('Server running on port 3001'));
