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
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [activeCategory, setActiveCategory] = useState('proteins')
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'proteins', item_type: 'weight',
    unit: 'lb', unit_cost: '', par: '', on_hand: '',
    vendor_id: '', notes: '', on_menu: false
  })
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    { key: 'proteins', label: 'Proteins', icon: '🥩' },
    { key: 'produce', label: 'Produce', icon: '🥦' },
    { key: 'dairy', label: 'Dairy', icon: '🧀' },
    { key: 'dry_goods', label: 'Dry Goods', icon: '🌾' },
    { key: 'dry_spices', label: 'Dry Spices', icon: '🧂' },
    { key: 'oils_fats', label: 'Oils & Fats', icon: '🫙' },
    { key: 'sauces', label: 'Sauces', icon: '🥫' },
    { key: 'misc', label: 'Misc', icon: '📦' },
  ]

  const ITEM_TYPES = ['weight', 'volume', 'unit', 'case']
  const UNITS = {
    weight: ['lb', 'oz', 'kg', 'g'],
    volume: ['gal', 'qt', 'pt', 'fl oz', 'L', 'ml'],
    unit: ['each', 'dozen', 'bunch', 'head'],
    case: ['case', 'flat', 'tray'],
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

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
      await loadData(session.user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadData = async (userId) => {
    const [{ data: invItems }, { data: vendorData }] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('user_id', userId).eq('area', 'boh').eq('on_menu', true).order('name'),
      supabase.from('vendors').select('*').eq('user_id', userId).order('name')
    ])
    setItems(invItems || [])
    setVendors(vendorData || [])
  }

  const openForm = (item = null) => {
    if (item) {
      setForm({ name: item.name, category: item.category, item_type: item.item_type || 'weight', unit: item.unit || 'lb', unit_cost: item.unit_cost || '', par: item.par || '', on_hand: item.on_hand || '', vendor_id: item.distributor_id || '', notes: item.notes || '', on_menu: item.on_menu || false })
      setEditingId(item.id)
    } else {
      setForm({ name: '', category: activeCategory, item_type: 'weight', unit: 'lb', unit_cost: '', par: '', on_hand: '', vendor_id: '', notes: '', on_menu: false })
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
      unit: form.unit, unit_cost: parseFloat(form.unit_cost) || 0,
      par: parseFloat(form.par) || 0, on_hand: parseFloat(form.on_hand) || 0,
      distributor_id: form.vendor_id || null, notes: form.notes,
      on_menu: true, area: 'boh', user_id: session.user.id
    }
    if (editingId) {
      await supabase.from('inventory_items').update(payload).eq('id', editingId)
    } else {
      await supabase.from('inventory_items').insert(payload)
    }
    await loadData(session.user.id)
    setShowForm(false)
    setSaving(false)
  }

  const exportCSV = () => {
    const rows = [['Item Name', 'Category', 'Type', 'Unit', 'Unit Cost', 'Par', 'On Hand', 'Vendor', 'Notes']]
    items.filter(i => i.category === activeCategory).forEach(item => {
      const vendor = vendors.find(v => v.id === item.distributor_id)
      rows.push([item.name, item.category, item.item_type, item.unit || '', item.unit_cost || 0, item.par || 0, item.on_hand || 0, vendor?.name || '', item.notes || ''])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `boh_ordering_${activeCategory}.csv`
    a.click()
  }

  const downloadTemplate = () => {
    const examples = {
      proteins: [['Chicken Breast', 'proteins', 'weight', 'lb', '3.99', '20', '0', 'Sysco', 'boneless skinless']],
      produce: [['Roma Tomatoes', 'produce', 'weight', 'lb', '1.49', '15', '0', 'Sysco', '']],
      dairy: [['Heavy Cream', 'dairy', 'volume', 'qt', '4.50', '4', '0', 'US Foods', '']],
      dry_goods: [['All Purpose Flour', 'dry_goods', 'weight', 'lb', '8.99', '25', '0', 'Sysco', '']],
      dry_spices: [['Smoked Paprika', 'dry_spices', 'weight', 'lb', '8.99', '2', '0', 'Sysco', '']],
      oils_fats: [['Canola Oil', 'oils_fats', 'volume', 'gal', '12.99', '2', '0', 'Sysco', '']],
      sauces: [['Worcestershire', 'sauces', 'volume', 'qt', '6.99', '2', '0', 'Sysco', '']],
      misc: [['Nitrile Gloves', 'misc', 'case', 'case', '18.99', '3', '0', '', '']],
    }
    const rows = [['Item Name', 'Category', 'Type', 'Unit', 'Unit Cost', 'Par', 'On Hand', 'Vendor', 'Notes'], ...(examples[activeCategory] || [])]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `boh_ordering_${activeCategory}_template.csv`
    a.click()
  }

  const handleImportFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l)
      if (lines.length < 2) return
      const hdr = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
      const ni = hdr.findIndex(h => h.includes('name') || h.includes('item'))
      const ti = hdr.findIndex(h => h.includes('type'))
      const ui = hdr.findIndex(h => h === 'unit')
      const uci = hdr.findIndex(h => h.includes('cost'))
      const pi = hdr.findIndex(h => h.includes('par'))
      const ohi = hdr.findIndex(h => h.includes('on hand') || h.includes('onhand'))
      const vi = hdr.findIndex(h => h.includes('vendor'))
      const noi = hdr.findIndex(h => h.includes('note'))
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const name = cols[ni >= 0 ? ni : 0] || ''
        if (!name) continue
        const vendorName = cols[vi >= 0 ? vi : 7] || ''
        const vendor = vendors.find(v => v.name.toLowerCase() === vendorName.toLowerCase())
        parsed.push({
          name, category: activeCategory,
          item_type: cols[ti >= 0 ? ti : 2] || 'weight',
          unit: cols[ui >= 0 ? ui : 3] || 'lb',
          unit_cost: parseFloat(cols[uci >= 0 ? uci : 4]) || 0,
          par: parseFloat(cols[pi >= 0 ? pi : 5]) || 0,
          on_hand: parseFloat(cols[ohi >= 0 ? ohi : 6]) || 0,
          vendor_id: vendor?.id || null, vendorName,
          vendorMatched: !vendorName || !!vendor,
          notes: cols[noi >= 0 ? noi : 8] || '',
        })
      }
      setImportPreview(parsed)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const confirmImport = async () => {
    if (!importPreview) return
    setImporting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const existingNames = items.filter(i => i.category === activeCategory).map(i => i.name.toLowerCase())
    const toInsert = importPreview.filter(r => !existingNames.includes(r.name.toLowerCase()))
    if (toInsert.length > 0) {
      await supabase.from('inventory_items').insert(toInsert.map(r => ({
        name: r.name, category: r.category, item_type: r.item_type,
        unit: r.unit, unit_cost: r.unit_cost, par: r.par,
        on_hand: r.on_hand, distributor_id: r.vendor_id,
        notes: r.notes, on_menu: true, area: 'boh', user_id: session.user.id
      })))
      await loadData(session.user.id)
    }
    setImportPreview(null)
    setImporting(false)
  }

  const catItems = items.filter(i => i.category === activeCategory)

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

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>BOH Items</h1>
            {!isMobile && <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Items marked On Menu in your BOH inventory database</p>}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {!isMobile && <>
              <button onClick={downloadTemplate} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Template</button>
              {catItems.length > 0 && <button onClick={exportCSV} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Export</button>}
              <label style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                ↑ Import <input type="file" accept=".csv" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
            </>}
            <button onClick={() => openForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ Add</button>
          </div>
        </div>

        {/* Mobile action row */}
        {isMobile && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={downloadTemplate} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Template</button>
            {catItems.length > 0 && <button onClick={exportCSV} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Export</button>}
            <label style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', textAlign: 'center' }}>
              ↑ Import <input type="file" accept=".csv" onChange={handleImportFile} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* Info banner */}
        <div style={{ background: '#f0f8ff', border: '1px solid #b5d4f4', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#185FA5' }}>
          💡 Items appear here when marked <strong>On Menu</strong> in the BOH Inventory Database.
        </div>

        {/* Category tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '16px' }}>
          {CATEGORIES.map(c => {
            const count = items.filter(i => i.category === c.key).length
            return (
              <div key={c.key} onClick={() => { setActiveCategory(c.key); setImportPreview(null) }}
                style={{ background: '#fff', border: `2px solid ${activeCategory === c.key ? '#F5B800' : '#e8e8e8'}`, borderRadius: '10px', padding: isMobile ? '8px 4px' : '12px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '18px' : '22px', marginBottom: '3px' }}>{c.icon}</div>
                <div style={{ fontSize: isMobile ? '9px' : '11px', fontWeight: '600', color: '#000', marginBottom: '1px' }}>{isMobile ? c.label.split(' ')[0] : c.label}</div>
                <div style={{ fontSize: '9px', color: '#aaa' }}>{count}</div>
              </div>
            )
          })}
        </div>

        {/* Import preview */}
        {importPreview && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Import Preview</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                  {importPreview.length} items · {importPreview.filter(r => !items.filter(i => i.category === activeCategory).map(i => i.name.toLowerCase()).includes(r.name.toLowerCase())).length} new
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setImportPreview(null)} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmImport} disabled={importing} style={{ background: importing ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: importing ? 'not-allowed' : 'pointer' }}>
                  {importing ? 'Importing...' : 'Confirm'}
                </button>
              </div>
            </div>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {importPreview.map((r, i) => {
                  const exists = items.filter(item => item.category === activeCategory).map(item => item.name.toLowerCase()).includes(r.name.toLowerCase())
                  return (
                    <div key={i} style={{ background: '#fafafa', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: exists ? '#aaa' : '#3B6D11', fontWeight: '500' }}>{exists ? 'Exists' : '✓ New'}</div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>
                        {r.item_type} · {r.unit} · ${r.unit_cost} · par {r.par}
                        {r.vendorName && <span style={{ color: r.vendorMatched ? '#aaa' : '#E24B4A' }}> · {r.vendorName}{!r.vendorMatched ? ' ⚠' : ''}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>{['Item', 'Type', 'Unit', 'Unit Cost', 'Par', 'Vendor', 'Status'].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {importPreview.map((r, i) => {
                    const exists = items.filter(item => item.category === activeCategory).map(item => item.name.toLowerCase()).includes(r.name.toLowerCase())
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                        <td style={{ padding: '7px 10px', fontWeight: '500', color: '#000' }}>{r.name}</td>
                        <td style={{ padding: '7px 10px', color: '#666' }}>{r.item_type}</td>
                        <td style={{ padding: '7px 10px', color: '#666' }}>{r.unit || '--'}</td>
                        <td style={{ padding: '7px 10px', color: '#666' }}>${r.unit_cost || '0.00'}</td>
                        <td style={{ padding: '7px 10px', color: '#666' }}>{r.par || '--'}</td>
                        <td style={{ padding: '7px 10px', color: r.vendorMatched ? '#666' : '#E24B4A' }}>{r.vendorName || '--'}{!r.vendorMatched && r.vendorName ? ' ⚠' : ''}</td>
                        <td style={{ padding: '7px 10px' }}>{exists ? <span style={{ color: '#aaa', fontSize: '11px' }}>Exists</span> : <span style={{ color: '#3B6D11', fontSize: '11px' }}>✓ New</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {importPreview.some(r => !r.vendorMatched && r.vendorName) && (
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#854F0B', background: '#FAEEDA', border: '1px solid #f0c080', borderRadius: '6px', padding: '8px 12px' }}>
                ⚠ Unmatched vendors will be left blank.
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>{editingId ? 'Edit Item' : 'Add Item'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Item Name</label>
                <input style={inputStyle} placeholder="Chicken Breast" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Item Type</label>
                <select style={inputStyle} value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value, unit: UNITS[e.target.value]?.[0] || '' }))}>
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Unit</label>
                <select style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {(UNITS[form.item_type] || []).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Unit Cost ($)</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="0.00" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Par</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="0" value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>On Hand</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="0" value={form.on_hand} onChange={e => setForm(f => ({ ...f, on_hand: e.target.value }))} />
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
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveItem} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </div>
        )}

        {/* Item list */}
        {catItems.length === 0 && !importPreview ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No {CATEGORIES.find(c => c.key === activeCategory)?.label.toLowerCase()} items on menu yet.{' '}
            <span style={{ color: '#F5B800', cursor: 'pointer' }} onClick={() => router.push('/boh/inventory/database')}>
              Mark items On Menu in the BOH Inventory Database
            </span>{' '}
            or add one here.
          </div>
        ) : !importPreview ? (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {catItems.map(item => {
                const vendor = vendors.find(v => v.id === item.distributor_id)
                const isLow = item.par > 0 && item.on_hand < item.par
                return (
                  <div key={item.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1, marginRight: '12px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>
                          {item.item_type} · {item.unit || '--'}
                          {vendor && ` · ${vendor.name}`}
                          {item.notes && ` · ${item.notes}`}
                        </div>
                      </div>
                      <button onClick={() => openForm(item)} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Cost</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#555' }}>${Number(item.unit_cost || 0).toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>On Hand</div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: isLow ? '#E24B4A' : '#000' }}>{Number(item.on_hand || 0).toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Par</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#555' }}>{item.par || 0}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {['Item', 'Type', 'Unit', 'Unit Cost', 'On Hand', 'Par', 'Vendor', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catItems.map(item => {
                    const vendor = vendors.find(v => v.id === item.distributor_id)
                    const isLow = item.par > 0 && item.on_hand < item.par
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '12px 14px', fontSize: '13px' }}>
                          <div style={{ fontWeight: '500', color: '#000' }}>{item.name}</div>
                          {item.notes && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>{item.notes}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{item.item_type}</span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{item.unit || '--'}</td>
                        <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>${Number(item.unit_cost || 0).toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', fontWeight: '600', color: isLow ? '#E24B4A' : '#000', fontSize: '13px' }}>{Number(item.on_hand || 0).toFixed(2)}</td>
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
          )
        ) : null}
      </div>
    </div>
  )
}
