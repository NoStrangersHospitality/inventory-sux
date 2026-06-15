'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Bourbon', 'Rye', 'Scotch', 'Irish', 'Japanese', 'Whiskey', 'Tequila', 'Mezcal', 'Vodka', 'Gin', 'Rum', 'Brandy', 'Liqueur', 'Aperitif', 'Bitters', 'Other']
const PREP_CATEGORIES = ['Syrup', 'Batch', 'Infusion', 'Tincture', 'Shrub', 'Juice', 'Puree', 'Other']
const UNITS = ['oz', 'dash', 'tsp', 'tbsp']
const PREP_UNITS = ['oz', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'lb', 'g', 'each']
const YIELD_UNITS = ['oz', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'lb', 'g', 'each']

const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

const fmt = (n) => '$' + Number(n).toFixed(2)

// Weight and volume conversion tables. Note 'oz' intentionally appears in
// BOTH tables with its correct value for each context (28.3495g for a
// weight ounce, 29.5735ml for a fluid ounce). convertQty picks whichever
// table has BOTH the source and target units defined, so e.g. grams <-> oz
// for a dry ingredient (sugar) uses the weight value, while oz <-> ml/cup/tbsp
// for a liquid uses the volume value.
const WEIGHT_TO_G = { g: 1, oz: 28.3495, lb: 453.592 }
const VOLUME_TO_ML = { ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, oz: 29.5735, fl_oz: 29.5735, pt: 473.176, qt: 946.353 }

const convertQty = (qty, fromUnit, toUnit) => {
  if (fromUnit === toUnit) return qty
  if (WEIGHT_TO_G[fromUnit] !== undefined && WEIGHT_TO_G[toUnit] !== undefined) {
    return qty * WEIGHT_TO_G[fromUnit] / WEIGHT_TO_G[toUnit]
  }
  if (VOLUME_TO_ML[fromUnit] !== undefined && VOLUME_TO_ML[toUnit] !== undefined) {
    return qty * VOLUME_TO_ML[fromUnit] / VOLUME_TO_ML[toUnit]
  }
  // Units span weight <-> volume with no density given — return unconverted
  // rather than silently mixing scales.
  return qty
}

const unitToOz = (qty, unit) => {
  if (unit === 'dash') return qty * 0.03
  if (unit === 'tsp') return qty * 0.17
  if (unit === 'tbsp') return qty * 0.5
  return qty
}

const costOz = (s) => s.bottle_size_oz > 0 ? s.bottle_cost / s.bottle_size_oz : 0

// --- Sub-components defined outside parent to prevent focus loss ---

const SpiritForm = ({ form, setForm, saving, isMobile, editingId, onSave, onCancel }) => {
  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>{editingId ? 'Edit Spirit' : 'Add Spirit'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Item / Spirit Name</label><input style={inputStyle} placeholder="Buffalo Trace Bourbon" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><label style={labelStyle}>Category</label><select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option value="">-- Select --</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label style={labelStyle}>Bottle Size (oz)</label><input style={inputStyle} type="number" step="0.01" placeholder="25.36" value={form.bottle_size_oz} onChange={e => setForm(f => ({ ...f, bottle_size_oz: e.target.value }))} /></div>
        <div><label style={labelStyle}>Bottle Cost ($)</label><input style={inputStyle} type="number" step="0.01" placeholder="35.10" value={form.bottle_cost} onChange={e => setForm(f => ({ ...f, bottle_cost: e.target.value }))} /></div>
        <div><label style={labelStyle}>Distributor</label><input style={inputStyle} placeholder="Republic National" value={form.distributor} onChange={e => setForm(f => ({ ...f, distributor: e.target.value }))} /></div>
        <div><label style={labelStyle}>Notes</label><input style={inputStyle} placeholder="750ml, special order..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onCancel} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Spirit'}</button>
      </div>
    </div>
  )
}

const PrepIngForm = ({ form, setForm, saving, isMobile, editingId, onSave, onCancel }) => {
  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>{editingId ? 'Edit Ingredient' : 'Add Prep Ingredient'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Ingredient Name</label><input style={inputStyle} placeholder="Demerara Sugar" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><label style={labelStyle}>Unit</label><select style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}><option value="">-- Select --</option>{PREP_UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
        <div><label style={labelStyle}>Cost per Unit ($)</label><input style={inputStyle} type="number" step="0.01" placeholder="2.50" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} /></div>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onCancel} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Ingredient'}</button>
      </div>
    </div>
  )
}

export default function COGS() {
  const [spirits, setSpirits] = useState([])
  const [recipes, setRecipes] = useState([])
  const [recipeIngredients, setRecipeIngredients] = useState([])
  const [prepIngredients, setPrepIngredients] = useState([])
  const [prepItems, setPrepItems] = useState([])
  const [prepItemIngredients, setPrepItemIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('hub')
  const [prepView, setPrepView] = useState('items')
  const [showSpiritForm, setShowSpiritForm] = useState(false)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [showPrepIngForm, setShowPrepIngForm] = useState(false)
  const [showPrepItemForm, setShowPrepItemForm] = useState(false)
  const [editingSpiritId, setEditingSpiritId] = useState(null)
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [editingPrepIngId, setEditingPrepIngId] = useState(null)
  const [editingPrepItemId, setEditingPrepItemId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importingSpirits, setImportingSpirits] = useState(false)
  const [spiritImportPreview, setSpiritImportPreview] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [spiritForm, setSpiritForm] = useState({ name: '', category: '', bottle_size_oz: '', bottle_cost: '', distributor: '', notes: '' })
  const [recipeForm, setRecipeForm] = useState({ name: '', menu_price: '', target_cost_pct: '0.20' })
  const [recipeIngs, setRecipeIngs] = useState([{ source_type: 'spirit', source_id: '', ingredient_name: '', quantity: '', unit: 'oz' }])
  const [prepIngForm, setPrepIngForm] = useState({ name: '', unit: '', cost_per_unit: '' })
  const [prepItemForm, setPrepItemForm] = useState({ name: '', category: '', yield_amount: '', yield_unit: 'oz', notes: '', source_type: 'made', purchase_cost: '' })
  const [prepItemIngs, setPrepItemIngs] = useState([{ source_type: 'prep_ingredient', source_id: '', quantity: '', unit: 'oz' }])
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadData = async (userId) => {
    const [{ data: sp }, { data: rc }, { data: ri }, { data: pi }, { data: pit }, { data: pii }] = await Promise.all([
      supabase.from('spirits').select('*').eq('user_id', userId).order('name'),
      supabase.from('recipes').select('*').eq('user_id', userId).order('name'),
      supabase.from('recipe_ingredients').select('*').eq('user_id', userId),
      supabase.from('prep_ingredients').select('*').eq('user_id', userId).order('name'),
      supabase.from('prep_items').select('*').eq('user_id', userId).order('name'),
      supabase.from('prep_item_ingredients').select('*').eq('user_id', userId),
    ])
    setSpirits(sp || [])
    setRecipes(rc || [])
    setRecipeIngredients(ri || [])
    setPrepIngredients(pi || [])
    setPrepItems(pit || [])
    setPrepItemIngredients(pii || [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      await loadData(session.user.id)
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getPrepItemCost = (prepItem) => {
    if (prepItem.source_type === 'purchased') return parseFloat(prepItem.purchase_cost) || 0
    const ings = prepItemIngredients.filter(pii => pii.prep_item_id === prepItem.id)
    return ings.reduce((total, ing) => {
      if (ing.source_type === 'prep_ingredient') {
        const pi = prepIngredients.find(p => p.id === ing.source_id)
        if (!pi) return total
        return total + pi.cost_per_unit * convertQty(ing.quantity, ing.unit, pi.unit)
      }
      if (ing.source_type === 'spirit') {
        const sp = spirits.find(s => s.id === ing.source_id)
        if (!sp) return total
        return total + costOz(sp) * unitToOz(ing.quantity, ing.unit)
      }
      if (ing.source_type === 'prep_item') {
        const nested = prepItems.find(p => p.id === ing.source_id)
        if (!nested || !nested.yield_amount) return total
        return total + (getPrepItemCost(nested) / nested.yield_amount) * convertQty(ing.quantity, ing.unit, nested.yield_unit)
      }
      return total
    }, 0)
  }

  // Recipe ingredients can pull from spirits, prep items, or prep ingredients.
  // ing.source_type / ing.source_id are the canonical fields; ing.spirit_id is
  // kept as a fallback for rows saved before this was added (source_type
  // defaults to 'spirit' and source_id falls back to spirit_id).
  const getRecipeIngredientCost = (ing) => {
    const sourceType = ing.source_type || 'spirit'
    const sourceId = ing.source_id || ing.spirit_id
    const qty = parseFloat(ing.quantity)
    if (!sourceId || !qty) return 0
    const ozQty = unitToOz(qty, ing.unit)

    if (sourceType === 'spirit') {
      const spirit = spirits.find(s => s.id === sourceId)
      if (!spirit) return 0
      return costOz(spirit) * ozQty
    }
    if (sourceType === 'prep_item') {
      const item = prepItems.find(p => p.id === sourceId)
      if (!item || !item.yield_amount) return 0
      const perUnitCost = getPrepItemCost(item) / item.yield_amount
      return perUnitCost * convertQty(ozQty, 'oz', item.yield_unit)
    }
    if (sourceType === 'prep_ingredient') {
      const pi = prepIngredients.find(p => p.id === sourceId)
      if (!pi) return 0
      return pi.cost_per_unit * convertQty(ozQty, 'oz', pi.unit)
    }
    return 0
  }

  const getRecipeIngredientName = (ing) => {
    const sourceType = ing.source_type || 'spirit'
    const sourceId = ing.source_id || ing.spirit_id
    if (sourceType === 'spirit') return spirits.find(s => s.id === sourceId)?.name || ing.ingredient_name || '--'
    if (sourceType === 'prep_item') return prepItems.find(p => p.id === sourceId)?.name || '--'
    if (sourceType === 'prep_ingredient') return prepIngredients.find(p => p.id === sourceId)?.name || '--'
    return ing.ingredient_name || '--'
  }

  const getSourceName = (sourceType, sourceId) => {
    if (sourceType === 'spirit') return spirits.find(s => s.id === sourceId)?.name || ''
    if (sourceType === 'prep_item') return prepItems.find(p => p.id === sourceId)?.name || ''
    if (sourceType === 'prep_ingredient') return prepIngredients.find(p => p.id === sourceId)?.name || ''
    return ''
  }

  const getRecipeCost = (recipe) => {
    const ings = recipeIngredients.filter(ri => ri.recipe_id === recipe.id)
    return ings.reduce((total, ing) => total + getRecipeIngredientCost(ing), 0)
  }

  const getIngredientName = (ing) => {
    if (ing.source_type === 'prep_ingredient') return prepIngredients.find(p => p.id === ing.source_id)?.name || '--'
    if (ing.source_type === 'spirit') return spirits.find(s => s.id === ing.source_id)?.name || '--'
    if (ing.source_type === 'prep_item') return prepItems.find(p => p.id === ing.source_id)?.name || '--'
    return '--'
  }

  const liveRecipeCost = () => recipeIngs.reduce((total, ing) => total + getRecipeIngredientCost(ing), 0)

  const livePrepCost = () => prepItemIngs.reduce((total, ing) => {
    if (!ing.source_id || !ing.quantity) return total
    if (ing.source_type === 'prep_ingredient') {
      const pi = prepIngredients.find(p => p.id === ing.source_id)
      if (!pi) return total
      return total + pi.cost_per_unit * convertQty(parseFloat(ing.quantity), ing.unit, pi.unit)
    }
    if (ing.source_type === 'spirit') {
      const sp = spirits.find(s => s.id === ing.source_id)
      if (!sp) return total
      return total + costOz(sp) * unitToOz(parseFloat(ing.quantity), ing.unit)
    }
    if (ing.source_type === 'prep_item') {
      const nested = prepItems.find(p => p.id === ing.source_id)
      if (!nested || !nested.yield_amount) return total
      return total + (getPrepItemCost(nested) / nested.yield_amount) * convertQty(parseFloat(ing.quantity), ing.unit, nested.yield_unit)
    }
    return total
  }, 0)

  // Live cost for the form preview — handles both recipe-built and purchased items
  const currentLiveCost = () => prepItemForm.source_type === 'purchased'
    ? (parseFloat(prepItemForm.purchase_cost) || 0)
    : livePrepCost()

  const saveSpiritForm = async () => {
    if (!spiritForm.name || !spiritForm.bottle_size_oz || !spiritForm.bottle_cost) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { name: spiritForm.name, category: spiritForm.category, bottle_size_oz: parseFloat(spiritForm.bottle_size_oz), bottle_cost: parseFloat(spiritForm.bottle_cost), distributor: spiritForm.distributor, notes: spiritForm.notes, user_id: session.user.id }
    if (editingSpiritId) { await supabase.from('spirits').update(payload).eq('id', editingSpiritId) }
    else { await supabase.from('spirits').insert(payload) }
    await loadData(session.user.id)
    setShowSpiritForm(false)
    setSaving(false)
  }

  const exportSpirits = () => {
    const rows = [['Name', 'Category', 'Bottle Size (oz)', 'Bottle Cost ($)', 'Distributor', 'Notes']]
    spirits.forEach(s => rows.push([s.name, s.category || '', s.bottle_size_oz, s.bottle_cost, s.distributor || '', s.notes || '']))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'spirits_database.csv'; a.click()
  }

  const downloadSpiritsTemplate = () => {
    const rows = [['Name', 'Category', 'Bottle Size (oz)', 'Bottle Cost ($)', 'Distributor', 'Notes'], ['Buffalo Trace Bourbon', 'Bourbon', '25.36', '35.10', 'Republic National', ''], ['Hendricks Gin', 'Gin', '25.36', '38.00', 'Southern Glazers', ''], ["Tito's Vodka", 'Vodka', '33.81', '29.99', 'Southern Glazers', '']]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'spirits_template.csv'; a.click()
  }

  const handleSpiritsImport = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l)
      if (lines.length < 2) return
      const hdr = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
      const ni = hdr.findIndex(h => h.includes('name')), ci = hdr.findIndex(h => h.includes('cat')), si = hdr.findIndex(h => h.includes('size') && !h.includes('cost')), coi = hdr.findIndex(h => h.includes('cost')), di = hdr.findIndex(h => h.includes('dist')), noi = hdr.findIndex(h => h.includes('note'))
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const name = cols[ni >= 0 ? ni : 0] || ''; if (!name) continue
        const bottle_size_oz = parseFloat(cols[si >= 0 ? si : 2]) || 0
        const bottle_cost = parseFloat(cols[coi >= 0 ? coi : 3]) || 0
        parsed.push({ name, category: cols[ci >= 0 ? ci : 1] || '', bottle_size_oz, bottle_cost, distributor: cols[di >= 0 ? di : 4] || '', notes: cols[noi >= 0 ? noi : 5] || '', valid: bottle_size_oz > 0 && bottle_cost > 0 })
      }
      setSpiritImportPreview(parsed)
    }
    reader.readAsText(file); e.target.value = ''
  }

  const confirmSpiritsImport = async () => {
    if (!spiritImportPreview) return
    setImportingSpirits(true)
    const { data: { session } } = await supabase.auth.getSession()
    const existingNames = spirits.map(s => s.name.toLowerCase())
    const toInsert = spiritImportPreview.filter(r => r.valid && !existingNames.includes(r.name.toLowerCase()))
    if (toInsert.length > 0) {
      await supabase.from('spirits').insert(toInsert.map(r => ({ name: r.name, category: r.category, bottle_size_oz: r.bottle_size_oz, bottle_cost: r.bottle_cost, distributor: r.distributor, notes: r.notes, user_id: session.user.id })))
      await loadData(session.user.id)
    }
    setSpiritImportPreview(null); setImportingSpirits(false)
  }

  const saveRecipeForm = async () => {
    if (!recipeForm.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    let recipeId = editingRecipeId
    if (editingRecipeId) {
      await supabase.from('recipes').update({ name: recipeForm.name, menu_price: parseFloat(recipeForm.menu_price) || 0, target_cost_pct: parseFloat(recipeForm.target_cost_pct) || 0.20 }).eq('id', editingRecipeId)
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', editingRecipeId)
    } else {
      const { data } = await supabase.from('recipes').insert({ name: recipeForm.name, menu_price: parseFloat(recipeForm.menu_price) || 0, target_cost_pct: parseFloat(recipeForm.target_cost_pct) || 0.20, user_id: session.user.id }).select().single()
      recipeId = data.id
    }
    const validIngs = recipeIngs.filter(i => i.source_id && i.quantity)
    if (validIngs.length > 0) {
      await supabase.from('recipe_ingredients').insert(validIngs.map(i => ({
        recipe_id: recipeId, user_id: session.user.id,
        source_type: i.source_type, source_id: i.source_id,
        spirit_id: i.source_type === 'spirit' ? i.source_id : null,
        ingredient_name: getSourceName(i.source_type, i.source_id),
        quantity: parseFloat(i.quantity), unit: i.unit
      })))
    }
    await loadData(session.user.id); setShowRecipeForm(false); setSaving(false)
  }

  const openRecipeForm = (recipe = null) => {
    if (recipe) {
      setRecipeForm({ name: recipe.name, menu_price: recipe.menu_price, target_cost_pct: recipe.target_cost_pct })
      setEditingRecipeId(recipe.id)
      const ings = recipeIngredients.filter(ri => ri.recipe_id === recipe.id)
      setRecipeIngs(ings.length ? ings.map(i => ({
        source_type: i.source_type || 'spirit',
        source_id: i.source_id || i.spirit_id,
        ingredient_name: i.ingredient_name,
        quantity: i.quantity,
        unit: i.unit
      })) : [{ source_type: 'spirit', source_id: '', ingredient_name: '', quantity: '', unit: 'oz' }])
    } else {
      setRecipeForm({ name: '', menu_price: '', target_cost_pct: '0.20' }); setEditingRecipeId(null)
      setRecipeIngs([{ source_type: 'spirit', source_id: '', ingredient_name: '', quantity: '', unit: 'oz' }])
    }
    setShowRecipeForm(true)
  }

  const savePrepIngForm = async () => {
    if (!prepIngForm.name || !prepIngForm.cost_per_unit) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { name: prepIngForm.name, unit: prepIngForm.unit, cost_per_unit: parseFloat(prepIngForm.cost_per_unit), user_id: session.user.id }
    if (editingPrepIngId) { await supabase.from('prep_ingredients').update(payload).eq('id', editingPrepIngId) }
    else { await supabase.from('prep_ingredients').insert(payload) }
    await loadData(session.user.id); setShowPrepIngForm(false); setSaving(false)
  }

  const savePrepItemForm = async () => {
    if (!prepItemForm.name || !prepItemForm.yield_amount) return
    if (prepItemForm.source_type === 'purchased' && !prepItemForm.purchase_cost) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    let prepItemId = editingPrepItemId
    const basePayload = {
      name: prepItemForm.name,
      category: prepItemForm.category,
      yield_amount: parseFloat(prepItemForm.yield_amount),
      yield_unit: prepItemForm.yield_unit,
      notes: prepItemForm.notes,
      source_type: prepItemForm.source_type,
      purchase_cost: prepItemForm.source_type === 'purchased' ? (parseFloat(prepItemForm.purchase_cost) || 0) : null,
    }
    if (editingPrepItemId) {
      await supabase.from('prep_items').update(basePayload).eq('id', editingPrepItemId)
      await supabase.from('prep_item_ingredients').delete().eq('prep_item_id', editingPrepItemId)
    } else {
      const { data } = await supabase.from('prep_items').insert({ ...basePayload, user_id: session.user.id }).select().single()
      prepItemId = data.id
    }
    if (prepItemForm.source_type === 'made') {
      const validIngs = prepItemIngs.filter(i => i.source_id && i.quantity)
      if (validIngs.length > 0) {
        await supabase.from('prep_item_ingredients').insert(validIngs.map(i => ({ prep_item_id: prepItemId, user_id: session.user.id, source_type: i.source_type, source_id: i.source_id, quantity: parseFloat(i.quantity), unit: i.unit })))
      }
    }
    await loadData(session.user.id); setShowPrepItemForm(false); setSaving(false)
  }

  const openPrepItemForm = (item = null) => {
    if (item) {
      setPrepItemForm({
        name: item.name,
        category: item.category || '',
        yield_amount: item.yield_amount,
        yield_unit: item.yield_unit || 'oz',
        notes: item.notes || '',
        source_type: item.source_type || 'made',
        purchase_cost: item.purchase_cost != null ? item.purchase_cost : '',
      })
      setEditingPrepItemId(item.id)
      const ings = prepItemIngredients.filter(pii => pii.prep_item_id === item.id)
      setPrepItemIngs(ings.length ? ings.map(i => ({ source_type: i.source_type, source_id: i.source_id, quantity: i.quantity, unit: i.unit })) : [{ source_type: 'prep_ingredient', source_id: '', quantity: '', unit: 'oz' }])
    } else {
      setPrepItemForm({ name: '', category: '', yield_amount: '', yield_unit: 'oz', notes: '', source_type: 'made', purchase_cost: '' }); setEditingPrepItemId(null)
      setPrepItemIngs([{ source_type: 'prep_ingredient', source_id: '', quantity: '', unit: 'oz' }])
    }
    setShowPrepItemForm(true)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#aaa' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => view === 'hub' ? router.push('/foh') : setView('hub')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {view === 'hub' ? 'FOH' : 'COGS'}
        </button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* HUB */}
        {view === 'hub' && (
          <>
            <h1 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>COGS</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '20px' }}>Recipe costing and margin analysis.</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? '12px' : '20px' }}>
              {[
                { title: 'Spirits Database', desc: 'Ingredients and cost per oz', icon: '🍾', view: 'spirits' },
                { title: 'Prep Costing', desc: 'Syrups, batches, and infusions', icon: '🧪', view: 'prep' },
                { title: 'Recipes', desc: 'Cocktail costing and margins', icon: '📋', view: 'recipes' },
              ].map(t => (
                <div key={t.title} onClick={() => setView(t.view)}
                  style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: isMobile ? '20px 16px' : '36px 28px', cursor: 'pointer', textAlign: isMobile ? 'left' : 'center', display: isMobile ? 'flex' : 'block', alignItems: 'center', gap: '16px', transition: 'border-color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
                  <div style={{ fontSize: isMobile ? '32px' : '40px', marginBottom: isMobile ? '0' : '14px', flexShrink: 0 }}>{t.icon}</div>
                  <div>
                    <div style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '600', color: '#000', marginBottom: '4px' }}>{t.title}</div>
                    <div style={{ fontSize: '13px', color: '#aaa' }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* SPIRITS DATABASE */}
        {view === 'spirits' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>Spirits Database</h1>
                {!isMobile && <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Ingredients and cost per oz</p>}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {!isMobile && <>
                  <button onClick={downloadSpiritsTemplate} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Template</button>
                  {spirits.length > 0 && <button onClick={exportSpirits} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Export</button>}
                  <label style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↑ Import<input type="file" accept=".csv" onChange={handleSpiritsImport} style={{ display: 'none' }} /></label>
                </>}
                <button onClick={() => { setSpiritForm({ name: '', category: '', bottle_size_oz: '', bottle_cost: '', distributor: '', notes: '' }); setEditingSpiritId(null); setShowSpiritForm(true) }} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ Add</button>
              </div>
            </div>

            {isMobile && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button onClick={downloadSpiritsTemplate} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Template</button>
                {spirits.length > 0 && <button onClick={exportSpirits} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Export</button>}
                <label style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', textAlign: 'center' }}>↑ Import<input type="file" accept=".csv" onChange={handleSpiritsImport} style={{ display: 'none' }} /></label>
              </div>
            )}

            {spiritImportPreview && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Import Preview</div>
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>{spiritImportPreview.filter(r => r.valid).length} valid · {spiritImportPreview.filter(r => r.valid && !spirits.map(s => s.name.toLowerCase()).includes(r.name.toLowerCase())).length} new</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setSpiritImportPreview(null)} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={confirmSpiritsImport} disabled={importingSpirits} style={{ background: importingSpirits ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: importingSpirits ? 'not-allowed' : 'pointer' }}>{importingSpirits ? 'Importing...' : 'Confirm'}</button>
                  </div>
                </div>
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {spiritImportPreview.map((r, i) => {
                      const exists = spirits.map(s => s.name.toLowerCase()).includes(r.name.toLowerCase())
                      return (
                        <div key={i} style={{ background: '#fafafa', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f0f0f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>{r.name}</div>
                            <div style={{ fontSize: '11px', color: !r.valid ? '#E24B4A' : exists ? '#aaa' : '#3B6D11', fontWeight: '500' }}>{!r.valid ? 'Invalid' : exists ? 'Exists' : '✓ New'}</div>
                          </div>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>{r.category || '--'} · {r.bottle_size_oz} oz · {r.bottle_cost ? fmt(r.bottle_cost) : '--'}</div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead><tr>{['Name', 'Category', 'Size (oz)', 'Cost', 'Distributor', 'Status'].map((h, i) => <th key={i} style={{ textAlign: 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {spiritImportPreview.map((r, i) => {
                        const exists = spirits.map(s => s.name.toLowerCase()).includes(r.name.toLowerCase())
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                            <td style={{ padding: '7px 10px', fontWeight: '500', color: '#000' }}>{r.name}</td>
                            <td style={{ padding: '7px 10px', color: '#666' }}>{r.category || '--'}</td>
                            <td style={{ padding: '7px 10px', color: '#666' }}>{r.bottle_size_oz || '--'}</td>
                            <td style={{ padding: '7px 10px', color: '#666' }}>{r.bottle_cost ? fmt(r.bottle_cost) : '--'}</td>
                            <td style={{ padding: '7px 10px', color: '#666' }}>{r.distributor || '--'}</td>
                            <td style={{ padding: '7px 10px' }}>{!r.valid ? <span style={{ color: '#E24B4A', fontSize: '11px' }}>Missing size/cost</span> : exists ? <span style={{ color: '#aaa', fontSize: '11px' }}>Exists</span> : <span style={{ color: '#3B6D11', fontSize: '11px' }}>✓ New</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {showSpiritForm && <SpiritForm form={spiritForm} setForm={setSpiritForm} saving={saving} isMobile={isMobile} editingId={editingSpiritId} onSave={saveSpiritForm} onCancel={() => setShowSpiritForm(false)} />}

            {spirits.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No spirits yet.</div>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {spirits.map(s => (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1, marginRight: '12px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{s.category || '--'}{s.distributor ? ` · ${s.distributor}` : ''}</div>
                      </div>
                      <button onClick={() => { setSpiritForm({ name: s.name, category: s.category || '', bottle_size_oz: s.bottle_size_oz, bottle_cost: s.bottle_cost, distributor: s.distributor || '', notes: s.notes || '' }); setEditingSpiritId(s.id); setShowSpiritForm(true) }} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                      <div><div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Size</div><div style={{ fontSize: '13px', fontWeight: '500', color: '#555' }}>{s.bottle_size_oz} oz</div></div>
                      <div><div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Cost</div><div style={{ fontSize: '13px', fontWeight: '500', color: '#555' }}>{fmt(s.bottle_cost)}</div></div>
                      <div><div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Cost/oz</div><div style={{ fontSize: '13px', fontWeight: '700', color: '#F5B800' }}>{fmt(costOz(s))}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Item / Spirit', 'Category', 'Size (oz)', 'Bottle Cost', 'Cost/oz', 'Cost/¼oz', 'Distributor', ''].map((h, i) => <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {spirits.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{s.name}</td>
                        <td style={{ padding: '10px 12px' }}>{s.category && <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{s.category}</span>}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', fontSize: '13px' }}>{s.bottle_size_oz}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt(s.bottle_cost)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{fmt(costOz(s))}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#F5B800', fontWeight: '600', fontSize: '12px' }}>{fmt(costOz(s) / 4)}</td>
                        <td style={{ padding: '10px 12px', color: '#aaa', fontSize: '12px' }}>{s.distributor || '--'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}><button onClick={() => { setSpiritForm({ name: s.name, category: s.category || '', bottle_size_oz: s.bottle_size_oz, bottle_cost: s.bottle_cost, distributor: s.distributor || '', notes: s.notes || '' }); setEditingSpiritId(s.id); setShowSpiritForm(true) }} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* RECIPES */}
        {view === 'recipes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>Recipes</h1>
                {!isMobile && <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Cocktail costing and margin analysis</p>}
              </div>
              <button onClick={() => openRecipeForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Recipe</button>
            </div>

            {showRecipeForm && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>{editingRecipeId ? 'Edit Recipe' : 'Add Recipe'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Cocktail Name</label><input style={inputStyle} placeholder="Paper Plane" value={recipeForm.name} onChange={e => setRecipeForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><label style={labelStyle}>Menu Price ($)</label><input style={inputStyle} type="number" step="0.01" placeholder="13.00" value={recipeForm.menu_price} onChange={e => setRecipeForm(f => ({ ...f, menu_price: e.target.value }))} /></div>
                  <div><label style={labelStyle}>Target Cost %</label><input style={inputStyle} type="number" step="0.01" placeholder="0.20" value={recipeForm.target_cost_pct} onChange={e => setRecipeForm(f => ({ ...f, target_cost_pct: e.target.value }))} /></div>
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Ingredients</div>
                {recipeIngs.map((ing, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 60px 60px 28px' : '1fr 2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select style={inputStyle} value={ing.source_type} onChange={e => setRecipeIngs(ri => ri.map((r, j) => j === i ? { ...r, source_type: e.target.value, source_id: '' } : r))}>
                      <option value="spirit">Spirit</option>
                      <option value="prep_item">Prep Item</option>
                      <option value="prep_ingredient">Prep Ing</option>
                    </select>
                    <select style={inputStyle} value={ing.source_id} onChange={e => setRecipeIngs(ri => ri.map((r, j) => j === i ? { ...r, source_id: e.target.value } : r))}>
                      <option value="">-- Select --</option>
                      {ing.source_type === 'spirit' && spirits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      {ing.source_type === 'prep_item' && prepItems.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      {ing.source_type === 'prep_ingredient' && prepIngredients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input style={inputStyle} type="number" step="0.01" placeholder="qty" value={ing.quantity} onChange={e => setRecipeIngs(ri => ri.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} />
                    <select style={inputStyle} value={ing.unit} onChange={e => setRecipeIngs(ri => ri.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
                    <button onClick={() => setRecipeIngs(ri => ri.length > 1 ? ri.filter((_, j) => j !== i) : ri)} style={{ background: '#333', border: 'none', color: '#fff', width: '28px', height: '36px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                  </div>
                ))}
                <button onClick={() => setRecipeIngs(ri => [...ri, { source_type: 'spirit', source_id: '', ingredient_name: '', quantity: '', unit: 'oz' }])} style={{ width: '100%', border: '1px dashed #e0e0e0', background: 'none', color: '#aaa', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '14px' }}>+ Add Ingredient</button>
                {liveRecipeCost() > 0 && recipeForm.menu_price > 0 && (
                  <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', textAlign: 'center' }}>
                    {[
                      { label: 'Total Cost', val: fmt(liveRecipeCost()), color: '#000' },
                      { label: 'Actual %', val: Math.round((liveRecipeCost() / recipeForm.menu_price) * 1000) / 10 + '%', color: liveRecipeCost() / recipeForm.menu_price <= parseFloat(recipeForm.target_cost_pct) ? '#3B6D11' : '#E24B4A' },
                      { label: 'Gross Profit', val: fmt(recipeForm.menu_price - liveRecipeCost()), color: '#3B6D11' },
                      { label: 'Margin', val: Math.round(((recipeForm.menu_price - liveRecipeCost()) / recipeForm.menu_price) * 1000) / 10 + '%', color: '#000' },
                    ].map(p => <div key={p.label}><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{p.label}</div><div style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: p.color }}>{p.val}</div></div>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowRecipeForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveRecipeForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Recipe'}</button>
                </div>
              </div>
            )}

            {recipes.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No recipes yet. Add spirits first, then build your recipes.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px,1fr))', gap: isMobile ? '12px' : '20px' }}>
                {recipes.map(r => {
                  const cost = getRecipeCost(r)
                  const pct = r.menu_price > 0 ? cost / r.menu_price : 0
                  const gp = r.menu_price - cost
                  const onBudget = r.menu_price > 0 && pct <= r.target_cost_pct
                  const ings = recipeIngredients.filter(ri => ri.recipe_id === r.id)
                  return (
                    <div key={r.id} onClick={() => openRecipeForm(r)} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
                      <div style={{ background: '#111', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>{r.name}</div>
                        <div style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', background: onBudget ? '#EAF3DE' : '#FAEEDA', color: onBudget ? '#3B6D11' : '#854F0B' }}>{onBudget ? 'On Budget' : 'Over'}</div>
                      </div>
                      <div style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                          {[{ label: 'Menu Price', val: fmt(r.menu_price) }, { label: 'Total Cost', val: fmt(cost) }, { label: 'Actual %', val: Math.round(pct * 1000) / 10 + '%', color: onBudget ? '#3B6D11' : '#E24B4A' }, { label: 'Target %', val: Math.round(r.target_cost_pct * 100) + '%', color: '#c89000' }].map(m => <div key={m.label} style={{ background: '#f5f5f3', borderRadius: '8px', padding: '8px 10px' }}><div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>{m.label}</div><div style={{ fontSize: '14px', fontWeight: '700', color: m.color || '#000' }}>{m.val}</div></div>)}
                        </div>
                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                          {ings.slice(0, 4).map(ing => { const icost = fmt(getRecipeIngredientCost(ing)); return <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderBottom: '1px solid #f9f9f9' }}><span style={{ color: '#555' }}>{getRecipeIngredientName(ing)}</span><span style={{ color: '#aaa' }}>{ing.quantity} {ing.unit}</span><span style={{ fontWeight: '500', color: '#000' }}>{icost}</span></div> })}
                          {ings.length > 4 && <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>+{ings.length - 4} more</div>}
                        </div>
                      </div>
                      <div style={{ padding: '10px 18px 14px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0', fontSize: '12px' }}>
                        <span style={{ color: '#aaa' }}>GP: <strong style={{ color: '#3B6D11' }}>{fmt(gp)}</strong></span>
                        <span style={{ color: '#aaa' }}>Margin: <strong style={{ color: '#000' }}>{Math.round(r.menu_price > 0 ? (gp / r.menu_price) * 1000 / 10 : 0)}%</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* PREP COSTING */}
        {view === 'prep' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>Prep Costing</h1>
                {!isMobile && <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Syrups, batches, infusions, and more</p>}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { setPrepView('ingredients'); setShowPrepIngForm(true); setPrepIngForm({ name: '', unit: '', cost_per_unit: '' }); setEditingPrepIngId(null) }} style={{ background: '#444', color: '#fff', border: 'none', padding: isMobile ? '8px 10px' : '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ {isMobile ? 'Ing' : 'Ingredient'}</button>
                <button onClick={() => { setPrepView('items'); openPrepItemForm() }} style={{ background: '#333', color: '#fff', border: 'none', padding: isMobile ? '8px 10px' : '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ {isMobile ? 'Prep' : 'Prep Item'}</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[{ key: 'items', label: `Prep Items (${prepItems.length})` }, { key: 'ingredients', label: `Ingredients (${prepIngredients.length})` }].map(t => (
                <button key={t.key} onClick={() => setPrepView(t.key)} style={{ padding: '7px 14px', border: '1px solid', borderColor: prepView === t.key ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: prepView === t.key ? '700' : '400', cursor: 'pointer', background: prepView === t.key ? '#F5B800' : '#fff', color: prepView === t.key ? '#000' : '#666' }}>{t.label}</button>
              ))}
            </div>

            {/* PREP INGREDIENTS */}
            {prepView === 'ingredients' && (
              <>
                {showPrepIngForm && <PrepIngForm form={prepIngForm} setForm={setPrepIngForm} saving={saving} isMobile={isMobile} editingId={editingPrepIngId} onSave={savePrepIngForm} onCancel={() => setShowPrepIngForm(false)} />}
                {prepIngredients.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No prep ingredients yet.</div>
                ) : isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {prepIngredients.map(pi => (
                      <div key={pi.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{pi.name}</div>
                          <div style={{ fontSize: '12px', color: '#aaa' }}>{pi.unit || '--'} · {fmt(pi.cost_per_unit)} per unit</div>
                        </div>
                        <button onClick={() => { setPrepIngForm({ name: pi.name, unit: pi.unit || '', cost_per_unit: pi.cost_per_unit }); setEditingPrepIngId(pi.id); setShowPrepIngForm(true) }} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['Ingredient', 'Unit', 'Cost per Unit', ''].map((h, i) => <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {prepIngredients.map(pi => (
                          <tr key={pi.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{pi.name}</td>
                            <td style={{ padding: '10px 14px', color: '#555', fontSize: '13px' }}>{pi.unit || '--'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt(pi.cost_per_unit)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}><button onClick={() => { setPrepIngForm({ name: pi.name, unit: pi.unit || '', cost_per_unit: pi.cost_per_unit }); setEditingPrepIngId(pi.id); setShowPrepIngForm(true) }} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* PREP ITEMS */}
            {prepView === 'items' && (
              <>
                {showPrepItemForm && (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>{editingPrepItemId ? 'Edit Prep Item' : 'Add Prep Item'}</h3>

                    {/* Source type toggle */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                      {[
                        { key: 'made', label: '🧪 Recipe (built from ingredients)' },
                        { key: 'purchased', label: '🧾 Purchased (enter cost directly)' },
                      ].map(opt => (
                        <button key={opt.key} onClick={() => setPrepItemForm(f => ({ ...f, source_type: opt.key }))}
                          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid', borderColor: prepItemForm.source_type === opt.key ? '#F5B800' : '#e8e8e8', background: prepItemForm.source_type === opt.key ? '#fffbe6' : '#fff', color: prepItemForm.source_type === opt.key ? '#a07800' : '#888', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textAlign: 'center' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>{prepItemForm.source_type === 'purchased' ? 'Item Name' : 'Prep Item Name'}</label><input style={inputStyle} placeholder={prepItemForm.source_type === 'purchased' ? 'Liquid Alchemist Orgeat' : 'Demerara Syrup 2:1'} value={prepItemForm.name} onChange={e => setPrepItemForm(f => ({ ...f, name: e.target.value }))} /></div>
                      <div><label style={labelStyle}>Category</label><select style={inputStyle} value={prepItemForm.category} onChange={e => setPrepItemForm(f => ({ ...f, category: e.target.value }))}><option value="">-- Select --</option>{PREP_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div><label style={labelStyle}>{prepItemForm.source_type === 'purchased' ? 'Size' : 'Yield Amount'}</label><input style={inputStyle} type="number" step="0.01" placeholder={prepItemForm.source_type === 'purchased' ? '25.36' : '32'} value={prepItemForm.yield_amount} onChange={e => setPrepItemForm(f => ({ ...f, yield_amount: e.target.value }))} /></div>
                        <div><label style={labelStyle}>{prepItemForm.source_type === 'purchased' ? 'Size Unit' : 'Yield Unit'}</label><select style={inputStyle} value={prepItemForm.yield_unit} onChange={e => setPrepItemForm(f => ({ ...f, yield_unit: e.target.value }))}>{YIELD_UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
                      </div>
                      {prepItemForm.source_type === 'purchased' && (
                        <div><label style={labelStyle}>Total Cost ($)</label><input style={inputStyle} type="number" step="0.01" placeholder="20.75" value={prepItemForm.purchase_cost} onChange={e => setPrepItemForm(f => ({ ...f, purchase_cost: e.target.value }))} /></div>
                      )}
                      <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Notes</label><input style={inputStyle} placeholder={prepItemForm.source_type === 'purchased' ? 'Distributor, case size, etc.' : 'Store refrigerated for up to 2 weeks'} value={prepItemForm.notes} onChange={e => setPrepItemForm(f => ({ ...f, notes: e.target.value }))} /></div>
                    </div>

                    {prepItemForm.source_type === 'made' && (
                      <>
                        <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Ingredients</div>
                        {prepItemIngs.map((ing, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 60px 60px 28px' : '1fr 2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            <select style={inputStyle} value={ing.source_type} onChange={e => setPrepItemIngs(pi => pi.map((r, j) => j === i ? { ...r, source_type: e.target.value, source_id: '' } : r))}>
                              <option value="prep_ingredient">Prep Ing</option>
                              <option value="spirit">Spirit</option>
                              <option value="prep_item">Prep Item</option>
                            </select>
                            <select style={inputStyle} value={ing.source_id} onChange={e => setPrepItemIngs(pi => pi.map((r, j) => j === i ? { ...r, source_id: e.target.value } : r))}>
                              <option value="">-- Select --</option>
                              {ing.source_type === 'prep_ingredient' && prepIngredients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              {ing.source_type === 'spirit' && spirits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              {ing.source_type === 'prep_item' && prepItems.filter(p => p.id !== editingPrepItemId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input style={inputStyle} type="number" step="0.01" placeholder="qty" value={ing.quantity} onChange={e => setPrepItemIngs(pi => pi.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} />
                            <select style={inputStyle} value={ing.unit} onChange={e => setPrepItemIngs(pi => pi.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))}>{PREP_UNITS.map(u => <option key={u}>{u}</option>)}</select>
                            <button onClick={() => setPrepItemIngs(pi => pi.length > 1 ? pi.filter((_, j) => j !== i) : pi)} style={{ background: '#333', border: 'none', color: '#fff', width: '28px', height: '36px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                          </div>
                        ))}
                        <button onClick={() => setPrepItemIngs(pi => [...pi, { source_type: 'prep_ingredient', source_id: '', quantity: '', unit: 'oz' }])} style={{ width: '100%', border: '1px dashed #e0e0e0', background: 'none', color: '#aaa', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '14px' }}>+ Add Ingredient</button>
                      </>
                    )}

                    {currentLiveCost() > 0 && prepItemForm.yield_amount > 0 && (
                      <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', textAlign: 'center' }}>
                        {[{ label: prepItemForm.source_type === 'purchased' ? 'Total Cost' : 'Batch Cost', val: fmt(currentLiveCost()) }, { label: `Per ${prepItemForm.yield_unit || 'oz'}`, val: fmt(currentLiveCost() / parseFloat(prepItemForm.yield_amount)) }, { label: prepItemForm.source_type === 'purchased' ? 'Size' : 'Yield', val: prepItemForm.yield_amount + ' ' + (prepItemForm.yield_unit || 'oz') }].map(p => <div key={p.label}><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{p.label}</div><div style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#000' }}>{p.val}</div></div>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setShowPrepItemForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={savePrepItemForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Prep Item'}</button>
                    </div>
                  </div>
                )}
                {prepItems.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No prep items yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px,1fr))', gap: isMobile ? '12px' : '16px' }}>
                    {prepItems.map(item => {
                      const cost = getPrepItemCost(item)
                      const costPerUnit = item.yield_amount > 0 ? cost / item.yield_amount : 0
                      const ings = prepItemIngredients.filter(pii => pii.prep_item_id === item.id)
                      const isPurchased = item.source_type === 'purchased'
                      return (
                        <div key={item.id} onClick={() => openPrepItemForm(item)} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
                          <div style={{ background: '#111', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{item.name}</div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {isPurchased && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: '#444', color: '#fff' }}>🧾 Purchased</span>}
                              {item.category && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: '#F5B800', color: '#000', fontWeight: '600' }}>{item.category}</span>}
                            </div>
                          </div>
                          <div style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                              {[{ label: isPurchased ? 'Total Cost' : 'Batch Cost', val: fmt(cost) }, { label: `Per ${item.yield_unit || 'oz'}`, val: fmt(costPerUnit) }, { label: isPurchased ? 'Size' : 'Yield', val: item.yield_amount + ' ' + (item.yield_unit || 'oz') }].map(m => <div key={m.label} style={{ background: '#f5f5f3', borderRadius: '8px', padding: '8px 10px' }}><div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>{m.label}</div><div style={{ fontSize: '13px', fontWeight: '700', color: '#000' }}>{m.val}</div></div>)}
                            </div>
                            {!isPurchased && (
                              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                                {ings.slice(0, 4).map(ing => <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderBottom: '1px solid #f9f9f9' }}><span style={{ color: '#555' }}>{getIngredientName(ing)}</span><span style={{ color: '#aaa' }}>{ing.quantity} {ing.unit}</span></div>)}
                                {ings.length > 4 && <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>+{ings.length - 4} more</div>}
                              </div>
                            )}
                            {item.notes && <div style={{ marginTop: '8px', fontSize: '11px', color: '#aaa', fontStyle: 'italic' }}>{item.notes}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}