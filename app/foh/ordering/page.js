'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Ordering() {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ items: 0, distributors: 0 })
  const [orders, setOrders] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [draftOrder, setDraftOrder] = useState(null)
  const [readyOrder, setReadyOrder] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

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

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const [
        { count: itemCount },
        { count: distCount },
        { data: orderData },
        { data: pendingData },
        { data: draftData },
        { data: readyData },
      ] = await Promise.all([
        supabase.from('inventory_items').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('area', 'foh').eq('on_menu', true),
        supabase.from('distributors').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
        supabase.from('orders').select('*, order_lines(count)').eq('user_id', session.user.id).eq('area', 'foh').eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(20),
        supabase.from('orders').select('*, order_lines(*)').eq('user_id', session.user.id).eq('area', 'foh').eq('status', 'submitted').eq('receiving_status', 'pending').order('submitted_at', { ascending: true }),
        supabase.from('orders').select('*, order_lines(count)').eq('user_id', session.user.id).eq('area', 'foh').eq('status', 'draft').order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('orders').select('*, order_lines(count)').eq('user_id', session.user.id).eq('area', 'foh').eq('status', 'ready').order('created_at', { ascending: false }).limit(1).single(),
      ])
      setCounts({ items: itemCount || 0, distributors: distCount || 0 })
      setOrders(orderData || [])
      setPendingOrders(pendingData || [])
      setDraftOrder(draftData || null)
      setReadyOrder(readyData || null)
      setLoading(false)
    }
    init()
  }, [])

  const discardDraft = async () => {
    if (!draftOrder) return
    if (!confirm('Discard this draft order? This cannot be undone.')) return
    await supabase.from('order_lines').delete().eq('order_id', draftOrder.id)
    await supabase.from('orders').delete().eq('id', draftOrder.id)
    setDraftOrder(null)
  }

  const discardReady = async () => {
    if (!readyOrder) return
    if (!confirm('Discard this ready order? This cannot be undone.')) return
    await supabase.from('order_lines').delete().eq('order_id', readyOrder.id)
    await supabase.from('orders').delete().eq('id', readyOrder.id)
    setReadyOrder(null)
  }

  const resumeOrder = (order) => {
    router.push(`/foh/ordering/order?resume=${order.id}`)
  }

  const isOverdue = (order) => {
    const days = (new Date() - new Date(order.submitted_at)) / (1000 * 60 * 60 * 24)
    return days >= 7
  }

  const statusBadge = (status) => {
    switch(status) {
      case 'received': return { bg: '#EAF3DE', color: '#27500A', border: '#97C459', label: 'Received' }
      case 'partial': return { bg: '#FAEEDA', color: '#854F0B', border: '#f0c080', label: 'Partial' }
      case 'rejected': return { bg: '#fff5f5', color: '#c53030', border: '#fca5a5', label: 'Rejected' }
      default: return { bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB', label: 'Pending' }
    }
  }

  const viewOrderPDF = async (order) => {
    if (order.pdf_url) {
      const filePath = order.pdf_url.startsWith('http')
        ? order.pdf_url.split('/orders/')[1]?.split('?')[0]
        : order.pdf_url
      const { data } = await supabase.storage.from('orders').createSignedUrl(filePath, 3600)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
      else alert('PDF not available. This order may have been placed before PDF generation was enabled.')
    } else {
      alert('PDF not available for this order.')
    }
  }

  const tiles = [
    { title: 'Order', desc: 'Build and submit a new order', icon: '📋', href: '/foh/ordering/order' },
    { title: 'Items', desc: `${counts.items} item${counts.items !== 1 ? 's' : ''} on menu`, icon: '🍾', href: '/foh/ordering/items' },
    { title: 'Distributors', desc: `${counts.distributors} rep${counts.distributors !== 1 ? 's' : ''} on file`, icon: '🚚', href: '/foh/ordering/distributors' },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/foh')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← FOH</button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '500', color: '#000' }}>Ordering</h1>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Manage your items, distributors, and place orders.</p>
        </div>

        {/* Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: isMobile ? '10px' : '20px', marginBottom: '28px' }}>
          {tiles.map(t => (
            <div key={t.title} onClick={() => router.push(t.href)}
              style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', padding: isMobile ? '16px 10px' : '32px 24px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s, box-shadow .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ fontSize: isMobile ? '24px' : '36px', marginBottom: '8px' }}>{t.icon}</div>
              <div style={{ fontSize: isMobile ? '12px' : '16px', fontWeight: '600', color: '#000', marginBottom: isMobile ? '0' : '6px' }}>{t.title}</div>
              {!isMobile && <div style={{ fontSize: '12px', color: '#aaa' }}>{t.desc}</div>}
            </div>
          ))}
        </div>

        {/* Draft order banner */}
        {draftOrder && (
          <div style={{ background: '#FAEEDA', border: '1px solid #f0c080', borderRadius: '12px', padding: isMobile ? '14px' : '16px 20px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#854F0B', marginBottom: '2px' }}>
                📝 Draft order in progress
              </div>
              <div style={{ fontSize: '12px', color: '#a07800' }}>
                Started {draftOrder.created_at ? new Date(draftOrder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                {draftOrder.order_lines?.[0]?.count > 0 && ` · ${draftOrder.order_lines[0].count} items`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={discardDraft}
                style={{ background: 'none', border: '1px solid #f0c080', color: '#a07800', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}>
                Discard
              </button>
              <button onClick={() => resumeOrder(draftOrder)}
                style={{ background: '#854F0B', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                Resume →
              </button>
            </div>
          </div>
        )}

        {/* Ready order banner */}
        {readyOrder && (
          <div style={{ background: '#EAF3DE', border: '1px solid #97C459', borderRadius: '12px', padding: isMobile ? '14px' : '16px 20px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#27500A', marginBottom: '2px' }}>
                ✓ Order ready to send
              </div>
              <div style={{ fontSize: '12px', color: '#3B6D11' }}>
                Built {readyOrder.created_at ? new Date(readyOrder.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                {readyOrder.order_lines?.[0]?.count > 0 && ` · ${readyOrder.order_lines[0].count} items`}
                {!isMobile && ' · Ready to submit to your distributors'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={discardReady}
                style={{ background: 'none', border: '1px solid #97C459', color: '#3B6D11', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}>
                Discard
              </button>
              <button onClick={() => resumeOrder(readyOrder)}
                style={{ background: '#3B6D11', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                Review & Submit →
              </button>
            </div>
          </div>
        )}

        {/* Pending receiving queue */}
        {pendingOrders.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚚 Pending Delivery Confirmation
              <span style={{ background: '#F5B800', color: '#000', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                {pendingOrders.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingOrders.map(order => {
                const overdue = isOverdue(order)
                const distributors = [...new Set(order.order_lines?.map(l => l.distributor_name).filter(Boolean))]
                return (
                  <div key={order.id}
                    style={{ background: overdue ? '#fff8f8' : '#fffdf5', border: `1px solid ${overdue ? '#fca5a5' : '#f0d060'}`, borderRadius: '12px', padding: isMobile ? '14px' : '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '4px' }}>
                        {order.submitted_at ? new Date(order.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                        {overdue && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#E24B4A', fontWeight: '700' }}>OVERDUE</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#aaa' }}>
                        {order.order_lines?.length || 0} items
                        {!isMobile && distributors.length > 0 && ` · ${distributors.join(', ')}`}
                      </div>
                    </div>
                    <button onClick={() => router.push(`/foh/ordering/receive/${order.id}`)}
                      style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {isMobile ? 'Confirm →' : 'Confirm Delivery →'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Order history */}
        <div style={{ marginBottom: '12px', marginTop: pendingOrders.length > 0 ? '0' : '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Order History</div>
        </div>

        {orders.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '36px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No completed orders yet. Build your first order above.
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {orders.map(order => {
              const badge = statusBadge(order.receiving_status)
              return (
                <div key={order.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>
                      {order.submitted_at ? new Date(order.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                    </div>
                    <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px', fontWeight: '500' }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>{order.order_lines?.[0]?.count || '--'} items</div>
                    <button onClick={() => viewOrderPDF(order)}
                      style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                      📄 PDF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Order Date', 'Status', 'Items', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const badge = statusBadge(order.receiving_status)
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '500', color: '#000', fontSize: '13px' }}>
                        {order.submitted_at ? new Date(order.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px', fontWeight: '500' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#555', fontSize: '13px' }}>
                        {order.order_lines?.[0]?.count || '--'} items
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={() => viewOrderPDF(order)}
                          style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                          📄 View PDF
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}