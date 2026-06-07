const express = require('express');

module.exports = ({ supabase, axios, crypto, processWebhookEvent, aiCall, generateAllClientSequences }) => {
  const router = express.Router();

  const parseJson = (raw) => {
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : clean);
  };

  const generateShopifySequences = async (shop, accessToken, clientId) => {
    const headers = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };
    const base = `https://${shop}/admin/api/2026-01`;

    const [productsRes, ordersRes, shopRes] = await Promise.all([
      axios.get(`${base}/products.json?limit=10&fields=id,title,variants,product_type`, { headers }),
      axios.get(`${base}/orders.json?status=any&limit=50&fields=total_price&financial_status=paid`, { headers }),
      axios.get(`${base}/shop.json`, { headers }),
    ]);

    const products = productsRes.data.products || [];
    const orders = ordersRes.data.orders || [];
    const shopInfo = shopRes.data.shop || {};

    const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
    const aov = orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0';

    const productList = products.slice(0, 6).map(p => {
      const price = p.variants?.[0]?.price || '0';
      return `${p.title} ($${price})`;
    }).join(', ');

    const storeName = shopInfo.name || shop;
    const ctx = `Store: ${storeName}\nCurrency: ${shopInfo.currency || 'USD'}\nTop products: ${productList}\nAverage order value: $${aov}`;
    const mahdiSystem = `You are Mahdi, the Marketing and Content AI at Sales Scales. You write high-converting cart recovery copy. Return ONLY valid JSON, no markdown, no explanation.`;

    const humanRules = `\n\nHOW TO WRITE:\nWrite like a real human being, not a marketing robot. Use short sentences. Use line breaks generously. Never use words like "we understand" or "we know how you feel" or "don't miss out" or "limited time". Never use exclamation marks. Write the way a thoughtful friend who works at the brand would write. Each email must have one clear emotional hook in the first two sentences that makes the reader feel something. Reference the specific product they left behind naturally, not aggressively.`;

    // ── EMAIL SEQUENCE (7 emails) ──────────────────────────
    // Split across two calls to stay within max_tokens: 1000.
    // Waits between emails: 1h → E1 → 23h → E2 → 48h → E3 → 48h → E4 → 48h → E5 → 72h → E6 → 96h → E7
    // Cumulative: 1h, 24h, 72h, 5d, 7d, 10d, 14d

    // SQL migration for ab_test_group column:
    // alter table workflow_steps add column if not exists ab_test_group text;

    const [emails1to3Raw, emails4to7Raw, email1SocialProofRaw] = await Promise.all([
      aiCall(mahdiSystem,
        `Write 3 cart recovery emails (subjects + body copy) for this store.\n\n${ctx}\n\nAngles:\nEmail 1 (sent 1h after abandonment): urgency — cart items waiting, personalised opener\nEmail 2 (24h): social proof — customer reviews, bestseller status\nEmail 3 (72h): product benefits — key features and why it matters\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."}]}\nUse {{first_name}}. Keep each email body under 120 words. Reference real product names and prices.${humanRules}`,
        ''),
      aiCall(mahdiSystem,
        `Write 4 cart recovery emails (subjects + body copy) for this store.\n\n${ctx}\n\nAngles:\nEmail 4 (5 days after abandonment): objection handling — price, quality, shipping concerns\nEmail 5 (7 days): scarcity — stock running low\nEmail 6 (10 days): value + guarantee — risk-free, easy returns, quality promise\nEmail 7 (14 days): final offer — last chance, make it count\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."},{"subject":"...","content":"..."}]}\nUse {{first_name}}. Keep each email body under 120 words. Reference real product names and prices.${humanRules}`,
        ''),
      aiCall(mahdiSystem,
        `Write 1 cart recovery email for this store.\n\n${ctx}\n\nAngle: Social Proof (sent 1h after abandonment)\nLead with strong social proof — customer reviews, ratings, bestseller status, or how many people bought this product recently. Make the reader feel they'd be missing out on something others love. Reference the specific product they left.\n\nReturn JSON: {"emails":[{"subject":"...","content":"..."}]}\nUse {{first_name}}. Under 120 words. Reference real product names and prices.${humanRules}`,
        ''),
    ]);

    let emails1to3 = { emails: [] }, emails4to7 = { emails: [] }, email1SP = { emails: [] };
    try { emails1to3 = parseJson(emails1to3Raw); } catch { /* use default */ }
    try { emails4to7 = parseJson(emails4to7Raw); } catch { /* use default */ }
    try { email1SP = parseJson(email1SocialProofRaw); } catch { /* use default */ }

    const allEmails = [...(emails1to3.emails || []), ...(emails4to7.emails || [])];
    // wait_hours before each email (index-matched)
    const emailWaits = [1, 23, 48, 48, 48, 72, 96];
    const emailSteps = [];
    allEmails.forEach((email, i) => {
      emailSteps.push({ step_type: 'wait', content: '', wait_hours: emailWaits[i] || 24 });
      emailSteps.push({ step_type: 'email', subject: email.subject || '', content: email.content || '', wait_hours: 0 });
    });

    const email1A = allEmails[0] || { subject: '', content: '' };
    const email1B = (email1SP.emails || [])[0] || { subject: '', content: '' };

    await Promise.all([
      supabase.from('approvals').insert([{
        type: 'email_sequence',
        title: `Cart Recovery Emails (7) — ${storeName}`,
        content: `Mahdi built a 7-email cart recovery sequence for ${storeName} using live store data. Angles: urgency → social proof → benefits → objection handling → scarcity → guarantee → final offer. AOV: $${aov}. Products: ${productList.slice(0, 100)}. Approve to activate.`,
        metadata: { steps: emailSteps, trigger_type: 'cart_abandoned', shop, aov },
        from_member: 'mahdi',
        client_id: clientId,
        priority: 'normal',
        status: 'pending',
        created_at: new Date().toISOString()
      }]),
      supabase.from('approvals').insert([{
        type: 'email_sequence',
        title: `A/B Test — Email 1 Version A (Urgency) — ${storeName}`,
        content: `Subject: ${email1A.subject}\n\n${email1A.content}\n\nVersion A tests the urgency angle for the first cart recovery email. Approve this version to use it as the opening email in your sequence.`,
        metadata: {
          steps: [
            { step_type: 'wait', content: '', wait_hours: 1 },
            { step_type: 'email', subject: email1A.subject || '', content: email1A.content || '', wait_hours: 0, ab_test_group: 'A' },
          ],
          trigger_type: 'cart_abandoned', shop, aov, ab_test_group: 'A', ab_test_angle: 'urgency',
        },
        from_member: 'mahdi',
        client_id: clientId,
        priority: 'normal',
        status: 'pending',
        created_at: new Date().toISOString()
      }]),
      supabase.from('approvals').insert([{
        type: 'email_sequence',
        title: `A/B Test — Email 1 Version B (Social Proof) — ${storeName}`,
        content: `Subject: ${email1B.subject}\n\n${email1B.content}\n\nVersion B tests the social proof angle for the first cart recovery email. Approve this version to replace Email 1 in your sequence with the social proof approach.`,
        metadata: {
          steps: [
            { step_type: 'wait', content: '', wait_hours: 1 },
            { step_type: 'email', subject: email1B.subject || '', content: email1B.content || '', wait_hours: 0, ab_test_group: 'B' },
          ],
          trigger_type: 'cart_abandoned', shop, aov, ab_test_group: 'B', ab_test_angle: 'social_proof',
        },
        from_member: 'mahdi',
        client_id: clientId,
        priority: 'normal',
        status: 'pending',
        created_at: new Date().toISOString()
      }]),
    ]);
    console.log(`[AUTO] Shopify connect — 7-email sequence + A/B test emails queued for ${shop}`);

    // ── SMS SEQUENCE (4 messages) ──────────────────────────
    // Timing: 0h, 24h, 72h, 7 days
    const smsRaw = await aiCall(mahdiSystem,
      `Write 4 cart recovery SMS messages for this store.\n\n${ctx}\n\nTiming & angles:\nSMS 1 (immediately): short opener with product name and direct link nudge\nSMS 2 (24h later): social proof one-liner\nSMS 3 (72h later): scarcity/urgency\nSMS 4 (7 days later): final nudge with incentive hint\n\nReturn JSON: {"messages":["...","...","...","..."]}\nEach message must be under 160 characters. Use {{first_name}}. Reference real product name.`,
      '');

    let smsParsed = { messages: [] };
    try { smsParsed = parseJson(smsRaw); } catch { /* use default */ }

    const smsMessages = (smsParsed.messages || []).slice(0, 4);
    // wait before each SMS: 0h, 24h, 48h, 96h (cumulative: 0, 24, 72, 168h)
    const smsWaits = [0, 24, 48, 96];
    const smsSteps = [];
    smsMessages.forEach((msg, i) => {
      if (smsWaits[i] > 0) smsSteps.push({ step_type: 'wait', content: '', wait_hours: smsWaits[i] });
      smsSteps.push({ step_type: 'sms', content: msg, wait_hours: 0 });
    });

    await supabase.from('approvals').insert([{
      type: 'sms_sequence',
      title: `Cart Recovery SMS (4) — ${storeName}`,
      content: `Mahdi built a 4-message SMS cart recovery sequence for ${storeName}. Timing: immediate, 24h, 72h, 7 days. Approve to activate.`,
      metadata: { steps: smsSteps, trigger_type: 'cart_abandoned', shop, aov },
      from_member: 'mahdi',
      client_id: clientId,
      priority: 'normal',
      status: 'pending',
      created_at: new Date().toISOString()
    }]);
    console.log(`[AUTO] Shopify connect — 4-SMS sequence queued for ${shop}`);

    // ── WHATSAPP SEQUENCE (3 messages) ────────────────────
    // Timing: 2h, 48h, 7 days
    const waRaw = await aiCall(mahdiSystem,
      `Write 3 cart recovery WhatsApp messages for this store.\n\n${ctx}\n\nTiming & angles:\nMessage 1 (2h after abandonment): warm, conversational — "noticed you left something" with product name\nMessage 2 (48h later): value highlight — key benefit + easy reply CTA\nMessage 3 (7 days later): final personal check-in, friendly last nudge\n\nReturn JSON: {"messages":["...","...","..."]}\nKeep each message under 200 characters. Use {{first_name}}. Feel personal, not spammy.`,
      '');

    let waParsed = { messages: [] };
    try { waParsed = parseJson(waRaw); } catch { /* use default */ }

    const waMessages = (waParsed.messages || []).slice(0, 3);
    // wait before each WA: 2h, 46h, 120h (cumulative: 2h, 48h, 168h = 7 days)
    const waWaits = [2, 46, 120];
    const waSteps = [];
    waMessages.forEach((msg, i) => {
      waSteps.push({ step_type: 'wait', content: '', wait_hours: waWaits[i] });
      waSteps.push({ step_type: 'whatsapp', content: msg, wait_hours: 0 });
    });

    await supabase.from('approvals').insert([{
      type: 'whatsapp_sequence',
      title: `Cart Recovery WhatsApp (3) — ${storeName}`,
      content: `Mahdi built a 3-message WhatsApp cart recovery sequence for ${storeName}. Timing: 2h, 48h, 7 days. Approve to activate.`,
      metadata: { steps: waSteps, trigger_type: 'cart_abandoned', shop, aov },
      from_member: 'mahdi',
      client_id: clientId,
      priority: 'normal',
      status: 'pending',
      created_at: new Date().toISOString()
    }]);
    console.log(`[AUTO] Shopify connect — 3-WhatsApp sequence queued for ${shop}`);

    // Save product hash so the daily sync can detect future changes
    const hashInput = products.slice(0, 6).map(p => {
      const price = p.variants?.[0]?.price || '0';
      return `${p.title}:${price}`;
    }).join('|');
    const productHash = crypto.createHash('sha256').update(hashInput).digest('hex');
    await supabase.from('shopify_connections')
      .update({ last_product_hash: productHash })
      .eq('shop', shop);
  };

  router.get('/install', (req, res) => {
    const { shop, clientId } = req.query;
    if (!shop) return res.status(400).send('Missing shop parameter');
    const state = clientId || crypto.randomBytes(16).toString('hex');
    const scopes = 'read_analytics,write_checkouts,read_checkouts,read_customers,write_customers,read_price_rules,write_price_rules,read_discounts,write_discounts,write_draft_orders,read_draft_orders,read_fulfillments,write_fulfillments,write_inventory,read_inventory,write_marketing_events,read_marketing_events,read_orders,write_orders,read_products,write_products,read_shipping';
    const apiKey = process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_CLIENT_ID;
    const redirectUri = process.env.SHOPIFY_CALLBACK_URL || process.env.SHOPIFY_REDIRECT_URI || `${process.env.BACKEND_URL}/shopify/callback`;
    console.log(`[Shopify OAuth] install — shop: ${shop}, redirect_uri: ${redirectUri}`);
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    res.redirect(installUrl);
  });

  router.get('/connection', async (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'Missing client_id' });
    try {
      const { data: conn } = await supabase.from('shopify_connections')
        .select('shop, created_at').eq('client_id', client_id).maybeSingle();
      if (!conn) return res.json({ connected: false });
      res.json({ connected: true, shop: conn.shop, connected_at: conn.created_at });
    } catch (e) {
      console.error('Shopify connection lookup error:', e.message);
      res.status(500).json({ error: 'Failed to check connection', details: e.message });
    }
  });

  router.get('/callback', async (req, res) => {
    const { shop, code, state } = req.query;
    if (!shop || !code) return res.status(400).send('Missing required parameters');
    try {
      const apiKey = process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_CLIENT_ID;
      const apiSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
      const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      });
      const accessToken = tokenResponse.data.access_token;
      const clientId = state && state.length < 40 ? state : null;
      console.log(`[Shopify OAuth] callback — shop: ${shop}, clientId: ${clientId || 'none'}`);

      // Primary: save access token to shopify_connections
      await supabase.from('shopify_connections').upsert([{
        shop, access_token: accessToken, client_id: clientId,
        scope: 'read_analytics,write_checkouts,read_checkouts,read_customers,write_customers',
        created_at: new Date().toISOString()
      }], { onConflict: 'shop' });
      console.log(`[Shopify OAuth] shopify_connections saved — shop: ${shop}`);

      // Also update clients table with shop domain (best effort — column may not exist)
      if (clientId) {
        const { error: clientUpdateErr } = await supabase.from('clients')
          .update({ shopify_domain: shop }).eq('id', clientId);
        if (clientUpdateErr) {
          console.log(`[Shopify OAuth] clients.shopify_domain not updated: ${clientUpdateErr.message}`);
        } else {
          console.log(`[Shopify OAuth] clients table updated — shopify_domain: ${shop}`);
        }
      }
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5;">
            <div style="text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
              <h2 style="color: #0f1f35; margin-bottom: 8px;">Shopify Connected</h2>
              <p style="color: #64748b; margin-bottom: 20px;">${shop} has been connected successfully.</p>
              <p style="color: #10b981; font-size: 14px; margin-bottom: 20px;">Mahdi is building your cart recovery sequences — check Approvals in ~30 seconds.</p>
              <a href="http://localhost:3000" style="background: #0f1f35; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Return to Platform</a>
            </div>
          </body>
        </html>
      `);
      if (clientId) {
        const genFn = generateAllClientSequences || generateShopifySequences;
        genFn(shop, accessToken, clientId).catch(e => {
          console.error('[AUTO] Sequence generation failed for', shop, ':', e.message);
        });
      }
    } catch (e) {
      console.error('Shopify callback error:', e.message);
      res.status(500).json({ error: 'Failed to get access token', details: e.message });
    }
  });

  router.post('/sync-customers', async (req, res) => {
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

  router.post('/store-data', async (req, res) => {
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

  router.get('/products', async (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'Missing client_id' });
    try {
      const { data: conn } = await supabase.from('shopify_connections')
        .select('*').eq('client_id', client_id).maybeSingle();
      if (!conn) return res.status(404).json({ error: 'No Shopify store connected for this client' });

      const { shop, access_token } = conn;
      const headers = { 'X-Shopify-Access-Token': access_token, 'Content-Type': 'application/json' };
      const base = `https://${shop}/admin/api/2026-01`;

      const productsRes = await axios.get(`${base}/products.json?limit=10`, { headers });
      const products = (productsRes.data.products || []).map(p => ({
        title: p.title,
        price: p.variants?.[0]?.price || '0.00',
        image: p.image?.src || p.images?.[0]?.src || null,
      }));

      res.json({ shop, connected: true, products });
    } catch (e) {
      console.error('Shopify products error:', e.message);
      res.status(500).json({ error: 'Failed to fetch products', details: e.response?.data || e.message });
    }
  });

  router.post('/webhook', async (req, res) => {
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

    res.status(200).json({ received: true });

    processWebhookEvent(topic, shop, req.body).catch(e => {
      console.error(`Webhook error [${topic}]:`, e.message);
    });
  });

  router.post('/register-webhooks', async (req, res) => {
    const { shop, accessToken } = req.body;
    if (!shop || !accessToken) return res.status(400).json({ error: 'Missing shop or accessToken' });

    const baseUrl = process.env.WEBHOOK_BASE_URL ||
      (process.env.SHOPIFY_REDIRECT_URI ? process.env.SHOPIFY_REDIRECT_URI.replace('/shopify/callback', '') : null);

    if (!baseUrl) return res.status(400).json({ error: 'WEBHOOK_BASE_URL not set in environment' });

    const topics = ['checkouts/create', 'orders/create', 'orders/updated', 'orders/fulfilled'];
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
        if (e.response?.status === 422) {
          registered.push(topic);
        } else {
          failed.push({ topic, error: errDetail });
        }
      }
    }

    res.json({ success: true, registered, failed });
  });

  router.post('/list-webhooks', async (req, res) => {
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

  router.post('/disconnect', async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      await supabase.from('shopify_connections').delete().eq('client_id', client_id);
      await supabase.from('workflows').update({ status: 'paused' }).eq('client_id', client_id).eq('status', 'active');
      console.log(`Shopify disconnected for client ${client_id} — active workflows paused`);
      res.json({ ok: true });
    } catch (e) {
      console.error('Shopify disconnect error:', e.message);
      res.status(500).json({ error: 'Disconnect failed', details: e.message });
    }
  });

  router.post('/generate-sequences', async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      const { data: conn } = await supabase.from('shopify_connections')
        .select('shop, access_token').eq('client_id', client_id).maybeSingle();
      if (!conn) return res.status(404).json({ error: 'No Shopify store connected for this client' });
      res.json({ ok: true, message: 'Sequence generation started — check Approvals in ~60 seconds' });
      const genFn = generateAllClientSequences || generateShopifySequences;
      genFn(conn.shop, conn.access_token, client_id).catch(e => {
        console.error('[MANUAL] Sequence generation failed for', conn.shop, ':', e.message);
      });
    } catch (e) {
      console.error('/shopify/generate-sequences error:', e.message);
      res.status(500).json({ error: 'Failed to start generation', details: e.message });
    }
  });

  return router;
};
