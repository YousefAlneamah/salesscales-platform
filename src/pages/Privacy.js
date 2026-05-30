import React from 'react';

const EFFECTIVE = 'June 1, 2025';
const EMAIL = 'privacy@salesscales.com';

const S = ({ title, children }) => (
  <div style={{ marginBottom: '32px' }}>
    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a1628', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #e4e9f0' }}>{title}</div>
    <div style={{ fontSize: '13px', color: '#4a5568', lineHeight: '1.8' }}>{children}</div>
  </div>
);

const P = ({ children }) => <p style={{ margin: '0 0 10px' }}>{children}</p>;

const Li = ({ children }) => (
  <li style={{ marginBottom: '6px', paddingLeft: '4px' }}>{children}</li>
);

export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: '#f0f3f8', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0a1628', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '4px', color: '#c9a84c' }}>SALES SCALES</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Privacy Policy</div>
          </div>
          <button onClick={() => window.close() || window.history.back()}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '7px 16px', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            ← Back
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ background: 'white', borderRadius: '14px', padding: '44px 48px', boxShadow: '0 1px 4px rgba(10,22,40,0.08)' }}>

          <div style={{ marginBottom: '36px' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '8px' }}>Privacy Policy</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>Effective date: {EFFECTIVE} · Last updated: {EFFECTIVE}</div>
          </div>

          <S title="1. Introduction">
            <P>Sales Scales ("we", "us", or "our") is committed to protecting your privacy and the privacy of your customers' data. This Privacy Policy explains how we collect, use, store, and protect information when you use our AI-powered revenue automation platform (the "Service").</P>
            <P>By using the Service, you agree to the collection and use of information as described in this policy. This policy applies to Sales Scales clients and their authorised users.</P>
          </S>

          <S title="2. Information We Collect">
            <P><strong>Account information:</strong> Name, email address, company name, and billing information provided during registration.</P>
            <P><strong>Business data you provide:</strong> Store URL, revenue ranges, product information, brand voice settings, target customer profiles, and marketing goals entered during onboarding and account configuration.</P>
            <P><strong>Shopify store data:</strong> When you connect your Shopify store, we access orders, customers, products, abandoned checkouts, and store analytics — solely to operate the Service on your behalf.</P>
            <P><strong>Contact data:</strong> Your customers' names, email addresses, phone numbers, and purchase history synced from your Shopify store or uploaded to the CRM.</P>
            <P><strong>Usage data:</strong> How you interact with the platform, features used, pages visited, and action timestamps.</P>
            <P><strong>Legal consent records:</strong> When you accept these terms, we record your IP address and the timestamp for legal compliance purposes.</P>
            <P><strong>Communications metadata:</strong> Records of emails, SMS, and WhatsApp messages sent through the platform, including delivery status and engagement data.</P>
          </S>

          <S title="3. How We Use Your Information">
            <P>We use your information to:</P>
            <ul style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
              <Li>Provide, operate, and improve the Service</Li>
              <Li>Generate AI-powered marketing content and sequences tailored to your brand</Li>
              <Li>Sync and manage your customer contacts and purchase data</Li>
              <Li>Send automated marketing messages on your behalf to your customers</Li>
              <Li>Generate analytics, reports, and performance insights</Li>
              <Li>Provide customer support and respond to enquiries</Li>
              <Li>Detect and prevent fraud, abuse, and security incidents</Li>
              <Li>Comply with legal obligations</Li>
            </ul>
            <P>We do not sell your data or your customers' data to third parties. We do not use your data to train AI models for any purpose other than providing the Service to you.</P>
          </S>

          <S title="4. Shopify Data Access">
            <P>When you connect your Shopify store via OAuth, we request the following permissions:</P>
            <ul style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
              <Li><strong>Read customers:</strong> To sync contact information and purchase history</Li>
              <Li><strong>Read orders:</strong> To track revenue, identify abandoned carts, and trigger post-purchase sequences</Li>
              <Li><strong>Read products:</strong> To personalise marketing content with your product names and details</Li>
              <Li><strong>Read analytics:</strong> To generate revenue recovery and performance reports</Li>
              <Li><strong>Write checkouts:</strong> To track and trigger cart abandonment workflows</Li>
            </ul>
            <P>We access Shopify data only as needed to operate the Service. Your Shopify access tokens are stored encrypted and are never shared with third parties outside of the Shopify integration. You may disconnect your Shopify store at any time from the Settings page, at which point we cease accessing your store data.</P>
            <P>Sales Scales is an independent service and is not affiliated with, endorsed, or sponsored by Shopify Inc.</P>
          </S>

          <S title="5. Third-Party Services">
            <P>The Service integrates with the following third-party providers to deliver its functionality. Each is subject to its own privacy policy:</P>
            <ul style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
              <Li><strong>Anthropic (Claude AI):</strong> Processes prompts to generate marketing content and AI team responses. Data sent to Anthropic is subject to their usage policies.</Li>
              <Li><strong>OpenAI:</strong> Used for generating document embeddings for the knowledge base search feature.</Li>
              <Li><strong>Twilio:</strong> Delivers SMS and WhatsApp messages to your customers.</Li>
              <Li><strong>SendGrid:</strong> Delivers email messages to your customers.</Li>
              <Li><strong>ElevenLabs:</strong> Powers AI voice agent functionality.</Li>
              <Li><strong>Supabase:</strong> Hosts and manages the database that stores your account and operational data. Supabase is GDPR-compliant and stores data on infrastructure in your selected region.</Li>
              <Li><strong>Klaviyo, Meta Ads, HubSpot:</strong> Integrated on your instruction and subject to their respective privacy policies.</Li>
            </ul>
          </S>

          <S title="6. GDPR and Data Subject Rights">
            <P>If you or your customers are located in the European Economic Area (EEA), the UK, or other jurisdictions with similar data protection laws, the following rights apply:</P>
            <ul style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
              <Li><strong>Right of access:</strong> You may request a copy of the personal data we hold about you.</Li>
              <Li><strong>Right to rectification:</strong> You may request correction of inaccurate data.</Li>
              <Li><strong>Right to erasure:</strong> You may request deletion of your personal data, subject to legal obligations.</Li>
              <Li><strong>Right to restrict processing:</strong> You may request that we limit how we use your data in certain circumstances.</Li>
              <Li><strong>Right to data portability:</strong> You may request your data in a machine-readable format.</Li>
              <Li><strong>Right to object:</strong> You may object to processing of your data for direct marketing or other purposes.</Li>
            </ul>
            <P>To exercise any of these rights, contact us at {EMAIL}. We will respond within 30 days.</P>
            <P><strong>Legal basis for processing:</strong> We process your data on the basis of (a) contract performance — to deliver the Service you subscribed to; (b) legitimate interests — to operate, improve, and secure the Service; and (c) legal obligation — to comply with applicable law.</P>
            <P><strong>Data transfers:</strong> Your data may be processed by our service providers in countries outside your own. Where required, we implement appropriate safeguards such as standard contractual clauses.</P>
          </S>

          <S title="7. Your Customers' Data">
            <P>As a Sales Scales client, you are the data controller for your customers' personal data. We act as a data processor on your behalf. You are responsible for:</P>
            <ul style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
              <Li>Ensuring you have a lawful basis to share your customers' data with us</Li>
              <Li>Providing appropriate notices to your customers about automated marketing</Li>
              <Li>Honouring unsubscribe requests and data deletion requests from your customers</Li>
              <Li>Complying with applicable laws governing direct marketing (including GDPR, CAN-SPAM, CASL)</Li>
            </ul>
            <P>We will process your customers' data only as instructed by you through the platform and will not use it for any purpose unrelated to providing the Service.</P>
          </S>

          <S title="8. Data Retention">
            <P>We retain your account and operational data for as long as your account is active. After account cancellation:</P>
            <ul style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
              <Li>Operational data (contacts, messages, workflows, enrollments) is retained for 90 days and then deleted</Li>
              <Li>Legal records (contracts, billing history, terms acceptance) are retained for 7 years for compliance purposes</Li>
              <Li>You may request earlier deletion of operational data by contacting {EMAIL}</Li>
            </ul>
          </S>

          <S title="9. Security">
            <P>We implement industry-standard security measures to protect your data, including:</P>
            <ul style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
              <Li>Encrypted storage of all sensitive credentials and access tokens</Li>
              <Li>TLS/HTTPS encryption for all data in transit</Li>
              <Li>Access controls limiting employee access to customer data</Li>
              <Li>Regular security reviews of our infrastructure</Li>
            </ul>
            <P>While we take reasonable precautions, no method of transmission or storage is 100% secure. In the event of a data breach affecting your data, we will notify you as required by applicable law.</P>
          </S>

          <S title="10. Cookies and Tracking">
            <P>The Sales Scales platform uses functional cookies necessary for the Service to operate (session management, authentication). We do not use third-party tracking or advertising cookies.</P>
          </S>

          <S title="11. Children's Privacy">
            <P>The Service is not directed to individuals under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has provided us with personal data, contact us at {EMAIL}.</P>
          </S>

          <S title="12. Changes to This Policy">
            <P>We may update this Privacy Policy from time to time. We will notify you of material changes via email or a notice in the platform at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the updated policy.</P>
          </S>

          <S title="13. Contact and Data Protection Officer">
            <P>For privacy enquiries, data subject requests, or concerns about how we handle your data, contact us at:</P>
            <P><strong>Sales Scales — Privacy Team</strong><br />Email: {EMAIL}<br />Response time: within 30 calendar days</P>
          </S>

          <div style={{ borderTop: '1px solid #e4e9f0', paddingTop: '24px', fontSize: '11px', color: '#8896a8' }}>
            © {new Date().getFullYear()} Sales Scales. All rights reserved. This Privacy Policy was last updated on {EFFECTIVE}.
          </div>
        </div>
      </div>
    </div>
  );
}
