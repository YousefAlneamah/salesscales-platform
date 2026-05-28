const express = require('express');

module.exports = ({ supabase, axios, crypto, processWebhookEvent, aiCall }) => {
  const router = express.Router();

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
    const storeContext = `Store: ${storeName}\nCurrency: ${shopInfo.currency || 'USD'}\nTop products: ${productList}\nAverage order value: $${aov}`;

    // Email sequence
    const emailSeqJson = await aiCall(
      `You are Mahdi, the Marketing and Content AI at Sales Scales. You write high-converting cart recovery email sequences. Return ONLY valid JSON, no markdown, no explanation.`,
      `Generate a 3-email cart recovery sequence for this Shopify store.\n\n${storeContext}\n\nReturn JSON exactly:\n{"trigger_type":"cart_abandoned","steps":[{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":1},{"step_type":"email","subject":"...","content":"...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":24},{"step_type":"email","subject":"...","content":"...","wait_hours":0}]}\n\nReference real product names and prices. Use {{first_name}} for personalization. Write compelling copy that drives recovery.`,
      ''
    );
    let emailParsed;
    try {
      const ec = emailSeqJson.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const em = ec.match(/\{[\s\S]*\}/);
      emailParsed = JSON.parse(em ? em[0] : ec);
    } catch { emailParsed = { trigger_type: 'cart_abandoned', steps: [] }; }

    const emailCount = (emailParsed.steps || []).filter(s => s.step_type === 'email').length;
    await supabase.from('approvals').insert([{
      type: 'email_sequence',
      title: `Cart Recovery Emails — ${storeName}`,
      content: `Mahdi built a ${emailCount}-email cart recovery sequence using live product data from ${shop}. Products: ${productList.slice(0, 100)}. AOV: $${aov}. Approve to activate.`,
      metadata: { steps: emailParsed.steps || [], trigger_type: 'cart_abandoned', shop, aov },
      from_member: 'mahdi',
      client_id: clientId,
      status: 'pending',
      created_at: new Date().toISOString()
    }]);
    console.log(`[AUTO] Shopify connect — email sequence queued for ${shop}`);

    // SMS sequence
    const smsSeqJson = await aiCall(
      `You are Mahdi, the Marketing and Content AI at Sales Scales. You write concise, high-converting SMS sequences. Return ONLY valid JSON, no markdown, no explanation.`,
      `Generate a 2-step cart recovery SMS sequence for this Shopify store.\n\n${storeContext}\n\nReturn JSON exactly:\n{"trigger_type":"cart_abandoned","steps":[{"step_type":"sms","content":"Hi {{first_name}}, you left something behind...","wait_hours":0},{"step_type":"wait","content":"","wait_hours":24},{"step_type":"sms","content":"...","wait_hours":0}]}\n\nEach SMS must be under 160 characters. Reference real product names. Use {{first_name}}. Be conversational and direct.`,
      ''
    );
    let smsParsed;
    try {
      const sc = smsSeqJson.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const sm = sc.match(/\{[\s\S]*\}/);
      smsParsed = JSON.parse(sm ? sm[0] : sc);
    } catch { smsParsed = { trigger_type: 'cart_abandoned', steps: [] }; }

    const smsCount = (smsParsed.steps || []).filter(s => s.step_type === 'sms').length;
    await supabase.from('approvals').insert([{
      type: 'sms_sequence',
      title: `Cart Recovery SMS — ${storeName}`,
      content: `Mahdi built a ${smsCount}-step SMS cart recovery sequence for ${shop}. Approve to activate.`,
      metadata: { steps: smsParsed.steps || [], trigger_type: 'cart_abandoned', shop, aov },
      from_member: 'mahdi',
      client_id: clientId,
      status: 'pending',
      created_at: new Date().toISOString()
    }]);
    console.log(`[AUTO] Shopify connect — SMS sequence queued for ${shop}`);
  };

  router.get('/install', (req, res) => {
    const { shop, clientId } = req.query;
    if (!shop) return res.status(400).send('Missing shop parameter');
    const state = clientId || crypto.randomBytes(16).toString('hex');
    const scopes = 'read_analytics,write_checkouts,read_checkouts,read_customers,write_customers,read_price_rules,write_price_rules,read_discounts,write_discounts,write_draft_orders,read_draft_orders,read_fulfillments,write_fulfillments,write_inventory,read_inventory,write_marketing_events,read_marketing_events,read_orders,write_orders,read_products,write_products,read_shipping';
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI}&state=${state}`;
    res.redirect(installUrl);
  });

  router.get('/callback', async (req, res) => {
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
              <p style="color: #10b981; font-size: 14px; margin-bottom: 20px;">Mahdi is building your cart recovery sequences — check Approvals in ~30 seconds.</p>
              <a href="http://localhost:3000" style="background: #0f1f35; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Return to Platform</a>
            </div>
          </body>
        </html>
      `);
      if (clientId) {
        generateShopifySequences(shop, accessToken, clientId).catch(e => {
          console.error('[AUTO] Shopify sequence generation failed for', shop, ':', e.message);
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

  return router;
};
