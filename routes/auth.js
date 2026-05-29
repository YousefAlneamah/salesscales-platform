const express = require('express');

module.exports = ({ supabase, jwt, bcrypt, JWT_SECRET, verifyToken, sgMail }) => {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
      const { data: user } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });
      const valid = user.password_hash
        ? await bcrypt.compare(password, user.password_hash)
        : password === user.password;
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
      await supabase.from('client_users').update({ password: new_password }).eq('email', email);
      await supabase.from('password_resets').delete().eq('email', email);
      console.log('Password reset completed for:', email);
      res.json({ ok: true });
    } catch (e) {
      console.error('Confirm reset error:', e.message);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  return router;
};
