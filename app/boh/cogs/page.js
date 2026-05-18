'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOHCOGS() {
  const [ingredients, setIngredients] = useState([])
  const [recipes, setRecipes] = useState([])
  const [recipeIngredients, setRecipeIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('hub')
  const [showIngForm, setShowIngForm] = useState(false)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [editingIngId, setEditingIngId] = useState(null)
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [ingForm, setIngForm] = useState({ name: '', category: '', item_type: 'dry', purchase_qty: '', purchase_unit: 'lb', purchase_cost: '', density: '', vendor: '', notes: '' })
  const [recipeForm, setRecipeForm] = useState({ name: '', menu_price: '', target_cost_pct: '0.30', yield_portions: '1' })
  const [recipeIngs, setRecipeIngs] = useState([{ ingredient_id: '', ingredient_name: '', quantity: '', unit: 'g' }])
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = ['Proteins', 'Produce', 'Dairy', 'Dry Goods', 'Dry Spices', 'Oils & Fats', 'Sauces & Condiments', 'Beverages', 'Other']

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
    const [{ data: ings }, { data: recs }, { data: ri }] = await Promise.all([
      supabase.from('ingredients').select('*').eq('user_id', userId).order('name'),
      supabase.from('boh_recipes').select('*').eq('user_id', userId).order('name'),
      supabase.from('boh_recipe_ingredients').select('*').eq('user_id', userId)
    ])
    setIngredients(ings || [])
    setRecipes(recs || [])
    setRecipeIngredients(ri || [])
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

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  const saveIngForm = async () => {
    if (!ingForm.name || !ingForm.purchase_qty || !ingForm.purchase_cost) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = {
      name: ingForm.name, category: ingForm.category, item_type: ingForm.item_type,
      purchase_qty: parseFloat(ingForm.purchase_qty),
      purchase_unit: ingForm.purchase_unit,
      purchase_cost: parseFloat(ingForm.purchase_cost),
      density: parseFloat(ingForm.density) || null,
      vendor: ingForm.vendor, notes: ingForm.notes,
      user_id: session.user.id
    }
    if (editingIngId) {
      await supabase.from('ingredients').update(payload).eq('id', editingIngId)
    } else {
      await supabase.from('ingredients').insert(payload)
    }
    await loadData(session.user.id)
    setShowIngForm(false)
    setSaving(false)
  }

  const saveRecipeForm = async () => {
    if (!recipeForm.name) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    let recipeId = editingRecipeId
    if (editingRecipeId) {
      await supabase.from('boh_recipes').update({
        name: recipeForm.name, menu_price: parseFloat(recipeForm.menu_price) || 0,
        target_cost_pct: parseFloat(recipeForm.target_cost_pct) || 0.30,
        yield_portions: parseInt(recipeForm.yield_portions) || 1
      }).eq('id', editingRecipeId)
      await supabase.from('boh_recipe_ingredients').delete().eq('recipe_id', editingRecipeId)
    } else {
      const { data } = await supabase.from('boh_recipes').insert({
        name: recipeForm.name, menu_price: parseFloat(recipeForm.menu_price) || 0,
        target_cost_pct: parseFloat(recipeForm.target_cost_pct) || 0.30,
        yield_portions: parseInt(recipeForm.yield_portions) || 1,
        user_id: session.user.id
      }).select().single()
      recipeId = data.id
    }
    const valid = recipeIngs.filter(i => i.ingredient_id && i.quantity)
    if (valid.length > 0) {
      await supabase.from('boh_recipe_ingredients').insert(valid.map(i => ({
        recipe_id: recipeId, user_id: session.user.id,
        ingredient_id: i.ingredient_id,
        ingredient_name: ingredients.find(ing => ing.id === i.ingredient_id)?.name || '',
        quantity: parseFloat(i.quantity), unit: i.unit
      })))
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

  if (loading) return <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#aaa' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => view === 'hub' ? router.push('/boh') : setView('hub')}
          style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {view === 'hub' ? 'BOH' : 'BOH COGS'}
        </button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* HUB */}
        {view === 'hub' && (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>BOH COGS</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '24px' }}>Ingredient costing and kitchen recipe margins.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {[
                { title: 'Ingredients Database', desc: 'Purchase costs and unit conversions', icon: '🧂', view: 'ingredients' },
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
              <button onClick={() => { setIngForm({ name: '', category: '', item_type: 'dry', purchase_qty: '', purchase_unit: 'lb', purchase_cost: '', density: '', vendor: '', notes: '' }); setEditingIngId(null); setShowIngForm(true) }}
                style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                + Add Ingredient
              </button>
            </div>

            {showIngForm && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingIngId ? 'Edit Ingredient' : 'Add Ingredient'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Ingredient Name</label>
                    <input style={inputStyle} placeholder="Smoked Paprika" value={ingForm.name} onChange={e => setIngForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select style={inputStyle} value={ingForm.category} onChange={e => setIngForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">-- Select --</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select style={inputStyle} value={ingForm.item_type} onChange={e => setIngForm(f => ({ ...f, item_type: e.target.value, purchase_unit: e.target.value === 'dry' ? 'lb' : 'L' }))}>
                      <option value="dry">Dry / Weight</option>
                      <option value="liquid">Liquid / Volume</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Purchase Quantity</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="16" value={ingForm.purchase_qty} onChange={e => setIngForm(f => ({ ...f, purchase_qty: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Purchase Unit</label>
                    <select style={inputStyle} value={ingForm.purchase_unit} onChange={e => setIngForm(f => ({ ...f, purchase_unit: e.target.value }))}>
                      {(ingForm.item_type === 'dry' ? DRY_UNITS : LIQUID_UNITS).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Purchase Cost ($)</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="8.99" value={ingForm.purchase_cost} onChange={e => setIngForm(f => ({ ...f, purchase_cost: e.target.value }))} />
                  </div>
                  {ingForm.item_type === 'dry' && (
                    <div>
                      <label style={labelStyle}>Density (g/ml) <span style={{ color: '#aaa', fontSize: '10px', fontWeight: 400 }}>optional — for cross-unit recipes</span></label>
                      <input style={inputStyle} type="number" step="0.001" placeholder="water=1.0, flour≈0.53, salt≈1.22" value={ingForm.density} onChange={e => setIngForm(f => ({ ...f, density: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Vendor</label>
                    <input style={inputStyle} placeholder="Sysco, US Foods..." value={ingForm.vendor} onChange={e => setIngForm(f => ({ ...f, vendor: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Notes</label>
                    <input style={inputStyle} placeholder="Brand, spec, storage..." value={ingForm.notes} onChange={e => setIngForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>

                {ingForm.purchase_qty && ingForm.purchase_cost && (
                  <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', textAlign: 'center' }}>
                    {(() => {
                      const mock = { purchase_qty: parseFloat(ingForm.purchase_qty), purchase_unit: ingForm.purchase_unit, purchase_cost: parseFloat(ingForm.purchase_cost), density: parseFloat(ingForm.density) || null }
                      const cpg = ingCostPerG(mock)
                      const cpml = ingCostPerML(mock)
                      return [
                        { label: 'Cost per gram', val: cpg ? ('$' + cpg.toFixed(5)) : '--' },
                        { label: 'Cost per ml', val: cpml ? ('$' + cpml.toFixed(5)) : '--' },
                        { label: 'Cost per oz (wt)', val: cpg ? ('$' + (cpg * 28.3495).toFixed(4)) : '--', gold: true },
                      ].map(p => (
                        <div key={p.label}>
                          <div style={{ fontSize: '11px', color: p.gold ? '#F5B800' : '#aaa', marginBottom: '3px' }}>{p.label}</div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: p.gold ? '#F5B800' : '#000' }}>{p.val}</div>
                        </div>
                      ))
                    })()}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowIngForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveIngForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Saving...' : 'Save Ingredient'}
                  </button>
                </div>
              </div>
            )}

            {ingredients.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No ingredients yet. Add your first one.</div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Ingredient', 'Category', 'Type', 'Purchase', 'Cost', 'Cost/g or /ml', 'Density', 'Vendor', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map(ing => {
                      const cpg = ingCostPerG(ing)
                      const cpml = ingCostPerML(ing)
                      const unitLabel = ALL_UNITS.find(u => u.value === ing.purchase_unit)?.label || ing.purchase_unit
                      return (
                        <tr key={ing.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{ing.name}</td>
                          <td style={{ padding: '10px 12px' }}>{ing.category && <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{ing.category}</span>}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: ing.item_type === 'dry' ? '#FAEEDA' : '#E6F1FB', color: ing.item_type === 'dry' ? '#854F0B' : '#185FA5', border: `1px solid ${ing.item_type === 'dry' ? '#f0c080' : '#b5d4f4'}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>
                              {ing.item_type === 'dry' ? 'Dry' : 'Liquid'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#555', fontSize: '12px' }}>{ing.purchase_qty} {unitLabel}</td>
                          <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt(ing.purchase_cost)}</td>
                          <td style={{ padding: '10px 12px', color: '#555', fontSize: '11px' }}>{cpg ? ('$' + cpg.toFixed(5) + '/g') : (cpml ? ('$' + cpml.toFixed(5) + '/ml') : '--')}</td>
                          <td style={{ padding: '10px 12px', color: '#aaa', fontSize: '12px' }}>{ing.density || '--'}</td>
                          <td style={{ padding: '10px 12px', color: '#aaa', fontSize: '12px' }}>{ing.vendor || '--'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button onClick={() => { setIngForm({ name: ing.name, category: ing.category || '', item_type: ing.item_type || 'dry', purchase_qty: ing.purchase_qty, purchase_unit: ing.purchase_unit, purchase_cost: ing.purchase_cost, density: ing.density || '', vendor: ing.vendor || '', notes: ing.notes || '' }); setEditingIngId(ing.id); setShowIngForm(true) }}
                              style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* KITCHEN RECIPES */}
        {view === 'recipes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Kitchen Recipes</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Food recipe costing and margin analysis</p>
              </div>
              <button onClick={() => openRecipeForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Recipe</button>
            </div>

            {showRecipeForm && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingRecipeId ? 'Edit Recipe' : 'Add Kitchen Recipe'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Recipe Name</label>
                    <input style={inputStyle} placeholder="Pan Seared Chicken Thigh" value={recipeForm.name} onChange={e => setRecipeForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Menu Price ($)</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="28.00" value={recipeForm.menu_price} onChange={e => setRecipeForm(f => ({ ...f, menu_price: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Target Cost %</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="0.30" value={recipeForm.target_cost_pct} onChange={e => setRecipeForm(f => ({ ...f, target_cost_pct: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Yield / Portions</label>
                    <input style={inputStyle} type="number" step="1" placeholder="1" value={recipeForm.yield_portions} onChange={e => setRecipeForm(f => ({ ...f, yield_portions: e.target.value }))} />
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Ingredients</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '6px' }}>
                  {['Ingredient', 'Qty', 'Unit', ''].map(h => <div key={h} style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</div>)}
                </div>
                {recipeIngs.map((ri, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select style={inputStyle} value={ri.ingredient_id} onChange={e => setRecipeIngs(prev => prev.map((r, j) => j === i ? { ...r, ingredient_id: e.target.value } : r))}>
                      <option value="">-- Select ingredient --</option>
                      {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                    </select>
                    <input style={inputStyle} type="number" step="0.01" placeholder="qty" value={ri.quantity} onChange={e => setRecipeIngs(prev => prev.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} />
                    <select style={inputStyle} value={ri.unit} onChange={e => setRecipeIngs(prev => prev.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))}>
                      {ALL_UNITS.map(u => <option key={u.value} value={u.value}>{u.value === 'oz_w' ? 'oz (wt)' : u.value}</option>)}
                    </select>
                    <button onClick={() => setRecipeIngs(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}
                      style={{ background: '#333', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                  </div>
                ))}
                <button onClick={() => setRecipeIngs(prev => [...prev, { ingredient_id: '', ingredient_name: '', quantity: '', unit: 'g' }])}
                  style={{ width: '100%', border: '1px dashed #e0e0e0', background: 'none', color: '#aaa', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '14px' }}>
                  + Add Ingredient
                </button>

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
                      {[
                        { label: 'Total Cost', val: fmt(total), color: '#000' },
                        { label: 'Portion Cost', val: fmt(portionCost), color: '#000' },
                        { label: 'Actual %', val: Math.round(pct * 1000) / 10 + '%', color: pct <= target ? '#3B6D11' : '#E24B4A' },
                        { label: 'Gross Profit', val: fmt(gp), color: '#3B6D11' },
                      ].map(p => (
                        <div key={p.label}>
                          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{p.label}</div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: p.color }}>{p.val}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowRecipeForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveRecipeForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Saving...' : 'Save Recipe'}
                  </button>
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
                    <div key={r.id} onClick={() => openRecipeForm(r)}
                      style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
                      <div style={{ background: '#111', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>{r.name}</div>
                        <div style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', background: onBudget ? '#EAF3DE' : '#FAEEDA', color: onBudget ? '#3B6D11' : '#854F0B' }}>
                          {onBudget ? 'On Budget' : 'Over Budget'}
                        </div>
                      </div>
                      <div style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                          {[
                            { label: 'Menu Price', val: fmt(r.menu_price) },
                            { label: 'Total Cost', val: fmt(totalCost) },
                            { label: 'Portion Cost', val: fmt(portionCost), color: onBudget ? '#3B6D11' : '#E24B4A' },
                            { label: 'Yield', val: yld + ' portion' + (yld !== 1 ? 's' : ''), color: '#c89000' },
                          ].map(m => (
                            <div key={m.label} style={{ background: '#f5f5f3', borderRadius: '8px', padding: '8px 10px' }}>
                              <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>{m.label}</div>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: m.color || '#000' }}>{m.val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                          {ings.slice(0, 4).map(ri => {
                            const ing = ingredients.find(i => i.id === ri.ingredient_id)
                            const icost = ing ? fmt(recipeIngCost(ing, ri.quantity, ri.unit)) : '--'
                            const unitDisp = ri.unit === 'oz_w' ? 'oz' : ri.unit
                            return (
                              <div key={ri.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderBottom: '1px solid #f9f9f9' }}>
                                <span style={{ color: '#555' }}>{ri.ingredient_name}</span>
                                <span style={{ color: '#aaa' }}>{ri.quantity} {unitDisp}</span>
                                <span style={{ fontWeight: '500', color: '#000' }}>{icost}</span>
                              </div>
                            )
                          })}
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