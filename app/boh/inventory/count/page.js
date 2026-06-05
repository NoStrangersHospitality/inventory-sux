'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOHCount() {
  const [items, setItems] = useState([])
  const [sessions, setSessions] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('hub')
  const [activeSession, setActiveSession] = useState(null)
  const [countLines, setCountLines] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [activeLocation, setActiveLocation] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [reviewSession, setReviewSession] = useState(null)
  const [reviewLines, setReviewLines] = useState([])
  const [isMobile, setIsMobile] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0])
  const [importCountedBy, setImportCountedBy] = useState('')
  const importRef = useRef()

  const [scope, setScope] = useState('full')
  const [countedBy, setCountedBy] = useState('')
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedLocations, setSelectedLocations] = useState([])

  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const SCOPES = [
    { key: 'full', label: 'Full BOH', desc: 'All kitchen inventory' },
    { key: 'proteins', label: 'Proteins Only', desc: 'Meat, fish, poultry' },
    { key: 'produce', label: 'Produce Only', desc: 'Fruits and vegetables' },
    { key: 'dairy', label: 'Dairy Only', desc: 'Dairy and eggs' },
    { key: 'dry_goods', label: 'Dry Goods Only', desc: 'Dry goods and grains' },
    { key: 'dry_spices', label: 'Dry Spices Only', desc: 'Spices and seasonings' },
  ]

  const DEFAULT_LOCATIONS = [
    { name: 'Walk-in', area: 'boh', sort_order: 1 },
    { name: 'Freezer', area: 'boh', sort_order: 2 },
    { name: 'Dry Storage', area: 'boh', sort_order: 3 },
    { name: 'Line Reach-in', area: 'boh', sort_order: 4 },
  ]

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
    const [{ data: invItems }, { data: locs }, { data: sess }] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('user_id', userId).eq('area', 'boh').order('name'),
      supabase.from('locations').select('*').eq('user_id', userId).eq('area', 'boh').order('sort_order'),
      supabase.from('count_sessions').select('*').eq('user_id', userId).eq('area', 'boh').order('started_at', { ascending: false }).limit(20)
    ])
    setItems(invItems || [])
    setSessions(sess || [])
    if (!locs || locs.length === 0) {
      setLocations(DEFAULT_LOCATIONS.map((l, i) => ({ ...l, id: `default-${i}`, user_id: userId })))
    } else {
      setLocations(locs)
    }
  }

  const getScopedItems = () => scope === 'full' ? items : items.filter(i => i.category === scope)
  const getCategories = () => {
    const scopedItems = getScopedItems()
    return CATEGORIES.filter(c => scopedItems.some(i => i.category === c.key))
  }

  // --- Template download ---
  const downloadTemplate = () => {
    const rows = [['Item Name', 'Category', 'Location', 'Quantity', 'Unit', 'Unit Cost', 'Par']]
    items.forEach(item => {
      rows.push([item.name, item.category, 'Walk-in', item.on_hand || 0, item.unit || '', item.unit_cost || 0, item.par || 0])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `boh_count_template_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // --- CSV import parse ---
  const handleImportFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l)
      if (lines.length < 2) return
      const hdr = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
      const ni = hdr.findIndex(h => h.includes('name') || h.includes('item'))
      const qi = hdr.findIndex(h => h.includes('qty') || h.includes('quantity'))
      const loci = hdr.findIndex(h => h.includes('loc'))
      const parsed = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim())
        const name = cols[ni >= 0 ? ni : 0] || ''
        if (!name) continue
        const qty = parseFloat(cols[qi >= 0 ? qi : 3]) || 0
        const location = cols[loci >= 0 ? loci : 2] || 'Walk-in'
        const matched = items.find(item => item.name.toLowerCase() === name.toLowerCase())
        parsed.push({ name, qty, location, matched_item: matched || null, matched: !!matched })
      }
      setImportPreview(parsed)
      setImportDate(new Date().toISOString().split('T')[0])
    }
    reader.readAsText(file)
    if (importRef.current) importRef.current.value = ''
  }

  // --- Confirm import ---
  const confirmImport = async () => {
    if (!importPreview) return
    setImporting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session.user.id

    const matchedRows = importPreview.filter(r => r.matched)

    const { data: newSession } = await supabase.from('count_sessions').insert({
      user_id: userId, area: 'boh', scope: 'full', status: 'submitted',
      count_date: importDate, counted_by: importCountedBy || 'CSV Import',
      started_at: new Date().toISOString(), submitted_at: new Date().toISOString(),
    }).select().single()

    const countLinesData = matchedRows.map(r => ({
      session_id: newSession.id, user_id: userId,
      inventory_item_id: r.matched_item.id, item_name: r.matched_item.name,
      category: r.matched_item.category, item_type: r.matched_item.item_type || 'weight',
      location_id: null, location_name: r.location || 'Walk-in',
      quantity: r.qty, unit: r.matched_item.unit || '',
      unit_cost: r.matched_item.unit_cost || 0, par: r.matched_item.par || 0,
    }))

    await supabase.from('count_lines').insert(countLinesData)

    const itemTotals = {}
    matchedRows.forEach(r => {
      const id = r.matched_item.id
      if (!itemTotals[id]) itemTotals[id] = { item: r.matched_item, total: 0 }
      itemTotals[id].total += r.qty
    })

    const historyRows = []
    for (const [itemId, data] of Object.entries(itemTotals)) {
      await supabase.from('inventory_items').update({ on_hand: data.total, last_count_date: importDate }).eq('id', itemId)
      historyRows.push({
        user_id: userId, inventory_item_id: itemId, item_name: data.item.name,
        category: data.item.category, area: 'boh', event_type: 'count', event_id: newSession.id,
        quantity_before: data.item.on_hand || 0, quantity_change: data.total - (data.item.on_hand || 0),
        quantity_after: data.total, unit_cost_at_time: data.item.unit_cost || 0,
        total_value_at_time: data.total * (data.item.unit_cost || 0)
      })
    }
    if (historyRows.length > 0) await supabase.from('inventory_history').insert(historyRows)

    const totalValue = Object.values(itemTotals).reduce((sum, d) => sum + (d.total * (d.item.unit_cost || 0)), 0)
    await supabase.from('count_sessions').update({ total_value: totalValue }).eq('id', newSession.id)

    await loadData(userId)
    setImportPreview(null)
    setImporting(false)
  }

  const startSetup = () => {
    setScope('full')
    setCountedBy('')
    setCountDate(new Date().toISOString().split('T')[0])
    setSelectedLocations(locations.map(l => l.id))
    setView('setup')
  }

  const startCount = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const scopedItems = getScopedItems()
    const { data: newSession } = await supabase.from('count_sessions').insert({
      user_id: session.user.id, area: 'boh', scope, status: 'in_progress',
      count_date: countDate, counted_by: countedBy,
    }).select().single()

    let dbLocations = locations.filter(l => !l.id?.startsWith('default-'))
    if (dbLocations.length === 0) {
      const { data: insertedLocs } = await supabase.from('locations').insert(
        DEFAULT_LOCATIONS.map(l => ({ ...l, user_id: session.user.id }))
      ).select()
      dbLocations = insertedLocs || []
      setLocations(dbLocations)
    }
    const locsToUse = dbLocations.length > 0 ? dbLocations : DEFAULT_LOCATIONS.map((l, i) => ({ ...l, id: `default-${i}` }))

    const lines = []
    scopedItems.forEach(item => {
      locsToUse.forEach(loc => {
        lines.push({
          session_id: newSession.id, user_id: session.user.id,
          inventory_item_id: item.id, item_name: item.name, category: item.category,
          item_type: item.item_type || 'weight', location_id: loc.id, location_name: loc.name,
          quantity: 0, unit: item.unit || '', unit_cost: item.unit_cost || 0, par: item.par || 0,
        })
      })
    })

    const { data: insertedLines } = await supabase.from('count_lines').insert(lines).select()
    setActiveSession(newSession)
    setCountLines(insertedLines || [])
    const cats = getCategories()
    setActiveCategory(cats[0]?.key || 'proteins')
    setActiveLocation(locsToUse[0]?.name || 'Walk-in')
    setView('counting')
  }

  const updateLine = async (lineId, qty) => {
    setCountLines(prev => prev.map(l => l.id === lineId ? { ...l, quantity: qty } : l))
    await supabase.from('count_lines').update({ quantity: qty }).eq('id', lineId)
  }

  const submitCount = async () => {
    if (!activeSession) return
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const itemTotals = {}
    countLines.forEach(line => {
      if (!itemTotals[line.inventory_item_id]) {
        itemTotals[line.inventory_item_id] = { total: 0, item_name: line.item_name, category: line.category, unit_cost: line.unit_cost }
      }
      itemTotals[line.inventory_item_id].total += parseFloat(line.quantity) || 0
    })
    const historyRows = []
    for (const [itemId, data] of Object.entries(itemTotals)) {
      const original = items.find(i => i.id === itemId)
      await supabase.from('inventory_items').update({ on_hand: data.total, last_count_date: activeSession.count_date }).eq('id', itemId)
      historyRows.push({
        user_id: session.user.id, inventory_item_id: itemId, item_name: data.item_name,
        category: data.category, area: 'boh', event_type: 'count', event_id: activeSession.id,
        quantity_before: original?.on_hand || 0, quantity_change: data.total - (original?.on_hand || 0),
        quantity_after: data.total, unit_cost_at_time: data.unit_cost, total_value_at_time: data.total * data.unit_cost
      })
    }
    if (historyRows.length > 0) await supabase.from('inventory_history').insert(historyRows)
    const totalValue = Object.values(itemTotals).reduce((sum, d) => sum + (d.total * d.unit_cost), 0)
    await supabase.from('count_sessions').update({ status: 'submitted', submitted_at: new Date().toISOString(), total_value: totalValue }).eq('id', activeSession.id)
    await loadData(session.user.id)
    setActiveSession(null)
    setCountLines([])
    setSubmitting(false)
    setView('hub')
  }

  const exportCount = (sess, lines) => {
    const rows = [['Item', 'Category', 'Location', 'Type', 'Quantity', 'Unit', 'Unit Cost', 'Total Value', 'Par', 'Variance', 'Count Date']]
    lines.forEach(l => {
      rows.push([l.item_name, l.category, l.location_name, l.item_type || '', l.quantity, l.unit || '', l.unit_cost || 0, ((l.quantity || 0) * (l.unit_cost || 0)).toFixed(2), l.par || 0, ((l.quantity || 0) - (l.par || 0)).toFixed(2), sess.count_date])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `boh_count_${sess.count_date}.csv`
    a.click()
  }

  const loadReview = async (sess) => {
    const { data: lines } = await supabase.from('count_lines').select('*').eq('session_id', sess.id).order('category').order('item_name')
    setReviewSession(sess)
    setReviewLines(lines || [])
    setView('review')
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const visibleLines = countLines.filter(l => l.category === activeCategory && l.location_name === activeLocation)
  const activeLocs = [...new Set(countLines.map(l => l.location_name))]
  const countedCount = countLines.filter(l => parseFloat(l.quantity) > 0).length
  const progressPct = countLines.length > 0 ? Math.round((countedCount / countLines.length) * 100) : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => view === 'hub' ? router.push('/boh/inventory') : setView('hub')}
          style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {view === 'hub' ? 'Inventory' : 'Back'}
        </button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* HUB */}
        {view === 'hub' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>BOH Count</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Start a new kitchen count or review past counts.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={downloadTemplate}
                  style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  ↓ Template
                </button>
                <label style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  ↑ Import Count
                  <input ref={importRef} type="file" accept=".csv" onChange={handleImportFile} style={{ display: 'none' }} />
                </label>
                <button onClick={startSetup}
                  style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + New Count
                </button>
              </div>
            </div>

            {/* Import preview */}
            {importPreview && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '4px' }}>Import Preview</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '14px' }}>
                  {importPreview.filter(r => r.matched).length} matched · {importPreview.filter(r => !r.matched).length} unmatched (will be skipped)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Count Date</label>
                    <input type="date" value={importDate} onChange={e => setImportDate(e.target.value)}
                      style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '8px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#999', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Counted By</label>
                    <input placeholder="Your name" value={importCountedBy} onChange={e => setImportCountedBy(e.target.value)}
                      style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '8px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '14px' }}>
                  {importPreview.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: r.matched ? '#000' : '#aaa' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{r.location} · qty {r.qty}</div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '500', color: r.matched ? '#3B6D11' : '#E24B4A', marginLeft: '12px' }}>
                        {r.matched ? '✓ Matched' : '✗ No match'}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setImportPreview(null)}
                    style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={confirmImport} disabled={importing || importPreview.filter(r => r.matched).length === 0}
                    style={{ flex: 2, background: importing || importPreview.filter(r => r.matched).length === 0 ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: importing ? 'not-allowed' : 'pointer' }}>
                    {importing ? 'Importing...' : `Confirm Import (${importPreview.filter(r => r.matched).length} items)`}
                  </button>
                </div>
              </div>
            )}

            {sessions.find(s => s.status === 'in_progress') && (
              <div style={{ background: '#FAEEDA', border: '1px solid #f0c080', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '13px', color: '#854F0B' }}>⚠ Count in progress from {sessions.find(s => s.status === 'in_progress')?.count_date}</div>
                <button onClick={async () => {
                  const inProgress = sessions.find(s => s.status === 'in_progress')
                  const { data: lines } = await supabase.from('count_lines').select('*').eq('session_id', inProgress.id)
                  setActiveSession(inProgress)
                  setCountLines(lines || [])
                  const cats = getCategories()
                  setActiveCategory(cats[0]?.key || 'proteins')
                  const locs = [...new Set((lines || []).map(l => l.location_name))]
                  setActiveLocation(locs[0] || 'Walk-in')
                  setView('counting')
                }} style={{ background: '#854F0B', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Resume
                </button>
              </div>
            )}

            {(() => {
              const last = sessions.find(s => s.status === 'submitted')
              return last ? (
                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Last Completed Count</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '10px' }}>
                    {[
                      { label: 'Date', val: last.count_date },
                      { label: 'Scope', val: SCOPES.find(s => s.key === last.scope)?.label || last.scope },
                      { label: 'Total Value', val: last.total_value ? fmt(last.total_value) : '--', highlight: true },
                      { label: 'Counted By', val: last.counted_by || '--' },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>{s.label}</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: s.highlight ? '#F5B800' : '#000' }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            })()}

            <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '10px' }}>Count History</div>
            {sessions.filter(s => s.status === 'submitted').length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '36px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
                No completed counts yet.
              </div>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sessions.filter(s => s.status === 'submitted').map(s => (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>{s.count_date}</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#F5B800' }}>{s.total_value ? fmt(s.total_value) : '--'}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>
                      {SCOPES.find(sc => sc.key === s.scope)?.label || s.scope}{s.counted_by && ` · ${s.counted_by}`}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => loadReview(s)} style={{ flex: 1, background: '#333', border: 'none', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>View</button>
                      <button onClick={async () => {
                        const { data: lines } = await supabase.from('count_lines').select('*').eq('session_id', s.id)
                        exportCount(s, lines || [])
                      }} style={{ flex: 1, background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>↓ CSV</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Date', 'Scope', 'Counted By', 'Total Value', 'Submitted', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {sessions.filter(s => s.status === 'submitted').map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{s.count_date}</td>
                        <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{SCOPES.find(sc => sc.key === s.scope)?.label || s.scope}</td>
                        <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{s.counted_by || '--'}</td>
                        <td style={{ padding: '12px 14px', fontWeight: '500', color: '#F5B800', fontSize: '13px' }}>{s.total_value ? fmt(s.total_value) : '--'}</td>
                        <td style={{ padding: '12px 14px', color: '#aaa', fontSize: '12px' }}>{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '--'}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => loadReview(s)} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>View</button>
                            <button onClick={async () => {
                              const { data: lines } = await supabase.from('count_lines').select('*').eq('session_id', s.id)
                              exportCount(s, lines || [])
                            }} style={{ background: 'none', border: '1px solid #e8e8e8', color: '#aaa', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>↓ CSV</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* SETUP */}
        {view === 'setup' && (
          <>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000', marginBottom: '4px' }}>New BOH Count</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '16px' }}>Configure your count before starting.</p>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '12px' }}>Count Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Count Date</label>
                  <input style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }} type="date" value={countDate} onChange={e => setCountDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Counted By</label>
                  <input style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }} placeholder="Your name" value={countedBy} onChange={e => setCountedBy(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '10px' }}>Scope</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: '8px', marginBottom: '20px' }}>
                {SCOPES.map(s => (
                  <div key={s.key} onClick={() => setScope(s.key)}
                    style={{ border: `2px solid ${scope === s.key ? '#F5B800' : '#e8e8e8'}`, borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', background: scope === s.key ? '#fffbe6' : '#fff' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#000', marginBottom: '2px' }}>{s.label}</div>
                    {!isMobile && <div style={{ fontSize: '11px', color: '#aaa' }}>{s.desc}</div>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '10px' }}>Locations</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {locations.map(l => (
                  <div key={l.id} onClick={() => setSelectedLocations(prev => prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id])}
                    style={{ padding: isMobile ? '8px 14px' : '6px 14px', borderRadius: '20px', border: `1px solid ${selectedLocations.includes(l.id) ? '#F5B800' : '#e8e8e8'}`, background: selectedLocations.includes(l.id) ? '#fffbe6' : '#fff', cursor: 'pointer', fontSize: '13px', color: selectedLocations.includes(l.id) ? '#854F0B' : '#555', fontWeight: selectedLocations.includes(l.id) ? '500' : '400' }}>
                    {l.name}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setView('hub')} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={startCount} style={{ flex: 2, background: '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Start Count →</button>
              </div>
            </div>
          </>
        )}

        {/* COUNTING */}
        {view === 'counting' && activeSession && (
          <>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '12px 16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#000' }}>BOH Count — {activeSession.count_date}</div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>{countedCount}/{countLines.length}</div>
              </div>
              <div style={{ height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#F5B800', borderRadius: '3px', width: `${progressPct}%`, transition: 'width 0.3s' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {getCategories().map(c => (
                <button key={c.key} onClick={() => setActiveCategory(c.key)}
                  style={{ padding: isMobile ? '8px 12px' : '7px 16px', border: '1px solid', borderColor: activeCategory === c.key ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: activeCategory === c.key ? '700' : '400', cursor: 'pointer', background: activeCategory === c.key ? '#F5B800' : '#fff', color: activeCategory === c.key ? '#000' : '#666' }}>
                  {c.icon} {isMobile ? '' : c.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {activeLocs.map(loc => (
                <button key={loc} onClick={() => setActiveLocation(loc)}
                  style={{ padding: isMobile ? '8px 14px' : '6px 14px', border: '1px solid', borderColor: activeLocation === loc ? '#333' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: activeLocation === loc ? '600' : '400', cursor: 'pointer', background: activeLocation === loc ? '#333' : '#fff', color: activeLocation === loc ? '#fff' : '#666' }}>
                  {loc}
                </button>
              ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
              {visibleLines.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No items for this category and location.</div>
              ) : isMobile ? (
                visibleLines.map(line => (
                  <div key={line.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.item_name}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{line.unit || line.item_type}{line.par > 0 && ` · par ${Number(line.par).toFixed(2)}`}</div>
                    </div>
                    <input type="number" step="0.01" min="0" value={line.quantity || ''} placeholder="0"
                      onChange={e => updateLine(line.id, parseFloat(e.target.value) || 0)}
                      style={{ width: '80px', background: parseFloat(line.quantity) > 0 ? '#fffbe6' : '#fafafa', border: `1px solid ${parseFloat(line.quantity) > 0 ? '#F5B800' : '#e8e8e8'}`, borderRadius: '8px', padding: '10px 12px', fontSize: '16px', color: '#000', textAlign: 'right', fontWeight: parseFloat(line.quantity) > 0 ? '600' : '400', flexShrink: 0 }} />
                  </div>
                ))
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Item', 'Type', 'Unit', 'Par', 'Count'].map((h, i) => (
                      <th key={i} style={{ textAlign: i > 2 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {visibleLines.map(line => (
                      <tr key={line.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{line.item_name}</td>
                        <td style={{ padding: '10px 14px' }}><span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{line.item_type}</span></td>
                        <td style={{ padding: '10px 14px', color: '#aaa', fontSize: '12px' }}>{line.unit || '--'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>{line.par > 0 ? Number(line.par).toFixed(2) : '--'}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                          <input type="number" step="0.01" min="0" value={line.quantity || ''} placeholder="0"
                            onChange={e => updateLine(line.id, parseFloat(e.target.value) || 0)}
                            style={{ width: '80px', background: parseFloat(line.quantity) > 0 ? '#fffbe6' : '#fafafa', border: `1px solid ${parseFloat(line.quantity) > 0 ? '#F5B800' : '#e8e8e8'}`, borderRadius: '8px', padding: '7px 10px', fontSize: '13px', color: '#000', textAlign: 'right', fontWeight: parseFloat(line.quantity) > 0 ? '600' : '400' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px', position: isMobile ? 'sticky' : 'static', bottom: isMobile ? '16px' : 'auto', boxShadow: isMobile ? '0 -4px 24px rgba(0,0,0,0.08)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#aaa', flex: 1 }}>{progressPct < 100 ? `${100 - progressPct}% at zero` : '✓ All counted'}</div>
              <button onClick={submitCount} disabled={submitting}
                style={{ background: submitting ? '#ccc' : '#333', color: '#fff', border: 'none', padding: isMobile ? '12px 20px' : '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {submitting ? 'Submitting...' : 'Submit Count'}
              </button>
            </div>
          </>
        )}

        {/* REVIEW */}
        {view === 'review' && reviewSession && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '500', color: '#000' }}>BOH Count — {reviewSession.count_date}</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>
                  {SCOPES.find(s => s.key === reviewSession.scope)?.label}
                  {reviewSession.counted_by && ` · ${reviewSession.counted_by}`}
                  {reviewSession.total_value && ` · ${fmt(reviewSession.total_value)}`}
                </p>
              </div>
              <button onClick={() => exportCount(reviewSession, reviewLines)}
                style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ↓ CSV
              </button>
            </div>

            {CATEGORIES.map(cat => {
              const catLines = reviewLines.filter(l => l.category === cat.key)
              if (catLines.length === 0) return null
              const catValue = catLines.reduce((sum, l) => sum + ((l.quantity || 0) * (l.unit_cost || 0)), 0)
              const aggregated = Object.values(catLines.reduce((acc, l) => {
                const key = l.inventory_item_id || l.item_name
                if (!acc[key]) acc[key] = { ...l, quantity: 0, locations: [] }
                acc[key].quantity += parseFloat(l.quantity) || 0
                acc[key].locations.push({ name: l.location_name, qty: parseFloat(l.quantity) || 0 })
                return acc
              }, {}))

              return (
                <div key={cat.key} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{cat.icon} {cat.label}</span>
                    <span style={{ color: '#F5B800' }}>{fmt(catValue)}</span>
                  </div>
                  {isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {aggregated.map(l => {
                        const variance = (l.quantity || 0) - (l.par || 0)
                        return (
                          <div key={l.inventory_item_id || l.item_name} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>{l.item_name}</div>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: '#000' }}>{Number(l.quantity || 0).toFixed(2)} {l.unit || ''}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '11px', color: '#aaa' }}>{fmt((l.quantity || 0) * (l.unit_cost || 0))}{l.par > 0 && ` · par ${Number(l.par).toFixed(2)}`}</div>
                              {l.par > 0 && <div style={{ fontSize: '12px', fontWeight: '600', color: variance >= 0 ? '#3B6D11' : '#E24B4A' }}>{variance >= 0 ? '+' : ''}{variance.toFixed(2)}</div>}
                            </div>
                            {l.locations.filter(loc => loc.qty > 0).length > 0 && (
                              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
                                {l.locations.filter(loc => loc.qty > 0).map(loc => `${loc.name}: ${loc.qty.toFixed(2)}`).join(' · ')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>{['Item', 'Total Qty', 'Unit', 'Unit Cost', 'Value', 'Par', 'Variance'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {aggregated.map(l => {
                            const variance = (l.quantity || 0) - (l.par || 0)
                            return (
                              <tr key={l.inventory_item_id || l.item_name} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                <td style={{ padding: '9px 12px', fontSize: '13px' }}>
                                  <div style={{ fontWeight: '500', color: '#000' }}>{l.item_name}</div>
                                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{l.locations.filter(loc => loc.qty > 0).map(loc => `${loc.name}: ${loc.qty.toFixed(2)}`).join(' · ')}</div>
                                </td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', color: '#000', fontSize: '13px' }}>{Number(l.quantity || 0).toFixed(2)}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>{l.unit || '--'}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{fmt(l.unit_cost || 0)}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt((l.quantity || 0) * (l.unit_cost || 0))}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>{l.par > 0 ? Number(l.par).toFixed(2) : '--'}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px' }}>
                                  {l.par > 0 ? <span style={{ color: variance >= 0 ? '#3B6D11' : '#E24B4A', fontWeight: '500' }}>{variance >= 0 ? '+' : ''}{variance.toFixed(2)}</span> : <span style={{ color: '#aaa' }}>--</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}