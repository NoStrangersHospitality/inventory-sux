'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'

export default function TicketDetail() {
  const [ticket, setTicket] = useState(null)
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const params = useParams()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const STATUS_COLORS = {
    open: { bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB', label: 'Open' },
    in_progress: { bg: '#FAEEDA', color: '#854F0B', border: '#f0c080', label: 'In Progress' },
    resolved: { bg: '#EAF3DE', color: '#27500A', border: '#97C459', label: 'Resolved' },
    closed: { bg: '#f5f5f3', color: '#aaa', border: '#e8e8e8', label: 'Closed' },
  }

  const CATEGORIES = {
    question: 'Question',
    bug: 'Bug Report',
    feature_request: 'Feature Request',
    billing: 'Billing',
    other: 'Other',
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      await loadTicket(session.user.id)
      setLoading(false)
    }
    init()
  }, [params.id])

  const loadTicket = async (userId) => {
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('support_tickets').select('*').eq('id', params.id).eq('user_id', userId).single(),
      supabase.from('ticket_replies').select('*').eq('ticket_id', params.id).order('created_at', { ascending: true })
    ])
    if (!t) { router.push('/support'); return }
    setTicket(t)
    setReplies(r || [])
  }

  const submitReply = async () => {
    if (!reply.trim()) return
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('ticket_replies').insert({
      ticket_id: params.id,
      user_id: session.user.id,
      sender: 'user',
      message: reply.trim()
    })
    // Reopen ticket if it was resolved
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await supabase.from('support_tickets').update({ status: 'open' }).eq('id', params.id)
    }
    setReply('')
    await loadTicket(session.user.id)
    setSubmitting(false)
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  if (!ticket) return null

  const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.open

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/support')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Support</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '800px', margin: '0 auto' }}>

        {/* Ticket header */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '500', color: '#000', flex: 1, marginRight: '16px' }}>{ticket.subject}</h1>
            <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '10px', fontSize: '11px', padding: '3px 10px', fontWeight: '500', whiteSpace: 'nowrap' }}>
              {sc.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#aaa', marginBottom: '14px' }}>
            <span>{CATEGORIES[ticket.category] || ticket.category}</span>
            <span>Opened {new Date(ticket.created_at).toLocaleDateString()}</span>
            <span>Ticket #{ticket.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {ticket.description}
          </div>
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {replies.map(r => (
              <div key={r.id} style={{
                background: r.sender === 'admin' ? '#fff' : '#fffbe6',
                border: `1px solid ${r.sender === 'admin' ? '#e8e8e8' : '#f0d060'}`,
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: r.sender === 'admin' ? '#185FA5' : '#854F0B' }}>
                    {r.sender === 'admin' ? '🛠 Inventory Sux Support' : '👤 You'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>{new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{r.message}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reply form */}
        {ticket.status !== 'closed' && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px 24px' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '10px' }}>Reply</div>
            <textarea
              style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', lineHeight: '1.5', marginBottom: '12px' }}
              placeholder="Add a reply or additional information..."
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={submitReply} disabled={submitting || !reply.trim()}
                style={{ background: submitting || !reply.trim() ? '#ccc' : '#333', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: submitting || !reply.trim() ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        )}

        {ticket.status === 'closed' && (
          <div style={{ background: '#f5f5f3', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '14px 18px', textAlign: 'center', fontSize: '13px', color: '#aaa' }}>
            This ticket is closed. Open a new ticket if you need further help.
          </div>
        )}
      </div>
    </div>
  )
}