export default function TermsOfService() {
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

        <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#000', marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '40px' }}>Effective Date: June 2, 2025 · Inventory Sux LLC</p>

        <div style={{ fontSize: '15px', color: '#333', lineHeight: '1.8' }}>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>1. Acceptance of Terms</h2>
            <p>These Terms of Service ("Terms") constitute a legally binding agreement between you and Inventory Sux LLC ("Inventory Sux," "we," "our," or "us") governing your access to and use of the Inventory Sux platform, including all related websites, applications, and services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>2. Eligibility</h2>
            <p>You must be at least 18 years of age and have the legal authority to enter into binding contracts to use the Service. By using the Service, you represent and warrant that you meet these requirements. If you are using the Service on behalf of a business entity, you represent that you have authority to bind that entity to these Terms.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>3. Account Registration</h2>
            <p style={{ marginBottom: '12px' }}>To access the Service, you must create an account by providing accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to notify us immediately at contact@inventorysux.com of any unauthorized use of your account.</p>
            <p>We reserve the right to suspend or terminate accounts that contain false information, violate these Terms, or have been inactive for an extended period with no active subscription.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>4. Subscription Plans and Payment</h2>
            <p style={{ marginBottom: '12px' }}><strong>Plans.</strong> Inventory Sux offers subscription-based access to the Service. Current plans include a Front of House (FOH) plan and an optional Back of House (BOH) add-on. Pricing is displayed at the time of purchase and may be updated with notice.</p>
            <p style={{ marginBottom: '12px' }}><strong>Free Trial.</strong> We may offer a free trial period for new accounts. At the end of the trial, your account will require a paid subscription to continue accessing the Service. We reserve the right to modify or discontinue trial offers at any time.</p>
            <p style={{ marginBottom: '12px' }}><strong>Billing.</strong> Subscriptions are billed on a monthly basis. By providing a payment method, you authorize us to charge the applicable subscription fee through our payment processor, Stripe. All fees are non-refundable except as required by law or as explicitly stated in these Terms.</p>
            <p style={{ marginBottom: '12px' }}><strong>Failed Payments.</strong> If a payment fails, your account may be downgraded or suspended until payment is resolved. We will attempt to notify you via email before suspending access.</p>
            <p><strong>Cancellation.</strong> You may cancel your subscription at any time through your account settings or by contacting us. Cancellation takes effect at the end of the current billing period. You will retain access to the Service through the end of the period for which you have paid.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>5. Use of the Service</h2>
            <p style={{ marginBottom: '12px' }}>You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
            <ul style={{ paddingLeft: '20px' }}>
              <li style={{ marginBottom: '6px' }}>Use the Service in any way that violates applicable federal, state, or local law</li>
              <li style={{ marginBottom: '6px' }}>Attempt to gain unauthorized access to any portion of the Service or its related systems</li>
              <li style={{ marginBottom: '6px' }}>Interfere with or disrupt the integrity or performance of the Service</li>
              <li style={{ marginBottom: '6px' }}>Reverse engineer, decompile, or disassemble any portion of the Service</li>
              <li style={{ marginBottom: '6px' }}>Use automated means to access or scrape the Service without our written consent</li>
              <li style={{ marginBottom: '6px' }}>Upload or transmit any content that is unlawful, harmful, or infringes the rights of others</li>
              <li style={{ marginBottom: '6px' }}>Use the Service to send unsolicited or unauthorized commercial communications</li>
              <li style={{ marginBottom: '6px' }}>Share your account credentials with third parties or allow multiple individuals to use a single account</li>
            </ul>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>6. Your Data</h2>
            <p style={{ marginBottom: '12px' }}>You retain all ownership rights to the data you input into the Service, including inventory records, distributor information, recipes, and financial data ("Your Data"). By using the Service, you grant Inventory Sux a limited, non-exclusive license to store, process, and transmit Your Data solely as necessary to provide the Service to you.</p>
            <p>We do not claim ownership of Your Data and will not use it for any purpose other than operating and improving the Service. Upon account termination, you may export Your Data using the available export tools. We will delete Your Data within 30 days of account closure.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>7. Third-Party Services</h2>
            <p>The Service integrates with third-party services including Stripe (payment processing), Supabase (data storage), SendGrid (email), and Twilio (SMS). Your use of these integrations is subject to the respective terms of service and privacy policies of those providers. Inventory Sux is not responsible for the practices or content of any third-party services.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>8. Intellectual Property</h2>
            <p>The Service, including its design, features, code, trademarks, and content (excluding Your Data), is owned by Inventory Sux LLC and protected by applicable intellectual property laws. These Terms do not grant you any rights to use our trademarks, logos, or other brand features without our prior written consent. All rights not expressly granted in these Terms are reserved by Inventory Sux LLC.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>9. Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. INVENTORY SUX LLC DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. YOU USE THE SERVICE AT YOUR OWN RISK.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>10. Limitation of Liability</h2>
            <p>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, INVENTORY SUX LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE THREE MONTHS PRECEDING THE CLAIM.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>11. Indemnification</h2>
            <p>You agree to indemnify, defend, and hold harmless Inventory Sux LLC and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your violation of any rights of another party.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>12. Termination</h2>
            <p style={{ marginBottom: '12px' }}>We reserve the right to suspend or terminate your access to the Service at our sole discretion, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, us, third parties, or the integrity of the Service.</p>
            <p>Upon termination, your right to access and use the Service will immediately cease. Provisions of these Terms that by their nature should survive termination shall survive, including but not limited to ownership provisions, warranty disclaimers, indemnity, and limitations of liability.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>13. Modifications to the Service and Terms</h2>
            <p>We reserve the right to modify or discontinue the Service, or any part thereof, at any time with or without notice. We may also update these Terms from time to time. Material changes will be communicated via email or a notice within the Service. Your continued use of the Service after such changes constitutes your acceptance of the updated Terms.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>14. Governing Law and Dispute Resolution</h2>
            <p style={{ marginBottom: '12px' }}>These Terms are governed by and construed in accordance with the laws of the State of Indiana, without regard to its conflict of law principles. Any dispute arising out of or relating to these Terms or the Service shall be resolved exclusively in the state or federal courts located in Indiana, and you consent to personal jurisdiction in such courts.</p>
            <p>Before initiating any formal legal proceeding, you agree to contact us at contact@inventorysux.com and attempt to resolve the dispute informally for at least 30 days.</p>
          </section>

          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>15. Entire Agreement</h2>
            <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and Inventory Sux LLC with respect to the Service and supersede all prior agreements, understandings, and representations. If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>16. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at:</p>
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
