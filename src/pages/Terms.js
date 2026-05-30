import React from 'react';

const EFFECTIVE = 'June 1, 2025';
const COMPANY = 'Sales Scales';
const EMAIL = 'legal@salesscales.com';

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

export default function Terms() {
  return (
    <div style={{ minHeight: '100vh', background: '#f0f3f8', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0a1628', padding: '0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '4px', color: '#c9a84c' }}>SALES SCALES</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Terms of Service</div>
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
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#0a1628', letterSpacing: '-0.5px', marginBottom: '8px' }}>Terms of Service</div>
            <div style={{ fontSize: '12px', color: '#8896a8' }}>Effective date: {EFFECTIVE} · Last updated: {EFFECTIVE}</div>
          </div>

          <S title="1. Agreement to Terms">
            <P>By accessing or using Sales Scales (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.</P>
            <P>These Terms constitute a legally binding agreement between you ("Client", "you", or "your") and {COMPANY} ("we", "us", or "our"). Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference.</P>
          </S>

          <S title="2. Description of Service">
            <P>Sales Scales is an AI-powered revenue automation platform for ecommerce businesses. The Service includes:</P>
            <ul style={{ paddingLeft: '20px', margin: '0' }}>
              <Li>AI-generated email, SMS, and WhatsApp marketing sequences</Li>
              <Li>Automated workflow and contact management</Li>
              <Li>Shopify store integration and data synchronisation</Li>
              <Li>AI team members (Hussain, Hassan, Ali, Mahdi, Fatima, and Zainab) for strategy, content, outreach, and client support</Li>
              <Li>Analytics, reporting, and revenue tracking</Li>
              <Li>Voice AI agents and call automation</Li>
              <Li>CRM and pipeline management tools</Li>
            </ul>
          </S>

          <S title="3. Account Registration and Security">
            <P>To access the Service, you must create an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.</P>
            <P>You must notify us immediately at {EMAIL} if you suspect any unauthorised access to your account. We are not liable for any loss arising from your failure to keep your credentials secure.</P>
          </S>

          <S title="4. Acceptable Use">
            <P>You agree not to use the Service to:</P>
            <ul style={{ paddingLeft: '20px', margin: '0' }}>
              <Li>Send unsolicited commercial messages in violation of applicable anti-spam laws (including CAN-SPAM, CASL, and GDPR)</Li>
              <Li>Violate any applicable law, regulation, or third-party rights</Li>
              <Li>Transmit false, misleading, or fraudulent content to your customers</Li>
              <Li>Attempt to reverse-engineer, decompile, or extract source code from the platform</Li>
              <Li>Abuse, overload, or interfere with the platform's infrastructure</Li>
              <Li>Share access credentials with unauthorised parties</Li>
            </ul>
            <P>We reserve the right to suspend or terminate accounts that violate these terms at our sole discretion.</P>
          </S>

          <S title="5. AI-Generated Content">
            <P>The Service uses artificial intelligence to generate marketing content, including emails, SMS messages, WhatsApp messages, and strategic recommendations. You acknowledge that:</P>
            <ul style={{ paddingLeft: '20px', margin: '0' }}>
              <Li>AI-generated content is provided for your review and approval before deployment</Li>
              <Li>You are solely responsible for reviewing, approving, and taking responsibility for any content sent to your customers</Li>
              <Li>We do not guarantee specific outcomes or results from AI-generated content</Li>
              <Li>AI content should be reviewed for accuracy and compliance with your industry regulations before use</Li>
            </ul>
          </S>

          <S title="6. Shopify and Third-Party Integrations">
            <P>The Service integrates with third-party platforms including Shopify, Klaviyo, Meta Ads, HubSpot, ElevenLabs, Twilio, and SendGrid. By connecting these integrations, you:</P>
            <ul style={{ paddingLeft: '20px', margin: '0' }}>
              <Li>Authorise us to access the data and functionality you grant via OAuth or API keys</Li>
              <Li>Acknowledge that each integration is subject to the respective platform's terms and privacy policy</Li>
              <Li>Remain responsible for compliance with the terms of each third-party service</Li>
              <Li>Understand that we access your Shopify store data (orders, customers, products, abandoned checkouts) solely to operate the Service on your behalf</Li>
            </ul>
          </S>

          <S title="7. Data Ownership and Intellectual Property">
            <P><strong>Your data:</strong> All customer data, store data, and business information you bring to the platform remains your property. We process it solely to provide the Service.</P>
            <P><strong>Our platform:</strong> The Service, including the AI models, workflows, software, interfaces, and methodologies, is our proprietary property and protected by intellectual property laws.</P>
            <P><strong>AI outputs:</strong> Content generated by the AI on your behalf (emails, sequences, reports) is owned by you once approved and deployed.</P>
          </S>

          <S title="8. Payment Terms">
            <P>The Service is billed monthly in advance. Fees are non-refundable except as required by law or as explicitly stated in your service agreement. We reserve the right to suspend access for accounts with overdue balances exceeding 15 calendar days.</P>
            <P>Prices are subject to change with 30 days written notice. Continued use of the Service after a price change constitutes acceptance of the new pricing.</P>
          </S>

          <S title="9. Confidentiality">
            <P>Each party agrees to keep confidential all non-public information received from the other party and to use it only for the purpose of this agreement. This obligation survives termination of the agreement indefinitely.</P>
          </S>

          <S title="10. Disclaimer of Warranties">
            <P>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</P>
            <P>We do not warrant that the Service will be uninterrupted, error-free, or that specific results will be achieved from its use. Marketing results depend on many factors outside our control.</P>
          </S>

          <S title="11. Limitation of Liability">
            <P>TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE CLAIM.</P>
            <P>IN NO EVENT SHALL WE BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</P>
          </S>

          <S title="12. Termination">
            <P>Either party may terminate this agreement with 30 days written notice. We may terminate immediately for material breach, non-payment exceeding 15 days, or violations of the Acceptable Use policy.</P>
            <P>Upon termination, your access will be suspended and your data will be retained for 90 days before deletion, unless you request earlier deletion in writing.</P>
          </S>

          <S title="13. Governing Law and Disputes">
            <P>These Terms are governed by the laws of Kuwait. Any dispute that cannot be resolved amicably shall be submitted to binding arbitration in Kuwait City, Kuwait, under the rules of the Kuwait Chamber of Commerce.</P>
          </S>

          <S title="14. Changes to These Terms">
            <P>We may update these Terms from time to time. We will provide notice of material changes via email or a prominent notice in the platform at least 14 days before the changes take effect. Continued use of the Service after the effective date constitutes acceptance of the updated Terms.</P>
          </S>

          <S title="15. Contact">
            <P>For questions about these Terms, contact us at:</P>
            <P><strong>Sales Scales</strong><br />Email: {EMAIL}<br />Support: support@salesscales.com</P>
          </S>

          <div style={{ borderTop: '1px solid #e4e9f0', paddingTop: '24px', fontSize: '11px', color: '#8896a8' }}>
            © {new Date().getFullYear()} Sales Scales. All rights reserved. These Terms of Service were last updated on {EFFECTIVE}.
          </div>
        </div>
      </div>
    </div>
  );
}
