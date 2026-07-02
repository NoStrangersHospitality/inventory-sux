'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Notifications() {
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unread') // 'unread' | 'all' | 'archived'
  const [expanded, setExpanded] = useState(null)
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

  const loadReplies = async (userId) => {
    const { data } = await supabase
      .from('order_replies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setReplies(data || [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      await loadReplies(session.user.id)
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markRead = async (id) => {
    await supabase.from('order_replies').update({ read: true }).eq('id', id)
    setReplies(prev => prev.map(r => r.id === id ? { ...r, read: true } : r))
  }

  const markUnread = async (id) => {
    await supabase.from('order_replies').update({ read: false }).eq('id', id)
    setReplies(prev => prev.map(r => r.id === id ? { ...r, read: false } : r))
  }

  const archive = async (id) => {
    await supabase.from('order_replies').update({ archived: true, read: true }).eq('id', id)
    setReplies(prev => prev.map(r => r.id === id ? { ...r, archived: true, read: true } : r))
    if (expanded === id) setExpanded(null)
  }

  const unarchive = async (id) => {
    await supabase.from('order_replies').update({ archived: false }).eq('id', id)
    setReplies(prev => prev.map(r => r.id === id ? { ...r, archived: false } : r))
  }

  const markAllRead = async () => {
    const ids = visible.filter(r => !r.read).map(r => r.id)
    if (!ids.length) return
    await supabase.from('order_replies').update({ read: true }).in('id', ids)
    setReplies(prev => prev.map(r => ids.includes(r.id) ? { ...r, read: true } : r))
  }

  const toggleExpand = (id, reply) => {
    if (expanded === id) {
      setExpanded(null)
    } else {
      setExpanded(id)
      if (!reply.read) markRead(id)
    }
  }

  const formatDate = (ts) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const visible = replies.filter(r => {
    if (filter === 'archived') return r.archived
    if (filter === 'unread') return !r.archived && !r.read
    return !r.archived // 'all' — exclude archived
  })

  const unreadCount = replies.filter(r => !r.read && !r.archived).length
  const archivedCount = replies.filter(r => r.archived).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← Dashboard
        </button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '500', color: '#000', marginBottom: '4px' }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{ marginLeft: '10px', background: '#E24B4A', color: '#fff', borderRadius: '20px', fontSize: '11px', fontWeight: '700', padding: '2px 8px', verticalAlign: 'middle' }}>
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p style={{ color: '#999', fontSize: '13px' }}>Replies from your distributor reps</p>
          </div>
          {visible.some(r => !r.read) && filter !== 'archived' && (
            <button onClick={markAllRead} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            { key: 'all', label: 'All' },
            { key: 'archived', label: `Archived${archivedCount > 0 ? ` (${archivedCount})` : ''}` },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setFilter(tab.key); setExpanded(null) }}
              style={{ padding: '7px 14px', border: '1px solid', borderColor: filter === tab.key ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: filter === tab.key ? '700' : '400', cursor: 'pointer', background: filter === tab.key ? '#F5B800' : '#fff', color: filter === tab.key ? '#000' : '#666', transition: 'all .15s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reply list */}
        {visible.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>
              {filter === 'archived' ? '📁' : filter === 'unread' ? '✅' : '📭'}
            </div>
            <div style={{ fontSize: '14px', color: '#aaa' }}>
              {filter === 'archived' ? 'No archived notifications.' : filter === 'unread' ? 'You\'re all caught up.' : 'No notifications yet.'}
            </div>
            {filter === 'unread' && replies.filter(r => !r.archived).length > 0 && (
              <button onClick={() => setFilter('all')} style={{ marginTop: '12px', background: 'none', border: 'none', color: '#F5B800', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
                View all messages →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visible.map(reply => {
              const isOpen = expanded === reply.id
              return (
                <div key={reply.id}
                  style={{ background: '#fff', border: `1px solid ${!reply.read ? '#F5B800' : '#e8e8e8'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color .15s' }}>

                  {/* Row header — always visible, click to expand */}
                  <div onClick={() => toggleExpand(reply.id, reply)}
                    style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', background: !reply.read ? '#fffdf0' : '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = !reply.read ? '#fffdf0' : '#fff'}>

                    {/* Unread dot */}
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: !reply.read ? '#F5B800' : 'transparent', border: `1px solid ${!reply.read ? '#F5B800' : '#e8e8e8'}`, flexShrink: 0 }} />

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <div style={{ fontSize: '13px', fontWeight: reply.read ? '400' : '600', color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {reply.distributor_name || 'Distributor'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', color: '#aaa' }}>{formatDate(reply.created_at)}</span>
                          <span style={{ fontSize: '10px', background: reply.channel === 'email' ? '#e8f4fd' : '#e8fde8', color: reply.channel === 'email' ? '#185FA5' : '#3B6D11', padding: '1px 6px', borderRadius: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                            {reply.channel || 'sms'}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#777', whiteSpace: isOpen ? 'normal' : 'nowrap', overflow: isOpen ? 'visible' : 'hidden', textOverflow: isOpen ? 'clip' : 'ellipsis', lineHeight: 1.5 }}>
                        {reply.message}
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <div style={{ fontSize: '12px', color: '#ccc', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</div>
                  </div>

                  {/* Expanded body with actions */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f0f0f0' }}>
                      {/* Full message */}
                      <div style={{ padding: '14px 16px', background: '#fafafa' }}>
                        <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Message</div>
                        <div style={{ fontSize: '13px', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{reply.message}</div>
                      </div>

                      {/* Meta */}
                      <div style={{ padding: '10px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {reply.from_number && (
                          <div style={{ fontSize: '11px', color: '#aaa' }}>
                            From: <span style={{ color: '#555' }}>{reply.from_number}</span>
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#aaa' }}>
                          {new Date(reply.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {reply.read ? (
                          <button onClick={(e) => { e.stopPropagation(); markUnread(reply.id) }}
                            style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                            Mark unread
                          </button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); markRead(reply.id) }}
                            style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                            Mark read
                          </button>
                        )}
                        {reply.order_id && (
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/foh/ordering`) }}
                            style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                            View order →
                          </button>
                        )}
                        {reply.archived ? (
                          <button onClick={(e) => { e.stopPropagation(); unarchive(reply.id) }}
                            style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginLeft: 'auto' }}>
                            Unarchive
                          </button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); archive(reply.id) }}
                            style={{ background: '#fff', color: '#888', border: '1px solid #e8e8e8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginLeft: 'auto' }}>
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}