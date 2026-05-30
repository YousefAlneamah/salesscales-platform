const express = require('express');

const HUBSPOT_API = 'https://api.hubapi.com';
const STRIPE_API = 'https://api.stripe.com/v1';
const stripeHeaders = () => ({ Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' });
const toQs = (obj) => new URLSearchParams(obj).toString();

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

module.exports = ({ supabase, axios, aiCall, ragSearch, getBriefingsContext, verifyToken }) => {
  const router = express.Router();

  // ─── KLAVIYO ─────────────────────────────────────────────
  router.post('/klaviyo/stats', async (req, res) => {
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
        id: c.id, name: c.attributes?.name || '',
        status: c.attributes?.status || '',
        sent_at: c.attributes?.send_time || null,
      }));
      const lists = (listsRes.data?.data || []).map(l => ({
        id: l.id, name: l.attributes?.name || '',
        profile_count: l.attributes?.profile_count || 0,
      }));
      const stats = reportRes.error ? {} : (reportRes.data?.data?.attributes?.results?.[0]?.statistics || {});
      const openRate = stats.open_rate != null ? Math.round(stats.open_rate * 100 * 10) / 10 : null;
      const clickRate = stats.click_rate != null ? Math.round(stats.click_rate * 100 * 10) / 10 : null;
      const revenue = stats.revenue != null ? stats.revenue : null;

      res.json({
        ok: true, openRate, clickRate, revenue,
        totalLists: lists.length,
        totalSubscribers: lists.reduce((s, l) => s + l.profile_count, 0),
        lists, recentCampaigns: campaigns,
      });
    } catch (e) {
      const status = e.response?.status;
      if (status === 401 || status === 403) return res.status(401).json({ error: 'Invalid Klaviyo API key' });
      console.error('Klaviyo stats error:', e.message);
      res.status(500).json({ error: 'Failed to fetch Klaviyo data', details: e.message });
    }
  });

  // GET /klaviyo/performance — 30-day campaign metrics for a client (used as MCP context)
  router.get('/klaviyo/performance', async (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      const { data: client } = await supabase.from('clients').select('klaviyo_api_key').eq('id', client_id).maybeSingle();
      const apiKey = client?.klaviyo_api_key;
      if (!apiKey) return res.status(400).json({ error: 'Klaviyo API key not configured for this client' });

      const headers = {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: '2024-10-15',
        'Content-Type': 'application/json',
      };
      const reportRes = await axios.post('https://a.klaviyo.com/api/campaign-values-reports/', {
        data: {
          type: 'campaign-values-report',
          attributes: {
            timeframe: { key: 'last_30_days' },
            conversion_metric_id: null,
            statistics: ['open_rate', 'click_rate', 'revenue', 'unsubscribe_rate'],
          },
        },
      }, { headers }).catch(e => ({ error: e }));

      if (reportRes.error) {
        const status = reportRes.error.response?.status;
        if (status === 401 || status === 403) return res.status(401).json({ error: 'Invalid Klaviyo API key' });
        throw reportRes.error;
      }

      const stats = reportRes.data?.data?.attributes?.results?.[0]?.statistics || {};
      const pct = (v) => v != null ? Math.round(v * 100 * 10) / 10 : null;
      res.json({
        ok: true,
        openRate: pct(stats.open_rate),
        clickRate: pct(stats.click_rate),
        unsubscribeRate: pct(stats.unsubscribe_rate),
        revenue: stats.revenue != null ? stats.revenue : null,
        timeframe: 'last_30_days',
      });
    } catch (e) {
      const status = e.response?.status;
      if (status === 401 || status === 403) return res.status(401).json({ error: 'Invalid Klaviyo API key' });
      console.error('Klaviyo performance error:', e.message);
      res.status(500).json({ error: 'Failed to fetch Klaviyo performance', details: e.message });
    }
  });

  // ─── META ────────────────────────────────────────────────
  router.post('/meta/ad-stats', async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      const { data: client } = await supabase.from('clients')
        .select('meta_access_token, meta_ad_account_id')
        .eq('id', client_id).maybeSingle();

      if (!client?.meta_access_token) return res.status(400).json({ error: 'Meta access token not configured for this client' });
      if (!client?.meta_ad_account_id) return res.status(400).json({ error: 'Meta ad account ID not configured for this client' });

      const token = client.meta_access_token;
      const accountId = client.meta_ad_account_id.startsWith('act_') ? client.meta_ad_account_id : `act_${client.meta_ad_account_id}`;
      const base = 'https://graph.facebook.com/v21.0';

      const [accountRes, adsRes] = await Promise.all([
        axios.get(`${base}/${accountId}/insights`, {
          params: { access_token: token, fields: 'spend,impressions,clicks,ctr,purchase_roas,actions', date_preset: 'last_30_days', level: 'account' },
        }).catch(e => ({ error: e })),
        axios.get(`${base}/${accountId}/insights`, {
          params: { access_token: token, fields: 'ad_name,ad_id,spend,impressions,clicks,ctr,purchase_roas', date_preset: 'last_30_days', level: 'ad', sort: '["spend_descending"]', limit: 5 },
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
          id: ad.ad_id, name: ad.ad_name || '—',
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
        roas, topAds,
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

  // GET /meta/performance — 30-day ad performance for a client
  router.get('/meta/performance', async (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      const { data: client } = await supabase.from('clients')
        .select('meta_access_token, meta_ad_account_id')
        .eq('id', client_id).maybeSingle();
      if (!client?.meta_access_token) return res.status(400).json({ error: 'Meta access token not configured for this client' });
      if (!client?.meta_ad_account_id) return res.status(400).json({ error: 'Meta ad account ID not configured for this client' });

      const token = client.meta_access_token;
      const accountId = client.meta_ad_account_id.startsWith('act_') ? client.meta_ad_account_id : `act_${client.meta_ad_account_id}`;
      const base = 'https://graph.facebook.com/v21.0';

      const insightsRes = await axios.get(`${base}/${accountId}/insights`, {
        params: { access_token: token, fields: 'spend,impressions,clicks,ctr,cpc,cpm,purchase_roas,actions', date_preset: 'last_30_days', level: 'account' },
      }).catch(e => ({ error: e }));

      if (insightsRes.error) {
        const status = insightsRes.error.response?.status;
        const errCode = insightsRes.error.response?.data?.error?.code;
        if (status === 401 || status === 403 || errCode === 190 || errCode === 102) {
          return res.status(401).json({ error: 'Invalid Meta access token' });
        }
        throw insightsRes.error;
      }

      const d = insightsRes.data?.data?.[0] || {};
      const roasArr = d.purchase_roas || [];
      const actions = d.actions || [];
      const results = actions
        .filter(a => /purchase|lead|complete_registration/i.test(a.action_type))
        .reduce((sum, a) => sum + parseInt(a.value || 0, 10), 0);

      res.json({
        ok: true,
        spend: parseFloat(d.spend || 0),
        impressions: parseInt(d.impressions || 0, 10),
        clicks: parseInt(d.clicks || 0, 10),
        ctr: parseFloat(d.ctr || 0),
        cpc: parseFloat(d.cpc || 0),
        cpm: parseFloat(d.cpm || 0),
        roas: roasArr.length > 0 ? parseFloat(roasArr[0]?.value || 0) : null,
        results,
        timeframe: 'last_30_days',
      });
    } catch (e) {
      const status = e.response?.status;
      const errCode = e.response?.data?.error?.code;
      if (status === 401 || status === 403 || errCode === 190 || errCode === 102) {
        return res.status(401).json({ error: 'Invalid Meta access token' });
      }
      console.error('Meta performance error:', e.message);
      res.status(500).json({ error: 'Failed to fetch Meta performance', details: e.message });
    }
  });

  // GET /meta/posts — last 20 Facebook + Instagram posts for a client page
  router.get('/meta/posts', async (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      const { data: client } = await supabase.from('clients')
        .select('meta_access_token, meta_page_id, meta_ig_user_id')
        .eq('id', client_id).maybeSingle();
      if (!client?.meta_access_token) return res.status(400).json({ error: 'Meta access token not configured for this client' });

      const token = client.meta_access_token;
      const base = 'https://graph.facebook.com/v21.0';

      const calls = [];
      if (client.meta_page_id) {
        calls.push(axios.get(`${base}/${client.meta_page_id}/posts`, {
          params: { access_token: token, fields: 'message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true),insights.metric(post_impressions)', limit: 20 },
        }).then(r => ({ type: 'facebook', data: r.data })).catch(e => ({ type: 'facebook', error: e })));
      }
      if (client.meta_ig_user_id) {
        calls.push(axios.get(`${base}/${client.meta_ig_user_id}/media`, {
          params: { access_token: token, fields: 'caption,media_type,permalink,timestamp,like_count,comments_count,insights.metric(reach)', limit: 20 },
        }).then(r => ({ type: 'instagram', data: r.data })).catch(e => ({ type: 'instagram', error: e })));
      }

      if (calls.length === 0) return res.status(400).json({ error: 'No Facebook page ID or Instagram user ID configured for this client' });

      const settled = await Promise.all(calls);
      const posts = [];
      for (const s of settled) {
        if (s.error) {
          const errCode = s.error.response?.data?.error?.code;
          if (errCode === 190 || errCode === 102) return res.status(401).json({ error: 'Invalid Meta access token' });
          continue;
        }
        if (s.type === 'facebook') {
          (s.data?.data || []).forEach(p => posts.push({
            platform: 'facebook',
            content: p.message || '',
            created_time: p.created_time,
            permalink: p.permalink_url || '',
            post_type: 'post',
            reactions: p.reactions?.summary?.total_count || 0,
            comments: p.comments?.summary?.total_count || 0,
            shares: p.shares?.count || 0,
            reach: p.insights?.data?.find(i => i.name === 'post_impressions')?.values?.[0]?.value || 0,
          }));
        } else {
          (s.data?.data || []).forEach(p => posts.push({
            platform: 'instagram',
            content: p.caption || '',
            created_time: p.timestamp,
            permalink: p.permalink || '',
            post_type: (p.media_type || 'IMAGE').toLowerCase(),
            reactions: p.like_count || 0,
            comments: p.comments_count || 0,
            shares: 0,
            reach: p.insights?.data?.find(i => i.name === 'reach')?.values?.[0]?.value || 0,
          }));
        }
      }
      posts.sort((a, b) => new Date(b.created_time) - new Date(a.created_time));
      res.json({ ok: true, posts: posts.slice(0, 20), total: posts.length });
    } catch (e) {
      const errCode = e.response?.data?.error?.code;
      if (errCode === 190 || errCode === 102) return res.status(401).json({ error: 'Invalid Meta access token' });
      console.error('Meta posts error:', e.message);
      res.status(500).json({ error: 'Failed to fetch Meta posts', details: e.message });
    }
  });

  // ─── CANVA ───────────────────────────────────────────────
  router.post('/canva/create-design', async (req, res) => {
    const { client_id, design_type = 'social_post', brand_colors = [], prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    if (!CANVA_URLS[design_type]) return res.status(400).json({ error: `Invalid design_type. Use: ${Object.keys(CANVA_URLS).join(', ')}` });

    try {
      let canva_brand_kit_id = null;
      let clientName = '';
      if (client_id) {
        const { data: client } = await supabase.from('clients')
          .select('name, canva_brand_kit_id').eq('id', client_id).maybeSingle();
        canva_brand_kit_id = client?.canva_brand_kit_id || null;
        clientName = client?.name || '';
      }

      const [ragContext, briefingsCtx] = await Promise.all([
        ragSearch(prompt, client_id),
        getBriefingsContext('mahdi'),
      ]);
      const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');
      const colorBlock = brand_colors.length > 0 ? `Brand Colors: ${brand_colors.join(', ')}` : 'Brand Colors: not specified';

      const brief = await aiCall(
        `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world-class creative director and copywriter who specialises in visual content for ecommerce brands. You produce precise, actionable design briefs. You are Mahdi — never mention Claude.`,
        `Create a detailed Canva design brief for the following:\n\nClient: ${clientName || 'Not specified'}\nDesign Type: ${CANVA_LABELS[design_type]}\n${colorBlock}\nRequest: ${prompt}\n\n${context ? `Brand & client context:\n${context}\n` : ''}Your brief must include:\n1. **Concept** — One sentence creative direction\n2. **Visual Layout** — Exact layout structure (background, focal elements, placement)\n3. **Color Usage** — How to apply each brand color and where\n4. **Typography** — Font style, size hierarchy, and what text goes where\n5. **Copy** — All text elements, headlines, subheads, CTA — ready to paste into Canva\n6. **Imagery** — What photo or graphic style to use\n7. **Mood** — 3 adjectives that define the feel\n\nBe specific and production-ready. A designer should be able to open Canva and execute this immediately.`,
        context
      );

      res.json({ brief, canva_url: CANVA_URLS[design_type], design_type, design_label: CANVA_LABELS[design_type], canva_brand_kit_id });
    } catch (e) {
      console.error('Canva create-design error:', e.message);
      res.status(500).json({ error: 'Failed to generate design brief', details: e.message });
    }
  });

  // POST /canva/create-brief — campaign design brief using the client's brand colors
  router.post('/canva/create-brief', async (req, res) => {
    const { client_id, campaign_type = 'social_post', products } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    const designType = CANVA_URLS[campaign_type] ? campaign_type : 'social_post';
    try {
      const { data: client } = await supabase.from('clients')
        .select('name, canva_brand_kit_id, brand_colors').eq('id', client_id).maybeSingle();
      const clientName = client?.name || '';
      const brandColors = Array.isArray(client?.brand_colors) ? client.brand_colors
        : (client?.brand_colors ? String(client.brand_colors).split(',').map(s => s.trim()).filter(Boolean) : []);

      const [ragContext, briefingsCtx] = await Promise.all([
        ragSearch(`${campaign_type} campaign design for ${products || clientName}`, client_id),
        getBriefingsContext('mahdi'),
      ]);
      const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');
      const colorBlock = brandColors.length > 0 ? `Brand Colors: ${brandColors.join(', ')}` : 'Brand Colors: not specified';

      const brief = await aiCall(
        `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world-class creative director and copywriter for ecommerce brands. You produce precise, production-ready Canva design briefs. You are Mahdi — never mention Claude.`,
        `Create a detailed Canva design brief for a ${CANVA_LABELS[designType]} campaign.\n\nClient: ${clientName || 'Not specified'}\nCampaign Type: ${campaign_type}\nProducts to feature: ${products || 'not specified'}\n${colorBlock}\n\n${context ? `Brand & client context:\n${context}\n` : ''}Your brief must include:\n1. **Concept** — One sentence creative direction\n2. **Visual Layout** — Background, focal elements, placement\n3. **Color Usage** — How to apply each brand color and where\n4. **Typography** — Font style, size hierarchy, what text goes where\n5. **Copy** — Headlines, subheads, CTA — ready to paste into Canva\n6. **Imagery** — Photo or graphic style to use\n7. **Mood** — 3 adjectives\n\nBe specific and production-ready.`,
        context
      );

      res.json({
        ok: true,
        brief,
        canva_url: CANVA_URLS[designType],
        campaign_type: designType,
        design_label: CANVA_LABELS[designType],
        brand_colors: brandColors,
        canva_brand_kit_id: client?.canva_brand_kit_id || null,
      });
    } catch (e) {
      console.error('Canva create-brief error:', e.message);
      res.status(500).json({ error: 'Failed to create Canva brief', details: e.message });
    }
  });

  // ─── HIGGSFIELD ──────────────────────────────────────────
  // Two modes on the same path: video-generation ({ product_name | script }) vs brief ({ video_type, prompt }).
  router.post('/higgsfield/create-video', async (req, res) => {
    const { client_id, product_name, script, video_type = 'product_showcase', prompt } = req.body;

    // Video-generation mode — requested when product_name or script is supplied.
    if (product_name || script) {
      try {
        let clientName = '';
        if (client_id) {
          const { data: client } = await supabase.from('clients').select('name').eq('id', client_id).maybeSingle();
          clientName = client?.name || '';
        }
        const [ragContext, briefingsCtx] = await Promise.all([
          ragSearch(`video ad for ${product_name || clientName}`, client_id),
          getBriefingsContext('mahdi'),
        ]);
        const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');

        // No HIGGSFIELD_API_KEY available — generate a production-ready scene script and return the studio URL.
        const generationScript = await aiCall(
          `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world-class AI video director who writes Higgsfield.ai generation prompts. You are Mahdi — never mention Claude.`,
          `Write a complete Higgsfield.ai video ad generation script.\n\nClient: ${clientName || 'Not specified'}\nProduct: ${product_name || 'Not specified'}\n${script ? `Provided script / direction:\n${script}\n` : ''}\n${context ? `Brand & client context:\n${context}\n` : ''}Output 4–6 numbered scene prompts. Each scene: a single paste-ready Higgsfield generation prompt describing subject, camera motion, lighting, and mood, plus the on-screen text for that scene. End with a CTA frame.`,
          context
        );

        return res.json({
          ok: true,
          mode: 'video',
          script: generationScript,
          video_url: 'https://higgsfield.ai/create',
          product_name: product_name || null,
        });
      } catch (e) {
        console.error('Higgsfield create-video (video mode) error:', e.message);
        return res.status(500).json({ error: 'Failed to generate video', details: e.message });
      }
    }

    // Brief mode (existing behavior).
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    if (!HIGGSFIELD_LABELS[video_type]) {
      return res.status(400).json({ error: `Invalid video_type. Use: ${Object.keys(HIGGSFIELD_LABELS).join(', ')}` });
    }

    try {
      let clientName = '';
      if (client_id) {
        const { data: client } = await supabase.from('clients').select('name').eq('id', client_id).maybeSingle();
        clientName = client?.name || '';
      }

      const [ragContext, briefingsCtx] = await Promise.all([
        ragSearch(prompt, client_id),
        getBriefingsContext('mahdi'),
      ]);
      const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');

      const brief = await aiCall(
        `You are Mahdi, the Marketing and Content AI at Sales Scales. You are a world-class video creative director who specialises in AI-generated video content for ecommerce brands. You produce precise, cinematic, production-ready video briefs optimised for Higgsfield.ai. You are Mahdi — never mention Claude.`,
        `Create a detailed Higgsfield.ai video production brief for the following:\n\nClient: ${clientName || 'Not specified'}\nVideo Type: ${HIGGSFIELD_LABELS[video_type]}\nTechnical Specs: ${HIGGSFIELD_SPECS[video_type]}\nRequest: ${prompt}\n\n${context ? `Brand & client context:\n${context}\n` : ''}Your brief must include:\n1. **Concept** — One-sentence creative hook and story angle\n2. **Scene Breakdown** — Shot-by-shot description (3–6 scenes with timing)\n3. **Visual Style** — Camera movement, lighting mood, colour grade, aesthetic references\n4. **Motion Direction** — Specific AI motion prompts for Higgsfield (zoom, pan, pull, orbit, etc.)\n5. **Text Overlays** — All on-screen text, timing, placement, and animation style\n6. **Audio Mood** — Music tempo, genre, and sound design direction\n7. **Call to Action** — Final frame CTA — exact wording and visual treatment\n\nMake every scene description specific enough to paste directly into Higgsfield as a generation prompt. Output must be immediately usable.`,
        context
      );

      res.json({ brief, higgsfield_url: HIGGSFIELD_URLS[video_type], video_type, video_label: HIGGSFIELD_LABELS[video_type], specs: HIGGSFIELD_SPECS[video_type] });
    } catch (e) {
      console.error('Higgsfield create-video error:', e.message);
      res.status(500).json({ error: 'Failed to generate video brief', details: e.message });
    }
  });

  // ─── HUBSPOT ─────────────────────────────────────────────
  router.post('/hubspot/sync-contacts', verifyToken, async (req, res) => {
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
          idProperty: 'email', id: c.email,
          properties: {
            email: c.email, firstname: c.first_name || '',
            lastname: c.last_name || '', phone: c.phone || '',
            hs_lead_status: c.pipeline_stage || '',
            lead_source: c.source || '',
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

  router.get('/hubspot/contact-count', async (req, res) => {
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

  // ─── STRIPE ──────────────────────────────────────────────
  router.post('/stripe/create-subscription', async (req, res) => {
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

  router.get('/stripe/billing', verifyToken, async (req, res) => {
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

  // ─── WHISPER ─────────────────────────────────────────────
  router.post('/whisper/transcribe', async (req, res) => {
    const { audio_base64, filename, mime_type } = req.body;
    if (!audio_base64) return res.status(400).json({ error: 'audio_base64 required' });
    try {
      const FormData = require('form-data');
      const audioBuffer = Buffer.from(audio_base64, 'base64');
      const form = new FormData();
      form.append('file', audioBuffer, { filename: filename || 'recording.mp3', contentType: mime_type || 'audio/mpeg' });
      form.append('model', 'whisper-1');
      const { data } = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
        maxBodyLength: 25 * 1024 * 1024,
      });
      res.json({ text: data.text || '' });
    } catch (e) {
      console.error('Whisper transcribe error:', e.message);
      res.status(500).json({ error: 'Transcription failed', details: e.response?.data?.error?.message || e.message });
    }
  });

  // ─── COMPETITOR ──────────────────────────────────────────
  router.post('/competitor/analyze', async (req, res) => {
    const { facebook_page_url, client_id } = req.body;
    if (!facebook_page_url) return res.status(400).json({ error: 'facebook_page_url required' });
    try {
      const ragContext = await ragSearch(`competitor analysis ecommerce agency positioning`, client_id);
      const analysis = await aiCall(
        `You are Hussain, Intelligence & Strategy AI for Sales Scales — a high-ticket ecommerce growth agency. You are a sharp, data-driven analyst with a founder mindset. You never break character.`,
        `Analyze this competitor based on their Facebook page URL: ${facebook_page_url}\n\nProvide a structured competitive intelligence report covering:\n1. Likely brand positioning and core value proposition\n2. Target audience and customer segments\n3. Estimated price point and market tier (budget / mid-market / premium / high-ticket)\n4. Probable marketing channels, ad style, and messaging tone\n5. Key weaknesses and vulnerabilities we can exploit\n6. Strategic angles for Sales Scales to win against them\n\nBe direct, specific, and actionable. Think like a founder preparing for battle.`,
        ragContext
      );
      res.json({ analysis });
    } catch (e) {
      console.error('Competitor analyze error:', e.message);
      res.status(500).json({ error: 'Analysis failed', details: e.message });
    }
  });

  // POST /competitors/analyze — full competitive intelligence: Ad Library lookup, social presence,
  // Hussain report, stored in competitor_analysis + submitted to approvals as competitor_report.
  router.post('/competitors/analyze', async (req, res) => {
    const { competitor_url, client_id } = req.body;
    if (!competitor_url) return res.status(400).json({ error: 'competitor_url required' });
    try {
      // Derive a brand name / handle from the URL.
      let brand = competitor_url;
      try {
        const host = new URL(competitor_url.startsWith('http') ? competitor_url : `https://${competitor_url}`).hostname;
        brand = host.replace(/^www\./, '').split('.')[0];
      } catch { brand = competitor_url.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/.]/)[0]; }
      const handle = brand.replace(/[^a-z0-9_.]/gi, '').toLowerCase();

      const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(brand)}&search_type=keyword_unordered`;
      const socialPresence = {
        instagram: `https://www.instagram.com/${handle}/`,
        tiktok: `https://www.tiktok.com/@${handle}`,
        twitter: `https://twitter.com/${handle}`,
        facebook_ad_library: adLibraryUrl,
      };

      // Attempt live Facebook Ad Library API lookup using any client's Meta token (best effort).
      let activeAds = [];
      try {
        let token = null;
        if (client_id) {
          const { data: c } = await supabase.from('clients').select('meta_access_token').eq('id', client_id).maybeSingle();
          token = c?.meta_access_token || null;
        }
        if (!token) {
          const { data: anyClient } = await supabase.from('clients').select('meta_access_token').not('meta_access_token', 'is', null).limit(1).maybeSingle();
          token = anyClient?.meta_access_token || null;
        }
        if (token) {
          const adRes = await axios.get('https://graph.facebook.com/v21.0/ads_archive', {
            params: {
              access_token: token,
              search_terms: brand,
              ad_reached_countries: "['US']",
              ad_active_status: 'ACTIVE',
              fields: 'ad_creative_bodies,ad_creative_link_titles,page_name,ad_delivery_start_time',
              limit: 15,
            },
          }).catch(e => ({ error: e }));
          if (!adRes.error) {
            activeAds = (adRes.data?.data || []).map(a => ({
              page_name: a.page_name || '',
              body: (a.ad_creative_bodies || [])[0] || '',
              title: (a.ad_creative_link_titles || [])[0] || '',
              started: a.ad_delivery_start_time || null,
            }));
          }
        }
      } catch (adErr) { console.log('Ad Library lookup skipped:', adErr.message); }

      const ragContext = await ragSearch('competitor analysis ecommerce positioning ad angles', client_id);
      const adsBlock = activeAds.length > 0
        ? `Live active ads found in the Facebook Ad Library (${activeAds.length}):\n` +
          activeAds.map((a, i) => `${i + 1}. [${a.page_name}] ${a.title ? a.title + ' — ' : ''}${a.body}`.slice(0, 300)).join('\n')
        : 'No live ads were retrieved from the Facebook Ad Library (no token or none active). Infer their likely ad strategy from the brand and category.';

      const analysis = await aiCall(
        `You are Hussain, Intelligence & Strategy AI for Sales Scales — a high-ticket ecommerce growth agency. You are a sharp, data-driven analyst with a founder mindset. You never break character or mention Claude.`,
        `Produce a competitive intelligence report on this competitor.\n\nCompetitor: ${brand}\nURL: ${competitor_url}\nSocial presence to check:\n- Instagram: ${socialPresence.instagram}\n- TikTok: ${socialPresence.tiktok}\n- Twitter/X: ${socialPresence.twitter}\n- Facebook Ad Library: ${adLibraryUrl}\n\n${adsBlock}\n\nYour report must cover:\n1. **What They're Running** — Their active ad strategy, channels, and creative formats\n2. **Angles They Use** — The hooks, offers, and messaging angles in their marketing\n3. **Gaps & Weaknesses** — Where they are exposed or underperforming\n4. **3 Specific Recommendations** — Exact, actionable moves Sales Scales should make to outperform them\n\nBe direct, specific, and tactical. Think like a founder preparing for battle.`,
        ragContext
      );

      // Store the analysis.
      const { data: stored } = await supabase.from('competitor_analysis').insert([{
        client_id: client_id || null,
        competitor_url,
        competitor_name: brand,
        ad_library_url: adLibraryUrl,
        social_presence: socialPresence,
        active_ads: activeAds,
        report: analysis,
        created_at: new Date().toISOString(),
      }]).select().single();

      // Submit to approvals for Hussain to review.
      await supabase.from('approvals').insert([{
        type: 'competitor_report',
        title: `Competitor Report — ${brand}`,
        content: analysis,
        metadata: { competitor_url, competitor_name: brand, ad_library_url: adLibraryUrl, active_ads_count: activeAds.length, analysis_id: stored?.id || null },
        from_member: 'hussain',
        client_id: client_id || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      }]);

      res.json({ ok: true, analysis: stored, report: analysis, social_presence: socialPresence, active_ads: activeAds });
    } catch (e) {
      console.error('Competitors analyze error:', e.message);
      res.status(500).json({ error: 'Analysis failed', details: e.message });
    }
  });

  // GET /meta/page-info?client_id=xxx — live page/IG name lookup for display
  router.get('/meta/page-info', async (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      const { data: client } = await supabase.from('clients')
        .select('meta_access_token, meta_page_id, meta_ig_user_id')
        .eq('id', client_id).maybeSingle();
      if (!client) return res.json({ page_name: null, ig_username: null });

      const token = client.meta_access_token;
      let page_name = null, ig_username = null;

      if (token && client.meta_page_id) {
        try {
          const r = await axios.get(`https://graph.facebook.com/v21.0/${client.meta_page_id}`, {
            params: { access_token: token, fields: 'name' },
          });
          page_name = r.data.name || null;
        } catch { /* best effort */ }
      }

      if (token && client.meta_ig_user_id) {
        try {
          const r = await axios.get(`https://graph.facebook.com/v21.0/${client.meta_ig_user_id}`, {
            params: { access_token: token, fields: 'username' },
          });
          ig_username = r.data.username || null;
        } catch { /* best effort */ }
      }

      res.json({ page_name, ig_username });
    } catch (e) {
      console.error('Meta page-info error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /social/schedule-post — schedule/publish a post to Facebook and/or Instagram
  router.post('/social/schedule-post', async (req, res) => {
    const { client_id, content, platforms = [], scheduled_time, image_url } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    if (!content && !image_url) return res.status(400).json({ error: 'content or image_url required' });
    if (!Array.isArray(platforms) || platforms.length === 0) return res.status(400).json({ error: 'platforms array required (facebook, instagram)' });
    try {
      const { data: client } = await supabase.from('clients')
        .select('meta_access_token, meta_page_id, meta_ig_user_id')
        .eq('id', client_id).maybeSingle();

      const base = 'https://graph.facebook.com/v21.0';
      const token = client?.meta_access_token;
      const isFuture = scheduled_time && new Date(scheduled_time).getTime() > Date.now();
      const results = {};
      let anyPosted = false;

      if (token) {
        // Facebook page post.
        if (platforms.includes('facebook') && client.meta_page_id) {
          try {
            const params = image_url
              ? { url: image_url, caption: content || '', access_token: token }
              : { message: content || '', access_token: token };
            const endpoint = image_url ? `${base}/${client.meta_page_id}/photos` : `${base}/${client.meta_page_id}/feed`;
            if (isFuture) {
              params.published = false;
              params.scheduled_publish_time = Math.floor(new Date(scheduled_time).getTime() / 1000);
            }
            const r = await axios.post(endpoint, null, { params });
            results.facebook = { ok: true, id: r.data.id || r.data.post_id || null };
            if (!isFuture) anyPosted = true;
          } catch (fbErr) {
            results.facebook = { ok: false, error: fbErr.response?.data?.error?.message || fbErr.message };
          }
        }
        // Instagram post (requires image_url — IG content publishing needs a media container).
        if (platforms.includes('instagram') && client.meta_ig_user_id && image_url) {
          try {
            const containerRes = await axios.post(`${base}/${client.meta_ig_user_id}/media`, null, {
              params: { image_url, caption: content || '', access_token: token },
            });
            const creationId = containerRes.data.id;
            if (!isFuture && creationId) {
              const pub = await axios.post(`${base}/${client.meta_ig_user_id}/media_publish`, null, {
                params: { creation_id: creationId, access_token: token },
              });
              results.instagram = { ok: true, id: pub.data.id || null };
              anyPosted = true;
            } else {
              results.instagram = { ok: true, creation_id: creationId, note: 'container created — will publish at scheduled time' };
            }
          } catch (igErr) {
            results.instagram = { ok: false, error: igErr.response?.data?.error?.message || igErr.message };
          }
        } else if (platforms.includes('instagram') && !image_url) {
          results.instagram = { ok: false, error: 'Instagram posts require image_url' };
        }
      } else {
        results.note = 'No Meta access token configured for this client — post stored as scheduled only.';
      }

      const status = anyPosted ? 'posted' : 'scheduled';
      const { data: stored } = await supabase.from('social_posts').insert([{
        client_id,
        content: content || '',
        platforms,
        image_url: image_url || null,
        scheduled_time: scheduled_time || null,
        status,
        result: results,
        created_at: new Date().toISOString(),
        posted_at: anyPosted ? new Date().toISOString() : null,
      }]).select().single();

      res.json({ ok: true, status, post: stored, results });
    } catch (e) {
      console.error('Social schedule-post error:', e.message);
      res.status(500).json({ error: 'Failed to schedule post', details: e.message });
    }
  });

  return router;
};
