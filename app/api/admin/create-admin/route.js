import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { first_name, last_name, email, requestingUserId } = await request.json()

    if (!first_name || !last_name || !email || !requestingUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the requesting user is an admin
    const { data: requestingProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', requestingUserId)
      .single()

    if (!requestingProfile?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Create the auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { first_name, last_name }
    })

    if (createError || !newUser?.user) {
      return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 500 })
    }

    // Create their profile with is_admin: true
    await supabase.from('profiles').insert({
      id: newUser.user.id,
      first_name,
      last_name,
      is_admin: true,
      subscription_status: 'comp',
    })

    // Send password reset so they can set their own password
    await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`
      }
    })

    // Send the reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`
    })

    if (resetError) {
      console.error('Password reset email error:', resetError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Create admin error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}