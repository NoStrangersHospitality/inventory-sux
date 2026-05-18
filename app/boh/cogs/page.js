'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOHCOGS() {
  const [ingredients, setIngredients] = useState([])
  const [recipes, setRecipes] = useState([])
  const [recipeIngredients, setRecipeIngredients] = useState([])
  const [prepIngredients, setPrepIngredients] = useState([])
  const [prepItems, setPrepItems] = useState([])
  const [prepItemIngredients, setPrepItemIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('hub')
  const [prepView, setPrepView] = useState('items')
  const [showIngForm, setShowIngForm] = useState(false)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [showPrepIngForm, setShowPrepIngForm] = useState(false)
  const [showPrepItemForm, setShowPrepItemForm] = useState(false)
  const [editingIngId, setEditingIngId] = useState(null)
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [editingPrepIngId, setEditingPrepIngId] = useState(null)
  const [editingPrepItemId, setEditingPrepItemId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importingIngs, setImportingIngs] = useState(false)
  const [ingImportPreview, setIngImportPreview] = useState(null)
  const [ingForm, setIngForm] = useState({ name: '', category: '', item_type: 'dry', purchase_qty: '', purchase_unit: 'lb', purchase_cost: '', density: '', vendor: '', notes: '' })
  const [recipeForm, setRecipeForm] = useState({ name: '', menu_price: '', target_cost_pct: '0.30', yield_portions: '1' })
  const [recipeIngs, setRecipeIngs] = useState([{ ingredient_id: '', ingredient_name: '', quantity: '', unit: 'g' }])
  const [prepIngForm, setPrepIngForm] = useState({ name: '', unit: '', cost_per_unit: '' })
  const [prepItemForm, setPrepItemForm] = useState({ name: '', category: '', yield_amount: '', yield_unit: 'oz', notes: '' })
  const [prepItemIngs, setPrepItemIngs] = useState([{ source_type: 'prep_ingredient', source_id: '', quantity: '', unit: 'oz' }])
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = ['Proteins', 'Produce', 'Dairy', 'Dry Goods', 'Dry Spices', 'Oils & Fats', 'Sauces & Condiments', 'Beverages', 'Other']
  const PREP_CATEGORIES = ['Syrup', 'Batch', 'Infusion', 'Tincture', 'Shrub', 'Juice', 'Puree', 'Sauce', 'Stock', 'Other']
  const PREP_UNITS = ['oz', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'lb', 'g', 'each']
  const YIELD_UNITS = ['oz', 'ml', 'l', 'cup', 'serving', 'portion', 'batch']

  const UNIT_TO_G = { g: 1, oz_w: 28.3495, lb: 453.592 }
  const UNIT_TO_ML = { ml: 1, fl_oz: 29.5735, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, pt: 473.176, qt: 946.353, L: 1000 }

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
  const ALL_UNITS = [...DRY_UNITS, ...LIQUID_UNITS]

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
    const [{ data: ings }, { data: recs }, { data: ri }, { data: pi }, { data: pit }, { data: pii }] = await Promise.all([
      supabase.from('ingredients').select('*').eq('user_id', userId).order('name'),
      supabase.from('boh_recipes').select('*').eq('user_id', userId).order('name'),
      supabase.from('boh_recipe_ingredients').select('*').eq('user_id', userId),
      supabase.from('prep_ingredients').select('*').eq('user_id', userId).order('name'),
      supabase.from('prep_items').select('*').eq('user_id', userId).order('name'),
      supabase.from('prep_item_ingredients').select('*').eq('user_id', userId),
    ])
    setIngredients(ings || [])
    setRecipes(recs || [])
    setRecipeIngredients(ri || [])
    setPrepIngredients(pi || [])
    setPrepItems(pit || [])
    setPrepItemIngredients(pii || [])
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)

  const ingCostPerG = (ing) => {
    if (!ing || !ing.purchase_qty || !ing.purchase_cost) return null
    const g = UNIT_TO_G[ing.purchase_unit] ? ing.purchase_qty * UNIT_TO_G[ing.purchase_unit] : null
    if (g) return ing.purchase_cost / g
    const ml = UNIT_TO_ML[ing.purchase_unit] ? ing.purchase_qty * UNIT_TO_ML[ing.purchase_unit] : null
    if (ml && ing.density) return (ing.purchase_cost / ml) * ing.density
    return null
  }

  const ingCostPerML = (ing) => {
    if (!ing || !ing.purchase_qty || !ing.purchase_cost) return null
    const ml = UNIT_TO_ML[ing.purchase_unit] ? ing.purchase_qty * UNIT_TO_ML[ing.purchase_unit] : null
    if (ml) return ing.purchase_cost / ml
    const g = UNIT_TO_G[ing.purchase_unit] ? ing.purchase_qty * UNIT_TO_G[ing.purchase_unit] : null
    if (g && ing.density) return (ing.purchase_cost / g) / ing.density
    return null
  }

  const recipeIngCost = (ing, qty, unit) => {
    if (!ing || !qty || !unit) return 0
    const cpg = ingCostPerG(ing)
    const cpml = ingCostPerML(ing)
    const g = UNIT_TO_G[unit] ? qty * UNIT_TO_G[unit] : null
    const ml = UNIT_TO_ML[unit] ? qty * UNIT_TO_ML[unit] : null
    if (g !== null && cpg !== null) return g * cpg
    if (ml !== null && cpml !== null) return ml * cpml
    if (ml !== null && cpg !== null && ing.density) return ml * ing.density * cpg
    if (g !== null && cpml !== null && ing.density) return (g / ing.density) * cpml
    return 0
  }

  const getRecipeCost = (recipe) => {
    const ings = recipeIngredients.filter(ri => ri.recipe_id === recipe.id)
    return ings.reduce((total, ri) => {
      const ing = ingredients.find(i => i.id === ri.ingredient_id)
      if (!ing) return total
      return total + recipeIngCost(ing, ri.quantity, ri.unit)
    }, 0)
  }

  const liveRecipeCost = () => recipeIngs.reduce((total, ri) => {
    const ing = ingredients.find(i => i.id === ri.ingredient_id)
    if (!ing || !ri.quantity) return total
    return total + recipeIngCost(ing, parseFloat(ri.quantity), ri.unit)
  }, 0)

  const convertToBase = (qty, fromUnit) => {
    const weightToG = { g: 1, oz_w: 28.3495, lb: 453.592 }
    const volumeToMl = { ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, oz: 29.5735, fl_oz: 29.5735, pt: 473.176, qt: 946.353 }
    if (weightToG[fromUnit] !== undefined) return { base: qty * weightToG[fromUnit], type: 'weight' }
    if (volumeToMl[fromUnit] !== undefined) return { base: qty * volumeToMl[fromUnit], type: 'volume' }
    return { base: qty, type: 'unknown' }
  }

  const convertFromBase = (base, toUnit, type) => {
    const weightFromG = { g: 1, oz_w: 28.3495, lb: 453.592 }
    const volumeFromMl = { ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, oz: 29.5735, fl_oz: 29.5735, pt: 473.176, qt: 946.353 }
    if (type === 'weight' && weightFromG[toUnit]) return base / weightFromG[toUnit]
    if (type === 'volume' && volumeFromMl[toUnit]) return base / volumeFromMl[toUnit]
    return base
  }

  const convertQty = (qty, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return qty
    const { base, type } = convertToBase(qty, fromUnit)
    return convertFromBase(base, toUnit, type)
  }

  const getPrepItemCost = (prepItem) => {
    const ings = prepItemIngredients.filter(pii => pii.prep_item_id === prepItem.id)
    return ings.reduce((total, ing) => {
      if (ing.source_type === 'prep_ingredient') {
        const pi = prepIngredients.find(p => p.id === ing.source_id)
        if (!pi) return total
        const convertedQty = convertQty(ing.quantity, ing.unit, pi.unit)
        return total + (pi.cost_per_unit * convertedQty)
      }
      if (ing.source_type === 'prep_item') {
        const nested = prepItems.find(p => p.id === ing.source_id)
        if (!nested || !nested.yield_amount) return total
        const nestedCost = getPrepItemCost(nested)
        const convertedQty = convertQty(ing.quantity, ing.unit, nested.yield_unit)
        return total + (nestedCost / nested.yield_amount) * convertedQty
      }
      return total
    }, 0)
  }

  const livePrepCost = () => prepItemIngs.reduce((total, ing) => {
    if (!ing.source_id || !ing.quantity) return total
    if (ing.source_type === 'prep_ingredient') {
      const pi = prepIngredients.find(p => p.id === ing.source_id)
      if (!pi) return total
      const convertedQty = convertQty(parseFloat(ing.quantity), ing.unit, pi.unit)
      return total + pi.cost_per_unit * convertedQty
    }
    if (ing.source_type === 'prep_item') {
      const nested = prepItems.find(p => p.id === ing.source_id)
      if (!nested || !nested.yield_amount) return total
      const nestedCost = getPrepItemCost(nested)
      const convertedQty = convertQty(parseFloat(ing.quantity), ing.unit, nested.yield_unit)
      return total + (nestedCost / nested.yield_amount) * convertedQty
    }
    return total
  }, 0)

  const getIngredientName = (ing) => {
    if (ing.source_type === 'prep_ingredient') return prepIngredients.find(p => p.id === ing.source_id)?.name || '--'
    if (ing.source_type === 'prep_item') return prepItems.find(p => p.id === ing.source_id)?.name || '--'
    return '--'
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const outlineBtn = { background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }

  const saveIngForm = async () => {
    if (!ingForm.name || !ingForm.purchase_qty || !ingForm.purchase_cost) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { name: ingForm.name, category: ingForm.category, item_type: ingForm.item_type, purchase_qty: parseFloat(ingForm.purchase_qty), purchase_unit: ingForm.purchase_unit, purchase_cost: parseFloat(ingForm.purchase_cost), density: parseFloat(ingForm.density) || null, vendor: ingForm.vendor, notes: ingForm.notes, user_id: session.user.id }
    if (editingIngId) {
      await supabase.from('ingredients').update(payload).eq('id', editingIngId)
    } else {
      await supabase.from('ingredients').insert(payload)
    }
    await loadData(session.user.id)
    setShowIngForm(false)
    setSaving(false)
  }

  const exportIngredients = () => {
    const rows = [['Name', 'Category', 'Type', 'Purchase Qty', 'Purchase Unit', 'Purchase Cost ($)', 'Density (g/ml)', 'Vendor', 'Notes']]
    ingredients.forEach(i => rows.push([i.name, i.category || '', i.item_type || 'dry', i.purchase_qty, i.purchase_unit, i.purchase_cost, i.density || '', i.vendor || '', i.notes || '']))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'boh_ingredients.csv'
    a.click()
  }

  const downloadIngsTemplate = () => {
    const rows = [
      ['Name', 'Category', 'Type', 'Purchase Qty', 'Purchase Unit', 'Purchase Cost ($)', 'Density (g/ml)', 'Vendor', 'Notes'],
      ['Smoked Paprika', 'Dry Spices', 'dry', '1', 'lb', '8.99', '', 'Sysco', ''],
      ['Heavy Cream', 'Dairy', 'liquid', '1', 'L', '4.50', '1.01', 'US Foods', ''],
      ['Chicken Breast', 'Proteins', 'dry', '1', 'lb', '3.99', '', 'Sysco', 'boneless skinless'],
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'boh_ingredients_template.csv'
    a.click()
  }

  const handleIngsImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l)
      if (lines.length < 2) return
      const hdr = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
      const ni = hdr.findIndex(h => h.includes('name'))
      const cati = hdr.findIndex(h => h.includes('cat'))
      const ti = hdr.findIndex(h => h.includes('type'))
      const pqi = hdr.findIndex(h => h.includes('qty') || h.includes('quantity'))
      const pui = hdr.findIndex(h => h.includes('unit'))
      const pci = hdr.findIndex(h => h.includes('cost'))
      const di = hdr.findIndex(h => h.includes('density'))
      const vi = hdr.findIndex(h => h.includes('vendor'))
      const noi = hdr.findIndex(h => h.includes('note'))
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const name = cols[ni >= 0 ? ni : 0] || ''
        if (!name) continue
        const item_type = (cols[ti >= 0 ? ti : 2] || 'dry').toLowerCase().includes('liquid') ? 'liquid' : 'dry'
        const purchase_qty = parseFloat(cols[pqi >= 0 ? pqi : 3]) || 0
        const purchase_cost = parseFloat(cols[pci >= 0 ? pci : 5]) || 0
        parsed.push({
          name,
          category: cols[cati >= 0 ? cati : 1] || '',
          item_type,
          purchase_qty,
          purchase_unit: cols[pui >= 0 ? pui : 4] || (item_type === 'dry' ? 'lb' : 'L'),
          purchase_cost,
          density: parseFloat(cols[di >= 0 ? di : 6]) || null,
          vendor: cols[vi >= 0 ? vi : 7] || '',
          notes: cols[noi >= 0 ? noi : 8] || '',
          valid: purchase_qty > 0 && purchase_cost > 0
        })
      }
      setIngImportPreview(parsed)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const confirmIngsImport = async () => {
    if (!ingImportPreview) return
    setImportingIngs(true)
    const { data: { session } } = await supabase.auth.getSession()
    const existingNames = ingredients.map(i => i.name.toLowerCase())
    const toInsert = ingImportPreview.filter(r => r.valid && !existingNames.includes(r.name.toLowerCase()))
    if (toInsert.length > 0) {
      await supabase.from('ingredients').insert(toInsert.map(r => ({
        name: r.name,
        category: r.category,
        item_type: r.item_type,
        purchase_qty: r.purchase_qty,
        purchase_unit: r.purchase_unit,
        purchase_cost: r.purchase_cost,
        density: r.density,
        vendor: r.vendor,
        notes: r.notes,
        user_id: session.user.id
      })))
      await loadData(session.user.id)
    }
    setIngImportPreview(null)
    setImportingIngs(false)
  }

  const saveRecipeForm = async () => {
    if (!recipeForm.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    let recipeId = editingRecipeId
    if (editingRecipeId) {
      await supabase.from('boh_recipes').update({ name: recipeForm.name, menu_price: parseFloat(recipeForm.menu_price) || 0, target_cost_pct: parseFloat(recipeForm.target_cost_pct) || 0.30, yield_portions: parseInt(recipeForm.yield_portions) || 1 }).eq('id', editingRecipeId)
      await supabase.from('boh_recipe_ingredients').delete().eq('recipe_id', editingRecipeId)
    } else {
      const { data } = await supabase.from('boh_recipes').insert({ name: recipeForm.name, menu_price: parseFloat(recipeForm.menu_price) || 0, target_cost_pct: parseFloat(recipeForm.target_cost_pct) || 0.30, yield_portions: parseInt(recipeForm.yield_portions) || 1, user_id: session.user.id }).select().single()
      recipeId = data.id
    }
    const valid = recipeIngs.filter(i => i.ingredient_id && i.quantity)
    if (valid.length > 0) {
      await supabase.from('boh_recipe_ingredients').insert(valid.map(i => ({ recipe_id: recipeId, user_id: session.user.id, ingredient_id: i.ingredient_id, ingredient_name: ingredients.find(ing => ing.id === i.ingredient_id)?.name || '', quantity: parseFloat(i.quantity), unit: i.unit })))
    }
    await loadData(session.user.id)
    setShowRecipeForm(false)
    setSaving(false)
  }

  const openRecipeForm = (recipe = null) => {
    if (recipe) {
      setRecipeForm({ name: recipe.name, menu_price: recipe.menu_price, target_cost_pct: recipe.target_cost_pct, yield_portions: recipe.yield_portions || 1 })
      setEditingRecipeId(recipe.id)
      const ings = recipeIngredients.filter(ri => ri.recipe_id === recipe.id)
      setRecipeIngs(ings.length ? ings.map(i => ({ ingredient_id: i.ingredient_id, ingredient_name: i.ingredient_name, quantity: i.quantity, unit: i.unit })) : [{ ingredient_id: '', ingredient_name: '', quantity: '', unit: 'g' }])
    } else {
      setRecipeForm({ name: '', menu_price: '', target_cost_pct: '0.30', yield_portions: '1' })
      setEditingRecipeId(null)
      setRecipeIngs([{ ingredient_id: '', ingredient_name: '', quantity: '', unit: 'g' }])
    }
    setShowRecipeForm(true)
  }

  const savePrepIngForm = async () => {
    if (!prepIngForm.name || !prepIngForm.cost_per_unit) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { name: prepIngForm.name, unit: prepIngForm.unit, cost_per_unit: parseFloat(prepIngForm.cost_per_unit), user_id: session.user.id }
    if (editingPrepIngId) {
      await supabase.from('prep_ingredients').update(payload).eq('id', editingPrepIngId)
    } else {
      await supabase.from('prep_ingredients').insert(payload)
    }
    await loadData(session.user.id)
    setShowPrepIngForm(false)
    setSaving(false)
  }

  const savePrepItemForm = async () => {
    if (!prepItemForm.name || !prepItemForm.yield_amount) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    let prepItemId = editingPrepItemId
    if (editingPrepItemId) {
      await supabase.from('prep_items').update({ name: prepItemForm.name, category: prepItemForm.category, yield_amount: parseFloat(prepItemForm.yield_amount), yield_unit: prepItemForm.yield_unit, notes: prepItemForm.notes }).eq('id', editingPrepItemId)
      await supabase.from('prep_item_ingredients').delete().eq('prep_item_id', editingPrepItemId)
    } else {
      const { data } = await supabase.from('prep_items').insert({ name: prepItemForm.name, category: prepItemForm.category, yield_amount: parseFloat(prepItemForm.yield_amount), yield_unit: prepItemForm.yield_unit, notes: prepItemForm.notes, user_id: session.user.id }).select().single()
      prepItemId = data.id
    }
    const validIngs = prepItemIngs.filter(i => i.source_id && i.quantity)
    if (validIngs.length > 0) {
      await supabase.from('prep_item_ingredients').insert(validIngs.map(i => ({ prep_item_id: prepItemId, user_id: session.user.id, source_type: i.source_type, source_id: i.source_id, quantity: parseFloat(i.quantity), unit: i.unit })))
    }
    await loadData(session.user.id)
    setShowPrepItemForm(false)
    setSaving(false)
  }

  const openPrepItemForm = (item = null) => {
    if (item) {
      setPrepItemForm({ name: item.name, category: item.category || '', yield_amount: item.yield_amount, yield_unit: item.yield_unit || 'oz', notes: item.notes || '' })
      setEditingPrepItemId(item.id)
      const ings = prepItemIngredients.filter(pii => pii.prep_item_id === item.id)
      setPrepItemIngs(ings.length ? ings.map(i => ({ source_type: i.source_type, source_id: i.source_id, quantity: i.quantity, unit: i.unit })) : [{ source_type: 'prep_ingredient', source_id: '', quantity: '', unit: 'oz' }])
    } else {
      setPrepItemForm({ name: '', category: '', yield_amount: '', yield_unit: 'oz', notes: '' })
      setEditingPrepItemId(null)
      setPrepItemIngs([{ source_type: 'prep_ingredient', source_id: '', quantity: '', unit: 'oz' }])
    }
    setShowPrepItemForm(true)
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#aaa' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => view === 'hub' ? router.push('/boh') : setView('hub')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {view === 'hub' ? 'BOH' : 'BOH COGS'}
        </button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* HUB */}
        {view === 'hub' && (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>BOH COGS</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '24px' }}>Ingredient costing and kitchen recipe margins.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              {[
                { title: 'Ingredients Database', desc: 'Purchase costs and unit conversions', icon: '🧂', view: 'ingredients' },
                { title: 'Prep Costing', desc: 'Syrups, stocks, sauces, and batches', icon: '🧪', view: 'prep' },
                { title: 'Kitchen Recipes', desc: 'Food recipe costing and margins', icon: '👨‍🍳', view: 'recipes' },
              ].map(t => (
                <div key={t.title} onClick={() => setView(t.view)}
                  style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '36px 28px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
                  <div style={{ fontSize: '40px', marginBottom: '14px' }}>{t.icon}</div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>{t.title}</div>
                  <div style={{ fontSize: '13px', color: '#aaa' }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* INGREDIENTS DATABASE */}
        {view === 'ingredients' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Ingredients Database</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Purchase costs and unit conversions</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={downloadIngsTemplate} style={outlineBtn}>↓ Template</button>
                {ingredients.length > 0 && <button onClick={exportIngredients} style={outlineBtn}>↓ Export</button>}
                <label style={{ ...outlineBtn, display: 'inline-block' }}>
                  ↑ Import
                  <input type="file" accept=".csv" onChange={handleIngsImport} style={{ display: 'none' }} />
                </label>
                <button onClick={() => { setIngForm({ name: '', category: '', item_type: 'dry', purchase_qty: '', purchase_unit: 'lb', purchase_cost: '', density: '', vendor: '', notes: '' }); setEditingIngId(null); setShowIngForm(true) }}
                  style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  + Add Ingredient
                </button>
              </div>
            </div>

            {/* Import Preview */}
            {ingImportPreview && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Import Preview</div>
                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                      {ingImportPreview.filter(r => r.valid).length} valid · {ingImportPreview.filter(r => !r.valid).length} invalid · {ingImportPreview.filter(r => r.valid && !ingredients.map(i => i.name.toLowerCase()).includes(r.name.toLowerCase())).length} new
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setIngImportPreview(null)} style={outlineBtn}>Cancel</button>
                    <button onClick={confirmIngsImport} disabled={importingIngs} style={{ background: importingIngs ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: importingIngs ? 'not-allowed' : 'pointer' }}>
                      {importingIngs ? 'Importing...' : 'Confirm Import'}
                    </button>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>{['Name', 'Category', 'Type', 'Purchase', 'Cost', 'Vendor', 'Status'].map((h, i) => <th key={i} style={{ textAlign: 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {ingImportPreview.map((r, i) => {
                      const exists = ingredients.map(ing => ing.name.toLowerCase()).includes(r.name.toLowerCase())
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                          <td style={{ padding: '7px 10px', fontWeight: '500', color: '#000' }}>{r.name}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.category || '--'}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.item_type}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.purchase_qty} {r.purchase_unit}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.purchase_cost ? fmt(r.purchase_cost) : '--'}</td>
                          <td style={{ padding: '7px 10px', color: '#666' }}>{r.vendor || '--'}</td>
                          <td style={{ padding: '7px 10px' }}>
                            {!r.valid ? <span style={{ color: '#E24B4A', fontSize: '11px' }}>Missing qty/cost</span>
                              : exists ? <span style={{ color: '#aaa', fontSize: '11px' }}>Already exists</span>
                              : <span style={{ color: '#3B6D11', fontSize: '11px' }}>✓ Ready</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {showIngForm && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingIngId ? 'Edit Ingredient' : 'Add Ingredient'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Ingredient Name</label><input style={inputStyle} placeholder="Smoked Paprika" value={ingForm.name} onChange={e => setIngForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><label style={labelStyle}>Category</label><select style={inputStyle} value={ingForm.category} onChange={e => setIngForm(f => ({ ...f, category: e.target.value }))}><option value="">-- Select --</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                  <div><label style={labelStyle}>Type</label><select style={inputStyle} value={ingForm.item_type} onChange={e => setIngForm(f => ({ ...f, item_type: e.target.value, purchase_unit: e.target.value === 'dry' ? 'lb' : 'L' }))}><option value="dry">Dry / Weight</option><option value="liquid">Liquid / Volume</option></select></div>
                  <div><label style={labelStyle}>Purchase Quantity</label><input style={inputStyle} type="number" step="0.01" placeholder="16" value={ingForm.purchase_qty} onChange={e => setIngForm(f => ({ ...f, purchase_qty: e.target.value }))} /></div>
                  <div><label style={labelStyle}>Purchase Unit</label><select style={inputStyle} value={ingForm.purchase_unit} onChange={e => setIngForm(f => ({ ...f, purchase_unit: e.target.value }))}>{(ingForm.item_type === 'dry' ? DRY_UNITS : LIQUID_UNITS).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></div>
                  <div><label style={labelStyle}>Purchase Cost ($)</label><input style={inputStyle} type="number" step="0.01" placeholder="8.99" value={ingForm.purchase_cost} onChange={e => setIngForm(f => ({ ...f, purchase_cost: e.target.value }))} /></div>
                  {ingForm.item_type === 'dry' && <div><label style={labelStyle}>Density (g/ml) <span style={{ color: '#aaa', fontSize: '10px', fontWeight: 400 }}>optional</span></label><input style={inputStyle} type="number" step="0.001" placeholder="water=1.0, flour≈0.53" value={ingForm.density} onChange={e => setIngForm(f => ({ ...f, density: e.target.value }))} /></div>}
                  <div><label style={labelStyle}>Vendor</label><input style={inputStyle} placeholder="Sysco, US Foods..." value={ingForm.vendor} onChange={e => setIngForm(f => ({ ...f, vendor: e.target.value }))} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Notes</label><input style={inputStyle} placeholder="Brand, spec, storage..." value={ingForm.notes} onChange={e => setIngForm(f => ({ ...f, notes: e.target.value }))} /></div>
                </div>
                {ingForm.purchase_qty && ingForm.purchase_cost && (() => {
                  const mock = { purchase_qty: parseFloat(ingForm.purchase_qty), purchase_unit: ingForm.purchase_unit, purchase_cost: parseFloat(ingForm.purchase_cost), density: parseFloat(ingForm.density) || null }
                  const cpg = ingCostPerG(mock)
                  const cpml = ingCostPerML(mock)
                  return (
                    <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', textAlign: 'center' }}>
                      {[{ label: 'Cost per gram', val: cpg ? ('$' + cpg.toFixed(5)) : '--' }, { label: 'Cost per ml', val: cpml ? ('$' + cpml.toFixed(5)) : '--' }, { label: 'Cost per oz (wt)', val: cpg ? ('$' + (cpg * 28.3495).toFixed(4)) : '--', gold: true }].map(p => <div key={p.label}><div style={{ fontSize: '11px', color: p.gold ? '#F5B800' : '#aaa', marginBottom: '3px' }}>{p.label}</div><div style={{ fontSize: '16px', fontWeight: '700', color: p.gold ? '#F5B800' : '#000' }}>{p.val}</div></div>)}
                    </div>
                  )
                })()}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowIngForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveIngForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Ingredient'}</button>
                </div>
              </div>
            )}
            {ingredients.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No ingredients yet. Add one or import from CSV.</div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Ingredient', 'Category', 'Type', 'Purchase', 'Cost', 'Cost/g or /ml', 'Vendor', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {ingredients.map(ing => {
                      const cpg = ingCostPerG(ing)
                      const cpml = ingCostPerML(ing)
                      const unitLabel = ALL_UNITS.find(u => u.value === ing.purchase_unit)?.label || ing.purchase_unit
                      return (
                        <tr key={ing.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{ing.name}</td>
                          <td style={{ padding: '10px 12px' }}>{ing.category && <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{ing.category}</span>}</td>
                          <td style={{ padding: '10px 12px' }}><span style={{ background: ing.item_type === 'dry' ? '#FAEEDA' : '#E6F1FB', color: ing.item_type === 'dry' ? '#854F0B' : '#185FA5', border: `1px solid ${ing.item_type === 'dry' ? '#f0c080' : '#b5d4f4'}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{ing.item_type === 'dry' ? 'Dry' : 'Liquid'}</span></td>
                          <td style={{ padding: '10px 12px', color: '#555', fontSize: '12px' }}>{ing.purchase_qty} {unitLabel}</td>
                          <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt(ing.purchase_cost)}</td>
                          <td style={{ padding: '10px 12px', color: '#555', fontSize: '11px' }}>{cpg ? ('$' + cpg.toFixed(5) + '/g') : (cpml ? ('$' + cpml.toFixed(5) + '/ml') : '--')}</td>
                          <td style={{ padding: '10px 12px', color: '#aaa', fontSize: '12px' }}>{ing.vendor || '--'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}><button onClick={() => { setIngForm({ name: ing.name, category: ing.category || '', item_type: ing.item_type || 'dry', purchase_qty: ing.purchase_qty, purchase_unit: ing.purchase_unit, purchase_cost: ing.purchase_cost, density: ing.density || '', vendor: ing.vendor || '', notes: ing.notes || '' }); setEditingIngId(ing.id); setShowIngForm(true) }} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* PREP COSTING */}
        {view === 'prep' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div><h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Prep Costing</h1><p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Stocks, sauces, batches, and more — shared with FOH</p></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setPrepView('ingredients'); setShowPrepIngForm(true); setPrepIngForm({ name: '', unit: '', cost_per_unit: '' }); setEditingPrepIngId(null) }} style={{ background: '#444', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>+ Ingredient</button>
                <button onClick={() => { setPrepView('items'); openPrepItemForm() }} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Prep Item</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[{ key: 'items', label: `Prep Items (${prepItems.length})` }, { key: 'ingredients', label: `Prep Ingredients (${prepIngredients.length})` }].map(t => (
                <button key={t.key} onClick={() => setPrepView(t.key)} style={{ padding: '7px 16px', border: '1px solid', borderColor: prepView === t.key ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: prepView === t.key ? '700' : '400', cursor: 'pointer', background: prepView === t.key ? '#F5B800' : '#fff', color: prepView === t.key ? '#000' : '#666' }}>{t.label}</button>
              ))}
            </div>

            {prepView === 'ingredients' && (
              <>
                {showPrepIngForm && (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingPrepIngId ? 'Edit Ingredient' : 'Add Prep Ingredient'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                      <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Ingredient Name</label><input style={inputStyle} placeholder="White Sugar" value={prepIngForm.name} onChange={e => setPrepIngForm(f => ({ ...f, name: e.target.value }))} /></div>
                      <div><label style={labelStyle}>Unit</label><select style={inputStyle} value={prepIngForm.unit} onChange={e => setPrepIngForm(f => ({ ...f, unit: e.target.value }))}><option value="">-- Select --</option>{PREP_UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
                      <div><label style={labelStyle}>Cost per Unit ($)</label><input style={inputStyle} type="number" step="0.01" placeholder="2.50" value={prepIngForm.cost_per_unit} onChange={e => setPrepIngForm(f => ({ ...f, cost_per_unit: e.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setShowPrepIngForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={savePrepIngForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Ingredient'}</button>
                    </div>
                  </div>
                )}
                {prepIngredients.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No prep ingredients yet.</div>
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

            {prepView === 'items' && (
              <>
                {showPrepItemForm && (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingPrepItemId ? 'Edit Prep Item' : 'Add Prep Item'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                      <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Prep Item Name</label><input style={inputStyle} placeholder="Chicken Stock" value={prepItemForm.name} onChange={e => setPrepItemForm(f => ({ ...f, name: e.target.value }))} /></div>
                      <div><label style={labelStyle}>Category</label><select style={inputStyle} value={prepItemForm.category} onChange={e => setPrepItemForm(f => ({ ...f, category: e.target.value }))}><option value="">-- Select --</option>{PREP_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div><label style={labelStyle}>Yield Amount</label><input style={inputStyle} type="number" step="0.01" placeholder="32" value={prepItemForm.yield_amount} onChange={e => setPrepItemForm(f => ({ ...f, yield_amount: e.target.value }))} /></div>
                        <div><label style={labelStyle}>Yield Unit</label><select style={inputStyle} value={prepItemForm.yield_unit} onChange={e => setPrepItemForm(f => ({ ...f, yield_unit: e.target.value }))}>{YIELD_UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
                      </div>
                      <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Notes</label><input style={inputStyle} placeholder="Refrigerate for up to 5 days..." value={prepItemForm.notes} onChange={e => setPrepItemForm(f => ({ ...f, notes: e.target.value }))} /></div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Ingredients</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr auto', gap: '8px', marginBottom: '6px' }}>{['Source', 'Ingredient', 'Qty', 'Unit', ''].map(h => <div key={h} style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</div>)}</div>
                    {prepItemIngs.map((ing, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                        <select style={inputStyle} value={ing.source_type} onChange={e => setPrepItemIngs(pi => pi.map((r, j) => j === i ? { ...r, source_type: e.target.value, source_id: '' } : r))}>
                          <option value="prep_ingredient">Prep Ingredient</option>
                          <option value="prep_item">Prep Item</option>
                        </select>
                        <select style={inputStyle} value={ing.source_id} onChange={e => setPrepItemIngs(pi => pi.map((r, j) => j === i ? { ...r, source_id: e.target.value } : r))}>
                          <option value="">-- Select --</option>
                          {ing.source_type === 'prep_ingredient' && prepIngredients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          {ing.source_type === 'prep_item' && prepItems.filter(p => p.id !== editingPrepItemId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input style={inputStyle} type="number" step="0.01" placeholder="qty" value={ing.quantity} onChange={e => setPrepItemIngs(pi => pi.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} />
                        <select style={inputStyle} value={ing.unit} onChange={e => setPrepItemIngs(pi => pi.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))}>{PREP_UNITS.map(u => <option key={u}>{u}</option>)}</select>
                        <button onClick={() => setPrepItemIngs(pi => pi.length > 1 ? pi.filter((_, j) => j !== i) : pi)} style={{ background: '#333', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => setPrepItemIngs(pi => [...pi, { source_type: 'prep_ingredient', source_id: '', quantity: '', unit: 'oz' }])} style={{ width: '100%', border: '1px dashed #e0e0e0', background: 'none', color: '#aaa', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '14px' }}>+ Add Ingredient</button>
                    {livePrepCost() > 0 && prepItemForm.yield_amount > 0 && (
                      <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', textAlign: 'center' }}>
                        {[{ label: 'Total Batch Cost', val: fmt(livePrepCost()) }, { label: `Cost per ${prepItemForm.yield_unit || 'oz'}`, val: fmt(livePrepCost() / parseFloat(prepItemForm.yield_amount)) }, { label: 'Yield', val: prepItemForm.yield_amount + ' ' + (prepItemForm.yield_unit || 'oz') }].map(p => <div key={p.label}><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{p.label}</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#000' }}>{p.val}</div></div>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setShowPrepItemForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={savePrepItemForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Prep Item'}</button>
                    </div>
                  </div>
                )}
                {prepItems.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No prep items yet. Add prep ingredients first, then build your stocks, sauces, and batches.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '16px' }}>
                    {prepItems.map(item => {
                      const cost = getPrepItemCost(item)
                      const costPerUnit = item.yield_amount > 0 ? cost / item.yield_amount : 0
                      const ings = prepItemIngredients.filter(pii => pii.prep_item_id === item.id)
                      return (
                        <div key={item.id} onClick={() => openPrepItemForm(item)} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
                          <div style={{ background: '#111', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{item.name}</div>
                            {item.category && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: '#F5B800', color: '#000', fontWeight: '600' }}>{item.category}</span>}
                          </div>
                          <div style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                              {[{ label: 'Batch Cost', val: fmt(cost) }, { label: `Per ${item.yield_unit || 'oz'}`, val: fmt(costPerUnit) }, { label: 'Yield', val: item.yield_amount + ' ' + (item.yield_unit || 'oz') }].map(m => <div key={m.label} style={{ background: '#f5f5f3', borderRadius: '8px', padding: '8px 10px' }}><div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>{m.label}</div><div style={{ fontSize: '13px', fontWeight: '700', color: '#000' }}>{m.val}</div></div>)}
                            </div>
                            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                              {ings.slice(0, 4).map(ing => <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderBottom: '1px solid #f9f9f9' }}><span style={{ color: '#555' }}>{getIngredientName(ing)}</span><span style={{ color: '#aaa' }}>{ing.quantity} {ing.unit}</span></div>)}
                              {ings.length > 4 && <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>+{ings.length - 4} more</div>}
                            </div>
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

        {/* KITCHEN RECIPES */}
        {view === 'recipes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div><h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Kitchen Recipes</h1><p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Food recipe costing and margin analysis</p></div>
              <button onClick={() => openRecipeForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Recipe</button>
            </div>
            {showRecipeForm && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingRecipeId ? 'Edit Recipe' : 'Add Kitchen Recipe'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Recipe Name</label><input style={inputStyle} placeholder="Pan Seared Chicken Thigh" value={recipeForm.name} onChange={e => setRecipeForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><label style={labelStyle}>Menu Price ($)</label><input style={inputStyle} type="number" step="0.01" placeholder="28.00" value={recipeForm.menu_price} onChange={e => setRecipeForm(f => ({ ...f, menu_price: e.target.value }))} /></div>
                  <div><label style={labelStyle}>Target Cost %</label><input style={inputStyle} type="number" step="0.01" placeholder="0.30" value={recipeForm.target_cost_pct} onChange={e => setRecipeForm(f => ({ ...f, target_cost_pct: e.target.value }))} /></div>
                  <div><label style={labelStyle}>Yield / Portions</label><input style={inputStyle} type="number" step="1" placeholder="1" value={recipeForm.yield_portions} onChange={e => setRecipeForm(f => ({ ...f, yield_portions: e.target.value }))} /></div>
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Ingredients</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '6px' }}>{['Ingredient', 'Qty', 'Unit', ''].map(h => <div key={h} style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</div>)}</div>
                {recipeIngs.map((ri, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select style={inputStyle} value={ri.ingredient_id} onChange={e => setRecipeIngs(prev => prev.map((r, j) => j === i ? { ...r, ingredient_id: e.target.value } : r))}><option value="">-- Select ingredient --</option>{ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}</select>
                    <input style={inputStyle} type="number" step="0.01" placeholder="qty" value={ri.quantity} onChange={e => setRecipeIngs(prev => prev.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} />
                    <select style={inputStyle} value={ri.unit} onChange={e => setRecipeIngs(prev => prev.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))}>{ALL_UNITS.map(u => <option key={u.value} value={u.value}>{u.value === 'oz_w' ? 'oz (wt)' : u.value}</option>)}</select>
                    <button onClick={() => setRecipeIngs(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)} style={{ background: '#333', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                  </div>
                ))}
                <button onClick={() => setRecipeIngs(prev => [...prev, { ingredient_id: '', ingredient_name: '', quantity: '', unit: 'g' }])} style={{ width: '100%', border: '1px dashed #e0e0e0', background: 'none', color: '#aaa', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '14px' }}>+ Add Ingredient</button>
                {liveRecipeCost() > 0 && recipeForm.menu_price > 0 && (() => {
                  const total = liveRecipeCost()
                  const yld = parseInt(recipeForm.yield_portions) || 1
                  const portionCost = total / yld
                  const price = parseFloat(recipeForm.menu_price)
                  const pct = portionCost / price
                  const gp = price - portionCost
                  const target = parseFloat(recipeForm.target_cost_pct) || 0.30
                  return (
                    <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', textAlign: 'center' }}>
                      {[{ label: 'Total Cost', val: fmt(total), color: '#000' }, { label: 'Portion Cost', val: fmt(portionCost), color: '#000' }, { label: 'Actual %', val: Math.round(pct * 1000) / 10 + '%', color: pct <= target ? '#3B6D11' : '#E24B4A' }, { label: 'Gross Profit', val: fmt(gp), color: '#3B6D11' }].map(p => <div key={p.label}><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{p.label}</div><div style={{ fontSize: '16px', fontWeight: '700', color: p.color }}>{p.val}</div></div>)}
                    </div>
                  )
                })()}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowRecipeForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveRecipeForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Recipe'}</button>
                </div>
              </div>
            )}
            {recipes.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No recipes yet. Add ingredients first, then build your kitchen recipes.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: '20px' }}>
                {recipes.map(r => {
                  const totalCost = getRecipeCost(r)
                  const yld = r.yield_portions || 1
                  const portionCost = totalCost / yld
                  const pct = r.menu_price > 0 ? portionCost / r.menu_price : 0
                  const gp = r.menu_price - portionCost
                  const onBudget = r.menu_price > 0 && pct <= r.target_cost_pct
                  const ings = recipeIngredients.filter(ri => ri.recipe_id === r.id)
                  return (
                    <div key={r.id} onClick={() => openRecipeForm(r)} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
                      <div style={{ background: '#111', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>{r.name}</div>
                        <div style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', background: onBudget ? '#EAF3DE' : '#FAEEDA', color: onBudget ? '#3B6D11' : '#854F0B' }}>{onBudget ? 'On Budget' : 'Over Budget'}</div>
                      </div>
                      <div style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                          {[{ label: 'Menu Price', val: fmt(r.menu_price) }, { label: 'Total Cost', val: fmt(totalCost) }, { label: 'Portion Cost', val: fmt(portionCost), color: onBudget ? '#3B6D11' : '#E24B4A' }, { label: 'Yield', val: yld + ' portion' + (yld !== 1 ? 's' : ''), color: '#c89000' }].map(m => <div key={m.label} style={{ background: '#f5f5f3', borderRadius: '8px', padding: '8px 10px' }}><div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>{m.label}</div><div style={{ fontSize: '14px', fontWeight: '700', color: m.color || '#000' }}>{m.val}</div></div>)}
                        </div>
                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                          {ings.slice(0, 4).map(ri => { const ing = ingredients.find(i => i.id === ri.ingredient_id); const icost = ing ? fmt(recipeIngCost(ing, ri.quantity, ri.unit)) : '--'; const unitDisp = ri.unit === 'oz_w' ? 'oz' : ri.unit; return <div key={ri.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderBottom: '1px solid #f9f9f9' }}><span style={{ color: '#555' }}>{ri.ingredient_name}</span><span style={{ color: '#aaa' }}>{ri.quantity} {unitDisp}</span><span style={{ fontWeight: '500', color: '#000' }}>{icost}</span></div> })}
                          {ings.length > 4 && <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>+{ings.length - 4} more</div>}
                        </div>
                      </div>
                      <div style={{ padding: '10px 18px 14px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0', fontSize: '12px' }}>
                        <span style={{ color: '#aaa' }}>Gross Profit: <strong style={{ color: '#3B6D11' }}>{fmt(gp)}</strong></span>
                        <span style={{ color: '#aaa' }}>Margin: <strong style={{ color: '#000' }}>{Math.round(r.menu_price > 0 ? (gp / r.menu_price) * 1000 / 10 : 0)}%</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}