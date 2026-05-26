import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { supabase } from '../supabase';

export default function Inbox() {
  const [messages, setMessages] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [filterChannel, setFilterChannel] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterClient, setFilterClient] = useState('All');
  const [reply, setReply] = useState('');
  const [generating, setGenerating] = useState(false);

  const channels = ['All', 'Email', 'SMS', 'WhatsApp', 'Instagram', 'Facebook'];

  useEffect(() => {
    fetchMessages();
    fetchClients();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    if (data) setMessages(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const markAsRead = async (id) => {
    await supabase.from('messages').update({ status: 'read' }).eq('id', id);
    fetchMessages();
  };

  const generateAIReply = async (message) => {
    setGenerating(true);
    try {
      const response = await fetch(`${API_BASE}/generate-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: message.channel,
          senderName: message.sender_name,
          content: message.content,
          clientName: getClientName(message.client_id)
        })
      });
      const data = await response.json();
      if (data.reply) {
        setReply(data.reply);
        await supabase.from('messages').update({ ai_reply: data.reply }).eq('id', message.id);
      }
    } catch (e) {
      setReply('Could not generate reply.');
    }
    setGenerating(false);
  };

  const sendReply = async () => {
    if (!reply || !selectedMessage) return;
    await supabase.from('messages').insert([{
      client_id: selectedMessage.client_id,
      contact_id: selectedMessage.contact_id,
      channel: selectedMessage.channel,
      direction: 'outbound',
      sender_name: 'Sales Scales AI',
      content: reply,
      status: 'sent'
    }]);
    await supabase.from('messages').update({ status: 'replied' }).eq('id', selectedMessage.id);
    setReply('');
    fetchMessages();
    setSelectedMessage(null);
  };

  const addTestMessage = async () => {
    const testMessages = [
      { channel: 'Email', sender_name: 'James K.', sender_email: 'james@example.com', subject: 'Question about my order', content: 'Hi, I ordered 3 days ago and have not received a tracking number yet. Can you help?', status: 'unread' },
      { channel: 'SMS', sender_name: 'Maria S.', sender_phone: '+965 5000 0001', content: 'Hey just checking if my bag has been shipped yet?', status: 'unread' },
      { channel: 'Instagram', sender_name: 'Anna L.', content: 'Love your bags! Does the weekender come in black? Want to order for my trip next month', status: 'unread' },
      { channel: 'WhatsApp', sender_name: 'David R.', sender_phone: '+965 5000 0002', content: 'I received my bag and the zipper is broken. How do I get a replacement?', status: 'unread' },
    ];
    const random = testMessages[Math.floor(Math.random() * testMessages.length)];
    const firstClient = clients[0];
    await supabase.from('messages').insert([{ ...random, client_id: firstClient?.id || null }]);
    fetchMessages();
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';

  const formatTime = (dateString) => {
    const diff = new Date() - new Date(dateString);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const channelStyle = (channel) => {
    const map = {
      Email: { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe', icon: '✉' },
      SMS: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', icon: '💬' },
      WhatsApp: { bg: '#ecfdf5', color: '#10b981', border: '#a7f3d0', icon: '📱' },
      Instagram: { bg: '#fff1f2', color: '#f43f5e', border: '#fecdd3', icon: '📸' },
      Facebook: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: '👥' },
    };
    return map[channel] || { bg: '#f8fafc', color: '#64748b', border: '#e4e9f0', icon: '💌' };
  };

  const filtered = messages.filter(m => {
    const matchChannel = filterChannel === 'All' || m.channel === filterChannel;
    const matchStatus = filterStatus === 'All' || m.status === filterStatus;
    const matchClient = filterClient === 'All' || m.client_id === filterClient;
    return matchChannel && matchStatus && matchClient;
  });

  const unreadCount = messages.filter(m => m.status === 'unread').length;

  const inputStyle = {
    width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#0a1628',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif'
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Unified Inbox</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>
            {unreadCount > 0 ? <span><span style={{ color: '#c9a84c' }}>{unreadCount} unread</span> · {messages.length} total</span> : `${messages.length} messages`}
          </div>
        </div>
        <button onClick={addTestMessage}
          style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          + Test Message
        </button>
      </div>

      {/* CHANNEL FILTERS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {channels.map(ch => (
          <button key={ch} onClick={() => setFilterChannel(ch)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterChannel === ch ? 600 : 400, background: filterChannel === ch ? '#0a1628' : 'white', color: filterChannel === ch ? 'white' : '#8896a8', borderColor: filterChannel === ch ? '#0a1628' : '#e4e9f0', transition: 'all 0.15s' }}>
            {ch}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '150px' }}>
            <option value="All">All Stores</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: '120px' }}>
            <option value="All">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="sent">Sent</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedMessage ? '1fr 1fr' : '1fr', gap: '16px' }}>
        {/* MESSAGE LIST */}
        <div>
          {loading ? (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading messages...</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📬</div>
              <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '6px', fontSize: '14px' }}>No messages yet</div>
              <div style={{ fontSize: '12px', color: '#8896a8' }}>Click Test Message to add a sample</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map(message => {
                const cs = channelStyle(message.channel);
                return (
                  <div key={message.id}
                    onClick={() => { setSelectedMessage(message); setReply(message.ai_reply || ''); markAsRead(message.id); }}
                    style={{
                      background: 'white',
                      border: `1px solid ${selectedMessage?.id === message.id ? '#c9a84c' : '#e4e9f0'}`,
                      borderLeft: `3px solid ${message.status === 'unread' ? '#c9a84c' : 'transparent'}`,
                      borderRadius: '10px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      transition: 'all 0.1s',
                      boxShadow: '0 1px 3px rgba(10,22,40,0.04)'
                    }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: cs.bg, border: `1px solid ${cs.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                      {cs.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <div style={{ fontSize: '12px', fontWeight: message.status === 'unread' ? 700 : 500, color: '#0a1628' }}>{message.sender_name || 'Unknown'}</div>
                        <div style={{ fontSize: '9px', color: '#8896a8' }}>{formatTime(message.created_at)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, fontWeight: 600 }}>{message.channel}</span>
                        <span style={{ fontSize: '9px', color: '#8896a8' }}>{getClientName(message.client_id)}</span>
                        {message.direction === 'outbound' && <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 500 }}>↑ Sent</span>}
                      </div>
                      {message.subject && <div style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628', marginBottom: '2px' }}>{message.subject}</div>}
                      <div style={{ fontSize: '11px', color: '#8896a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.content}</div>
                    </div>
                    {message.status === 'unread' && (
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#c9a84c', flexShrink: 0, marginTop: '4px' }}></div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MESSAGE DETAIL */}
        {selectedMessage && (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', height: 'fit-content', position: 'sticky', top: 0, boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628', marginBottom: '3px' }}>{selectedMessage.sender_name}</div>
                <div style={{ fontSize: '10px', color: '#8896a8' }}>
                  {selectedMessage.sender_email || selectedMessage.sender_phone || selectedMessage.channel} · {getClientName(selectedMessage.client_id)} · {formatTime(selectedMessage.created_at)}
                </div>
              </div>
              <button onClick={() => setSelectedMessage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>

            {selectedMessage.subject && (
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '10px' }}>{selectedMessage.subject}</div>
            )}

            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '12px', color: '#475569', lineHeight: '1.7', border: '1px solid #f0f3f8' }}>
              {selectedMessage.content}
            </div>

            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Reply</div>
            <textarea value={reply} onChange={e => setReply(e.target.value)}
              placeholder="Write your reply or generate with AI..."
              rows={4} style={{ ...inputStyle, resize: 'none', marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => generateAIReply(selectedMessage)} disabled={generating}
                style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', flex: 1 }}>
                {generating ? 'Generating...' : '⚡ AI Reply'}
              </button>
              <button onClick={sendReply} disabled={!reply}
                style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', flex: 1 }}>
                Send ↑
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}