import React, { useState, useEffect } from 'react';

const CALENDLY_URL = 'https://calendly.com/y2005funnels/new-meeting';

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

const PERFORMANCE_FEE_NOTE = '+ 10% of revenue the platform recovers for your store';

const PLANS = [
  {
    name: 'Starter',
    price: '$199',
    sub: 'Email sequences only',
    highlight: false,
    features: [
      'Email sequences & automation',
      'Unlimited contacts',
      'Cart recovery sequences',
      'CRM & contact management',
      'AI team — Hussain, Zainab, Fatima',
      'Monthly analytics report',
    ],
  },
  {
    name: 'Growth',
    price: '$299',
    sub: 'Email + SMS',
    highlight: true,
    features: [
      'Everything in Starter',
      'SMS sequences & automation',
      'Unlimited contacts & sequences',
      'Full AI team — all 6 members',
      'Klaviyo, Meta Ads & HubSpot sync',
      'Weekly strategy briefs',
    ],
  },
  {
    name: 'Scale',
    price: '$399',
    sub: 'Email + SMS + WhatsApp + Calls',
    highlight: false,
    features: [
      'Everything in Growth',
      'WhatsApp automation',
      'Voice AI agents — outbound calls',
      'Shopify live data sync',
      'Canva & Higgsfield AI briefs',
      'Competitor intelligence',
    ],
  },
];

const STATS = [
  { value: '70%',    label: 'of Shopify carts are abandoned before checkout' },
  { value: '$18B+',  label: 'in recoverable revenue is lost every year' },
  { value: '3%',     label: 'average recovery rate without automation' },
  { value: '24–31%', label: 'recovery rate with Sales Scales AI sequences' },
];

const FAQS = [
  {
    q: 'What is Sales Scales?',
    a: 'Sales Scales is an AI-powered revenue system for ecommerce brands built on Shopify. You get a team of six AI specialists — Hussain, Hassan, Ali, Mahdi, Fatima, and Zainab — who work 24/7 to recover abandoned carts, run email and SMS sequences, close deals, and manage client relationships automatically.',
  },
  {
    q: 'How does it work?',
    a: 'Connect your Shopify store in one click. Your AI team immediately pulls your product catalogue, order history, and abandoned checkouts. Within 24 hours, Mahdi writes your sequences, Fatima configures the workflows, and Hussain generates your first strategic briefing. Revenue recovery starts in the first week.',
  },
  {
    q: 'How long until I see results?',
    a: 'Most clients see their first recovered cart within 24–48 hours of going live. Measurable uplift in monthly recurring revenue typically appears within the first 7–14 days as sequences warm up and send volume increases. Full compounding effect shows by month two.',
  },
  {
    q: 'What platforms do you integrate with?',
    a: 'Sales Scales integrates natively with Shopify (cart recovery, order events, customer sync), Klaviyo (email performance), Meta Ads (ad spend and ROAS), HubSpot CRM, Twilio (SMS and WhatsApp), SendGrid (email delivery), Canva, ElevenLabs (voice agents), and Calendly.',
  },
  {
    q: 'What happens if I cancel?',
    a: 'All plans are month-to-month with no long-term commitment. If you cancel, your sequences stop immediately and you retain all contacts and data. There are no cancellation fees, no notice period required, and no penalties. We believe in earning your business every month.',
  },
  {
    q: 'Is my customer data safe?',
    a: 'Yes. All data is stored in encrypted Supabase (PostgreSQL) databases hosted in secure cloud infrastructure. We never sell customer data, never share it with third parties, and each client\'s data is strictly isolated. We are GDPR-compliant and provide data export and deletion on request.',
  },
];

const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Sales Scales',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'AI-powered revenue system for ecommerce brands. Six AI specialists recover abandoned carts, run email and SMS sequences, and manage client relationships automatically.',
  url: 'https://aisalesscales.com',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '997',
    highPrice: '2997',
    priceCurrency: 'USD',
    offerCount: '3',
  },
  provider: {
    '@type': 'Organization',
    name: 'Sales Scales',
    url: 'https://aisalesscales.com',
    email: 'yousef@aisalesscales.com',
  },
});

// Fix 2: GA4 pageview helper — fires when the landing page loads
// Replace 'G-XXXXXXXXXX' in public/index.html with your real Measurement ID
const trackPageview = (path) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', { page_path: path });
  }
};

export default function LandingPage({ onLoginClick }) {
  const [openFaq, setOpenFaq] = useState(null);
  const CONSENT_KEY = 'ss_cookie_consent';
  const [cookieConsent, setCookieConsent] = useState(() => localStorage.getItem(CONSENT_KEY));

  useEffect(() => {
    if (cookieConsent === 'accepted' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
  }, [cookieConsent]);

  const handleConsent = (choice) => {
    localStorage.setItem(CONSENT_KEY, choice);
    setCookieConsent(choice);
    if (choice === 'accepted' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
  };

  // Track landing page view on mount — useEffect is imported at top via React, useState above
  React.useEffect(() => { if (cookieConsent === 'accepted') trackPageview('/'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fix 1: inject Calendly widget script for inline embed
  useEffect(() => {
    if (document.querySelector('script[src*="calendly.com/assets/external/widget.js"]')) return;
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: plan.highlight ? GOLD : MUTED, marginBottom: '6px' }}>{plan.name}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#4a5568', marginBottom: '14px' }}>{plan.sub}</div>
      <div style={{ fontSize: '36px', fontWeight: 800, color: plan.highlight ? WHITE : NAVY, letterSpacing: '-1.5px', marginBottom: '6px' }}>{plan.price}<span style={{ fontSize: '14px', fontWeight: 500, color: plan.highlight ? 'rgba(255,255,255,0.5)' : MUTED }}>/mo</span></div>
      <div style={{ background: plan.highlight ? 'rgba(201,168,76,0.12)' : '#fffbeb', border: `1px solid ${plan.highlight ? 'rgba(201,168,76,0.25)' : '#fde68a'}`, borderRadius: '7px', padding: '7px 12px', marginBottom: '16px', fontSize: '11px', color: plan.highlight ? 'rgba(201,168,76,0.9)' : '#92400e', fontWeight: 600, lineHeight: 1.5 }}>
        {PERFORMANCE_FEE_NOTE}
      </div>
      <div style={{ height: '1px', background: plan.highlight ? 'rgba(255,255,255,0.1)' : BORDER, margin: '14px 0' }} />
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
      {/* JSON-LD structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />

      {/* ── NAV ── */}
      <nav style={s.nav}>
        <div>
          <div style={s.logo}>Sales Scales</div>
          <div style={s.logosub}>AI Revenue System</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={s.navLinks}>
            {[['how-it-works', 'How It Works'], ['pricing', 'Pricing'], ['faq', 'FAQ']].map(([id, label]) => (
              <span key={id} onClick={() => scrollTo(id)} style={s.navLink}>{label}</span>
            ))}
          </div>
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

      {/* ── CALENDLY INLINE EMBED ── */}
      {/* ── CALENDLY INLINE BOOKING ── */}
      <section style={{ background: NAVY, padding: '72px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', color: GOLD, textTransform: 'uppercase', marginBottom: '16px' }}>Book a Call</div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: WHITE, marginBottom: '12px', letterSpacing: '-0.5px' }}>
            See Sales Scales in Action
          </h2>
          <p style={{ fontSize: '15px', color: MUTED, marginBottom: '32px', maxWidth: 520, margin: '0 auto 32px' }}>
            Pick a time and we'll walk you through exactly how your AI team recovers revenue from day one.
          </p>
          {/* Calendly inline widget — loads via script tag injected in useEffect */}
          <div
            className="calendly-inline-widget"
            data-url={CALENDLY_URL}
            style={{ minWidth: 320, height: 700, borderRadius: 16, overflow: 'hidden' }}
          />
        </div>
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
      <section id="how-it-works" style={s.section(BG)}>
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
      <section id="pricing" style={s.section(WHITE)}>
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

      {/* ── FAQ ── */}
      <section id="faq" style={s.section(BG)}>
        <div style={s.container}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={s.sectionLabel}>FAQ</div>
            <h2 style={s.h2}>Everything you need to know.</h2>
            <p style={{ ...s.sub, margin: '12px auto 0', textAlign: 'center' }}>Can't find the answer you're looking for? Email <a href="mailto:yousef@aisalesscales.com" style={{ color: GOLD }}>yousef@aisalesscales.com</a></p>
          </div>
          <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{ background: WHITE, border: `1px solid ${isOpen ? GOLD : BORDER}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.2s', boxShadow: isOpen ? '0 4px 16px rgba(10,22,40,0.08)' : '0 1px 3px rgba(10,22,40,0.04)' }}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: NAVY }}>{faq.q}</span>
                    <span style={{ fontSize: '18px', color: isOpen ? GOLD : MUTED, transition: 'transform 0.2s, color 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none', flexShrink: 0, marginLeft: '16px' }}>+</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 24px 20px', fontSize: '14px', color: MUTED, lineHeight: 1.8, borderTop: `1px solid ${BORDER}`, paddingTop: '16px', marginTop: 0 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
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
          <a href="/roadmap" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Roadmap</a>
          <a href="/terms" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Terms</a>
          <a href="/privacy" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Privacy</a>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Sales Scales. All rights reserved.</div>
      </footer>

      {/* Cookie consent banner */}
      {!cookieConsent && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, background: '#0a1628', borderTop: '1px solid rgba(201,168,76,0.3)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', fontFamily: 'DM Sans, Arial, sans-serif' }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5', flex: '1 1 300px' }}>
            We use cookies to improve your experience and analyze site traffic.
          </div>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button onClick={() => handleConsent('declined')} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, Arial, sans-serif' }}>Decline</button>
            <button onClick={() => handleConsent('accepted')} style={{ padding: '8px 18px', background: '#c9a84c', border: 'none', borderRadius: '8px', color: '#0a1628', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, Arial, sans-serif' }}>Accept</button>
          </div>
        </div>
      )}
    </div>
  );
}
