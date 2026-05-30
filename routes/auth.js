const express = require('express');
const axios = require('axios');

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const fbAppId = () => process.env.FACEBOOK_APP_ID;
const fbAppSecret = () => process.env.FACEBOOK_APP_SECRET;
const fbRedirectUri = () => process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3001/auth/facebook/callback';
const igRedirectUri = () => process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3001/auth/instagram/callback';

const oauthSuccessPage = (platform, accountName) => `<!DOCTYPE html>
<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f0f3f8;margin:0">
  <div style="text-align:center;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);max-width:420px">
    <div style="font-size:48px;margin-bottom:16px">✅</div>
    <h2 style="color:#0a1628;margin:0 0 8px">${platform} Connected</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:13px">${accountName}</p>
    <a href="http://localhost:3000" style="background:#0a1628;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Return to Platform</a>
  </div>
</body></html>`;

const oauthErrorPage = (platform, msg) => `<!DOCTYPE html>
<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f0f3f8;margin:0">
  <div style="text-align:center;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);max-width:420px">
    <div style="font-size:48px;margin-bottom:16px">❌</div>
    <h2 style="color:#dc2626;margin:0 0 8px">${platform} Connection Failed</h2>
    <p style="color:#64748b;font-size:13px;margin:0 0 24px">${msg}</p>
    <a href="http://localhost:3000" style="background:#0a1628;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Return to Platform</a>
  </div>
</body></html>`;

const sendVerificationEmail = async (sgMail, email, name, code) => {
  await sgMail.send({
    to: email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
    subject: 'Verify your Sales Scales account',
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0">
        <div style="color:#c9a84c;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Sales Scales</div>
        <div style="color:white;font-size:16px;font-weight:600;margin-top:6px">Email Verification</div>
      </div>
      <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 8px 8px;padding:28px 24px">
        <p style="color:#4a5568;font-size:13px;margin:0 0 20px;line-height:1.6">Hi ${name || 'there'}, enter this code to verify your Sales Scales account.</p>
        <div style="background:#f0f3f8;border:1px solid #e4e9f0;border-radius:10px;padding:20px;text-align:center;font-size:36px;font-weight:800;letter-spacing:12px;color:#0a1628;font-family:monospace">${code}</div>
        <p style="color:#8896a8;font-size:11px;margin:18px 0 0;line-height:1.6">This code expires in 24 hours. If you didn't create a Sales Scales account, you can safely ignore this email.</p>
      </div>
    </div>`,
  });
};

module.exports = ({ supabase, jwt, bcrypt, JWT_SECRET, verifyToken, sgMail }) => {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
      const { data: user } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });
      if (!user.password_hash) return res.status(401).json({ error: 'Invalid email or password' });
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      console.log('Owner login:', user.email);
      res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
    } catch (e) {
      console.error('Login error:', e.message);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  router.post('/change-password', verifyToken, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'new_password must be at least 8 characters' });
    try {
      const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).maybeSingle();
      if (!user) return res.status(404).json({ error: 'User not found' });
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      const password_hash = await bcrypt.hash(new_password, 10);
      await supabase.from('users').update({ password_hash }).eq('id', user.id);
      console.log('Password changed for:', user.email);
      res.json({ ok: true });
    } catch (e) {
      console.error('Change password error:', e.message);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  // ─── CLIENT PASSWORD RESET ───────────────────────────────
  router.post('/reset-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const { data: clientUser } = await supabase
        .from('client_users').select('id, name, email').eq('email', email).maybeSingle();
      // Always return ok so we don't reveal which emails have accounts
      if (!clientUser) return res.json({ ok: true });

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await supabase.from('password_resets').insert([{ email, code, expires_at }]);

      await sgMail.send({
        to: email,
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'Sales Scales' },
        subject: 'Your Sales Scales password reset code',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <div style="background:#0a1628;padding:20px 24px;border-radius:8px 8px 0 0;">
            <div style="color:#c9a84c;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Sales Scales</div>
            <div style="color:white;font-size:16px;font-weight:600;margin-top:6px;">Password Reset</div>
          </div>
          <div style="background:#fff;border:1px solid #e4e9f0;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
            <p style="color:#4a5568;font-size:13px;margin:0 0 16px;">Hi ${clientUser.name || 'there'}, use the code below to reset your password. It expires in 1 hour.</p>
            <div style="background:#f8fafc;border:1px solid #e4e9f0;border-radius:8px;padding:18px;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#0a1628;">${code}</div>
            <p style="color:#8896a8;font-size:11px;margin:16px 0 0;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        </div>`,
      });
      console.log('Password reset code sent to:', email);
      res.json({ ok: true });
    } catch (e) {
      console.error('Reset password error:', e.message);
      res.status(500).json({ error: 'Failed to send reset code' });
    }
  });

  router.post('/confirm-reset', async (req, res) => {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) return res.status(400).json({ error: 'email, code and new_password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'new_password must be at least 8 characters' });
    try {
      const { data: reset } = await supabase
        .from('password_resets').select('*')
        .eq('email', email).eq('code', code)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!reset) return res.status(400).json({ error: 'Invalid reset code' });
      if (new Date(reset.expires_at) < new Date()) {
        await supabase.from('password_resets').delete().eq('id', reset.id);
        return res.status(400).json({ error: 'Reset code has expired — request a new one' });
      }
      const password_hash = await bcrypt.hash(new_password, 10);
      await supabase.from('client_users').update({ password: password_hash }).eq('email', email);
      await supabase.from('password_resets').delete().eq('email', email);
      console.log('Password reset completed for:', email);
      res.json({ ok: true });
    } catch (e) {
      console.error('Confirm reset error:', e.message);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // ─── CLIENT LOGIN ────────────────────────────────────────
  router.post('/client-login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
      const { data: clientUser } = await supabase
        .from('client_users')
        .select('id, name, email, client_id, password, verified')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (!clientUser) return res.status(401).json({ error: 'Invalid email or password' });

      // Support bcrypt hashes (new/reset accounts) and plain text (legacy accounts)
      const storedPw = clientUser.password || '';
      const valid = storedPw.startsWith('$2')
        ? await bcrypt.compare(password, storedPw)
        : storedPw === password;

      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

      await supabase.from('client_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', clientUser.id);

      const { data: client } = await supabase
        .from('clients').select('name, tier').eq('id', clientUser.client_id).maybeSingle();

      console.log('Client login:', clientUser.email);
      res.json({
        id: clientUser.id,
        name: clientUser.name,
        email: clientUser.email,
        client_id: clientUser.client_id,
        client_name: client?.name || 'Your Store',
        tier: client?.tier || 'starter',
        verified: clientUser.verified === true,
      });
    } catch (e) {
      console.error('Client login error:', e.message);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // ─── EMAIL VERIFICATION ──────────────────────────────────
  router.post('/verify-email', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'email and code required' });
    try {
      const { data: record } = await supabase
        .from('email_verifications')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('code', String(code).trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!record) return res.status(400).json({ error: 'Invalid verification code' });

      if (new Date(record.expires_at) < new Date()) {
        await supabase.from('email_verifications').delete().eq('id', record.id);
        return res.status(400).json({ error: 'Verification code has expired — request a new one' });
      }

      await supabase.from('client_users').update({ verified: true }).eq('email', email.toLowerCase());
      await supabase.from('email_verifications').delete().eq('email', email.toLowerCase());
      console.log('Email verified:', email);
      res.json({ ok: true });
    } catch (e) {
      console.error('verify-email error:', e.message);
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  router.post('/resend-verification', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const { data: clientUser } = await supabase
        .from('client_users')
        .select('id, name, email, verified')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (!clientUser) return res.status(404).json({ error: 'Account not found' });
      if (clientUser.verified) return res.json({ ok: true, already_verified: true });

      await supabase.from('email_verifications').delete().eq('email', email.toLowerCase());

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('email_verifications').insert([{
        email: email.toLowerCase(), code, expires_at,
      }]);

      await sendVerificationEmail(sgMail, email, clientUser.name, code);
      console.log('Verification resent to:', email);
      res.json({ ok: true });
    } catch (e) {
      console.error('resend-verification error:', e.message);
      res.status(500).json({ error: 'Failed to resend verification' });
    }
  });

  // ─── TERMS ACCEPTANCE ────────────────────────────────────
  router.post('/accept-terms', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.socket?.remoteAddress
        || req.ip
        || 'unknown';
      const now = new Date().toISOString();
      await supabase.from('client_users').update({
        accepted_terms: true,
        accepted_terms_at: now,
        accepted_terms_ip: ip,
      }).eq('email', email.toLowerCase());
      console.log(`Terms accepted: ${email} from ${ip}`);
      res.json({ ok: true });
    } catch (e) {
      console.error('accept-terms error:', e.message);
      res.status(500).json({ error: 'Failed to record terms acceptance' });
    }
  });

  // ─── FACEBOOK OAUTH ──────────────────────────────────────
  router.get('/facebook/connect', (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).send('Missing client_id');
    if (!fbAppId()) return res.status(500).send('FACEBOOK_APP_ID not configured');
    const url = `https://www.facebook.com/v21.0/dialog/oauth?` +
      `client_id=${fbAppId()}&redirect_uri=${encodeURIComponent(fbRedirectUri())}&` +
      `scope=pages_show_list,pages_read_engagement,pages_read_user_content&` +
      `state=${encodeURIComponent(client_id)}&response_type=code`;
    res.redirect(url);
  });

  router.get('/facebook/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const client_id = state ? decodeURIComponent(state) : null;
    if (error) return res.send(oauthErrorPage('Facebook', error));
    if (!code || !client_id) return res.status(400).send('Missing code or state');
    try {
      const tokenRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
        params: { client_id: fbAppId(), client_secret: fbAppSecret(), redirect_uri: fbRedirectUri(), code },
      });
      const shortToken = tokenRes.data.access_token;

      const llRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
        params: { grant_type: 'fb_exchange_token', client_id: fbAppId(), client_secret: fbAppSecret(), fb_exchange_token: shortToken },
      });
      const longToken = llRes.data.access_token;

      const pagesRes = await axios.get(`${GRAPH_BASE}/me/accounts`, {
        params: { access_token: longToken, fields: 'id,name,access_token' },
      });
      const pages = pagesRes.data.data || [];
      if (pages.length === 0) return res.send(oauthErrorPage('Facebook', 'No Facebook Pages found. Make sure this account manages a Page.'));

      const page = pages[0];
      const updates = { meta_access_token: page.access_token, meta_page_id: page.id };

      try {
        const igRes = await axios.get(`${GRAPH_BASE}/${page.id}`, {
          params: { access_token: page.access_token, fields: 'instagram_business_account' },
        });
        const igId = igRes.data.instagram_business_account?.id;
        if (igId) updates.meta_ig_user_id = igId;
      } catch { /* IG link is optional */ }

      await supabase.from('clients').update(updates).eq('id', client_id);
      console.log(`Facebook connected for client ${client_id}: page "${page.name}" (${page.id})`);
      res.send(oauthSuccessPage('Facebook', page.name));
    } catch (e) {
      console.error('Facebook callback error:', e.response?.data || e.message);
      res.send(oauthErrorPage('Facebook', e.response?.data?.error?.message || e.message));
    }
  });

  router.post('/facebook/disconnect', async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      await supabase.from('clients').update({ meta_access_token: null, meta_page_id: null }).eq('id', client_id);
      res.json({ ok: true });
    } catch (e) {
      console.error('Facebook disconnect error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── INSTAGRAM OAUTH ─────────────────────────────────────
  router.get('/instagram/connect', (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).send('Missing client_id');
    if (!fbAppId()) return res.status(500).send('FACEBOOK_APP_ID not configured');
    const url = `https://www.facebook.com/v21.0/dialog/oauth?` +
      `client_id=${fbAppId()}&redirect_uri=${encodeURIComponent(igRedirectUri())}&` +
      `scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish&` +
      `state=${encodeURIComponent(client_id)}&response_type=code`;
    res.redirect(url);
  });

  router.get('/instagram/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const client_id = state ? decodeURIComponent(state) : null;
    if (error) return res.send(oauthErrorPage('Instagram', error));
    if (!code || !client_id) return res.status(400).send('Missing code or state');
    try {
      const tokenRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
        params: { client_id: fbAppId(), client_secret: fbAppSecret(), redirect_uri: igRedirectUri(), code },
      });
      const shortToken = tokenRes.data.access_token;

      const llRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
        params: { grant_type: 'fb_exchange_token', client_id: fbAppId(), client_secret: fbAppSecret(), fb_exchange_token: shortToken },
      });
      const longToken = llRes.data.access_token;

      const pagesRes = await axios.get(`${GRAPH_BASE}/me/accounts`, {
        params: { access_token: longToken, fields: 'id,name,access_token' },
      });
      const pages = pagesRes.data.data || [];
      if (pages.length === 0) return res.send(oauthErrorPage('Instagram', 'No Facebook Pages found. Connect a Facebook Page to your Instagram Business account first.'));

      const page = pages[0];
      const igRes = await axios.get(`${GRAPH_BASE}/${page.id}`, {
        params: { access_token: page.access_token, fields: 'instagram_business_account' },
      });
      const igId = igRes.data.instagram_business_account?.id;
      if (!igId) return res.send(oauthErrorPage('Instagram', 'No Instagram Business Account linked to this Facebook Page. Convert your Instagram to a Business account and connect it to your Page first.'));

      let igUsername = null;
      try {
        const uRes = await axios.get(`${GRAPH_BASE}/${igId}`, {
          params: { access_token: page.access_token, fields: 'username' },
        });
        igUsername = uRes.data.username || null;
      } catch { /* username is display-only */ }

      const updates = { meta_ig_user_id: igId };
      const { data: existing } = await supabase.from('clients').select('meta_access_token').eq('id', client_id).maybeSingle();
      if (!existing?.meta_access_token) {
        updates.meta_access_token = page.access_token;
        updates.meta_page_id = page.id;
      }
      await supabase.from('clients').update(updates).eq('id', client_id);
      console.log(`Instagram connected for client ${client_id}: @${igUsername || igId}`);
      res.send(oauthSuccessPage('Instagram', igUsername ? `@${igUsername}` : igId));
    } catch (e) {
      console.error('Instagram callback error:', e.response?.data || e.message);
      res.send(oauthErrorPage('Instagram', e.response?.data?.error?.message || e.message));
    }
  });

  router.post('/instagram/disconnect', async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      await supabase.from('clients').update({ meta_ig_user_id: null }).eq('id', client_id);
      res.json({ ok: true });
    } catch (e) {
      console.error('Instagram disconnect error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
