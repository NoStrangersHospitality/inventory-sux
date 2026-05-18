'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function PourCost() {
  const [profile, setProfile] = useState(null)
  const [bottles, setBottles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filter, setFilter] = useState('All')
  const [form, setForm] = useState({ name: '', category: '', bottle_size_oz: '', bottle_cost: '' })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = ['Bourbon', 'Rye', 'Scotch', 'Irish', 'Japanese', 'Whiskey', 'Tequila', 'Mezcal', 'Vodka', 'Gin', 'Rum', 'Brandy', 'Liqueur', 'Other']
  const SIZES = [
    { label: 'Miniature', oz: 1.69 },
    { label: 'Half Pint', oz: 6.76 },
    { label: 'Pint', oz: 12.68 },
    { label: '750ml', oz: 25.36 },
    { label: 'Liter', oz: 33.81 },
    { label: 'Handle', oz: 59.17 },
  ]

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)
      const { data: btls } = await supabase.from('pour_cost_bottles').select('*').eq('user_id', session.user.id).order('name')
      setBottles(btls || [])
      setLoading(false)
    }
    init()
  }, [])

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const costOz = (b) => b.bottle_size_oz > 0 ? b.bottle_cost / b.bottle_size_oz : 0
  const targetPrice = (b, pct) => costOz(b) / pct

  const categories = ['All', ...Array.from(new Set(bottles.map(b => b.category).filter(Boolean))).sort()]
  const filtered = filter === 'All' ? bottles : bottles.filter(b => b.category === filter)

  const avgCostOz = bottles.length ? bottles.reduce((a, b) => a + costOz(b), 0) / bottles.length : 0
  const avgAt25 = bottles.length ? bottles.reduce((a, b) => a + targetPrice(b, 0.25), 0) / bottles.length : 0

  const openForm = (bottle = null) => {
    if (bottle) {
      setForm({ name: bottle.name, category: bottle.category || '', bottle_size_oz: bottle.bottle_size_oz, bottle_cost: bottle.bottle_cost })
      setEditingId(bottle.id)
    } else {
      setForm({ name: '', category: '', bottle_size_oz: '', bottle_cost: '' })
      setEditingId(null)
    }
    setShowForm(true)
  }

  const saveBottle = async () => {
    if (!form.name || !form.bottle_size_oz || !form.bottle_cost) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { name: form.name, category: form.category, bottle_size_oz: parseFloat(form.bottle_size_oz), bottle_cost: parseFloat(form.bottle_cost), user_id: session.user.id }
    if (editingId) {
      await supabase.from('pour_cost_bottles').update(payload).eq('id', editingId)
    } else {
      await supabase.from('pour_cost_bottles').insert(payload)
    }
    const { data } = await supabase.from('pour_cost_bottles').select('*').eq('user_id', session.user.id).order('name')
    setBottles(data || [])
    setShowForm(false)
    setSaving(false)
  }

  const exportCSV = () => {
    const rows = [['Bottle Name', 'Category', 'Bottle Size (oz)', 'Bottle Cost ($)']]
    bottles.forEach(b => rows.push([b.name, b.category || '', b.bottle_size_oz, b.bottle_cost]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'pour_cost_bottles.csv'
    a.click()
  }

  const downloadTemplate = () => {
    const rows = [
      ['Bottle Name', 'Category', 'Bottle Size (oz)', 'Bottle Cost ($)'],
      ['Buffalo Trace Bourbon', 'Bourbon', '25.36', '35.10'],
      ['Hendricks Gin', 'Gin', '25.36', '38.00'],
      ["Tito's Vodka", 'Vodka', '33.81', '29.99'],
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'pour_cost_template.csv'
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
      const ni = hdr.findIndex(h => h.includes('name') || h.includes('bottle'))
      const ci = hdr.findIndex(h => h.includes('cat'))
      const si = hdr.findIndex(h => h.includes('size') && !h.includes('cost'))
      const coi = hdr.findIndex(h => h.includes('cost'))
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const name = cols[ni >= 0 ? ni : 0] || ''
        if (!name) continue
        const bottle_size_oz = parseFloat(cols[si >= 0 ? si : 2]) || 0
        const bottle_cost = parseFloat(cols[coi >= 0 ? coi : 3]) || 0
        parsed.push({ name, category: cols[ci >= 0 ? ci : 1] || '', bottle_size_oz, bottle_cost, valid: bottle_size_oz > 0 && bottle_cost > 0 })
      }
      setImportPreview(parsed)
    }
    reader.readAsText(file)
  }

  const confirmImport = async () => {
    if (!importPreview) return
    setImporting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const valid = importPreview.filter(r => r.valid)
    const existingNames = bottles.map(b => b.name.toLowerCase())
    const toInsert = valid.filter(r => !existingNames.includes(r.name.toLowerCase()))
    if (toInsert.length > 0) {
      await supabase.from('pour_cost_bottles').insert(toInsert.map(r => ({
       name: r.name,
       category: r.category,
       bottle_size_oz: r.bottle_size_oz,
       bottle_cost: r.bottle_cost,
       user_id: session.user.id
      })))
      const { data } = await supabase.from('pour_cost_bottles').select('*').eq('user_id', session.user.id).order('name')
      setBottles(data || [])
    }
    setImportPreview(null)
    setImporting(false)
  }

  const deleteBottle = async (id) => {
    if (!confirm('Delete this bottle?')) return
    await supabase.from('pour_cost_bottles').delete().eq('id', id)
    setBottles(bottles.filter(b => b.id !== id))
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const outlineBtn = { background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }

  if (loading) return <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}><div style={{ color: '#aaa' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/foh')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← FOH</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Pour Cost Calculator</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Target sell prices at 20%, 25%, 30%, and 35% COG</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={downloadTemplate} style={outlineBtn}>↓ Template</button>
            {bottles.length > 0 && <button onClick={exportCSV} style={outlineBtn}>↓ Export</button>}
            <label style={{ ...outlineBtn, display: 'inline-block' }}>
              ↑ Import
              <input type="file" accept=".csv" onChange={handleImportFile} style={{ display: 'none' }} />
            </label>
            <button onClick={() => openForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              + Add Bottle
            </button>
          </div>
        </div>

        {/* Import Preview */}
        {importPreview && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Import Preview</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                  {importPreview.filter(r => r.valid).length} valid · {importPreview.filter(r => !r.valid).length} invalid ·{' '}
                  {importPreview.filter(r => r.valid && !bottles.map(b => b.name.toLowerCase()).includes(r.name.toLowerCase())).length} new
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
                  {['Bottle', 'Category', 'Size (oz)', 'Cost', 'Status'].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importPreview.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                    <td style={{ padding: '7px 10px', fontWeight: '500', color: '#000' }}>{r.name}</td>
                    <td style={{ padding: '7px 10px', color: '#666' }}>{r.category || '--'}</td>
                    <td style={{ padding: '7px 10px', color: '#666' }}>{r.bottle_size_oz || '--'}</td>
                    <td style={{ padding: '7px 10px', color: '#666' }}>{r.bottle_cost ? fmt(r.bottle_cost) : '--'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      {!r.valid ? (
                        <span style={{ color: '#E24B4A', fontSize: '11px' }}>Missing size/cost</span>
                      ) : bottles.map(b => b.name.toLowerCase()).includes(r.name.toLowerCase()) ? (
                        <span style={{ color: '#aaa', fontSize: '11px' }}>Already exists</span>
                      ) : (
                        <span style={{ color: '#3B6D11', fontSize: '11px' }}>✓ Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Stats */}
        {bottles.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Bottles', val: bottles.length, sub: 'in catalog' },
              { label: 'Avg Cost/oz', val: fmt(avgCostOz), sub: 'across all' },
              { label: 'Avg @ 25%', val: fmt(avgAt25), sub: 'target price' },
              { label: 'Categories', val: categories.length - 1, sub: 'spirit types' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#000' }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingId ? 'Edit Bottle' : 'Add Bottle'}</h3>
            <div style={{ background: '#f0f8ff', border: '1px solid #b5d4f4', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#185FA5', fontWeight: '600', marginBottom: '8px' }}>Bottle Size Reference — click to auto-fill</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '6px' }}>
                {SIZES.map(s => (
                  <div key={s.label} onClick={() => setForm(f => ({ ...f, bottle_size_oz: s.oz }))}
                    style={{ background: '#fff', border: '1px solid #b5d4f4', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#000' }}>{s.label}</div>
                    <div style={{ fontSize: '10px', color: '#5a9fd4' }}>{s.oz} oz</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Bottle Name</label>
                <input style={inputStyle} placeholder="Buffalo Trace Bourbon" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Bottle Size (oz)</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="25.36" value={form.bottle_size_oz} onChange={e => setForm(f => ({ ...f, bottle_size_oz: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Bottle Cost ($)</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="35.00" value={form.bottle_cost} onChange={e => setForm(f => ({ ...f, bottle_cost: e.target.value }))} />
              </div>
              {form.bottle_size_oz > 0 && form.bottle_cost > 0 && (
                <div style={{ gridColumn: '1/-1', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                  {[
                    { label: 'Cost/oz', val: fmt(form.bottle_cost / form.bottle_size_oz), color: '#000' },
                    { label: '@ 20%', val: fmt((form.bottle_cost / form.bottle_size_oz) / 0.20), color: '#3B6D11' },
                    { label: '@ 25%', val: fmt((form.bottle_cost / form.bottle_size_oz) / 0.25), color: '#4a8a1a' },
                    { label: '@ 30%', val: fmt((form.bottle_cost / form.bottle_size_oz) / 0.30), color: '#e07b00' },
                  ].map(p => (
                    <div key={p.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: p.color, marginBottom: '3px' }}>{p.label}</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: p.color }}>{p.val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveBottle} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Bottle'}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        {bottles.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#aaa', marginRight: '4px' }}>Filter:</span>
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)} style={{ background: filter === c ? '#F5B800' : '#fff', border: '1px solid', borderColor: filter === c ? '#F5B800' : '#e8e8e8', color: filter === c ? '#000' : '#666', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: filter === c ? '600' : '400' }}>{c}</button>
            ))}
          </div>
        )}

        {/* Table */}
        {bottles.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No bottles yet. Add your first bottle or import from CSV.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Bottle', 'Category', 'Price', 'Cost/oz', '@ 20%', '@ 25%', '@ 30%', '@ 35%', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: i > 2 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{b.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {b.category && <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{b.category}</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt(b.bottle_cost)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{fmt(costOz(b))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#3B6D11', fontWeight: '600', fontSize: '13px' }}>{fmt(targetPrice(b, 0.20))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#4a8a1a', fontWeight: '600', fontSize: '13px' }}>{fmt(targetPrice(b, 0.25))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#e07b00', fontWeight: '600', fontSize: '13px' }}>{fmt(targetPrice(b, 0.30))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#c05000', fontWeight: '600', fontSize: '13px' }}>{fmt(targetPrice(b, 0.35))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button onClick={() => openForm(b)} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', marginRight: '4px' }}>Edit</button>
                      <button onClick={() => deleteBottle(b.id)} style={{ background: 'none', border: '1px solid #e8e8e8', color: '#aaa', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Del</button>
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