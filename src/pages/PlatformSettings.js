import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const DEFAULTS = {
  default_wait_hours: '24',
  default_from_name: 'Sales Scales',
  default_sms_sender: 'SalesScales',
  max_contacts_per_sequence: '10000',
  trial_period_days: '14',
};

const LABELS = {
  default_wait_hours: { label: 'Default Sequence Wait (hours)', hint: 'Hours to wait between steps when no wait step is defined' },
  default_from_name: { label: 'Default From Name (email)', hint: 'Sender name used when no client-specific name is set' },
  default_sms_sender: { label: 'Default SMS Sender Name', hint: 'Sender name in SMS messages' },
  max_contacts_per_sequence: { label: 'Max Contacts per Sequence', hint: 'Hard cap on how many contacts can be enrolled in one sequence' },
  trial_period_days: { label: 'Trial Period (days)', hint: 'Default number of days before billing starts' },
};

export default function PlatformSettings() {
  const [settings, setSettings] = useState({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/settings/platform`)
      .then(r => { setSettings({ ...DEFAULTS, ...(r.data.settings || {}) }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/settings/platform`, { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to save');
    }
    setSaving(false);
  };

  const inputStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', color: 'var(--text)', outline: 'none', background: 'white', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' };

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div className="section-label" style={{ marginBottom: '4px' }}>Configuration</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Platform Settings</div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Global defaults applied across all clients and sequences</div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: '12px', padding: '24px 0' }}>Loading…</div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.entries(LABELS).map(([key, { label, hint }]) => (
              <div key={key}>
                <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
                <input
                  value={settings[key] ?? DEFAULTS[key]}
                  onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                  style={inputStyle}
                />
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>{hint}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <button onClick={save} disabled={saving} className="btn btn-gold" style={{ fontSize: '12px' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>✓ Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
