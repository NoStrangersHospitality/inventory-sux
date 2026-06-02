'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function FOHInventoryDatabase() {
  const [items, setItems] = useState([])
  const [distributors, setDistributors] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('liquor')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [form, setForm] = useState({
    name: '', category: 'liquor', item_type: 'bottle',
    on_hand: '', unit: '', unit_cost: '', par: '',
    on_menu: false, distributor_id: '', notes: ''
  })
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

  const ITEM_TYPES = {
    liquor: ['bottle', 'case'],
    beer: ['keg', 'can', 'bottle', 'case'],
    wine: ['bottle', 'case'],
    misc: ['bottle', 'unit', 'case'],
  }

  const VALID_TYPES = ['bottle', 'keg', 'can', 'case', 'weight', 'volume', 'unit']

  const inputStyle = { width: '100%', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const outlineBtn = { background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      await loadData(session.user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadData = async (userId) => {
    const [{ data: invItems }, { data: dists }] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('user_id', userId).eq('area', 'foh').order('name'),
      supabase.from('distributors').select('*').eq('user_id', userId).order('name')
    ])
    setItems(invItems || [])
    setDistributors(dists || [])
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const catItems = items.filter(i => i.category === activeCategory)
  const totalValue = catItems.reduce((sum, i) => sum + (i.on_hand * i.unit_cost), 0)

  const openAddForm = () => {
    setForm({
      name: '', category: activeCategory, item_type: ITEM_TYPES[activeCategory][0],
      on_hand: '', unit: '', unit_cost: '', par: '',
      on_menu: false, distributor_id: '', notes: '', wine_type: ''
    })
    setEditingId(null)
    setShowAddForm(true)
  }

  const openEditForm = (item) => {
    setForm({
      name: item.name, category: item.category, item_type: item.item_type || 'bottle',
      on_hand: item.on_hand, unit: item.unit || '', unit_cost: item.unit_cost,
      par: item.par, on_menu: item.on_menu || false,
      distributor_id: item.distributor_id || '', notes: item.notes || '', wine_type: item.wine_type || ''
    })
    setEditingId(item.id)
    setShowAddForm(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setShowAddForm(false)
  }

  const saveItem = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = {
      name: form.name, category: form.category, item_type: form.item_type,
      on_hand: parseFloat(form.on_hand) || 0, unit: form.unit,
      unit_cost: parseFloat(form.unit_cost) || 0, par: parseFloat(form.par) || 0,
      on_menu: form.on_menu, distributor_id: form.distributor_id || null,
      notes: form.notes, wine_type: form.wine_type || null, area: 'foh', user_id: session.user.id
    }
    if (editingId) {
      await supabase.from('inventory_items').update(payload).eq('id', editingId)
      const original = items.find(i => i.id === editingId)
      if (original && parseFloat(form.on_hand) !== original.on_hand) {
        await supabase.from('inventory_history').insert({
          user_id: session.user.id,
          inventory_item_id: editingId,
          item_name: form.name,
          category: form.category,
          area: 'foh',
          event_type: 'manual_adjustment',
          quantity_before: original.on_hand,
          quantity_change: parseFloat(form.on_hand) - original.on_hand,
          quantity_after: parseFloat(form.on_hand),
          unit_cost_at_time: parseFloat(form.unit_cost) || 0,
          total_value_at_time: parseFloat(form.on_hand) * (parseFloat(form.unit_cost) || 0)
        })
      }
    } else {
      await supabase.from('inventory_items').insert(payload)
    }
    await loadData(session.user.id)
    setEditingId(null)
    setShowAddForm(false)
    setSaving(false)
  }

  const exportCSV = () => {
    const rows = [['Name', 'Category', 'Type', 'On Hand', 'Unit', 'Unit Cost', 'Par', 'On Menu', 'Distributor', 'Notes']]
    catItems.forEach(i => {
      const dist = distributors.find(d => d.id === i.distributor_id)
      rows.push([i.name, i.category, i.item_type, i.on_hand, i.unit || '', i.unit_cost, i.par, i.on_menu ? 'Yes' : 'No', dist?.name || '', i.notes || ''])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `inventory_${activeCategory}.csv`
    a.click()
  }

  const downloadTemplate = () => {
    const examples = {
      liquor: [['Buffalo Trace Bourbon', 'liquor', 'bottle', '12', 'bottle', '35.10', '6', 'Yes', 'Republic National', ''], ["Tito's Vodka", 'liquor', 'bottle', '8', 'bottle', '29.99', '8', 'Yes', 'Southern Glazers', '']],
      beer: [["Hamm's 24pk", 'beer', 'can', '4', 'case', '18.00', '2', 'Yes', 'Republic National', ''], ['High Life Keg', 'beer', 'keg', '1', 'keg', '85.00', '1', 'Yes', 'Republic National', '']],
      wine: [['Field Recordings Chenin Blanc', 'wine', 'bottle', '6', 'bottle', '14.00', '3', 'Yes', 'Southern Glazers', '']],
      misc: [['Angostura Bitters', 'misc', 'bottle', '4', 'bottle', '8.99', '2', 'No', '', '']],
    }
    const rows = [['Name', 'Category', 'Type', 'On Hand', 'Unit', 'Unit Cost', 'Par', 'On Menu', 'Distributor', 'Notes'], ...(examples[activeCategory] || [])]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `inventory_${activeCategory}_template.csv`
    a.click()
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l && l.replace(/,/g, '').trim())
      if (lines.length < 2) return
      const hdr = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
      const ni = hdr.findIndex(h => h.includes('name'))
      const ti = hdr.findIndex(h => h.includes('type'))
      const ohi = hdr.findIndex(h => h.includes('on hand') || h.includes('onhand'))
      const ui = hdr.findIndex(h => h === 'unit')
      const uci = hdr.findIndex(h => h.includes('cost'))
      const pi = hdr.findIndex(h => h.includes('par'))
      const omi = hdr.findIndex(h => h.includes('menu'))
      const di = hdr.findIndex(h => h.includes('dist'))
      const noi = hdr.findIndex(h => h.includes('note'))
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const name = (cols[ni >= 0 ? ni : 0] || '').trim()
        if (!name || name.toLowerCase() === 'name' || name.toLowerCase() === 'product name') continue
        const distName = cols[di >= 0 ? di : 8] || ''
        const dist = distributors.find(d => d.name.toLowerCase() === distName.toLowerCase())
        parsed.push({
          name, category: activeCategory,
          item_type: cols[ti >= 0 ? ti : 2] || ITEM_TYPES[activeCategory][0],
          on_hand: parseFloat(cols[ohi >= 0 ? ohi : 3]) || 0,
          unit: cols[ui >= 0 ? ui : 4] || '',
          unit_cost: parseFloat(cols[uci >= 0 ? uci : 5]) || 0,
          par: parseFloat(cols[pi >= 0 ? pi : 6]) || 0,
          on_menu: (cols[omi >= 0 ? omi : 7] || '').toLowerCase() === 'yes',
          distributor_id: dist?.id || null,
          distName, distMatched: !distName || !!dist,
          notes: cols[noi >= 0 ? noi : 9] || '',
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
    const existingNames = catItems.map(i => i.name.toLowerCase())
    const toInsert = importPreview.filter(r => r.name && r.name.trim() && !existingNames.includes(r.name.toLowerCase().trim()))
    if (toInsert.length > 0) {
      const { data: insertedItems, error: insertError } = await supabase
        .from('inventory_items')
        .insert(toInsert.map(r => ({
          name: r.name.trim(), category: r.category,
          item_type: VALID_TYPES.includes((r.item_type || '').toLowerCase()) ? r.item_type.toLowerCase() : 'unit',
          on_hand: r.on_hand, unit: r.unit, unit_cost: r.unit_cost, par: r.par,
          on_menu: r.on_menu, distributor_id: r.distributor_id, notes: r.notes,
          area: 'foh', user_id: session.user.id
        }))).select()
      if (insertError) { alert('Import failed: ' + insertError.message); setImporting(false); return }
      if (insertedItems?.length > 0) {
        const historyRows = insertedItems.filter(item => item.on_hand > 0).map(item => ({
          user_id: session.user.id, inventory_item_id: item.id, item_name: item.name,
          category: item.category, area: 'foh', event_type: 'csv_import',
          quantity_before: 0, quantity_change: item.on_hand, quantity_after: item.on_hand,
          unit_cost_at_time: item.unit_cost, total_value_at_time: item.on_hand * item.unit_cost
        }))
        if (historyRows.length > 0) await supabase.from('inventory_history').insert(historyRows)
      }
      await loadData(session.user.id)
    }
    setImportPreview(null)
    setImporting(false)
  }

  const InlineEditForm = () => (
    <tr>
      <td colSpan={9} style={{ padding: '0' }}>
        <div style={{ background: '#fafafa', borderLeft: '3px solid #F5B800', padding: '20px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Item Name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, item_type: ITEM_TYPES[e.target.value][0] }))}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Item Type</label>
              <select style={inputStyle} value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}>
                {(ITEM_TYPES[form.category] || ['bottle']).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            {form.category === 'wine' && (
              <div>
                <label style={labelStyle}>Wine Type</label>
                <select style={inputStyle} value={form.wine_type || ''} onChange={e => setForm(f => ({ ...f, wine_type: e.target.value }))}>
                  <option value="">-- Select --</option>
                  <option value="red">Red</option>
                  <option value="white">White</option>
                  <option value="bubbles">Bubbles</option>
                  <option value="rose">Rosé</option>
                  <option value="orange">Orange</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>On Hand</label>
              <input style={inputStyle} type="number" step="0.1" value={form.on_hand} onChange={e => setForm(f => ({ ...f, on_hand: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <input style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Unit Cost ($)</label>
              <input style={inputStyle} type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Par</label>
              <input style={inputStyle} type="number" step="0.1" value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Distributor</label>
              <select style={inputStyle} value={form.distributor_id} onChange={e => setForm(f => ({ ...f, distributor_id: e.target.value }))}>
                <option value="">-- Select --</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Notes</label>
              <input style={inputStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
              <input type="checkbox" id="onMenuInline" checked={form.on_menu} onChange={e => setForm(f => ({ ...f, on_menu: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="onMenuInline" style={{ fontSize: '13px', color: '#000', cursor: 'pointer' }}>On Menu — include this item on the order sheet</label>
            </div>
          </div>
          {form.on_hand > 0 && form.unit_cost > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', display: 'flex', gap: '24px' }}>
              <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>On Hand Value</div><div style={{ fontSize: '15px', fontWeight: '700', color: '#F5B800' }}>{fmt(parseFloat(form.on_hand) * parseFloat(form.unit_cost))}</div></div>
              {form.par > 0 && <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Variance</div><div style={{ fontSize: '15px', fontWeight: '700', color: parseFloat(form.on_hand) >= parseFloat(form.par) ? '#3B6D11' : '#E24B4A' }}>{(parseFloat(form.on_hand) - parseFloat(form.par)).toFixed(1)}</div></div>}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={cancelEdit} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveItem} disabled={saving} style={{ background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )

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
        <button onClick={() => router.push('/foh/inventory')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Inventory</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Inventory Database</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Every item you own — on hand, value, par, and ordering status.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={downloadTemplate} style={outlineBtn}>↓ Template</button>
            {catItems.length > 0 && <button onClick={exportCSV} style={outlineBtn}>↓ Export</button>}
            <label style={{ ...outlineBtn, display: 'inline-block' }}>
              ↑ Import
              <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            <button onClick={openAddForm} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Item</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
          {CATEGORIES.map(c => {
            const count = items.filter(i => i.category === c.key).length
            const val = items.filter(i => i.category === c.key).reduce((sum, i) => sum + (i.on_hand * i.unit_cost), 0)
            return (
              <div key={c.key} onClick={() => { setActiveCategory(c.key); setImportPreview(null); cancelEdit() }}
                style={{ background: '#fff', border: `2px solid ${activeCategory === c.key ? '#F5B800' : '#e8e8e8'}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{c.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#000', marginBottom: '2px' }}>{c.label}</div>
                <div style={{ fontSize: '11px', color: '#aaa' }}>{count} items · {fmt(val)}</div>
              </div>
            )
          })}
        </div>

        {importPreview && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Import Preview</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                  {importPreview.length} items · {importPreview.filter(r => !catItems.map(i => i.name.toLowerCase()).includes(r.name.toLowerCase())).length} new
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
                <tr>{['Name', 'Type', 'On Hand', 'Unit Cost', 'Par', 'On Menu', 'Distributor', 'Status'].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {importPreview.map((r, i) => {
                  const exists = catItems.map(item => item.name.toLowerCase()).includes(r.name.toLowerCase())
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                      <td style={{ padding: '7px 10px', fontWeight: '500', color: '#000' }}>{r.name}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{r.item_type}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{r.on_hand}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{r.unit_cost ? fmt(r.unit_cost) : '--'}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{r.par || '--'}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{r.on_menu ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '7px 10px', color: r.distMatched ? '#666' : '#E24B4A' }}>{r.distName || '--'}{!r.distMatched && r.distName ? ' ⚠' : ''}</td>
                      <td style={{ padding: '7px 10px' }}>
                        {exists ? <span style={{ color: '#aaa', fontSize: '11px' }}>Already exists</span>
                          : <span style={{ color: '#3B6D11', fontSize: '11px' }}>✓ Ready</span>}
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

        {showAddForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>Add Item</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Item Name</label>
                <input style={inputStyle} placeholder="Buffalo Trace Bourbon" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, item_type: ITEM_TYPES[e.target.value][0] }))}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Item Type</label>
                <select style={inputStyle} value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}>
                  {(ITEM_TYPES[form.category] || ['bottle']).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              {form.category === 'wine' && (
                <div>
                  <label style={labelStyle}>Wine Type</label>
                  <select style={inputStyle} value={form.wine_type || ''} onChange={e => setForm(f => ({ ...f, wine_type: e.target.value }))}>
                    <option value="">-- Select --</option>
                    <option value="red">Red</option>
                    <option value="white">White</option>
                    <option value="bubbles">Bubbles</option>
                    <option value="rose">Rosé</option>
                    <option value="orange">Orange</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>On Hand</label>
                <input style={inputStyle} type="number" step="0.1" placeholder="0" value={form.on_hand} onChange={e => setForm(f => ({ ...f, on_hand: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Unit</label>
                <input style={inputStyle} placeholder="bottle, keg, case..." value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Unit Cost ($)</label>
                <input style={inputStyle} type="number" step="0.01" placeholder="0.00" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Par</label>
                <input style={inputStyle} type="number" step="0.1" placeholder="0" value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Distributor</label>
                <select style={inputStyle} value={form.distributor_id} onChange={e => setForm(f => ({ ...f, distributor_id: e.target.value }))}>
                  <option value="">-- Select --</option>
                  {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Notes</label>
                <input style={inputStyle} placeholder="Any additional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#fafafa', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
                <input type="checkbox" id="onMenuAdd" checked={form.on_menu} onChange={e => setForm(f => ({ ...f, on_menu: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <label htmlFor="onMenuAdd" style={{ fontSize: '13px', color: '#000', cursor: 'pointer' }}>On Menu — include this item on the order sheet</label>
              </div>
            </div>
            {form.on_hand > 0 && form.unit_cost > 0 && (
              <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', display: 'flex', gap: '24px' }}>
                <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>On Hand Value</div><div style={{ fontSize: '16px', fontWeight: '700', color: '#F5B800' }}>{fmt(parseFloat(form.on_hand) * parseFloat(form.unit_cost))}</div></div>
                {form.par > 0 && <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Variance</div><div style={{ fontSize: '16px', fontWeight: '700', color: parseFloat(form.on_hand) >= parseFloat(form.par) ? '#3B6D11' : '#E24B4A' }}>{(parseFloat(form.on_hand) - parseFloat(form.par)).toFixed(1)}</div></div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={cancelEdit} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
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
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: '#aaa' }}>{catItems.length} items</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>Total value: <strong style={{ color: '#000' }}>{fmt(totalValue)}</strong></div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Item', 'Type', 'On Hand', 'Unit Cost', 'Value', 'Par', 'Variance', 'On Menu', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {catItems.map(item => {
                    const variance = item.on_hand - item.par
                    const isLow = item.par > 0 && item.on_hand < item.par
                    const isEditing = editingId === item.id
                    return (
                      <>
                        <tr key={item.id} style={{ borderBottom: isEditing ? 'none' : '1px solid #f5f5f5', background: isEditing ? '#fffdf0' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{item.name}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{item.item_type}</span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: isLow ? '#E24B4A' : '#000', fontSize: '13px' }}>{Number(item.on_hand).toFixed(1)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{fmt(item.unit_cost)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt(item.on_hand * item.unit_cost)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>{item.par > 0 ? Number(item.par).toFixed(1) : '--'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px' }}>
                            {item.par > 0 ? (
                              <span style={{ color: variance >= 0 ? '#3B6D11' : '#E24B4A', fontWeight: '500' }}>
                                {variance >= 0 ? '+' : ''}{variance.toFixed(1)}
                              </span>
                            ) : <span style={{ color: '#aaa' }}>--</span>}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {item.on_menu
                              ? <span style={{ background: '#EAF3DE', color: '#27500A', border: '1px solid #97C459', borderRadius: '10px', fontSize: '10px', padding: '2px 8px' }}>On Menu</span>
                              : <span style={{ background: '#f5f5f3', color: '#aaa', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '10px', padding: '2px 8px' }}>Off Menu</span>}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              onClick={() => isEditing ? cancelEdit() : openEditForm(item)}
                              style={{ background: isEditing ? '#e8e8e8' : '#333', border: 'none', color: isEditing ? '#555' : '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                              {isEditing ? 'Close' : 'Edit'}
                            </button>
                          </td>
                        </tr>
                        {isEditing && <InlineEditForm />}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}