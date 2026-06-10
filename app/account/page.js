'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useRole } from '@/hooks/useRole'

const ROLE_LABELS = {
  gm: 'General Manager',
  foh_manager: 'FOH Manager',
  boh_manager: 'BOH Manager',
  foh_staff: 'FOH Staff',
  boh_staff: 'BOH Staff',
}

const SEAT_LIMITS = {
  gm: 1,
  foh_manager: 1,
  boh_manager: 1,
  foh_staff: 2,
  boh_staff: 2,
}

export default function Account() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [form, setForm] = useState({ first_name: '', last_name: '', bar_name: '', city: '', state: '' })
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })

  // Team state
  const [teamMembers, setTeamMembers] = useState([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'foh_staff' })
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  const router = useRouter()
  const { can } = useRole()

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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setProfile({ ...prof, email: session.user.email })
      setForm({ first_name: prof?.first_name || '', last_name: prof?.last_name || '', bar_name: prof?.bar_name || '', city: prof?.city || '', state: prof?.state || '' })
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (activeTab === 'team' && profile) loadTeam()
  }, [activeTab, profile])

  const loadTeam = async () => {
    setTeamLoading(true)
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('owner_user_id', profile.id)
      .order('created_at', { ascending: true })
    setTeamMembers(data || [])
    setTeamLoading(false)
  }

  const saveProfile = async () => {
    if (!form.first_name || !form.last_name) return
    setSaving(true)
    setSuccessMsg('')
    setErrorMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('profiles').update({
      first_name: form.first_name, last_name: form.last_name,
      bar_name: form.bar_name, city: form.city, state: form.state,
    }).eq('id', session.user.id)
    setSaving(false)
    if (error) {
      setErrorMsg('Failed to save. Please try again.')
    } else {
      setSuccessMsg('Profile updated successfully.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const changePassword = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) return
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setErrorMsg('Passwords do not match.'); return }
    if (passwordForm.newPassword.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return }
    setChangingPassword(true)
    setErrorMsg('')
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
    setChangingPassword(false)
    if (error) {
      setErrorMsg('Failed to update password. Please try again.')
    } else {
      setSuccessMsg('Password updated successfully.')
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setShowPasswordForm(false)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const sendInvite = async () => {
    if (!inviteForm.email) { setErrorMsg('Please enter an email address.'); return }
    setInviting(true)
    setErrorMsg('')
    setSuccessMsg('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/invite/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteForm.email,
        role: inviteForm.role,
        inviterUserId: session.user.id,
      })
    })
    const data = await res.json()
    setInviting(false)

    if (!res.ok) {
      setErrorMsg(data.error || 'Failed to send invite.')
    } else {
      setSuccessMsg(`Invite sent to ${inviteForm.email}.`)
      setInviteForm({ email: '', role: 'foh_staff' })
      loadTeam()
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }

  const removeMember = async (memberId) => {
    if (!confirm('Remove this team member? They will lose access immediately.')) return
    setRemovingId(memberId)
    await supabase.from('team_members').update({
      status: 'deactivated',
      member_user_id: null,
    }).eq('id', memberId)

    // Clear their profile role
    const member = teamMembers.find(m => m.id === memberId)
    if (member?.member_user_id) {
      await supabase.from('profiles').update({
        team_role: null,
        owner_user_id: null,
      }).eq('id', member.member_user_id)
    }

    setRemovingId(null)
    loadTeam()
  }

  const resendInvite = async (memberId, email, role) => {
    setInviting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/invite/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, inviterUserId: session.user.id })
    })
    setInviting(false)
    if (res.ok) {
      setSuccessMsg(`Invite resent to ${email}.`)
      loadTeam()
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const getSeatUsage = (role) => {
    const active = teamMembers.filter(m => m.role === role && m.status !== 'deactivated').length
    return `${active}/${SEAT_LIMITS[role]}`
  }

  const statusBadge = (status) => {
    switch (status) {
      case 'active': return { bg: '#EAF3DE', color: '#27500A', border: '#97C459', label: 'Active' }
      case 'pending': return { bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB', label: 'Pending' }
      case 'deactivated': return { bg: '#f5f5f3', color: '#aaa', border: '#e8e8e8', label: 'Deactivated' }
      default: return { bg: '#f5f5f3', color: '#aaa', border: '#e8e8e8', label: status }
    }
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '16px', color: '#000', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const subStatusColor = {
    active: { bg: '#EAF3DE', color: '#27500A', border: '#97C459' },
    trial: { bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB' },
    comp: { bg: '#FAEEDA', color: '#854F0B', border: '#f0c080' },
  }[profile?.subscription_status] || { bg: '#f5f5f3', color: '#aaa', border: '#e8e8e8' }

  const tabs = [
    { key: 'profile', label: 'Profile' },
    ...(can('invite_team') ? [{ key: 'team', label: 'Team' }] : []),
    ...(can('billing') ? [{ key: 'billing', label: 'Billing' }] : []),
  ]

  const availableRoles = profile?.boh_access
    ? ['gm', 'foh_manager', 'boh_manager', 'foh_staff', 'boh_staff']
    : ['gm', 'foh_manager', 'foh_staff']

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Dashboard</button>
      </div>

      <div style={{ padding: isMobile ? '20px 16px' : '28px 24px', maxWidth: '640px', margin: '0 auto' }}>

        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '500', color: '#000' }}>Account Settings</h1>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Manage your profile, team, and billing.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setSuccessMsg(''); setErrorMsg('') }}
              style={{ flex: 1, background: activeTab === t.key ? '#000' : 'transparent', color: activeTab === t.key ? '#fff' : '#555', border: 'none', padding: '8px', borderRadius: '7px', fontSize: '13px', fontWeight: activeTab === t.key ? '600' : '400', cursor: 'pointer', transition: 'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {successMsg && (
          <div style={{ background: '#EAF3DE', border: '1px solid #97C459', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#27500A' }}>
            ✓ {successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ background: '#FAEEDA', border: '1px solid #f0c080', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#854F0B' }}>
            ⚠ {errorMsg}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '16px' }}>Profile</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input style={inputStyle} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input style={inputStyle} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Bar / Restaurant Name</label>
                  <input style={inputStyle} value={form.bar_name} onChange={e => setForm(f => ({ ...f, bar_name: e.target.value }))} placeholder="Your bar or restaurant" />
                </div>
                <div>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input style={inputStyle} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="IN" maxLength="2" />
                </div>
              </div>
              <button onClick={saveProfile} disabled={saving}
                style={{ background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer', width: isMobile ? '100%' : 'auto' }}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '12px' }}>Email Address</div>
              <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#555', marginBottom: '6px' }}>
                {profile?.email}
              </div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>To change your email address contact support.</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPasswordForm ? '16px' : '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Password</div>
                <button onClick={() => { setShowPasswordForm(s => !s); setErrorMsg('') }}
                  style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  {showPasswordForm ? 'Cancel' : 'Change Password'}
                </button>
              </div>
              {showPasswordForm && (
                <div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>New Password</label>
                    <input style={inputStyle} type="password" placeholder="Min 8 characters" value={passwordForm.newPassword} onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input style={inputStyle} type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                  </div>
                  <button onClick={changePassword} disabled={changingPassword}
                    style={{ background: changingPassword ? '#ccc' : '#333', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: changingPassword ? 'not-allowed' : 'pointer', width: isMobile ? '100%' : 'auto' }}>
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#E24B4A', marginBottom: '8px' }}>Danger Zone</div>
              <div style={{ fontSize: '13px', color: '#555', marginBottom: '14px' }}>
                Cancelling your account will revoke access at the end of your current billing period. Your data will be retained for 30 days.
              </div>
              <button
                style={{ background: 'none', border: '1px solid #E24B4A', color: '#E24B4A', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}
                onClick={() => alert('To cancel your account please open a support ticket and we will process it within one business day.')}>
                Cancel Account
              </button>
            </div>
          </>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && (
          <>
            {/* Seat summary */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>Seat Usage</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                {availableRoles.map(role => (
                  <div key={role} style={{ background: '#f9f9f7', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{ROLE_LABELS[role]}</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#000' }}>{getSeatUsage(role)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite form */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>Invite Team Member</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ gridColumn: isMobile ? '1' : '1/-1' }}>
                  <label style={labelStyle}>Email Address</label>
                  <input style={inputStyle} type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="teammate@email.com" />
                </div>
                <div style={{ gridColumn: isMobile ? '1' : '1/-1' }}>
                  <label style={labelStyle}>Role</label>
                  <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    {availableRoles.map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={sendInvite} disabled={inviting}
                style={{ background: inviting ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: inviting ? 'not-allowed' : 'pointer', width: isMobile ? '100%' : 'auto' }}>
                {inviting ? 'Sending...' : '✉️ Send Invite'}
              </button>
            </div>

            {/* Team member list */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#000' }}>Team Members</div>
              </div>
              {teamLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Loading...</div>
              ) : teamMembers.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#ccc', fontSize: '13px' }}>
                  No team members yet. Send your first invite above.
                </div>
              ) : (
                teamMembers.map(member => {
                  const badge = statusBadge(member.status)
                  return (
                    <div key={member.id} style={{ padding: isMobile ? '14px 16px' : '14px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', opacity: member.status === 'deactivated' ? 0.5 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.email}
                        </div>
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{ROLE_LABELS[member.role]}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px', fontWeight: '500' }}>
                          {badge.label}
                        </span>
                        {member.status === 'pending' && (
                          <button onClick={() => resendInvite(member.id, member.email, member.role)}
                            style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                            Resend
                          </button>
                        )}
                        {member.status !== 'deactivated' && (
                          <button onClick={() => removeMember(member.id)} disabled={removingId === member.id}
                            style={{ background: 'none', border: '1px solid #fca5a5', color: '#E24B4A', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                            {removingId === member.id ? '...' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* BILLING TAB */}
        {activeTab === 'billing' && (
          <>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '12px' }}>Subscription</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#000', fontWeight: '500' }}>
                    {profile?.subscription_tier === 'both' ? 'FOH + BOH Bundle' : 'Front of House'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                    {profile?.subscription_status === 'trial' ? '14-day free trial' :
                     profile?.subscription_status === 'active' ? 'Active subscription' :
                     profile?.subscription_status === 'comp' ? 'Complimentary access' :
                     profile?.subscription_status === 'cancelled' ? 'Cancelled' : '--'}
                  </div>
                </div>
                <span style={{ background: subStatusColor.bg, color: subStatusColor.color, border: `1px solid ${subStatusColor.border}`, borderRadius: '10px', fontSize: '11px', padding: '3px 10px', fontWeight: '500', flexShrink: 0, marginLeft: '12px' }}>
                  {profile?.subscription_status?.charAt(0).toUpperCase() + profile?.subscription_status?.slice(1) || 'Trial'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', flex: isMobile ? '1' : 'none' }}
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession()
                    const res = await fetch('/api/stripe/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: session.user.id }) })
                    const data = await res.json()
                    if (data.url) window.location.href = data.url
                    else alert('No billing account found. Please contact support.')
                  }}>
                  Manage Billing
                </button>
                {!profile?.boh_access && (
                  <button
                    style={{ background: '#F5B800', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', flex: isMobile ? '1' : 'none' }}
                    onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession()
                      const res = await fetch('/api/stripe/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BOH_ADDON, userId: session.user.id, email: session.user.email, plan: 'boh_addon' }) })
                      const data = await res.json()
                      if (data.url) window.location.href = data.url
                      else alert('Error starting checkout. Please try again.')
                    }}>
                    Add BOH — $10/mo
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#E24B4A', marginBottom: '8px' }}>Danger Zone</div>
              <div style={{ fontSize: '13px', color: '#555', marginBottom: '14px' }}>
                Cancelling your account will revoke access at the end of your current billing period. Your data will be retained for 30 days.
              </div>
              <button
                style={{ background: 'none', border: '1px solid #E24B4A', color: '#E24B4A', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}
                onClick={() => alert('To cancel your account please open a support ticket and we will process it within one business day.')}>
                Cancel Account
              </button>
            </div>
          </>
        )}

        {/* Legal */}
        <div style={{ paddingTop: '8px', paddingBottom: '32px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <a href="/privacy" style={{ fontSize: '12px', color: '#aaa', textDecoration: 'none' }}>Privacy Policy</a>
          <span style={{ fontSize: '12px', color: '#e8e8e8' }}>|</span>
          <a href="/terms" style={{ fontSize: '12px', color: '#aaa', textDecoration: 'none' }}>Terms of Service</a>
        </div>

      </div>
    </div>
  )
}