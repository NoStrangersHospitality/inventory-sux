'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      setUser(session.user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(profile)
      setLoading(false)
      
    }
    getUser()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
        <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
          <span style={{ color: '#000' }}>Inventory</span>
          <span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>{profile?.first_name} {profile?.last_name}</div>
    <div style={{ fontSize: '11px', color: '#999' }}>{profile?.bar_name}</div>
  </div>
  <div style={{ position: 'relative' }}>
    <button
      onClick={() => setMenuOpen(o => !o)}
      style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
      Account ▾
    </button>
    {menuOpen && (
      <div style={{ position: 'absolute', right: 0, top: '36px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '180px', zIndex: 100, overflow: 'hidden' }}>
        <div onClick={() => { setMenuOpen(false); router.push('/account') }}
          style={{ padding: '11px 16px', fontSize: '13px', color: '#000', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          👤 Account Settings
        </div>
        <div onClick={() => { setMenuOpen(false); router.push('/support') }}
          style={{ padding: '11px 16px', fontSize: '13px', color: '#000', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          🎫 Support
        </div>
        <div onClick={() => { setMenuOpen(false); router.push('/help') }}
          style={{ padding: '11px 16px', fontSize: '13px', color: '#000', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          📖 Help Center
        </div>
        {profile?.is_admin && (
          <div onClick={() => { setMenuOpen(false); router.push('/admin') }}
            style={{ padding: '11px 16px', fontSize: '13px', color: '#000', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            ⚙️ Admin
          </div>
        )}
        <div onClick={async () => { setMenuOpen(false); await supabase.auth.signOut(); router.push('/auth/login') }}
          style={{ padding: '11px 16px', fontSize: '13px', color: '#E24B4A', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          Log Out
        </div>
      </div>
    )}
  </div>
</div>
      </div>

      {/* Body */}
      <div style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#000' }}>Good to see you, {profile?.first_name}.</h1>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>What are we working on today?</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* FOH */}
          <div onClick={() => router.push('/foh')}
            style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '36px 28px', cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>🍸</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>Front of House</div>
            <div style={{ fontSize: '13px', color: '#aaa' }}>Ordering, Pour Cost, COGS, and Inventory</div>
          </div>

          {/* BOH */}
          <div onClick={() => profile?.boh_access && router.push('/boh')}
            style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '36px 28px', cursor: profile?.boh_access ? 'pointer' : 'default', textAlign: 'center', opacity: profile?.boh_access ? 1 : 0.5, transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { if (profile?.boh_access) { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,0.12)' }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>🍳</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>Back of House</div>
            <div style={{ fontSize: '13px', color: '#aaa' }}>Food ordering, food cost, and kitchen COGS</div>
            {!profile?.boh_access && (
              <div style={{ display: 'inline-block', marginTop: '10px', background: '#F5B800', color: '#000', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px' }}>
                Add for $10/mo →
              </div>
            )}
          </div>

        </div>
      </div>
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      )}
    </div>
  )
}