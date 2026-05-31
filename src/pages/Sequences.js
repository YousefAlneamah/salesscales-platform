import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

// ─── NODE COLOURS BY STEP TYPE ────────────────────────────
const NODE_COLOR = {
  email:    '#3b82f6',
  sms:      '#10b981',
  whatsapp: '#0d9488',
  wait:     '#6b7280',
  voice:    '#8b5cf6',
  tag:      '#c9a84c',
  pipeline: '#7c3aed',
  notify:   '#f59e0b',
};

const NODE_ICON = {
  email:    '✉',
  sms:      '💬',
  whatsapp: '📱',
  wait:     '⏱',
  voice:    '🎙',
  tag:      '🏷',
  pipeline: '🎯',
  notify:   '🔔',
};

// ─── CANVAS DIMENSIONS ───────────────────────────────────
const TRIG_W    = 260;
const TRIG_H    = 88;
const NODE_W    = 200;
const NODE_H    = 136;
const CONN_H    = 52;

// ─── TIMING LABEL HELPER ─────────────────────────────────
function timingLabel(waitHours) {
  if (!waitHours || waitHours === 0) return 'Immediate';
  if (waitHours < 24) return `Wait ${waitHours}h`;
  const days = Math.floor(waitHours / 24);
  const rem  = waitHours % 24;
  return rem ? `Wait ${days}d ${rem}h` : `Wait ${days} day${days !== 1 ? 's' : ''}`;
}

// ─── SVG CONNECTOR ────────────────────────────────────────
function Connector({ width = NODE_W, color = 'rgba(255,255,255,0.2)', waitLabel = null }) {
  const id = `ah-${width}-${waitLabel || 'n'}`;
  return (
    <div style={{ position: 'relative', width: Math.max(TRIG_W, NODE_W) + 80, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, height: CONN_H }}>
      <svg width={width} height={CONN_H} style={{ display: 'block' }} overflow="visible">
        <defs>
          <marker id={id} markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
            <polygon points="0 0,8 3,0 6" fill={color} />
          </marker>
        </defs>
        <line x1={width / 2} y1="0" x2={width / 2} y2={CONN_H - 6}
          stroke={color} strokeWidth="1.5" markerEnd={`url(#${id})`} />
      </svg>
      {/* Fix 3: timing badge on connector */}
      {waitLabel && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#0a1628', border: '1px solid rgba(201,168,76,0.35)',
          borderRadius: 20, padding: '3px 11px',
          fontSize: 9, fontWeight: 700, color: '#c9a84c',
          fontFamily: 'DM Mono, monospace', letterSpacing: 0.5,
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {waitLabel}
        </div>
      )}
    </div>
  );
}

// ─── TRIGGER NODE ─────────────────────────────────────────
function TriggerNode({ triggerType }) {
  return (
    <div style={{
      width: TRIG_W,
      background: 'linear-gradient(135deg, #0f1f35, #142840)',
      border: '1.5px solid rgba(201,168,76,0.45)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.1)',
    }}>
      <div style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.08)', borderBottom: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
        <div>
          <div style={{ fontSize: 8, color: 'rgba(201,168,76,0.7)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, fontFamily: 'DM Mono, monospace', marginBottom: 1 }}>Trigger</div>
          <div style={{ fontSize: 13, color: '#f0f4f8', fontWeight: 700 }}>{triggerType}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(201,168,76,0.5)', fontWeight: 600, background: 'rgba(201,168,76,0.08)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(201,168,76,0.2)' }}>START</div>
      </div>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
        <span style={{ fontSize: 11, color: '#8896a8' }}>Listening for this event…</span>
      </div>
    </div>
  );
}

// ─── STEP NODE ────────────────────────────────────────────
function StepNode({ step, index, onEdit, onDelete, isBuilder }) {
  const color  = NODE_COLOR[step.step_type] || '#6b7280';
  const icon   = NODE_ICON[step.step_type]  || '📋';
  const label  = step.label || step.step_type;
  const preview = step.step_type === 'wait'
    ? `Wait ${step.wait_hours || 1}h before next step`
    : step.step_type === 'tag'     ? `Tag: ${step.content || '—'}`
    : step.step_type === 'pipeline'? `Move to: ${step.content || '—'}`
    : step.step_type === 'notify'  ? `Notify: ${step.content || '—'}`
    : (step.subject ? `${step.subject} — ` : '') + (step.content || '(no content)');

  return (
    <div style={{
      width: NODE_W,
      background: '#0f1f35',
      border: `1px solid rgba(255,255,255,0.07)`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
      transition: 'box-shadow 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 8px 28px rgba(0,0,0,0.6), 0 0 0 1px ${color}55`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.45)'}>

      {/* Coloured header */}
      <div style={{ background: color, padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>{label}</span>
        </div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>#{index + 1}</span>
      </div>

      {/* Content body */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          minHeight: 34, marginBottom: isBuilder ? 10 : 0,
        }}>
          {preview || '—'}
        </div>

        {isBuilder && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button
              onClick={e => { e.stopPropagation(); onEdit(step); }}
              style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f0f4f8', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Edit
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(step.id); }}
              style={{ padding: '4px 8px', fontSize: 10, borderRadius: 6, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MINI-MAP ─────────────────────────────────────────────
function MiniMap({ steps, transform, triggerType }) {
  const mmW = 160, mmH = 120;
  const totalNodes = 1 + steps.length;
  const totalH = TRIG_H + totalNodes * (NODE_H * 0.4 + CONN_H * 0.4);
  const scl = Math.min(mmW / (TRIG_W * 1.1), mmH / Math.max(totalH, 1));
  const cxOff = (mmW - TRIG_W * scl) / 2;

  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 20,
      width: mmW, height: mmH,
      background: 'rgba(5,13,26,0.92)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      overflow: 'hidden',
      backdropFilter: 'blur(6px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <div style={{ position: 'absolute', top: 4, left: 8, fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>Overview</div>
      <svg width={mmW} height={mmH} style={{ position: 'absolute', inset: 0 }}>
        <rect x={cxOff} y={14} width={TRIG_W * scl} height={TRIG_H * scl * 0.7}
          rx={4} fill="rgba(201,168,76,0.3)" stroke="rgba(201,168,76,0.5)" strokeWidth={0.8} />
        {steps.map((step, i) => {
          const y = 14 + (TRIG_H * scl * 0.7) + (i + 1) * (NODE_H * scl * 0.55 + CONN_H * scl * 0.4);
          const cx = cxOff + (TRIG_W - NODE_W) / 2 * scl;
          const col = NODE_COLOR[step.step_type] || '#6b7280';
          return (
            <g key={step.id}>
              <line x1={cxOff + TRIG_W * scl / 2} y1={y - CONN_H * scl * 0.4}
                x2={cx + NODE_W * scl / 2}   y2={y}
                stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />
              <rect x={cx} y={y} width={NODE_W * scl} height={NODE_H * scl * 0.55}
                rx={3} fill={col + '55'} stroke={col + '88'} strokeWidth={0.6} />
            </g>
          );
        })}
        <rect
          x={cxOff + Math.max(0, -transform.x) * scl / transform.scale}
          y={14 + Math.max(0, -transform.y) * scl / transform.scale}
          width={mmW / transform.scale}
          height={mmH / transform.scale}
          rx={2}
          fill="none" stroke="rgba(201,168,76,0.5)" strokeWidth={1} strokeDasharray="3,2" />
      </svg>
    </div>
  );
}

// ─── WORKFLOW TYPE DEFINITIONS (Fix 5) ───────────────────
const WORKFLOW_TYPES = [
  { type: 'Cart Recovery',      icon: '🛒', trigger: 'Cart Abandoned',    desc: 'Fires when a shopper adds items to their cart but leaves without checking out. Typically 3 emails over 48 hours.' },
  { type: 'Lead Nurture',       icon: '🌱', trigger: 'New Customer',      desc: 'Welcomes new subscribers or opt-ins and builds trust over 7–14 days before making an offer.' },
  { type: 'Win Back',           icon: '💔', trigger: 'Win-Back',          desc: "Re-engages customers who haven't purchased in 60–90 days with a special offer or reminder." },
  { type: 'Post Purchase',      icon: '📦', trigger: 'Order Placed',      desc: 'Kicks off after every order — thank you, shipping update, review request, and cross-sell over 14 days.' },
  { type: 'Browse Abandonment', icon: '👀', trigger: 'Browse Abandonment',desc: "Triggered when a logged-in customer views a product page but doesn't add to cart. 2 gentle reminder emails." },
  { type: 'VIP Customer',       icon: '⭐', trigger: 'Manual',            desc: 'A premium loyalty sequence for high-value repeat buyers — exclusive access, early drops, personal thanks.' },
  { type: 'Re-engagement',      icon: '🔄', trigger: 'Win-Back',          desc: "Targets subscribers who haven't opened an email in 60+ days with a re-permission or compelling hook." },
  { type: 'Flash Sale',         icon: '⚡', trigger: 'Manual',            desc: '3 urgency-driven emails over 48 hours for a time-limited discount. Immediate, 24h, and final-hours sends.' },
  { type: 'Back in Stock',      icon: '🔔', trigger: 'Back In Stock',     desc: 'Notifies customers who previously viewed an out-of-stock product that it\'s available again.' },
  { type: 'Cross-sell',         icon: '🎯', trigger: 'Post Purchase',     desc: 'At day 14 of a post-purchase journey — suggests complementary products based on what they bought.' },
];

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function Sequences() {
  const [workflows, setWorkflows]               = useState([]);
  const [clients, setClients]                   = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [showForm, setShowForm]                 = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showBuilder, setShowBuilder]           = useState(false);
  const [name, setName]                         = useState('');
  const [clientId, setClientId]                 = useState('');
  const [triggerType, setTriggerType]           = useState('Cart Abandoned');
  const [steps, setSteps]                       = useState([]);
  const [filterClient, setFilterClient]         = useState('All');
  const [feedbackId, setFeedbackId]             = useState(null);
  const [feedbackLoading, setFeedbackLoading]   = useState(false);
  const [feedbackResult, setFeedbackResult]     = useState(null);
  const [feedbackStats, setFeedbackStats]       = useState(null);
  const [expandedWorkflowId, setExpandedWorkflowId] = useState(null);
  const [expandedSteps, setExpandedSteps]       = useState([]);
  const [stepsLoading, setStepsLoading]         = useState(false);
  const [editingStep, setEditingStep]           = useState(null);
  const [schedulingId, setSchedulingId]         = useState(null);
  const [scheduleDate, setScheduleDate]         = useState('');
  const [duplicating, setDuplicating]           = useState(null);
  const [editSaving, setEditSaving]             = useState(false);

  // Fix 1: flash sale
  const [showFlashSale, setShowFlashSale]       = useState(false);
  const [fsClientId, setFsClientId]             = useState('');
  const [fsDiscount, setFsDiscount]             = useState('');
  const [fsEndDate, setFsEndDate]               = useState('');
  const [fsProducts, setFsProducts]             = useState('');
  const [fsLoading, setFsLoading]               = useState(false);
  const [fsResult, setFsResult]                 = useState(null);

  // Fix 2: per-workflow analytics
  const [wfAnalytics, setWfAnalytics]           = useState({});

  // Fix 5: generate sequence modal
  const [showGenerate, setShowGenerate]         = useState(false);
  const [genType, setGenType]                   = useState(null);
  const [genClientId, setGenClientId]           = useState('');
  const [generating, setGenerating]             = useState(false);
  const [genError, setGenError]                 = useState('');

  // Canvas transform state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const isDragging  = useRef(false);
  const dragOrigin  = useRef({ x: 0, y: 0 });
  const canvasRef   = useRef(null);

  const triggers = [
    'Cart Abandoned','Order Placed','Order Fulfilled','Payment Failed',
    'New Customer','Win-Back','Browse Abandonment','Price Drop',
    'Back In Stock','New Product Launch','Post Purchase','Manual',
  ];

  const stepTypes = [
    { type: 'email',    label: 'Send Email',  icon: '✉' },
    { type: 'sms',      label: 'Send SMS',    icon: '💬' },
    { type: 'whatsapp', label: 'WhatsApp',    icon: '📱' },
    { type: 'wait',     label: 'Wait',        icon: '⏱' },
    { type: 'tag',      label: 'Add Tag',     icon: '🏷' },
    { type: 'pipeline', label: 'Move Stage',  icon: '🎯' },
    { type: 'notify',   label: 'Notify Me',   icon: '🔔' },
  ];

  useEffect(() => { fetchWorkflows(); fetchClients(); }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    const { data } = await supabase.from('workflows').select('*').order('created_at', { ascending: false });
    if (data) setWorkflows(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  // Fix 2: fetch per-workflow analytics
  const fetchWfAnalytics = async (workflowId, clientIdVal) => {
    if (wfAnalytics[workflowId]) return;
    try {
      const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [weekRes, completedRes, totalRes, emailRes, smsOutRes, smsInRes] = await Promise.all([
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('workflow_id', workflowId).gte('enrolled_at', weekStart),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('workflow_id', workflowId).eq('status', 'completed'),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true })
          .eq('workflow_id', workflowId),
        supabase.from('messages').select('id, opened_at', { count: 'exact' })
          .eq('client_id', clientIdVal).eq('channel', 'email').eq('direction', 'outbound').limit(200),
        supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('client_id', clientIdVal).eq('channel', 'SMS').eq('direction', 'outbound'),
        supabase.from('messages').select('id', { count: 'exact', head: true })
          .eq('client_id', clientIdVal).eq('channel', 'SMS').eq('direction', 'inbound'),
      ]);
      const emailMsgs = emailRes.data || [];
      const openRate = emailMsgs.length > 0
        ? Math.round((emailMsgs.filter(m => m.opened_at).length / emailMsgs.length) * 100)
        : 0;
      const smsOut = smsOutRes.count || 0;
      const smsIn  = smsInRes.count  || 0;
      const replyRate = smsOut > 0 ? Math.round((smsIn / smsOut) * 100) : 0;
      const total = totalRes.count || 0;
      const completed = completedRes.count || 0;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      setWfAnalytics(prev => ({ ...prev, [workflowId]: {
        enrolledThisWeek: weekRes.count || 0,
        completed,
        completionRate,
        openRate,
        replyRate,
      }}));
    } catch { /* analytics are non-critical */ }
  };

  const createWorkflow = async () => {
    if (!name || !clientId) { alert('Please fill in name and select a client'); return; }
    const { data, error } = await supabase.from('workflows').insert([{
      name, client_id: clientId, trigger_type: triggerType, status: 'draft'
    }]).select();
    if (!error && data) {
      fetchWorkflows();
      setShowForm(false);
      setName(''); setClientId(''); setTriggerType('Cart Abandoned');
      setSelectedWorkflow(data[0]);
      setSteps([]);
      setShowBuilder(true);
      setTransform({ scale: 1, x: 0, y: 0 });
    }
  };

  const addStep = (stepType) => {
    setSteps([...steps, {
      id: Date.now(),
      step_type: stepType.type,
      subject: '',
      content: '',
      wait_hours: stepType.type === 'wait' ? 1 : 0,
      label: stepType.label,
      icon: stepType.icon,
    }]);
  };

  const removeStep   = (id) => setSteps(steps.filter(s => s.id !== id));

  const saveWorkflow = async () => {
    if (!selectedWorkflow) return;
    await supabase.from('workflow_steps').delete().eq('workflow_id', selectedWorkflow.id);
    for (let i = 0; i < steps.length; i++) {
      await supabase.from('workflow_steps').insert([{
        workflow_id: selectedWorkflow.id,
        step_order: i + 1,
        step_type: steps[i].step_type,
        subject: steps[i].subject,
        content: steps[i].content,
        wait_hours: steps[i].wait_hours,
      }]);
    }
    await supabase.from('workflows').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', selectedWorkflow.id);
    fetchWorkflows();
    setShowBuilder(false);
    setSelectedWorkflow(null);
    setSteps([]);
  };

  const openBuilder = async (workflow) => {
    setSelectedWorkflow(workflow);
    const { data } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflow.id).order('step_order');
    if (data) setSteps(data.map(s => ({
      ...s,
      label: stepTypes.find(t => t.type === s.step_type)?.label || s.step_type,
      icon:  stepTypes.find(t => t.type === s.step_type)?.icon  || '📋',
    })));
    setShowBuilder(true);
    setTransform({ scale: 1, x: 0, y: 0 });
  };

  const toggleStatus = async (workflow) => {
    const newStatus = workflow.status === 'active' ? 'paused' : 'active';
    await supabase.from('workflows').update({ status: newStatus }).eq('id', workflow.id);
    fetchWorkflows();
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';
  const filtered = filterClient === 'All' ? workflows : workflows.filter(w => w.client_id === filterClient);

  const duplicateWorkflow = async (workflow) => {
    setDuplicating(workflow.id);
    try {
      await axios.post(`${API_BASE}/workflows/duplicate`, { workflow_id: workflow.id, client_id: workflow.client_id });
      fetchWorkflows();
    } catch (e) { alert(e.response?.data?.error || 'Duplicate failed'); }
    setDuplicating(null);
  };

  const scheduleWorkflow = async (workflowId) => {
    if (!scheduleDate) return;
    try {
      const res = await axios.patch(`${API_BASE}/workflows/${workflowId}/schedule`, { scheduled_start: scheduleDate });
      setSchedulingId(null); setScheduleDate('');
      fetchWorkflows();
      alert(`Workflow will activate on ${new Date(scheduleDate).toLocaleDateString()} (${res.data.status})`);
    } catch (e) { alert(e.response?.data?.error || 'Schedule failed'); }
  };

  const toggleExpand = async (workflow) => {
    if (expandedWorkflowId === workflow.id) {
      setExpandedWorkflowId(null); setExpandedSteps([]); return;
    }
    setExpandedWorkflowId(workflow.id);
    setExpandedSteps([]);
    setStepsLoading(true);
    const { data } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflow.id).order('step_order');
    setExpandedSteps(data || []);
    setStepsLoading(false);
    // Fix 2: fetch analytics alongside steps
    fetchWfAnalytics(workflow.id, workflow.client_id);
  };

  const saveStepEdit = async () => {
    if (!editingStep || editSaving) return;
    setEditSaving(true);
    try {
      await axios.put(`${API_BASE}/workflow-steps/${editingStep.id}`, {
        content: editingStep.content,
        subject: editingStep.subject,
        wait_hours: editingStep.wait_hours,
      });
      setExpandedSteps(prev => prev.map(s => s.id === editingStep.id ? { ...s, ...editingStep } : s));
      if (showBuilder) setSteps(prev => prev.map(s => s.id === editingStep.id ? { ...s, ...editingStep } : s));
      setEditingStep(null);
    } catch { alert('Failed to save step.'); }
    setEditSaving(false);
  };

  const stepIcon = (type) => NODE_ICON[type] || '📋';

  const getFeedback = async (workflow) => {
    if (feedbackId === workflow.id && feedbackResult) {
      setFeedbackId(null); setFeedbackResult(null); setFeedbackStats(null); return;
    }
    setFeedbackId(workflow.id);
    setFeedbackResult(null); setFeedbackStats(null);
    setFeedbackLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/sequences/feedback`, { workflow_id: workflow.id });
      setFeedbackResult(data.analysis);
      setFeedbackStats(data.stats);
    } catch { setFeedbackResult('Failed to load feedback. Please try again.'); }
    setFeedbackLoading(false);
  };

  // Fix 1: flash sale submit
  const submitFlashSale = async () => {
    if (!fsClientId || !fsDiscount || !fsEndDate) {
      setFsResult({ ok: false, msg: 'Please fill in client, discount percentage, and end date.' });
      return;
    }
    setFsLoading(true);
    setFsResult(null);
    try {
      const res = await axios.post(`${API_BASE}/workflows/flash-sale`, {
        client_id: fsClientId,
        offer_percentage: fsDiscount,
        offer_end_date: fsEndDate,
        products: fsProducts || undefined,
      });
      setFsResult({ ok: true, msg: `✓ Flash sale submitted for approval — targeting ${res.data.eligible_contacts} contacts.` });
      setFsDiscount(''); setFsEndDate(''); setFsProducts('');
    } catch (e) {
      setFsResult({ ok: false, msg: e.response?.data?.error || 'Failed to create flash sale' });
    }
    setFsLoading(false);
  };

  // Fix 5: generate sequence via Mahdi
  const generateSequence = async () => {
    if (!genType || !genClientId) { setGenError('Select both a workflow type and a client.'); return; }
    setGenerating(true);
    setGenError('');
    try {
      const res = await axios.post(`${API_BASE}/workflows/generate`, {
        client_id: genClientId,
        workflow_type: genType.type,
      });
      setShowGenerate(false);
      setGenType(null);
      setGenClientId('');
      setGenerating(false);
      fetchWorkflows();
      // Open the builder with the generated workflow
      const wf = res.data.workflow;
      const generatedSteps = (res.data.steps || []).map(s => ({
        ...s,
        label: stepTypes.find(t => t.type === s.step_type)?.label || s.step_type,
        icon:  stepTypes.find(t => t.type === s.step_type)?.icon  || '📋',
      }));
      setSelectedWorkflow(wf);
      setSteps(generatedSteps);
      setShowBuilder(true);
      setTransform({ scale: 1, x: 0, y: 0 });
    } catch (e) {
      setGenError(e.response?.data?.error || 'Generation failed. Please try again.');
      setGenerating(false);
    }
  };

  // ─── CANVAS INTERACTION ──────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    setTransform(t => ({ ...t, scale: Math.max(0.25, Math.min(2.5, t.scale * factor)) }));
  }, []);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.target.closest('button') || e.target.closest('input')) return;
    isDragging.current = true;
    dragOrigin.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    e.preventDefault();
  }, [transform.x, transform.y]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    setTransform(t => ({ ...t, x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y }));
  }, []);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ─── SHARED STYLES ────────────────────────────────────────
  const inputStyle = {
    width: '100%',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    color: '#f0f4f8',
    outline: 'none',
    background: 'rgba(255,255,255,0.05)',
    boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
  };

  // ═══════════════════════════════════════════════════════════
  // VISUAL FLOW BUILDER
  // ═══════════════════════════════════════════════════════════
  if (showBuilder && selectedWorkflow) {
    const canvasContentWidth = Math.max(TRIG_W, NODE_W) + 80;

    return (
      <div style={{ margin: '-28px -32px', height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', background: '#050d1a', overflow: 'hidden' }}>

        {/* ── TOOLBAR ── */}
        <div style={{ height: 56, background: '#0a1628', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0 }}>
          <button onClick={() => { setShowBuilder(false); setSelectedWorkflow(null); setSteps([]); }}
            style={{ ...inputStyle, width: 'auto', padding: '7px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8896a8' }}>
            ← Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4f8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedWorkflow.name}</div>
            <div style={{ fontSize: 10, color: '#8896a8' }}>Trigger: {selectedWorkflow.trigger_type} · {getClientName(selectedWorkflow.client_id)}</div>
          </div>
          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.25, t.scale * 0.85) }))}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f0f4f8', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: 11, color: '#8896a8', minWidth: 40, textAlign: 'center' }}>{Math.round(transform.scale * 100)}%</span>
            <button onClick={() => setTransform(t => ({ ...t, scale: Math.min(2.5, t.scale * 1.15) }))}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f0f4f8', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            <button onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}
              style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#8896a8', cursor: 'pointer', fontSize: 10 }}>Reset</button>
          </div>
          <div style={{ fontSize: 11, color: '#8896a8', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
            {steps.length} step{steps.length !== 1 ? 's' : ''}
          </div>
          <button onClick={saveWorkflow}
            style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
            Save & Activate
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── STEP PALETTE ── */}
          <div style={{ width: 176, background: '#0a1628', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '16px 12px', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 12 }}>Add Step</div>
            {stepTypes.map(st => (
              <div key={st.type} onClick={() => addStep(st)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${NODE_COLOR[st.type] || '#6b7280'}`, borderRadius: 8, padding: '9px 11px', marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8896a8', fontWeight: 500, transition: 'all 0.15s', userSelect: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#f0f4f8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#8896a8'; }}>
                <span style={{ fontSize: 15 }}>{st.icon}</span>
                <span>{st.label}</span>
              </div>
            ))}
            <div style={{ marginTop: 20, padding: '10px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: '#c9a84c', fontWeight: 600, marginBottom: 4 }}>Canvas Controls</div>
              <div style={{ fontSize: 10, color: '#4a5568', lineHeight: 1.6 }}>Scroll to zoom · Drag background to pan</div>
            </div>
          </div>

          {/* ── CANVAS ── */}
          <div ref={canvasRef}
            style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isDragging.current ? 'grabbing' : 'default' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}>

            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

            <div style={{
              position: 'absolute',
              left: '50%',
              top: 60,
              transform: `translate(calc(-50% + ${transform.x}px), ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: 'top center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: canvasContentWidth,
              userSelect: 'none',
            }}>
              <TriggerNode triggerType={selectedWorkflow.trigger_type} />

              {steps.length === 0 ? (
                <div style={{ marginTop: 40, width: NODE_W, padding: '32px 20px', background: 'rgba(255,255,255,0.02)', border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: 14, textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>No steps yet</div>
                  <div style={{ fontSize: 11, color: '#4a5568' }}>Click a step type on the left</div>
                </div>
              ) : (
                steps.map((step, index) => {
                  // Fix 3: determine timing label for this connector
                  const prevStep = index > 0 ? steps[index - 1] : null;
                  const connLabel = prevStep?.step_type === 'wait'
                    ? timingLabel(prevStep.wait_hours)
                    : step.step_type === 'wait'
                    ? null
                    : (index === 0 ? 'Immediate' : null);
                  return (
                    <React.Fragment key={step.id}>
                      <Connector width={Math.max(TRIG_W, NODE_W)} waitLabel={connLabel} />
                      <StepNode
                        step={step}
                        index={index}
                        onEdit={s => setEditingStep({ ...s })}
                        onDelete={removeStep}
                        isBuilder
                      />
                    </React.Fragment>
                  );
                })
              )}

              {steps.length > 0 && (
                <>
                  <Connector width={NODE_W} color="rgba(255,255,255,0.1)" />
                  <div style={{ width: NODE_W, padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' }}>✓ Sequence End</div>
                  </div>
                </>
              )}
            </div>

            <MiniMap steps={steps} transform={transform} triggerType={selectedWorkflow.trigger_type} />
          </div>
        </div>

        {/* ── EDIT STEP MODAL (builder context) ── */}
        {editingStep && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#0f1f35', borderRadius: 14, padding: 24, width: 480, maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 8, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>Edit Step</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4f8', textTransform: 'capitalize' }}>{editingStep.step_type}</div>
                </div>
                <button onClick={() => setEditingStep(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 22 }}>×</button>
              </div>
              {editingStep.step_type === 'wait' ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Wait hours</div>
                  <input type="number" value={editingStep.wait_hours} min={0}
                    onChange={e => setEditingStep(s => ({ ...s, wait_hours: parseInt(e.target.value, 10) || 0 }))}
                    style={inputStyle} />
                </div>
              ) : (
                <>
                  {editingStep.step_type === 'email' && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Subject line</div>
                      <input type="text" value={editingStep.subject || ''} placeholder="Subject..."
                        onChange={e => setEditingStep(s => ({ ...s, subject: e.target.value }))} style={inputStyle} />
                    </div>
                  )}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Content</div>
                    <textarea rows={5} value={editingStep.content || ''} placeholder="Message content..."
                      onChange={e => setEditingStep(s => ({ ...s, content: e.target.value }))}
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveStepEdit} disabled={editSaving}
                  style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingStep(null)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8896a8', borderRadius: 8, padding: '9px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // WORKFLOW LIST VIEW
  // ═══════════════════════════════════════════════════════════
  return (
    <div>

      {/* Fix 5: GENERATE SEQUENCE MODAL */}
      {showGenerate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0f1f35', borderRadius: 16, padding: 28, width: 680, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 8, color: '#c9a84c', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>Mahdi — AI Sequence Builder</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4f8' }}>Generate a Sequence</div>
              </div>
              <button onClick={() => { setShowGenerate(false); setGenType(null); setGenClientId(''); setGenError(''); }}
                style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 24 }}>×</button>
            </div>

            <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 20, lineHeight: 1.6 }}>
              Select a sequence type and Mahdi will write the full email and SMS copy, set up the steps, and open the builder for your review.
            </div>

            {/* Workflow type grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
              {WORKFLOW_TYPES.map(wt => (
                <div key={wt.type} onClick={() => setGenType(wt)}
                  style={{
                    background: genType?.type === wt.type ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${genType?.type === wt.type ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (genType?.type !== wt.type) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={e => { if (genType?.type !== wt.type) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 16 }}>{wt.icon}</span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: genType?.type === wt.type ? '#c9a84c' : '#f0f4f8' }}>{wt.type}</div>
                    <div style={{ marginLeft: 'auto', fontSize: 8, color: '#4a5568', fontFamily: 'DM Mono, monospace', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{wt.trigger}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5568', lineHeight: 1.6 }}>{wt.desc}</div>
                </div>
              ))}
            </div>

            {/* Client selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Client Store</div>
              <select value={genClientId} onChange={e => setGenClientId(e.target.value)} style={inputStyle}>
                <option value="">Select client store</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {genError && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12 }}>{genError}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={generateSequence} disabled={generating || !genType || !genClientId}
                style={{ flex: 1, background: generating ? 'rgba(201,168,76,0.3)' : '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {generating ? 'Mahdi is writing your sequence…' : `Generate ${genType ? genType.type : 'Sequence'}`}
              </button>
              <button onClick={() => { setShowGenerate(false); setGenType(null); setGenClientId(''); setGenError(''); }}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8896a8', borderRadius: 8, padding: '11px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 9, color: '#8896a8', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, fontFamily: 'DM Mono, monospace' }}>Automation Sequences</div>
          <div style={{ fontSize: 13, color: '#f0f4f8', fontWeight: 600 }}>{workflows.length} workflow{workflows.length !== 1 ? 's' : ''} · {workflows.filter(w => w.status === 'active').length} active</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="All">All Stores</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Fix 1: Flash Sale tab */}
          <button onClick={() => setShowFlashSale(!showFlashSale)}
            style={{ background: showFlashSale ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)', color: showFlashSale ? '#ef4444' : '#8896a8', border: `1px solid ${showFlashSale ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            ⚡ Flash Sale
          </button>
          {/* Fix 5: Generate sequence */}
          <button onClick={() => { setShowGenerate(true); setGenError(''); }}
            style={{ background: 'rgba(201,168,76,0.1)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            ✦ Generate Sequence
          </button>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            + New Workflow
          </button>
        </div>
      </div>

      {/* Fix 1: FLASH SALE PANEL */}
      {showFlashSale && (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 8, color: '#ef4444', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>Mahdi — Campaign Builder</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4f8' }}>⚡ Flash Sale Sequence</div>
              <div style={{ fontSize: 11, color: '#4a5568', marginTop: 3 }}>Mahdi generates a 3-email urgency sequence targeting contacts inactive for 30+ days. Submitted to approvals.</div>
            </div>
            <button onClick={() => { setShowFlashSale(false); setFsResult(null); }}
              style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 20 }}>×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Client Store</div>
              <select value={fsClientId} onChange={e => setFsClientId(e.target.value)} style={inputStyle}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Discount Percentage</div>
              <input type="number" value={fsDiscount} onChange={e => setFsDiscount(e.target.value)} placeholder="e.g. 20" min={1} max={90} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Offer End Date</div>
              <input type="date" value={fsEndDate} onChange={e => setFsEndDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Specific Products (optional)</div>
              <input type="text" value={fsProducts} onChange={e => setFsProducts(e.target.value)} placeholder="e.g. Protein Powder, Shaker Bottle" style={inputStyle} />
            </div>
          </div>

          {fsResult && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: fsResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${fsResult.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, fontSize: 12, color: fsResult.ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {fsResult.msg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submitFlashSale} disabled={fsLoading}
              style={{ background: fsLoading ? 'rgba(239,68,68,0.3)' : '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: fsLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {fsLoading ? 'Generating…' : 'Generate & Submit for Approval'}
            </button>
          </div>

          {/* Previous flash sales */}
          {workflows.filter(w => w.trigger_type === 'flash_sale' || (w.name || '').toLowerCase().includes('flash')).length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 10 }}>Previous Flash Sales</div>
              {workflows.filter(w => w.trigger_type === 'flash_sale' || (w.name || '').toLowerCase().includes('flash')).map(w => (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f4f8' }}>{w.name}</div>
                    <div style={{ fontSize: 10, color: '#4a5568' }}>{getClientName(w.client_id)} · {new Date(w.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, color: '#4a5568' }}>{w.enrolled_count || 0} enrolled</span>
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                      background: w.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                      color: w.status === 'active' ? '#34d399' : '#4a5568',
                      border: `1px solid ${w.status === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                      {w.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE FORM */}
      {showForm && (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: '#8896a8', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 16, fontFamily: 'DM Mono, monospace' }}>New Workflow</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Workflow Name</div>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cart Recovery Sequence" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Client Store</div>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                <option value="">Select store</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Trigger — What starts this workflow</div>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={inputStyle}>
                {triggers.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createWorkflow}
              style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Create & Build
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8896a8', borderRadius: 8, padding: '9px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* WORKFLOW LIST */}
      {loading ? (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 40, textAlign: 'center', color: '#4a5568' }}>Loading workflows…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ fontWeight: 600, color: '#f0f4f8', marginBottom: 6, fontSize: 14 }}>No workflows yet</div>
          <div style={{ fontSize: 12, color: '#4a5568' }}>Use Generate Sequence to let Mahdi build one automatically</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(workflow => (
            <div key={workflow.id}>
              {/* ROW */}
              <div
                style={{ background: '#0f1f35', border: '1px solid rgba(255,255,255,0.07)', borderRadius: expandedWorkflowId === workflow.id ? '14px 14px 0 0' : 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { if (expandedWorkflowId !== workflow.id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
                onClick={() => toggleExpand(workflow)}>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: expandedWorkflowId === workflow.id ? '#c9a84c' : '#4a5568' }}>{expandedWorkflowId === workflow.id ? '▾' : '▸'}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f4f8' }}>{workflow.name}</div>
                    <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                      background: workflow.status === 'active' ? 'rgba(16,185,129,0.1)' : workflow.status === 'paused' ? 'rgba(217,119,6,0.1)' : 'rgba(255,255,255,0.04)',
                      color:      workflow.status === 'active' ? '#34d399' : workflow.status === 'paused' ? '#f59e0b' : '#4a5568',
                      border:     `1px solid ${workflow.status === 'active' ? 'rgba(16,185,129,0.25)' : workflow.status === 'paused' ? 'rgba(217,119,6,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                      {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#4a5568' }}>{getClientName(workflow.client_id)} · {workflow.trigger_type} · {new Date(workflow.created_at).toLocaleDateString()}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,52px)', gap: 12, marginRight: 18, textAlign: 'center' }}>
                  {[{ label: 'Enrolled', value: workflow.enrolled_count }, { label: 'Active', value: workflow.active_count }, { label: 'Converted', value: workflow.converted_count }].map(st => (
                    <div key={st.label}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f4f8' }}>{st.value || 0}</div>
                      <div style={{ fontSize: 9, color: '#4a5568' }}>{st.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                  {[
                    { label: 'Edit', action: () => openBuilder(workflow), style: { background: 'rgba(201,168,76,0.12)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.25)' } },
                    { label: workflow.status === 'active' ? 'Pause' : 'Activate', action: () => toggleStatus(workflow), style: { background: workflow.status === 'active' ? 'rgba(217,119,6,0.1)' : 'rgba(16,185,129,0.1)', color: workflow.status === 'active' ? '#f59e0b' : '#34d399', border: `1px solid ${workflow.status === 'active' ? 'rgba(217,119,6,0.25)' : 'rgba(16,185,129,0.25)'}` } },
                    { label: 'Pause All', action: async () => { if (!window.confirm(`Pause all active enrollments in "${workflow.name}"?`)) return; await axios.post(`${API_BASE}/workflows/pause`, { workflow_id: workflow.id, client_id: workflow.client_id }); fetchWorkflows(); }, style: { background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' } },
                    { label: 'Resume All', action: async () => { await axios.post(`${API_BASE}/workflows/resume`, { workflow_id: workflow.id, client_id: workflow.client_id }); fetchWorkflows(); }, style: { background: 'rgba(16,185,129,0.07)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' } },
                    { label: 'Feedback', action: () => getFeedback(workflow), style: feedbackId === workflow.id ? { background: 'rgba(201,168,76,0.12)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)' } : { background: 'rgba(255,255,255,0.04)', color: '#4a5568', border: '1px solid rgba(255,255,255,0.07)' } },
                    { label: duplicating === workflow.id ? '…' : '⊕ Duplicate', action: () => duplicateWorkflow(workflow), style: { background: 'rgba(255,255,255,0.04)', color: '#4a5568', border: '1px solid rgba(255,255,255,0.07)' } },
                    { label: workflow.status === 'scheduled' ? '🕐 Scheduled' : '📅 Schedule', action: () => { setSchedulingId(schedulingId === workflow.id ? null : workflow.id); setScheduleDate(''); }, style: workflow.status === 'scheduled' ? { background: 'rgba(201,168,76,0.1)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.25)' } : { background: 'rgba(255,255,255,0.04)', color: '#4a5568', border: '1px solid rgba(255,255,255,0.07)' } },
                  ].map(btn => (
                    <button key={btn.label} onClick={btn.action} disabled={duplicating === workflow.id && btn.label.includes('Duplicate')}
                      style={{ ...btn.style, borderRadius: 7, padding: '6px 11px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SCHEDULE PICKER */}
              {schedulingId === workflow.id && (
                <div style={{ background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.2)', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Schedule start:</span>
                  <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                    style={{ ...inputStyle, width: 'auto', fontSize: 11, padding: '5px 10px' }} />
                  <button onClick={() => scheduleWorkflow(workflow.id)} disabled={!scheduleDate}
                    style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    Set
                  </button>
                  <button onClick={() => setSchedulingId(null)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
              )}

              {/* EXPANDED FLOW PREVIEW + Fix 2: analytics mini-panel */}
              {expandedWorkflowId === workflow.id && (
                <div style={{ background: '#050d1a', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>

                  {/* Fix 2: analytics mini-panel */}
                  {(() => {
                    const an = wfAnalytics[workflow.id];
                    return (
                      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 24, alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 9, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>Analytics</div>
                        {an ? (
                          <>
                            {[
                              { label: 'This Week', value: an.enrolledThisWeek, color: '#c9a84c' },
                              { label: 'Completed', value: an.completed, color: '#10b981' },
                              { label: 'Completion %', value: `${an.completionRate}%`, color: an.completionRate >= 50 ? '#10b981' : '#f59e0b' },
                              { label: 'Email Open Rate', value: `${an.openRate}%`, color: '#3b82f6' },
                              { label: 'SMS Reply Rate', value: `${an.replyRate}%`, color: '#0d9488' },
                            ].map(s => (
                              <div key={s.label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: 9, color: '#4a5568', marginTop: 3, fontFamily: 'DM Mono, monospace' }}>{s.label}</div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div style={{ fontSize: 10, color: '#4a5568' }}>Loading analytics…</div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Step flow */}
                  <div style={{ padding: '20px', overflowX: 'auto' }}>
                    <div style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '22px 22px', borderRadius: 10, padding: '20px 0', minHeight: 120 }}>
                      {stepsLoading ? (
                        <div style={{ fontSize: 11, color: '#4a5568', textAlign: 'center', padding: 20 }}>Loading flow…</div>
                      ) : expandedSteps.length === 0 ? (
                        <div style={{ fontSize: 11, color: '#4a5568', textAlign: 'center', padding: 20 }}>No steps — click Edit to build this workflow.</div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', padding: '0 20px', justifyContent: 'flex-start' }}>
                          {/* Trigger chip */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: 14 }}>⚡</span>
                              <div>
                                <div style={{ fontSize: 8, color: 'rgba(201,168,76,0.6)', letterSpacing: 1.5, fontFamily: 'DM Mono, monospace', fontWeight: 700, textTransform: 'uppercase' }}>Trigger</div>
                                <div style={{ fontSize: 11, color: '#c9a84c', fontWeight: 700 }}>{workflow.trigger_type}</div>
                              </div>
                            </div>
                          </div>

                          {expandedSteps.map((step, idx) => {
                            const col = NODE_COLOR[step.step_type] || '#6b7280';
                            const isWait = step.step_type === 'wait';
                            const preview = isWait ? timingLabel(step.wait_hours) : ((step.content || '').slice(0, 40) || '—');
                            // Fix 3: timing badge on horizontal arrows
                            const prevStep = idx > 0 ? expandedSteps[idx - 1] : null;
                            const arrowLabel = prevStep?.step_type === 'wait'
                              ? timingLabel(prevStep.wait_hours)
                              : idx === 0 ? 'Immediate' : null;
                            return (
                              <React.Fragment key={step.id}>
                                {/* Arrow connector with timing */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 18, flexShrink: 0 }}>
                                  {arrowLabel && (
                                    <div style={{ fontSize: 8, color: '#c9a84c', fontWeight: 700, fontFamily: 'DM Mono, monospace', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 20, padding: '2px 8px', marginBottom: 4, whiteSpace: 'nowrap' }}>
                                      {arrowLabel}
                                    </div>
                                  )}
                                  <svg width="36" height="12" style={{ flexShrink: 0 }}>
                                    <defs><marker id={`mh-${step.id}`} markerWidth="6" markerHeight="5" refX="0" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill={isWait ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.2)'} /></marker></defs>
                                    <line x1="0" y1="6" x2="30" y2="6" stroke={isWait ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.2)'} strokeWidth="1.5" markerEnd={`url(#mh-${step.id})`} />
                                  </svg>
                                </div>

                                {/* Step card */}
                                <div style={{ flexShrink: 0, width: isWait ? 110 : 150 }}>
                                  <div style={{ background: isWait ? 'rgba(255,255,255,0.02)' : '#0f1f35', border: `1px solid ${col}44`, borderTop: `2px solid ${col}`, borderRadius: 10, overflow: 'hidden', opacity: isWait ? 0.8 : 1 }}>
                                    <div style={{ background: col + '18', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <span style={{ fontSize: 12 }}>{stepIcon(step.step_type)}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{step.step_type}</span>
                                      <span style={{ marginLeft: 'auto', fontSize: 9, color: '#4a5568' }}>#{idx + 1}</span>
                                    </div>
                                    <div style={{ padding: '8px 10px' }}>
                                      <div style={{ fontSize: isWait ? 9 : 10, color: isWait ? col : '#8896a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: isWait ? 0 : 6, fontWeight: isWait ? 700 : 400 }}>{preview}</div>
                                      {!isWait && (
                                        <button onClick={() => setEditingStep({ ...step })}
                                          style={{ width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 600, borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#8896a8', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                                          Edit
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}

                          {/* End cap */}
                          <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
                            <svg width="28" height="12" style={{ flexShrink: 0 }}>
                              <line x1="0" y1="6" x2="24" y2="6" stroke="rgba(16,185,129,0.3)" strokeWidth="1.5" />
                            </svg>
                          </div>
                          <div style={{ flexShrink: 0, padding: '7px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, marginTop: 8 }}>
                            <div style={{ fontSize: 9, color: '#10b981', fontWeight: 700, fontFamily: 'DM Mono, monospace', letterSpacing: 1 }}>✓ END</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* STEP EDIT MODAL */}
      {editingStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1f35', borderRadius: 14, padding: 24, width: 480, maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 8, color: '#4a5568', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>Edit Step</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4f8', textTransform: 'capitalize' }}>{editingStep.step_type} — Step {expandedSteps.findIndex(s => s.id === editingStep.id) + 1}</div>
              </div>
              <button onClick={() => setEditingStep(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', fontSize: 22 }}>×</button>
            </div>
            {editingStep.step_type === 'wait' ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Wait hours</div>
                <input type="number" value={editingStep.wait_hours} min={0}
                  onChange={e => setEditingStep(s => ({ ...s, wait_hours: parseInt(e.target.value, 10) || 0 }))}
                  style={inputStyle} />
              </div>
            ) : (
              <>
                {editingStep.step_type === 'email' && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Subject line</div>
                    <input type="text" value={editingStep.subject || ''} placeholder="Subject..."
                      onChange={e => setEditingStep(s => ({ ...s, subject: e.target.value }))} style={inputStyle} />
                  </div>
                )}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#8896a8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Content</div>
                  <textarea rows={5} value={editingStep.content || ''} placeholder="Message content..."
                    onChange={e => setEditingStep(s => ({ ...s, content: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveStepEdit} disabled={editSaving}
                style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingStep(null)}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8896a8', borderRadius: 8, padding: '9px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK PANEL */}
      {feedbackId && (
        <div style={{ marginTop: 16, background: '#0a1628', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.2)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>Hussain — Sequence Analysis</div>
              <div style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>{workflows.find(w => w.id === feedbackId)?.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {feedbackStats && (
                <>
                  {[{ label: 'Completion', value: `${feedbackStats.completionRate}%`, color: '#c9a84c' }, { label: 'Enrolled', value: feedbackStats.total, color: '#f0f4f8' }, { label: 'Drop-off', value: `${feedbackStats.dropOffRate}%`, color: '#ef4444' }].map(st => (
                    <div key={st.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: st.color }}>{st.value}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{st.label}</div>
                    </div>
                  ))}
                </>
              )}
              <button onClick={() => { setFeedbackId(null); setFeedbackResult(null); setFeedbackStats(null); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
          </div>
          <div style={{ padding: 20, fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 380, overflowY: 'auto' }}>
            {feedbackLoading
              ? <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '40px 0' }}>Hussain is analyzing this sequence…</div>
              : feedbackResult}
          </div>
        </div>
      )}
    </div>
  );
}
