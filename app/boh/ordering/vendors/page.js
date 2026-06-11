'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Vendors() {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '', order_method: '', minimum_order: '', notes: '' })
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
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.boh_access && !prof?.owner_user_id) { router.push('/dashboard'); return }
      const { data } = await supabase.from('vendors').select('*').eq('user_id', session.user.id).order('name')
      setVendors(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const openForm = (vendor = null) => {
    if (vendor) {
      setForm({ name: vendor.name, contact_name: vendor.contact_name || '', email: vendor.email || '', phone: vendor.phone || '', order_method: vendor.order_method || '', minimum_order: vendor.minimum_order || '', notes: vendor.notes || '' })
      setEditingId(vendor.id)
    } else {
      setForm({ name: '', contact_name: '', email: '', phone: '', order_method: '', minimum_order: '', notes: '' })
      setEditingId(null)
    }
    setShowForm(true)
  }

  const saveVendor = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { ...form, user_id: session.user.id }
    if (editingId) {
      await supabase.from('vendors').update(payload).eq('id', editingId)
    } else {
      await supabase.from('vendors').insert(payload)
    }
    const { data } = await supabase.from('vendors').select('*').eq('user_id', session.user.id).order('name')
    setVendors(data || [])
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

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/boh/ordering')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← BOH Ordering</button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>Vendors</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Your purveyors and contacts</p>
          </div>
          <button onClick={() => openForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </div>

        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>{editingId ? 'Edit Vendor' : 'Add Vendor'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Vendor Name</label>
                <input style={inputStyle} placeholder="Sysco, US Foods..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Contact Name</label>
                <input style={inputStyle} placeholder="John Smith" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Order Method</label>
                <select style={inputStyle} value={form.order_method} onChange={e => setForm(f => ({ ...f, order_method: e.target.value }))}>
                  <option value="">-- Select --</option>
                  <option>Email</option>
                  <option>Phone</option>
                  <option>Text</option>
                  <option>Online Portal</option>
                  <option>Sales Rep Visit</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Contact Email</label>
                <input style={inputStyle} type="email" placeholder="john@sysco.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Contact Phone</label>
                <input style={inputStyle} placeholder="(317) 555-0100" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Order Minimum</label>
                <input style={inputStyle} placeholder="$250 or 1 case" value={form.minimum_order} onChange={e => setForm(f => ({ ...f, minimum_order: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Notes</label>
                <input style={inputStyle} placeholder="Delivery days, cutoff times..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveVendor} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Vendor'}
              </button>
            </div>
          </div>
        )}

        {vendors.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No vendors yet. Add your first purveyor to get started.
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {vendors.map(v => (
              <div key={v.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, marginRight: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{v.name}</div>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>
                      {v.contact_name && `${v.contact_name}`}
                      {v.order_method && ` · ${v.order_method}`}
                    </div>
                  </div>
                  <button onClick={() => openForm(v)} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {v.email && <div style={{ fontSize: '12px', color: '#555' }}>✉ {v.email}</div>}
                  {v.phone && <div style={{ fontSize: '12px', color: '#555' }}>📞 {v.phone}</div>}
                  {v.minimum_order && <div style={{ fontSize: '12px', color: '#aaa' }}>Min: {v.minimum_order}</div>}
                </div>
                {v.notes && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '6px' }}>{v.notes}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Vendor', 'Contact', 'Email', 'Order Method', 'Minimum', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{v.name}</td>
                    <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{v.contact_name || '--'}</td>
                    <td style={{ padding: '12px 14px', color: '#888', fontSize: '12px' }}>{v.email || '--'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {v.order_method && <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{v.order_method}</span>}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#888', fontSize: '12px' }}>{v.minimum_order || '--'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button onClick={() => openForm(v)} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
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
