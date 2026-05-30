const express = require('express');

module.exports = ({ supabase, aiCall }) => {
  const router = express.Router();

  router.get('/analytics/stats', async (req, res) => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        emailsRes, smsRes, whatsappRes,
        contactsRes, enrollmentsRes,
        activeSeqRes, totalContactsRes,
        activeEnrollmentsRes, dealsRes,
        inboundRes,
      ] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true })
          .eq('direction', 'outbound').eq('channel', 'Email').gte('created_at', monthStart),
        supabase.from('messages').select('*', { count: 'exact', head: true })
          .eq('direction', 'outbound').eq('channel', 'SMS').gte('created_at', monthStart),
        supabase.from('messages').select('*', { count: 'exact', head: true })
          .eq('direction', 'outbound').eq('channel', 'WhatsApp').gte('created_at', monthStart),
        supabase.from('contacts').select('*', { count: 'exact', head: true })
          .gte('created_at', monthStart),
        supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true })
          .gte('enrolled_at', monthStart),
        supabase.from('workflows').select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('pipeline_deals').select('value, stage'),
        supabase.from('messages').select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound').gte('created_at', monthStart),
      ]);

      const deals = dealsRes.data || [];
      const pipelineValue = deals.reduce((s, d) => s + (d.value || 0), 0);
      const convertedValue = deals.filter(d => d.stage === 'Converted').reduce((s, d) => s + (d.value || 0), 0);

      res.json({
        month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
        emailsSentThisMonth: emailsRes.count || 0,
        smsSentThisMonth: smsRes.count || 0,
        whatsappSentThisMonth: whatsappRes.count || 0,
        contactsAddedThisMonth: contactsRes.count || 0,
        enrollmentsThisMonth: enrollmentsRes.count || 0,
        activeSequences: activeSeqRes.count || 0,
        totalContacts: totalContactsRes.count || 0,
        activeEnrollments: activeEnrollmentsRes.count || 0,
        inboundThisMonth: inboundRes.count || 0,
        pipelineValue,
        convertedValue,
      });
    } catch (e) {
      console.error('Analytics stats error:', e.message);
      res.status(500).json({ error: 'Failed to fetch analytics stats', details: e.message });
    }
  });

  router.get('/revenue/stats', async (req, res) => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [
        { data: deals },
        { data: allEnrollments },
        { data: workflows },
        { data: outboundMessages },
        { data: clients },
      ] = await Promise.all([
        supabase.from('pipeline_deals').select('id, value, stage, client_id, created_at'),
        supabase.from('workflow_enrollments').select('id, workflow_id, client_id, status, enrolled_at, completed_at'),
        supabase.from('workflows').select('id, name, trigger_type, client_id'),
        supabase.from('messages').select('id, channel, client_id, created_at').eq('direction', 'outbound').gte('created_at', monthStart),
        supabase.from('clients').select('id, name'),
      ]);

      const convertedDeals = (deals || []).filter(d => d.stage === 'Converted');
      const thisMonthDeals = convertedDeals.filter(d => d.created_at && d.created_at >= monthStart);
      const lastMonthDeals = convertedDeals.filter(d => d.created_at && d.created_at >= lastMonthStart && d.created_at < monthStart);
      const totalRevenue = thisMonthDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
      const lastMonthRevenue = lastMonthDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);

      const thisMonthEnrollments = (allEnrollments || []).filter(e => e.enrolled_at && e.enrolled_at >= monthStart);
      const completedThisMonth = thisMonthEnrollments.filter(e => e.status === 'completed').length;

      const channelCounts = {};
      for (const m of (outboundMessages || [])) {
        const ch = (m.channel || 'other').toLowerCase();
        channelCounts[ch] = (channelCounts[ch] || 0) + 1;
      }
      const CHANNELS = ['email', 'sms', 'whatsapp', 'voice'];
      const totalTracked = CHANNELS.reduce((s, ch) => s + (channelCounts[ch] || 0), 0) || 1;
      const byChannel = CHANNELS.map(ch => ({
        channel: ch.charAt(0).toUpperCase() + ch.slice(1),
        sent: channelCounts[ch] || 0,
        revenue: Math.round((channelCounts[ch] || 0) / totalTracked * totalRevenue),
      }));

      const triggerMap = {};
      for (const e of (allEnrollments || [])) {
        const wf = (workflows || []).find(w => w.id === e.workflow_id);
        const t = wf?.trigger_type || 'Manual';
        if (!triggerMap[t]) triggerMap[t] = { trigger: t, enrolled: 0, completed: 0 };
        triggerMap[t].enrolled++;
        if (e.status === 'completed') triggerMap[t].completed++;
      }
      const byTrigger = Object.values(triggerMap)
        .sort((a, b) => b.enrolled - a.enrolled)
        .slice(0, 7)
        .map(t => ({ ...t, conversionRate: t.enrolled > 0 ? Math.round((t.completed / t.enrolled) * 100) : 0 }));

      const topSequences = (workflows || []).map(wf => {
        const wfEnrollments = (allEnrollments || []).filter(e => e.workflow_id === wf.id);
        const completed = wfEnrollments.filter(e => e.status === 'completed').length;
        const enrolled = wfEnrollments.length;
        const client = (clients || []).find(c => c.id === wf.client_id);
        return {
          id: wf.id, name: wf.name, trigger: wf.trigger_type,
          clientName: client?.name || '—', enrolled, completed,
          conversionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
        };
      })
        .filter(s => s.enrolled > 0)
        .sort((a, b) => b.conversionRate - a.conversionRate || b.enrolled - a.enrolled)
        .slice(0, 8);

      const clientRevenueMap = {};
      for (const d of convertedDeals) {
        if (!clientRevenueMap[d.client_id]) clientRevenueMap[d.client_id] = { revenue: 0, deals: 0 };
        clientRevenueMap[d.client_id].revenue += Number(d.value) || 0;
        clientRevenueMap[d.client_id].deals++;
      }
      const clientEnrollMap = {};
      for (const e of (allEnrollments || [])) {
        if (!clientEnrollMap[e.client_id]) clientEnrollMap[e.client_id] = { enrolled: 0, completed: 0 };
        clientEnrollMap[e.client_id].enrolled++;
        if (e.status === 'completed') clientEnrollMap[e.client_id].completed++;
      }
      const byClient = (clients || [])
        .map(c => ({
          id: c.id, name: c.name,
          revenue: clientRevenueMap[c.id]?.revenue || 0,
          deals: clientRevenueMap[c.id]?.deals || 0,
          enrolled: clientEnrollMap[c.id]?.enrolled || 0,
          completed: clientEnrollMap[c.id]?.completed || 0,
          conversionRate: clientEnrollMap[c.id]?.enrolled > 0
            ? Math.round((clientEnrollMap[c.id].completed / clientEnrollMap[c.id].enrolled) * 100)
            : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue || b.enrolled - a.enrolled);

      const maxRevenue = byClient.reduce((m, c) => Math.max(m, c.revenue), 0) || 1;

      res.json({
        thisMonth: {
          totalRevenue, totalDeals: thisMonthDeals.length,
          completedEnrollments: completedThisMonth,
          totalEnrollments: thisMonthEnrollments.length,
          revenueChange: lastMonthRevenue > 0
            ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
            : null,
          conversionRate: thisMonthEnrollments.length > 0
            ? Math.round((completedThisMonth / thisMonthEnrollments.length) * 100)
            : 0,
        },
        byChannel, byTrigger, topSequences, byClient, maxRevenue,
      });
    } catch (e) {
      console.error('Revenue stats error:', e.message);
      res.status(500).json({ error: 'Failed to fetch revenue stats', details: e.message });
    }
  });

  router.get('/revenue/dashboard', async (req, res) => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [
        { data: deals },
        { data: allEnrollments },
        { data: workflows },
        { data: outboundMessages },
        { data: clients },
      ] = await Promise.all([
        supabase.from('pipeline_deals').select('id, value, stage, client_id, created_at'),
        supabase.from('workflow_enrollments').select('id, workflow_id, client_id, status, enrolled_at, completed_at'),
        supabase.from('workflows').select('id, name, trigger_type, client_id'),
        supabase.from('messages').select('id, channel, client_id, created_at').eq('direction', 'outbound').gte('created_at', monthStart),
        supabase.from('clients').select('id, name'),
      ]);

      const convertedDeals = (deals || []).filter(d => d.stage === 'Converted');
      const thisMonthDeals = convertedDeals.filter(d => d.created_at && d.created_at >= monthStart);
      const lastMonthDeals = convertedDeals.filter(d => d.created_at && d.created_at >= lastMonthStart && d.created_at < monthStart);
      const totalRevenue = thisMonthDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
      const lastMonthRevenue = lastMonthDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);

      const thisMonthEnrollments = (allEnrollments || []).filter(e => e.enrolled_at && e.enrolled_at >= monthStart);
      const completedThisMonth = thisMonthEnrollments.filter(e => e.status === 'completed').length;

      const channelCounts = {};
      for (const m of (outboundMessages || [])) {
        const ch = (m.channel || 'other').toLowerCase();
        channelCounts[ch] = (channelCounts[ch] || 0) + 1;
      }
      const CHANNELS = ['email', 'sms', 'whatsapp', 'voice'];
      const totalTracked = CHANNELS.reduce((s, ch) => s + (channelCounts[ch] || 0), 0) || 1;
      const byChannel = CHANNELS.map(ch => ({
        channel: ch.charAt(0).toUpperCase() + ch.slice(1),
        sent: channelCounts[ch] || 0,
        revenue: Math.round((channelCounts[ch] || 0) / totalTracked * totalRevenue),
      }));

      const TRIGGER_LABELS = {
        cart_abandoned: 'Cart Recovery',
        post_purchase: 'Post Purchase',
        win_back: 'Win-Back',
        welcome: 'Welcome',
      };
      const triggerMap = {};
      for (const e of (allEnrollments || [])) {
        const wf = (workflows || []).find(w => w.id === e.workflow_id);
        const raw = wf?.trigger_type || 'manual';
        const label = TRIGGER_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (!triggerMap[label]) triggerMap[label] = { trigger: label, enrolled: 0, completed: 0 };
        triggerMap[label].enrolled++;
        if (e.status === 'completed') triggerMap[label].completed++;
      }
      const byTrigger = Object.values(triggerMap)
        .sort((a, b) => b.enrolled - a.enrolled)
        .slice(0, 7)
        .map(t => ({ ...t, conversionRate: t.enrolled > 0 ? Math.round((t.completed / t.enrolled) * 100) : 0 }));

      const topSequences = (workflows || []).map(wf => {
        const wfEnrollments = (allEnrollments || []).filter(e => e.workflow_id === wf.id);
        const completed = wfEnrollments.filter(e => e.status === 'completed').length;
        const enrolled = wfEnrollments.length;
        const client = (clients || []).find(c => c.id === wf.client_id);
        const raw = wf.trigger_type || '';
        return {
          id: wf.id, name: wf.name,
          trigger: TRIGGER_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          clientName: client?.name || '—', enrolled, completed,
          conversionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
        };
      })
        .filter(s => s.enrolled > 0)
        .sort((a, b) => b.conversionRate - a.conversionRate || b.enrolled - a.enrolled)
        .slice(0, 8);

      const clientRevenueMap = {};
      for (const d of convertedDeals) {
        if (!clientRevenueMap[d.client_id]) clientRevenueMap[d.client_id] = { revenue: 0, deals: 0 };
        clientRevenueMap[d.client_id].revenue += Number(d.value) || 0;
        clientRevenueMap[d.client_id].deals++;
      }
      const clientEnrollMap = {};
      for (const e of (allEnrollments || [])) {
        if (!clientEnrollMap[e.client_id]) clientEnrollMap[e.client_id] = { enrolled: 0, completed: 0 };
        clientEnrollMap[e.client_id].enrolled++;
        if (e.status === 'completed') clientEnrollMap[e.client_id].completed++;
      }
      const byClient = (clients || [])
        .map(c => ({
          id: c.id, name: c.name,
          revenue: clientRevenueMap[c.id]?.revenue || 0,
          deals: clientRevenueMap[c.id]?.deals || 0,
          enrolled: clientEnrollMap[c.id]?.enrolled || 0,
          completed: clientEnrollMap[c.id]?.completed || 0,
          conversionRate: clientEnrollMap[c.id]?.enrolled > 0
            ? Math.round((clientEnrollMap[c.id].completed / clientEnrollMap[c.id].enrolled) * 100)
            : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue || b.enrolled - a.enrolled);

      const maxRevenue = byClient.reduce((m, c) => Math.max(m, c.revenue), 0) || 1;

      res.json({
        thisMonth: {
          totalRevenue, totalDeals: thisMonthDeals.length,
          completedEnrollments: completedThisMonth,
          totalEnrollments: thisMonthEnrollments.length,
          revenueChange: lastMonthRevenue > 0
            ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
            : null,
          conversionRate: thisMonthEnrollments.length > 0
            ? Math.round((completedThisMonth / thisMonthEnrollments.length) * 100)
            : 0,
        },
        byChannel, byTrigger, topSequences, byClient, maxRevenue,
      });
    } catch (e) {
      console.error('Revenue dashboard error:', e.message);
      res.status(500).json({ error: 'Failed to fetch revenue data', details: e.message });
    }
  });

  // ─── RETENTION DASHBOARD ─────────────────────────────────
  router.get('/retention/dashboard', async (req, res) => {
    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: clients },
        { data: enrollments },
        { data: onboarding },
      ] = await Promise.all([
        supabase.from('clients').select('id, name, tier, status, health_score').eq('status', 'active').order('health_score', { ascending: true }),
        supabase.from('workflow_enrollments').select('client_id, status, enrolled_at'),
        supabase.from('client_onboarding').select('client_id, average_order_value'),
      ]);

      const aovMap = {};
      for (const o of (onboarding || [])) {
        const parseAov = (txt) => {
          if (!txt) return 75;
          if (txt.includes('Under')) return 25;
          if (txt === '$30–$75') return 52;
          if (txt === '$75–$150') return 112;
          if (txt === '$150–$300') return 225;
          if (txt.includes('Over')) return 350;
          const n = parseFloat(txt.replace(/[^0-9.]/g, ''));
          return isNaN(n) ? 75 : n;
        };
        if (o.client_id) aovMap[o.client_id] = parseAov(o.average_order_value);
      }

      const now = Date.now();
      const enriched = (clients || []).map(c => {
        const clientEnrollments = (enrollments || []).filter(e => e.client_id === c.id);
        const completed = clientEnrollments.filter(e => e.status === 'completed').length;
        const recent = clientEnrollments.filter(e => e.enrolled_at && e.enrolled_at >= fourteenDaysAgo).length;

        const dates = clientEnrollments
          .map(e => e.enrolled_at ? new Date(e.enrolled_at).getTime() : 0)
          .filter(Boolean);
        const lastActivityTs = dates.length > 0 ? Math.max(...dates) : null;
        const daysSinceActivity = lastActivityTs
          ? Math.floor((now - lastActivityTs) / 86400000)
          : null;

        const aov = aovMap[c.id] || 75;
        const revenueRecovered = completed * aov;
        const churnRisk = recent === 0;

        const score = typeof c.health_score === 'number' ? c.health_score : null;
        const tier = score !== null
          ? (score < 50 ? 'at_risk' : score < 80 ? 'needs_attention' : 'healthy')
          : 'needs_attention';

        return {
          id: c.id, name: c.name, tier: c.tier, health_score: score,
          days_since_activity: daysSinceActivity,
          revenue_recovered: revenueRecovered,
          recent_enrollments_14d: recent,
          total_completed: completed,
          churn_risk: churnRisk,
          retention_tier: tier,
        };
      });

      const at_risk = enriched.filter(c => c.retention_tier === 'at_risk');
      const needs_attention = enriched.filter(c => c.retention_tier === 'needs_attention');
      const healthy = enriched.filter(c => c.retention_tier === 'healthy');

      res.json({ clients: enriched, at_risk, needs_attention, healthy });
    } catch (e) {
      console.error('Retention dashboard error:', e.message);
      res.status(500).json({ error: 'Failed to load retention data', details: e.message });
    }
  });

  // POST /retention/checkin — generate a Zainab check-in message for an at-risk client
  router.post('/retention/checkin', async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      const [clientRes, enrollRes, onboardRes] = await Promise.all([
        supabase.from('clients').select('id, name, niche, tier, health_score').eq('id', client_id).maybeSingle(),
        supabase.from('workflow_enrollments').select('id, status, enrolled_at')
          .eq('client_id', client_id).order('enrolled_at', { ascending: false }).limit(50),
        supabase.from('client_onboarding').select('biggest_challenge, goals, monthly_revenue').eq('client_id', client_id).maybeSingle(),
      ]);

      const client = clientRes.data;
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const enrollments = enrollRes.data || [];
      const recent = enrollments.filter(e => {
        const d = new Date(e.enrolled_at);
        return (Date.now() - d.getTime()) < 14 * 86400000;
      }).length;
      const completed = enrollments.filter(e => e.status === 'completed').length;

      const ob = onboardRes.data || {};

      const message = await aiCall(
        `You are Zainab, the Client Partner AI at Sales Scales. You write warm, genuine, personal check-in messages to clients whose engagement has dropped. Your tone is caring and professional — never pushy or salesy. You write as though you know this client personally.`,
        `Write a short check-in message for ${client.name} (${client.niche || 'ecommerce'}, ${client.tier || 'starter'} plan).\n\nContext:\n- Health score: ${client.health_score ?? 'unknown'}/100\n- Enrollments in last 14 days: ${recent}\n- Total completed sequences: ${completed}\n- Their challenge: ${ob.biggest_challenge || 'not specified'}\n- Their goals: ${ob.goals || 'not specified'}\n\nWrite a 3-4 sentence personal message. Open with their name. Reference something specific about their account. Offer to jump on a call or answer questions. Sound like a real person who cares about their results — not a template.`,
        ''
      );

      res.json({ message, client_name: client.name });
    } catch (e) {
      console.error('Retention checkin error:', e.message);
      res.status(500).json({ error: 'Failed to generate check-in message', details: e.message });
    }
  });

  // ─── REVENUE ATTRIBUTION ─────────────────────────────────
  router.get('/revenue/attributed', async (req, res) => {
    try {
      const [
        { data: clients },
        { data: onboarding },
        { data: completedEnrollments },
      ] = await Promise.all([
        supabase.from('clients').select('id, name, tier').eq('status', 'active'),
        supabase.from('client_onboarding').select('client_id, average_order_value'),
        supabase.from('workflow_enrollments').select('client_id').eq('status', 'completed'),
      ]);

      const aovMap = {};
      for (const o of (onboarding || [])) {
        const v = parseFloat(o.average_order_value);
        if (o.client_id && !isNaN(v) && v > 0) aovMap[o.client_id] = v;
      }

      const conversionMap = {};
      for (const e of (completedEnrollments || [])) {
        conversionMap[e.client_id] = (conversionMap[e.client_id] || 0) + 1;
      }

      const DEFAULT_AOV = 75;
      const attribution = (clients || []).map(c => {
        const conversions = conversionMap[c.id] || 0;
        const average_order_value = aovMap[c.id] || DEFAULT_AOV;
        return {
          client_id: c.id,
          client_name: c.name,
          tier: c.tier,
          conversions,
          average_order_value,
          revenue_recovered: Math.round(conversions * average_order_value),
          has_onboarding_data: !!aovMap[c.id],
        };
      }).sort((a, b) => b.revenue_recovered - a.revenue_recovered);

      const total_revenue_recovered = attribution.reduce((s, c) => s + c.revenue_recovered, 0);
      const total_conversions = attribution.reduce((s, c) => s + c.conversions, 0);

      res.json({ attribution, total_revenue_recovered, total_conversions });
    } catch (e) {
      console.error('Revenue attributed error:', e.message);
      res.status(500).json({ error: 'Failed to calculate revenue attribution', details: e.message });
    }
  });

  return router;
};
