'use client'

import { useRouter } from 'next/navigation'

export default function DistributorSMSConsent() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '3px solid #F5B800', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#fff' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <span style={{ fontSize: '12px', color: '#aaa' }}>SMS Consent Policy</span>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>

        {/* Title block */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#F5B800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Distributor SMS Consent</div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111', margin: '0 0 12px 0', lineHeight: 1.2 }}>How Distributor Representatives Consent to SMS</h1>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>Last updated: June 2026 · Inventory Sux, LLC</p>
        </div>

        {/* Overview */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '28px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111', marginBottom: '12px' }}>Overview</h2>
          <p style={{ fontSize: '14px', color: '#444', lineHeight: 1.7, margin: 0 }}>
            Inventory Sux is a B2B ordering platform used by bar and restaurant managers to place inventory orders
            with their existing beverage distributor sales representatives. Bar managers have pre-existing commercial
            relationships with their distributor contacts and communicate regularly about ordering preferences,
            pricing, and delivery schedules.
          </p>
        </div>

        {/* How consent works */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '28px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111', marginBottom: '16px' }}>How Distributor SMS Consent Is Obtained</h2>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#F5B800', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', flexShrink: 0, marginTop: '2px' }}>1</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111', marginBottom: '6px' }}>Distributor representative states their ordering preference</div>
              <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: 0 }}>
                As part of their standard business relationship, a distributor sales representative communicates
                to the bar manager how they prefer to receive orders — by email, SMS text message, or both.
                This preference is established verbally as part of their ongoing commercial relationship, in the
                same way reps communicate pricing, delivery windows, and product availability.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#F5B800', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', flexShrink: 0, marginTop: '2px' }}>2</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111', marginBottom: '6px' }}>Bar manager records the preference in Inventory Sux</div>
              <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: 0 }}>
                The bar manager enters the representative's business phone number into their Inventory Sux
                distributor profile and sets the order method to "SMS" or "Both" (email and SMS) — reflecting
                the preference the rep communicated. SMS is never enabled for a distributor without the bar
                manager explicitly selecting it, and only for reps who have indicated this preference.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ background: '#F5B800', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', flexShrink: 0, marginTop: '2px' }}>3</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111', marginBottom: '6px' }}>Transactional SMS messages are sent for each order</div>
              <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: 0 }}>
                When the bar manager submits an order, Inventory Sux sends one transactional SMS to the
                distributor rep's registered phone number, itemizing the products and quantities ordered.
                Messages are strictly limited to order placement notifications. No marketing or promotional
                messages are ever sent.
              </p>
            </div>
          </div>
        </div>

        {/* Nature of messages */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '28px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111', marginBottom: '12px' }}>Nature of Messages</h2>
          <ul style={{ fontSize: '14px', color: '#555', lineHeight: 2, paddingLeft: '20px', margin: 0 }}>
            <li>Messages are <strong>transactional only</strong> — one SMS per order submitted, containing product names and quantities</li>
            <li>Message frequency varies based on how often the bar manager places orders — typically 1–4 times per week</li>
            <li>No marketing, promotional, or unsolicited messages are sent through this platform</li>
            <li>Recipients may reply <strong>STOP</strong> at any time to opt out of future messages</li>
            <li>Recipients may reply <strong>START</strong> to resubscribe after opting out</li>
            <li>Recipients may reply <strong>HELP</strong> for assistance</li>
            <li>Message and data rates may apply</li>
          </ul>
        </div>

        {/* B2B context */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '28px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111', marginBottom: '12px' }}>B2B Business Context</h2>
          <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: '0 0 12px 0' }}>
            All SMS recipients are professional distributor sales representatives acting in their business capacity.
            They are not consumers receiving unsolicited commercial messages — they are trade contacts receiving
            order notifications directly related to the business transactions they service as part of their job.
          </p>
          <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: 0 }}>
            This is equivalent to a business placing an order with a vendor via text message — a common and
            widely accepted B2B communication practice in the food and beverage industry.
          </p>
        </div>

        {/* Opt-out */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '28px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111', marginBottom: '12px' }}>Opt-Out and Contact</h2>
          <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: '0 0 16px 0' }}>
            Any distributor representative who no longer wishes to receive SMS order notifications may:
          </p>
          <ul style={{ fontSize: '14px', color: '#555', lineHeight: 2, paddingLeft: '20px', margin: '0 0 16px 0' }}>
            <li>Reply <strong>STOP</strong> to any message to immediately unsubscribe</li>
            <li>Contact the bar or restaurant manager they work with directly and ask them to change the order method to email</li>
            <li>Contact Inventory Sux support at <strong>support@inventorysux.com</strong></li>
          </ul>
          <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: 0 }}>
            Opt-outs are processed immediately and automatically. Opted-out numbers will not receive further
            SMS messages from this platform.
          </p>
        </div>

        {/* Related policies */}
        <div style={{ background: '#fffbe6', border: '1px solid #f0d060', borderRadius: '12px', padding: '20px 24px' }}>
          <div style={{ fontSize: '13px', color: '#a07800' }}>
            Related policies: {' '}
            <a href="/terms" style={{ color: '#a07800', fontWeight: '600' }}>Terms of Service</a>
            {' · '}
            <a href="/privacy" style={{ color: '#a07800', fontWeight: '600' }}>Privacy Policy</a>
            {' · '}
            <a href="/auth/signup" style={{ color: '#a07800', fontWeight: '600' }}>Account Signup (bar manager consent)</a>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div style={{ background: '#111', borderTop: '3px solid #F5B800', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>© 2026 Inventory Sux, LLC · <a href="/terms" style={{ color: '#888' }}>Terms</a> · <a href="/privacy" style={{ color: '#888' }}>Privacy</a></p>
      </div>

    </div>
  )
}