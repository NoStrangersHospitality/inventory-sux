import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SEAT_LIMITS = {
  gm: 1,
  foh_manager: 1,
  boh_manager: 1,
  foh_staff: 2,
  boh_staff: 2,
}

const BOH_ROLES = ['boh_manager', 'boh_staff']

const ROLE_LABELS = {
  gm: 'General Manager',
  foh_manager: 'FOH Manager',
  boh_manager: 'BOH Manager',
  foh_staff: 'FOH Staff',
  boh_staff: 'BOH Staff',
}

export async function POST(req) {
  try {
    const { email, role, inviterUserId } = await req.json()

    if (!email || !role || !inviterUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get inviter profile to check permissions and get bar name
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', inviterUserId)
      .single()

    if (!inviterProfile) {
      return NextResponse.json({ error: 'Inviter not found' }, { status: 404 })
    }

    // Determine owner — if inviter is a GM, owner is their owner_user_id
    const ownerUserId = inviterProfile.owner_user_id || inviterUserId

    // Check inviter has permission to invite
    const inviterRole = inviterProfile.team_role
    if (inviterRole === 'gm') {
      // GM can invite anyone except another GM
      if (role === 'gm') {
        return NextResponse.json({ error: 'GMs cannot invite other GMs' }, { status: 403 })
      }
    } else if (inviterRole) {
      // Non-owner, non-GM roles cannot invite
      return NextResponse.json({ error: 'You do not have permission to invite team members' }, { status: 403 })
    }

    // Check BOH roles require BOH subscription
    if (BOH_ROLES.includes(role)) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('boh_access')
        .eq('id', ownerUserId)
        .single()
      if (!ownerProfile?.boh_access) {
        return NextResponse.json({ error: 'BOH roles require a BOH subscription' }, { status: 403 })
      }
    }

    // Check seat limits
    const { data: existingMembers } = await supabase
      .from('team_members')
      .select('role, status')
      .eq('owner_user_id', ownerUserId)
      .eq('role', role)
      .in('status', ['pending', 'active'])

    if (existingMembers && existingMembers.length >= SEAT_LIMITS[role]) {
      return NextResponse.json({
        error: `You have reached the maximum number of ${ROLE_LABELS[role]} seats (${SEAT_LIMITS[role]})`
      }, { status: 403 })
    }

    // Check if this email is already invited
    const { data: existingInvite } = await supabase
      .from('team_members')
      .select('id, status')
      .eq('owner_user_id', ownerUserId)
      .eq('email', email.toLowerCase())
      .single()

    if (existingInvite && existingInvite.status === 'active') {
      return NextResponse.json({ error: 'This email is already an active team member' }, { status: 409 })
    }

    // If pending invite exists, resend it
    let inviteRow
    if (existingInvite && existingInvite.status === 'pending') {
      const { data: updated } = await supabase
        .from('team_members')
        .update({ role, invited_at: new Date().toISOString(), invite_token: crypto.randomUUID() })
        .eq('id', existingInvite.id)
        .select()
        .single()
      inviteRow = updated
    } else {
      // Create new invite
      const { data: newInvite } = await supabase
        .from('team_members')
        .insert({
          owner_user_id: ownerUserId,
          email: email.toLowerCase(),
          role,
          status: 'pending',
        })
        .select()
        .single()
      inviteRow = newInvite
    }

    if (!inviteRow) {
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    // Send invite email
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${inviteRow.invite_token}`
    const barName = inviterProfile.bar_name || 'your team'

    await sgMail.send({
      to: email,
      from: { email: 'noreply@inventorysux.com', name: 'InventorySux' },
      subject: `You've been invited to join ${barName} on InventorySux`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="font-size: 24px; font-weight: 900; font-style: italic; letter-spacing: -1px; margin-bottom: 24px;">
            <span style="color: #000;">Inventory</span><span style="color: #F5B800;">Sux</span>
          </div>
          <h2 style="font-size: 20px; font-weight: 500; color: #000; margin-bottom: 8px;">You're invited</h2>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 8px;">
            <strong>${inviterProfile.first_name} ${inviterProfile.last_name}</strong> has invited you to join 
            <strong>${barName}</strong> on InventorySux as <strong>${ROLE_LABELS[role]}</strong>.
          </p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 24px;">
            Click the button below to accept your invitation. If you don't have an account yet you'll be able to create one.
          </p>
          <a href="${inviteUrl}" style="display: inline-block; background: #F5B800; color: #000; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin-bottom: 24px;">
            Accept Invitation →
          </a>
          <p style="font-size: 12px; color: #aaa; line-height: 1.5;">
            This invitation will expire in 7 days. If you did not expect this invitation you can safely ignore this email.
          </p>
          <p style="font-size: 12px; color: #aaa;">
            Or copy this link: ${inviteUrl}
          </p>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Invite send error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}