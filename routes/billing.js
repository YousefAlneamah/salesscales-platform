const express = require('express');

const PAYPAL_BASE = () =>
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PLANS = {
  starter: { name: 'Sales Scales Starter',  price: '199.00', label: 'Starter' },
  growth:  { name: 'Sales Scales Growth',   price: '299.00', label: 'Growth' },
  elite:   { name: 'Sales Scales Elite',    price: '399.00', label: 'Elite' },
  scale:   { name: 'Sales Scales Scale',    price: '399.00', label: 'Scale' },
};

const successHtml = (title, body) => `<!DOCTYPE html>
<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f0f3f8;margin:0">
  <div style="text-align:center;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);max-width:420px">
    <div style="font-size:48px;margin-bottom:16px">✅</div>
    <h2 style="color:#0a1628;margin:0 0 8px">${title}</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:13px">${body}</p>
    <a href="http://localhost:3000" style="background:#0a1628;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Go to Dashboard</a>
  </div>
</body></html>`;

const cancelHtml = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f0f3f8;margin:0">
  <div style="text-align:center;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);max-width:420px">
    <div style="font-size:48px;margin-bottom:16px">↩</div>
    <h2 style="color:#0a1628;margin:0 0 8px">Not Activated</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:13px">You cancelled the PayPal authorization — your subscription has not been activated.</p>
    <a href="http://localhost:3000" style="background:#0a1628;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Return to Platform</a>
  </div>
</body></html>`;

module.exports = ({ supabase, axios, sgMail, storeBriefing }) => {
  const router = express.Router();

  // ─── HELPERS ─────────────────────────────────────────────
  const ppToken = async () => {
    const { data } = await axios.post(
      `${PAYPAL_BASE()}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: process.env.PAYPAL_CLIENT_ID || '',
          password: process.env.PAYPAL_CLIENT_SECRET || '',
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    return data.access_token;
  };

  const ppHdrs = async () => ({
    Authorization: `Bearer ${await ppToken()}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  });

  const getConfig = async (key) => {
    const { data } = await supabase.from('billing_config').select('value').eq('id', key).maybeSingle();
    return data?.value || null;
  };

  const setConfig = async (key, value) => {
    await supabase.from('billing_config').upsert(
      [{ id: key, value, updated_at: new Date().toISOString() }],
      { onConflict: 'id' }
    );
  };

  const ppConfigured = () => !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

  // ─── POST /billing/create-plan ────────────────────────────
  router.post('/create-plan', async (req, res) => {
    if (!ppConfigured()) {
      return res.status(503).json({ error: 'PayPal not configured — add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env' });
    }
    try {
      const headers = await ppHdrs();

      // Get or create the PayPal product
      let productId = await getConfig('paypal_product_id');
      if (!productId) {
        const { data: product } = await axios.post(
          `${PAYPAL_BASE()}/v1/catalogs/products`,
          {
            name: 'Sales Scales AI Revenue System',
            description: 'AI-powered email, SMS, and WhatsApp automation for ecommerce stores.',
            type: 'SERVICE',
            category: 'SOFTWARE',
          },
          { headers }
        );
        productId = product.id;
        await setConfig('paypal_product_id', productId);
        console.log('[PayPal] Product created:', productId);
      }

      // Create any missing plans
      const result = {};
      for (const [key, plan] of Object.entries(PLANS)) {
        const configKey = `paypal_plan_${key}`;
        let planId = await getConfig(configKey);
        if (!planId) {
          const { data: created } = await axios.post(
            `${PAYPAL_BASE()}/v1/billing/plans`,
            {
              product_id: productId,
              name: plan.name,
              description: `${plan.label} plan — $${plan.price}/month`,
              status: 'ACTIVE',
              billing_cycles: [
                {
                  frequency: { interval_unit: 'MONTH', interval_count: 1 },
                  tenure_type: 'REGULAR',
                  sequence: 1,
                  total_cycles: 0,
                  pricing_scheme: {
                    fixed_price: { value: plan.price, currency_code: 'USD' },
                  },
                },
              ],
              payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee_failure_action: 'CANCEL',
                payment_failure_threshold: 3,
              },
            },
            { headers }
          );
          planId = created.id;
          await setConfig(configKey, planId);
          console.log(`[PayPal] Plan created for ${key}: ${planId}`);
        }
        result[key] = planId;
      }

      res.json({ ok: true, product_id: productId, plans: result });
    } catch (e) {
      console.error('/billing/create-plan error:', e.response?.data || e.message);
      res.status(500).json({ error: e.response?.data?.message || e.message });
    }
  });

  // ─── POST /billing/create-subscription ───────────────────
  router.post('/create-subscription', async (req, res) => {
    const { client_id, plan, email } = req.body;
    if (!client_id || !plan || !email) {
      return res.status(400).json({ error: 'client_id, plan, and email are required' });
    }
    const planKey = plan.toLowerCase();
    if (!PLANS[planKey]) {
      return res.status(400).json({ error: `plan must be one of: ${Object.keys(PLANS).join(', ')}` });
    }
    if (!ppConfigured()) return res.status(503).json({ error: 'PayPal not configured' });

    try {
      const planId = await getConfig(`paypal_plan_${planKey}`);
      if (!planId) {
        return res.status(400).json({ error: 'Plans not initialised — call POST /billing/create-plan first' });
      }

      const BASE_URL = process.env.APP_URL || 'http://localhost:3001';
      const headers = await ppHdrs();

      const { data: sub } = await axios.post(
        `${PAYPAL_BASE()}/v1/billing/subscriptions`,
        {
          plan_id: planId,
          subscriber: { email_address: email },
          application_context: {
            brand_name: 'Sales Scales',
            locale: 'en-US',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            payment_method: {
              payer_selected: 'PAYPAL',
              payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
            },
            return_url: `${BASE_URL}/billing/subscription-return`,
            cancel_url: `${BASE_URL}/billing/subscription-cancel`,
          },
        },
        { headers }
      );

      const approvalLink = (sub.links || []).find(l => l.rel === 'approve');
      if (!approvalLink) throw new Error('No approval URL in PayPal response');

      await supabase.from('clients').update({
        paypal_subscription_id: sub.id,
        tier: PLANS[planKey].label,
      }).eq('id', client_id);

      console.log(`[PayPal] Subscription created for client ${client_id}: ${sub.id}`);
      res.json({ ok: true, subscription_id: sub.id, approval_url: approvalLink.href });
    } catch (e) {
      console.error('/billing/create-subscription error:', e.response?.data || e.message);
      res.status(500).json({ error: e.response?.data?.message || e.message });
    }
  });

  // ─── GET /billing/subscription-return ────────────────────
  router.get('/subscription-return', async (req, res) => {
    const subId = req.query.subscription_id || req.query.ba_token;
    if (!subId) return res.status(400).send('Missing subscription_id');
    try {
      const headers = await ppHdrs();
      const { data: sub } = await axios.get(
        `${PAYPAL_BASE()}/v1/billing/subscriptions/${subId}`,
        { headers }
      );

      if (sub.status === 'APPROVAL_PENDING' || sub.status === 'APPROVED') {
        await axios.post(
          `${PAYPAL_BASE()}/v1/billing/subscriptions/${subId}/activate`,
          { reason: 'Activated after subscriber approval' },
          { headers }
        );
      }

      const { data: client } = await supabase.from('clients')
        .select('id, name').eq('paypal_subscription_id', subId).maybeSingle();

      if (client) {
        await supabase.from('clients').update({ status: 'active' }).eq('id', client.id);
        console.log(`[PayPal] Subscription activated — client: ${client.name}`);
      }

      res.send(successHtml('Subscription Activated', 'Your Sales Scales subscription is now active. Welcome aboard!'));
    } catch (e) {
      console.error('/billing/subscription-return error:', e.message);
      res.send(successHtml('Subscription Pending', 'Your authorization was received. We will activate your subscription shortly.'));
    }
  });

  // ─── GET /billing/subscription-cancel ────────────────────
  router.get('/subscription-cancel', (req, res) => res.send(cancelHtml));

  // ─── POST /billing/webhook ────────────────────────────────
  // Fix 4: PayPal webhook signature validation
  // Set PAYPAL_WEBHOOK_ID in your env vars (get it from PayPal Developer Dashboard > Webhooks)
  const verifyPayPalWebhook = async (headers, rawBody) => {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) { console.warn('[PayPal] PAYPAL_WEBHOOK_ID not set — skipping signature verification'); return true; }
    if (!ppConfigured()) return false;
    try {
      const token = await ppToken();
      const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody instanceof Buffer ? JSON.parse(rawBody.toString()) : rawBody);
      const { data } = await axios.post(
        `${PAYPAL_BASE()}/v1/notifications/verify-webhook-signature`,
        {
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: payload,
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      return data.verification_status === 'SUCCESS';
    } catch (e) {
      console.error('[PayPal] Webhook verification failed:', e.response?.data || e.message);
      return false;
    }
  };

  router.post('/webhook', async (req, res) => {
    // Fix 4: verify before processing
    const verified = await verifyPayPalWebhook(req.headers, req.rawBody || req.body);
    if (!verified) {
      console.warn('[PayPal Webhook] Signature verification failed — rejecting');
      return res.status(401).json({ error: 'Webhook signature verification failed' });
    }
    res.status(200).json({ received: true });
    const event = req.body;
    const eventType = event.event_type || '';
    console.log(`[PayPal Webhook] ${eventType} (verified)`);

    try {
      // PAYMENT RECEIVED — log invoice
      if (eventType === 'PAYMENT.SALE.COMPLETED') {
        const resource = event.resource || {};
        const subId = resource.billing_agreement_id;
        const amount = resource.amount?.total || '0';
        const currency = resource.amount?.currency || 'USD';
        if (subId) {
          const { data: client } = await supabase.from('clients')
            .select('id, name').eq('paypal_subscription_id', subId).maybeSingle();
          if (client) {
            await storeBriefing(
              'fatima', 'yousef',
              `Payment Received — ${client.name}`,
              `Recurring subscription payment received.\n\nClient: ${client.name}\nAmount: ${currency} ${amount}\nSubscription: ${subId}\nDate: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
              'normal', client.id
            );
            console.log(`[PayPal] Payment logged for ${client.name}: ${currency} ${amount}`);
          }
        }
      }

      // SUBSCRIPTION CANCELLED — trigger cancellation flow
      else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
        const subId = event.resource?.id;
        if (subId) {
          const { data: client } = await supabase.from('clients')
            .select('id, name, tier').eq('paypal_subscription_id', subId).maybeSingle();
          if (client) {
            await supabase.from('clients').update({ status: 'cancelled' }).eq('id', client.id);
            await storeBriefing(
              'zainab', 'yousef',
              `Subscription Cancelled — ${client.name}`,
              `${client.name} has cancelled their PayPal subscription.\n\nPlan: ${client.tier || 'unknown'}\nSubscription: ${subId}\n\nHassan will follow up in 30 days with a win-back offer.`,
              'high', client.id
            );
            await storeBriefing(
              'zainab', 'hassan',
              `Win-Back: ${client.name} — Follow Up in 30 Days`,
              `${client.name} cancelled their subscription. Follow up in 30 days with a personalised win-back offer. Reference results delivered during their time with us and address their original reason for leaving.`,
              'normal', client.id
            );
            console.log(`[PayPal] Subscription cancelled — client: ${client.name}`);
          }
        }
      }

      // PAYMENT FAILED — alert Fatima + email Yousef
      else if (
        eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' ||
        eventType === 'PAYMENT.SALE.DENIED'
      ) {
        const subId = event.resource?.billing_agreement_id || event.resource?.id;
        let client = null;
        if (subId) {
          const { data } = await supabase.from('clients')
            .select('id, name, tier').eq('paypal_subscription_id', subId).maybeSingle();
          client = data;
        }
        const clientName = client?.name || 'Unknown Client';

        await storeBriefing(
          'fatima', 'yousef',
          `⚠ Payment Failed — ${clientName}`,
          `A subscription payment has failed and requires immediate action.\n\nClient: ${clientName}\nEvent: ${eventType}\nSubscription: ${subId || 'unknown'}\nTime: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n\nRecommended action: Contact ${clientName} to update payment method before next billing cycle.`,
          'urgent', client?.id || null
        );

        if (sgMail) {
          sgMail.send({
            to: 'yousef@aisalesscales.com',
            from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
            subject: `⚠ Payment Failed — ${clientName}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0">
                <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Sales Scales</div>
                <div style="color:white;font-size:16px;font-weight:600;margin-top:6px">Payment Failed Alert</div>
              </div>
              <div style="background:#fff;border:1px solid #fecaca;border-top:none;border-radius:0 0 8px 8px;padding:24px">
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#dc2626;font-weight:600">
                  A subscription payment has failed and requires your attention.
                </div>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;color:#8896a8;font-size:12px;width:140px">Client</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0a1628">${clientName}</td></tr>
                  <tr><td style="padding:8px 0;color:#8896a8;font-size:12px">Event</td><td style="padding:8px 0;font-size:13px;color:#0a1628">${eventType}</td></tr>
                  <tr><td style="padding:8px 0;color:#8896a8;font-size:12px">Subscription</td><td style="padding:8px 0;font-size:12px;color:#8896a8;font-family:monospace">${subId || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#8896a8;font-size:12px">Plan</td><td style="padding:8px 0;font-size:13px;color:#0a1628">${client?.tier || '—'}</td></tr>
                  <tr><td style="padding:8px 0;color:#8896a8;font-size:12px">Time</td><td style="padding:8px 0;font-size:13px;color:#0a1628">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
                </table>
              </div>
            </div>`,
          }).catch(e => console.error('[PayPal] Payment failed email error:', e.message));
        }
        console.log(`[PayPal] Payment failed — ${clientName}: ${eventType}`);
      }
    } catch (e) {
      console.error('[PayPal Webhook] Handler error:', e.message);
    }
  });

  // ─── GET /billing/status ──────────────────────────────────
  router.get('/status', async (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      // Core columns only — separating optional columns avoids a 500 when they don't exist yet
      const { data: client, error: clientErr } = await supabase.from('clients')
        .select('id, name, tier, status, paypal_subscription_id')
        .eq('id', client_id).maybeSingle();
      if (clientErr || !client) return res.status(404).json({ error: 'Client not found' });

      // Optional performance columns — silently ignored if columns don't exist
      const { data: clientPerf } = await supabase.from('clients')
        .select('recovered_revenue, performance_fee_enabled')
        .eq('id', client_id).maybeSingle().catch(() => ({ data: null }));

      // Optional performance_fees table — may not be created yet
      let lastFeeRow = null;
      try {
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lastMonthLabel = lastMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const { data } = await supabase.from('performance_fees')
          .select('fee_amount, month, status').eq('client_id', client_id)
          .eq('month', lastMonthLabel).maybeSingle();
        lastFeeRow = data;
      } catch { /* table not yet created — skip */ }

      const perfBase = {
        recovered_revenue: parseFloat(clientPerf?.recovered_revenue || 0),
        performance_fee_enabled: clientPerf?.performance_fee_enabled !== false,
        estimated_fee: Math.round(parseFloat(clientPerf?.recovered_revenue || 0) * 0.10 * 100) / 100,
        last_perf_fee: lastFeeRow ? parseFloat(lastFeeRow.fee_amount || 0) : 0,
        last_perf_month: lastFeeRow?.month || null,
        last_perf_status: lastFeeRow?.status || null,
      };

      if (!client.paypal_subscription_id || !ppConfigured()) {
        return res.json({
          has_subscription: false,
          tier: client.tier,
          client_status: client.status,
          subscription_id: null,
          paypal_status: null,
          next_billing_date: null,
          last_payment: null,
          ...perfBase,
        });
      }

      const headers = await ppHdrs();
      const { data: sub } = await axios.get(
        `${PAYPAL_BASE()}/v1/billing/subscriptions/${client.paypal_subscription_id}`,
        { headers }
      );

      res.json({
        has_subscription: true,
        tier: client.tier,
        client_status: client.status,
        subscription_id: client.paypal_subscription_id,
        paypal_status: sub.status,
        next_billing_date: sub.billing_info?.next_billing_time || null,
        last_payment: sub.billing_info?.last_payment || null,
        ...perfBase,
      });
    } catch (e) {
      console.error('/billing/status error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── POST /billing/reset-plans ────────────────────────────
  // Force PayPal to recreate subscription plans at new prices ($199/$299/$399).
  // Call once after updating PLANS prices — clears cached plan IDs so next
  // /billing/create-plan call creates fresh plans at the correct amounts.
  router.post('/reset-plans', async (req, res) => {
    try {
      await Promise.all(
        ['paypal_plan_starter', 'paypal_plan_growth', 'paypal_plan_elite', 'paypal_plan_scale']
          .map(key => supabase.from('billing_config').delete().eq('id', key))
      );
      res.json({ ok: true, message: 'PayPal plan IDs cleared — call /billing/create-plan to regenerate at $199/$299/$399' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
