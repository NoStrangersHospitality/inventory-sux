'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Distributors() {
  const [distributors, setDistributors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '', order_method: '', minimum_order: '', notes: '', sms_consent_confirmed: false })
  const [consentError, setConsentError] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('distributors').select('*').eq('user_id', session.user.id).order('name')
      setDistributors(data || [])
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const requiresSmsConsent = (method) => method === 'sms' || method === 'both'

  const openForm = (dist = null) => {
    if (dist) {
      setForm({
        name: dist.name, contact_name: dist.contact_name || '', email: dist.email || '',
        phone: dist.phone || '', order_method: dist.order_method || '', minimum_order: dist.minimum_order || '',
        notes: dist.notes || '', sms_consent_confirmed: dist.sms_consent_confirmed || false,
      })
      setEditingId(dist.id)
    } else {
      setForm({ name: '', contact_name: '', email: '', phone: '', order_method: '', minimum_order: '', notes: '', sms_consent_confirmed: false })
      setEditingId(null)
    }
    setConsentError(false)
    setShowForm(true)
  }

  const handleOrderMethodChange = (val) => {
    setForm(f => ({ ...f, order_method: val, sms_consent_confirmed: requiresSmsConsent(val) ? f.sms_consent_confirmed : false }))
    setConsentError(false)
  }

  const saveDist = async () => {
    if (!form.name) return
    if (requiresSmsConsent(form.order_method) && !form.sms_consent_confirmed) {
      setConsentError(true)
      return
    }
    setSaving(true)
    setConsentError(false)
    const { data: { session } } = await supabase.auth.getSession()

    const payload = {
      ...form,
      user_id: session.user.id,
      sms_consent_confirmed: requiresSmsConsent(form.order_method) ? form.sms_consent_confirmed : false,
    }

    // Only stamp confirmation metadata the moment consent is newly given —
    // don't overwrite an existing timestamp on every unrelated edit.
    const existing = editingId ? distributors.find(d => d.id === editingId) : null
    const isNewConsent = requiresSmsConsent(form.order_method) && form.sms_consent_confirmed && !existing?.sms_consent_confirmed
    if (isNewConsent) {
      payload.sms_consent_confirmed_at = new Date().toISOString()
      payload.sms_consent_confirmed_by = session.user.id
    }
    // If order method is changed away from sms/both, clear the consent record
    // so re-enabling SMS later requires re-confirmation.
    if (!requiresSmsConsent(form.order_method)) {
      payload.sms_consent_confirmed_at = null
      payload.sms_consent_confirmed_by = null
    }

    if (editingId) {
      await supabase.from('distributors').update(payload).eq('id', editingId)
    } else {
      await supabase.from('distributors').insert(payload)
    }
    const { data } = await supabase.from('distributors').select('*').eq('user_id', session.user.id).order('name')
    setDistributors(data || [])
    setShowForm(false)
    setSaving(false)
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const smsRequired = requiresSmsConsent(form.order_method)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/foh/ordering')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Ordering</button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>Distributors</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Your reps and contacts</p>
          </div>
          <button onClick={() => openForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </div>

        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>{editingId ? 'Edit Distributor' : 'Add Distributor'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Distributor Name</label>
                <input style={inputStyle} placeholder="Republic National" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Rep Name</label>
                <input style={inputStyle} placeholder="Mike Johnson" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Order Method</label>
                <select style={inputStyle} value={form.order_method} onChange={e => handleOrderMethodChange(e.target.value)}>
                  <option value="">-- Select --</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS / Text</option>
                  <option value="both">Email + SMS</option>
                  <option value="portal">Online Portal</option>
                  <option value="visit">Sales Rep Visit</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Contact Email</label>
                <input style={inputStyle} type="email" placeholder="mike@rndc.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Contact Phone</label>
                <input style={inputStyle} placeholder="(317) 555-0100" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Order Minimum</label>
                <input style={inputStyle} placeholder="$500 or 5 cases" value={form.minimum_order} onChange={e => setForm(f => ({ ...f, minimum_order: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Notes</label>
                <input style={inputStyle} placeholder="Delivery days, cutoff times..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* SMS consent confirmation — required whenever order_method is sms or both */}
            {smsRequired && (
              <div style={{ background: consentError ? '#fff5f5' : '#fafafa', border: `1px solid ${consentError ? '#E24B4A' : (form.sms_consent_confirmed ? '#F5B800' : '#e8e8e8')}`, borderRadius: '8px', padding: '12px 14px', marginBottom: '14px', transition: 'border-color .15s' }}>
                <label style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.sms_consent_confirmed}
                    onChange={e => { setForm(f => ({ ...f, sms_consent_confirmed: e.target.checked })); setConsentError(false) }}
                    style={{ width: '18px', height: '18px', marginTop: '1px', flexShrink: 0, accentColor: '#F5B800', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', color: consentError ? '#c53030' : '#555', lineHeight: 1.6 }}>
                    I confirm that {form.contact_name || 'this distributor representative'} has agreed to receive
                    transactional order SMS messages from {form.name || 'this distributor'} at the phone number provided.
                    I am responsible for maintaining this consent and will disable SMS for this contact if they
                    withdraw it. See our{' '}
                    <a href="/distributor-sms-consent" target="_blank" rel="noopener noreferrer" style={{ color: '#F5B800' }}>SMS Consent Policy</a>.
                  </span>
                </label>
                {consentError && (
                  <div style={{ fontSize: '11px', color: '#c53030', marginTop: '8px', paddingLeft: '30px' }}>
                    Please confirm SMS consent before saving this order method.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDist} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Distributor'}
              </button>
            </div>
          </div>
        )}

        {distributors.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No distributors yet. Add your first rep to get started.
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {distributors.map(d => (
              <div key={d.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, marginRight: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{d.name}</div>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>
                      {d.contact_name && `${d.contact_name}`}
                      {d.order_method && ` · ${d.order_method}`}
                      {requiresSmsConsent(d.order_method) && (d.sms_consent_confirmed ? ' · ✓ SMS consent' : ' · ⚠ SMS consent missing')}
                    </div>
                  </div>
                  <button onClick={() => openForm(d)} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {d.email && <div style={{ fontSize: '12px', color: '#555' }}>✉ {d.email}</div>}
                  {d.phone && <div style={{ fontSize: '12px', color: '#555' }}>📞 {d.phone}</div>}
                  {d.minimum_order && <div style={{ fontSize: '12px', color: '#aaa' }}>Min: {d.minimum_order}</div>}
                </div>
                {d.notes && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '6px' }}>{d.notes}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Distributor', 'Rep', 'Email', 'Order Method', 'Minimum', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {distributors.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{d.name}</td>
                    <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{d.contact_name || '--'}</td>
                    <td style={{ padding: '12px 14px', color: '#888', fontSize: '12px' }}>{d.email || '--'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {d.order_method && (
                        <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{d.order_method}</span>
                      )}
                      {requiresSmsConsent(d.order_method) && (
                        d.sms_consent_confirmed
                          ? <span style={{ marginLeft: '6px', fontSize: '11px', color: '#3B6D11' }} title="SMS consent confirmed">✓</span>
                          : <span style={{ marginLeft: '6px', fontSize: '11px', color: '#E24B4A' }} title="SMS consent not confirmed">⚠</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#888', fontSize: '12px' }}>{d.minimum_order || '--'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button onClick={() => openForm(d)} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}