const express = require('express');

module.exports = ({ aiCall, ragSearch, getBriefingsContext, getShopifyContext, verifyToken, aiLimiter }) => {
  const router = express.Router();

  router.post('/hussain', aiLimiter, verifyToken, async (req, res) => {
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

  router.post('/hassan', aiLimiter, verifyToken, async (req, res) => {
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

  router.post('/ali', aiLimiter, verifyToken, async (req, res) => {
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

  router.post('/mahdi', aiLimiter, verifyToken, async (req, res) => {
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

  router.post('/fatima', aiLimiter, verifyToken, async (req, res) => {
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

  router.post('/zainab', aiLimiter, verifyToken, async (req, res) => {
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

  return router;
};
