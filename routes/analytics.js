const express = require('express');

module.exports = ({ supabase }) => {
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

  return router;
};
