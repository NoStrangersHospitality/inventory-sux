'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Items() {
  const [items, setItems] = useState([])
  const [distributors, setDistributors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [activeCategory, setActiveCategory] = useState('liquor')
  const [form, setForm] = useState({ name: '', category: 'liquor', bottle_size: '', case_size: '', par: '', distributor_id: '' })
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    { key: 'liquor', label: 'Liquor', icon: '🍾' },
    { key: 'beer', label: 'Beer', icon: '🍺' },
    { key: 'wine', label: 'Wine', icon: '🍷' },
    { key: 'misc', label: 'Misc', icon: '📦' },
  ]

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const [{ data: itemData }, { data: distData }] = await Promise.all([
        supabase.from('items').select('*').eq('user_id', session.user.id).order('name'),
        supabase.from('distributors').select('*').eq('user_id', session.user.id).order('name')
      ])
      setItems(itemData || [])
      setDistributors(distData || [])
      setLoading(false)
    }
    init()
  }, [])

  const openForm = (item = null) => {
    if (item) {
      setForm({ name: item.name, category: item.category, bottle_size: item.bottle_size || '', case_size: item.case_size || '', par: item.par || '', distributor_id: item.distributor_id || '' })
      setEditingId(item.id)
    } else {
      setForm({ name: '', category: activeCategory, bottle_size: '', case_size: '', par: '', distributor_id: '' })
      setEditingId(null)
    }
    setShowForm(true)
  }

  const saveItem = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { name: form.name, category: form.category, bottle_size: form.bottle_size, case_size: form.case_size, par: parseInt(form.par) || 0, distributor_id: form.distributor_id || null, user_id: session.user.id }
    if (editingId) {
      await supabase.from('items').update(payload).eq('id', editingId)
    } else {
      await supabase.from('items').insert(payload)
    }
    const { data } = await supabase.from('items').select('*').eq('user_id', session.user.id).order('name')
    setItems(data || [])
    setShowForm(false)
    setSaving(false)
  }

  const exportCSV = () => {
    const catLabel = CATEGORIES.find(c => c.key === activeCategory)?.label || activeCategory
    const rows = [['Product Name', 'Bottle Size', 'Case Size', 'Par', 'Distributor']]
    items.filter(i => i.category === activeCategory).forEach(item => {
      const dist = distributors.find(d => d.id === item.distributor_id)
      rows.push([item.name, item.bottle_size || '', item.case_size || '', item.par || 0, dist?.name || ''])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `items_${activeCategory}.csv`
    a.click()
  }

  const downloadTemplate = () => {
    const catLabel = CATEGORIES.find(c => c.key === activeCategory)?.label || activeCategory
    const examples = {
      liquor: [['Buffalo Trace Bourbon', '750ml', '12', '6', 'Republic National'], ["Tito's Vodka", '1L', '12', '8', 'Southern Glazers']],
      beer: [["Hamm's 24pk", '12oz', '1', '4', 'Republic National'], ['High Life 24pk', '12oz', '1', '4', 'Republic National']],
      wine: [['Field Recordings Chenin Blanc', '750ml', '12', '3', 'Southern Glazers']],
      misc: [['Angostura Bitters', '4oz', '12', '6', '']],
    }
    const rows = [['Product Name', 'Bottle Size', 'Case Size', 'Par', 'Distributor'], ...(examples[activeCategory] || [])]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `items_${activeCategory}_template.csv`
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
      const ni = hdr.findIndex(h => h.includes('name') || h.includes('product'))
      const si = hdr.findIndex(h => h.includes('bottle') || h.includes('size'))
      const ci = hdr.findIndex(h => h.includes('case'))
      const pi = hdr.findIndex(h => h.includes('par'))
      const di = hdr.findIndex(h => h.includes('dist'))
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const name = cols[ni >= 0 ? ni : 0] || ''
        if (!name) continue
        const distName = cols[di >= 0 ? di : 4] || ''
        const dist = distributors.find(d => d.name.toLowerCase() === distName.toLowerCase())
        parsed.push({
          name,
          category: activeCategory,
          bottle_size: cols[si >= 0 ? si : 1] || '',
          case_size: cols[ci >= 0 ? ci : 2] || '',
          par: parseInt(cols[pi >= 0 ? pi : 3]) || 0,
          distributor_id: dist?.id || null,
          distName,
          distMatched: !distName || !!dist,
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
      await supabase.from('items').insert(toInsert.map(r => ({
        name: r.name,
        category: r.category,
        bottle_size: r.bottle_size,
        case_size: r.case_size,
        par: r.par,
        distributor_id: r.distributor_id,
        user_id: session.user.id
      })))
      const { data } = await supabase.from('items').select('*').eq('user_id', session.user.id).order('name')
      setItems(data || [])
    }
    setImportPreview(null)
    setImporting(false)
  }

  const catItems = items.filter(i => i.category === activeCategory)
  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const outlineBtn = { background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }

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
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Items</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Your product catalog</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={downloadTemplate} style={outlineBtn}>↓ Template</button>
            {catItems.length > 0 && <button onClick={exportCSV} style={outlineBtn}>↓ Export</button>}
            <label style={{ ...outlineBtn, display: 'inline-block' }}>
              ↑ Import
              <input type="file" accept=".csv" onChange={handleImportFile} style={{ display: 'none' }} />
            </label>
            <button onClick={() => openForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              + Add Item
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
          {CATEGORIES.map(c => {
            const count = items.filter(i => i.category === c.key).length
            return (
              <div key={c.key} onClick={() => { setActiveCategory(c.key); setImportPreview(null) }}
                style={{ background: '#fff', border: `2px solid ${activeCategory === c.key ? '#F5B800' : '#e8e8e8'}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{c.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#000', marginBottom: '2px' }}>{c.label}</div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>{count} item{count !== 1 ? 's' : ''}</div>
              </div>
            )
          })}
        </div>

        {/* Import Preview */}
        {importPreview && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Import Preview</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                  {importPreview.length} items · {importPreview.filter(r => !r.distMatched && r.distName).length} unmatched distributors ·{' '}
                  {importPreview.filter(r => !items.filter(i => i.category === activeCategory).map(i => i.name.toLowerCase()).includes(r.name.toLowerCase())).length} new
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setImportPreview(null)} style={outlineBtn}>Cancel</button>
                <button onClick={confirmImport} disabled={importing} style={{ background: importing ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: importing ? 'not-allowed' : 'pointer' }}>
                  {importing ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Product', 'Size', 'Case', 'Par', 'Distributor', 'Status'].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importPreview.map((r, i) => {
                  const exists = items.filter(item => item.category === activeCategory).map(item => item.name.toLowerCase()).includes(r.name.toLowerCase())
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                      <td style={{ padding: '7px 10px', fontWeight: '500', color: '#000' }}>{r.name}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{r.bottle_size || '--'}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{r.case_size || '--'}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{r.par || 0}</td>
                      <td style={{ padding: '7px 10px', color: r.distMatched ? '#666' : '#E24B4A' }}>{r.distName || '--'}{!r.distMatched && r.distName ? ' ⚠' : ''}</td>
                      <td style={{ padding: '7px 10px' }}>
                        {exists ? (
                          <span style={{ color: '#aaa', fontSize: '11px' }}>Already exists</span>
                        ) : (
                          <span style={{ color: '#3B6D11', fontSize: '11px' }}>✓ Ready</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {importPreview.some(r => !r.distMatched && r.distName) && (
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#854F0B', background: '#FAEEDA', border: '1px solid #f0c080', borderRadius: '6px', padding: '8px 12px' }}>
                ⚠ Unmatched distributors will be left blank. Add them in Distributors first if you want them linked.
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingId ? 'Edit Item' : 'Add Item'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Product Name</label>
                <input style={inputStyle} placeholder="Buffalo Trace Bourbon" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Bottle Size</label>
                <input style={inputStyle} placeholder="750ml" value={form.bottle_size} onChange={e => setForm(f => ({ ...f, bottle_size: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Case Size</label>
                <input style={inputStyle} placeholder="12" value={form.case_size} onChange={e => setForm(f => ({ ...f, case_size: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Par</label>
                <input style={inputStyle} type="number" placeholder="6" value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Distributor</label>
                <select style={inputStyle} value={form.distributor_id} onChange={e => setForm(f => ({ ...f, distributor_id: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
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

        {catItems.length === 0 && !importPreview ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No {CATEGORIES.find(c => c.key === activeCategory)?.label.toLowerCase()} items yet. Add one or import from CSV.
          </div>
        ) : !importPreview ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Product Name', 'Bottle Size', 'Case Size', 'Par', 'Distributor', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catItems.map(item => {
                  const dist = distributors.find(d => d.id === item.distributor_id)
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{item.name}</td>
                      <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{item.bottle_size || '--'}</td>
                      <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{item.case_size || '--'}</td>
                      <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{item.par || 0}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {dist && <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{dist.name}</span>}
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
        ) : null}
      </div>
    </div>
  )
}