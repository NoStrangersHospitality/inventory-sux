'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOH() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
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
      setProfile(prof)
      setLoading(false)
    }
    init()
  }, [])

  const modules = [
    { title: 'Ordering', desc: 'Ingredients, vendors, and purchase orders', icon: '🛒', href: '/boh/ordering' },
    { title: 'COGS', desc: 'Ingredient costing and recipe margins', icon: '🧾', href: '/boh/cogs' },
    { title: 'Inventory', desc: 'On hand, counts, and receiving', icon: '📦', href: '/boh/inventory' },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Home</button>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#000' }}>Back of House</h1>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>Kitchen ordering, food cost, and recipe costing.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {modules.map(mod => (
            <div key={mod.title}
              onClick={() => !mod.coming && mod.href && router.push(mod.href)}
              style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '36px 28px', cursor: mod.coming ? 'default' : 'pointer', textAlign: 'center', opacity: mod.coming ? 0.5 : 1, transition: 'border-color .15s, box-shadow .15s' }}
              onMouseEnter={e => { if (!mod.coming) { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,.12)' }}}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ fontSize: '40px', marginBottom: '14px' }}>{mod.icon}</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>{mod.title}</div>
              <div style={{ fontSize: '13px', color: '#aaa' }}>{mod.desc}</div>
              {mod.coming && (
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