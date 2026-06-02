'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Signup() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    barName: '',
    city: '',
    state: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          bar_name: formData.barName,
          city: formData.city,
          state: formData.state,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Send welcome email
      try {
        await fetch('/api/email/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: formData.firstName,
            email: formData.email,
            barName: formData.barName,
          })
        })
      } catch (emailError) {
        console.error('Welcome email failed:', emailError)
      }
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
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
        <div style={{
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: '14px',
          padding: '48px 32px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥃</div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#000', marginBottom: '8px' }}>
            Welcome to Inventory Sux, {formData.firstName}.
          </h2>
          <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
            Check your email to confirm your account and activate your 14-day free trial.
          </p>
        </div>
      </div>
    )
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
            14-day free trial. No charge until day 15.
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
            Create your account
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

          <form onSubmit={handleSignup}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', color: '#999',
                  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>First Name</label>
                <input
                  type="text" name="firstName" value={formData.firstName}
                  onChange={handleChange} placeholder="Jane" required
                  style={{
                    width: '100%', background: '#fafafa', border: '1px solid #e8e8e8',
                    borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
                    color: '#000', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', color: '#999',
                  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>Last Name</label>
                <input
                  type="text" name="lastName" value={formData.lastName}
                  onChange={handleChange} placeholder="Smith"
                  style={{
                    width: '100%', background: '#fafafa', border: '1px solid #e8e8e8',
                    borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
                    color: '#000', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '11px', color: '#999',
                marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>Bar or Restaurant</label>
              <input
                type="text" name="barName" value={formData.barName}
                onChange={handleChange} placeholder="The Rail House" required
                style={{
                  width: '100%', background: '#fafafa', border: '1px solid #e8e8e8',
                  borderRadius: '8px', padding: '10px 14px', fontSize: '14px',
                  color: '#000', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', color: '#999',
                  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>City</label>
                <input
                  type="text" name="city" value={formData.city}
                  onChange={handleChange} placeholder="Indianapolis"
                  style={{
                    width: '100%', background: '#fafafa', border: '1px solid #e8e8e8',
                    borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
                    color: '#000', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', color: '#999',
                  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>State</label>
                <input
                  type="text" name="state" value={formData.state}
                  onChange={handleChange} placeholder="IN" maxLength="2"
                  style={{
                    width: '100%', background: '#fafafa', border: '1px solid #e8e8e8',
                    borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
                    color: '#000', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '11px', color: '#999',
                marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>Email</label>
              <input
                type="email" name="email" value={formData.email}
                onChange={handleChange} placeholder="jane@therailhouse.com" required
                style={{
                  width: '100%', background: '#fafafa', border: '1px solid #e8e8e8',
                  borderRadius: '8px', padding: '10px 14px', fontSize: '14px',
                  color: '#000', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '11px', color: '#999',
                marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>Password</label>
              <input
                type="password" name="password" value={formData.password}
                onChange={handleChange} placeholder="••••••••" required
                style={{
                  width: '100%', background: '#fafafa', border: '1px solid #e8e8e8',
                  borderRadius: '8px', padding: '10px 14px', fontSize: '14px',
                  color: '#000', boxSizing: 'border-box'
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
              {loading ? 'Creating account...' : 'Start Free Trial'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#aaa' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: '#F5B800', fontWeight: '500' }}>
              Sign in
            </Link>
          </div>

          <p style={{ fontSize: '11px', color: '#ccc', textAlign: 'center', marginTop: '12px' }}>
            Card required at next step. No charge for 14 days.
          </p>

          <p style={{ fontSize: '11px', color: '#ccc', textAlign: 'center', marginTop: '8px', lineHeight: '1.6' }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" style={{ color: '#aaa', textDecoration: 'underline' }}>
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link href="/privacy" style={{ color: '#aaa', textDecoration: 'underline' }}>
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}