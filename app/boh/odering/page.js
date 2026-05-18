'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOHOrdering() {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ items: 0, vendors: 0 })
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
      const [{ count: itemCount }, { count: vendorCount }] = await Promise.all([
        supabase.from('boh_items').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
        supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id)
      ])
      setCounts({ items: itemCount || 0, vendors: vendorCount || 0 })
      setLoading(false)
    }
    init()
  }, [])

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
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
      </div>
    </div>
  )
}