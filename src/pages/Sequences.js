import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import axios from 'axios';
import { supabase } from '../supabase';

export default function Sequences() {
  const [workflows, setWorkflows] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [triggerType, setTriggerType] = useState('Cart Abandoned');
  const [steps, setSteps] = useState([]);
  const [filterClient, setFilterClient] = useState('All');
  const [feedbackId, setFeedbackId] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [feedbackStats, setFeedbackStats] = useState(null);

  const triggers = [
    'Cart Abandoned',
    'Order Placed',
    'Order Fulfilled',
    'Payment Failed',
    'New Customer',
    'Win-Back',
    'Browse Abandonment',
    'Price Drop',
    'Back In Stock',
    'New Product Launch',
    'Post Purchase',
    'Manual'
  ];

  const stepTypes = [
    { type: 'email', label: 'Send Email', icon: '✉' },
    { type: 'sms', label: 'Send SMS', icon: '💬' },
    { type: 'whatsapp', label: 'WhatsApp', icon: '📱' },
    { type: 'wait', label: 'Wait', icon: '⏱' },
    { type: 'tag', label: 'Add Tag', icon: '🏷' },
    { type: 'pipeline', label: 'Move Stage', icon: '🎯' },
    { type: 'notify', label: 'Notify Me', icon: '🔔' },
  ];

  useEffect(() => {
    fetchWorkflows();
    fetchClients();
  }, []);

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
      icon: stepType.icon
    }]);
  };

  const updateStep = (id, field, value) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStep = (id) => setSteps(steps.filter(s => s.id !== id));

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
        wait_hours: steps[i].wait_hours
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
      icon: stepTypes.find(t => t.type === s.step_type)?.icon || '📋'
    })));
    setShowBuilder(true);
  };

  const toggleStatus = async (workflow) => {
    const newStatus = workflow.status === 'active' ? 'paused' : 'active';
    await supabase.from('workflows').update({ status: newStatus }).eq('id', workflow.id);
    fetchWorkflows();
  };

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';
  const filtered = filterClient === 'All' ? workflows : workflows.filter(w => w.client_id === filterClient);

  const getFeedback = async (workflow) => {
    if (feedbackId === workflow.id && feedbackResult) {
      setFeedbackId(null); setFeedbackResult(null); setFeedbackStats(null); return;
    }
    setFeedbackId(workflow.id);
    setFeedbackResult(null);
    setFeedbackStats(null);
    setFeedbackLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/sequences/feedback`, { workflow_id: workflow.id });
      setFeedbackResult(data.analysis);
      setFeedbackStats(data.stats);
    } catch (_) {
      setFeedbackResult('Failed to load feedback. Please try again.');
    }
    setFeedbackLoading(false);
  };

  const inputStyle = {
    width: '100%', border: '1px solid #e4e9f0', borderRadius: '8px',
    padding: '9px 12px', fontSize: '12px', color: '#0a1628',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif'
  };

  if (showBuilder && selectedWorkflow) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Workflow Builder</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0a1628' }}>{selectedWorkflow.name}</div>
            <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '2px' }}>Trigger: {selectedWorkflow.trigger_type} · {getClientName(selectedWorkflow.client_id)}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setShowBuilder(false); setSelectedWorkflow(null); setSteps([]); }}
              style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '9px 16px', fontSize: '12px', cursor: 'pointer', color: '#8896a8' }}>
              ← Back
            </button>
            <button onClick={saveWorkflow}
              style={{ background: '#c9a84c', color: '#0a1628', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Save & Activate
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px' }}>
          {/* STEP TYPES */}
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>Add Step</div>
            {stepTypes.map(st => (
              <div key={st.type} onClick={() => addStep(st)}
                style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#0a1628', fontWeight: 500, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c9a84c'; e.currentTarget.style.background = '#fffdf5'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e9f0'; e.currentTarget.style.background = 'white'; }}>
                <span style={{ fontSize: '16px' }}>{st.icon}</span>
                <span>{st.label}</span>
              </div>
            ))}
          </div>

          {/* CANVAS */}
          <div>
            <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}>Workflow Steps</div>

            {/* TRIGGER NODE */}
            <div style={{ background: 'linear-gradient(135deg, #0a1628, #112240)', borderRadius: '10px', padding: '14px 16px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(201,168,76,0.2)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>⚡</div>
              <div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>Trigger</div>
                <div style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>{selectedWorkflow.trigger_type}</div>
              </div>
            </div>

            {steps.length > 0 && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><div style={{ width: '1px', height: '14px', background: '#e4e9f0' }}></div></div>}

            {steps.map((step, index) => (
              <div key={step.id}>
                <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '10px', padding: '14px 16px', marginBottom: '4px', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: step.step_type !== 'wait' && step.step_type !== 'tag' && step.step_type !== 'pipeline' && step.step_type !== 'notify' ? '12px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', border: '1px solid #e4e9f0' }}>{step.icon}</div>
                      <div>
                        <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Step {index + 1}</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628' }}>{step.label}</div>
                      </div>
                    </div>
                    <button onClick={() => removeStep(step.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8896a8', fontSize: '18px', lineHeight: 1 }}>×</button>
                  </div>

                  {step.step_type === 'wait' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#8896a8' }}>Wait</span>
                      <input type="number" value={step.wait_hours} onChange={e => updateStep(step.id, 'wait_hours', e.target.value)}
                        style={{ ...inputStyle, width: '80px' }} />
                      <span style={{ fontSize: '12px', color: '#8896a8' }}>hours before next step</span>
                    </div>
                  )}

                  {(step.step_type === 'email' || step.step_type === 'sms' || step.step_type === 'whatsapp') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {step.step_type === 'email' && (
                        <input type="text" value={step.subject} onChange={e => updateStep(step.id, 'subject', e.target.value)}
                          placeholder="Subject line..." style={inputStyle} />
                      )}
                      <textarea value={step.content} onChange={e => updateStep(step.id, 'content', e.target.value)}
                        placeholder={`Write your ${step.step_type} message... Use {{first_name}} for personalization`}
                        rows={3} style={{ ...inputStyle, resize: 'none' }} />
                    </div>
                  )}

                  {step.step_type === 'tag' && (
                    <input type="text" value={step.content} onChange={e => updateStep(step.id, 'content', e.target.value)}
                      placeholder="Tag name..." style={{ ...inputStyle, marginTop: '10px' }} />
                  )}

                  {step.step_type === 'pipeline' && (
                    <select value={step.content} onChange={e => updateStep(step.id, 'content', e.target.value)}
                      style={{ ...inputStyle, marginTop: '10px' }}>
                      <option>New Lead</option>
                      <option>Contacted</option>
                      <option>Nurturing</option>
                      <option>Hot Lead</option>
                      <option>Converted</option>
                    </select>
                  )}

                  {step.step_type === 'notify' && (
                    <input type="text" value={step.content} onChange={e => updateStep(step.id, 'content', e.target.value)}
                      placeholder="Notification message..." style={{ ...inputStyle, marginTop: '10px' }} />
                  )}
                </div>

                {index < steps.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '1px', height: '14px', background: '#e4e9f0' }}></div>
                  </div>
                )}
              </div>
            ))}

            {steps.length === 0 && (
              <div style={{ background: '#f8fafc', border: '1px dashed #e4e9f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚡</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0a1628', marginBottom: '4px' }}>No steps yet</div>
                <div style={{ fontSize: '11px' }}>Click a step type on the left to add it</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Automation Sequences</div>
          <div style={{ fontSize: '13px', color: '#0a1628', fontWeight: 600 }}>{workflows.length} workflow{workflows.length !== 1 ? 's' : ''} · {workflows.filter(w => w.status === 'active').length} active</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ ...inputStyle, width: '160px' }}>
            <option value="All">All Stores</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + New Workflow
          </button>
        </div>
      </div>

      {/* CREATE WORKFLOW FORM */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(10,22,40,0.05)' }}>
          <div style={{ fontSize: '9px', color: '#8896a8', letterSpacing: '2px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px' }}>New Workflow</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Workflow Name</div>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cart Recovery Sequence" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client Store</div>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                <option value="">Select store</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8896a8', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trigger — What starts this workflow</div>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={inputStyle}>
                {triggers.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createWorkflow}
              style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Create & Build
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: 'white', border: '1px solid #e4e9f0', color: '#8896a8', borderRadius: '8px', padding: '9px 18px', fontSize: '12px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* WORKFLOWS LIST */}
      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#8896a8' }}>Loading workflows...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontWeight: 600, color: '#0a1628', marginBottom: '6px', fontSize: '14px' }}>No workflows yet</div>
          <div style={{ fontSize: '12px', color: '#8896a8' }}>Create your first automation sequence</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(workflow => (
            <div key={workflow.id} style={{ background: 'white', border: '1px solid #e4e9f0', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(10,22,40,0.04)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628' }}>{workflow.name}</div>
                  <span style={{ fontSize: '9px', padding: '3px 10px', borderRadius: '20px', fontWeight: 600, background: workflow.status === 'active' ? '#ecfdf5' : workflow.status === 'paused' ? '#fffbeb' : '#f8fafc', color: workflow.status === 'active' ? '#059669' : workflow.status === 'paused' ? '#d97706' : '#8896a8', border: `1px solid ${workflow.status === 'active' ? '#a7f3d0' : workflow.status === 'paused' ? '#fde68a' : '#e4e9f0'}` }}>
                    {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#8896a8' }}>
                  {getClientName(workflow.client_id)} · Trigger: {workflow.trigger_type} · Created {new Date(workflow.created_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: '12px', marginRight: '20px', textAlign: 'center' }}>
                {[
                  { label: 'Enrolled', value: workflow.enrolled_count },
                  { label: 'Active', value: workflow.active_count },
                  { label: 'Converted', value: workflow.converted_count },
                ].map(stat => (
                  <div key={stat.label}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0a1628' }}>{stat.value}</div>
                    <div style={{ fontSize: '9px', color: '#8896a8' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openBuilder(workflow)}
                  style={{ background: '#0a1628', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => toggleStatus(workflow)}
                  style={{ background: workflow.status === 'active' ? '#fffbeb' : '#ecfdf5', color: workflow.status === 'active' ? '#d97706' : '#059669', border: `1px solid ${workflow.status === 'active' ? '#fde68a' : '#a7f3d0'}`, borderRadius: '8px', padding: '7px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  {workflow.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button onClick={async () => {
                  if (!window.confirm(`Pause all active enrollments in "${workflow.name}"?`)) return;
                  await axios.post(`${API_BASE}/workflows/pause`, { workflow_id: workflow.id, client_id: workflow.client_id });
                  fetchWorkflows();
                }} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '7px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  Pause All
                </button>
                <button onClick={async () => {
                  await axios.post(`${API_BASE}/workflows/resume`, { workflow_id: workflow.id, client_id: workflow.client_id });
                  fetchWorkflows();
                }} style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '7px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  Resume All
                </button>
                <button onClick={() => getFeedback(workflow)}
                  style={{ background: feedbackId === workflow.id ? 'rgba(201,168,76,0.1)' : '#f8fafc', color: feedbackId === workflow.id ? '#c9a84c' : '#8896a8', border: `1px solid ${feedbackId === workflow.id ? '#c9a84c' : '#e4e9f0'}`, borderRadius: '8px', padding: '7px 14px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  Feedback
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FEEDBACK PANEL */}
      {feedbackId && (
        <div style={{ marginTop: '16px', background: '#0a1628', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(201,168,76,0.2)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '2px' }}>Hussain — Sequence Analysis</div>
              <div style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>{workflows.find(w => w.id === feedbackId)?.name}</div>
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              {feedbackStats && (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#c9a84c' }}>{feedbackStats.completionRate}%</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>Completion</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{feedbackStats.total}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>Enrolled</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>{feedbackStats.dropOffRate}%</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>Drop-off</div>
                  </div>
                </>
              )}
              <button onClick={() => { setFeedbackId(null); setFeedbackResult(null); setFeedbackStats(null); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
          </div>
          <div style={{ padding: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.8', whiteSpace: 'pre-wrap', maxHeight: '380px', overflowY: 'auto' }}>
            {feedbackLoading
              ? <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>Hussain is analyzing this sequence...</div>
              : feedbackResult
            }
          </div>
        </div>
      )}
    </div>
  );
}