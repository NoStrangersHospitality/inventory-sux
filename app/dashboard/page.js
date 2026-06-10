'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useRole } from '@/hooks/useRole'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [replies, setReplies] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingOrders, setPendingOrders] = useState([])
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const { role, can, loading: roleLoading } = useRole()

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

  const loadReplies = async (userId) => {
    const { data } = await supabase
      .from('order_replies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setReplies(data || [])
    setUnreadCount((data || []).filter(r => !r.read).length)
  }

  useEffect(() => {
    let realtimeChannel

    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile(prof)
      await loadReplies(session.user.id)

      const { data: pending } = await supabase
        .from('orders')
        .select('*, order_lines(count)')
        .eq('user_id', prof?.owner_user_id || session.user.id)
        .eq('receiving_status', 'pending')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: true })
      setPendingOrders(pending || [])

      const dismissed = sessionStorage.getItem('delivery_banner_dismissed')
      setBannerDismissed(!!dismissed)

      setLoading(false)

      realtimeChannel = supabase
        .channel('order_replies_live')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'order_replies',
          filter: `user_id=eq.${session.user.id}`
        }, (payload) => {
          setReplies(prev => [payload.new, ...prev])
          setUnreadCount(prev => prev + 1)
        })
        .subscribe()
    }

    getUser()
    return () => { if (realtimeChannel) supabase.removeChannel(realtimeChannel) }
  }, [])

  const markAllRead = async () => {
    const unreadIds = replies.filter(r => !r.read).map(r => r.id)
    if (unreadIds.length === 0) return
    await supabase.from('order_replies').update({ read: true }).in('id', unreadIds)
    setReplies(prev => prev.map(r => ({ ...r, read: true })))
    setUnreadCount(0)
  }

  const markRead = async (id) => {
    await supabase.from('order_replies').update({ read: true }).eq('id', id)
    setReplies(prev => prev.map(r => r.id === id ? { ...r, read: true } : r))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const dismissBanner = () => {
    sessionStorage.setItem('delivery_banner_dismissed', 'true')
    setBannerDismissed(true)
  }

  const isOverdue = (order) => {
    const days = (new Date() - new Date(order.submitted_at)) / (1000 * 60 * 60 * 24)
    return days >= 7
  }

  const hasOverdue = pendingOrders.some(o => isOverdue(o))
  const showBanner = pendingOrders.length > 0 && (!bannerDismissed || hasOverdue)

  if (loading || roleLoading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  // Role-based FOH/BOH access
  const canFOH = can('view_foh')
  const canBOH = can('view_boh') && profile?.boh_access
  const isOwner = role === 'owner'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', overflowX: 'hidden' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 12px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
          <span style={{ color: '#000' }}>Inventory</span>
          <span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          {!isMobile && (
            <div style={{ textAlign: 'right', marginRight: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>{profile?.first_name} {profile?.last_name}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>{profile?.bar_name}</div>
            </div>
          )}

          {/* Notification bell */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setNotifOpen(o => !o); setMenuOpen(false); if (!notifOpen) markAllRead() }}
              style={{ background: 'none', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', position: 'relative', fontSize: '16px' }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#E24B4A', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div style={{ position: 'absolute', right: 0, top: '42px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', width: isMobile ? '300px' : '340px', zIndex: 100, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#000' }}>Order Replies</div>
                  {replies.some(r => !r.read) && (
                    <button onClick={markAllRead} style={{ background: 'none', border: 'none', fontSize: '11px', color: '#aaa', cursor: 'pointer' }}>Mark all read</button>
                  )}
                </div>
                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {replies.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#ccc', fontSize: '13px' }}>
                      No replies yet. Distributor replies to your orders will appear here.
                    </div>
                  ) : replies.map(reply => (
                    <div key={reply.id} onClick={() => markRead(reply.id)}
                      style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5', background: reply.read ? 'transparent' : '#fffdf0', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = reply.read ? 'transparent' : '#fffdf0'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>
                          {!reply.read && <span style={{ display: 'inline-block', width: '7px', height: '7px', background: '#F5B800', borderRadius: '50%', marginRight: '6px', verticalAlign: 'middle' }} />}
                          {reply.distributor_name || 'Distributor'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                          {new Date(reply.created_at).toLocaleDateString()} {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.5' }}>{reply.message}</div>
                      <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>via {reply.channel || 'sms'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Account menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => { setMenuOpen(o => !o); setNotifOpen(false) }}
              style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>
              {isMobile ? '☰' : 'Account ▾'}
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '36px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '180px', zIndex: 100, overflow: 'hidden' }}>
                {isMobile && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#000' }}>{profile?.first_name} {profile?.last_name}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{profile?.bar_name}</div>
                  </div>
                )}
                {can('account_settings') && (
                  <div onClick={() => { setMenuOpen(false); router.push('/account') }}
                    style={{ padding: '11px 16px', fontSize: '13px', color: '#000', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    👤 Account Settings
                  </div>
                )}
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
      <div style={{ padding: isMobile ? '20px 16px' : '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '500', color: '#000' }}>
            Good to see you, {profile?.first_name}.
          </h1>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>What are we working on today?</p>
        </div>

        {/* Delivery confirmation banner */}
        {showBanner && (
          <div style={{ background: hasOverdue ? '#fff5f5' : '#fffbe6', border: `1px solid ${hasOverdue ? '#fca5a5' : '#f0d060'}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: hasOverdue ? '#c53030' : '#854F0B', marginBottom: '3px' }}>
                  {hasOverdue ? '⚠️ Overdue — ' : '🚚 '}
                  {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''} pending delivery confirmation
                  {hasOverdue && ' — confirmation required'}
                </div>
                <div style={{ fontSize: '12px', color: hasOverdue ? '#c53030' : '#a07800' }}>
                  {hasOverdue ? 'One or more orders are over 7 days old and must be confirmed.' : 'Confirm what arrived to keep your inventory accurate.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <button onClick={() => {
                  const first = pendingOrders[0]
                  const area = first.area === 'boh' ? '/boh/ordering' : '/foh/ordering'
                  router.push(area)
                }} style={{ background: hasOverdue ? '#E24B4A' : '#F5B800', color: hasOverdue ? '#fff' : '#000', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Review
                </button>
                {!hasOverdue && (
                  <button onClick={dismissBanner} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}>×</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trial banner — owners only */}
        {isOwner && (profile?.subscription_status === 'trial' || !profile?.subscription_status) && !profile?.stripe_customer_id && (
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '3px' }}>🎉 Your 14-day free trial is active</div>
            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '14px' }}>Add a payment method to continue after your trial ends. No charge for 14 days.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession()
                const res = await fetch('/api/stripe/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_FOH, userId: session.user.id, email: session.user.email, plan: 'foh' }) })
                const data = await res.json()
                if (data.url) window.location.href = data.url
              }} style={{ background: '#F5B800', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', flex: isMobile ? '1' : 'none' }}>
                FOH — $29/mo
              </button>
              <button onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession()
                const res = await fetch('/api/stripe/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUNDLE, userId: session.user.id, email: session.user.email, plan: 'bundle' }) })
                const data = await res.json()
                if (data.url) window.location.href = data.url
              }} style={{ background: '#fff', color: '#000', border: '1px solid #444', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', flex: isMobile ? '1' : 'none' }}>
                Bundle — $39/mo
              </button>
            </div>
          </div>
        )}

        {/* Past due banner — owners only */}
        {isOwner && profile?.subscription_status === 'past_due' && (
          <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: '#c53030', marginBottom: '10px' }}>
              ⚠ Your payment failed. Please update your billing information to keep access.
            </div>
            <button onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession()
              const res = await fetch('/api/stripe/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: session.user.id }) })
              const data = await res.json()
              if (data.url) window.location.href = data.url
            }} style={{ background: '#E24B4A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              Update Billing
            </button>
          </div>
        )}

        {/* Cancelled banner — owners only */}
        {isOwner && profile?.subscription_status === 'cancelled' && (
          <div style={{ background: '#f5f5f3', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '10px' }}>Your subscription has been cancelled. Reactivate to restore full access.</div>
            <button onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession()
              const res = await fetch('/api/stripe/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_FOH, userId: session.user.id, email: session.user.email, plan: 'foh' }) })
              const data = await res.json()
              if (data.url) window.location.href = data.url
            }} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              Reactivate
            </button>
          </div>
        )}

        {/* FOH / BOH tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : canFOH && canBOH ? '1fr 1fr' : '1fr', gap: '16px' }}>

          {canFOH && (
            <div onClick={() => router.push('/foh')}
              style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: isMobile ? '24px 20px' : '36px 28px', cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ fontSize: isMobile ? '32px' : '40px', marginBottom: '10px' }}>🍸</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>Front of House</div>
              <div style={{ fontSize: '13px', color: '#aaa' }}>Ordering, Pour Cost, COGS, and Inventory</div>
            </div>
          )}

          {isOwner && !profile?.boh_access && (
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: isMobile ? '24px 20px' : '36px 28px', cursor: 'default', textAlign: 'center', opacity: 0.5 }}>
              <div style={{ fontSize: isMobile ? '32px' : '40px', marginBottom: '10px' }}>🍳</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>Back of House</div>
              <div style={{ fontSize: '13px', color: '#aaa' }}>Food ordering, food cost, and kitchen COGS</div>
              <div style={{ display: 'inline-block', marginTop: '10px', background: '#F5B800', color: '#000', fontSize: '12px', fontWeight: '700', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer' }}
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession()
                  const res = await fetch('/api/stripe/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BOH_ADDON, userId: session.user.id, email: session.user.email, plan: 'boh_addon' }) })
                  const data = await res.json()
                  if (data.url) window.location.href = data.url
                }}>
                Add for $10/mo →
              </div>
            </div>
          )}

          {canBOH && (
            <div onClick={() => router.push('/boh')}
              style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: isMobile ? '24px 20px' : '36px 28px', cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ fontSize: isMobile ? '32px' : '40px', marginBottom: '10px' }}>🍳</div>
              <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', color: '#000', marginBottom: '6px' }}>Back of House</div>
              <div style={{ fontSize: '13px', color: '#aaa' }}>Food ordering, food cost, and kitchen COGS</div>
            </div>
          )}

        </div>
      </div>

      {(menuOpen || notifOpen) && (
        <div onClick={() => { setMenuOpen(false); setNotifOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      )}
    </div>
  )
}