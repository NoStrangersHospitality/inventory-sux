'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function COGS() {
  const [profile, setProfile] = useState(null)
  const [spirits, setSpirits] = useState([])
  const [recipes, setRecipes] = useState([])
  const [recipeIngredients, setRecipeIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('hub')
  const [showSpiritForm, setShowSpiritForm] = useState(false)
  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [editingSpiritId, setEditingSpiritId] = useState(null)
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [spiritForm, setSpiritForm] = useState({ name: '', category: '', bottle_size_oz: '', bottle_cost: '', distributor: '', notes: '' })
  const [recipeForm, setRecipeForm] = useState({ name: '', menu_price: '', target_cost_pct: '0.20' })
  const [recipeIngs, setRecipeIngs] = useState([{ spirit_id: '', ingredient_name: '', quantity: '', unit: 'oz' }])
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = ['Bourbon', 'Rye', 'Scotch', 'Irish', 'Japanese', 'Whiskey', 'Tequila', 'Mezcal', 'Vodka', 'Gin', 'Rum', 'Brandy', 'Liqueur', 'Aperitif', 'Bitters', 'Other']
  const UNITS = ['oz', 'dash', 'tsp', 'tbsp']

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)
      await loadData(session.user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadData = async (userId) => {
    const { data: sp } = await supabase.from('spirits').select('*').eq('user_id', userId).order('name')
    const { data: rc } = await supabase.from('recipes').select('*').eq('user_id', userId).order('name')
    const { data: ri } = await supabase.from('recipe_ingredients').select('*').eq('user_id', userId)
    setSpirits(sp || [])
    setRecipes(rc || [])
    setRecipeIngredients(ri || [])
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const costOz = (s) => s.bottle_size_oz > 0 ? s.bottle_cost / s.bottle_size_oz : 0

  const unitToOz = (qty, unit) => {
    if (unit === 'dash') return qty * 0.03
    if (unit === 'tsp') return qty * 0.17
    if (unit === 'tbsp') return qty * 0.5
    return qty
  }

  const getRecipeCost = (recipe) => {
    const ings = recipeIngredients.filter(ri => ri.recipe_id === recipe.id)
    return ings.reduce((total, ing) => {
      const spirit = spirits.find(s => s.id === ing.spirit_id)
      if (!spirit) return total
      return total + costOz(spirit) * unitToOz(ing.quantity, ing.unit)
    }, 0)
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  const saveSpiritForm = async () => {
    if (!spiritForm.name || !spiritForm.bottle_size_oz || !spiritForm.bottle_cost) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const payload = { name: spiritForm.name, category: spiritForm.category, bottle_size_oz: parseFloat(spiritForm.bottle_size_oz), bottle_cost: parseFloat(spiritForm.bottle_cost), distributor: spiritForm.distributor, notes: spiritForm.notes, user_id: session.user.id }
    if (editingSpiritId) {
      await supabase.from('spirits').update(payload).eq('id', editingSpiritId)
    } else {
      await supabase.from('spirits').insert(payload)
    }
    await loadData(session.user.id)
    setShowSpiritForm(false)
    setSaving(false)
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
    const validIngs = recipeIngs.filter(i => i.spirit_id && i.quantity)
    if (validIngs.length > 0) {
      await supabase.from('recipe_ingredients').insert(validIngs.map(i => ({ recipe_id: recipeId, user_id: session.user.id, spirit_id: i.spirit_id, ingredient_name: spirits.find(s => s.id === i.spirit_id)?.name || '', quantity: parseFloat(i.quantity), unit: i.unit })))
    }
    await loadData(session.user.id)
    setShowRecipeForm(false)
    setSaving(false)
  }

  const openRecipeForm = (recipe = null) => {
    if (recipe) {
      setRecipeForm({ name: recipe.name, menu_price: recipe.menu_price, target_cost_pct: recipe.target_cost_pct })
      setEditingRecipeId(recipe.id)
      const ings = recipeIngredients.filter(ri => ri.recipe_id === recipe.id)
      setRecipeIngs(ings.length ? ings.map(i => ({ spirit_id: i.spirit_id, ingredient_name: i.ingredient_name, quantity: i.quantity, unit: i.unit })) : [{ spirit_id: '', ingredient_name: '', quantity: '', unit: 'oz' }])
    } else {
      setRecipeForm({ name: '', menu_price: '', target_cost_pct: '0.20' })
      setEditingRecipeId(null)
      setRecipeIngs([{ spirit_id: '', ingredient_name: '', quantity: '', unit: 'oz' }])
    }
    setShowRecipeForm(true)
  }

  const liveRecipeCost = () => recipeIngs.reduce((total, ing) => {
    const spirit = spirits.find(s => s.id === ing.spirit_id)
    if (!spirit || !ing.quantity) return total
    return total + costOz(spirit) * unitToOz(parseFloat(ing.quantity), ing.unit)
  }, 0)

  if (loading) return <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#aaa' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => view === 'hub' ? router.push('/foh') : setView('hub')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {view === 'hub' ? 'FOH' : 'COGS'}
        </button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* HUB */}
        {view === 'hub' && (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>COGS</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '24px' }}>Recipe costing and margin analysis.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {[
                { title: 'Spirits Database', desc: 'Ingredients and cost per oz', icon: '🍾', view: 'spirits' },
                { title: 'Recipes', desc: 'Cocktail costing and margins', icon: '📋', view: 'recipes' },
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

        {/* SPIRITS DATABASE */}
        {view === 'spirits' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Spirits Database</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Ingredients and cost per oz</p>
              </div>
              <button onClick={() => { setSpiritForm({ name: '', category: '', bottle_size_oz: '', bottle_cost: '', distributor: '', notes: '' }); setEditingSpiritId(null); setShowSpiritForm(true) }}
                style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                + Add Spirit
              </button>
            </div>

            {showSpiritForm && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingSpiritId ? 'Edit Spirit' : 'Add Spirit'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Item / Spirit Name</label>
                    <input style={inputStyle} placeholder="Buffalo Trace Bourbon" value={spiritForm.name} onChange={e => setSpiritForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select style={inputStyle} value={spiritForm.category} onChange={e => setSpiritForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">-- Select --</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Bottle Size (oz)</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="25.36" value={spiritForm.bottle_size_oz} onChange={e => setSpiritForm(f => ({ ...f, bottle_size_oz: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Bottle Cost ($)</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="35.10" value={spiritForm.bottle_cost} onChange={e => setSpiritForm(f => ({ ...f, bottle_cost: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Distributor</label>
                    <input style={inputStyle} placeholder="Republic National" value={spiritForm.distributor} onChange={e => setSpiritForm(f => ({ ...f, distributor: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Notes</label>
                    <input style={inputStyle} placeholder="750ml, special order..." value={spiritForm.notes} onChange={e => setSpiritForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowSpiritForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveSpiritForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Saving...' : 'Save Spirit'}
                  </button>
                </div>
              </div>
            )}

            {spirits.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No spirits yet. Add your first ingredient.</div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Item / Spirit', 'Category', 'Size (oz)', 'Bottle Cost', 'Cost/oz', 'Cost/¼oz', 'Distributor', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
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
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button onClick={() => { setSpiritForm({ name: s.name, category: s.category || '', bottle_size_oz: s.bottle_size_oz, bottle_cost: s.bottle_cost, distributor: s.distributor || '', notes: s.notes || '' }); setEditingSpiritId(s.id); setShowSpiritForm(true) }}
                            style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                        </td>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Recipes</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Cocktail costing and margin analysis</p>
              </div>
              <button onClick={() => openRecipeForm()} style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add Recipe</button>
            </div>

            {showRecipeForm && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>{editingRecipeId ? 'Edit Recipe' : 'Add Recipe'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Cocktail Name</label>
                    <input style={inputStyle} placeholder="Paper Plane" value={recipeForm.name} onChange={e => setRecipeForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Menu Price ($)</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="13.00" value={recipeForm.menu_price} onChange={e => setRecipeForm(f => ({ ...f, menu_price: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Target Cost %</label>
                    <input style={inputStyle} type="number" step="0.01" placeholder="0.20" value={recipeForm.target_cost_pct} onChange={e => setRecipeForm(f => ({ ...f, target_cost_pct: e.target.value }))} />
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Ingredients</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '6px' }}>
                  {['Ingredient', 'Qty', 'Unit', ''].map(h => <div key={h} style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</div>)}
                </div>
                {recipeIngs.map((ing, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select style={inputStyle} value={ing.spirit_id} onChange={e => setRecipeIngs(ri => ri.map((r, j) => j === i ? { ...r, spirit_id: e.target.value } : r))}>
                      <option value="">-- Select spirit --</option>
                      {spirits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input style={inputStyle} type="number" step="0.01" placeholder="oz" value={ing.quantity} onChange={e => setRecipeIngs(ri => ri.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} />
                    <select style={inputStyle} value={ing.unit} onChange={e => setRecipeIngs(ri => ri.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <button onClick={() => setRecipeIngs(ri => ri.length > 1 ? ri.filter((_, j) => j !== i) : ri)}
                      style={{ background: '#333', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                  </div>
                ))}
                <button onClick={() => setRecipeIngs(ri => [...ri, { spirit_id: '', ingredient_name: '', quantity: '', unit: 'oz' }])}
                  style={{ width: '100%', border: '1px dashed #e0e0e0', background: 'none', color: '#aaa', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '14px' }}>
                  + Add Ingredient
                </button>

                {liveRecipeCost() > 0 && recipeForm.menu_price > 0 && (
                  <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', textAlign: 'center' }}>
                    {[
                      { label: 'Total Cost', val: fmt(liveRecipeCost()), color: '#000' },
                      { label: 'Actual %', val: Math.round((liveRecipeCost() / recipeForm.menu_price) * 1000) / 10 + '%', color: liveRecipeCost() / recipeForm.menu_price <= parseFloat(recipeForm.target_cost_pct) ? '#3B6D11' : '#E24B4A' },
                      { label: 'Gross Profit', val: fmt(recipeForm.menu_price - liveRecipeCost()), color: '#3B6D11' },
                      { label: 'Margin', val: Math.round(((recipeForm.menu_price - liveRecipeCost()) / recipeForm.menu_price) * 1000) / 10 + '%', color: '#000' },
                    ].map(p => (
                      <div key={p.label}>
                        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{p.label}</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: p.color }}>{p.val}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowRecipeForm(false)} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveRecipeForm} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Saving...' : 'Save Recipe'}
                  </button>
                </div>
              </div>
            )}

            {recipes.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No recipes yet. Add spirits first, then build your recipes.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: '20px' }}>
                {recipes.map(r => {
                  const cost = getRecipeCost(r)
                  const pct = r.menu_price > 0 ? cost / r.menu_price : 0
                  const gp = r.menu_price - cost
                  const onBudget = r.menu_price > 0 && pct <= r.target_cost_pct
                  const ings = recipeIngredients.filter(ri => ri.recipe_id === r.id)
                  return (
                    <div key={r.id} onClick={() => openRecipeForm(r)} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .15s' }}
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
                            { label: 'Total Cost', val: fmt(cost) },
                            { label: 'Actual %', val: Math.round(pct * 1000) / 10 + '%', color: onBudget ? '#3B6D11' : '#E24B4A' },
                            { label: 'Target %', val: Math.round(r.target_cost_pct * 100) + '%', color: '#c89000' },
                          ].map(m => (
                            <div key={m.label} style={{ background: '#f5f5f3', borderRadius: '8px', padding: '8px 10px' }}>
                              <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>{m.label}</div>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: m.color || '#000' }}>{m.val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                          {ings.slice(0, 4).map(ing => {
                            const sp = spirits.find(s => s.id === ing.spirit_id)
                            const icost = sp ? fmt(costOz(sp) * unitToOz(ing.quantity, ing.unit)) : '--'
                            return (
                              <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderBottom: '1px solid #f9f9f9' }}>
                                <span style={{ color: '#555' }}>{ing.ingredient_name}</span>
                                <span style={{ color: '#aaa' }}>{ing.quantity} {ing.unit}</span>
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