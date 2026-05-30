import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

const MEMBERS = [
  {
    id: 'mahdi',
    name: 'Mahdi',
    role: 'Marketing & Content',
    icon: 'ti-pencil',
    color: 'var(--gold)',
    stats: [
      { key: 'sequences_generated', label: 'Sequences Generated' },
      { key: 'content_pieces', label: 'Content Pieces Created' },
    ],
  },
  {
    id: 'hassan',
    name: 'Hassan',
    role: 'Growth & Outreach',
    icon: 'ti-speakerphone',
    color: 'var(--blue)',
    stats: [
      { key: 'prospects_found', label: 'Prospects Found' },
      { key: 'outreach_sent', label: 'Outreach Sent' },
    ],
  },
  {
    id: 'hussain',
    name: 'Hussain',
    role: 'Intelligence & Strategy',
    icon: 'ti-brain',
    color: 'var(--green)',
    stats: [
      { key: 'briefings_generated', label: 'Briefings Generated' },
      { key: 'competitor_reports', label: 'Competitor Reports' },
    ],
  },
  {
    id: 'fatima',
    name: 'Fatima',
    role: 'Operations Manager',
    icon: 'ti-settings',
    color: '#a78bfa',
    stats: [
      { key: 'issues_flagged', label: 'Issues Flagged' },
      { key: 'refunds_handled', label: 'Refunds Handled' },
    ],
  },
  {
    id: 'zainab',
    name: 'Zainab',
    role: 'Client Partner',
    icon: 'ti-robot',
    color: '#f472b6',
    stats: [
      { key: 'reports_sent', label: 'Reports Sent' },
      { key: 'client_chats', label: 'Client Chats' },
    ],
  },
  {
    id: 'ali',
    name: 'Ali',
    role: 'Sales Closer',
    icon: 'ti-phone',
    color: 'var(--red)',
    stats: [
      { key: 'closing_scripts', label: 'Closing Scripts Generated' },
    ],
  },
];

export default function TeamPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/team/performance`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError(e.response?.data?.error || e.message); setLoading(false); });
  }, []);

  const weekStart = data?.week_start
    ? new Date(data.week_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : '';

  const totalActivity = data
    ? Object.values(data.stats).reduce((sum, m) => sum + Object.values(m).reduce((s, v) => s + v, 0), 0)
    : 0;

  const mostActive = data
    ? Object.entries(data.stats).sort((a, b) => {
        const sumA = Object.values(a[1]).reduce((s, v) => s + v, 0);
        const sumB = Object.values(b[1]).reduce((s, v) => s + v, 0);
        return sumB - sumA;
      })[0]?.[0]
    : null;

  return (
    <div style={{ padding: '28px 32px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <i className="ti ti-chart-dots" style={{ fontSize: '22px', color: 'var(--gold)' }} />
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
            Team Performance
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
          Weekly activity stats for each AI team member{weekStart ? ` — since ${weekStart}` : ''}
        </p>
      </div>

      {loading && (
        <div style={{ color: 'var(--muted)', fontSize: '13px', padding: '40px 0' }}>Loading...</div>
      )}

      {error && (
        <div className="card" style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</div>
      )}

      {data && !loading && (
        <>
          <div className="stats-row" style={{ marginBottom: '28px' }}>
            <div className="stat-card gold-top">
              <div className="stat-label">Total Actions This Week</div>
              <div className="stat-value">{totalActivity}</div>
              <div className="stat-sub">across all 6 members</div>
            </div>
            <div className="stat-card blue-top">
              <div className="stat-label">Most Active Member</div>
              <div className="stat-value" style={{ textTransform: 'capitalize' }}>{mostActive || '—'}</div>
              <div className="stat-sub">by action count</div>
            </div>
            <div className="stat-card green-top">
              <div className="stat-label">Prospects Found</div>
              <div className="stat-value">{data.stats.hassan?.prospects_found ?? 0}</div>
              <div className="stat-sub">Hassan this week</div>
            </div>
            <div className="stat-card navy-top">
              <div className="stat-label">Closing Scripts</div>
              <div className="stat-value">{data.stats.ali?.closing_scripts ?? 0}</div>
              <div className="stat-sub">Ali this week</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {MEMBERS.map(member => {
              const memberStats = data.stats[member.id] || {};
              const total = Object.values(memberStats).reduce((s, v) => s + v, 0);
              return (
                <div key={member.id} className="card" style={{ borderTop: `3px solid ${member.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '8px',
                      background: `${member.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className={`ti ${member.icon}`} style={{ fontSize: '18px', color: member.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{member.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>{member.role}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: member.color }}>{total}</div>
                      <div className="section-label" style={{ color: 'var(--muted)' }}>total</div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {member.stats.map(s => (
                      <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--slate)' }}>{s.label}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                          {memberStats[s.key] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <div className="pbar">
                      <div
                        className="pfill"
                        style={{
                          width: `${totalActivity > 0 ? Math.min(100, Math.round((total / totalActivity) * 100)) : 0}%`,
                          background: member.color,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                      {totalActivity > 0 ? Math.round((total / totalActivity) * 100) : 0}% of total team activity
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
