'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AdminTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [activeTicket, setActiveTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = {
    question: 'Question',
    bug: 'Bug Report',
    feature_request: 'Feature Request',
    billing: 'Billing',
    other: 'Other',
  }

  const STATUS_COLORS = {
    open: { bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB', label: 'Open' },
    in_progress: { bg: '#FAEEDA', color: '#854F0B', border: '#f0c080', label: 'In Progress' },
    resolved: { bg: '#EAF3DE', color: '#27500A', border: '#97C459', label: 'Resolved' },
    closed: { bg: '#f5f5f3', color: '#aaa', border: '#e8e8e8', label: 'Closed' },
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.is_admin) { router.push('/dashboard'); return }
      await loadTickets()
      setLoading(false)
    }
    init()
  }, [])

  const loadTickets = async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*, profiles(first_name, last_name, bar_name)')
      .order('created_at', { ascending: false })
    setTickets(data || [])
  }

  const openTicket = async (ticket) => {
    setActiveTicket(ticket)
    const { data } = await supabase
      .from('ticket_replies')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
    setReplies(data || [])
    setReply('')
  }

  const submitReply = async () => {
    if (!reply.trim() || !activeTicket) return
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('ticket_replies').insert({
      ticket_id: activeTicket.id,
      user_id: session.user.id,
      sender: 'admin',
      message: reply.trim()
    })
    // Auto move to in_progress if still open
    if (activeTicket.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', activeTicket.id)
      setActiveTicket(prev => ({ ...prev, status: 'in_progress' }))
    }
    setReply('')
    const { data } = await supabase
      .from('ticket_replies')
      .select('*')
      .eq('ticket_id', activeTicket.id)
      .order('created_at', { ascending: true })
    setReplies(data || [])
    await loadTickets()
    setSubmitting(false)
  }

  const updateStatus = async (status) => {
    if (!activeTicket) return
    setSaving(true)
    await supabase.from('support_tickets').update({ status }).eq('id', activeTicket.id)
    setActiveTicket(prev => ({ ...prev, status }))
    await loadTickets()
    setSaving(false)
  }

  const filtered = tickets.filter(t => {
    const matchFilter = activeFilter === 'all' || t.status === activeFilter
    const q = search.toLowerCase()
    const name = ((t.profiles?.first_name || '') + ' ' + (t.profiles?.last_name || '')).toLowerCase()
    const bar = (t.profiles?.bar_name || '').toLowerCase()
    const subject = (t.subject || '').toLowerCase()
    const matchSearch = !q || name.includes(q) || bar.includes(q) || subject.includes(q)
    return matchFilter && matchSearch
  })

  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#111', borderBottom: '2px solid #F5B800', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '20px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', color: '#fff' }}>
            Inventory<span style={{ color: '#F5B800' }}>Sux</span>
          </div>
          <div style={{ background: 'rgba(245,184,0,.15)', border: '1px solid rgba(245,184,0,.3)', color: '#F5B800', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px' }}>Admin · Tickets</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: '1px solid rgba(255,255,255,.2)', color: '#aaa', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Subscribers</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: '1px solid rgba(255,255,255,.2)', color: '#aaa', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← App</button>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: activeTicket ? '1fr 1fr' : '1fr', gap: '20px' }}>

        {/* Left — ticket list */}
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Open', val: counts.open, color: '#0C447C' },
              { label: 'In Progress', val: counts.in_progress, color: '#854F0B' },
              { label: 'Resolved', val: counts.resolved, color: '#27500A' },
              { label: 'Total', val: counts.all, color: '#000' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Filters + Search */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px', position: 'relative' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..."
                style={{ ...inputStyle, paddingLeft: '12px' }} />
            </div>
            {['open', 'in_progress', 'resolved', 'closed', 'all'].map(f => (
              <button key={f} onClick={() => setActiveFilter(f)}
                style={{ padding: '7px 12px', border: '1px solid', borderColor: activeFilter === f ? '#F5B800' : '#e8e8e8', borderRadius: '8px', fontSize: '11px', fontWeight: activeFilter === f ? '700' : '400', cursor: 'pointer', background: activeFilter === f ? '#F5B800' : '#fff', color: activeFilter === f ? '#000' : '#666', whiteSpace: 'nowrap' }}>
                {f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)} {counts[f] > 0 ? `(${counts[f]})` : ''}
              </button>
            ))}
          </div>

          {/* Ticket list */}
          {filtered.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
              No tickets found.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
              {filtered.map((ticket, idx) => {
                const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.open
                const isActive = activeTicket?.id === ticket.id
                return (
                  <div key={ticket.id} onClick={() => openTicket(ticket)}
                    style={{ padding: '14px 18px', borderBottom: idx < filtered.length - 1 ? '1px solid #f5f5f5' : 'none', cursor: 'pointer', background: isActive ? '#fffdf0' : 'transparent', borderLeft: isActive ? '3px solid #F5B800' : '3px solid transparent' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#fafafa' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ fontWeight: '500', color: '#000', fontSize: '13px', flex: 1, marginRight: '8px' }}>{ticket.subject}</div>
                      <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '10px', fontSize: '10px', padding: '2px 7px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#aaa' }}>
                      <span>{ticket.profiles?.first_name} {ticket.profiles?.last_name}</span>
                      {ticket.profiles?.bar_name && <span>· {ticket.profiles.bar_name}</span>}
                      <span>· {CATEGORIES[ticket.category] || ticket.category}</span>
                      <span>· {new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right — ticket detail */}
        {activeTicket && (
          <div>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>

              {/* Ticket header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: '500', color: '#000', flex: 1, marginRight: '12px' }}>{activeTicket.subject}</h2>
                  <button onClick={() => { setActiveTicket(null); setReplies([]) }}
                    style={{ background: '#333', border: 'none', color: '#fff', width: '26px', height: '26px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#555' }}>
                    {activeTicket.profiles?.first_name} {activeTicket.profiles?.last_name}
                    {activeTicket.profiles?.bar_name && ` · ${activeTicket.profiles.bar_name}`}
                  </span>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>#{activeTicket.id.slice(0, 8).toUpperCase()}</span>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>{new Date(activeTicket.created_at).toLocaleDateString()}</span>
                </div>

                {/* Status controls */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: '#aaa', marginRight: '4px', alignSelf: 'center' }}>Status:</span>
                  {['open', 'in_progress', 'resolved', 'closed'].map(s => {
                    const sc = STATUS_COLORS[s]
                    const isActive = activeTicket.status === s
                    return (
                      <button key={s} onClick={() => updateStatus(s)} disabled={saving}
                        style={{ padding: '4px 10px', border: `1px solid ${isActive ? sc.border : '#e8e8e8'}`, borderRadius: '20px', fontSize: '11px', fontWeight: isActive ? '600' : '400', cursor: 'pointer', background: isActive ? sc.bg : '#fff', color: isActive ? sc.color : '#aaa' }}>
                        {sc.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Original message */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {CATEGORIES[activeTicket.category]} · Original Message
                </div>
                <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap', background: '#fafafa', borderRadius: '8px', padding: '12px 14px' }}>
                  {activeTicket.description}
                </div>
              </div>

              {/* Replies */}
              <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '12px 20px' }}>
                {replies.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#ccc', fontSize: '13px', padding: '20px 0' }}>No replies yet.</div>
                ) : replies.map(r => (
                  <div key={r.id} style={{
                    background: r.sender === 'admin' ? '#fffdf0' : '#f5f5f3',
                    border: `1px solid ${r.sender === 'admin' ? '#f0d060' : '#e8e8e8'}`,
                    borderRadius: '10px', padding: '12px 14px', marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: r.sender === 'admin' ? '#854F0B' : '#555' }}>
                        {r.sender === 'admin' ? '🛠 You (Support)' : `👤 ${activeTicket.profiles?.first_name || 'User'}`}
                      </span>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>
                        {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{r.message}</div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              {activeTicket.status !== 'closed' && (
                <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0' }}>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Type your reply..."
                    style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', lineHeight: '1.5', marginBottom: '10px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => updateStatus('resolved')} disabled={saving}
                      style={{ background: '#EAF3DE', color: '#27500A', border: '1px solid #97C459', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                      ✓ Mark Resolved
                    </button>
                    <button onClick={submitReply} disabled={submitting || !reply.trim()}
                      style={{ background: submitting || !reply.trim() ? '#ccc' : '#333', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: submitting || !reply.trim() ? 'not-allowed' : 'pointer' }}>
                      {submitting ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}