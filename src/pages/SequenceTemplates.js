import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const TEMPLATES = [
  {
    id: 'cart-recovery',
    name: 'Cart Recovery Standard',
    trigger: 'Cart Abandoned',
    description: '7-step abandoned cart sequence with email, SMS, and escalating urgency over 3 days.',
    channels: ['Email', 'SMS'],
    steps: [
      { step_type: 'email', subject: 'You left something behind ✨', content: 'Hi {{first_name}}, you left something in your cart! Your items are reserved for 24 hours. Click below to complete your purchase.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 1 },
      { step_type: 'sms', content: 'Hey {{first_name}}, still thinking it over? Your cart is waiting — tap here to grab your items before they sell out.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 23 },
      { step_type: 'email', subject: 'Special offer — just for you 🎁', content: 'Hi {{first_name}}, we want to make it easy. Here\'s 10% off your cart as a thank you. Use code WELCOME10 at checkout. Offer expires tonight.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 48 },
      { step_type: 'email', subject: 'Last chance — cart expires soon ⏰', content: 'Hi {{first_name}}, this is your final reminder. Your cart is about to expire and these items may sell out. Complete your order now.', wait_hours: 0 },
    ],
  },
  {
    id: 'post-purchase',
    name: 'Post Purchase Thank You',
    trigger: 'Order Placed',
    description: '5-step post-purchase sequence to delight customers and drive reviews and repeat purchases.',
    channels: ['Email', 'SMS'],
    steps: [
      { step_type: 'email', subject: 'Thank you for your order! 🙏', content: 'Hi {{first_name}}, thank you so much for your order! We\'re getting it ready and will notify you when it ships. You made a great choice.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 24 },
      { step_type: 'email', subject: 'Your order is on its way 🚚', content: 'Hi {{first_name}}, great news — your order has shipped! You\'ll receive a tracking link shortly. We\'re excited for you to receive it.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 72 },
      { step_type: 'sms', content: 'Hi {{first_name}}! Hope your order arrived safely. We\'d love to hear what you think — reply with a quick review and we\'ll send you a thank-you discount.', wait_hours: 0 },
    ],
  },
  {
    id: 'win-back',
    name: 'Win Back 30 Day',
    trigger: 'Win-Back',
    description: '4-touch win-back sequence for customers who haven\'t purchased in 30+ days.',
    channels: ['Email', 'SMS'],
    steps: [
      { step_type: 'email', subject: 'We miss you, {{first_name}} 💛', content: 'Hi {{first_name}}, it\'s been a while since your last order. We\'ve been busy adding new products and features we think you\'ll love. Come take a look.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 168 },
      { step_type: 'sms', content: 'Hi {{first_name}}! Special offer just for returning customers — 15% off your next order. Reply SHOP to get the link.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 168 },
      { step_type: 'email', subject: '15% off — your exclusive comeback offer 🎯', content: 'Hi {{first_name}}, we\'d love to have you back. Use code COMEBACK15 for 15% off anything in the store. This offer expires in 48 hours.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 168 },
      { step_type: 'email', subject: 'One last thing before we let you go...', content: 'Hi {{first_name}}, this is our final message. If the timing isn\'t right, we understand — but the door is always open whenever you\'re ready. We\'d love to have you back.', wait_hours: 0 },
    ],
  },
  {
    id: 'lead-nurture',
    name: 'Lead Nurture 7 Day',
    trigger: 'New Customer',
    description: '7-day new lead nurture sequence to educate, build trust, and convert to a paying customer.',
    channels: ['Email', 'SMS'],
    steps: [
      { step_type: 'email', subject: 'Welcome to the family, {{first_name}} 🎉', content: 'Hi {{first_name}}, welcome! We\'re so glad you\'re here. Over the next few days we\'ll share exactly how our system works and how it can help your business grow.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 24 },
      { step_type: 'email', subject: 'How we helped a brand 3x their revenue in 60 days', content: 'Hi {{first_name}}, one of our clients went from $40K to $120K per month in 60 days using our email and SMS sequences. Here\'s what we did — and how we can do the same for you.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 48 },
      { step_type: 'sms', content: 'Hi {{first_name}}, quick question — what\'s your biggest challenge with your store right now? Reply and we\'ll share a tip specific to your situation.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 72 },
      { step_type: 'email', subject: 'Ready to grow your store with AI? Let\'s talk.', content: 'Hi {{first_name}}, by now you\'ve seen what\'s possible. If you\'re ready to add AI-powered email, SMS, and automation to your store, click below to book a 20-minute call with our team.', wait_hours: 0 },
    ],
  },
  {
    id: 'vip-customer',
    name: 'VIP Customer',
    trigger: 'Post Purchase',
    description: '3-step VIP sequence for your best customers — exclusive access, rewards, and early product drops.',
    channels: ['SMS', 'Email'],
    steps: [
      { step_type: 'sms', content: '{{first_name}}, you\'re officially a VIP 👑 You\'ve unlocked exclusive benefits and early access to new drops. Watch for a special email from us.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 24 },
      { step_type: 'email', subject: 'Your VIP benefits are now active 👑', content: 'Hi {{first_name}}, as one of our top customers, you now have access to: early product launches, exclusive VIP discounts, and priority support. We genuinely appreciate your loyalty.', wait_hours: 0 },
      { step_type: 'wait', content: '', wait_hours: 48 },
      { step_type: 'email', subject: 'Early access: new products just for you', content: 'Hi {{first_name}}, before we announce to the general public — here\'s early access to our newest products. VIP customers get first pick. Shop the new arrivals below.', wait_hours: 0 },
    ],
  },
];

const CHANNEL_COLORS = { Email: '#3b82f6', SMS: '#10b981', WhatsApp: '#059669' };
const STEP_ICONS = { email: '✉', sms: '💬', whatsapp: '📱', wait: '⏱' };

export default function SequenceTemplates() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [useModal, setUseModal] = useState(null);
  const [clientId, setClientId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  useEffect(() => {
    supabase.from('clients').select('id, name').then(({ data }) => setClients(data || []));
  }, []);

  const useTemplate = async () => {
    if (!clientId || !useModal) { setCreateMsg('Please select a client.'); return; }
    setCreating(true);
    setCreateMsg('');
    try {
      const { data: wf, error } = await supabase.from('workflows').insert([{
        name: useModal.name,
        client_id: clientId,
        trigger_type: useModal.trigger,
        status: 'draft',
      }]).select().single();
      if (error) throw error;
      for (let i = 0; i < useModal.steps.length; i++) {
        const s = useModal.steps[i];
        await supabase.from('workflow_steps').insert([{
          workflow_id: wf.id,
          step_order: i + 1,
          step_type: s.step_type,
          subject: s.subject || null,
          content: s.content || null,
          wait_hours: s.wait_hours || 0,
        }]);
      }
      setCreateMsg('✓ Workflow created in draft mode — go to Sequences to activate.');
      setTimeout(() => { setUseModal(null); setClientId(''); setCreateMsg(''); }, 3000);
    } catch (e) {
      setCreateMsg('Error: ' + e.message);
    }
    setCreating(false);
  };

  const inputStyle = { width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: '#0a1628', outline: 'none', background: 'white', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Template Library</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{TEMPLATES.length} proven sequences — deploy in seconds</div>
        </div>
      </div>

      {useModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '420px', maxWidth: '90vw', boxShadow: '0 24px 60px rgba(10,22,40,0.25)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628', marginBottom: '4px' }}>Use Template</div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '20px' }}>{useModal.name} — {useModal.steps.length} steps</div>
            <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Select Client</div>
            <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...inputStyle, marginBottom: '16px' }}>
              <option value="">Choose a client store...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {createMsg && <div style={{ fontSize: '11px', color: createMsg.startsWith('✓') ? '#059669' : '#dc2626', marginBottom: '12px' }}>{createMsg}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={useTemplate} disabled={creating || !clientId}
                style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flex: 1 }}>
                {creating ? 'Creating...' : 'Create Workflow'}
              </button>
              <button onClick={() => { setUseModal(null); setClientId(''); setCreateMsg(''); }}
                style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : 'repeat(3, 1fr)', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr' : undefined, gap: '14px', gridColumn: selected ? '1' : undefined }}>
          {TEMPLATES.map(t => (
            <div key={t.id}
              onClick={() => setSelected(selected?.id === t.id ? null : t)}
              style={{ background: 'white', border: `1px solid ${selected?.id === t.id ? '#c9a84c' : '#e4e9f0'}`, borderRadius: '12px', padding: '20px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(10,22,40,0.06)', transition: 'border-color 0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{t.name}</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {t.channels.map(ch => (
                    <span key={ch} style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, background: (CHANNEL_COLORS[ch] || '#8896a8') + '18', color: CHANNEL_COLORS[ch] || '#8896a8', border: `1px solid ${(CHANNEL_COLORS[ch] || '#8896a8') + '30'}` }}>{ch}</span>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '12px', lineHeight: 1.5 }}>{t.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '9px', color: '#8896a8', padding: '2px 8px', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '20px' }}>⚡ {t.trigger}</span>
                <span style={{ fontSize: '9px', color: '#8896a8', padding: '2px 8px', background: '#f8fafc', border: '1px solid #e4e9f0', borderRadius: '20px' }}>{t.steps.length} steps</span>
              </div>
              <div style={{ display: 'flex', gap: '3px', marginBottom: '14px' }}>
                {t.steps.map((s, i) => (
                  <div key={i} title={s.step_type === 'wait' ? `Wait ${s.wait_hours}h` : s.step_type}
                    style={{ width: '24px', height: '24px', borderRadius: '6px', background: s.step_type === 'wait' ? '#f8fafc' : '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', border: `1px solid ${s.step_type === 'wait' ? '#e4e9f0' : '#0a1628'}` }}>
                    {STEP_ICONS[s.step_type] || '·'}
                  </div>
                ))}
              </div>
              <button onClick={e => { e.stopPropagation(); setUseModal(t); setClientId(''); setCreateMsg(''); }}
                style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                Use Template →
              </button>
            </div>
          ))}
        </div>

        {selected && (
          <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', height: 'fit-content', position: 'sticky', top: 0, boxShadow: '0 4px 12px rgba(10,22,40,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0a1628' }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginBottom: '16px', lineHeight: 1.6 }}>{selected.description}</div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>Sequence Steps</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
              {selected.steps.map((s, i) => (
                <div key={i} style={{ background: s.step_type === 'wait' ? '#f8fafc' : '#f0f3f8', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: s.step_type !== 'wait' && s.subject ? '4px' : 0 }}>
                    <span style={{ fontSize: '14px' }}>{STEP_ICONS[s.step_type] || '·'}</span>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: s.step_type === 'wait' ? '#8896a8' : '#0a1628', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {s.step_type === 'wait' ? `Wait ${s.wait_hours}h` : `Step ${i + 1} — ${s.step_type}`}
                    </div>
                  </div>
                  {s.subject && <div style={{ fontSize: '11px', fontWeight: 600, color: '#0a1628', marginBottom: '2px', paddingLeft: '22px' }}>{s.subject}</div>}
                  {s.content && s.step_type !== 'wait' && (
                    <div style={{ fontSize: '10px', color: '#4a5568', lineHeight: 1.5, paddingLeft: '22px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.content}</div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { setUseModal(selected); setClientId(''); setCreateMsg(''); }}
              style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Use This Template →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
