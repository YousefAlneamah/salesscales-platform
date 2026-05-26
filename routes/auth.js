const express = require('express');

module.exports = ({ supabase, jwt, bcrypt, JWT_SECRET, verifyToken }) => {
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

  return router;
};
