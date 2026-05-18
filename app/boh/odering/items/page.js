'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOHItems() {
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState('proteins')
  const [form, setForm] = useState({ name: '', category: 'proteins', item_type: 'dry', purchase_qty: '', purchase_unit: 'lb', purchase_cost: '', par: '', vendor_id: '', notes: '' })
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    { key: 'proteins', label: 'Proteins', icon: '🥩' },
    { key: 'produce', label: 'Produce', icon: '🥦' },
    { key: 'dairy', label: 'Dairy', icon: '🧈' },
    { key: 'dry_goods', label: 'Dry Goods', icon: '🌾' },
    { key: 'dry_spices', label: 'Dry Spices', icon: '🫙' },
    { key: 'beverages', label: 'Beverages', icon: '🧃' },
    { key: 'other', label: 'Other', icon: '📦' },
  ]

  const DRY_UNITS = [
    { value: 'g', label: 'Gram (g)' },
    { value: 'oz_w', label: 'Ounce — weight (oz)' },
    { value: 'lb', label: 'Pound (lb)' },
  ]

  const LIQUID_UNITS = [
    { value: 'ml', label: 'Milliliter (ml)' },
    { value: 'fl_oz', label: 'Fluid Ounce (fl oz)' },
    { value: 'tsp', label: 'Teaspoon (tsp)' },
    { value: 'tbsp', label: 'Tablespoon (tbsp)' },
    { value: 'cup', label: 'Cup' },
    { value: 'pt', label: 'Pint (pt)' },
    { value: 'qt', label: 'Quart (qt)' },
    { value: 'L', label: 'Liter (L)' },
  ]

  const unitOptions = form.item_type === 'dry' ? DRY_UNITS : LIQUID_UNITS

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.boh_access) { router.push('/dashboard'); return }
      const [{ data: itemData }, { data: vendorData }] = await Promise.all([
        supabase.from('boh_items').select('*').eq('user_id', session.user.id).order('name'),
        supabase.from('vendors').select('*').eq('user_id', session.user.id).order('name')
      ])
      setItems(itemData || [])
      setVendors(vendorData || [])
      setLoading(false)
    }
    init()
  }, [])

  const openForm = (item = null) => {
    if (item) {
      setForm({ name: item.name, category: item.category, item_type: item.item_type || 'dry', purchase_qty: item.purchase_qty || '', purchase_unit: item.purchase_unit || 'lb', purchase_cost: item.purchase_cost || '', par: item.par || '', vendor_id: item.vendor_id || '', notes: item.notes || '' })
      setEditingId(item.id)
    } else {
      setForm({ name: '', category: activeCategory, item_type: 'dry', purchase_qty: '', purchase_unit: 'lb', purchase_cost: '', par: '', vendor_id: '', notes: '' })
      setEditingId(null)
    }
    setShowForm(true)
  }

  const saveItem = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = {
      name: form.name, category: form.category, item_type: form.item_type,
      purchase_qty: parseFloat(form.purchase_qty) || 0,
      purchase_unit: form.purchase_unit,
      purchase_cost: parseFloat(form.purchase_cost) || 0,
      par: parseFloat(form.par) || 0,
      vendor_id: form.vendor_id || null,
      notes: form.notes,
      user_id: session.user.id
    }
    if (editingId) {
      await supabase.from('boh_items').update(payload).eq('id', editingId)
    } else {
      await supabase.from('boh_items').insert(payload)
    }
    const { data } = await supabase.from('boh_items').select('*').eq('user_id', session.user.id).order('name')
    setItems(data || [])
    setShowForm(false)
    setSaving(false)
  }

  const catItems = items.filter(i => i.category === activeCategory)
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
        <button onClick={() => router.push('/boh/ordering')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← BOH Ordering</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>BOH Items</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Your ingredient catalog</p>
          </div>
          <button onClick={() => openForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Item</button>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '8px', marginBottom: '20px' }}>
          {CATEGORIES.map(c => {
            const count = items.filter(i => i.category === c.key).length
            return (
              <div key={c.key} onClick={() => setActiveCategory(c.key)}
                style={{ background: '#fff', border: `2px solid ${activeCategory === c.key ? '#F5B800' : '#e8e8e8'}`, borderRadius: '10px', padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s' }}>
                <div style={{ fontSize: '22px', marginBottom: '4px' }}>{c.icon}</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#000', marginBottom: '2px' }}>{c.label}</div>
                <div style={{ fontSize: '10px', color: '#aaa' }}>{count}</div>
              </div>
            )
          })}
        </div>

        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingId ? 'Edit Item' : 'Add Item'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Item Name</label>
                <input style={inputStyle} placeholder="Chicken Thighs, Bone-in" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value, purchase_unit: e.target.value === 'dry' ? 'lb' : 'L' }))}>
                  <option value="dry">Dry / Weight</option>
                  <option value="liquid">Liquid / Volume</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Purchase Quantity</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="10" value={form.purchase_qty} onChange={e => setForm(f => ({ ...f, purchase_qty: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Purchase Unit</label>
                <select style={inputStyle} value={form.purchase_unit} onChange={e => setForm(f => ({ ...f, purchase_unit: e.target.value }))}>
                  {unitOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Purchase Cost ($)</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="24.90" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Par</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="20" value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Vendor</label>
                <select style={inputStyle} value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Notes</label>
                <input style={inputStyle} placeholder="Storage notes, spec details..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveItem} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </div>
        )}

        {catItems.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No {CATEGORIES.find(c => c.key === activeCategory)?.label.toLowerCase()} items yet.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Item', 'Type', 'Purchase', 'Cost', 'Par', 'Vendor', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catItems.map(item => {
                  const vendor = vendors.find(v => v.id === item.vendor_id)
                  const unitLabel = [...DRY_UNITS, ...LIQUID_UNITS].find(u => u.value === item.purchase_unit)?.label || item.purchase_unit
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{item.name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: item.item_type === 'dry' ? '#FAEEDA' : '#E6F1FB', color: item.item_type === 'dry' ? '#854F0B' : '#185FA5', border: `1px solid ${item.item_type === 'dry' ? '#f0c080' : '#b5d4f4'}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>
                          {item.item_type === 'dry' ? 'Dry' : 'Liquid'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#555', fontSize: '12px' }}>{item.purchase_qty} {unitLabel}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>${parseFloat(item.purchase_cost || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{item.par || 0}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {vendor && <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{vendor.name}</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button onClick={() => openForm(item)} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}