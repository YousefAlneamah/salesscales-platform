import React, { useState, useEffect } from 'react';
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

  const channels = ['All', 'Email', 'SMS', 'WhatsApp', 'Instagram', 'Facebook', 'Voice'];

  useEffect(() => {
    fetchMessages();
    fetchClients();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setMessages(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const markAsRead = async (messageId) => {
    await supabase.from('messages').update({ status: 'read' }).eq('id', messageId);
    fetchMessages();
  };

  const generateAIReply = async (message) => {
    setGenerating(true);
    try {
      const response = await fetch('http://localhost:3001/generate-reply', {
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
      setReply('Could not generate reply. Please write manually.');
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
      { channel: 'Instagram', sender_name: 'James K.', content: 'Hi, I was looking at the weekender bag. Does it come in navy blue? Also what is the return policy?', status: 'unread' },
      { channel: 'Email', sender_name: 'Maria S.', sender_email: 'maria@example.com', subject: 'Interested in coaching program', content: 'I watched your free training and I am really interested in the 6 month program. Can you tell me more about what is included and the investment?', status: 'unread' },
      { channel: 'SMS', sender_name: 'David R.', sender_phone: '+1 555 000 0002', content: 'We are looking for a 3 bedroom in the downtown area. Budget around $650K. Are there any new listings?', status: 'unread' },
      { channel: 'WhatsApp', sender_name: 'Anna L.', content: 'Just received my bag and I absolutely love it. The quality is incredible. Will definitely be buying the travel set next.', status: 'unread' },
    ];
    const random = testMessages[Math.floor(Math.random() * testMessages.length)];
    const firstClient = clients[0];
    await supabase.from('messages').insert([{
      ...random,
      client_id: firstClient?.id || null
    }]);
    fetchMessages();
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : '—';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const channelColor = (channel) => {
    const colors = {
      Email: { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
      SMS: { bg: '#f5f3ff', color: '#8b5cf6', border: '#ddd6fe' },
      WhatsApp: { bg: '#ecfdf5', color: '#10b981', border: '#a7f3d0' },
      Instagram: { bg: '#fff1f2', color: '#f43f5e', border: '#fecdd3' },
      Facebook: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
      Voice: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    };
    return colors[channel] || { bg: '#f8f9fc', color: '#64748b', border: '#e2e8f0' };
  };

  const channelIcon = (channel) => {
    const icons = { Email: '📧', SMS: '📱', WhatsApp: '💬', Instagram: '📸', Facebook: '👥', Voice: '🎙️' };
    return icons[channel] || '💌';
  };

  const filtered = messages.filter(m => {
    const matchChannel = filterChannel === 'All' || m.channel === filterChannel;
    const matchStatus = filterStatus === 'All' || m.status === filterStatus;
    const matchClient = filterClient === 'All' || m.client_id === filterClient;
    return matchChannel && matchStatus && matchClient;
  });

  const unreadCount = messages.filter(m => m.status === 'unread').length;

  const inputStyle = {
    width: '100%', border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>UNIFIED INBOX</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            {unreadCount} unread · {messages.length} total messages
          </div>
        </div>
        <button onClick={addTestMessage}
          style={{ background: '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
          + Add Test Message
        </button>
      </div>

      {/* CHANNEL FILTERS */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {channels.map(ch => (
          <button key={ch} onClick={() => setFilterChannel(ch)}
            style={{ padding: '5px 12px', borderRadius: '20px', border: '0.5px solid', fontSize: '11px', cursor: 'pointer', fontWeight: filterChannel === ch ? 600 : 400, background: filterChannel === ch ? '#1a3c5e' : 'white', color: filterChannel === ch ? 'white' : '#94a3b8', borderColor: filterChannel === ch ? '#1a3c5e' : '#e2e8f0' }}>
            {ch !== 'All' && channelIcon(ch)} {ch}
          </button>
        ))}
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ ...inputStyle, width: '150px', marginLeft: 'auto' }}>
          <option value="All">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ ...inputStyle, width: '120px' }}>
          <option value="All">All Status</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="sent">Sent</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedMessage ? '1fr 1fr' : '1fr', gap: '16px' }}>
        {/* MESSAGE LIST */}
        <div>
          {loading ? (
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading messages...</div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
              <div style={{ fontWeight: 600, color: '#1a3c5e', marginBottom: '6px' }}>No messages yet</div>
              <div style={{ fontSize: '11px', marginBottom: '12px' }}>Click Add Test Message to add a sample message</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map(message => {
                const cc = channelColor(message.channel);
                return (
                  <div key={message.id}
                    onClick={() => { setSelectedMessage(message); setReply(message.ai_reply || ''); markAsRead(message.id); }}
                    style={{ background: 'white', border: `0.5px solid ${selectedMessage?.id === message.id ? '#10b981' : '#e2e8f0'}`, borderLeft: message.status === 'unread' ? '3px solid #10b981' : '3px solid transparent', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: cc.bg, border: `0.5px solid ${cc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                      {channelIcon(message.channel)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <div style={{ fontSize: '12px', fontWeight: message.status === 'unread' ? 600 : 500, color: '#1a3c5e' }}>{message.sender_name || 'Unknown'}</div>
                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>{formatTime(message.created_at)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '6px', background: cc.bg, color: cc.color, border: `0.5px solid ${cc.border}` }}>{message.channel}</span>
                        <span style={{ fontSize: '9px', color: '#94a3b8' }}>{getClientName(message.client_id)}</span>
                        {message.direction === 'outbound' && <span style={{ fontSize: '9px', color: '#10b981' }}>↑ Sent</span>}
                      </div>
                      {message.subject && <div style={{ fontSize: '11px', fontWeight: 500, color: '#475569', marginBottom: '2px' }}>{message.subject}</div>}
                      <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.content}</div>
                    </div>
                    {message.status === 'unread' && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', flexShrink: 0, marginTop: '4px' }}></div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MESSAGE DETAIL */}
        {selectedMessage && (
          <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px', height: 'fit-content', position: 'sticky', top: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e' }}>{selectedMessage.sender_name}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  {selectedMessage.sender_email || selectedMessage.sender_phone || selectedMessage.channel}
                  {' · '}{getClientName(selectedMessage.client_id)}
                  {' · '}{formatTime(selectedMessage.created_at)}
                </div>
              </div>
              <button onClick={() => setSelectedMessage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px' }}>×</button>
            </div>

            {selectedMessage.subject && (
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>{selectedMessage.subject}</div>
            )}

            <div style={{ background: '#f8f9fc', borderRadius: '8px', padding: '12px', marginBottom: '14px', fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
              {selectedMessage.content}
            </div>

            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '8px' }}>REPLY</div>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write your reply here or generate an AI reply..."
              rows={4}
              style={{ ...inputStyle, resize: 'none', marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => generateAIReply(selectedMessage)} disabled={generating}
                style={{ background: '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', flex: 1 }}>
                {generating ? 'Generating...' : '🤖 Generate AI Reply'}
              </button>
              <button onClick={sendReply} disabled={!reply}
                style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', flex: 1 }}>
                Send Reply ↑
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}