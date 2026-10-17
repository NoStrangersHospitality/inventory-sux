'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'



export default function PourCost() {
  const [bottles, setBottles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

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
      // Pour Cost = the liquor items in FOH Inventory (wine and beer excluded), mapped to the shape this page already uses.
      const { data: inv } = await supabase.from('inventory_items').select('id, name, subcategory, unit_cost, bottle_size_oz').eq('user_id', session.user.id).eq('area', 'foh').eq('category', 'liquor').order('name')
      setBottles((inv || []).map(i => ({
        id: i.id,
        name: i.name,
        category: i.subcategory || '',
        bottle_size_oz: parseFloat(i.bottle_size_oz) || 0,
        bottle_cost: parseFloat(i.unit_cost) || 0,
      })))
      setLoading(false)
    }
    init()
  }, [])

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const costOz = (b) => b.bottle_size_oz > 0 ? b.bottle_cost / b.bottle_size_oz : 0
  const targetPrice = (b, pct) => costOz(b) / pct

  const categories = ['All', ...Array.from(new Set(bottles.map(b => b.category).filter(Boolean))).sort()]
  const filtered = filter === 'All' ? bottles : bottles.filter(b => b.category === filter)

  const avgCostOz = bottles.length ? bottles.reduce((a, b) => a + costOz(b), 0) / bottles.length : 0
  const avgAt25 = bottles.length ? bottles.reduce((a, b) => a + targetPrice(b, 0.25), 0) / bottles.length : 0

  const exportCSV = () => {
    const rows = [['Bottle Name', 'Category', 'Bottle Size (oz)', 'Bottle Cost ($)']]
    bottles.forEach(b => rows.push([b.name, b.category || '', b.bottle_size_oz, b.bottle_cost]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'pour_cost_bottles.csv'
    a.click()
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ color: '#aaa' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/foh')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← FOH</button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>Pour Cost</h1>
            {!isMobile && <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Target sell prices at 20%, 25%, 30%, and 35% COG</p>}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {!isMobile && bottles.length > 0 && <button onClick={exportCSV} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Export</button>}
            <button onClick={() => router.push('/foh/inventory/database')} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Edit in Inventory →</button>
          </div>
        </div>

        {/* Mobile action row */}
        {isMobile && bottles.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button onClick={exportCSV} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↓ Export</button>
          </div>
        )}

        {/* Stats */}
        {bottles.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Bottles', val: bottles.length, sub: 'in catalog' },
              { label: 'Avg Cost/oz', val: fmt(avgCostOz), sub: 'across all' },
              { label: 'Avg @ 25%', val: fmt(avgAt25), sub: 'target price' },
              { label: 'Categories', val: categories.length - 1, sub: 'spirit types' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: isMobile ? '12px 10px' : '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: '#000' }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Category filter */}
        {bottles.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#aaa', marginRight: '4px' }}>Filter:</span>
            {categories.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                style={{ background: filter === c ? '#F5B800' : '#fff', border: '1px solid', borderColor: filter === c ? '#F5B800' : '#e8e8e8', color: filter === c ? '#000' : '#666', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: filter === c ? '600' : '400' }}>
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Bottle list */}
        {bottles.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No bottles yet. Add your first bottle or import from CSV.
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(b => (
              <div key={b.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1, marginRight: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{b.name}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>
                      {b.category && `${b.category} · `}{b.bottle_size_oz} oz · {fmt(b.bottle_cost)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                  {[
                    { label: 'Cost/oz', val: fmt(costOz(b)), color: '#555' },
                    { label: '@ 20%', val: fmt(targetPrice(b, 0.20)), color: '#3B6D11' },
                    { label: '@ 25%', val: fmt(targetPrice(b, 0.25)), color: '#4a8a1a' },
                    { label: '@ 30%', val: fmt(targetPrice(b, 0.30)), color: '#e07b00' },
                  ].map(p => (
                    <div key={p.label} style={{ textAlign: 'center', background: '#fafafa', borderRadius: '8px', padding: '6px 4px' }}>
                      <div style={{ fontSize: '9px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>{p.label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: p.color }}>{p.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Bottle', 'Category', 'Price', 'Cost/oz', '@ 20%', '@ 25%', '@ 30%', '@ 35%'].map((h, i) => (
                    <th key={i} style={{ textAlign: i > 2 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{b.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {b.category && <span style={{ background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{b.category}</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: '#000', fontSize: '13px' }}>{fmt(b.bottle_cost)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{fmt(costOz(b))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#3B6D11', fontWeight: '600', fontSize: '13px' }}>{fmt(targetPrice(b, 0.20))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#4a8a1a', fontWeight: '600', fontSize: '13px' }}>{fmt(targetPrice(b, 0.25))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#e07b00', fontWeight: '600', fontSize: '13px' }}>{fmt(targetPrice(b, 0.30))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#c05000', fontWeight: '600', fontSize: '13px' }}>{fmt(targetPrice(b, 0.35))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}