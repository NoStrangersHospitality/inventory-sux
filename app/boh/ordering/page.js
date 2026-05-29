'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOHOrdering() {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ items: 0, vendors: 0 })
  const [orders, setOrders] = useState([])
  const router = useRouter()

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
      const [{ count: itemCount }, { count: vendorCount }, { data: orderData }] = await Promise.all([
        supabase.from('boh_items').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
        supabase.from('orders').select('*, order_lines(count)').eq('user_id', session.user.id).eq('area', 'boh').order('submitted_at', { ascending: false }).limit(10)
      ])
      setCounts({ items: itemCount || 0, vendors: vendorCount || 0 })
      setOrders(orderData || [])
      setLoading(false)
    }
    init()
  }, [])

  const viewOrderPDF = async (order) => {
    if (order.pdf_url) {
      const filePath = order.pdf_url.startsWith('http')
        ? order.pdf_url.split('/orders/')[1]?.split('?')[0]
        : order.pdf_url
      const { data } = await supabase.storage.from('orders').createSignedUrl(filePath, 3600)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
      else alert('Could not generate view URL. Please try again.')
    } else {
      alert('PDF not available for this order.')
    }
  }

  const tiles = [
    { title: 'Order', desc: 'Build and submit a new order', icon: '📋', href: '/boh/ordering/order' },
    { title: 'Items', desc: `${counts.items} item${counts.items !== 1 ? 's' : ''} in catalog`, icon: '🥩', href: '/boh/ordering/items' },
    { title: 'Vendors', desc: `${counts.vendors} vendor${counts.vendors !== 1 ? 's' : ''} on file`, icon: '🚚', href: '/boh/ordering/vendors' },
  ]

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
        <button onClick={() => router.push('/boh')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← BOH</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>BOH Ordering</h1>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Manage your ingredients, vendors, and place orders.</p>
        </div>

        {/* Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px', marginBottom: '36px' }}>
          {tiles.map(t => (
            <div key={t.title} onClick={() => router.push(t.href)}
              style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '32px 24px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s, box-shadow .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>{t.icon}</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>{t.title}</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* Order history */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Order History</div>
        </div>

        {orders.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '36px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No orders yet. Build your first order above.
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
                {orders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '500', color: '#000', fontSize: '13px' }}>
                      {order.submitted_at ? new Date(order.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#EAF3DE', color: '#27500A', border: '1px solid #97C459', borderRadius: '10px', fontSize: '11px', padding: '2px 8px', fontWeight: '500' }}>
                        Submitted
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#555', fontSize: '13px' }}>
                      {order.order_lines?.[0]?.count || '--'} items
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button onClick={() => viewOrderPDF(order)}
                        style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        View PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}