'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })
    if (error) {
      setError(error.message)
      setResetLoading(false)
    } else {
      setResetSent(true)
      setResetLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: '#fafafa',
    border: '1px solid #e8e8e8',
    borderRadius: '8px',
    padding: '12px 14px',
    fontSize: '16px', // 16px prevents iOS auto-zoom
    color: '#000',
    boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    color: '#999',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '34px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
            <span style={{ color: '#000' }}>Inventory</span>
            <span style={{ color: '#F5B800' }}>Sux</span>
          </div>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '6px', fontStyle: 'italic' }}>
            Bar management tools that don't suck.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px', padding: '10px 14px', color: '#c53030', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {/* Reset sent */}
          {showReset && resetSent ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📧</div>
              <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Check your email</h2>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
                We sent a reset link to <strong>{resetEmail}</strong>
              </p>
              <span onClick={() => { setShowReset(false); setResetSent(false); setResetEmail('') }}
                style={{ fontSize: '13px', color: '#F5B800', cursor: 'pointer', fontWeight: '500' }}>
                ← Back to sign in
              </span>
            </div>

          /* Reset form */
          ) : showReset ? (
            <>
              <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>Reset your password</h2>
              <p style={{ fontSize: '13px', color: '#999', marginBottom: '20px' }}>Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleReset}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@yourbar.com" required style={inputStyle} />
                </div>
                <button type="submit" disabled={resetLoading}
                  style={{ width: '100%', background: resetLoading ? '#ccc' : '#333', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: '700', cursor: resetLoading ? 'not-allowed' : 'pointer' }}>
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <span onClick={() => { setShowReset(false); setError('') }}
                  style={{ fontSize: '13px', color: '#F5B800', cursor: 'pointer', fontWeight: '500' }}>
                  ← Back to sign in
                </span>
              </div>
            </>

          /* Login form */
          ) : (
            <>
              <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '20px' }}>Sign in</h2>
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourbar.com" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={inputStyle} />
                </div>
                <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                  <span onClick={() => { setShowReset(true); setError('') }}
                    style={{ fontSize: '12px', color: '#F5B800', cursor: 'pointer', fontWeight: '500' }}>
                    Forgot password?
                  </span>
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', background: loading ? '#ccc' : '#333', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#aaa' }}>
                Don't have an account?{' '}
                <Link href="/auth/signup" style={{ color: '#F5B800', fontWeight: '500' }}>Start free trial</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}