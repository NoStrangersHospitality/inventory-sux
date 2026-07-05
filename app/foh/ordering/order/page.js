'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRole } from '@/hooks/useRole'

function Order() {
  const [items, setItems] = useState([])
  const [distributors, setDistributors] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('select')
  const [selectedCats, setSelectedCats] = useState(new Set(['liquor', 'beer', 'wine', 'misc']))
  const [orderRows, setOrderRows] = useState({})
  const [recapRows, setRecapRows] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [draftOrder, setDraftOrder] = useState(null)
  const [readyOrder, setReadyOrder] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [orderHistory, setOrderHistory] = useState({})
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [addItemSearchTerm, setAddItemSearchTerm] = useState('')
  const [availableToAdd, setAvailableToAdd] = useState([])
  const [addItemStep, setAddItemStep] = useState('search')
  const [newItemForm, setNewItemForm] = useState({
    name: '', category: 'liquor', item_type: 'bottle', unit: 'bottle',
    unit_cost: '', par: '', distributor_id: '', notes: '', on_hand: 0, on_menu: true
  })
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can, ownerId } = useRole()
  const initRan = useRef(false)

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

  const getDefaultUnit = (item) => {
    if (item.category === 'wine') return 'case'
    if (item.category === 'liquor') return 'bottle'
    if (item.category === 'beer') {
      if (item.item_type === 'keg') return 'keg'
      return item.unit || 'bottle'
    }
    return item.unit || 'bottle'
  }

  const canSwitchUnit = (item) => {
    if (item.category === 'beer' && item.item_type === 'keg') return false
    if (item.category === 'misc') return false
    return true
  }

  const getUnitOptions = (item) => {
    if (item.category === 'liquor') return ['bottle', 'case']
    if (item.category === 'wine') return ['case', 'bottle']
    if (item.category === 'beer') {
      if (item.item_type === 'keg') return ['keg']
      return [item.unit || 'bottle', 'case']
    }
    return [item.unit || 'bottle']
  }

  const getItemHistory = (itemId) => orderHistory[itemId] || []

  const getItemHistoryAvg = (itemId) => {
    const hist = getItemHistory(itemId)
    if (!hist.length) return null
    return hist.reduce((sum, h) => sum + (h.qty || 0), 0) / hist.length
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!ownerId) return
    if (initRan.current) return
    initRan.current = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }

      const ownerIdToUse = ownerId || session.user.id

      const [{ data: itemData }, { data: distData }] = await Promise.all([
        supabase.from('inventory_items').select('*').eq('user_id', ownerIdToUse).eq('area', 'foh').eq('on_menu', true).order('name'),
        supabase.from('distributors').select('*').eq('user_id', ownerIdToUse).order('name')
      ])
      const fetchedItems = itemData || []
      const fetchedDists = distData || []
      setItems(fetchedItems)
      setDistributors(fetchedDists)

      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, submitted_at')
        .eq('user_id', ownerIdToUse)
        .eq('area', 'foh')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(4)

      if (recentOrders && recentOrders.length > 0) {
        const orderIds = recentOrders.map(o => o.id)
        const { data: historyLines } = await supabase
          .from('order_lines')
          .select('item_id, final_qty, order_id')
          .in('order_id', orderIds)

        const qtyByItemAndOrder = {}
        ;(historyLines || []).forEach(line => {
          if (!line.item_id) return
          if (!qtyByItemAndOrder[line.item_id]) qtyByItemAndOrder[line.item_id] = {}
          qtyByItemAndOrder[line.item_id][line.order_id] = line.final_qty
        })

        const history = {}
        const itemIdsWithAnyHistory = new Set(Object.keys(qtyByItemAndOrder))
        itemIdsWithAnyHistory.forEach(itemId => {
          history[itemId] = recentOrders.map(o => ({
            qty: qtyByItemAndOrder[itemId]?.[o.id] ?? 0,
            date: o.submitted_at,
            orderId: o.id,
          }))
        })
        setOrderHistory(history)
      }

      const buildByDistFromItems = () => {
        const byDist = {}
        CATEGORIES.forEach(c => {
          fetchedItems.filter(i => i.category === c.key).forEach(item => {
            const dist = fetchedDists.find(d => d.id === item.distributor_id)
            const key = dist ? dist.name : 'Unassigned'
            if (!byDist[key]) byDist[key] = []
            byDist[key].push({ ...item, catLabel: c.label, distName: key, distObj: dist, on_hand_count: 0, suggested: Math.max(0, Math.ceil(item.par || 0)) })
          })
        })
        return byDist
      }

      const buildByDistFromLines = (lines) => {
        const byDist = {}
        lines.forEach(line => {
          const key = line.distributor_name || 'Unassigned'
          if (!byDist[key]) byDist[key] = []
          const item = fetchedItems.find(i => i.id === line.item_id)
          if (!item) return
          const dist = fetchedDists.find(d => d.id === line.distributor_id)
          const catLabel = CATEGORIES.find(c => c.key === item.category)?.label || item.category
          byDist[key].push({
            ...item, catLabel, distName: key, distObj: dist,
            on_hand_count: line.shelf_count || 0,
            suggested: line.suggested_qty || 0,
            line_id: line.id,
          })
        })
        return byDist
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
            const byDist = lines && lines.length > 0 ? buildByDistFromLines(lines) : buildByDistFromItems()
            setOrderRows(byDist)
            setStep('sheet')
          } else if (existingOrder.status === 'ready' && lines && lines.length > 0) {
            setReadyOrder(existingOrder)
            const byDist = buildByDistFromLines(lines)
            const rd = {}
            Object.keys(byDist).forEach(dn => {
              const needed = byDist[dn].filter(r => r.suggested > 0)
              if (needed.length) rd[dn] = needed.map(r => ({
                ...r, overrideQty: r.suggested, finalQty: r.suggested,
                orderUnit: r.category === 'wine' ? 'case' : r.category === 'liquor' ? 'bottle' : r.unit || 'bottle'
              }))
            })
            if (Object.keys(rd).length === 0) {
              alert('All items on this order are now at or above par — nothing left to order.')
              router.push('/foh/ordering')
            } else {
              setOrderRows(byDist)
              setRecapRows(rd)
              setStep('recap')
            }
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
      if (next.has(cat)) { next.delete(cat) } else { next.add(cat) }
      return next
    })
  }

  const buildOrderSheet = () => {
    const allItems = []
    CATEGORIES.filter(c => selectedCats.has(c.key)).forEach(c => {
      items.filter(i => i.category === c.key).forEach(item => {
        allItems.push({ ...item, catLabel: c.label })
      })
    })
    if (!allItems.length) { alert('No items in selected categories.'); return }
    const byDist = {}
    allItems.forEach(item => {
      const dist = distributors.find(d => d.id === item.distributor_id)
      const key = dist ? dist.name : 'Unassigned'
      if (!byDist[key]) byDist[key] = []
      byDist[key].push({ ...item, distName: key, distObj: dist, on_hand_count: 0, total: 0, suggested: Math.max(0, Math.ceil(item.par || 0)) })
    })
    setOrderRows(byDist)
    setStep('sheet')
  }

  const updateRow = async (distName, idx, field, val) => {
    setOrderRows(prev => {
      const next = { ...prev }
      const rows = [...next[distName]]
      rows[idx] = { ...rows[idx], [field]: val }
      const row = rows[idx]
      const par = field === 'par' ? val : (row.par || 0)
      const onHand = field === 'on_hand_count' ? val : (row.on_hand_count || 0)
      rows[idx].suggested = Math.max(0, Math.ceil(par - onHand))
      next[distName] = rows
      return next
    })
    if (field === 'par') {
      const { data: { session } } = await supabase.auth.getSession()
      const row = orderRows[distName][idx]
      if (row?.id) await supabase.from('inventory_items').update({ par: parseFloat(val) || 0 }).eq('id', row.id).eq('user_id', session.user.id)
    }
    if (draftOrder) {
      const row = orderRows[distName][idx]
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
      const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
        user_id: ownerIdToUse, status: 'draft', area: 'foh',
        receiving_status: 'pending', created_at: new Date().toISOString()
      }).select().single()
      if (orderError || !newOrder) {
        console.error('saveDraft order insert error:', orderError)
        setSaving(false)
        alert('Failed to create draft order. Please try again.')
        return
      }
      order = newOrder
      setDraftOrder(order)
    } else {
      await supabase.from('orders').update({ status: 'draft' }).eq('id', order.id)
      await supabase.from('order_lines').delete().eq('order_id', order.id)
    }

    const lines = []
    Object.keys(orderRows).forEach(dn => {
      orderRows[dn].forEach(row => {
        lines.push({
          order_id: order.id, user_id: ownerIdToUse, item_id: row.id, item_name: row.name,
          distributor_id: row.distributor_id || null, distributor_name: dn,
          par: row.par || 0, shelf_count: row.on_hand_count || 0, well_count: 0,
          suggested_qty: row.suggested, final_qty: row.suggested,
        })
      })
    })

    const { data: insertedLines, error: linesError } = await supabase.from('order_lines').insert(lines).select()
    if (linesError) console.error('saveDraft lines error:', linesError)

    const updatedRows = { ...orderRows }
    insertedLines?.forEach(line => {
      const distRows = updatedRows[line.distributor_name]
      if (!distRows) return
      const idx = distRows.findIndex(r => r.id === line.item_id)
      if (idx >= 0) updatedRows[line.distributor_name][idx].line_id = line.id
    })
    setOrderRows(updatedRows)
    setSaving(false)
    router.push('/foh/ordering')
  }

  const buildRecap = () => {
    const rd = {}
    Object.keys(orderRows).forEach(dn => {
      const needed = orderRows[dn].filter(r => r.suggested > 0)
      if (needed.length) rd[dn] = needed.map(r => ({ ...r, overrideQty: r.suggested, finalQty: r.suggested, orderUnit: getDefaultUnit(r) }))
    })
    if (!Object.keys(rd).length) { alert('No items need ordering.'); return }
    setRecapRows(rd)
    setStep('recap')
  }

  const updateRecapQty = (distName, idx, qty) => {
    setRecapRows(prev => {
      const next = { ...prev }
      const rows = [...next[distName]]
      rows[idx] = { ...rows[idx], overrideQty: qty, finalQty: qty }
      next[distName] = rows
      return next
    })
  }

  const updateRecapUnit = (distName, idx, unit) => {
    setRecapRows(prev => {
      const next = { ...prev }
      const rows = [...next[distName]]
      rows[idx] = { ...rows[idx], orderUnit: unit }
      next[distName] = rows
      return next
    })
  }

  const openAddItemModal = () => {
    setAddItemStep('search')
    setAddItemSearchTerm('')
    setAvailableToAdd([])
    setNewItemForm({
      name: '', category: 'liquor', item_type: 'bottle', unit: 'bottle',
      unit_cost: '', par: '', distributor_id: '', notes: '', on_hand: 0, on_menu: true
    })
    setShowAddItemModal(true)
  }

  const searchItemsToAdd = async (term) => {
    setAddItemSearchTerm(term)
    if (!term.trim()) {
      setAvailableToAdd([])
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    const ownerIdToUse = ownerId || session.user.id
    const { data: allItems } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', ownerIdToUse)
      .eq('area', 'foh')
      .ilike('name', `%${term}%`)
      .limit(10)
    
    const itemsInOrder = new Set()
    Object.keys(orderRows).forEach(dn => {
      orderRows[dn].forEach(row => {
        itemsInOrder.add(row.id)
      })
    })
    
    const filtered = (allItems || []).filter(item => !itemsInOrder.has(item.id))
    setAvailableToAdd(filtered)
  }

  const addExistingItem = async (item) => {
    const { data: { session } } = await supabase.auth.getSession()
    const ownerIdToUse = ownerId || session.user.id
    if (!item.on_menu) {
      await supabase.from('inventory_items').update({ on_menu: true }).eq('id', item.id).eq('user_id', ownerIdToUse)
      item = { ...item, on_menu: true }
    }
    
    const distName = item.distributor_id 
      ? (distributors.find(d => d.id === item.distributor_id)?.name || 'Unassigned')
      : 'Unassigned'
    
    setOrderRows(prev => {
      const next = { ...prev }
      if (!next[distName]) next[distName] = []
      const catLabel = CATEGORIES.find(c => c.key === item.category)?.label || item.category
      next[distName].push({
        ...item,
        catLabel,
        distName,
        on_hand_count: 0,
        suggested: Math.max(0, Math.ceil(item.par || 0))
      })
      return next
    })
    
    setShowAddItemModal(false)
  }

  const createNewItem = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const ownerIdToUse = ownerId || session.user.id
    
    if (!newItemForm.name.trim()) {
      alert('Please enter an item name.')
      return
    }
    
    const { data: createdItem, error: createError } = await supabase
      .from('inventory_items')
      .insert({
        user_id: ownerIdToUse,
        area: 'foh',
        name: newItemForm.name.trim(),
        category: newItemForm.category,
        item_type: newItemForm.item_type,
        unit: newItemForm.unit,
        unit_cost: parseFloat(newItemForm.unit_cost) || 0,
        par: parseFloat(newItemForm.par) || 0,
        on_hand: parseFloat(newItemForm.on_hand) || 0,
        distributor_id: newItemForm.distributor_id || null,
        notes: newItemForm.notes || '',
        on_menu: newItemForm.on_menu
      })
      .select()
      .single()
    
    if (createError || !createdItem) {
      console.error('Create item error:', createError)
      alert('Failed to create item. Please try again.')
      return
    }
    
    const distName = newItemForm.distributor_id
      ? (distributors.find(d => d.id === newItemForm.distributor_id)?.name || 'Unassigned')
      : 'Unassigned'
    
    setOrderRows(prev => {
      const next = { ...prev }
      if (!next[distName]) next[distName] = []
      const catLabel = CATEGORIES.find(c => c.key === createdItem.category)?.label || createdItem.category
      next[distName].push({
        ...createdItem,
        catLabel,
        distName,
        on_hand_count: 0,
        suggested: Math.max(0, Math.ceil(createdItem.par || 0))
      })
      return next
    })
    
    setShowAddItemModal(false)
  }

  const removeItemFromOrder = async (distName, idx) => {
    const { data: { session } } = await supabase.auth.getSession()
    const ownerIdToUse = ownerId || session.user.id
    const row = orderRows[distName][idx]
    
    await supabase
      .from('inventory_items')
      .update({ on_menu: false })
      .eq('id', row.id)
      .eq('user_id', ownerIdToUse)
    
    setOrderRows(prev => {
      const next = { ...prev }
      const rows = [...next[distName]]
      rows.splice(idx, 1)
      if (rows.length === 0) {
        delete next[distName]
      } else {
        next[distName] = rows
      }
      return next
    })
    
    setRecapRows(prev => {
      const next = { ...prev }
      if (next[distName]) {
        const recapIdx = next[distName].findIndex(r => r.id === row.id)
        if (recapIdx >= 0) {
          next[distName].splice(recapIdx, 1)
          if (next[distName].length === 0) {
            delete next[distName]
          }
        }
      }
      return next
    })
  }

  const markAsReady = async () => {
    if (Object.keys(recapRows).length === 0) {
      alert('No items to order — nothing to mark as ready.')
      return
    }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const ownerIdToUse = ownerId || session.user.id
    let order = draftOrder || readyOrder
    if (!order) {
      const { data: newOrder } = await supabase.from('orders').insert({
        user_id: ownerIdToUse, status: 'ready', area: 'foh',
        receiving_status: 'pending', created_at: new Date().toISOString()
      }).select().single()
      order = newOrder
    } else {
      await supabase.from('orders').update({ status: 'ready' }).eq('id', order.id)
      await supabase.from('order_lines').delete().eq('order_id', order.id)
    }
    const lines = []
    Object.keys(recapRows).forEach(dn => {
      recapRows[dn].forEach(row => {
        lines.push({
          order_id: order.id, user_id: ownerIdToUse, item_id: row.id, item_name: row.name,
          distributor_id: row.distributor_id || null, distributor_name: dn,
          par: row.par || 0, shelf_count: row.on_hand_count || 0, well_count: 0,
          suggested_qty: row.suggested, final_qty: row.finalQty, unit: row.orderUnit || row.unit || null,
        })
      })
    })
    await supabase.from('order_lines').insert(lines)
    setReadyOrder(order)
    setSaving(false)
    router.push('/foh/ordering')
  }

  const submitOrder = async () => {
    if (Object.keys(recapRows).length === 0) {
      alert('No items to order — nothing to submit.')
      return
    }
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
        user_id: ownerIdToUse, status: 'submitted', area: 'foh',
        receiving_status: 'pending', submitted_at: new Date().toISOString()
      }).select().single()
      order = newOrder
    } else {
      await supabase.from('orders').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', order.id)
      await supabase.from('order_lines').delete().eq('order_id', order.id)
    }

    const lines = []
    Object.keys(recapRows).forEach(dn => {
      recapRows[dn].forEach(row => {
        lines.push({
          order_id: order.id, user_id: ownerIdToUse, item_id: row.id, item_name: row.name,
          distributor_id: row.distributor_id || null, distributor_name: dn,
          par: row.par || 0, shelf_count: row.on_hand_count || 0, well_count: 0,
          suggested_qty: row.suggested, final_qty: row.finalQty, unit: row.orderUnit || row.unit || null
        })
      })
    })

    const { error: linesError } = await supabase.from('order_lines').insert(lines)
    if (linesError) console.error('Order lines insert error:', linesError)

    const distributorGroups = {}
    lines.forEach(line => {
      if (!distributorGroups[line.distributor_name]) distributorGroups[line.distributor_name] = { name: line.distributor_name, id: line.distributor_id, lines: [] }
      distributorGroups[line.distributor_name].lines.push(line)
    })

    const distIds = [...new Set(lines.map(l => l.distributor_id).filter(Boolean))]
    const { data: distContacts } = await supabase.from('distributors').select('id, name, email, phone, order_method').in('id', distIds)

    for (const [, group] of Object.entries(distributorGroups)) {
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
      const distGroupsForPDF = Object.entries(distributorGroups).map(([name, group]) => {
        const contact = distContacts?.find(d => d.id === group.id)
        return { name, email: contact?.email || null, lines: group.lines.filter(l => l.final_qty > 0) }
      }).filter(g => g.lines.length > 0)
      const totalItems = distGroupsForPDF.reduce((sum, g) => sum + g.lines.length, 0)
      const pdfRes = await fetch('/api/orders/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, userId: session.user.id, barName, managerName, orderDate, distributorGroups: distGroupsForPDF, totalItems }) })
      const pdfData = await pdfRes.json()
      if (pdfData.pdfUrl) {
        const { error: urlError } = await supabase.from('orders').update({ pdf_url: pdfData.pdfUrl }).eq('id', order.id)
        if (urlError) console.error('PDF URL save error:', urlError)
      }
    } catch (err) { console.error('PDF generation error:', err) }

    setSubmitted(true)
    setSubmitting(false)
    router.push('/foh/ordering')
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {step === 'select' && (
          <>
            <h1 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>Build Order</h1>
            <p style={{ color: '#999', fontSize: '14px', marginBottom: '20px' }}>Select categories to include in this order.</p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => toggleCat(c.key)}
                  style={{
                    padding: '16px', border: selectedCats.has(c.key) ? '2px solid #3B6D11' : '1px solid #e8e8e8',
                    background: selectedCats.has(c.key) ? '#f0f7ec' : '#fff', borderRadius: '10px',
                    cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: selectedCats.has(c.key) ? '#3B6D11' : '#555',
                    display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
            <button onClick={buildOrderSheet} style={{ width: '100%', padding: '14px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>
              Start Order →
            </button>
          </>
        )}

        {step === 'sheet' && (
          <>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>Order Sheet</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '16px' }}>Enter on-hand counts and adjust pars as needed.</p>
            {Object.keys(orderRows).map(dn => {
              const dist = distributors.find(d => d.name === dn)
              return (
                <div key={dn} style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#111', borderRadius: '10px 10px 0 0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🚚</span>
                    <span style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>{dn}</span>
                    {dist?.email && !isMobile && <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '8px' }}>{dist.email}</span>}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    {isMobile ? (
                      orderRows[dn].map((row, ri) => (
                        <div key={row.id} style={{ padding: '14px', borderBottom: '1px solid #f5f5f5' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>{row.name}</div>
                            <button onClick={() => removeItemFromOrder(dn, ri)} style={{ background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>Par</div>
                              <input type="number" min="0" defaultValue={row.par || 0} onChange={e => updateRow(dn, ri, 'par', parseFloat(e.target.value) || 0)} style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '8px 12px', fontSize: '16px', background: '#fafafa' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>On Hand</div>
                              <input type="number" min="0" step="0.1" value={row.on_hand_count === 0 ? '' : row.on_hand_count} onChange={e => updateRow(dn, ri, 'on_hand_count', parseFloat(e.target.value) || 0)} style={{ width: '100%', border: '1px solid #F5B800', borderRadius: '8px', padding: '8px 12px', fontSize: '16px', background: '#fffbe6', fontWeight: '600' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: row.suggested > 0 ? '#3B6D11' : '#ccc' }}>Suggested: {row.suggested}</div>
                        </div>
                      ))
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>{['Product', 'Category', 'Unit', 'Last 4 Orders', 'Avg', 'Par', 'On Hand', 'Suggested', ''].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 2 && i < 8 ? 'center' : 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', width: i === 8 ? '40px' : 'auto' }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {orderRows[dn].map((row, ri) => {
                            const hist = getItemHistory(row.id)
                            const avg = getItemHistoryAvg(row.id)
                            return (
                            <tr key={row.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                              <td style={{ padding: '8px 10px', fontSize: '12px' }}><div style={{ fontWeight: '500', color: '#000' }}>{row.name}</div>{row.notes && <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>{row.notes}</div>}</td>
                              <td style={{ padding: '8px 10px', fontSize: '11px', color: '#888' }}>{row.catLabel}</td>
                              <td style={{ padding: '8px 10px', fontSize: '11px', color: '#888' }}>{row.unit || '--'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '11px', color: '#888' }}>
                                {hist.length > 0 ? hist.map(h => h.qty).join(' · ') : <span style={{ color: '#ccc' }}>--</span>}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: avg !== null ? '#555' : '#ccc' }}>
                                {avg !== null ? avg.toFixed(1) : '--'}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <input type="number" min="0" defaultValue={row.par || 0} onChange={e => updateRow(dn, ri, 'par', parseFloat(e.target.value) || 0)} style={{ width: '60px', textAlign: 'center', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '4px', fontSize: '12px', background: '#fafafa' }} />
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <input type="number" min="0" step="0.1" value={row.on_hand_count === 0 ? '' : row.on_hand_count} onChange={e => updateRow(dn, ri, 'on_hand_count', parseFloat(e.target.value) || 0)} style={{ width: '64px', textAlign: 'center', border: '1px solid #F5B800', borderRadius: '6px', padding: '4px', fontSize: '12px', background: '#fffbe6', fontWeight: '500' }} />
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: row.suggested > 0 ? '#3B6D11' : '#ccc', fontSize: '12px' }}>{row.suggested}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <button onClick={() => removeItemFromOrder(dn, ri)} style={{ background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px', marginTop: '8px' }}>
              <button onClick={openAddItemModal} style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                ➕ Add Item
              </button>
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
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>Order Recap</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '16px' }}>Adjust quantities and units if needed.</p>
            {Object.keys(recapRows).map(dn => {
              const dist = distributors.find(d => d.name === dn)
              return (
                <div key={dn} style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#111', borderRadius: '10px 10px 0 0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🚚</span>
                    <span style={{ fontWeight: '600', color: '#fff', fontSize: '13px' }}>{dn}</span>
                    {dist?.email && !isMobile && <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '8px' }}>{dist.email}</span>}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    {isMobile ? (
                      recapRows[dn].map((row, ri) => {
                        const unitOptions = getUnitOptions(row)
                        const canSwitch = canSwitchUnit(row)
                        return (
                          <div key={row.id} style={{ padding: '14px', borderBottom: '1px solid #f5f5f5' }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '10px' }}>{row.name}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                              <div style={{ background: '#fafafa', borderRadius: '8px', padding: '8px 12px' }}>
                                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>On Hand</div>
                                <div style={{ fontSize: '15px', fontWeight: '600', color: '#000' }}>{Number(row.on_hand_count || 0).toFixed(1)}</div>
                              </div>
                              <div style={{ background: '#fafafa', borderRadius: '8px', padding: '8px 12px' }}>
                                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Suggested</div>
                                <div style={{ fontSize: '15px', fontWeight: '700', color: '#3B6D11' }}>{row.suggested}</div>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>Order Qty</div>
                                <input type="number" min="0" step="0.01" value={row.overrideQty === 0 ? '' : row.overrideQty} onChange={e => updateRecapQty(dn, ri, parseFloat(e.target.value) || 0)} style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '8px 12px', fontSize: '16px', background: '#fafafa', fontWeight: '600' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>Unit</div>
                                {canSwitch && unitOptions.length > 1 ? (
                                  <select value={row.orderUnit} onChange={e => updateRecapUnit(dn, ri, e.target.value)} style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '8px 12px', fontSize: '16px', background: '#fafafa', color: '#000' }}>
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
                          <tr>{['Product', 'On Hand', 'Par', 'Suggested', 'Order Qty', 'Unit', 'Final'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 1 ? 'center' : 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {recapRows[dn].map((row, ri) => {
                            const unitOptions = getUnitOptions(row)
                            const canSwitch = canSwitchUnit(row)
                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                                <td style={{ padding: '10px 12px', fontSize: '13px' }}><div style={{ fontWeight: '500', color: '#000' }}>{row.name}</div>{row.notes && <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>{row.notes}</div>}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#555', fontSize: '12px' }}>{Number(row.on_hand_count || 0).toFixed(1)}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#555', fontSize: '12px' }}>{row.par || 0}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#3B6D11', fontWeight: '600' }}>{row.suggested}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <input type="number" min="0" step="0.01" value={row.overrideQty === 0 ? '' : row.overrideQty} onChange={e => updateRecapQty(dn, ri, parseFloat(e.target.value) || 0)} style={{ width: '70px', textAlign: 'center', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '5px', fontSize: '13px', background: '#fafafa' }} />
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  {canSwitch && unitOptions.length > 1 ? (
                                    <select value={row.orderUnit} onChange={e => updateRecapUnit(dn, ri, e.target.value)} style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: '#000', cursor: 'pointer' }}>
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

        {showAddItemModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '550px', width: '90%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#000', margin: 0 }}>Add Item to Order</h2>
                <button onClick={() => setShowAddItemModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#999', cursor: 'pointer' }}>✕</button>
              </div>

              {addItemStep === 'search' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Search Existing Items</label>
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={addItemSearchTerm}
                      onChange={e => searchItemsToAdd(e.target.value)}
                      style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  {availableToAdd.length > 0 ? (
                    <div style={{ background: '#fafafa', borderRadius: '8px', maxHeight: '300px', overflow: 'auto', marginBottom: '16px' }}>
                      {availableToAdd.map(item => (
                        <button
                          key={item.id}
                          onClick={() => addExistingItem(item)}
                          style={{ width: '100%', padding: '12px', border: 'none', background: 'none', borderBottom: '1px solid #e8e8e8', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#000', fontWeight: '500', transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <div style={{ fontWeight: '500' }}>{item.name}</div>
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{item.category} • {item.unit} • ${item.unit_cost || '0.00'}</div>
                        </button>
                      ))}
                    </div>
                  ) : addItemSearchTerm ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#999', fontSize: '13px', marginBottom: '16px' }}>
                      No matching items found.
                    </div>
                  ) : null}

                  <button
                    onClick={() => setAddItemStep('create')}
                    style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff', fontSize: '14px', fontWeight: '500', color: '#555', cursor: 'pointer', marginBottom: '8px' }}
                  >
                    ➕ Create New Item
                  </button>
                </>
              )}

              {addItemStep === 'create' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Item Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., Patron Silver Tequila"
                      value={newItemForm.name}
                      onChange={e => setNewItemForm({ ...newItemForm, name: e.target.value })}
                      style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Category</label>
                      <select
                        value={newItemForm.category}
                        onChange={e => {
                          const cat = e.target.value
                          setNewItemForm({ ...newItemForm, category: cat, item_type: ITEM_TYPES[cat][0] })
                        }}
                        style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box', color: '#000' }}
                      >
                        {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Item Type</label>
                      <select
                        value={newItemForm.item_type}
                        onChange={e => setNewItemForm({ ...newItemForm, item_type: e.target.value })}
                        style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box', color: '#000' }}
                      >
                        {ITEM_TYPES[newItemForm.category]?.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Unit</label>
                      <input
                        type="text"
                        placeholder="e.g., bottle"
                        value={newItemForm.unit}
                        onChange={e => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                        style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Unit Cost ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={newItemForm.unit_cost}
                        onChange={e => setNewItemForm({ ...newItemForm, unit_cost: e.target.value })}
                        style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Par</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={newItemForm.par}
                        onChange={e => setNewItemForm({ ...newItemForm, par: e.target.value })}
                        style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Distributor</label>
                      <select
                        value={newItemForm.distributor_id}
                        onChange={e => setNewItemForm({ ...newItemForm, distributor_id: e.target.value })}
                        style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box', color: '#000' }}
                      >
                        <option value="">Unassigned</option>
                        {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Notes</label>
                    <input
                      type="text"
                      placeholder="Optional notes..."
                      value={newItemForm.notes}
                      onChange={e => setNewItemForm({ ...newItemForm, notes: e.target.value })}
                      style={{ width: '100%', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id="onMenu"
                      checked={newItemForm.on_menu}
                      onChange={e => setNewItemForm({ ...newItemForm, on_menu: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="onMenu" style={{ fontSize: '14px', color: '#555', cursor: 'pointer', margin: 0 }}>Add to menu for future orders</label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      onClick={() => setAddItemStep('search')}
                      style={{ padding: '12px', border: '1px solid #e8e8e8', borderRadius: '8px', background: '#fff', fontSize: '14px', fontWeight: '600', color: '#555', cursor: 'pointer' }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={createNewItem}
                      style={{ padding: '12px', border: 'none', borderRadius: '8px', background: '#3B6D11', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Create & Add
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
      </div>
    }>
      <Order />
    </Suspense>
  )
}