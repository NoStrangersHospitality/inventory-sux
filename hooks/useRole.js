import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function useRole() {
  const [role, setRole] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('team_role, owner_user_id')
        .eq('id', session.user.id)
        .single()

      // No team_role means they are the owner
      setRole(profile?.team_role || 'owner')
      setOwnerId(profile?.owner_user_id || session.user.id)
      setLoading(false)
    }
    init()
  }, [])

  const can = (permission) => {
    const permissions = {
      owner: [
        'view_foh', 'view_boh', 'count', 'build_order', 'submit_order',
        'approve_invoice', 'view_reports', 'manage_items', 'manage_distributors',
        'manage_vendors', 'invite_team', 'account_settings', 'billing'
      ],
      gm: [
        'view_foh', 'view_boh', 'count', 'build_order', 'submit_order',
        'approve_invoice', 'view_reports', 'manage_items', 'manage_distributors',
        'manage_vendors', 'invite_team'
      ],
      foh_manager: [
        'view_foh', 'count', 'build_order', 'submit_order',
        'approve_invoice', 'view_reports', 'manage_items', 'manage_distributors'
      ],
      boh_manager: [
        'view_boh', 'count', 'build_order', 'submit_order',
        'approve_invoice', 'view_reports', 'manage_items', 'manage_vendors'
      ],
      foh_staff: ['view_foh', 'count', 'build_order'],
      boh_staff: ['view_boh', 'count', 'build_order'],
    }
    return permissions[role]?.includes(permission) ?? false
  }

  return { role, ownerId, loading, can }
}