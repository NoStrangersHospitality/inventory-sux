'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleUpdate = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 2000)
    }
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh', background: '#f5f5f3', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Password updated!</h2>
          <p style={{ fontSize: '13px', color: '#999' }}>Redirecting you to sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f5f5f3', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '36px', fontWeight: '900', fontStyle: 'italic', textTransform: 'uppercase', color: '#000', letterSpacing: '-1px' }}>Inventory</span>
          <span style={{ fontSize: '36px', fontWeight: '900', fontStyle: 'italic', textTransform: 'uppercase', color: '#F5B800', letterSpacing: '-1px' }}>Sux</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Set new password</h2>
          <p style={{ fontSize: '13px', color: '#999', marginBottom: '24px' }}>Choose a strong password for your account.</p>

          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px', padding: '10px 14px', color: '#c53030', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleUpdate}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#999', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Password</label>
              <input
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#000', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#999', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirm Password</label>
              <input
                type="password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#000', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', background: loading ? '#ccc' : '#333', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}