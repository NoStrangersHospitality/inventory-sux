'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'

export default function ReceiveOrder() {
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState(null)
  const [lines, setLines] = useState([])
  const [receiving, setReceiving] = useState({}) // distributor_name -> order_receiving row
  const [submitting, setSubmitting] = useState(null) // distributor name currently submitting
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const params = useParams()

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

  const loadOrder = async (userId) => {
    const [{ data: orderData }, { data: lineData }, { data: receivingData }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', params.orderId).eq('user_id', userId).single(),
      supabase.from('order_lines').select('*').eq('order_id', params.orderId).order('distributor_name').order('item_name'),
      supabase.from('order_receiving').select('*').eq('order_id', params.orderId).eq('user_id', userId)
    ])
    if (!orderData) { router.push('/foh/ordering'); return }
    setOrder(orderData)
    setLines((lineData || []).map(l => ({
      ...l,
      received: true,
      received_qty: l.final_qty
    })))

    // Build receiving map by distributor_name
    const recMap = {}
    ;(receivingData || []).forEach(r => {
      recMap[r.distributor_name] = r
    })

    // If no order_receiving rows exist yet, seed them from lines
    if (!receivingData || receivingData.length === 0) {
      const distNames = [...new Set((lineData || []).map(l => l.distributor_name || 'Unassigned'))]
      const toInsert = distNames.map(name => {
        const distLine = (lineData || []).find(l => (l.distributor_name || 'Unassigned') === name)
        return {
          order_id: params.orderId,
          user_id: userId,
          distributor_id: distLine?.distributor_id || null,
          distributor_name: name,
          status: 'pending'
        }
      })
      if (toInsert.length > 0) {
        const { data: inserted } = await supabase.from('order_receiving').insert(toInsert).select()
        ;(inserted || []).forEach(r => { recMap[r.distributor_name] = r })
      }
    }

    setReceiving(recMap)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      await loadOrder(session.user.id)
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orderId])

  const toggleLine = (id) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, received: !l.received, received_qty: !l.received ? l.final_qty : 0 } : l))
  }

  const updateQty = (id, qty) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, received_qty: qty } : l))
  }

  const confirmDistributor = async (distName, status) => {
    if (status === 'rejected' && !confirm(`Reject the entire delivery from ${distName}?`)) return
    setSubmitting(distName)

    const distLines = lines.filter(l => (l.distributor_name || 'Unassigned') === distName)
    const resolvedLines = status === 'received'
      ? distLines.map(l => ({ ...l, received: true, received_qty: l.final_qty }))
      : status === 'rejected'
      ? distLines.map(l => ({ ...l, received: false, received_qty: 0 }))
      : distLines

    // Update order_lines status — no on_hand writes
    for (const line of resolvedLines) {
      const lineStatus = !line.received ? 'missing'
        : parseFloat(line.received_qty) < parseFloat(line.final_qty) ? 'short'
        : 'received'
      await supabase.from('order_lines').update({
        received_qty: parseFloat(line.received_qty) || 0,
        receiving_status: lineStatus
      }).eq('id', line.id)
    }

    // Update order_receiving row
    const recRow = receiving[distName]
    const { data: updatedRec } = await supabase.from('order_receiving').update({
      status,
      confirmed_at: new Date().toISOString(),
      is_reopened: false
    }).eq('id', recRow.id).select().single()

    // Update local receiving state
    const newReceiving = { ...receiving, [distName]: updatedRec }
    setReceiving(newReceiving)

    // Check if all distributors are now confirmed — if so close the order
    const allDone = Object.values(newReceiving).every(r => r.status !== 'pending')
    if (allDone) {
      const overallStatus = Object.values(newReceiving).every(r => r.status === 'received') ? 'received'
        : Object.values(newReceiving).some(r => r.status === 'rejected') ? 'partial'
        : 'partial'
      await supabase.from('orders').update({
        receiving_status: overallStatus,
        received_at: new Date().toISOString()
      }).eq('id', order.id)
      sessionStorage.removeItem('delivery_banner_dismissed')
      router.push('/foh/ordering')
    }

    setSubmitting(null)
  }

  const reopenDistributor = async (distName) => {
    const recRow = receiving[distName]
    const { data: updatedRec } = await supabase.from('order_receiving').update({
      status: 'pending',
      confirmed_at: null,
      is_reopened: true
    }).eq('id', recRow.id).select().single()
    setReceiving(prev => ({ ...prev, [distName]: updatedRec }))

    // Also reopen order if it was closed
    await supabase.from('orders').update({ receiving_status: 'pending', received_at: null }).eq('id', order.id)
  }

  const grouped = lines.reduce((acc, line) => {
    const key = line.distributor_name || 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(line)
    return acc
  }, {})

  const totalDistributors = Object.keys(grouped).length
  const confirmedDistributors = Object.values(receiving).filter(r => r.status !== 'pending').length

  const statusBadge = (status) => {
    if (status === 'received') return { bg: '#EAF3DE', color: '#27500A', border: '#97C459', label: '✓ All Received' }
    if (status === 'partial') return { bg: '#FAEEDA', color: '#854F0B', border: '#f0c080', label: '~ Partial' }
    if (status === 'rejected') return { bg: '#fff5f5', color: '#c53030', border: '#fca5a5', label: '✗ Rejected' }
    return null
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  // Defensive guard: some legacy orders ended up with 0 order_lines due to a
  // resolved bug in the order page (resuming a 'ready' order whose items had
  // all dropped to suggested=0 would land on an empty recap, and hitting
  // Mark as Ready / Submit from there wiped the order_lines). For any order
  // that still has no lines, show a clear message instead of a misleading
  // "0/0 distributors confirmed — all confirmed" state.
  if (lines.length === 0) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', padding: '20px' }}>
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '40px 32px', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
        <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>No items on this order</h2>
        <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '24px' }}>This order has no line items to confirm — it may have been corrupted by a past bug.</p>
        <button onClick={() => router.push('/foh/ordering')} style={{ background: '#F5B800', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>← Back to Ordering</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/foh/ordering')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Ordering</button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>Confirm Delivery</h1>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>
            {order?.submitted_at ? new Date(order.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
            {' · '}{lines.length} items · {confirmedDistributors}/{totalDistributors} distributors confirmed
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ background: '#e8e8e8', borderRadius: '4px', height: '4px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ background: '#F5B800', height: '100%', width: `${totalDistributors > 0 ? (confirmedDistributors / totalDistributors) * 100 : 0}%`, transition: 'width .3s' }} />
        </div>

        <div style={{ background: '#f0f8ff', border: '1px solid #b5d4f4', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#185FA5' }}>
          💡 Confirm each distributor&apos;s delivery separately. Inventory updates when you scan the invoice — this just tracks what arrived.
        </div>

        {/* Distributor sections */}
        {Object.entries(grouped).map(([distName, distLines]) => {
          const rec = receiving[distName]
          const isConfirmed = rec && rec.status !== 'pending'
          const isSubmitting = submitting === distName
          const badge = rec ? statusBadge(rec.status) : null

          return (
            <div key={distName} style={{ marginBottom: '20px', opacity: isConfirmed ? 0.85 : 1 }}>

              {/* Distributor header */}
              <div style={{ background: isConfirmed ? '#333' : '#111', borderRadius: '10px 10px 0 0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>🚚 {distName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {badge && (
                    <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: '10px', fontSize: '11px', padding: '2px 10px', fontWeight: '600' }}>
                      {badge.label}
                    </span>
                  )}
                  {isConfirmed && (
                    <button onClick={() => reopenDistributor(distName)}
                      style={{ background: 'none', border: '1px solid #555', color: '#aaa', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                      Reopen
                    </button>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: isConfirmed ? '0 0 10px 10px' : '0', overflow: 'hidden' }}>
                {isMobile ? (
                  distLines.map(line => (
                    <div key={line.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5', background: !line.received ? '#fff8f8' : 'transparent', opacity: isConfirmed ? 0.7 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          <input type="checkbox" checked={line.received} onChange={() => !isConfirmed && toggleLine(line.id)}
                            disabled={isConfirmed}
                            style={{ width: '20px', height: '20px', cursor: isConfirmed ? 'default' : 'pointer', accentColor: '#F5B800', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: line.received ? '#000' : '#aaa' }}>{line.item_name}</div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Ordered: {line.final_qty} {line.unit || ''}</div>
                          </div>
                        </div>
                      </div>
                      {line.received && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '30px' }}>
                          <label style={{ fontSize: '12px', color: '#aaa', whiteSpace: 'nowrap' }}>Qty received:</label>
                          <input type="number" min="0" step="0.1" value={line.received_qty === 0 ? '' : line.received_qty}
                            onChange={e => !isConfirmed && updateQty(line.id, parseFloat(e.target.value) || 0)}
                            disabled={isConfirmed}
                            style={{ flex: 1, background: parseFloat(line.received_qty) < parseFloat(line.final_qty) ? '#FAEEDA' : '#fffbe6', border: `1px solid ${parseFloat(line.received_qty) < parseFloat(line.final_qty) ? '#f0c080' : '#F5B800'}`, borderRadius: '8px', padding: '8px 12px', fontSize: '16px', color: '#000', fontWeight: '600' }} />
                        </div>
                      )}
                      {!line.received && <div style={{ paddingLeft: '30px', fontSize: '12px', color: '#E24B4A', fontWeight: '500' }}>Not received</div>}
                    </div>
                  ))
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['', 'Item', 'Unit', 'Ordered', 'Received Qty'].map((h, i) => (
                        <th key={i} style={{ textAlign: i > 2 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {distLines.map(line => (
                        <tr key={line.id} style={{ borderBottom: '1px solid #f5f5f5', background: !line.received ? '#fff8f8' : 'transparent', opacity: isConfirmed ? 0.7 : 1 }}>
                          <td style={{ padding: '10px 14px', width: '40px' }}>
                            <input type="checkbox" checked={line.received} onChange={() => !isConfirmed && toggleLine(line.id)} disabled={isConfirmed}
                              style={{ width: '16px', height: '16px', cursor: isConfirmed ? 'default' : 'pointer', accentColor: '#F5B800' }} />
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '500', color: line.received ? '#000' : '#aaa', fontSize: '13px' }}>{line.item_name}</td>
                          <td style={{ padding: '10px 14px', color: '#aaa', fontSize: '12px' }}>{line.unit || '--'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontSize: '13px' }}>{line.final_qty}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                            {line.received ? (
                              <input type="number" min="0" step="0.1" value={line.received_qty === 0 ? '' : line.received_qty}
                                onChange={e => !isConfirmed && updateQty(line.id, parseFloat(e.target.value) || 0)}
                                disabled={isConfirmed}
                                style={{ width: '80px', background: parseFloat(line.received_qty) < parseFloat(line.final_qty) ? '#FAEEDA' : '#fffbe6', border: `1px solid ${parseFloat(line.received_qty) < parseFloat(line.final_qty) ? '#f0c080' : '#F5B800'}`, borderRadius: '8px', padding: '6px 10px', fontSize: '13px', color: '#000', textAlign: 'right', fontWeight: '600' }} />
                            ) : (
                              <span style={{ fontSize: '12px', color: '#E24B4A', fontWeight: '500' }}>Not received</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Per-distributor action buttons */}
              {!isConfirmed && (
                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: isMobile ? '14px' : '16px 20px' }}>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px', textAlign: 'center' }}>
                    How did {distName}&apos;s delivery go?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isMobile ? '8px' : '12px' }}>
                    <button onClick={() => confirmDistributor(distName, 'rejected')} disabled={!!isSubmitting}
                      style={{ background: '#fff', color: '#E24B4A', border: '2px solid #E24B4A', padding: isMobile ? '10px 6px' : '12px', borderRadius: '10px', fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                      🔴 {isMobile ? 'Reject' : 'Reject All'}
                    </button>
                    <button onClick={() => confirmDistributor(distName, lines.every(l => (l.distributor_name || 'Unassigned') !== distName || l.received) ? 'partial' : 'partial')} disabled={!!isSubmitting}
                      style={{ background: '#F5B800', color: '#000', border: '2px solid #F5B800', padding: isMobile ? '10px 6px' : '12px', borderRadius: '10px', fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                      🟡 {isMobile ? 'Confirm' : 'Confirm As Shown'}
                    </button>
                    <button onClick={() => confirmDistributor(distName, 'received')} disabled={!!isSubmitting}
                      style={{ background: '#3B6D11', color: '#fff', border: '2px solid #3B6D11', padding: isMobile ? '10px 6px' : '12px', borderRadius: '10px', fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                      🟢 {isMobile ? 'All In' : 'All Received'}
                    </button>
                  </div>
                  {!isMobile && (
                    <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', marginTop: '8px' }}>
                      🟢 all items received at ordered quantities · 🟡 confirms what you&apos;ve checked above · 🔴 rejects this delivery
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Overall progress footer */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px 20px', textAlign: 'center' }}>
          {confirmedDistributors < totalDistributors ? (
            <div style={{ fontSize: '13px', color: '#aaa' }}>
              {totalDistributors - confirmedDistributors} distributor{totalDistributors - confirmedDistributors !== 1 ? 's' : ''} still pending confirmation
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#3B6D11', fontWeight: '500' }}>
              ✓ All distributors confirmed — order will close automatically
            </div>
          )}
        </div>

      </div>
    </div>
  )
}