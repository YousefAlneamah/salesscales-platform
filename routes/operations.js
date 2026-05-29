const express = require('express');

const TIER_FEE_DEFAULT = { starter: 997, growth: 1997, scale: 3997, enterprise: 4997 };

const TIER_SERVICE_MAP = {
  starter:    'AI-powered email marketing, SMS campaigns, workflow automation (up to 3 sequences), CRM contact management, monthly analytics report, and access to the full AI team (Hussain, Hassan, Ali, Mahdi, Fatima, Zainab)',
  growth:     'Everything in Starter, plus WhatsApp automation, unlimited sequences, Klaviyo integration, Meta Ads reporting, HubSpot CRM sync, weekly strategy calls, and priority AI team support',
  scale:      'Everything in Growth, plus dedicated account management, voice AI agents, custom workflow builds, Shopify live data integration, Canva & Higgsfield AI design briefs, competitor intelligence, and monthly executive reports',
  enterprise: 'Fully custom engagement — all platform features, white-label options, custom AI agent training, dedicated infrastructure, and a tailored SLA',
};

module.exports = ({ supabase, aiCall, ragSearch, getBriefingsContext, verifyToken, storeKnowledge }) => {
  const router = express.Router();

  // ─── CASE STUDIES ────────────────────────────────────────
  router.post('/casestudies/create', async (req, res) => {
    try {
      const { client_id, title, results, timeline } = req.body;
      if (!title || !results) return res.status(400).json({ error: 'title and results are required' });
      const { data: client } = await supabase.from('clients').select('name, niche').eq('id', client_id).maybeSingle();
      const clientName = client?.name || 'the client';
      const niche = client?.niche || 'ecommerce';
      const context = await ragSearch(title + ' ' + results, client_id);
      const caseStudy = await aiCall(
        `You are Hussain, Intelligence & Strategy AI at Sales Scales. You write compelling, data-driven case studies that showcase client wins. Write professionally and engagingly. Never break character or mention Claude.`,
        `Write a professional case study for ${clientName} (${niche}).\nTitle: ${title}\nResults: ${results}\nTimeline: ${timeline || 'not specified'}\n\nWrite with these sections:\n1. Executive Summary (2-3 sentences, lead with the biggest result)\n2. The Challenge (problem before Sales Scales)\n3. Our Strategy (what we implemented — sequences, AI, automation)\n4. Implementation (how we rolled it out)\n5. The Results (specific numbers from the data)\n6. Key Takeaways (3 bullet points)\n7. Client Quote (realistic quote)`,
        context
      );
      const { data, error } = await supabase.from('case_studies').insert([{
        client_id: client_id || null, title, results, timeline: timeline || null, content: caseStudy, status: 'draft',
      }]).select();
      if (error) throw error;
      res.json({ case_study: data[0] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/casestudies/list', async (req, res) => {
    try {
      const { client_id } = req.query;
      let query = supabase.from('case_studies').select('*, clients(name)').order('created_at', { ascending: false });
      if (client_id) query = query.eq('client_id', client_id);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ case_studies: data || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/case-studies', async (req, res) => {
    try {
      const { client_id } = req.query;
      let query = supabase.from('case_studies').select('*, clients(name)').order('created_at', { ascending: false });
      if (client_id) query = query.eq('client_id', client_id);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ case_studies: data || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── REFERRALS ───────────────────────────────────────────
  router.post('/referrals/create', async (req, res) => {
    try {
      const { referrer_name, referrer_email, referred_business, notes } = req.body;
      if (!referrer_name || !referred_business) return res.status(400).json({ error: 'referrer_name and referred_business are required' });
      const { data, error } = await supabase.from('referrals').insert([{
        referrer_name, referrer_email: referrer_email || null, referred_business, notes: notes || null, status: 'pending',
      }]).select();
      if (error) throw error;
      res.json({ referral: data[0] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/referrals/list', async (req, res) => {
    try {
      const { data, error } = await supabase.from('referrals').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json({ referrals: data || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch('/referrals/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const { data, error } = await supabase.from('referrals').update({ status }).eq('id', req.params.id).select();
      if (error) throw error;
      res.json({ referral: data[0] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── REFERRAL REWARD ─────────────────────────────────────
  router.post('/referrals/reward', async (req, res) => {
    try {
      const { referral_id } = req.body;
      if (!referral_id) return res.status(400).json({ error: 'referral_id required' });

      const { data: referral, error: fetchErr } = await supabase
        .from('referrals').select('*').eq('id', referral_id).maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!referral) return res.status(404).json({ error: 'Referral not found' });
      if (referral.status !== 'converted') {
        return res.status(400).json({ error: 'Referral must be converted before issuing a reward' });
      }
      if (referral.rewarded_at) {
        return res.status(409).json({ error: 'Reward already issued for this referral', rewarded_at: referral.rewarded_at });
      }

      const rewarded_at = new Date().toISOString();
      const { error: updateErr } = await supabase.from('referrals')
        .update({ rewarded_at }).eq('id', referral_id);
      if (updateErr) throw updateErr;

      await supabase.from('team_briefings').insert([{
        from_member: 'zainab',
        to_member: 'yousef',
        subject: `Referral Reward Owed — ${referral.referred_business}`,
        content: `A referral has converted and a reward needs to be processed.\n\nReferrer: ${referral.referrer_name}${referral.referrer_email ? ` (${referral.referrer_email})` : ''}\nReferred Business: ${referral.referred_business}\nConverted: ✓\nRewarded At: ${new Date(rewarded_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}${referral.notes ? `\n\nNotes: ${referral.notes}` : ''}\n\nPlease process the referral reward for ${referral.referrer_name} at your earliest convenience.`,
        priority: 'high',
        is_read: false,
        created_at: rewarded_at,
      }]);

      console.log(`Referral reward flagged: ${referral.referred_business} → ${referral.referrer_name}`);
      res.json({ ok: true, rewarded_at, referral: { ...referral, rewarded_at } });
    } catch (e) {
      console.error('Referral reward error:', e.message);
      res.status(500).json({ error: 'Failed to process referral reward', details: e.message });
    }
  });

  // ─── REFERRAL LINK GENERATION ────────────────────────────
  router.get('/referrals/link', async (req, res) => {
    try {
      const { client_id } = req.query;
      if (!client_id) return res.status(400).json({ error: 'client_id required' });

      const { data: client, error: fetchErr } = await supabase
        .from('clients').select('id, name, referral_code').eq('id', client_id).maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!client) return res.status(404).json({ error: 'Client not found' });

      let code = client.referral_code;
      if (!code) {
        const nameSlug = (client.name || 'REF').replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        code = `${nameSlug}-${randomPart}`;
        const { error: updateErr } = await supabase.from('clients')
          .update({ referral_code: code }).eq('id', client_id);
        if (updateErr) throw updateErr;
      }

      const BASE_URL = process.env.APP_URL || 'https://salesscales.com';
      res.json({
        client_id,
        client_name: client.name,
        referral_code: code,
        referral_link: `${BASE_URL}/refer?code=${code}`,
      });
    } catch (e) {
      console.error('Referral link error:', e.message);
      res.status(500).json({ error: 'Failed to generate referral link', details: e.message });
    }
  });

  // ─── SEQUENCES FEEDBACK ──────────────────────────────────
  router.post('/sequences/feedback', async (req, res) => {
    try {
      const { workflow_id } = req.body;
      if (!workflow_id) return res.status(400).json({ error: 'workflow_id is required' });
      const { data: workflow } = await supabase.from('workflows').select('*, clients(name)').eq('id', workflow_id).maybeSingle();
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
      const [totalR, completedR, cancelledR, activeR, stepsResult] = await Promise.all([
        supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow_id),
        supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow_id).eq('status', 'completed'),
        supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow_id).eq('status', 'cancelled'),
        supabase.from('workflow_enrollments').select('*', { count: 'exact', head: true }).eq('workflow_id', workflow_id).eq('status', 'active'),
        supabase.from('workflow_steps').select('*').eq('workflow_id', workflow_id).order('step_order'),
      ]);
      const total = totalR.count || 0;
      const completed = completedR.count || 0;
      const cancelled = cancelledR.count || 0;
      const active = activeR.count || 0;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const dropOffRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
      const stepList = stepsResult.data || [];
      const context = await ragSearch(workflow.trigger_type + ' sequence optimization', workflow.client_id);
      const analysis = await aiCall(
        `You are Hussain, Intelligence & Strategy AI at Sales Scales. You analyze automation sequence performance and deliver sharp, specific optimization recommendations. Be direct and data-driven. Never break character or mention Claude.`,
        `Analyze this sequence and provide improvement recommendations:\n\nSequence: ${workflow.name}\nClient: ${workflow.clients?.name || 'Unknown'}\nTrigger: ${workflow.trigger_type}\n\nPerformance:\n- Enrolled: ${total} | Completed: ${completed} (${completionRate}%) | Dropped off: ${cancelled} (${dropOffRate}%) | Active: ${active}\n\nSteps (${stepList.length}):\n${stepList.map((s, i) => `Step ${i + 1}: ${s.step_type.toUpperCase()}${s.step_type === 'wait' ? ` — ${s.wait_hours}h wait` : s.subject ? ` — "${s.subject}"` : ''}`).join('\n') || 'No steps configured'}\n\nProvide:\n1. Performance Grade (A–F with reasoning)\n2. Top 3 Problems hurting performance\n3. Quick Wins (3 immediate changes)\n4. Step-by-step recommendations\n5. 30-Day projection if improvements made`,
        context
      );
      res.json({ analysis, stats: { total, completed, cancelled, active, completionRate, dropOffRate } });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── CONTRACTS ───────────────────────────────────────────
  router.post('/contracts/create', verifyToken, async (req, res) => {
    const { client_id, tier, monthly_fee, start_date } = req.body;
    if (!client_id || !tier || !monthly_fee || !start_date)
      return res.status(400).json({ error: 'client_id, tier, monthly_fee, and start_date are required' });

    try {
      const { data: client } = await supabase.from('clients').select('id, name, niche').eq('id', client_id).maybeSingle();
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const services = TIER_SERVICE_MAP[tier.toLowerCase()] || TIER_SERVICE_MAP.starter;
      const fmtFee = parseFloat(monthly_fee).toLocaleString('en-US', { minimumFractionDigits: 2 });
      const fmtDate = new Date(start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

      const contractText = await aiCall(
        `You are Zainab, the Client Partner AI at Sales Scales. You draft professional, clear, and legally structured service agreements. You write in formal legal language, are thorough, and ensure both parties are fully protected. Never break character or mention Claude.`,
        `Generate a complete professional service agreement between Sales Scales (the Agency) and ${client.name} (the Client).\n\nContract Details:\n- Client: ${client.name}${client.niche ? ` (${client.niche} industry)` : ''}\n- Service Tier: ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan\n- Monthly Fee: $${fmtFee} USD\n- Commencement Date: ${fmtDate}\n- Services Included: ${services}\n\nWrite the full agreement with all of these sections, each clearly headed:\n\n1. PARTIES\n   Full identification: Sales Scales (the Agency, a digital marketing and AI automation company) and ${client.name} (the Client). Include today's date as the agreement date.\n\n2. SERVICES\n   Describe the ${tier} tier services in detail. Be specific about what is and is not included.\n\n3. PAYMENT TERMS\n   Monthly fee of $${fmtFee} USD. Due on the 1st of each calendar month. 5-day grace period. 1.5% monthly late fee on overdue amounts. Payment via bank transfer or agreed method.\n\n4. TERM AND RENEWAL\n   Commences ${fmtDate}. Month-to-month, automatically renewing unless either party provides written notice of cancellation.\n\n5. INTELLECTUAL PROPERTY\n   All client data, brand assets, and existing intellectual property remain the exclusive property of the Client. Sales Scales retains all IP in its platform, AI systems, workflows, and methodologies.\n\n6. CONFIDENTIALITY\n   Mutual non-disclosure covering all business information, strategies, data, and communications. Obligation survives termination indefinitely.\n\n7. PERFORMANCE AND RESULTS\n   Agency commits to best-efforts service delivery. Marketing results depend on many factors outside the Agency's control and are not guaranteed.\n\n8. LIMITATION OF LIABILITY\n   Neither party liable for indirect or consequential damages. Agency's total liability capped at three (3) months of fees paid.\n\n9. TERMINATION\n   Either party may terminate with 30 days written notice. Agency may terminate immediately for non-payment exceeding 15 days. Upon termination, all client data is returned within 14 days.\n\n10. GOVERNING LAW\n    This agreement is governed by the laws of the State of Kuwait. Any disputes shall be resolved through arbitration in Kuwait City.\n\n11. ENTIRE AGREEMENT\n    This agreement constitutes the entire understanding between the parties and supersedes all prior communications, negotiations, and agreements relating to the subject matter.\n\n12. SIGNATURES\n    Include signature blocks for both parties with: Name, Title, Date, Signature lines. Agency signatory: Yousef Al-Neamah, Founder & CEO, Sales Scales.\n\nWrite the full agreement text. Use formal legal language throughout. Do not include any commentary outside the contract itself.`,
        ''
      );

      const { data: contract, error: insertErr } = await supabase.from('contracts').insert({
        client_id, client_name: client.name, tier,
        monthly_fee: parseFloat(monthly_fee), start_date,
        status: 'draft', contract_text: contractText,
      }).select().single();

      if (insertErr) throw insertErr;
      res.json({ contract });
    } catch (e) {
      console.error('contracts/create error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/contracts/list', async (req, res) => {
    const { client_id } = req.query;
    try {
      let q = supabase
        .from('contracts')
        .select('id, client_id, client_name, tier, monthly_fee, start_date, status, contract_text, signee_name, signed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (client_id) q = q.eq('client_id', client_id);
      const { data, error } = await q;
      if (error) throw error;
      res.json({ contracts: data || [] });
    } catch (e) {
      console.error('contracts/list error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  router.patch('/contracts/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const valid = ['draft', 'sent', 'signed', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    try {
      const { data, error } = await supabase.from('contracts').update({ status }).eq('id', id).select().single();
      if (error) throw error;
      res.json({ contract: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch('/contracts/:id/sign', async (req, res) => {
    const { id } = req.params;
    const { signee_name, signed_at } = req.body;
    if (!signee_name) return res.status(400).json({ error: 'signee_name is required' });
    try {
      const { data, error } = await supabase.from('contracts')
        .update({ status: 'signed', signee_name, signed_at: signed_at || new Date().toISOString() })
        .eq('id', id).select().single();
      if (error) throw error;
      res.json({ contract: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── REPORTS ─────────────────────────────────────────────
  router.post('/reports/generate', verifyToken, async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const period = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      const { data: client } = await supabase.from('clients').select('id, name, niche, tier').eq('id', client_id).maybeSingle();
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const [
        emailRes, smsRes, waRes, contactsRes, enrollRes, seqRes,
        ragContext, briefingsCtx,
      ] = await Promise.all([
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('channel', 'email').eq('direction', 'outbound').gte('created_at', monthStart),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('channel', 'sms').eq('direction', 'outbound').gte('created_at', monthStart),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', client_id).eq('channel', 'whatsapp').eq('direction', 'outbound').gte('created_at', monthStart),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', client_id).gte('created_at', monthStart),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('client_id', client_id).gte('enrolled_at', monthStart),
        supabase.from('workflows').select('name, enrolled_count').eq('client_id', client_id).eq('status', 'active').order('enrolled_count', { ascending: false }).limit(1),
        ragSearch(`monthly report ${client.name}`, client_id),
        getBriefingsContext('zainab'),
      ]);

      const emailsSent   = emailRes.count   || 0;
      const smsSent      = smsRes.count     || 0;
      const whatsappSent = waRes.count      || 0;
      const contactsAdded = contactsRes.count || 0;
      const enrollments  = enrollRes.count  || 0;
      const topSequence  = seqRes.data?.[0]?.name || 'None';
      const context = [ragContext, briefingsCtx].filter(Boolean).join('\n\n');

      const summary = await aiCall(
        `You are Zainab, the Client Partner AI at Sales Scales. You are warm, professional, and deeply invested in each client's success. You write monthly performance reports that are honest, insightful, and actionable. You celebrate wins, identify opportunities, and provide clear next steps. Your reports feel like they come from a trusted advisor who knows the client's business deeply. Never break character or mention Claude.`,
        `Write a comprehensive monthly performance report for ${client.name} (${client.niche || 'ecommerce'}) for ${period}.\n\nPerformance Data:\n- Emails sent: ${emailsSent}\n- SMS sent: ${smsSent}\n- WhatsApp messages sent: ${whatsappSent}\n- New contacts added: ${contactsAdded}\n- Workflow enrollments: ${enrollments}\n- Top performing sequence: ${topSequence}\n\nWrite a 5-section report with these exact headings:\n1. MONTHLY OVERVIEW — 2–3 sentences summarising the month's performance in an honest, encouraging tone\n2. CHANNEL PERFORMANCE — specific breakdown of email, SMS, and WhatsApp activity and what the numbers mean\n3. GROWTH & CONTACTS — analysis of new contacts added and the pipeline impact\n4. SEQUENCE PERFORMANCE — commentary on workflow activity and the top sequence\n5. RECOMMENDATIONS FOR NEXT MONTH — 3–5 specific, actionable recommendations Yousef and the team should execute\n\nUse the numbers directly. Be specific. Make the client feel supported and excited about what's coming next month.`,
        context
      );

      const { data: report, error: insertErr } = await supabase.from('reports').insert({
        client_id, period, emails_sent: emailsSent, sms_sent: smsSent,
        whatsapp_sent: whatsappSent, contacts_added: contactsAdded,
        workflow_enrollments: enrollments, top_sequence: topSequence, summary,
      }).select().single();

      if (insertErr) throw insertErr;

      // Feedback loop: store the month's insights & recommendations so the AI
      // team can reference what worked when planning the next month.
      if (storeKnowledge && summary && summary.trim()) {
        storeKnowledge({
          title: `Monthly Insights — ${client.name} (${period})`,
          content: `Monthly performance insights for ${client.name} (${client.niche || 'ecommerce'}), ${period}.\n\n${summary}`,
          source: 'monthly_insight',
          clientId: client_id,
          type: 'monthly_insight',
          notes: `monthly_insight | ${period}`,
        });
      }

      res.json({ report });
    } catch (e) {
      console.error('reports/generate error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/reports/list', async (req, res) => {
    const { client_id } = req.query;
    try {
      let q = supabase.from('reports')
        .select('id, client_id, period, emails_sent, sms_sent, whatsapp_sent, contacts_added, workflow_enrollments, top_sequence, summary, created_at, clients(name)')
        .order('created_at', { ascending: false }).limit(100);
      if (client_id) q = q.eq('client_id', client_id);
      const { data, error } = await q;
      if (error) throw error;
      res.json({ reports: data || [] });
    } catch (e) {
      console.error('reports/list error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── INVOICES ────────────────────────────────────────────
  router.post('/invoices/generate', async (req, res) => {
    const { client_id, month, amount: overrideAmount } = req.body;
    if (!client_id || !month) return res.status(400).json({ error: 'client_id and month required' });
    try {
      const { data: client } = await supabase.from('clients')
        .select('id, name, tier').eq('id', client_id).maybeSingle();
      if (!client) return res.status(404).json({ error: 'Client not found' });

      // Resolve fee: param override → latest signed contract → tier default
      let amount = overrideAmount ? parseFloat(overrideAmount) : null;
      if (!amount) {
        const { data: contract } = await supabase.from('contracts')
          .select('monthly_fee').eq('client_id', client_id)
          .in('status', ['signed', 'sent'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        amount = contract?.monthly_fee ? parseFloat(contract.monthly_fee) : null;
      }
      if (!amount) {
        amount = TIER_FEE_DEFAULT[(client.tier || '').toLowerCase()] || 997;
      }

      const invoiceNumber = `SS-${Date.now().toString(36).toUpperCase()}`;
      const issuedDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      const fmtAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const tierLabel = client.tier ? client.tier.charAt(0).toUpperCase() + client.tier.slice(1) : 'Starter';

      const invoice_html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${invoiceNumber} — ${client.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;background:#f0f3f8;padding:40px;color:#0a1628}
  .inv{max-width:760px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(10,22,40,.12)}
  .hd{background:#0a1628;padding:36px 40px;display:flex;justify-content:space-between;align-items:flex-start}
  .brand{color:#c9a84c;font-size:22px;font-weight:700}.brand-sub{color:rgba(255,255,255,.4);font-size:11px;margin-top:4px;letter-spacing:1px;text-transform:uppercase}
  .inv-lbl{text-align:right}.inv-lbl .title{color:white;font-size:26px;font-weight:700}.inv-lbl .num{color:#c9a84c;font-size:13px;margin-top:4px;font-family:monospace}
  .bd{padding:36px 40px}
  .meta{display:flex;justify-content:space-between;margin-bottom:32px}
  .mb h4{font-size:9px;color:#8896a8;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px}
  .mb p{font-size:13px;color:#0a1628;line-height:1.6}.mb .co{font-size:15px;font-weight:700;margin-bottom:4px}
  .dr{text-align:right}.dr .drow{display:flex;justify-content:flex-end;gap:20px;margin-bottom:6px}
  .dl{font-size:10px;color:#8896a8;text-transform:uppercase;letter-spacing:.5px}.dv{font-size:12px;font-weight:600;min-width:130px;text-align:right}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#0a1628}thead th{padding:12px 16px;text-align:left;font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1.5px;font-weight:700}
  thead th:last-child{text-align:right}tbody tr{border-bottom:1px solid #f0f3f8}tbody td{padding:16px;font-size:13px;color:#0a1628;vertical-align:top}tbody td:last-child{text-align:right;font-weight:600}
  .dm{font-weight:600;margin-bottom:3px}.ds{font-size:11px;color:#8896a8;line-height:1.5}
  .tots{margin:16px 0 0 auto;width:280px}.tr{display:flex;justify-content:space-between;padding:8px 0;font-size:13px}
  .tr.grand{border-top:2px solid #0a1628;margin-top:8px;padding-top:14px}.tr.grand .lbl{font-size:15px;font-weight:700}.tr.grand .val{font-size:15px;font-weight:700;color:#c9a84c}
  .ft{background:#f8fafc;padding:24px 40px;border-top:1px solid #e4e9f0;display:flex;justify-content:space-between;align-items:center}
  .fn{font-size:11px;color:#8896a8;line-height:1.6}
  .badge{background:#fffbeb;color:#d97706;border:1px solid #fde68a;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
  @media print{body{background:white;padding:0}.inv{box-shadow:none;border-radius:0}}
</style>
</head>
<body>
<div class="inv">
  <div class="hd">
    <div><div class="brand">Sales Scales</div><div class="brand-sub">AI-Powered Revenue System</div></div>
    <div class="inv-lbl"><div class="title">INVOICE</div><div class="num">${invoiceNumber}</div></div>
  </div>
  <div class="bd">
    <div class="meta">
      <div class="mb">
        <h4>Bill To</h4>
        <p class="co">${client.name}</p>
        <p>${tierLabel} Plan</p>
        <p>Period: ${month}</p>
      </div>
      <div class="mb dr">
        <div class="drow"><span class="dl">Issued</span><span class="dv">${issuedDate}</span></div>
        <div class="drow"><span class="dl">Due</span><span class="dv">${dueDate}</span></div>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>
            <div class="dm">Sales Scales ${tierLabel} Plan — ${month}</div>
            <div class="ds">AI-powered revenue system: email sequences, SMS campaigns, workflow automation,<br>AI team access (Hussain, Hassan, Ali, Mahdi, Fatima, Zainab), CRM, and analytics</div>
          </td>
          <td>$${fmtAmount}</td>
        </tr>
      </tbody>
    </table>
    <div class="tots">
      <div class="tr"><span style="color:#8896a8">Subtotal</span><span>$${fmtAmount}</span></div>
      <div class="tr"><span style="color:#8896a8">Tax (0%)</span><span>$0.00</span></div>
      <div class="tr grand"><span class="lbl">Total Due</span><span class="val">$${fmtAmount}</span></div>
    </div>
  </div>
  <div class="ft">
    <div class="fn">Payment due within 7 days of issue date.<br>Questions? Contact billing@salesscales.com</div>
    <div class="badge">Unpaid</div>
  </div>
</div>
</body>
</html>`;

      const { data: invoice, error: insertErr } = await supabase.from('invoices').insert({
        client_id, client_name: client.name, amount, period: month,
        status: 'unpaid', invoice_html,
      }).select('id, client_id, client_name, amount, period, status, created_at').single();
      if (insertErr) throw insertErr;

      res.json({ invoice, invoice_html });
    } catch (e) {
      console.error('invoices/generate error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/invoices/overdue', async (req, res) => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: overdue, error } = await supabase.from('invoices')
        .select('id, client_id, client_name, amount, period, created_at')
        .eq('status', 'unpaid')
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true });
      if (error) throw error;

      for (const inv of (overdue || [])) {
        const agedays = Math.floor((Date.now() - new Date(inv.created_at)) / 86_400_000);
        const overdaysDays = agedays - 7;
        const fmtAmt = parseFloat(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
        await supabase.from('team_briefings').insert([{
          from_member: 'zainab',
          to_member: 'yousef',
          subject: `Overdue Invoice — ${inv.client_name} ($${fmtAmt})`,
          content: `An invoice is overdue and requires your follow-up.\n\nInvoice Details:\n- Client: ${inv.client_name}\n- Amount: $${fmtAmt}\n- Period: ${inv.period}\n- Issued: ${new Date(inv.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}\n- Days past due: ${overdaysDays} day${overdaysDays !== 1 ? 's' : ''}\n\nRecommended actions:\n1. Send a payment reminder to the client\n2. Check if any support issues are blocking payment\n3. If no response within 3 days, escalate\n\nPlease follow up with ${inv.client_name} as soon as possible.`,
          priority: 'urgent',
          is_read: false,
          created_at: new Date().toISOString(),
        }]);
      }

      res.json({ overdue: overdue || [], count: (overdue || []).length });
    } catch (e) {
      console.error('invoices/overdue error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/invoices/list', async (req, res) => {
    const { client_id } = req.query;
    try {
      let q = supabase.from('invoices')
        .select('id, client_id, client_name, amount, period, status, created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (client_id) q = q.eq('client_id', client_id);
      const { data, error } = await q;
      if (error) throw error;
      res.json({ invoices: data || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch('/invoices/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!['unpaid', 'paid'].includes(status)) return res.status(400).json({ error: 'status must be unpaid or paid' });
    try {
      const { data, error } = await supabase.from('invoices')
        .update({ status }).eq('id', req.params.id).select('id, status').single();
      if (error) throw error;
      res.json({ invoice: data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
