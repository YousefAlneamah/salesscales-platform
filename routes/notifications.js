const express = require('express');

module.exports = ({ supabase }) => {
  const router = express.Router();

  // GET /notifications?client_id= — last 10 notifications + unread count
  router.get('/notifications', async (req, res) => {
    const { client_id } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      const [listRes, countRes] = await Promise.all([
        supabase.from('client_notifications')
          .select('*')
          .eq('client_id', client_id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('client_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client_id)
          .eq('read', false),
      ]);
      res.json({
        notifications: listRes.data || [],
        unread_count: countRes.count || 0,
      });
    } catch (e) {
      console.error('GET /notifications error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /notifications/read — mark all unread notifications as read for a client
  router.post('/notifications/read', async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    try {
      await supabase.from('client_notifications')
        .update({ read: true })
        .eq('client_id', client_id)
        .eq('read', false);
      res.json({ ok: true });
    } catch (e) {
      console.error('POST /notifications/read error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
