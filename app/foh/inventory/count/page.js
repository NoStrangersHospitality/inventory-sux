'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function FOHCount() {
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

  // Setup state
  const [scope, setScope] = useState('full')
  const [countedBy, setCountedBy] = useState('')
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedLocations, setSelectedLocations] = useState([])
  const [wellCount, setWellCount] = useState(2)
  const [setupStep, setSetupStep] = useState(1)
  const [activeSpiritFilter, setActiveSpiritFilter] = useState('all')

  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const SCOPES = [
    { key: 'full', label: 'Full FOH', desc: 'Liquor, Beer, Wine, and Misc' },
    { key: 'liquor', label: 'Liquor Only', desc: 'All liquor items' },
    { key: 'wine', label: 'Wine Only', desc: 'All wine items' },
    { key: 'beer', label: 'Beer Only', desc: 'All beer items' },
    { key: 'misc', label: 'Misc Only', desc: 'Miscellaneous items' },
  ]

  const getDefaultLocations = (wells) => [
    { name: 'Storage', area: 'foh', sort_order: 1 },
    { name: 'Backbar', area: 'foh', sort_order: 2 },
    ...Array.from({ length: wells }, (_, i) => ({ name: `Well ${i + 1}`, area: 'foh', sort_order: 3 + i })),
    { name: 'Walk-in', area: 'foh', sort_order: 3 + wells },
  ]

  const CATEGORIES = [
    { key: 'liquor', label: 'Liquor', icon: '🍾' },
    { key: 'beer', label: 'Beer', icon: '🍺' },
    { key: 'wine', label: 'Wine', icon: '🍷' },
    { key: 'misc', label: 'Misc', icon: '📦' },
  ]

  const SPIRIT_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'bourbon', label: 'Bourbon/Whiskey' },
    { key: 'gin', label: 'Gin/Vodka' },
    { key: 'tequila', label: 'Tequila/Mezcal/Agave' },
    { key: 'rum', label: 'Rum/Brandy' },
    { key: 'red_wine', label: 'Red' },
    { key: 'white_wine', label: 'White' },
    { key: 'bubbles', label: 'Bubbles' },
    { key: 'rose', label: 'Rosé' },
    { key: 'orange', label: 'Orange' },
    { key: 'liqueur', label: 'Liqueurs' },
    { key: 'misc', label: 'Misc' },
  ]

  const SPIRIT_KEYWORDS = {
    bourbon: ['bourbon', 'whiskey', 'whisky', 'rye', 'scotch', 'irish', 'tennessee'],
    gin: ['gin', 'vodka'],
    tequila: ['tequila', 'mezcal', 'sotol', 'bacanora', 'raicilla', 'pulque', 'comiteco', 'destilado', 'agave'],
    rum: ['rum', 'brandy', 'cognac', 'armagnac'],
    red_wine: ['red', 'cabernet', 'merlot', 'pinot noir', 'syrah', 'malbec', 'zinfandel', 'chianti', 'rioja', 'barolo'],
    white_wine: ['white', 'chardonnay', 'sauvignon blanc', 'pinot grigio', 'riesling', 'chenin', 'gruner', 'albariño'],
    bubbles: ['champagne', 'prosecco', 'cava', 'sparkling', 'crémant', 'bubbles', 'pét-nat'],
    liqueur: ['liqueur', 'amaro', 'aperol', 'campari', 'triple sec', 'cointreau', 'kahlua', 'baileys', 'st. germain', 'elderflower', 'bitters', 'vermouth'],
    misc: ['beer', 'cider', 'sake', 'seltzer'],
  }

  const matchesSpiritFilter = (itemName, filter, wineType) => {
    if (filter === 'all') return true
    if (filter === 'red_wine') return wineType === 'red'
    if (filter === 'white_wine') return wineType === 'white'
    if (filter === 'bubbles') return wineType === 'bubbles'
    if (filter === 'rose') return wineType === 'rose'
    if (filter === 'orange') return wineType === 'orange'
    const name = itemName.toLowerCase()
    return (SPIRIT_KEYWORDS[filter] || []).some(kw => name.includes(kw))
  }

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
    const [{ data: invItems }, { data: locs }, { data: sess }] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('user_id', userId).eq('area', 'foh').order('name'),
      supabase.from('locations').select('*').eq('user_id', userId).eq('area', 'foh').order('sort_order'),
      supabase.from('count_sessions').select('*').eq('user_id', userId).eq('area', 'foh').order('started_at', { ascending: false }).limit(20)
    ])
    setItems(invItems || [])
    setSessions(sess || [])

    if (!locs || locs.length === 0) {
      setLocations(getDefaultLocations(wellCount).map((l, i) => ({ ...l, id: `default-${i}`, user_id: userId })))
    } else {
      setLocations(locs)
    }
  }

  const getScopedItems = () => {
    if (scope === 'full') return items
    return items.filter(i => i.category === scope)
  }

  const getCategories = () => {
    const scopedItems = getScopedItems()
    return CATEGORIES.filter(c => scopedItems.some(i => i.category === c.key))
  }

  const startSetup = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    // Always reload fresh locations from DB
    const { data: freshLocs } = await supabase
      .from('locations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('area', 'foh')
      .order('sort_order')

    const locsToShow = freshLocs && freshLocs.length > 0
      ? freshLocs
      : getDefaultLocations(wellCount).map((l, i) => ({ ...l, id: `default-${i}`, user_id: session.user.id }))

    setLocations(locsToShow)
    setSetupStep(1)
    setScope('full')
    setCountedBy('')
    setCountDate(new Date().toISOString().split('T')[0])
    setSelectedLocations(locsToShow.map(l => l.id))
    setView('setup')
  }

  const startCount = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const scopedItems = getScopedItems()

    const { data: newSession } = await supabase.from('count_sessions').insert({
      user_id: session.user.id,
      area: 'foh',
      scope,
      status: 'in_progress',
      count_date: countDate,
      counted_by: countedBy,
    }).select().single()

    // Check for existing locations to avoid duplicates
    const { data: existingLocs } = await supabase
      .from('locations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('area', 'foh')

    let dbLocations = existingLocs || []

    if (dbLocations.length === 0) {
      const { data: insertedLocs } = await supabase.from('locations').insert(
        getDefaultLocations(wellCount).map(l => ({ ...l, user_id: session.user.id }))
      ).select()
      dbLocations = insertedLocs || []
      setLocations(dbLocations)
    }

    const locsToUse = selectedLocations.some(sl => sl.startsWith('default-'))
      ? dbLocations
      : dbLocations.filter(l => selectedLocations.includes(l.id))

    const finalLocs = locsToUse.length > 0 ? locsToUse : dbLocations

    const lines = []
    scopedItems.forEach(item => {
      finalLocs.forEach(loc => {
        lines.push({
          session_id: newSession.id,
          user_id: session.user.id,
          inventory_item_id: item.id,
          item_name: item.name,
          category: item.category,
          item_type: item.item_type || 'bottle',
          location_id: loc.id,
          location_name: loc.name,
          quantity: 0,
          unit: item.unit || '',
          unit_cost: item.unit_cost || 0,
          par: item.par || 0,
          wine_type: item.wine_type || null,
        })
      })
    })

    const { data: insertedLines } = await supabase.from('count_lines').insert(lines).select()
    setActiveSession(newSession)
    setCountLines(insertedLines || [])
    const cats = getCategories()
    setActiveCategory(cats[0]?.key || 'liquor')
    setActiveLocation(finalLocs[0]?.name || 'Storage')
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
        itemTotals[line.inventory_item_id] = {
          total: 0, item_name: line.item_name,
          category: line.category, unit_cost: line.unit_cost
        }
      }
      itemTotals[line.inventory_item_id].total += parseFloat(line.quantity) || 0
    })

    const historyRows = []
    for (const [itemId, data] of Object.entries(itemTotals)) {
      const original = items.find(i => i.id === itemId)
      await supabase.from('inventory_items').update({
        on_hand: data.total,
        last_count_date: activeSession.count_date
      }).eq('id', itemId)

      historyRows.push({
        user_id: session.user.id,
        inventory_item_id: itemId,
        item_name: data.item_name,
        category: data.category,
        area: 'foh',
        event_type: 'count',
        event_id: activeSession.id,
        quantity_before: original?.on_hand || 0,
        quantity_change: data.total - (original?.on_hand || 0),
        quantity_after: data.total,
        unit_cost_at_time: data.unit_cost,
        total_value_at_time: data.total * data.unit_cost
      })
    }

    if (historyRows.length > 0) {
      await supabase.from('inventory_history').insert(historyRows)
    }

    const totalValue = Object.values(itemTotals).reduce((sum, d) => sum + (d.total * d.unit_cost), 0)
    await supabase.from('count_sessions').update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      total_value: totalValue
    }).eq('id', activeSession.id)

    await loadData(session.user.id)
    setActiveSession(null)
    setCountLines([])
    setSubmitting(false)
    setView('hub')
  }

  const exportCount = (sess, lines) => {
    const rows = [['Item', 'Category', 'Location', 'Type', 'Quantity', 'Unit', 'Unit Cost', 'Total Value', 'Par', 'Variance', 'Count Date']]
    lines.forEach(l => {
      rows.push([
        l.item_name, l.category, l.location_name, l.item_type || '',
        l.quantity, l.unit || '', l.unit_cost || 0,
        ((l.quantity || 0) * (l.unit_cost || 0)).toFixed(2),
        l.par || 0, ((l.quantity || 0) - (l.par || 0)).toFixed(2),
        sess.count_date
      ])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `count_${sess.count_date}.csv`
    a.click()
  }

  const loadReview = async (sess) => {
    const { data: lines } = await supabase.from('count_lines').select('*').eq('session_id', sess.id).order('category').order('item_name')
    setReviewSession(sess)
    setReviewLines(lines || [])
    setView('review')
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  const visibleLines = countLines.filter(l =>
    l.category === activeCategory &&
    l.location_name === activeLocation &&
    (activeSpiritFilter === 'all' || matchesSpiritFilter(l.item_name, activeSpiritFilter, l.wine_type))
  )
  const activeLocs = [...new Set(countLines.map(l => l.location_name))]
  const countedCount = countLines.filter(l => parseFloat(l.quantity) > 0).length
  const progressPct = countLines.length > 0 ? Math.round((countedCount / countLines.length) * 100) : 0

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
        <button onClick={() => view === 'hub' ? router.push('/foh/inventory') : setView('hub')}
          style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {view === 'hub' ? 'Inventory' : 'Back'}
        </button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* HUB */}
        {view === 'hub' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Count</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Start a new inventory count or review past counts.</p>
              </div>
              <button onClick={startSetup} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                + Start New Count
              </button>
            </div>

            {sessions.length > 0 && (() => {
              const last = sessions.find(s => s.status === 'submitted')
              return last ? (
                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '32px', alignItems: 'center' }}>
                  <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Last Count</div><div style={{ fontSize: '15px', fontWeight: '600', color: '#000' }}>{last.count_date}</div></div>
                  <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Scope</div><div style={{ fontSize: '15px', fontWeight: '600', color: '#000' }}>{SCOPES.find(s => s.key === last.scope)?.label || last.scope}</div></div>
                  <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Total Value</div><div style={{ fontSize: '15px', fontWeight: '600', color: '#F5B800' }}>{last.total_value ? fmt(last.total_value) : '--'}</div></div>
                  {last.counted_by && <div><div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Counted By</div><div style={{ fontSize: '15px', fontWeight: '600', color: '#000' }}>{last.counted_by}</div></div>}
                </div>
              ) : null
            })()}

            {sessions.find(s => s.status === 'in_progress') && (
              <div style={{ background: '#FAEEDA', border: '1px solid #f0c080', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: '#854F0B' }}>⚠ You have a count in progress from {sessions.find(s => s.status === 'in_progress')?.count_date}</div>
                <button onClick={async () => {
                  const inProgress = sessions.find(s => s.status === 'in_progress')
                  const { data: lines } = await supabase.from('count_lines').select('*').eq('session_id', inProgress.id)
                  setActiveSession(inProgress)
                  setCountLines(lines || [])
                  const cats = getCategories()
                  setActiveCategory(cats[0]?.key || 'liquor')
                  const locs = [...new Set((lines || []).map(l => l.location_name))]
                  setActiveLocation(locs[0] || 'Storage')
                  setView('counting')
                }} style={{ background: '#854F0B', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  Resume Count
                </button>
              </div>
            )}

            <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '12px' }}>Count History</div>
            {sessions.filter(s => s.status === 'submitted').length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
                No completed counts yet. Start your first count above.
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
                        <td style={{ padding: '12px 14px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button onClick={() => loadReview(s)} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>View</button>
                          <button onClick={async () => {
                            const { data: lines } = await supabase.from('count_lines').select('*').eq('session_id', s.id)
                            exportCount(s, lines || [])
                          }} style={{ background: 'none', border: '1px solid #e8e8e8', color: '#aaa', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>↓ CSV</button>
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
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>New Count</h1>
              <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Configure your count before starting.</p>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>Count Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Count Date</label>
                  <input style={inputStyle} type="date" value={countDate} onChange={e => setCountDate(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Counted By</label>
                  <input style={inputStyle} placeholder="Your name" value={countedBy} onChange={e => setCountedBy(e.target.value)} />
                </div>
              </div>

              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '12px' }}>Scope</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
                {SCOPES.map(s => (
                  <div key={s.key} onClick={() => setScope(s.key)}
                    style={{ border: `2px solid ${scope === s.key ? '#F5B800' : '#e8e8e8'}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', background: scope === s.key ? '#fffbe6' : '#fff' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '2px' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{s.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '12px' }}>Wells</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
                {[1, 2, 3, 4].map(n => (
                  <div key={n} onClick={() => {
                    setWellCount(n)
                    const newLocs = getDefaultLocations(n).map((l, i) => ({ ...l, id: `default-${i}` }))
                    setLocations(newLocs)
                    setSelectedLocations(newLocs.map(l => l.id))
                  }}
                    style={{ width: '44px', height: '44px', border: `2px solid ${wellCount === n ? '#F5B800' : '#e8e8e8'}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: '600', fontSize: '15px', background: wellCount === n ? '#fffbe6' : '#fff', color: wellCount === n ? '#854F0B' : '#555' }}>
                    {n}
                  </div>
                ))}
                <span style={{ fontSize: '12px', color: '#aaa', marginLeft: '4px' }}>wells at this bar</span>
              </div>

              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '12px' }}>Locations</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {locations.map(l => (
                  <div key={l.id} onClick={() => {
                    setSelectedLocations(prev =>
                      prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]
                    )
                  }} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${selectedLocations.includes(l.id) ? '#F5B800' : '#e8e8e8'}`, background: selectedLocations.includes(l.id) ? '#fffbe6' : '#fff', cursor: 'pointer', fontSize: '13px', color: selectedLocations.includes(l.id) ? '#854F0B' : '#555', fontWeight: selectedLocations.includes(l.id) ? '500' : '400' }}>
                    {l.name}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '20px' }}>Select which locations to include in this count.</div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setView('hub')} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={startCount} style={{ flex: 2, background: '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  Start Count →
                </button>
              </div>
            </div>
          </>
        )}

        {/* COUNTING */}
        {view === 'counting' && activeSession && (
          <>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>Count in Progress — {activeSession.count_date}</div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>{countedCount} of {countLines.length} entries</div>
              </div>
              <div style={{ height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#F5B800', borderRadius: '3px', width: `${progressPct}%`, transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {getCategories().map(c => (
                <button key={c.key} onClick={() => { setActiveCategory(c.key); setActiveSpiritFilter('all') }}
                  style={{ padding: '7px 16px', border: '1px solid', borderColor: activeCategory === c.key ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: activeCategory === c.key ? '700' : '400', cursor: 'pointer', background: activeCategory === c.key ? '#F5B800' : '#fff', color: activeCategory === c.key ? '#000' : '#666' }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            {/* Spirit filter pills */}
            {(activeCategory === 'liquor' || activeCategory === 'wine') && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {SPIRIT_FILTERS.filter(f => {
                  if (activeCategory === 'wine') return ['all', 'red_wine', 'white_wine', 'bubbles', 'rose', 'orange'].includes(f.key)
                  return !['red_wine', 'white_wine', 'bubbles'].includes(f.key)
                }).map(f => (
                  <button key={f.key} onClick={() => setActiveSpiritFilter(f.key)}
                    style={{ padding: '5px 12px', border: '1px solid', borderColor: activeSpiritFilter === f.key ? '#333' : '#e8e8e8', borderRadius: '20px', fontSize: '11px', fontWeight: activeSpiritFilter === f.key ? '600' : '400', cursor: 'pointer', background: activeSpiritFilter === f.key ? '#333' : '#fff', color: activeSpiritFilter === f.key ? '#fff' : '#666', whiteSpace: 'nowrap' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* Location tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {activeLocs.map(loc => (
                <button key={loc} onClick={() => setActiveLocation(loc)}
                  style={{ padding: '6px 14px', border: '1px solid', borderColor: activeLocation === loc ? '#333' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: activeLocation === loc ? '600' : '400', cursor: 'pointer', background: activeLocation === loc ? '#333' : '#fff', color: activeLocation === loc ? '#fff' : '#666' }}>
                  {loc}
                </button>
              ))}
            </div>

            {/* Count sheet */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
              {visibleLines.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>No items for this category and location.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Item', 'Type', 'Par', 'Count'].map((h, i) => (
                        <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLines.map(line => (
                      <tr key={line.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{line.item_name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{line.item_type}</span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>{line.par > 0 ? Number(line.par).toFixed(1) : '--'}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            {(line.item_type === 'bottle' || line.item_type === 'keg') && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {['0.25', '0.5', '0.75'].map(p => (
                                  <button key={p} onClick={() => updateLine(line.id, parseFloat(line.quantity || 0) + parseFloat(p))}
                                    style={{ background: '#f5f5f3', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '3px 7px', fontSize: '10px', color: '#555', cursor: 'pointer' }}>
                                    +{p}
                                  </button>
                                ))}
                              </div>
                            )}
                            <input
                              type="number"
                              step={line.item_type === 'bottle' || line.item_type === 'keg' ? '0.1' : '1'}
                              min="0"
                              value={line.quantity || ''}
                              placeholder="0"
                              onChange={e => updateLine(line.id, parseFloat(e.target.value) || 0)}
                              style={{ width: '72px', background: parseFloat(line.quantity) > 0 ? '#fffbe6' : '#fafafa', border: `1px solid ${parseFloat(line.quantity) > 0 ? '#F5B800' : '#e8e8e8'}`, borderRadius: '8px', padding: '7px 10px', fontSize: '13px', color: '#000', textAlign: 'right', fontWeight: parseFloat(line.quantity) > 0 ? '600' : '400' }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', color: '#aaa' }}>
                {progressPct < 100 ? `${100 - progressPct}% of items still at zero — review before submitting` : '✓ All items counted'}
              </div>
              <button onClick={submitCount} disabled={submitting}
                style={{ background: submitting ? '#ccc' : '#333', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Submitting...' : 'Submit Count'}
              </button>
            </div>
          </>
        )}

        {/* REVIEW */}
        {view === 'review' && reviewSession && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Count — {reviewSession.count_date}</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>
                  {SCOPES.find(s => s.key === reviewSession.scope)?.label} · {reviewSession.counted_by || 'Unknown'} · {reviewSession.total_value ? fmt(reviewSession.total_value) : '--'} total value
                </p>
              </div>
              <button onClick={() => exportCount(reviewSession, reviewLines)}
                style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                ↓ Export CSV
              </button>
            </div>

            {CATEGORIES.map(cat => {
              const catLines = reviewLines.filter(l => l.category === cat.key)
              if (catLines.length === 0) return null
              const catValue = catLines.reduce((sum, l) => sum + ((l.quantity || 0) * (l.unit_cost || 0)), 0)
              return (
                <div key={cat.key} style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{cat.icon} {cat.label}</span>
                    <span style={{ color: '#F5B800' }}>{fmt(catValue)}</span>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Item', 'Total Qty', 'Unit Cost', 'Value', 'Par', 'Variance'].map((h, i) => (
                          <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {Object.values(catLines.reduce((acc, l) => {
                          const key = l.inventory_item_id || l.item_name
                          if (!acc[key]) acc[key] = { ...l, quantity: 0, locations: [] }
                          acc[key].quantity += parseFloat(l.quantity) || 0
                          acc[key].locations.push({ name: l.location_name, qty: parseFloat(l.quantity) || 0 })
                          return acc
                        }, {})).map(l => {
                          const variance = (l.quantity || 0) - (l.par || 0)
                          return (
                            <tr key={l.inventory_item_id || l.item_name} style={{ borderBottom: '1px solid #f5f5f5' }}>
                              <td style={{ padding: '9px 12px', fontSize: '13px' }}>
                                <div style={{ fontWeight: '500', color: '#000' }}>{l.item_name}</div>
                                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>
                                  {l.locations.filter(loc => loc.qty > 0).map(loc => `${loc.name}: ${loc.qty.toFixed(1)}`).join(' · ')}
                                </div>
                              </td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', color: '#000', fontSize: '13px' }}>{Number(l.quantity || 0).toFixed(1)}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{fmt(l.unit_cost || 0)}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt((l.quantity || 0) * (l.unit_cost || 0))}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>{l.par > 0 ? Number(l.par).toFixed(1) : '--'}</td>
                              <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '12px' }}>
                                {l.par > 0 ? <span style={{ color: variance >= 0 ? '#3B6D11' : '#E24B4A', fontWeight: '500' }}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}</span> : <span style={{ color: '#aaa' }}>--</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}