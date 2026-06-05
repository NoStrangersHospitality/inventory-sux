'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

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

const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

const EditForm = ({ form, setForm, saving, isMobile, onSave, onCancel }) => {
  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }
  return (
    <div style={{ background: '#fafafa', borderLeft: isMobile ? 'none' : '3px solid #F5B800', borderTop: isMobile ? '3px solid #F5B800' : 'none', padding: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Item Name</label>
          <input style={inputStyle} placeholder="Chicken Breast" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Item Number / SKU</label>
          <input style={inputStyle} placeholder="Vendor item number..." value={form.item_number} onChange={e => setForm(f => ({ ...f, item_number: e.target.value }))} />
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
          <label style={labelStyle}>On Hand</label>
          <input style={inputStyle} type="number" step="0.01" placeholder="0" value={form.on_hand} onChange={e => setForm(f => ({ ...f, on_hand: e.target.value }))} />
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
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Notes</label>
          <input style={inputStyle} placeholder="Brand, spec, storage notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
          <input type="checkbox" checked={form.on_menu} onChange={e => setForm(f => ({ ...f, on_menu: e.target.checked }))} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
          <span style={{ fontSize: '13px', color: '#000' }}>On Menu — include on BOH order sheet</span>
        </div>
      </div>
      {form.on_hand > 0 && form.unit_cost > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', display: 'flex', gap: '20px' }}>
          <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Value</div><div style={{ fontSize: '15px', fontWeight: '700', color: '#F5B800' }}>${(parseFloat(form.on_hand) * parseFloat(form.unit_cost)).toFixed(2)}</div></div>
          {form.par > 0 && <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Variance</div><div style={{ fontSize: '15px', fontWeight: '700', color: parseFloat(form.on_hand) >= parseFloat(form.par) ? '#3B6D11' : '#E24B4A' }}>{(parseFloat(form.on_hand) - parseFloat(form.par)).toFixed(2)}</div></div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onCancel} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Save Item'}
        </button>
      </div>
    </div>
  )
}

export default function BOHInventoryDatabase() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('proteins')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({
    name: '', category: 'proteins', item_type: 'weight',
    on_hand: '', unit: 'lb', unit_cost: '', par: '',
    on_menu: false, notes: '', item_number: ''
  })
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
      if (!prof?.boh_access) { router.push('/dashboard'); return }
      await loadData(session.user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadData = async (userId) => {
    const { data } = await supabase.from('inventory_items').select('*').eq('user_id', userId).eq('area', 'boh').order('name')
    setItems(data || [])
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const catItems = items.filter(i => i.category === activeCategory)
  const totalValue = catItems.reduce((sum, i) => sum + (i.on_hand * i.unit_cost), 0)

  const openAddForm = () => {
    setForm({ name: '', category: activeCategory, item_type: 'weight', on_hand: '', unit: 'lb', unit_cost: '', par: '', on_menu: false, notes: '', item_number: '' })
    setEditingId(null)
    setShowAddForm(true)
  }

  const openEditForm = (item) => {
    setForm({ name: item.name, category: item.category, item_type: item.item_type || 'weight', on_hand: item.on_hand, unit: item.unit || 'lb', unit_cost: item.unit_cost, par: item.par, on_menu: item.on_menu || false, notes: item.notes || '', item_number: item.item_number || '' })
    setEditingId(item.id)
    setShowAddForm(false)
  }

  const cancelEdit = () => { setEditingId(null); setShowAddForm(false) }

  const saveItem = async () => {
    if (!form.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = {
      name: form.name, category: form.category, item_type: form.item_type,
      on_hand: parseFloat(form.on_hand) || 0, unit: form.unit,
      unit_cost: parseFloat(form.unit_cost) || 0, par: parseFloat(form.par) || 0,
      on_menu: form.on_menu, notes: form.notes,
      item_number: form.item_number || null, area: 'boh', user_id: session.user.id
    }
    if (editingId) {
      await supabase.from('inventory_items').update(payload).eq('id', editingId)
      const original = items.find(i => i.id === editingId)
      if (original && parseFloat(form.on_hand) !== original.on_hand) {
        await supabase.from('inventory_history').insert({
          user_id: session.user.id, inventory_item_id: editingId,
          item_name: form.name, category: form.category, area: 'boh',
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
    const rows = [['Item Number', 'Name', 'Category', 'Type', 'On Hand', 'Unit', 'Unit Cost', 'Par', 'Notes']]
    catItems.forEach(i => rows.push([i.item_number || '', i.name, i.category, i.item_type, i.on_hand, i.unit || '', i.unit_cost, i.par, i.notes || '']))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `boh_inventory_${activeCategory}.csv`
    a.click()
  }

  const downloadTemplate = () => {
    const examples = {
      proteins: [['', 'Chicken Breast', 'proteins', 'weight', '20', 'lb', '3.99', '10', 'boneless skinless']],
      produce: [['', 'Roma Tomatoes', 'produce', 'weight', '15', 'lb', '1.49', '8', '']],
      dairy: [['', 'Heavy Cream', 'dairy', 'volume', '4', 'qt', '4.50', '2', '']],
      dry_goods: [['', 'All Purpose Flour', 'dry_goods', 'weight', '25', 'lb', '8.99', '10', '']],
      dry_spices: [['', 'Smoked Paprika', 'dry_spices', 'weight', '2', 'lb', '8.99', '1', '']],
      oils_fats: [['', 'Canola Oil', 'oils_fats', 'volume', '1', 'gal', '12.99', '1', '']],
      sauces: [['', 'Worcestershire', 'sauces', 'volume', '2', 'qt', '6.99', '1', '']],
      misc: [['', 'Plastic Wrap', 'misc', 'case', '2', 'case', '24.99', '1', '']],
    }
    const rows = [['Item Number', 'Name', 'Category', 'Type', 'On Hand', 'Unit', 'Unit Cost', 'Par', 'Notes'], ...(examples[activeCategory] || [])]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `boh_inventory_${activeCategory}_template.csv`
    a.click()
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l)
      if (lines.length < 2) return
      const hdr = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
      const ini = hdr.findIndex(h => h.includes('item number') || h.includes('sku'))
      const ni = hdr.findIndex(h => h.includes('name'))
      const ti = hdr.findIndex(h => h.includes('type'))
      const ohi = hdr.findIndex(h => h.includes('on hand') || h.includes('onhand'))
      const ui = hdr.findIndex(h => h === 'unit')
      const uci = hdr.findIndex(h => h.includes('cost'))
      const pi = hdr.findIndex(h => h.includes('par'))
      const noi = hdr.findIndex(h => h.includes('note'))
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const name = cols[ni >= 0 ? ni : 0] || ''
        if (!name) continue
        parsed.push({
          item_number: cols[ini >= 0 ? ini : -1] || '', name, category: activeCategory,
          item_type: cols[ti >= 0 ? ti : 2] || 'weight',
          on_hand: parseFloat(cols[ohi >= 0 ? ohi : 3]) || 0,
          unit: cols[ui >= 0 ? ui : 4] || '',
          unit_cost: parseFloat(cols[uci >= 0 ? uci : 5]) || 0,
          par: parseFloat(cols[pi >= 0 ? pi : 6]) || 0,
          notes: cols[noi >= 0 ? noi : 7] || '',
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
    const toInsert = importPreview.filter(r => !existingNames.includes(r.name.toLowerCase()))
    if (toInsert.length > 0) {
      await supabase.from('inventory_items').insert(toInsert.map(r => ({
        item_number: r.item_number || null, name: r.name, category: r.category,
        item_type: r.item_type, on_hand: r.on_hand, unit: r.unit,
        unit_cost: r.unit_cost, par: r.par, notes: r.notes,
        area: 'boh', user_id: session.user.id
      })))
      const historyRows = toInsert.filter(r => r.on_hand > 0).map(r => ({
        user_id: session.user.id, item_name: r.name, category: r.category, area: 'boh',
        event_type: 'csv_import', quantity_before: 0,
        quantity_change: r.on_hand, quantity_after: r.on_hand,
        unit_cost_at_time: r.unit_cost, total_value_at_time: r.on_hand * r.unit_cost
      }))
      if (historyRows.length > 0) await supabase.from('inventory_history').insert(historyRows)
      await loadData(session.user.id)
    }
    setImportPreview(null)
    setImporting(false)
  }

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
        <button onClick={() => router.push('/boh/inventory')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Inventory</button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>BOH Database</h1>
            {!isMobile && <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Every ingredient and supply — on hand, value, and par.</p>}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {!isMobile && <button onClick={downloadTemplate} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Template</button>}
            {catItems.length > 0 && !isMobile && <button onClick={exportCSV} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Export</button>}
            {!isMobile && (
              <label style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                ↑ Import <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} />
              </label>
            )}
            <button onClick={openAddForm} style={{ background: '#333', color: '#fff', border: 'none', padding: isMobile ? '8px 12px' : '8px 16px', borderRadius: '8px', fontSize: isMobile ? '12px' : '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add</button>
          </div>
        </div>

        {isMobile && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button onClick={downloadTemplate} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Template</button>
            {catItems.length > 0 && <button onClick={exportCSV} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Export</button>}
            <label style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', textAlign: 'center' }}>
              ↑ Import <input type="file" accept=".csv" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '16px' }}>
          {CATEGORIES.map(c => {
            const count = items.filter(i => i.category === c.key).length
            const val = items.filter(i => i.category === c.key).reduce((sum, i) => sum + (i.on_hand * i.unit_cost), 0)
            return (
              <div key={c.key} onClick={() => { setActiveCategory(c.key); setImportPreview(null); cancelEdit() }}
                style={{ background: '#fff', border: `2px solid ${activeCategory === c.key ? '#F5B800' : '#e8e8e8'}`, borderRadius: '10px', padding: isMobile ? '8px 4px' : '12px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '18px' : '22px', marginBottom: '3px' }}>{c.icon}</div>
                <div style={{ fontSize: isMobile ? '9px' : '11px', fontWeight: '600', color: '#000', marginBottom: '1px' }}>{isMobile ? c.label.split(' ')[0] : c.label}</div>
                <div style={{ fontSize: '9px', color: '#aaa' }}>{count}</div>
              </div>
            )
          })}
        </div>

        {showAddForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontSize: '14px', fontWeight: '500', color: '#000' }}>Add Item</div>
            <EditForm form={form} setForm={setForm} saving={saving} isMobile={isMobile} onSave={saveItem} onCancel={cancelEdit} />
          </div>
        )}

        {importPreview && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Import Preview</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                  {importPreview.length} items · {importPreview.filter(r => !catItems.map(i => i.name.toLowerCase()).includes(r.name.toLowerCase())).length} new
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
                  const exists = catItems.map(item => item.name.toLowerCase()).includes(r.name.toLowerCase())
                  return (
                    <div key={i} style={{ background: '#fafafa', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: exists ? '#aaa' : '#3B6D11', fontWeight: '500' }}>{exists ? 'Exists' : '✓ New'}</div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>{r.item_type} · {r.on_hand} on hand · {r.unit_cost ? '$' + r.unit_cost : '--'}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>{['Item #', 'Name', 'Type', 'On Hand', 'Unit', 'Unit Cost', 'Par', 'Status'].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r, i) => {
                      const exists = catItems.map(item => item.name.toLowerCase()).includes(r.name.toLowerCase())
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                          <td style={{ padding: '7px 10px', color: '#aaa', fontSize: '11px' }}>{r.item_number || '--'}</td>
                          <td style={{ padding: '7px 10px', fontWeight: '500', color: '#000' }}>{r.name}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.item_type}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.on_hand}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.unit || '--'}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.unit_cost ? '$' + r.unit_cost : '--'}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.par || '--'}</td>
                          <td style={{ padding: '7px 10px' }}>{exists ? <span style={{ color: '#aaa', fontSize: '11px' }}>Exists</span> : <span style={{ color: '#3B6D11', fontSize: '11px' }}>✓ New</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
              <div style={{ fontSize: '12px', color: '#aaa' }}>Total: <strong style={{ color: '#000' }}>{fmt(totalValue)}</strong></div>
            </div>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {catItems.map(item => {
                  const variance = item.on_hand - item.par
                  const isLow = item.par > 0 && item.on_hand < item.par
                  const isEditing = editingId === item.id
                  return (
                    <div key={item.id} style={{ background: '#fff', border: `1px solid ${isEditing ? '#F5B800' : '#e8e8e8'}`, borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ flex: 1, marginRight: '12px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{item.name}</div>
                            <div style={{ fontSize: '11px', color: '#aaa' }}>
                              {item.item_type} · {item.unit || '--'}
                              {item.item_number && ` · #${item.item_number}`}
                              {item.notes && ` · ${item.notes}`}
                            </div>
                          </div>
                          <button onClick={() => isEditing ? cancelEdit() : openEditForm(item)}
                            style={{ background: isEditing ? '#f0f0f0' : '#333', border: 'none', color: isEditing ? '#555' : '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>
                            {isEditing ? 'Close' : 'Edit'}
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>On Hand</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: isLow ? '#E24B4A' : '#000' }}>{Number(item.on_hand).toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Cost</div>
                            <div style={{ fontSize: '12px', fontWeight: '500', color: '#555' }}>{fmt(item.unit_cost)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Value</div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#000' }}>{fmt(item.on_hand * item.unit_cost)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Par</div>
                            <div style={{ fontSize: '12px', fontWeight: '500', color: item.par > 0 && variance < 0 ? '#E24B4A' : '#555' }}>
                              {item.par > 0 ? `${Number(item.par).toFixed(2)} (${variance >= 0 ? '+' : ''}${variance.toFixed(2)})` : '--'}
                            </div>
                          </div>
                        </div>
                      </div>
                      {isEditing && <EditForm form={form} setForm={setForm} saving={saving} isMobile={isMobile} onSave={saveItem} onCancel={cancelEdit} />}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Item', 'Item #', 'Type', 'On Hand', 'Unit', 'Unit Cost', 'Value', 'Par', 'Variance', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: i > 2 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
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
                            <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>
                              {item.name}
                              {item.notes && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>{item.notes}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#aaa', fontSize: '12px' }}>{item.item_number || '--'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{item.item_type}</span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: isLow ? '#E24B4A' : '#000', fontSize: '13px' }}>{Number(item.on_hand).toFixed(2)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>{item.unit || '--'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{fmt(item.unit_cost)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt(item.on_hand * item.unit_cost)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>{item.par > 0 ? Number(item.par).toFixed(2) : '--'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px' }}>
                              {item.par > 0 ? <span style={{ color: variance >= 0 ? '#3B6D11' : '#E24B4A', fontWeight: '500' }}>{variance >= 0 ? '+' : ''}{variance.toFixed(2)}</span> : <span style={{ color: '#aaa' }}>--</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <button onClick={() => isEditing ? cancelEdit() : openEditForm(item)}
                                style={{ background: isEditing ? '#e8e8e8' : '#333', border: 'none', color: isEditing ? '#555' : '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                {isEditing ? 'Close' : 'Edit'}
                              </button>
                            </td>
                          </tr>
                          {isEditing && (
                            <tr>
                              <td colSpan={10} style={{ padding: '0' }}>
                                <EditForm form={form} setForm={setForm} saving={saving} isMobile={isMobile} onSave={saveItem} onCancel={cancelEdit} />
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}