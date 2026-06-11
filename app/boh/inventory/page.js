'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOHInventory() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalItems: 0, totalValue: 0, lowStock: 0 })
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
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.boh_access && !prof?.owner_user_id) { router.push('/dashboard'); return }
      const { data: items } = await supabase.from('inventory_items').select('*').eq('user_id', session.user.id).eq('area', 'boh')
      if (items) {
        const totalValue = items.reduce((sum, i) => sum + (i.on_hand * i.unit_cost), 0)
        const lowStock = items.filter(i => i.par > 0 && i.on_hand < i.par).length
        setStats({ totalItems: items.length, totalValue, lowStock })
      }
      setLoading(false)
    }
    init()
  }, [])

  const fmt = (n) => '$' + Number(n).toFixed(2)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const tiles = [
    { icon: '🗄️', title: 'Database', desc: 'Every ingredient and supply you own.', sub: `${stats.totalItems} items · ${fmt(stats.totalValue)} value`, href: '/boh/inventory/database' },
    { icon: '📋', title: 'Count', desc: 'Start a new count or review history.', sub: stats.lowStock > 0 ? `${stats.lowStock} items below par` : 'All items at or above par', subColor: stats.lowStock > 0 ? '#E24B4A' : null, href: '/boh/inventory/count' },
    { icon: '📄', title: 'Invoices', desc: 'Scan vendor invoices to update on hand.', sub: 'Photo or PDF · AI powered', href: '/boh/inventory/invoices' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/boh')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← BOH</button>
      </div>

      <div style={{ padding: isMobile ? '20px 16px' : '28px 24px', maxWidth: '1000px', margin: '0 auto' }}>

        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '500', color: '#000' }}>BOH Inventory</h1>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Manage your kitchen inventory, counts, and receiving.</p>
        </div>

        {/* Stats */}
        {stats.totalItems > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Total Items', val: stats.totalItems, sub: 'in database' },
              { label: 'Inventory Value', val: fmt(stats.totalValue), sub: 'on hand' },
              { label: 'Below Par', val: stats.lowStock, sub: 'need attention', color: stats.lowStock > 0 ? '#E24B4A' : '#3B6D11' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: isMobile ? '12px 10px' : '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: s.color || '#000' }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? '12px' : '20px' }}>
          {tiles.map(t => (
            <div key={t.title} onClick={() => router.push(t.href)}
              style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: isMobile ? '20px 16px' : '36px 28px', cursor: 'pointer', textAlign: isMobile ? 'left' : 'center', transition: 'border-color .15s', display: isMobile ? 'flex' : 'block', alignItems: 'center', gap: '16px' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
              <div style={{ fontSize: isMobile ? '32px' : '40px', marginBottom: isMobile ? '0' : '14px', flexShrink: 0 }}>{t.icon}</div>
              <div>
                <div style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '600', color: '#000', marginBottom: '4px' }}>{t.title}</div>
                <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px' }}>{t.desc}</div>
                <div style={{ fontSize: '12px', color: t.subColor || '#aaa', fontWeight: t.subColor ? '500' : '400' }}>{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
