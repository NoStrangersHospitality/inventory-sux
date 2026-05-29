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
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '', order_method: '', minimum_order: '', notes: '' })
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('distributors').select('*').eq('user_id', session.user.id).order('name')
      setDistributors(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const openForm = (dist = null) => {
    if (dist) {
      setForm({ name: dist.name, contact_name: dist.contact_name || '', email: dist.email || '', phone: dist.phone || '', order_method: dist.order_method || '', minimum_order: dist.minimum_order || '', notes: dist.notes || '' })
      setEditingId(dist.id)
    } else {
      setForm({ name: '', contact_name: '', email: '', phone: '', order_method: '', minimum_order: '', notes: '' })
      setEditingId(null)
    }
    setShowForm(true)
  }

  const saveDist = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { ...form, user_id: session.user.id }
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

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/foh/ordering')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Ordering</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Distributors</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Your reps and contacts</p>
          </div>
          <button onClick={() => openForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            + Add Distributor
          </button>
        </div>

        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingId ? 'Edit Distributor' : 'Add Distributor'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
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
                <select style={inputStyle} value={form.order_method} onChange={e => setForm(f => ({ ...f, order_method: e.target.value }))}>
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
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDist} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Distributor'}
              </button>
            </div>
          </div>
        )}

        {distributors.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No distributors yet. Add your first rep to get started.
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