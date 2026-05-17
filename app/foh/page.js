'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function FOH() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(data)
      setLoading(false)
    }
    getProfile()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const modules = [
    { title: 'Ordering', desc: 'Items, distributors, and purchase orders', icon: '🛒', href: '/foh/ordering', active: true },
    { title: 'Pour Cost', desc: 'Bottle cost, price targets, and COG %', icon: '🧮', href: '/foh/pour-cost', active: true },
    { title: 'COGS', desc: 'Recipe costing and margin analysis', icon: '🧾', href: '/foh/cogs', active: true },
    { title: 'Inventory', desc: 'Count, track, and manage par levels', icon: '📦', href: null, active: false },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span>
          <span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ← Home
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}
            style={{ background: 'none', border: '1px solid #e8e8e8', color: '#aaa', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
            Log Out
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#000' }}>Front of House</h1>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>Your full bar program in one place.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {modules.map((mod) => (
            <div
              key={mod.title}
              onClick={() => mod.active && mod.href && router.push(mod.href)}
              style={{
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: '16px',
                padding: '36px 28px',
                textAlign: 'center',
                cursor: mod.active ? 'pointer' : 'default',
                opacity: mod.active ? 1 : 0.5,
                transition: 'border-color 0.15s, box-shadow 0.15s'
              }}
              onMouseEnter={e => { if (mod.active) { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,0.12)' }}}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>{mod.icon}</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>{mod.title}</div>
              <div style={{ fontSize: '13px', color: '#aaa' }}>{mod.desc}</div>
              {!mod.active && (
                <div style={{ display: 'inline-block', marginTop: '10px', background: '#f5f5f3', border: '1px solid #e0e0e0', color: '#bbb', fontSize: '10px', padding: '2px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Coming soon
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}