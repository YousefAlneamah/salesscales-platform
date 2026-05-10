import React, { useState, useEffect } from 'react';
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

  const triggers = [
    'Cart Abandoned', 'Order Placed', 'Order Fulfilled', 'Payment Failed',
    'New Lead', 'Lead Goes Cold', 'Win-Back', 'Browse Abandonment',
    'Price Drop', 'Back In Stock', 'New Product', 'Discovery Call Booked',
    'Discovery Call No Show', 'Program Purchased', 'Course Completed',
    'New Listing', 'Open House Scheduled', 'Contract Signed', 'Manual'
  ];

  const stepTypes = [
    { type: 'email', label: 'Send Email', icon: '📧' },
    { type: 'sms', label: 'Send SMS', icon: '📱' },
    { type: 'whatsapp', label: 'Send WhatsApp', icon: '💬' },
    { type: 'instagram', label: 'Instagram DM', icon: '📸' },
    { type: 'facebook', label: 'Facebook DM', icon: '👥' },
    { type: 'wait', label: 'Wait', icon: '⏰' },
    { type: 'condition', label: 'Condition', icon: '🔀' },
    { type: 'tag', label: 'Add Tag', icon: '🏷️' },
    { type: 'pipeline', label: 'Move Pipeline Stage', icon: '🎯' },
    { type: 'notify', label: 'Notify Owner', icon: '🔔' },
  ];

  useEffect(() => {
    fetchWorkflows();
    fetchClients();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setWorkflows(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name');
    if (data) setClients(data);
  };

  const createWorkflow = async () => {
    if (!name || !clientId) {
      alert('Please fill in workflow name and select a client');
      return;
    }
    const { data, error } = await supabase.from('workflows').insert([{
      name, client_id: clientId, trigger_type: triggerType, status: 'draft'
    }]).select();
    if (!error && data) {
      fetchWorkflows();
      setShowForm(false);
      setName('');
      setClientId('');
      setTriggerType('Cart Abandoned');
      setSelectedWorkflow(data[0]);
      setSteps([]);
      setShowBuilder(true);
    }
  };

  const addStep = (stepType) => {
    const newStep = {
      id: Date.now(),
      step_type: stepType.type,
      channel: stepType.type,
      subject: '',
      content: '',
      wait_hours: stepType.type === 'wait' ? 24 : 0,
      label: stepType.label,
      icon: stepType.icon
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (id, field, value) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStep = (id) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const saveWorkflow = async () => {
    if (!selectedWorkflow) return;
    for (let i = 0; i < steps.length; i++) {
      await supabase.from('workflow_steps').insert([{
        workflow_id: selectedWorkflow.id,
        step_order: i + 1,
        step_type: steps[i].step_type,
        channel: steps[i].channel,
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
    alert('Workflow saved and activated');
  };

  const toggleStatus = async (workflow) => {
    const newStatus = workflow.status === 'active' ? 'paused' : 'active';
    await supabase.from('workflows').update({ status: newStatus }).eq('id', workflow.id);
    fetchWorkflows();
  };

  const openBuilder = async (workflow) => {
    setSelectedWorkflow(workflow);
    const { data } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflow.id).order('step_order');
    if (data) setSteps(data.map(s => ({ ...s, label: s.step_type, icon: stepTypes.find(t => t.type === s.step_type)?.icon || '📋' })));
    setShowBuilder(true);
  };

  const filtered = filterClient === 'All' ? workflows : workflows.filter(w => w.client_id === filterClient);

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : '—';
  };

  const statusColor = (status) => {
    if (status === 'active') return { background: '#ecfdf5', color: '#059669', border: '0.5px solid #a7f3d0' };
    if (status === 'paused') return { background: '#fffbeb', color: '#d97706', border: '0.5px solid #fde68a' };
    return { background: '#f8f9fc', color: '#64748b', border: '0.5px solid #e2e8f0' };
  };

  const inputStyle = {
    width: '100%', border: '0.5px solid #e2e8f0', borderRadius: '7px',
    padding: '8px 12px', fontSize: '12px', color: '#1a3c5e',
    outline: 'none', background: 'white', boxSizing: 'border-box'
  };

  if (showBuilder && selectedWorkflow) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>WORKFLOW BUILDER</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a3c5e', marginTop: '2px' }}>{selectedWorkflow.name}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Trigger: {selectedWorkflow.trigger_type} · Client: {getClientName(selectedWorkflow.client_id)}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setShowBuilder(false); setSelectedWorkflow(null); setSteps([]); }}
              style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '7px', padding: '8px 14px', fontSize: '11px', cursor: 'pointer', color: '#64748b' }}>
              ← Back
            </button>
            <button onClick={saveWorkflow}
              style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
              Save & Activate
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px' }}>
          {/* STEP TYPES */}
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>ADD STEP</div>
            {stepTypes.map(st => (
              <div key={st.type} onClick={() => addStep(st)}
                style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#1a3c5e', fontWeight: 500 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </div>
            ))}
          </div>

          {/* WORKFLOW CANVAS */}
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '10px' }}>WORKFLOW STEPS</div>

            {/* TRIGGER */}
            <div style={{ background: '#1a3c5e', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>⚡</div>
              <div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>TRIGGER</div>
                <div style={{ fontSize: '12px', color: 'white', fontWeight: 500 }}>{selectedWorkflow.trigger_type}</div>
              </div>
            </div>

            {steps.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                <div style={{ width: '2px', height: '16px', background: '#e2e8f0' }}></div>
              </div>
            )}

            {steps.map((step, index) => (
              <div key={step.id}>
                <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: step.step_type !== 'wait' && step.step_type !== 'tag' && step.step_type !== 'pipeline' && step.step_type !== 'notify' ? '10px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{step.icon}</span>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.5px' }}>STEP {index + 1}</div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: '#1a3c5e' }}>{step.label || step.step_type}</div>
                      </div>
                    </div>
                    <button onClick={() => removeStep(step.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }}>×</button>
                  </div>

                  {step.step_type === 'wait' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Wait</span>
                      <input type="number" value={step.wait_hours} onChange={e => updateStep(step.id, 'wait_hours', e.target.value)}
                        style={{ ...inputStyle, width: '70px' }} />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>hours</span>
                    </div>
                  )}

                  {(step.step_type === 'email' || step.step_type === 'sms' || step.step_type === 'whatsapp' || step.step_type === 'instagram' || step.step_type === 'facebook') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {step.step_type === 'email' && (
                        <input type="text" value={step.subject} onChange={e => updateStep(step.id, 'subject', e.target.value)}
                          placeholder="Email subject line..." style={inputStyle} />
                      )}
                      <textarea value={step.content} onChange={e => updateStep(step.id, 'content', e.target.value)}
                        placeholder={`Write your ${step.step_type} message here...`} rows={3}
                        style={{ ...inputStyle, resize: 'none' }} />
                    </div>
                  )}

                  {step.step_type === 'tag' && (
                    <input type="text" value={step.content} onChange={e => updateStep(step.id, 'content', e.target.value)}
                      placeholder="Tag name to add..." style={inputStyle} />
                  )}

                  {step.step_type === 'pipeline' && (
                    <select value={step.content} onChange={e => updateStep(step.id, 'content', e.target.value)} style={inputStyle}>
                      <option>New Lead</option>
                      <option>Contacted</option>
                      <option>Nurturing</option>
                      <option>Hot Lead</option>
                      <option>Proposal Sent</option>
                      <option>Converted</option>
                      <option>Lost</option>
                    </select>
                  )}

                  {step.step_type === 'notify' && (
                    <input type="text" value={step.content} onChange={e => updateStep(step.id, 'content', e.target.value)}
                      placeholder="Notification message to owner..." style={inputStyle} />
                  )}
                </div>

                {index < steps.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                    <div style={{ width: '2px', height: '16px', background: '#e2e8f0' }}></div>
                  </div>
                )}
              </div>
            ))}

            {steps.length === 0 && (
              <div style={{ background: '#f8f9fc', border: '0.5px dashed #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚡</div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#1a3c5e', marginBottom: '4px' }}>No steps yet</div>
                <div style={{ fontSize: '11px' }}>Click a step type on the left to add it to your workflow</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600 }}>WORKFLOWS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{workflows.length} total workflows</div>
        </div>
        <button className="btn btn-green" onClick={() => setShowForm(!showForm)}>+ New Workflow</button>
      </div>

      {showForm && (
        <div style={{ background: 'white', border: '0.5px solid #a7f3d0', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 600, marginBottom: '14px' }}>CREATE NEW WORKFLOW</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>WORKFLOW NAME</div>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Cart Recovery Sequence" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>CLIENT</div>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '5px', fontWeight: 500 }}>TRIGGER — WHAT STARTS THIS WORKFLOW</div>
              <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={inputStyle}>
                {triggers.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-green" onClick={createWorkflow}>Create Workflow</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ ...inputStyle, width: '180px' }}>
          <option value="All">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>{filtered.length} workflows</div>
      </div>

      {loading ? (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading workflows...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontWeight: 600, color: '#1a3c5e', marginBottom: '6px' }}>No workflows yet</div>
          <div style={{ fontSize: '11px' }}>Create your first workflow to start automating</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(workflow => (
            <div key={workflow.id} style={{ background: 'white', border: '0.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a3c5e' }}>{workflow.name}</div>
                  <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', ...statusColor(workflow.status) }}>
                    {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                  {getClientName(workflow.client_id)} · Trigger: {workflow.trigger_type} · Created {new Date(workflow.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: '8px', marginRight: '16px', textAlign: 'center' }}>
                {[
                  { label: 'Enrolled', value: workflow.enrolled_count },
                  { label: 'Active', value: workflow.active_count },
                  { label: 'Converted', value: workflow.converted_count },
                ].map(stat => (
                  <div key={stat.label}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a3c5e' }}>{stat.value}</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openBuilder(workflow)}
                  style={{ background: '#1a3c5e', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 12px', fontSize: '11px', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={() => toggleStatus(workflow)}
                  style={{ background: workflow.status === 'active' ? '#fffbeb' : '#ecfdf5', color: workflow.status === 'active' ? '#d97706' : '#059669', border: `0.5px solid ${workflow.status === 'active' ? '#fde68a' : '#a7f3d0'}`, borderRadius: '7px', padding: '7px 12px', fontSize: '11px', cursor: 'pointer' }}>
                  {workflow.status === 'active' ? 'Pause' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
