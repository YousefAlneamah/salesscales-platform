import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3001';

const SERVICE_LABELS = {
  server: 'Server',
  supabase: 'Supabase (Database)',
  sendgrid: 'SendGrid (Email)',
  twilio: 'Twilio (SMS/Voice)',
  elevenlabs: 'ElevenLabs (Voice AI)',
};

export default function PlatformHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await axios.get(`${API}/health/detailed`);
      setData(res.data);
      setLastChecked(new Date());
    } catch (e) {
      setData({ ok: false, checks: { server: { ok: false, error: 'Server unreachable' } } });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchHealth(); const t = setInterval(() => fetchHealth(true), 60000); return () => clearInterval(t); }, []);

  const checks = data?.checks || {};
  const services = Object.entries(checks);
  const allOk = data?.ok;

  return (
    <div style={{ maxWidth: '820px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div className="section-label">Infrastructure</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>Platform Health</div>
          {lastChecked && (
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
              Last checked: {lastChecked.toLocaleTimeString()}
            </div>
          )}
        </div>
        <button className="btn btn-outline" onClick={() => fetchHealth(true)} disabled={refreshing}>
          <i className="ti ti-refresh" style={{ marginRight: '6px' }} />
          {refreshing ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: '13px', padding: '40px', textAlign: 'center' }}>Checking services...</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: '20px', background: allOk ? '#ecfdf5' : '#fef2f2', border: `1px solid ${allOk ? '#a7f3d0' : '#fecaca'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: allOk ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 8px ${allOk ? '#10b981' : '#dc2626'}` }} />
              <div style={{ fontWeight: 700, fontSize: '15px', color: allOk ? '#065f46' : '#991b1b' }}>
                {allOk ? 'All Systems Operational' : 'One or More Services Degraded'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {services.map(([key, check]) => (
              <div key={key} className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: check.ok ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 6px ${check.ok ? '#10b981' : '#dc2626'}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{SERVICE_LABELS[key] || key}</div>
                  {check.error && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '2px' }}>{check.error}</div>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: check.ok ? 'var(--green)' : 'var(--red)' }}>{check.ok ? 'Operational' : 'Down'}</div>
                  {check.ms !== undefined && <div>{check.ms}ms</div>}
                  {key === 'server' && check.uptime !== undefined && <div>Uptime: {Math.floor(check.uptime / 3600)}h {Math.floor((check.uptime % 3600) / 60)}m</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
