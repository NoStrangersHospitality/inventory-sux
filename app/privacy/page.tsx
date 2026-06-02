export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
            <span style={{ color: '#000' }}>Inventory</span>
            <span style={{ color: '#F5B800' }}>Sux</span>
          </div>
        </a>
        <a href="/auth/login" style={{ fontSize: '13px', color: '#555', textDecoration: 'none' }}>Back to App</a>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px 80px' }}>

        <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#000', marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '40px' }}>Effective Date: June 2, 2026 · Inventory Sux LLC</p>

        <div style={{ fontSize: '15px', color: '#333', lineHeight: '1.8' }}>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>1. Introduction</h2>
            <p>Inventory Sux LLC ("Inventory Sux," "we," "our," or "us") operates the Inventory Sux platform, a bar and restaurant management software service accessible at inventorysux.com and app.inventorysux.com (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. By accessing or using Inventory Sux, you agree to the terms of this Privacy Policy.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>2. Information We Collect</h2>
            <p style={{ marginBottom: '12px' }}><strong>Account Information.</strong> When you create an account, we collect your name, email address, establishment name, and a password. You may also provide additional profile information such as your role or contact details.</p>
            <p style={{ marginBottom: '12px' }}><strong>Business and Operational Data.</strong> As part of using the Service, you may input and store business data including inventory items, distributor information, order history, invoices, recipes, and cost data. This data belongs to you and is stored on your behalf.</p>
            <p style={{ marginBottom: '12px' }}><strong>Billing Information.</strong> When you subscribe to a paid plan, payment information is collected and processed by our third-party payment processor, Stripe. We do not store your credit card number or full payment details on our servers.</p>
            <p style={{ marginBottom: '12px' }}><strong>Communications Data.</strong> If you use our ordering features, we may process email and SMS communications sent on your behalf to distributors. Replies from distributors may be received and stored within your account.</p>
            <p><strong>Usage Data.</strong> We may automatically collect certain technical information when you use the Service, including your IP address, browser type, device information, pages visited, and timestamps. This data is used to maintain and improve the Service.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>3. How We Use Your Information</h2>
            <p style={{ marginBottom: '8px' }}>We use the information we collect to:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
              <li style={{ marginBottom: '6px' }}>Provide, operate, and maintain the Service</li>
              <li style={{ marginBottom: '6px' }}>Process transactions and send related information including purchase confirmations</li>
              <li style={{ marginBottom: '6px' }}>Send transactional emails and SMS messages on your behalf to distributors you designate</li>
              <li style={{ marginBottom: '6px' }}>Send administrative communications such as account notifications, security alerts, and support messages</li>
              <li style={{ marginBottom: '6px' }}>Respond to your comments, questions, and support requests</li>
              <li style={{ marginBottom: '6px' }}>Monitor and analyze usage patterns to improve the Service</li>
              <li style={{ marginBottom: '6px' }}>Detect and prevent fraudulent transactions and other illegal activities</li>
              <li style={{ marginBottom: '6px' }}>Comply with legal obligations</li>
            </ul>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>4. How We Share Your Information</h2>
            <p style={{ marginBottom: '12px' }}>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
            <p style={{ marginBottom: '12px' }}><strong>Service Providers.</strong> We share information with trusted third-party vendors who assist us in operating the Service, subject to confidentiality obligations. These include:</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
              <li style={{ marginBottom: '6px' }}><strong>Supabase</strong> — database hosting and storage</li>
              <li style={{ marginBottom: '6px' }}><strong>Stripe</strong> — payment processing</li>
              <li style={{ marginBottom: '6px' }}><strong>SendGrid</strong> — transactional email delivery</li>
              <li style={{ marginBottom: '6px' }}><strong>Twilio</strong> — SMS messaging</li>
            </ul>
            <p style={{ marginBottom: '12px' }}><strong>Legal Requirements.</strong> We may disclose your information if required by law, subpoena, or other legal process, or if we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.</p>
            <p><strong>Business Transfers.</strong> In the event of a merger, acquisition, or sale of all or a portion of our assets, your information may be transferred as part of that transaction. We will notify you via email or a prominent notice on the Service of any such change.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>5. Data Retention</h2>
            <p>We retain your account and business data for as long as your account is active or as needed to provide the Service. If you cancel your account, we will retain your data for a period of 30 days to allow for reactivation, after which it will be deleted from our systems. Certain records may be retained longer as required by law or for legitimate business purposes such as dispute resolution.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>6. Data Security</h2>
            <p>We implement reasonable administrative, technical, and physical security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. These measures include encrypted data transmission (TLS), row-level security on our database, and access controls. However, no method of transmission over the internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>7. Your Rights and Choices</h2>
            <p style={{ marginBottom: '12px' }}>You have the following rights with respect to your information:</p>
            <ul style={{ paddingLeft: '20px' }}>
              <li style={{ marginBottom: '6px' }}><strong>Access.</strong> You may access and update your account information at any time through your account settings.</li>
              <li style={{ marginBottom: '6px' }}><strong>Deletion.</strong> You may request deletion of your account and associated data by contacting us at contact@inventorysux.com.</li>
              <li style={{ marginBottom: '6px' }}><strong>Portability.</strong> You may export your inventory and order data using the CSV export features within the Service.</li>
              <li style={{ marginBottom: '6px' }}><strong>Opt-Out.</strong> You may opt out of non-essential communications by contacting us. Note that transactional and account-related messages are necessary for the operation of the Service.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>8. Cookies and Tracking</h2>
            <p>We use session cookies and local storage to maintain your authenticated session and remember your preferences. We do not use third-party advertising cookies or tracking pixels. You may disable cookies in your browser settings, but doing so may affect your ability to use certain features of the Service.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>9. Children's Privacy</h2>
            <p>The Service is intended for use by business operators and is not directed to individuals under the age of 18. We do not knowingly collect personal information from anyone under 18. If you believe we have inadvertently collected such information, please contact us and we will promptly delete it.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the effective date. Your continued use of the Service after such changes constitutes your acceptance of the updated policy.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>11. Governing Law</h2>
            <p>This Privacy Policy is governed by the laws of the State of Indiana, without regard to its conflict of law provisions.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>12. Contact Us</h2>
            <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
            <div style={{ marginTop: '12px', padding: '16px 20px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '14px' }}>
              <strong>Inventory Sux LLC</strong><br />
              <a href="mailto:contact@inventorysux.com" style={{ color: '#F5B800', textDecoration: 'none' }}>contact@inventorysux.com</a>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
