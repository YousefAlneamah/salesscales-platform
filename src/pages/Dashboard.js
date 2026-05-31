import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import axios from 'axios';
import { API_BASE } from '../config';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalClients: 0,
    totalContacts: 0,
    activeWorkflows: 0,
    totalWorkflows: 0,
    totalDeals: 0,
    pipelineValue: 0,
    pendingApprovals: 0,
    totalMessages: 0,
    unreadMessages: 0,
    knowledgeDocs: 0,
    revenueRecoveredMonth: 0,
    enrolledThisWeek: 0,
    avgHealthScore: 0,
  });
  const [clients, setClients] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [recentApprovals, setRecentApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upcomingCalls, setUpcomingCalls] = useState([]);
  const [calendlyConfigured, setCalendlyConfigured] = useState(false);

  useEffect(() => {
    fetchAllData();
    axios.get(`${API_BASE}/calendly/upcoming`).then(r => { setUpcomingCalls(r.data.events || []); setCalendlyConfigured(r.data.configured || false); }).catch(() => {});
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [clientsRes, contactsRes, workflowsRes, dealsRes, approvalsRes, messagesRes, knowledgeRes,
        completedMonthRes, enrolledWeekRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(4),
        supabase.from('workflows').select('*'),
        supabase.from('pipeline_deals').select('*'),
        supabase.from('approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
        supabase.from('messages').select('*'),
        supabase.from('knowledge_base').select('id', { count: 'exact', head: true }),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', monthStart),
        supabase.from('workflow_enrollments').select('id', { count: 'exact', head: true }).gte('enrolled_at', weekStart),
      ]);

      setClients(clientsRes.data || []);
      setRecentContacts(contactsRes.data || []);
      setRecentApprovals(approvalsRes.data || []);

      const deals = dealsRes.data || [];
      const workflows = workflowsRes.data || [];
      const messages = messagesRes.data || [];
      const clients = clientsRes.data || [];
      const avgHealthScore = clients.length > 0
        ? Math.round(clients.reduce((sum, c) => sum + (c.health_score || 0), 0) / clients.length)
        : 0;

      setStats({
        totalClients: clients.length,
        totalContacts: contactsRes.data?.length || 0,
        activeWorkflows: workflows.filter(w => w.status === 'active').length,
        totalWorkflows: workflows.length,
        totalDeals: deals.length,
        pipelineValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
        pendingApprovals: approvalsRes.data?.length || 0,
        totalMessages: messages.length,
        unreadMessages: messages.filter(m => m.status === 'unread').length,
        knowledgeDocs: knowledgeRes.count || 0,
        revenueRecoveredMonth: (completedMonthRes.count || 0) * 75,
        enrolledThisWeek: enrolledWeekRes.count || 0,
        avgHealthScore,
      });
    } catch (e) {
      console.error('Dashboard error:', e);
    }
    setLoading(false);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '—';
    const diff = new Date() - new Date(dateString);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // ── helpers ──────────────────────────────────────────────
  const nameColor = (name) => {
    const cols = ['#3b82f6','#10b981','#c9a84c','#8b5cf6','#f59e0b','#ec4899','#0d9488'];
    let h = 0;
    for (let i = 0; i < (name||'').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return cols[Math.abs(h) % cols.length];
  };

  // 7-day pseudo trend derived from monthly figure
  const trendPts = (() => {
    const base = (stats.revenueRecoveredMonth || 0) / 30;
    const seeds = [0.7, 1.1, 0.9, 1.3, 1.0, 0.8, 1.2];
    return seeds.map(s => Math.max(0, base * s));
  })();
  const trendMax = Math.max(...trendPts, 1);
  const W = 400, H = 80;
  const trendCoords = trendPts.map((v, i) => [i * (W / (trendPts.length - 1)), H - 6 - (v / trendMax) * (H - 12)]);
  const trendPath = trendCoords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const trendFill = `${trendPath} L${W},${H} L0,${H} Z`;
  const days7 = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Activity feed: merge contacts + approvals sorted by time
  const activityFeed = [
    ...recentContacts.map(c => ({ id:'c'+c.id, icon:'ti-user-plus', color:'#10b981', title:`${c.first_name||''} ${c.last_name||''}`.trim()||'New contact', sub:`Added via ${c.source||'unknown'}`, time: c.created_at })),
    ...recentApprovals.map(a => ({ id:'a'+a.id, icon:'ti-bell', color: a.priority==='urgent'?'#ef4444':'#c9a84c', title: a.title, sub:`${a.priority} priority`, time: a.created_at })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'400px' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:'32px', height:'32px', border:'2px solid rgba(255,255,255,0.08)', borderTop:'2px solid #c9a84c', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
          <div style={{ fontSize:'12px', color:'#8896a8' }}>Loading dashboard…</div>
        </div>
      </div>
    );
  }

  const GLASS = { background:'rgba(15,31,53,0.8)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'24px' };

  return (
    <div>
      {/* ── HERO METRICS ─────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:20 }}>
        {[
          { label:'Revenue Recovered', value:`$${stats.revenueRecoveredMonth.toLocaleString()}`, sub:'this month (est.)', accent:'#10b981', icon:'ti-currency-dollar', trend:'+12%' },
          { label:'Active Clients',    value: stats.totalClients,     sub:'on the platform',   accent:'#c9a84c',  icon:'ti-users',           trend:'+2' },
          { label:'Active Sequences',  value: stats.activeWorkflows,  sub:`of ${stats.totalWorkflows} built`, accent:'#3b82f6', icon:'ti-bolt', trend: stats.activeWorkflows > 0 ? '▲' : '—' },
          { label:'Enrolled This Week',value: stats.enrolledThisWeek, sub:'new enrollments',   accent:'#8b5cf6',  icon:'ti-user-plus',       trend:'+' + stats.enrolledThisWeek },
        ].map(card => (
          <div key={card.label} style={{ ...GLASS, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:16, right:16, width:40, height:40, borderRadius:10, background: card.accent+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className={`ti ${card.icon}`} style={{ fontSize:20, color:card.accent }} />
            </div>
            <div style={{ fontSize:9, color:'#8896a8', letterSpacing:2, fontWeight:700, textTransform:'uppercase', fontFamily:'DM Mono,monospace', marginBottom:12 }}>{card.label}</div>
            <div style={{ fontSize:48, fontWeight:800, color:'#f0f4f8', lineHeight:1, letterSpacing:'-2px', marginBottom:8 }}>{card.value}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, color: card.accent, fontWeight:700, background: card.accent+'18', padding:'2px 8px', borderRadius:20 }}>{card.trend}</span>
              <span style={{ fontSize:11, color:'#8896a8' }}>{card.sub}</span>
            </div>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:`linear-gradient(90deg, ${card.accent}88, transparent)`, borderRadius:'0 0 20px 20px' }} />
          </div>
        ))}
      </div>

      {/* ── REVENUE TREND + ACTIVITY ─────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:16, marginBottom:20 }}>

        {/* SVG Line Chart */}
        <div style={{ ...GLASS }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:9, color:'#8896a8', letterSpacing:2, fontWeight:700, textTransform:'uppercase', fontFamily:'DM Mono,monospace', marginBottom:6 }}>Revenue Trend</div>
              <div style={{ fontSize:20, fontWeight:800, color:'#f0f4f8' }}>${stats.revenueRecoveredMonth.toLocaleString()}</div>
              <div style={{ fontSize:11, color:'#10b981', fontWeight:600 }}>↑ estimated this month</div>
            </div>
            <div style={{ fontSize:10, color:'#4a5568' }}>Last 7 days</div>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow:'visible' }}>
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={trendFill} fill="url(#tg)" />
            <path d={trendPath} fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {trendCoords.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3} fill="#c9a84c" />
            ))}
            {days7.map((d, i) => (
              <text key={d} x={trendCoords[i][0]} y={H + 14} textAnchor="middle" fontSize="9" fill="#4a5568">{d}</text>
            ))}
          </svg>
        </div>

        {/* Recent Activity Feed */}
        <div style={{ ...GLASS }}>
          <div style={{ fontSize:9, color:'#8896a8', letterSpacing:2, fontWeight:700, textTransform:'uppercase', fontFamily:'DM Mono,monospace', marginBottom:16 }}>Recent Activity</div>
          {activityFeed.length === 0 ? (
            <div style={{ color:'#4a5568', fontSize:12, textAlign:'center', padding:'20px 0' }}>No recent activity</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {activityFeed.map(ev => (
                <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:8, background: ev.color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={`ti ${ev.icon}`} style={{ fontSize:14, color:ev.color }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#f0f4f8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
                    <div style={{ fontSize:10, color:'#4a5568' }}>{ev.sub}</div>
                  </div>
                  <div style={{ fontSize:10, color:'#4a5568', flexShrink:0 }}>{formatTime(ev.time)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ACTIVE SEQUENCES ─────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:9, color:'#8896a8', letterSpacing:2, fontWeight:700, textTransform:'uppercase', fontFamily:'DM Mono,monospace', marginBottom:14 }}>Active Sequences</div>
        {clients.length === 0 ? (
          <div style={{ ...GLASS, textAlign:'center', color:'#4a5568', fontSize:12, padding:'32px' }}>No clients yet</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {clients.slice(0, 5).map(client => {
              const nc = nameColor(client.name || '');
              const hs = client.health_score || 0;
              const hsColor = hs >= 70 ? '#10b981' : hs >= 40 ? '#c9a84c' : '#ef4444';
              return (
                <div key={client.id} style={{ ...GLASS, padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background: nc+'22', border:`1px solid ${nc}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:nc, flexShrink:0 }}>
                    {(client.name||'?')[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#f0f4f8', marginBottom:2 }}>{client.name}</div>
                    <div style={{ fontSize:10, color:'#8896a8' }}>{client.niche || client.business_type || 'Ecommerce'}</div>
                  </div>
                  <div style={{ flex:1.5, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#8896a8', marginBottom:5 }}>
                      <span>Health</span><span style={{ color:hsColor, fontWeight:700 }}>{hs}/100</span>
                    </div>
                    <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ width:`${hs}%`, height:'100%', background:`linear-gradient(90deg, ${hsColor}, ${hsColor}99)`, borderRadius:2, transition:'width 0.6s' }} />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <span style={{ fontSize:9, padding:'4px 10px', borderRadius:20, fontWeight:700, background: client.status==='live'?'rgba(16,185,129,0.12)':'rgba(217,119,6,0.12)', color: client.status==='live'?'#34d399':'#f59e0b', border:`1px solid ${client.status==='live'?'rgba(16,185,129,0.25)':'rgba(217,119,6,0.25)'}` }}>
                      {client.status}
                    </span>
                    <span style={{ fontSize:9, padding:'4px 10px', borderRadius:20, fontWeight:700, background:'rgba(201,168,76,0.1)', color:'#c9a84c', border:'1px solid rgba(201,168,76,0.2)' }}>
                      {client.tier}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PENDING APPROVALS + BRIEFING ─────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={{ ...GLASS }}>
          <div style={{ fontSize:9, color:'#8896a8', letterSpacing:2, fontWeight:700, textTransform:'uppercase', fontFamily:'DM Mono,monospace', marginBottom:14 }}>Pending Approvals</div>
          {recentApprovals.length === 0 ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', color:'#4a5568', fontSize:12 }}>
              <span style={{ fontSize:20 }}>✅</span> All clear — no pending approvals
            </div>
          ) : recentApprovals.map(a => {
            const bc = a.priority==='urgent'?'#ef4444':a.priority==='high'?'#c9a84c':'rgba(255,255,255,0.2)';
            return (
              <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', marginBottom:6, background:'rgba(255,255,255,0.03)', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', borderLeft:`3px solid ${bc}` }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#f0f4f8', marginBottom:2 }}>{a.title}</div>
                  <div style={{ fontSize:10, color:'#4a5568' }}>{formatTime(a.created_at)}</div>
                </div>
                <span style={{ fontSize:9, padding:'3px 9px', borderRadius:20, fontWeight:700, background: bc+'18', color:bc, border:`1px solid ${bc}44` }}>{a.priority}</span>
              </div>
            );
          })}
        </div>

        {/* Hussain briefing */}
        <div style={{ background:'linear-gradient(135deg, rgba(15,31,53,0.9), rgba(20,40,64,0.9))', backdropFilter:'blur(12px)', border:'1px solid rgba(201,168,76,0.25)', borderRadius:20, padding:24, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, right:0, width:120, height:120, background:'radial-gradient(circle at top right, rgba(201,168,76,0.08), transparent 70%)', pointerEvents:'none' }} />
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:6, height:6, background:'#c9a84c', borderRadius:'50%', boxShadow:'0 0 6px #c9a84c' }} />
            <div style={{ fontSize:9, color:'#c9a84c', fontWeight:700, letterSpacing:2, textTransform:'uppercase', fontFamily:'DM Mono,monospace' }}>Hussain — Morning Briefing</div>
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.8, marginBottom:16 }}>
            {stats.pendingApprovals > 0
              ? <><strong style={{ color:'#c9a84c' }}>{stats.pendingApprovals} AI actions</strong> waiting for approval. Review them to keep automations running at full speed.</>
              : stats.activeWorkflows === 0
              ? <>No active workflows running. Create a workflow to start automating revenue.</>
              : <><strong style={{ color:'#c9a84c' }}>{stats.activeWorkflows} workflows</strong> active across <strong style={{ color:'#c9a84c' }}>{stats.totalClients} clients</strong>. Platform running strong.</>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[{ v: stats.totalClients, l:'Clients' }, { v: stats.activeWorkflows, l:'Sequences' }, { v: stats.enrolledThisWeek, l:'Enrolled / wk' }].map(s => (
              <div key={s.l} style={{ background:'rgba(201,168,76,0.06)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(201,168,76,0.12)' }}>
                <div style={{ fontSize:22, fontWeight:800, color:'#c9a84c', lineHeight:1 }}>{s.v}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── UPCOMING CALLS ────────────────────────────────── */}
      {(upcomingCalls.length > 0 || calendlyConfigured) && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:9, color:'#8896a8', letterSpacing:2, fontWeight:700, textTransform:'uppercase', fontFamily:'DM Mono,monospace' }}>Upcoming Calls</div>
            {!calendlyConfigured && <div style={{ fontSize:10, color:'#4a5568' }}>Set CALENDLY_API_KEY to activate</div>}
          </div>
          {upcomingCalls.length === 0 ? (
            <div style={{ ...GLASS, textAlign:'center', color:'#4a5568', fontSize:12, padding:24 }}>No upcoming calls scheduled</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {upcomingCalls.map(ev => (
                <div key={ev.id} style={{ ...GLASS, borderLeft:'3px solid #c9a84c', padding:'14px 16px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#f0f4f8', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.name}</div>
                  <div style={{ fontSize:11, color:'#8896a8' }}>{new Date(ev.start_time).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                  {ev.join_url && <a href={ev.join_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#c9a84c', fontWeight:600, textDecoration:'none', display:'inline-block', marginTop:6 }}>Join →</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}