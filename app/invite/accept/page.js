'use client'

import { useEffect, useState, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'

const ROLE_LABELS = {
  gm: 'General Manager',
  foh_manager: 'FOH Manager',
  boh_manager: 'BOH Manager',
  foh_staff: 'FOH Staff',
  boh_staff: 'BOH Staff',
}

function AcceptInvite() {
  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState(null)
  const [ownerProfile, setOwnerProfile] = useState(null)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', confirmPassword: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

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

  useEffect(() => {
    const init = async () => {
      const token = searchParams.get('token')
      if (!token) { setError('Invalid invite link.'); setLoading(false); return }

      const { data: inviteData } = await supabase
        .from('team_members')
        .select('*')
        .eq('invite_token', token)
        .eq('status', 'pending')
        .single()

      if (!inviteData) { setError('This invite link is invalid or has already been used.'); setLoading(false); return }

      const invitedAt = new Date(inviteData.invited_at)
      const now = new Date()
      const daysDiff = (now - invitedAt) / (1000 * 60 * 60 * 24)
      if (daysDiff > 7) { setError('This invite link has expired. Please ask your manager to send a new invite.'); setLoading(false); return }

      const { data: owner } = await supabase
        .from('profiles')
        .select('first_name, last_name, bar_name')
        .eq('id', inviteData.owner_user_id)
        .single()

      setInvite(inviteData)
      setOwnerProfile(owner)
      setForm(f => ({ ...f, email: inviteData.email }))
      setLoading(false)
    }
    init()
  }, [searchParams])

  const handleAccept = async () => {
    setError('')
    setSubmitting(true)

    const token = searchParams.get('token')

    if (mode === 'signup') {
      if (!form.first_name || !form.last_name) { setError('Please enter your name.'); setSubmitting(false); return }
      if (!form.password || form.password.length < 8) { setError('Password must be at least 8 characters.'); setSubmitting(false); return }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); setSubmitting(false); return }

      // Pass invite metadata into signUp so the DB trigger creates the profile correctly
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
            team_role: invite.role,
            owner_user_id: invite.owner_user_id,
          }
        }
      })

      if (signUpError) { setError(signUpError.message); setSubmitting(false); return }

      const newUserId = signUpData.user?.id
      if (!newUserId) { setError('Failed to create account.'); setSubmitting(false); return }

      // Accept invite
      await supabase.from('team_members').update({
        member_user_id: newUserId,
        status: 'active',
        accepted_at: new Date().toISOString(),
        invite_token: null,
      }).eq('invite_token', token)

    } else {
      // Login flow
      if (!form.email || !form.password) { setError('Please enter your email and password.'); setSubmitting(false); return }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (signInError) { setError('Invalid email or password.'); setSubmitting(false); return }

      const userId = signInData.user?.id

      // Update existing profile with role and owner
      await supabase.from('profiles').update({
        team_role: invite.role,
        owner_user_id: invite.owner_user_id,
      }).eq('id', userId)

      // Accept invite
      await supabase.from('team_members').update({
        member_user_id: userId,
        status: 'active',
        accepted_at: new Date().toISOString(),
        invite_token: null,
      }).eq('invite_token', token)
    }

    setSubmitting(false)
    router.push('/dashboard')
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  if (error && !invite) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '48px 32px', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Invalid Invite</h2>
        <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '24px' }}>{error}</p>
        <button onClick={() => router.push('/auth/login')}
          style={{ background: '#F5B800', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>
          Go to Login
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px' }}>
        <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
      </div>

      <div style={{ padding: isMobile ? '24px 16px' : '40px 24px', maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ background: '#fffbe6', border: '1px solid #f0d060', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#854F0B', marginBottom: '4px' }}>
            You've been invited
          </div>
          <div style={{ fontSize: '13px', color: '#a07800' }}>
            <strong>{ownerProfile?.first_name} {ownerProfile?.last_name}</strong> has invited you to join{' '}
            <strong>{ownerProfile?.bar_name}</strong> as <strong>{ROLE_LABELS[invite?.role]}</strong>.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          <button onClick={() => setMode('login')}
            style={{ background: mode === 'login' ? '#000' : '#fff', color: mode === 'login' ? '#fff' : '#555', border: '1px solid #e8e8e8', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            I have an account
          </button>
          <button onClick={() => setMode('signup')}
            style={{ background: mode === 'signup' ? '#000' : '#fff', color: mode === 'signup' ? '#fff' : '#555', border: '1px solid #e8e8e8', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            Create account
          </button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px' }}>

          {error && (
            <div style={{ background: '#FAEEDA', border: '1px solid #f0c080', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#854F0B' }}>
              ⚠ {error}
            </div>
          )}

          {mode === 'signup' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input style={inputStyle} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input style={inputStyle} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Email</label>
            <input style={{ ...inputStyle, background: '#f0f0f0', color: '#aaa' }} value={form.email} readOnly />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Password</label>
            <input style={inputStyle} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'} />
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Confirm Password</label>
              <input style={inputStyle} type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Confirm password" />
            </div>
          )}

          <button onClick={handleAccept} disabled={submitting}
            style={{ width: '100%', background: submitting ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '4px' }}>
            {submitting ? 'Accepting...' : 'Accept Invitation →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
      </div>
    }>
      <AcceptInvite />
    </Suspense>
  )
}