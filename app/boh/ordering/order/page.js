'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRole } from '@/hooks/useRole'

function BOHOrder() {
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('select')
  const [selectedCats, setSelectedCats] = useState(new Set(['proteins', 'produce', 'dairy', 'dry_goods', 'dry_spices', 'oils_fats', 'sauces', 'misc']))
  const [orderRows, setOrderRows] = useState({})
  const [recapRows, setRecapRows] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [draftOrder, setDraftOrder] = useState(null)
  const [readyOrder, setReadyOrder] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can, ownerId } = useRole()
  const initRan = useRef(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

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

  const getDefaultUnit = (item) => {
    if (item.item_type === 'case') return 'case'
    return item.unit || 'unit'
  }

  const canSwitchUnit = (item) => {
    if (item.item_type === 'case') return false
    return true
  }

  const getUnitOptions = (item) => {
    const base = item.unit || 'unit'
    if (item.item_type === 'case') return ['case']
    return [base, 'case']
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (ownerId === undefined) return
    if (initRan.current) return
    initRan.current = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }

      const ownerIdToUse = ownerId || session.user.id

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.boh_access && !prof?.owner_user_id) { router.push('/dashboard'); return }

      const [{ data: itemData }, { data: vendorData }] = await Promise.all([
        supabase.from('inventory_items').select('*').eq('user_id', ownerIdToUse).eq('area', 'boh').eq('on_menu', true).order('name'),
        supabase.from('vendors').select('*').eq('user_id', ownerIdToUse).order('name')
      ])
      const fetchedItems = itemData || []
      const fetchedVendors = vendorData || []
      setItems(fetchedItems)
      setVendors(fetchedVendors)

      const buildByVendorFromLines = (lineData) => {
        const byVendor = {}
        lineData.forEach(line => {
          const key = line.distributor_name || 'Unassigned'
          if (!byVendor[key]) byVendor[key] = []
          const item = fetchedItems.find(i => i.id === line.item_id)
          if (!item) return
          const vendor = fetchedVendors.find(v => v.id === line.distributor_id)
          const catLabel = CATEGORIES.find(c => c.key === item.category)?.label || item.category
          byVendor[key].push({
            ...item, catLabel, vendorName: key, vendorObj: vendor,
            on_hand_count: line.shelf_count || 0,
            suggested: line.suggested_qty || 0,
            line_id: line.id,
          })
        })
        return byVendor
      }

      const buildByVendorFromItems = () => {
        const byVendor = {}
        CATEGORIES.forEach(c => {
          fetchedItems.filter(i => i.category === c.key).forEach(item => {
            const vendor = fetchedVendors.find(v => v.id === item.distributor_id)
            const key = vendor ? vendor.name : 'Unassigned'
            if (!byVendor[key]) byVendor[key] = []
            byVendor[key].push({ ...item, catLabel: c.label, vendorName: key, vendorObj: vendor, on_hand_count: 0, suggested: Math.max(0, Math.ceil(item.par || 0)) })
          })
        })
        return byVendor
      }

      const resumeId = searchParams.get('resume')
      if (resumeId) {
        const { data: existingOrder } = await supabase
          .from('orders').select('*').eq('id', resumeId).eq('user_id', ownerIdToUse).single()

        if (existingOrder) {
          const { data: lines } = await supabase
            .from('order_lines').select('*').eq('order_id', existingOrder.id)

          if (existingOrder.status === 'draft') {
            setDraftOrder(existingOrder)
            const byVendor = lines && lines.length > 0 ? buildByVendorFromLines(lines) : buildByVendorFromItems()
            setOrderRows(byVendor)
            setStep('sheet')
          } else if (existingOrder.status === 'ready' && lines && lines.length > 0) {
            setReadyOrder(existingOrder)
            const byVendor = buildByVendorFromLines(lines)
            const rd = {}
            Object.keys(byVendor).forEach(vn => {
              const needed = byVendor[vn].filter(r => r.suggested > 0)
              if (needed.length) rd[vn] = needed.map(r => ({ ...r, overrideQty: r.suggested, finalQty: r.suggested, orderUnit: getDefaultUnit(r) }))
            })
            setOrderRows(byVendor)
            setRecapRows(rd)
            setStep('recap')
          }
        }
      }

      setLoading(false)
    }
    init()
  }, [ownerId, searchParams])

  const toggleCat = (cat) => {
    setSelectedCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const buildOrderSheet = () => {
    const allItems = []
    CATEGORIES.filter(c => selectedCats.has(c.key)).forEach(c => {
      items.filter(i => i.category === c.key).forEach(item => allItems.push({ ...item, catLabel: c.label }))
    })
    if (!allItems.length) { alert('No items in selected categories.'); return }
    const byVendor = {}
    allItems.forEach(item => {
      const vendor = vendors.find(v => v.id === item.distributor_id)
      const key = vendor ? vendor.name : 'Unassigned'
      if (!byVendor[key]) byVendor[key] = []
      byVendor[key].push({ ...item, vendorName: key, vendorObj: vendor, on_hand_count: 0, suggested: Math.max(0, Math.ceil(item.par || 0)) })
    })
    setOrderRows(byVendor)
    setStep('sheet')
  }

  const updateRow = async (vendorName, idx, field, val) => {
    setOrderRows(prev => {
      const next = { ...prev }
      const rows = [...next[vendorName]]
      rows[idx] = { ...rows[idx], [field]: val }
      const row = rows[idx]
      const par = field === 'par' ? val : (row.par || 0)
      const onHand = field === 'on_hand_count' ? val : (row.on_hand_count || 0)
      rows[idx].suggested = Math.max(0, Math.ceil(par - onHand))
      next[vendorName] = rows
      return next
    })
    if (field === 'par') {
      const { data: { session } } = await supabase.auth.getSession()
      const row = orderRows[vendorName][idx]
      if (row?.id) await supabase.from('inventory_items').update({ par: parseFloat(val) || 0 }).eq('id', row.id).eq('user_id', session.user.id)
    }
    if (draftOrder) {
      const row = orderRows[vendorName][idx]
      if (row?.line_id) {
        const updateData = {}
        if (field === 'on_hand_count') updateData.shelf_count = parseFloat(val) || 0
        if (field === 'par') updateData.par = parseFloat(val) || 0
        if (Object.keys(updateData).length) await supabase.from('order_lines').update(updateData).eq('id', row.line_id)
      }
    }
  }

  const saveDraft = async () => {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const ownerIdToUse = ownerId || session.user.id
    let order = draftOrder
    if (!order) {
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: ownerIdToUse, status: 'draft', area: 'boh',
        receiving_status: 'pending', created_at: new Date().toISOString()
      }).select().single()
      order = newOrder
      setDraftOrder(order)
    } else {
      await supabase.from('orders').update({ status: 'draft' }).eq('id', order.id)
      await supabase.from('order_lines').delete().eq('order_id', order.id)
    }
    const lines = []
    Object.keys(orderRows).forEach(vn => {
      orderRows[vn].forEach(row => {
        lines.push({
          order_id: order.id, user_id: ownerIdToUse, item_id: row.id, item_name: row.name,
          unit: row.unit || '', distributor_id: row.distributor_id || null, distributor_name: vn,
          par: row.par || 0, shelf_count: row.on_hand_count || 0, well_count: 0,
          suggested_qty: row.suggested, final_qty: row.suggested, category: row.category,
        })
      })
    })
    const { data: insertedLines, error: linesError } = await supabase.from('order_lines').insert(lines).select()
    if (linesError) console.error('saveDraft lines error:', linesError)
    const updatedRows = { ...orderRows }
    insertedLines?.forEach(line => {
      const vendorRows = updatedRows[line.distributor_name]
      if (!vendorRows) return
      const idx = vendorRows.findIndex(r => r.id === line.item_id)
      if (idx >= 0) updatedRows[line.distributor_name][idx].line_id = line.id
    })
    setOrderRows(updatedRows)
    setSaving(false)
    router.push('/boh/ordering')
  }

  const buildRecap = () => {
    const rd = {}
    Object.keys(orderRows).forEach(vn => {
      const needed = orderRows[vn].filter(r => r.suggested > 0)
      if (needed.length) rd[vn] = needed.map(r => ({ ...r, overrideQty: r.suggested, finalQty: r.suggested, orderUnit: getDefaultUnit(r) }))
    })
    if (!Object.keys(rd).length) { alert('No items need ordering.'); return }
    setRecapRows(rd)
    setStep('recap')
  }

  const updateRecapQty = (vendorName, idx, qty) => {
    setRecapRows(prev => {
      const next = { ...prev }
      const rows = [...next[vendorName]]
      rows[idx] = { ...rows[idx], overrideQty: qty, finalQty: qty }
      next[vendorName] = rows
      return next
    })
  }

  const updateRecapUnit = (vendorName, idx, unit) => {
    setRecapRows(prev => {
      const next = { ...prev }
      const rows = [...next[vendorName]]
      rows[idx] = { ...rows[idx], orderUnit: unit }
      next[vendorName] = rows
      return next
    })
  }

  const markAsReady = async () => {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const ownerIdToUse = ownerId || session.user.id
    let order = draftOrder || readyOrder
    if (!order) {
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: ownerIdToUse, status: 'ready', area: 'boh',
        receiving_status: 'pending', created_at: new Date().toISOString()
      }).select().single()
      order = newOrder
    } else {
      await supabase.from('orders').update({ status: 'ready' }).eq('id', order.id)
      await supabase.from('order_lines').delete().eq('order_id', order.id)
    }
    const lines = []
    Object.keys(recapRows).forEach(vn => {
      recapRows[vn].forEach(row => {
        lines.push({
          order_id: order.id, user_id: ownerIdToUse, item_id: row.id, item_name: row.name,
          unit: row.orderUnit || row.unit || '', distributor_id: row.distributor_id || null, distributor_name: vn,
          par: row.par || 0, shelf_count: row.on_hand_count || 0, well_count: 0,
          suggested_qty: row.suggested, final_qty: row.finalQty, category: row.category,
        })
      })
    })
    await supabase.from('order_lines').insert(lines)
    setReadyOrder(order)
    setSaving(false)
    router.push('/boh/ordering')
  }

  const submitOrder = async () => {
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const ownerIdToUse = ownerId || session.user.id
    const { data: profile } = await supabase.from('profiles').select('first_name, last_name, bar_name').eq('id', session.user.id).single()
    const managerName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
    const barName = profile?.bar_name || 'Your Bar'
    const orderDate = new Date().toLocaleDateString()

    let order = draftOrder || readyOrder
    if (!order) {
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: ownerIdToUse, status: 'submitted', area: 'boh',
        receiving_status: 'pending', submitted_at: new Date().toISOString()
      }).select().single()
      order = newOrder
    } else {
      await supabase.from('orders').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', order.id)
      await supabase.from('order_lines').delete().eq('order_id', order.id)
    }

    const lines = []
    Object.keys(recapRows).forEach(vn => {
      recapRows[vn].forEach(row => {
        lines.push({
          order_id: order.id, user_id: ownerIdToUse, item_id: row.id, item_name: row.name,
          unit: row.orderUnit || row.unit || '', distributor_id: row.distributor_id || null, distributor_name: vn,
          par: row.par || 0, shelf_count: row.on_hand_count || 0, well_count: 0,
          suggested_qty: row.suggested, final_qty: row.finalQty
        })
      })
    })
    await supabase.from('order_lines').insert(lines)

    const vendorGroups = {}
    lines.forEach(line => {
      if (!vendorGroups[line.distributor_name]) vendorGroups[line.distributor_name] = { name: line.distributor_name, id: line.distributor_id, lines: [] }
      vendorGroups[line.distributor_name].lines.push(line)
    })

    const distIds = [...new Set(lines.map(l => l.distributor_id).filter(Boolean))]
    const { data: distContacts } = await supabase.from('vendors').select('id, name, email, phone, order_method').in('id', distIds)

    for (const [vendorName, group] of Object.entries(vendorGroups)) {
      const contact = distContacts?.find(d => d.id === group.id)
      if (!contact) continue
      const orderLines = group.lines.filter(l => l.final_qty > 0)
      if (orderLines.length === 0) continue
      if (contact.email && (contact.order_method?.toLowerCase() === 'email' || contact.order_method?.toLowerCase() === 'both')) {
        try { await fetch('/api/email/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ distributorName: contact.name, distributorEmail: contact.email, barName, managerName, orderLines, orderId: order.id, orderDate }) }) } catch (err) { console.error('Order email failed for', contact.name, err) }
      }
      if (contact.phone && (contact.order_method?.toLowerCase() === 'sms' || contact.order_method?.toLowerCase() === 'both')) {
        try { await fetch('/api/sms/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ distributorPhone: contact.phone, distributorName: contact.name, barName, managerName, orderLines, orderId: order.id, orderDate }) }) } catch (err) { console.error('Order SMS failed for', contact.name, err) }
      }
    }

    try {
      const distGroupsForPDF = Object.entries(vendorGroups).map(([name, group]) => {
        const contact = distContacts?.find(d => d.id === group.id)
        return { name, email: contact?.email || null, lines: group.lines.filter(l => l.final_qty > 0) }
      }).filter(g => g.lines.length > 0)
      const totalItems = distGroupsForPDF.reduce((sum, g) => sum + g.lines.length, 0)
      const pdfRes = await fetch('/api/orders/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, userId: session.user.id, barName, managerName, orderDate, distributorGroups: distGroupsForPDF, totalItems }) })
      const pdfData = await pdfRes.json()
      if (pdfData.pdfUrl) {
        await fetch('/api/email/order-confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: session.user.email, barName, managerName, orderDate, orderId: order.id, pdfUrl: pdfData.pdfUrl, distributorGroups: distGroupsForPDF, totalItems }) })
      }
    } catch (err) { console.error('PDF/email confirmation error:', err) }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', padding: '20px' }}>
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '48px 32px', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <div style={{ fontSize: '52px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Order submitted!</h2>
        <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '28px' }}>Your BOH order has been sent to your vendors.</p>
        <button onClick={() => router.push('/boh/ordering')} style={{ background: '#F5B800', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>← Back to BOH Ordering</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => step === 'select' ? router.push('/boh/ordering') : setStep(step === 'recap' ? 'sheet' : 'select')}
          style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {step === 'select' ? 'BOH Ordering' : step === 'sheet' ? 'Categories' : 'Order Sheet'}
        </button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {step === 'select' && (
          <>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>Build BOH Order</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '20px' }}>Select which categories to include.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px', marginBottom: '20px' }}>
              {CATEGORIES.map(c => {
                const count = items.filter(i => i.category === c.key).length
                const selected = selectedCats.has(c.key)
                return (
                  <div key={c.key} onClick={() => toggleCat(c.key)}
                    style={{ background: '#fff', border: `2px solid ${selected ? '#F5B800' : '#e8e8e8'}`, borderRadius: '12px', padding: isMobile ? '12px' : '16px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s', boxShadow: selected ? '0 2px 12px rgba(245,184,0,.12)' : 'none' }}>
                    <div style={{ fontSize: isMobile ? '24px' : '28px', marginBottom: '4px' }}>{c.icon}</div>
                    <div style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '600', color: '#000', marginBottom: '2px' }}>{c.label}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{count} item{count !== 1 ? 's' : ''}</div>
                  </div>
                )
              })}
            </div>
            <button onClick={buildOrderSheet} style={{ width: '100%', background: '#F5B800', color: '#000', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
              Build Order Sheet →
            </button>
          </>
        )}

        {step === 'sheet' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>BOH Order Sheet</h1>
              {draftOrder && <span style={{ background: '#FAEEDA', color: '#854F0B', border: '1px solid #f0c080', borderRadius: '10px', fontSize: '11px', padding: '3px 10px', fontWeight: '500' }}>Draft saved</span>}
            </div>
            <div style={{ background: '#fffbe6', border: '1px solid #f0d060', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#a07800' }}>
              💡 Enter what you have on hand — suggested qty calculates automatically.
            </div>
            {Object.keys(orderRows).map(vn => {
              const vendor = vendors.find(v => v.name === vn)
              return (
                <div key={vn} style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#111', borderRadius: '10px 10px 0 0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🚚</span>
                    <span style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>{vn}</span>
                    {vendor?.order_method && <span style={{ marginLeft: 'auto', background: '#F5B800', color: '#000', borderRadius: '10px', fontSize: '10px', padding: '2px 8px', fontWeight: '600' }}>{vendor.order_method}</span>}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    {isMobile ? (
                      orderRows[vn].map((row, ri) => (
                        <div key={row.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f5f5f5' }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>
                            {row.name}<span style={{ marginLeft: '8px', fontSize: '11px', color: '#aaa', fontWeight: '400' }}>{row.unit || ''}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>Par</div>
                              <input type="number" min="0" step="0.01" defaultValue={row.par || 0} onChange={e => updateRow(vn, ri, 'par', parseFloat(e.target.value) || 0)}
                                style={{ width: '100%', textAlign: 'center', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '6px', fontSize: '16px', background: '#fafafa' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>On Hand</div>
                              <input type="number" min="0" step="0.01" value={row.on_hand_count === 0 ? '' : row.on_hand_count} onChange={e => updateRow(vn, ri, 'on_hand_count', parseFloat(e.target.value) || 0)}
                                style={{ width: '100%', textAlign: 'center', border: '1px solid #F5B800', borderRadius: '6px', padding: '6px', fontSize: '16px', background: '#fffbe6', fontWeight: '600' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>Suggested</div>
                              <div style={{ textAlign: 'center', padding: '6px', fontSize: '16px', fontWeight: '700', color: row.suggested > 0 ? '#3B6D11' : '#ccc' }}>{row.suggested}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>{['Item', 'Category', 'Unit', 'Par', 'On Hand', 'Suggested'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 2 ? 'center' : 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {orderRows[vn].map((row, ri) => (
                            <tr key={row.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                              <td style={{ padding: '8px 10px', fontSize: '12px' }}><div style={{ fontWeight: '500', color: '#000' }}>{row.name}</div>{row.notes && <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>{row.notes}</div>}</td>
                              <td style={{ padding: '8px 10px', fontSize: '11px', color: '#888' }}>{row.catLabel}</td>
                              <td style={{ padding: '8px 10px', fontSize: '11px', color: '#888' }}>{row.unit || '--'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <input type="number" min="0" step="0.01" defaultValue={row.par || 0} onChange={e => updateRow(vn, ri, 'par', parseFloat(e.target.value) || 0)}
                                  style={{ width: '60px', textAlign: 'center', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '4px', fontSize: '12px', background: '#fafafa' }} />
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <input type="number" min="0" step="0.01" value={row.on_hand_count === 0 ? '' : row.on_hand_count} onChange={e => updateRow(vn, ri, 'on_hand_count', parseFloat(e.target.value) || 0)}
                                  style={{ width: '64px', textAlign: 'center', border: '1px solid #F5B800', borderRadius: '6px', padding: '4px', fontSize: '12px', background: '#fffbe6', fontWeight: '500' }} />
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: row.suggested > 0 ? '#3B6D11' : '#ccc', fontSize: '12px' }}>{row.suggested}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginTop: '8px' }}>
              <button onClick={saveDraft} disabled={saving} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : '💾 Save Draft'}
              </button>
              <button onClick={buildRecap} style={{ background: '#F5B800', color: '#000', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
                Review Order →
              </button>
            </div>
          </>
        )}

        {step === 'recap' && (
          <>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>BOH Order Recap</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '16px' }}>Adjust quantities and units if needed.</p>
            {Object.keys(recapRows).map(vn => {
              const vendor = vendors.find(v => v.name === vn)
              return (
                <div key={vn} style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#111', borderRadius: '10px 10px 0 0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🚚</span>
                    <span style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>{vn}</span>
                    {vendor?.email && !isMobile && <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '8px' }}>{vendor.email}</span>}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    {isMobile ? (
                      recapRows[vn].map((row, ri) => {
                        const unitOptions = getUnitOptions(row)
                        const canSwitch = canSwitchUnit(row)
                        return (
                          <div key={row.id} style={{ padding: '14px', borderBottom: '1px solid #f5f5f5' }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '10px' }}>{row.name}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                              <div style={{ background: '#fafafa', borderRadius: '8px', padding: '8px 12px' }}>
                                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>On Hand</div>
                                <div style={{ fontSize: '15px', fontWeight: '600', color: '#000' }}>{Number(row.on_hand_count || 0).toFixed(2)}</div>
                              </div>
                              <div style={{ background: '#fafafa', borderRadius: '8px', padding: '8px 12px' }}>
                                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Suggested</div>
                                <div style={{ fontSize: '15px', fontWeight: '700', color: '#3B6D11' }}>{row.suggested}</div>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>Order Qty</div>
                                <input type="number" min="0" step="0.01" value={row.overrideQty === 0 ? '' : row.overrideQty} onChange={e => updateRecapQty(vn, ri, parseFloat(e.target.value) || 0)}
                                  style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '8px 12px', fontSize: '16px', background: '#fafafa', fontWeight: '600' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>Unit</div>
                                {canSwitch && unitOptions.length > 1 ? (
                                  <select value={row.orderUnit} onChange={e => updateRecapUnit(vn, ri, e.target.value)} style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', background: '#fafafa', color: '#000' }}>
                                    {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                ) : (
                                  <div style={{ padding: '8px 12px', fontSize: '14px', fontWeight: '500', color: '#555', background: '#fafafa', borderRadius: '8px', border: '1px solid #e8e8e8' }}>{row.orderUnit}</div>
                                )}
                              </div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: '700', color: '#3B6D11', textAlign: 'right' }}>Final: {row.finalQty} {row.orderUnit}</div>
                          </div>
                        )
                      })
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>{['Item', 'On Hand', 'Par', 'Suggested', 'Order Qty', 'Unit', 'Final'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 1 ? 'center' : 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {recapRows[vn].map((row, ri) => {
                            const unitOptions = getUnitOptions(row)
                            const canSwitch = canSwitchUnit(row)
                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                                <td style={{ padding: '10px 12px', fontSize: '13px' }}><div style={{ fontWeight: '500', color: '#000' }}>{row.name}</div>{row.notes && <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>{row.notes}</div>}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#555', fontSize: '12px' }}>{Number(row.on_hand_count || 0).toFixed(2)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#555', fontSize: '12px' }}>{row.par || 0}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#3B6D11', fontWeight: '600' }}>{row.suggested}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <input type="number" min="0" step="0.01" value={row.overrideQty === 0 ? '' : row.overrideQty} onChange={e => updateRecapQty(vn, ri, parseFloat(e.target.value) || 0)}
                                    style={{ width: '70px', textAlign: 'center', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '5px', fontSize: '13px', background: '#fafafa' }} />
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  {canSwitch && unitOptions.length > 1 ? (
                                    <select value={row.orderUnit} onChange={e => updateRecapUnit(vn, ri, e.target.value)} style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: '#000', cursor: 'pointer' }}>
                                      {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#555', fontWeight: '500' }}>{row.orderUnit}</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#3B6D11', fontSize: '13px' }}>
                                  {row.finalQty} <span style={{ fontSize: '11px', color: '#aaa', fontWeight: '400' }}>{row.orderUnit}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'grid', gridTemplateColumns: can('submit_order') ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '8px' }}>
              <button onClick={markAsReady} disabled={saving} style={{ background: '#fff', color: '#3B6D11', border: '2px solid #3B6D11', padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : '✓ Mark as Ready'}
              </button>
              {can('submit_order') && (
                <button onClick={submitOrder} disabled={submitting} style={{ background: submitting ? '#ccc' : '#333', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? 'Submitting...' : '✉️ Submit Order'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function BOHOrderPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
      </div>
    }>
      <BOHOrder />
    </Suspense>
  )
}