'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function FOHInventory() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalItems: 0, totalValue: 0, lowStock: 0 })
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
      setProfile(prof)
      const { data: items } = await supabase.from('inventory_items').select('*').eq('user_id', session.user.id).eq('area', 'foh')
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

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/foh')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← FOH</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1000px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>FOH Inventory</h1>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Manage your bar inventory, counts, and receiving.</p>
        </div>

        {/* Stats */}
        {stats.totalItems > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Items', val: stats.totalItems, sub: 'in database' },
              { label: 'Inventory Value', val: fmt(stats.totalValue), sub: 'on hand' },
              { label: 'Below Par', val: stats.lowStock, sub: 'need attention', color: stats.lowStock > 0 ? '#E24B4A' : '#3B6D11' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: s.color || '#000' }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Main tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* Database */}
          <div onClick={() => router.push('/foh/inventory/database')}
            style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '36px 28px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>🗄️</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>Database</div>
            <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>Every item you own. On hand, value, par.</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>{stats.totalItems} items · {fmt(stats.totalValue)} value</div>
          </div>

          {/* Count */}
          <div onClick={() => router.push('/foh/inventory/count')}
            style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '36px 28px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#F5B800'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e8'}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>📋</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>Count</div>
            <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>Start a new count or review history.</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>
              {stats.lowStock > 0
                ? <span style={{ color: '#E24B4A', fontWeight: '500' }}>{stats.lowStock} items below par</span>
                : 'All items at or above par'}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}