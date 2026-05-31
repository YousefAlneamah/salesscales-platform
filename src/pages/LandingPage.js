import React from 'react';

// REPLACE_WITH_REAL_CALENDLY_LINK
const CALENDLY_URL = 'https://calendly.com/yousef-salesscales/30min';

const NAVY   = '#0a1628';
const NAVYM  = '#112240';
const GOLD   = '#c9a84c';
const GOLDDIM = 'rgba(201,168,76,0.12)';
const WHITE  = '#ffffff';
const MUTED  = '#8896a8';
const BG     = '#f0f3f8';
const BORDER = '#e4e9f0';
const GREEN  = '#10b981';

const TEAM = [
  { name: 'Hussain', role: 'Intelligence & Strategy', icon: '🧠', desc: 'Analyzes your store data weekly and delivers sharp strategic recommendations.' },
  { name: 'Hassan',  role: 'Growth & Outreach',       icon: '📡', desc: 'Finds and contacts qualified prospects, warms leads, and books demos.' },
  { name: 'Ali',     role: 'Sales Closer',            icon: '📞', desc: 'Takes warm leads and closes high-ticket deals using the NEPQ framework.' },
  { name: 'Mahdi',   role: 'Marketing & Content',     icon: '✍️', desc: 'Writes every email, SMS, and WhatsApp sequence in your exact brand voice.' },
  { name: 'Fatima',  role: 'Operations Manager',       icon: '⚙️', desc: 'Monitors all workflows, manages contracts, and keeps every process on track.' },
  { name: 'Zainab',  role: 'Client Partner',           icon: '🤝', desc: 'Onboards new clients, nurtures relationships, and ensures retention.' },
];

const STEPS = [
  { n: '01', title: 'Connect your store', body: 'Link your Shopify store in one click. Your AI team instantly pulls your products, orders, and abandoned carts.' },
  { n: '02', title: 'AI team activates',  body: 'Hussain analyses your data and briefs the team. Mahdi builds sequences. Zainab onboards your customers. All within 24 hours.' },
  { n: '03', title: 'Revenue recovered automatically', body: 'Cart recovery emails fire at the perfect time. SMS follow-ups land. WhatsApp messages convert. You watch the dashboard fill up.' },
];

const PLANS = [
  {
    name: 'Starter',
    price: '$997',
    highlight: false,
    features: [
      'Full AI team (6 members)',
      'Email automation',
      'SMS sequences',
      'CRM & contact management',
      'Monthly analytics report',
      'Up to 3 active sequences',
    ],
  },
  {
    name: 'Growth',
    price: '$1,997',
    highlight: true,
    features: [
      'Everything in Starter',
      'WhatsApp automation',
      'Unlimited sequences',
      'Klaviyo integration',
      'Meta Ads reporting',
      'HubSpot CRM sync',
      'Weekly strategy calls',
    ],
  },
  {
    name: 'Elite',
    price: '$2,997',
    highlight: false,
    features: [
      'Everything in Growth',
      'Voice AI agents',
      'Shopify live data sync',
      'Canva & Higgsfield AI briefs',
      'Competitor intelligence',
      'Dedicated account management',
      'Monthly executive reports',
    ],
  },
];

const STATS = [
  { value: '70%',    label: 'of Shopify carts are abandoned before checkout' },
  { value: '$18B+',  label: 'in recoverable revenue is lost every year' },
  { value: '3%',     label: 'average recovery rate without automation' },
  { value: '24–31%', label: 'recovery rate with Sales Scales AI sequences' },
];

export default function LandingPage({ onLoginClick }) {

  const s = {
    // Fonts default to system sans — DM Sans loaded via Google Fonts in global.css
    page: { fontFamily: 'DM Sans, sans-serif', color: NAVY, overflowX: 'hidden' },

    // NAV
    nav: {
      position: 'sticky', top: 0, zIndex: 100,
      background: NAVY, borderBottom: `1px solid rgba(255,255,255,0.06)`,
      padding: '0 32px', height: '64px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    logo: { fontSize: '12px', fontWeight: 800, letterSpacing: '4px', color: GOLD, textTransform: 'uppercase' },
    logosub: { fontSize: '8px', color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', marginTop: '2px' },
    navLinks: { display: 'flex', alignItems: 'center', gap: '32px' },
    navLink: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 },
    btnNavLogin: {
      background: 'transparent', border: `1px solid rgba(201,168,76,0.4)`,
      color: GOLD, borderRadius: '8px', padding: '8px 20px',
      fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    },
    btnNavCta: {
      background: GOLD, border: 'none', color: NAVY,
      borderRadius: '8px', padding: '8px 20px',
      fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    },

    // HERO
    hero: {
      background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVYM} 100%)`,
      padding: '96px 32px 80px',
      textAlign: 'center',
    },
    heroLabel: { fontSize: '10px', fontWeight: 700, letterSpacing: '3px', color: GOLD, textTransform: 'uppercase', marginBottom: '20px' },
    heroH1: {
      fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 800, color: WHITE,
      letterSpacing: '-1.5px', lineHeight: 1.1, maxWidth: '860px', margin: '0 auto 22px',
    },
    heroSub: {
      fontSize: '16px', color: 'rgba(255,255,255,0.55)', maxWidth: '560px',
      margin: '0 auto 40px', lineHeight: 1.7,
    },
    heroCtas: { display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' },
    btnPrimary: {
      background: GOLD, color: NAVY, border: 'none', borderRadius: '10px',
      padding: '14px 32px', fontSize: '14px', fontWeight: 800,
      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'none',
      display: 'inline-block',
    },
    btnSecondary: {
      background: 'transparent', color: 'rgba(255,255,255,0.7)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
      padding: '14px 32px', fontSize: '14px', fontWeight: 600,
      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    },
    heroNote: { marginTop: '28px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' },

    // SECTIONS
    section: (bg) => ({ background: bg, padding: '80px 32px' }),
    container: { maxWidth: '1100px', margin: '0 auto' },
    sectionLabel: { fontSize: '9px', fontWeight: 700, letterSpacing: '3px', color: GOLD, textTransform: 'uppercase', marginBottom: '14px' },
    h2: { fontSize: 'clamp(22px, 4vw, 38px)', fontWeight: 800, color: NAVY, letterSpacing: '-0.5px', lineHeight: 1.2 },
    h2white: { fontSize: 'clamp(22px, 4vw, 38px)', fontWeight: 800, color: WHITE, letterSpacing: '-0.5px', lineHeight: 1.2 },
    sub: { fontSize: '15px', color: MUTED, maxWidth: '520px', lineHeight: 1.7, marginTop: '12px' },
    subwhite: { fontSize: '15px', color: 'rgba(255,255,255,0.5)', maxWidth: '520px', lineHeight: 1.7, marginTop: '12px' },

    // STATS
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '48px' },
    statCard: {
      background: WHITE, borderRadius: '12px', padding: '24px',
      border: `1px solid ${BORDER}`, textAlign: 'center',
      boxShadow: '0 1px 4px rgba(10,22,40,0.06)',
    },
    statValue: { fontSize: '32px', fontWeight: 800, color: GOLD, letterSpacing: '-1px' },
    statLabel: { fontSize: '12px', color: MUTED, marginTop: '6px', lineHeight: 1.5 },

    // TEAM
    teamGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '48px' },
    teamCard: {
      background: WHITE, borderRadius: '12px', padding: '22px 24px',
      border: `1px solid ${BORDER}`, display: 'flex', gap: '16px', alignItems: 'flex-start',
      boxShadow: '0 1px 4px rgba(10,22,40,0.06)',
    },
    teamIcon: {
      width: '44px', height: '44px', borderRadius: '10px',
      background: GOLDDIM, border: `1px solid rgba(201,168,76,0.2)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '20px', flexShrink: 0,
    },
    teamName: { fontSize: '14px', fontWeight: 700, color: NAVY, marginBottom: '2px' },
    teamRole: { fontSize: '10px', fontWeight: 600, color: GOLD, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' },
    teamDesc: { fontSize: '12px', color: MUTED, lineHeight: 1.6 },

    // HOW IT WORKS
    stepsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '48px' },
    stepCard: { textAlign: 'center', padding: '24px' },
    stepNum: {
      width: '52px', height: '52px', borderRadius: '50%',
      background: NAVY, color: GOLD,
      fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 18px',
    },
    stepTitle: { fontSize: '16px', fontWeight: 700, color: NAVY, marginBottom: '10px' },
    stepBody: { fontSize: '13px', color: MUTED, lineHeight: 1.7 },

    // PRICING
    pricingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '48px', alignItems: 'start' },
  };

  const PricingCard = ({ plan }) => (
    <div style={{
      background: plan.highlight ? NAVY : WHITE,
      borderRadius: '14px',
      padding: '32px 28px',
      border: plan.highlight ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
      boxShadow: plan.highlight ? '0 12px 40px rgba(10,22,40,0.18)' : '0 1px 4px rgba(10,22,40,0.06)',
      position: 'relative',
    }}>
      {plan.highlight && (
        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: GOLD, color: NAVY, fontSize: '9px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', padding: '4px 14px', borderRadius: '20px' }}>
          Most Popular
        </div>
      )}
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: plan.highlight ? GOLD : MUTED, marginBottom: '12px' }}>{plan.name}</div>
      <div style={{ fontSize: '36px', fontWeight: 800, color: plan.highlight ? WHITE : NAVY, letterSpacing: '-1.5px', marginBottom: '4px' }}>{plan.price}<span style={{ fontSize: '14px', fontWeight: 500, color: plan.highlight ? 'rgba(255,255,255,0.5)' : MUTED }}>/mo</span></div>
      <div style={{ height: '1px', background: plan.highlight ? 'rgba(255,255,255,0.1)' : BORDER, margin: '20px 0' }} />
      <ul style={{ padding: 0, listStyle: 'none', margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {plan.features.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: plan.highlight ? 'rgba(255,255,255,0.8)' : '#4a5568' }}>
            <span style={{ color: GREEN, fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <a href="mailto:yousef@aisalesscales.com" style={{
        display: 'block', textAlign: 'center',
        background: plan.highlight ? GOLD : 'transparent',
        color: plan.highlight ? NAVY : NAVY,
        border: plan.highlight ? 'none' : `2px solid ${NAVY}`,
        borderRadius: '8px', padding: '12px',
        fontSize: '13px', fontWeight: 700, textDecoration: 'none',
      }}>
        Get Started
      </a>
    </div>
  );

  return (
    <div style={s.page}>

      {/* ── NAV ── */}
      <nav style={s.nav}>
        <div>
          <div style={s.logo}>Sales Scales</div>
          <div style={s.logosub}>AI Revenue System</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onLoginClick} style={s.btnNavLogin}>Log In</button>
          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" style={{ ...s.btnNavCta, textDecoration: 'none' }}>Book a Demo</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={s.hero}>
        <div style={s.heroLabel}>AI-Powered Ecommerce Revenue System</div>
        <h1 style={s.heroH1}>
          The AI Revenue System That Recovers Revenue While You Sleep
        </h1>
        <p style={s.heroSub}>
          Six AI specialists — Hussain, Hassan, Ali, Mahdi, Fatima, and Zainab — working 24/7 on your Shopify store. Recovering carts. Closing deals. Growing your list. Automatically.
        </p>
        <div style={s.heroCtas}>
          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" style={s.btnPrimary}>Book a Demo →</a>
          <button onClick={onLoginClick} style={s.btnSecondary}>Sign In to Platform</button>
        </div>
        <div style={s.heroNote}>No setup fees · Cancel anytime · Results in 7 days or less</div>
      </section>

      {/* ── PROBLEM ── */}
      <section style={s.section(BG)}>
        <div style={s.container}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={s.sectionLabel}>The Problem</div>
            <h2 style={s.h2}>70% of Shopify carts are abandoned.<br />Most stores recover nothing.</h2>
            <p style={{ ...s.sub, margin: '12px auto 0', textAlign: 'center' }}>
              Your customers leave at checkout every single day. Without the right automation, that revenue is gone forever. Sales Scales exists to change that.
            </p>
          </div>
          <div style={s.statsGrid}>
            {STATS.map(stat => (
              <div key={stat.value} style={s.statCard}>
                <div style={s.statValue}>{stat.value}</div>
                <div style={s.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUTION / TEAM ── */}
      <section style={s.section(WHITE)}>
        <div style={s.container}>
          <div style={s.sectionLabel}>Your AI Team</div>
          <h2 style={s.h2}>Six specialists. One system.<br />Working for your store 24/7.</h2>
          <p style={s.sub}>Every member of your AI team has a specific job. Together they cover every part of your revenue cycle — from outreach to recovery to retention.</p>
          <div style={s.teamGrid}>
            {TEAM.map(member => (
              <div key={member.name} style={s.teamCard}>
                <div style={s.teamIcon}>{member.icon}</div>
                <div>
                  <div style={s.teamName}>{member.name}</div>
                  <div style={s.teamRole}>{member.role}</div>
                  <div style={s.teamDesc}>{member.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={s.section(BG)}>
        <div style={s.container}>
          <div style={{ textAlign: 'center' }}>
            <div style={s.sectionLabel}>How It Works</div>
            <h2 style={s.h2}>Three steps from signup to revenue.</h2>
          </div>
          <div style={s.stepsGrid}>
            {STEPS.map(step => (
              <div key={step.n} style={s.stepCard}>
                <div style={s.stepNum}>{step.n}</div>
                <div style={s.stepTitle}>{step.title}</div>
                <div style={s.stepBody}>{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={s.section(WHITE)}>
        <div style={s.container}>
          <div style={{ textAlign: 'center' }}>
            <div style={s.sectionLabel}>Pricing</div>
            <h2 style={s.h2}>Simple, transparent pricing.<br />No hidden fees.</h2>
            <p style={{ ...s.sub, margin: '12px auto 0', textAlign: 'center' }}>
              Every plan includes the full AI team. Pick the level of automation and support that fits your store.
            </p>
          </div>
          <div style={s.pricingGrid}>
            {PLANS.map(plan => <PricingCard key={plan.name} plan={plan} />)}
          </div>
          <div style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: MUTED }}>
            All plans are month-to-month. Email <a href="mailto:yousef@aisalesscales.com" style={{ color: GOLD }}>yousef@aisalesscales.com</a> to get started.
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ ...s.section(NAVY), textAlign: 'center' }}>
        <div style={s.container}>
          <div style={s.sectionLabel}>Ready to start?</div>
          <h2 style={s.h2white}>Your AI team is ready to go to work.</h2>
          <p style={{ ...s.subwhite, margin: '12px auto 32px', textAlign: 'center' }}>
            Book a 20-minute demo and see exactly how Sales Scales will work for your store — specific sequences, projections, and AI team walkthrough included.
          </p>
          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" style={s.btnPrimary}>Book a Demo →</a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#070e1c', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '4px', color: GOLD, textTransform: 'uppercase', marginBottom: '12px' }}>Sales Scales</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <a href="https://aisalesscales.com" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>aisalesscales.com</a>
          <a href="mailto:yousef@aisalesscales.com" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>yousef@aisalesscales.com</a>
          <a href="/terms" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Terms</a>
          <a href="/privacy" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Privacy</a>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Sales Scales. All rights reserved.</div>
      </footer>

    </div>
  );
}
