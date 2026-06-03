'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'

export default function BOHReceiveOrder() {
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState(null)
  const [lines, setLines] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()
  const params = useParams()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.boh_access) { router.push('/dashboard'); return }
      await loadOrder(session.user.id)
      setLoading(false)
    }
    init()
  }, [params.orderId])

  const loadOrder = async (userId) => {
    const [{ data: orderData }, { data: lineData }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', params.orderId).eq('user_id', userId).single(),
      supabase.from('order_lines').select('*').eq('order_id', params.orderId).order('distributor_name').order('item_name')
    ])
    if (!orderData) { router.push('/boh/ordering'); return }
    setOrder(orderData)
    setLines((lineData || []).map(l => ({
      ...l,
      received: true,
      received_qty: l.final_qty
    })))
  }

  const toggleLine = (id) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, received: !l.received, received_qty: !l.received ? l.final_qty : 0 } : l))
  }

  const updateQty = (id, qty) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, received_qty: qty } : l))
  }

  const confirmFull = async () => {
    setSubmitting(true)
    await processReceiving('received', lines.map(l => ({ ...l, received: true, received_qty: l.final_qty })))
  }

  const confirmPartial = async () => {
    setSubmitting(true)
    await processReceiving(
      lines.every(l => l.received) ? 'received' : 'partial',
      lines
    )
  }

  const confirmReject = async () => {
    if (!confirm('Are you sure you want to reject this entire delivery? This cannot be undone.')) return
    setSubmitting(true)
    await processReceiving('rejected', lines.map(l => ({ ...l, received: false, received_qty: 0 })))
  }

  const processReceiving = async (status, resolvedLines) => {
    const { data: { session } } = await supabase.auth.getSession()

    for (const line of resolvedLines) {
      const lineStatus = !line.received ? 'missing' : parseFloat(line.received_qty) < parseFloat(line.final_qty) ? 'short' : 'received'
      await supabase.from('order_lines').update({
        received_qty: parseFloat(line.received_qty) || 0,
        receiving_status: lineStatus
      }).eq('id', line.id)

      if (line.received && line.received_qty > 0 && line.item_id) {
        const { data: invItem } = await supabase
          .from('inventory_items')
          .select('on_hand')
          .eq('id', line.item_id)
          .single()

        if (invItem) {
          const newOnHand = (parseFloat(invItem.on_hand) || 0) + (parseFloat(line.received_qty) || 0)
          await supabase.from('inventory_items').update({ on_hand: newOnHand }).eq('id', line.item_id)

          await supabase.from('inventory_history').insert({
            user_id: session.user.id,
            inventory_item_id: line.item_id,
            item_name: line.item_name,
            category: line.category || null,
            area: 'boh',
            event_type: 'receiving',
            event_id: order.id,
            quantity_before: parseFloat(invItem.on_hand) || 0,
            quantity_change: parseFloat(line.received_qty) || 0,
            quantity_after: newOnHand,
            unit_cost_at_time: line.unit_cost || 0,
            total_value_at_time: newOnHand * (line.unit_cost || 0)
          })
        }
      }
    }

    await supabase.from('orders').update({
      receiving_status: status,
      received_at: new Date().toISOString()
    }).eq('id', order.id)

    sessionStorage.removeItem('delivery_banner_dismissed')

    setConfirmed(true)
    setSubmitting(false)
  }

  const receivedCount = lines.filter(l => l.received).length
  const missingCount = lines.filter(l => !l.received).length
  const shortCount = lines.filter(l => l.received && parseFloat(l.received_qty) < parseFloat(l.final_qty)).length

  const grouped = lines.reduce((acc, line) => {
    const key = line.distributor_name || 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(line)
    return acc
  }, {})

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  if (confirmed) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '48px', textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontSize: '52px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Delivery confirmed!</h2>
        <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '28px' }}>
          BOH inventory has been updated for all received items.
          {missingCount > 0 && ` ${missingCount} item${missingCount !== 1 ? 's' : ''} marked as missing.`}
          {shortCount > 0 && ` ${shortCount} item${shortCount !== 1 ? 's' : ''} received short.`}
        </p>
        <button onClick={() => router.push('/boh/ordering')}
          style={{ background: '#F5B800', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
          ← Back to BOH Ordering
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/boh/ordering')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← BOH Ordering</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Confirm BOH Delivery</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>
              Order from {order?.submitted_at ? new Date(order.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
              {' · '}{lines.length} items
            </p>
          </div>
        </div>

        <div style={{ background: '#f0f8ff', border: '1px solid #b5d4f4', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', color: '#185FA5' }}>
          💡 All items are checked by default. Uncheck anything that didn't arrive, and adjust quantities for short shipments. Confirmed items will update your BOH inventory automatically.
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[
            { label: `${receivedCount} received`, color: '#EAF3DE', textColor: '#27500A', border: '#97C459' },
            { label: `${shortCount} short`, color: '#FAEEDA', textColor: '#854F0B', border: '#f0c080' },
            { label: `${missingCount} missing`, color: '#fff5f5', textColor: '#c53030', border: '#fca5a5' },
          ].map(p => (
            <div key={p.label} style={{ background: p.color, color: p.textColor, border: `1px solid ${p.border}`, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: '500' }}>
              {p.label}
            </div>
          ))}
        </div>

        {Object.entries(grouped).map(([vendorName, vendorLines]) => (
          <div key={vendorName} style={{ marginBottom: '20px' }}>
            <div style={{ background: '#111', borderRadius: '10px 10px 0 0', padding: '10px 16px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>🚚 {vendorName}</span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['', 'Item', 'Unit', 'Ordered', 'Received Qty'].map((h, i) => (
                      <th key={i} style={{ textAlign: i > 2 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorLines.map(line => (
                    <tr key={line.id} style={{ borderBottom: '1px solid #f5f5f5', background: !line.received ? '#fff8f8' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={line.received}
                          onChange={() => toggleLine(line.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#F5B800' }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: '500', color: line.received ? '#000' : '#aaa', fontSize: '13px' }}>
                        {line.item_name}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#aaa', fontSize: '12px' }}>{line.unit || '--'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontSize: '13px' }}>{line.final_qty}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                        {line.received ? (
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={line.received_qty === 0 ? '' : line.received_qty}
                            onChange={e => updateQty(line.id, parseFloat(e.target.value) || 0)}
                            style={{
                              width: '80px',
                              background: parseFloat(line.received_qty) < parseFloat(line.final_qty) ? '#FAEEDA' : '#fffbe6',
                              border: `1px solid ${parseFloat(line.received_qty) < parseFloat(line.final_qty) ? '#f0c080' : '#F5B800'}`,
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '13px',
                              color: '#000',
                              textAlign: 'right',
                              fontWeight: '600'
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '12px', color: '#E24B4A', fontWeight: '500' }}>Not received</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px 24px' }}>
          <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '14px', textAlign: 'center' }}>
            How did this delivery go?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <button
              onClick={confirmReject}
              disabled={submitting}
              style={{ background: '#fff', color: '#E24B4A', border: '2px solid #E24B4A', padding: '14px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer' }}>
              🔴 Reject All
            </button>
            <button
              onClick={confirmPartial}
              disabled={submitting}
              style={{ background: '#F5B800', color: '#000', border: '2px solid #F5B800', padding: '14px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer' }}>
              🟡 Confirm As Shown
            </button>
            <button
              onClick={confirmFull}
              disabled={submitting}
              style={{ background: '#3B6D11', color: '#fff', border: '2px solid #3B6D11', padding: '14px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer' }}>
              🟢 All Received
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', marginTop: '10px' }}>
            🟢 marks everything received at ordered quantities · 🟡 confirms what you've checked above · 🔴 rejects the entire delivery
          </div>
        </div>

      </div>
    </div>
  )
}