import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bcClient, setBcClient] = useState('');
  const [bcSubject, setBcSubject] = useState('');
  const [bcContent, setBcContent] = useState('');
  const [bcTag, setBcTag] = useState('');
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState(null);

  // channels list used in filter tabs below

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

  const sendBroadcast = async () => {
    if (!bcClient || !bcSubject || !bcContent) { alert('Client, subject, and content are required'); return; }
    if (!window.confirm(`Send broadcast email to all contacts for this client${bcTag ? ` tagged "${bcTag}"` : ''}? This cannot be undone.`)) return;
    setBcSending(true); setBcResult(null);
    try {
      const { data } = await axios.post(`${API_BASE}/email/broadcast`, { client_id: bcClient, subject: bcSubject, content: bcContent, tag: bcTag || undefined });
      setBcResult(data);
    } catch (e) { setBcResult({ error: e.response?.data?.error || 'Broadcast failed' }); }
    setBcSending(false);
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setShowBroadcast(v => !v); setBcResult(null); }}
            style={{ background: showBroadcast ? '#3b82f6' : 'white', color: showBroadcast ? 'white' : '#3b82f6', border: '1px solid #3b82f6', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            📣 Broadcast Email
          </button>
          <button onClick={addTestMessage}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Test Message
          </button>
        </div>
      </div>

      {/* BROADCAST PANEL */}
      {showBroadcast && (
        <div style={{ background: 'white', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ fontSize: '9px', color: '#3b82f6', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '14px' }}>📣 Broadcast Email — Send to All Contacts</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Client Store</div>
              <select value={bcClient} onChange={e => setBcClient(e.target.value)} style={inputStyle}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Subject Line</div>
              <input type="text" value={bcSubject} onChange={e => setBcSubject(e.target.value)} placeholder="Email subject..." style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Tag Filter (optional)</div>
              <input type="text" value={bcTag} onChange={e => setBcTag(e.target.value)} placeholder="e.g. vip — leave blank for all" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Email Content (use &#123;&#123;first_name&#125;&#125; for personalisation)</div>
            <textarea rows={4} value={bcContent} onChange={e => setBcContent(e.target.value)}
              placeholder="Write your broadcast email content here..." style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={sendBroadcast} disabled={bcSending}
              style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: bcSending ? 0.7 : 1 }}>
              {bcSending ? 'Sending…' : '📣 Send Broadcast'}
            </button>
            {bcResult && (
              bcResult.error
                ? <span style={{ fontSize: '11px', color: '#dc2626' }}>✗ {bcResult.error}</span>
                : <span style={{ fontSize: '11px', color: '#059669' }}>✓ Sent to {bcResult.sent} of {bcResult.total} contacts{bcResult.skipped > 0 ? ` (${bcResult.skipped} skipped)` : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {['All','Unread','Email','SMS','WhatsApp','Instagram','Facebook'].map(tab => {
          const active = tab === 'All' ? filterChannel === 'All' && filterStatus === 'All' : tab === 'Unread' ? filterStatus === 'unread' : filterChannel === tab;
          return (
            <button key={tab} onClick={() => {
              if (tab === 'All') { setFilterChannel('All'); setFilterStatus('All'); }
              else if (tab === 'Unread') { setFilterChannel('All'); setFilterStatus('unread'); }
              else { setFilterChannel(tab); setFilterStatus('All'); }
            }}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 11, cursor: 'pointer', fontWeight: active ? 700 : 400, background: active ? '#c9a84c' : 'rgba(255,255,255,0.04)', color: active ? '#0a1628' : '#8896a8', borderColor: active ? '#c9a84c' : 'rgba(255,255,255,0.09)', fontFamily: 'Inter,sans-serif' }}>
              {tab === 'Unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : tab}
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto' }}>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="All">All Stores</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* SPLIT PANEL: LEFT = LIST, RIGHT = THREAD */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedMessage ? '340px 1fr' : '1fr', gap: 12, height: 'calc(100vh - 280px)', minHeight: 400 }}>

        {/* LEFT: CONVERSATION LIST */}
        <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono,monospace' }}>{filtered.length} messages</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#4a5568', fontSize: 12 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4f8', marginBottom: 6 }}>No messages</div>
                <div style={{ fontSize: 11, color: '#4a5568' }}>Click Test Message to add a sample</div>
              </div>
            ) : filtered.map(message => {
              const cs = channelStyle(message.channel);
              const isSelected = selectedMessage?.id === message.id;
              return (
                <div key={message.id}
                  onClick={() => { setSelectedMessage(message); setReply(message.ai_reply || ''); markAsRead(message.id); }}
                  style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', background: isSelected ? 'rgba(201,168,76,0.06)' : message.status === 'unread' ? 'rgba(201,168,76,0.02)' : 'transparent', borderLeft: `3px solid ${isSelected ? '#c9a84c' : message.status === 'unread' ? 'rgba(201,168,76,0.5)' : 'transparent'}`, transition: 'all 0.1s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = message.status === 'unread' ? 'rgba(201,168,76,0.02)' : 'transparent'; }}>

                  {/* Avatar */}
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: cs.bg.replace('#','').startsWith('e') ? '#0f1f35' : '#0f1f35', border: `1px solid ${cs.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, color: cs.color }}>{cs.icon}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ fontSize: 12, fontWeight: message.status === 'unread' ? 700 : 500, color: '#f0f4f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.sender_name || 'Unknown'}</div>
                      <div style={{ fontSize: 9, color: '#4a5568', flexShrink: 0 }}>{formatTime(message.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 10, color: '#8896a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{message.content}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 8, padding: '1px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: cs.color, border: `1px solid ${cs.border}`, fontWeight: 600 }}>{message.channel}</span>
                      {message.direction === 'outbound' && <span style={{ fontSize: 8, color: '#10b981', fontWeight: 700 }}>↑ Sent</span>}
                    </div>
                  </div>
                  {message.status === 'unread' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#c9a84c', boxShadow: '0 0 5px #c9a84c', flexShrink: 0, marginTop: 4 }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: THREAD VIEW */}
        {selectedMessage && (
          <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Thread header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4f8', marginBottom: 2 }}>{selectedMessage.sender_name || 'Unknown'}</div>
                <div style={{ fontSize: 10, color: '#4a5568' }}>{selectedMessage.sender_email || selectedMessage.sender_phone || '—'} · {getClientName(selectedMessage.client_id)} · {channelStyle(selectedMessage.channel).icon} {selectedMessage.channel}</div>
              </div>
              <button onClick={() => setSelectedMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 20 }}>×</button>
            </div>

            {/* Message bubble */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Inbound bubble */}
              {selectedMessage.direction === 'inbound' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: '75%' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#142840', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#8896a8', fontWeight: 700, flexShrink: 0 }}>
                    {(selectedMessage.sender_name || '?')[0]}
                  </div>
                  <div>
                    <div style={{ background: '#142840', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px 14px 14px 2px', padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: '100%' }}>
                      {selectedMessage.subject && <div style={{ fontWeight: 700, marginBottom: 6 }}>{selectedMessage.subject}</div>}
                      {selectedMessage.content}
                    </div>
                    <div style={{ fontSize: 9, color: '#4a5568', marginTop: 4, marginLeft: 4 }}>{formatTime(selectedMessage.created_at)}</div>
                  </div>
                </div>
              )}
              {/* Outbound bubble */}
              {selectedMessage.direction === 'outbound' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: '75%', marginLeft: 'auto', flexDirection: 'row-reverse' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#c9a84c', fontWeight: 700, flexShrink: 0 }}>AI</div>
                  <div>
                    <div style={{ background: '#0a1628', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '14px 14px 2px 14px', padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                      {selectedMessage.content}
                    </div>
                    <div style={{ fontSize: 9, color: '#4a5568', marginTop: 4, textAlign: 'right', marginRight: 4 }}>{formatTime(selectedMessage.created_at)} · ✓ Sent</div>
                  </div>
                </div>
              )}
            </div>

            {/* Reply bar */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0a1628' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#4a5568' }}>Via:</span>
                {[selectedMessage.channel].map(ch => {
                  const cs = channelStyle(ch);
                  return <span key={ch} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: cs.color, border: `1px solid ${cs.border}`, fontWeight: 600 }}>{cs.icon} {ch}</span>;
                })}
              </div>
              <textarea value={reply} onChange={e => setReply(e.target.value)}
                placeholder="Write your reply…" rows={3}
                style={{ ...inputStyle, resize: 'none', marginBottom: 8, borderRadius: 10 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => generateAIReply(selectedMessage)} disabled={generating}
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#f0f4f8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', flex: 1, fontFamily: 'Inter,sans-serif' }}>
                  {generating ? 'Generating…' : '⚡ AI Reply'}
                </button>
                <button onClick={sendReply} disabled={!reply}
                  style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 2, fontFamily: 'Inter,sans-serif' }}>
                  Send →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}