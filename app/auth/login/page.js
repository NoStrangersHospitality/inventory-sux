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
  const router = useRouter()
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{
            fontSize: '36px',
            fontWeight: '900',
            fontStyle: 'italic',
            textTransform: 'uppercase',
            color: '#000',
            letterSpacing: '-1px'
          }}>Inventory</span>
          <span style={{
            fontSize: '36px',
            fontWeight: '900',
            fontStyle: 'italic',
            textTransform: 'uppercase',
            color: '#F5B800',
            letterSpacing: '-1px'
          }}>Sux</span>
          <p style={{ color: '#999', fontSize: '13px', marginTop: '6px', fontStyle: 'italic' }}>
            Bar management tools that don't suck.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: '14px',
          padding: '32px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '500', color: '#000', marginBottom: '24px' }}>
            Sign in
          </h2>

          {error && (
            <div style={{
              background: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#c53030',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '11px',
                color: '#999',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbar.com"
                required
                style={{
                  width: '100%',
                  background: '#fafafa',
                  border: '1px solid #e8e8e8',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: '#000',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '11px',
                color: '#999',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  background: '#fafafa',
                  border: '1px solid #e8e8e8',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: '#000',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#ccc' : '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#aaa' }}>
            Don't have an account?{' '}
            <Link href="/auth/signup" style={{ color: '#F5B800', fontWeight: '500' }}>
              Start free trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}