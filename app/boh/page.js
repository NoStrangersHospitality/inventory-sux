'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useRole } from '@/hooks/useRole'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
        <div style={{ fontWeight: '600', color: '#000', marginBottom: '2px' }}>{label}</div>
        <div style={{ color: '#F5B800', fontWeight: '700' }}>${Number(payload[0].value).toFixed(2)}</div>
      </div>
    )
  }
  return null
}

export default function BOH() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState(null)
  const [categoryData, setCategoryData] = useState([])
  const [trendData, setTrendData] = useState([])
  const [topVariance, setTopVariance] = useState([])
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const { role, can, ownerId, loading: roleLoading } = useRole()

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
      if (!prof?.boh_access && !prof?.owner_user_id) { router.push('/dashboard'); return }
      setProfile(prof)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!roleLoading && !loading) {
      if (!can('view_boh')) { router.push('/dashboard'); return }
      if (ownerId) loadDashboardData(ownerId)
    }
  }, [roleLoading, loading, ownerId])

  const loadDashboardData = async (userId) => {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .eq('area', 'boh')

    const { data: sessions } = await supabase
      .from('count_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('area', 'boh')
      .eq('status', 'submitted')
      .order('count_date', { ascending: false })
      .limit(6)

    if (items) {
      const totalValue = items.reduce((sum, i) => sum + (i.on_hand * i.unit_cost), 0)
      const lowStock = items.filter(i => i.par > 0 && i.on_hand < i.par).length
      const lastSession = sessions?.[0]

      setSnapshot({
        totalValue, lowStock, totalItems: items.length,
        lastCountDate: lastSession?.count_date || null,
        lastCountValue: lastSession?.total_value || null,
      })

      const CATEGORIES = [
        { key: 'proteins', label: 'Proteins' },
        { key: 'produce', label: 'Produce' },
        { key: 'dairy', label: 'Dairy' },
        { key: 'dry_goods', label: 'Dry Goods' },
        { key: 'dry_spices', label: 'Dry Spices' },
        { key: 'oils_fats', label: 'Oils & Fats' },
        { key: 'sauces', label: 'Sauces' },
        { key: 'misc', label: 'Misc' },
      ]

      setCategoryData(CATEGORIES.map(c => ({
        name: c.label,
        value: parseFloat(items.filter(i => i.category === c.key).reduce((sum, i) => sum + (i.on_hand * i.unit_cost), 0).toFixed(2))
      })).filter(c => c.value > 0))

      if (sessions && sessions.length > 1) {
        setTrendData([...sessions].reverse().map(s => ({
          date: new Date(s.count_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: parseFloat((s.total_value || 0).toFixed(2))
        })))
      }
    }

    if (sessions && sessions.length >= 2) {
      const [latest, previous] = sessions
      const { data: latestLines } = await supabase.from('count_lines').select('inventory_item_id, item_name, quantity, unit_cost').eq('session_id', latest.id)
      const { data: previousLines } = await supabase.from('count_lines').select('inventory_item_id, quantity').eq('session_id', previous.id)

      if (latestLines && previousLines) {
        const latestTotals = {}
        latestLines.forEach(l => {
          if (!latestTotals[l.inventory_item_id]) latestTotals[l.inventory_item_id] = { name: l.item_name, qty: 0, unit_cost: l.unit_cost }
          latestTotals[l.inventory_item_id].qty += parseFloat(l.quantity) || 0
        })
        const previousTotals = {}
        previousLines.forEach(l => {
          if (!previousTotals[l.inventory_item_id]) previousTotals[l.inventory_item_id] = 0
          previousTotals[l.inventory_item_id] += parseFloat(l.quantity) || 0
        })
        const variances = Object.entries(latestTotals).map(([id, data]) => {
          const prev = previousTotals[id] || 0
          const variance = data.qty - prev
          return { name: data.name, variance, varianceValue: variance * data.unit_cost }
        }).filter(v => v.variance !== 0).sort((a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue)).slice(0, 5)
        setTopVariance(variances)
      }
    }
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const fmtK = (n) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : fmt(n)

  if (loading || roleLoading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const allModules = [
    { title: 'Ordering', desc: 'Ingredients, vendors, and purchase orders', icon: '🛒', href: '/boh/ordering', permission: 'build_order' },
    { title: 'COGS', desc: 'Ingredient costing and recipe margins', icon: '🧾', href: '/boh/cogs', permission: 'manage_items' },
    { title: 'Inventory', desc: 'On hand, counts, and receiving', icon: '📦', href: '/boh/inventory', permission: 'count' },
    { title: 'Reports', desc: 'Variance, usage, and cost trends', icon: '📊', href: '/boh/reports', permission: 'view_reports' },
  ]
  const modules = allModules.filter(m => can(m.permission))

  const hasData = snapshot && snapshot.totalItems > 0
  const hasTrend = trendData.length >= 2
  const canSeeReports = can('view_reports')

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Home</button>
      </div>

      <div style={{ padding: isMobile ? '20px 16px' : '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '500', color: '#000' }}>Back of House</h1>
          <p style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>
            {role === 'boh_staff' ? 'Inventory counts and ordering.' : 'Kitchen ordering, food cost, and recipe costing.'}
          </p>
        </div>

        {/* Snapshot — managers and above only */}
        {canSeeReports && hasData && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Inventory Value', val: fmtK(snapshot.totalValue), sub: 'on hand', color: '#F5B800' },
              { label: 'Last Count', val: snapshot.lastCountDate ? new Date(snapshot.lastCountDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--', sub: snapshot.lastCountValue ? fmtK(snapshot.lastCountValue) : 'no counts yet', color: '#000' },
              { label: 'Below Par', val: snapshot.lowStock, sub: 'need attention', color: snapshot.lowStock > 0 ? '#E24B4A' : '#3B6D11' },
              { label: 'Total Items', val: snapshot.totalItems, sub: 'in database', color: '#000' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '12px 14px' : '16px 20px' }}>
                <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: s.color, marginBottom: '2px' }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: '#aaa' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Charts — managers and above only */}
        {canSeeReports && hasData && (categoryData.length > 0 || hasTrend) && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (hasTrend ? '1fr 1fr' : '1fr'), gap: '16px', marginBottom: '20px' }}>
            {categoryData.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '14px' }}>Value by Category</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                    <XAxis type="number" tickFormatter={v => '$' + v} tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f5f3' }} />
                    <Bar dataKey="value" fill="#F5B800" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {hasTrend && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '14px' }}>Inventory Value Trend</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => '$' + v} tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="#F5B800" strokeWidth={2.5} dot={{ fill: '#F5B800', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: '#F5B800' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Top variance — managers and above only */}
        {canSeeReports && topVariance.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#000' }}>Top Movers — Last Two Counts</div>
              <button onClick={() => router.push('/boh/reports')} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#F5B800', cursor: 'pointer', fontWeight: '500' }}>Full Report →</button>
            </div>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topVariance.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fafafa', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', flex: 1, marginRight: '12px' }}>{item.name}</div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: item.varianceValue >= 0 ? '#3B6D11' : '#E24B4A' }}>{item.varianceValue >= 0 ? '+' : ''}{fmt(item.varianceValue)}</div>
                      <div style={{ fontSize: '11px', color: item.variance >= 0 ? '#3B6D11' : '#E24B4A' }}>{item.variance >= 0 ? '+' : ''}{item.variance.toFixed(2)} units</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Item', 'Unit Variance', 'Value Variance'].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {topVariance.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                      <td style={{ padding: '9px 10px', fontSize: '13px', fontWeight: '500', color: '#000' }}>{item.name}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: item.variance >= 0 ? '#3B6D11' : '#E24B4A' }}>{item.variance >= 0 ? '+' : ''}{item.variance.toFixed(2)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: item.varianceValue >= 0 ? '#3B6D11' : '#E24B4A' }}>{item.varianceValue >= 0 ? '+' : ''}{fmt(item.varianceValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* No data state */}
        {canSeeReports && !hasData && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '28px 20px', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '4px' }}>No data yet</div>
            <div style={{ fontSize: '13px', color: '#aaa' }}>Add items to your BOH inventory database and run your first count to see your dashboard.</div>
          </div>
        )}

        {/* Module tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${modules.length}, 1fr)`, gap: isMobile ? '10px' : '16px' }}>
          {modules.map(mod => (
            <div key={mod.title} onClick={() => mod.href && router.push(mod.href)}
              style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '14px', padding: isMobile ? '20px 12px' : '28px 16px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F5B800'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,184,0,.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ fontSize: isMobile ? '28px' : '32px', marginBottom: '8px' }}>{mod.icon}</div>
              <div style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '600', color: '#000', marginBottom: isMobile ? '0' : '4px' }}>{mod.title}</div>
              {!isMobile && <div style={{ fontSize: '11px', color: '#aaa', lineHeight: '1.4' }}>{mod.desc}</div>}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}