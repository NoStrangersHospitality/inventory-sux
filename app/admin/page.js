'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Admin() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState(null)
  const [drawerForm, setDrawerForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmChange, setConfirmChange] = useState(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.is_admin) { router.push('/dashboard'); return }
      await loadProfiles()
      setLoading(false)
    }
    init()
  }, [])

  const loadProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setProfiles(data || [])
  }

  const mrr = (p) => {
    if (p.subscription_status !== 'active') return 0
    if (p.subscription_tier === 'both') return 25
    return 15
  }

  const totalMRR = profiles.reduce((a, p) => a + mrr(p), 0)
  const activeCount = profiles.filter(p => p.subscription_status === 'active').length
  const trialCount = profiles.filter(p => p.subscription_status === 'trial').length
  const cancelledCount = profiles.filter(p => p.subscription_status === 'cancelled').length

  const statusColor = (s) => {
    if (s === 'active') return { bg: '#EAF3DE', color: '#3B6D11', border: '#a8d08d' }
    if (s === 'trial') return { bg: '#E6F1FB', color: '#185FA5', border: '#b5d4f4' }
    if (s === 'cancelled') return { bg: '#f5f5f3', color: '#666', border: '#d0d0d0' }
    if (s === 'comp') return { bg: '#FAEEDA', color: '#854F0B', border: '#f0c080' }
    return { bg: '#f5f5f3', color: '#aaa', border: '#e0e0e0' }
  }

  const filtered = profiles.filter(p => {
    const matchFilter = activeFilter === 'all' || p.subscription_status === activeFilter
    const q = search.toLowerCase()
    const matchSearch = !q || (p.first_name + ' ' + p.last_name).toLowerCase().includes(q) || (p.bar_name || '').toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const openDrawer = (p) => {
    setDrawer(p)
    setDrawerForm({
      subscription_status: p.subscription_status || 'trial',
      subscription_tier: p.subscription_tier || 'foh',
      boh_access: p.boh_access || false,
      is_admin: p.is_admin || false,
      comp_type: p.comp_type || 'indefinite',
      comp_expires_at: p.comp_expires_at ? p.comp_expires_at.split('T')[0] : '',
    })
    setConfirmChange(null)
  }

  const closeDrawer = () => {
    setDrawer(null)
    setDrawerForm({})
    setConfirmChange(null)
  }

  const saveDrawer = async () => {
    if (!drawer) return
    if (drawerForm.subscription_status !== drawer.subscription_status) {
      setConfirmChange({
        from: drawer.subscription_status,
        to: drawerForm.subscription_status,
        name: drawer.first_name + ' ' + drawer.last_name,
        bar: drawer.bar_name
      })
      return
    }
    await applyDrawerSave()
  }

  const applyDrawerSave = async () => {
    setSaving(true)
    const payload = {
      subscription_status: drawerForm.subscription_status,
      subscription_tier: drawerForm.subscription_tier,
      boh_access: drawerForm.boh_access,
      is_admin: drawerForm.is_admin,
      comp_type: drawerForm.subscription_status === 'comp' ? drawerForm.comp_type : null,
      comp_expires_at: drawerForm.subscription_status === 'comp' && drawerForm.comp_type === 'fixed' && drawerForm.comp_expires_at
        ? new Date(drawerForm.comp_expires_at).toISOString()
        : null,
    }
    await supabase.from('profiles').update(payload).eq('id', drawer.id)
    await loadProfiles()
    setConfirmChange(null)
    closeDrawer()
    setSaving(false)
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: '11px', color: '#999', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#111', borderBottom: '2px solid #F5B800', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '20px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', color: '#fff' }}>
            Inventory<span style={{ color: '#F5B800' }}>Sux</span>
          </div>
          <div style={{ background: 'rgba(245,184,0,.15)', border: '1px solid rgba(245,184,0,.3)', color: '#F5B800', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px' }}>Admin</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
  <button onClick={() => router.push('/admin/tickets')} style={{ background: 'none', border: '1px solid rgba(255,255,255,.2)', color: '#aaa', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>🎫 Tickets</button>
  <button onClick={() => router.push('/admin/knowledge-base')} style={{ background: 'none', border: '1px solid rgba(255,255,255,.2)', color: '#aaa', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>📖 Knowledge Base</button>
  <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: '1px solid rgba(255,255,255,.2)', color: '#aaa', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← App</button>
</div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }} style={{ background: 'none', border: 'none', color: '#666', fontSize: '12px', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total', val: profiles.length, sub: 'subscribers' },
            { label: 'Active', val: activeCount, sub: 'paying', color: '#3B6D11' },
            { label: 'Trial', val: trialCount, sub: 'converting', color: '#c89000' },
            { label: 'Cancelled', val: cancelledCount, sub: 'churned', color: '#E24B4A' },
            { label: 'MRR', val: '$' + totalMRR, sub: 'monthly', color: '#3B6D11' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '18px 20px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: s.color || '#000', lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '14px' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or bar..."
              style={{ ...inputStyle, paddingLeft: '34px' }} />
          </div>
          {['all', 'trial', 'active', 'cancelled', 'comp'].map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              style={{ padding: '8px 16px', border: '1px solid', borderColor: activeFilter === f ? '#F5B800' : '#e8e8e8', borderRadius: '8px', fontSize: '12px', fontWeight: activeFilter === f ? '700' : '400', cursor: 'pointer', background: activeFilter === f ? '#F5B800' : '#fff', color: activeFilter === f ? '#000' : '#666', textTransform: 'capitalize' }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', marginBottom: drawer ? '16px' : '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {['Subscriber', 'Location', 'Status', 'Plan', 'BOH', 'Since', 'MRR', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#ccc', fontSize: '13px' }}>No subscribers found.</td></tr>
              ) : filtered.map(p => {
                const sc = statusColor(p.subscription_status)
                const m = mrr(p)
                return (
                  <tr key={p.id} onClick={() => openDrawer(p)} style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = '#fffdf0')}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = '')}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500', color: '#000', fontSize: '13px' }}>{p.first_name} {p.last_name}</div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>{p.bar_name || '--'}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#888', fontSize: '12px' }}>{p.city && p.state ? p.city + ', ' + p.state : '--'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>
                        <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '6px', fontSize: '12px', fontWeight: '600', padding: '3px 10px' }}>
                          {(p.subscription_status || 'trial').charAt(0).toUpperCase() + (p.subscription_status || 'trial').slice(1)}
                        </span>
                        {p.subscription_status === 'comp' && p.comp_expires_at && (
                          <div style={{ fontSize: '10px', color: '#854F0B', marginTop: '3px' }}>
                            Expires {new Date(p.comp_expires_at).toLocaleDateString()}
                          </div>
                        )}
                        {p.subscription_status === 'comp' && !p.comp_expires_at && (
                          <div style={{ fontSize: '10px', color: '#aaa', marginTop: '3px' }}>Indefinite</div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#555' }}>{p.subscription_tier === 'both' ? 'FOH + BOH' : 'FOH'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: p.boh_access ? '#3B6D11' : '#ccc' }}>{p.boh_access ? '✓ Yes' : '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#888' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '--'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: m > 0 ? '600' : '400', color: m > 0 ? '#000' : '#ccc' }}>{m > 0 ? '$' + m : '$0'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button onClick={e => { e.stopPropagation(); openDrawer(p) }} style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Manage</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Drawer */}
        {drawer && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', color: '#000' }}>{drawer.first_name} {drawer.last_name}</h3>
              <button onClick={closeDrawer} style={{ background: '#333', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            {/* Account info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px', background: '#fafafa', borderRadius: '8px', padding: '14px', border: '1px solid #f0f0f0' }}>
              {[
                { label: 'Bar / Restaurant', val: drawer.bar_name || '--' },
                { label: 'Location', val: drawer.city && drawer.state ? drawer.city + ', ' + drawer.state : '--' },
                { label: 'Member Since', val: drawer.created_at ? new Date(drawer.created_at).toLocaleDateString() : '--' },
              ].map(f => (
                <div key={f.label}>
                  <div style={labelStyle}>{f.label}</div>
                  <div style={{ fontSize: '13px', color: '#000', fontWeight: '500' }}>{f.val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Account Status</label>
                <select style={inputStyle} value={drawerForm.subscription_status}
                  onChange={e => setDrawerForm(f => ({ ...f, subscription_status: e.target.value, comp_type: 'indefinite', comp_expires_at: '' }))}>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="comp">Comp</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Plan</label>
                <select style={inputStyle} value={drawerForm.subscription_tier} onChange={e => setDrawerForm(f => ({ ...f, subscription_tier: e.target.value }))}>
                  <option value="foh">FOH Only ($15/mo)</option>
                  <option value="both">FOH + BOH ($25/mo)</option>
                </select>
              </div>
            </div>

            {/* Comp duration — only shows when status is comp */}
            {drawerForm.subscription_status === 'comp' && (
              <div style={{ background: '#FAEEDA', border: '1px solid #f0c080', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#854F0B', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comp Duration</div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: drawerForm.comp_type === 'fixed' ? '12px' : '0' }}>
                  {['indefinite', 'fixed'].map(type => (
                    <button key={type} onClick={() => setDrawerForm(f => ({ ...f, comp_type: type, comp_expires_at: '' }))}
                      style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid', borderColor: drawerForm.comp_type === type ? '#854F0B' : '#f0c080', background: drawerForm.comp_type === type ? '#854F0B' : '#fff', color: drawerForm.comp_type === type ? '#fff' : '#854F0B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                      {type === 'indefinite' ? 'Indefinite' : 'Fixed Duration'}
                    </button>
                  ))}
                </div>
                {drawerForm.comp_type === 'fixed' && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{ ...labelStyle, color: '#854F0B' }}>Comp Expires On</label>
                    <input type="date" style={{ ...inputStyle, borderColor: '#f0c080' }}
                      value={drawerForm.comp_expires_at}
                      onChange={e => setDrawerForm(f => ({ ...f, comp_expires_at: e.target.value }))} />
                    {drawerForm.comp_expires_at && (
                      <div style={{ fontSize: '11px', color: '#854F0B', marginTop: '6px' }}>
                        Account converts to Active billing on {new Date(drawerForm.comp_expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '12px 14px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>Back of House Access</div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>+$10/mo add-on</div>
                </div>
                <input type="checkbox" checked={drawerForm.boh_access} onChange={e => setDrawerForm(f => ({ ...f, boh_access: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#F5B800', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '12px 14px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>Admin Access</div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Can access /admin</div>
                </div>
                <input type="checkbox" checked={drawerForm.is_admin} onChange={e => setDrawerForm(f => ({ ...f, is_admin: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#F5B800', cursor: 'pointer' }} />
              </div>
            </div>

            {/* Confirm status change */}
            {confirmChange && (
              <div style={{ background: '#fffbe6', border: '1px solid #f0d060', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#854F0B', marginBottom: '6px' }}>Confirm Status Change</div>
                <div style={{ fontSize: '13px', color: '#a07000', marginBottom: '12px' }}>
                  Changing <strong>{confirmChange.name}</strong> ({confirmChange.bar}) from <strong>{confirmChange.from}</strong> to <strong>{confirmChange.to}</strong>.
                  {confirmChange.to === 'active' && ' Billing will begin on their Stripe subscription.'}
                  {confirmChange.to === 'comp' && ' Billing will stop. Access continues at no charge.'}
                  {confirmChange.to === 'cancelled' && ' Access will be revoked.'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setConfirmChange(null)} style={{ flex: 1, background: '#f5f5f3', color: '#555', border: 'none', padding: '9px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={applyDrawerSave} style={{ flex: 2, background: '#333', color: '#fff', border: 'none', padding: '9px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Confirm Change</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={closeDrawer} style={{ flex: 1, background: '#444', color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDrawer} disabled={saving} style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}