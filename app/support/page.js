'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Support() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ subject: '', category: 'question', description: '' })
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    { key: 'question', label: 'Question' },
    { key: 'bug', label: 'Bug Report' },
    { key: 'feature_request', label: 'Feature Request' },
    { key: 'billing', label: 'Billing' },
    { key: 'other', label: 'Other' },
  ]

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
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const submitTicket = async () => {
    if (!form.subject || !form.description) return
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('support_tickets').insert({
      user_id: session.user.id,
      subject: form.subject,
      category: form.category,
      description: form.description,
      status: 'open'
    })
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    setTickets(data || [])
    setForm({ subject: '', category: 'question', description: '' })
    setShowForm(false)
    setSubmitting(false)
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
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Dashboard</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '800px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Support</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Get help with Inventory Sux. We typically respond within one business day.</p>
          </div>
          <button onClick={() => setShowForm(true)}
            style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            + New Ticket
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>Open a Support Ticket</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Subject</label>
                <input style={inputStyle} placeholder="Brief description of your issue" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', lineHeight: '1.5' }}
                  placeholder="Describe your issue in detail. Include any steps to reproduce a bug, what you expected to happen, and what actually happened."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowForm(false); setForm({ subject: '', category: 'question', description: '' }) }}
                style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitTicket} disabled={submitting || !form.subject || !form.description}
                style={{ flex: 2, background: submitting ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        )}

        {/* Help links */}
        <div style={{ background: '#f0f8ff', border: '1px solid #b5d4f4', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#185FA5', marginBottom: '2px' }}>Looking for quick answers?</div>
            <div style={{ fontSize: '12px', color: '#5a9fd4' }}>Check the knowledge base for setup guides and troubleshooting articles.</div>
          </div>
          <button onClick={() => router.push('/help')}
            style={{ background: '#185FA5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: '16px' }}>
            Browse Help Articles
          </button>
        </div>

        {/* Ticket list */}
        {tickets.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No support tickets yet. If you need help, open a ticket above.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Subject', 'Category', 'Status', 'Opened', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {tickets.map(ticket => {
                  const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.open
                  const cat = CATEGORIES.find(c => c.key === ticket.category)
                  return (
                    <tr key={ticket.id} onClick={() => router.push(`/support/${ticket.id}`)}
                      style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 16px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{ticket.subject}</td>
                      <td style={{ padding: '12px 16px', color: '#555', fontSize: '13px' }}>{cat?.label || ticket.category}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px', fontWeight: '500' }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#aaa', fontSize: '12px' }}>
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#aaa', fontSize: '12px' }}>→</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}