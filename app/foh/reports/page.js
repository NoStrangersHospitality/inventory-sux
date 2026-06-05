'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
        <div style={{ fontWeight: '600', color: '#000', marginBottom: '4px' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontWeight: '600' }}>{p.name}: ${Number(p.value).toFixed(2)}</div>
        ))}
      </div>
    )
  }
  return null
}

export default function FOHReports() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [sessionA, setSessionA] = useState(null)
  const [sessionB, setSessionB] = useState(null)
  const [varianceReport, setVarianceReport] = useState([])
  const [usageReport, setUsageReport] = useState([])
  const [trendData, setTrendData] = useState([])
  const [categoryTrend, setCategoryTrend] = useState([])
  const [invoiceTotal, setInvoiceTotal] = useState(0)
  const [runningReport, setRunningReport] = useState(false)
  const [activeTab, setActiveTab] = useState('variance')
  const [filterCategory, setFilterCategory] = useState('all')
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    { key: 'liquor', label: 'Liquor', color: '#F5B800' },
    { key: 'beer', label: 'Beer', color: '#E07B00' },
    { key: 'wine', label: 'Wine', color: '#9B4DCA' },
    { key: 'misc', label: 'Misc', color: '#aaa' },
  ]

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
      await loadSessions(session.user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadSessions = async (userId) => {
    const { data } = await supabase
      .from('count_sessions').select('*').eq('user_id', userId).eq('area', 'foh').eq('status', 'submitted')
      .order('count_date', { ascending: false }).limit(20)
    setSessions(data || [])
    if (data && data.length >= 2) { setSessionA(data[0].id); setSessionB(data[1].id) }
    if (data && data.length > 1) {
      const trend = [...data].reverse().map(s => ({
        date: new Date(s.count_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: parseFloat((s.total_value || 0).toFixed(2)),
        sessionId: s.id
      }))
      setTrendData(trend)
    }
  }

  const runReport = async () => {
    if (!sessionA || !sessionB) return
    setRunningReport(true)
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session.user.id
    const sessA = sessions.find(s => s.id === sessionA)
    const sessB = sessions.find(s => s.id === sessionB)
    const [later, earlier] = new Date(sessA.count_date) > new Date(sessB.count_date) ? [sessA, sessB] : [sessB, sessA]

    const [{ data: laterLines }, { data: earlierLines }] = await Promise.all([
      supabase.from('count_lines').select('inventory_item_id, item_name, category, quantity, unit_cost, par').eq('session_id', later.id),
      supabase.from('count_lines').select('inventory_item_id, quantity').eq('session_id', earlier.id),
    ])

    const { data: invoices } = await supabase.from('invoices').select('*, invoice_lines(*)')
      .eq('user_id', userId).eq('area', 'foh').eq('status', 'confirmed')
      .gte('invoice_date', earlier.count_date).lte('invoice_date', later.count_date)

    const invoiceReceived = {}
    let totalInvoiced = 0
    invoices?.forEach(inv => {
      inv.invoice_lines?.forEach(line => {
        if (!invoiceReceived[line.matched_item_id]) invoiceReceived[line.matched_item_id] = 0
        invoiceReceived[line.matched_item_id] += parseFloat(line.qty) || 0
        totalInvoiced += parseFloat(line.total_cost) || 0
      })
    })
    setInvoiceTotal(totalInvoiced)

    const laterTotals = {}
    laterLines?.forEach(l => {
      if (!laterTotals[l.inventory_item_id]) laterTotals[l.inventory_item_id] = { name: l.item_name, category: l.category, qty: 0, unit_cost: l.unit_cost, par: l.par }
      laterTotals[l.inventory_item_id].qty += parseFloat(l.quantity) || 0
    })

    const earlierTotals = {}
    earlierLines?.forEach(l => {
      if (!earlierTotals[l.inventory_item_id]) earlierTotals[l.inventory_item_id] = 0
      earlierTotals[l.inventory_item_id] += parseFloat(l.quantity) || 0
    })

    const report = Object.entries(laterTotals).map(([id, data]) => {
      const openingQty = earlierTotals[id] || 0
      const closingQty = data.qty
      const received = invoiceReceived[id] || 0
      const usage = openingQty + received - closingQty
      const variance = closingQty - openingQty
      const usageCost = usage * data.unit_cost
      const varianceCost = variance * data.unit_cost
      return { id, name: data.name, category: data.category, unit_cost: data.unit_cost, par: data.par, openingQty, closingQty, received, usage, usageCost, variance, varianceCost }
    }).sort((a, b) => Math.abs(b.varianceCost) - Math.abs(a.varianceCost))

    setVarianceReport(report)
    setUsageReport([...report].sort((a, b) => b.usageCost - a.usageCost))

    const catSummary = CATEGORIES.map(cat => {
      const catItems = report.filter(r => r.category === cat.key)
      return {
        category: cat.label,
        opening: catItems.reduce((s, i) => s + (i.openingQty * i.unit_cost), 0),
        closing: catItems.reduce((s, i) => s + (i.closingQty * i.unit_cost), 0),
        usage: catItems.reduce((s, i) => s + i.usageCost, 0),
      }
    }).filter(c => c.opening > 0 || c.closing > 0)
    setCategoryTrend(catSummary)
    setRunningReport(false)
  }

  const exportCSV = () => {
    const rows = [['Item', 'Category', 'Opening Qty', 'Received', 'Closing Qty', 'Usage', 'Usage Cost', 'Variance Qty', 'Variance Value', 'Unit Cost']]
    varianceReport.forEach(r => rows.push([r.name, r.category, r.openingQty.toFixed(2), r.received.toFixed(2), r.closingQty.toFixed(2), r.usage.toFixed(2), r.usageCost.toFixed(2), r.variance.toFixed(2), r.varianceCost.toFixed(2), r.unit_cost.toFixed(2)]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const sessA = sessions.find(s => s.id === sessionA)
    const sessB = sessions.find(s => s.id === sessionB)
    a.download = `foh_report_${sessB?.count_date}_to_${sessA?.count_date}.csv`
    a.click()
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const fmtK = (n) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : fmt(n)

  const filteredVariance = filterCategory === 'all' ? varianceReport : varianceReport.filter(r => r.category === filterCategory)
  const filteredUsage = filterCategory === 'all' ? usageReport : usageReport.filter(r => r.category === filterCategory)

  const sessAObj = sessions.find(s => s.id === sessionA)
  const sessBObj = sessions.find(s => s.id === sessionB)
  const [later, earlier] = sessAObj && sessBObj
    ? new Date(sessAObj.count_date) > new Date(sessBObj.count_date) ? [sessAObj, sessBObj] : [sessBObj, sessAObj]
    : [null, null]

  const totalVarianceCost = varianceReport.reduce((s, r) => s + r.varianceCost, 0)
  const totalUsageCost = varianceReport.reduce((s, r) => s + r.usageCost, 0)
  const shrinkageItems = varianceReport.filter(r => r.variance < 0)
  const shrinkageCost = shrinkageItems.reduce((s, r) => s + Math.abs(r.varianceCost), 0)

  const selectStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '16px', color: '#000' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '500', color: '#000' }}>FOH Reports</h1>
            {!isMobile && <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Variance, usage, and inventory trends across count periods.</p>}
          </div>
          {varianceReport.length > 0 && (
            <button onClick={exportCSV} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
              ↓ Export
            </button>
          )}
        </div>

        {sessions.length < 2 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>Need at least two counts</div>
            <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '20px' }}>Run your first two inventory counts to unlock variance and usage reports.</div>
            <button onClick={() => router.push('/foh/inventory/count')} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              Start a Count →
            </button>
          </div>
        ) : (
          <>
            {/* Trend chart */}
            {trendData.length >= 2 && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '14px 16px' : '20px 24px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '14px' }}>Inventory Value Over Time</div>
                <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
                  <LineChart data={trendData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => '$' + v} tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="#F5B800" strokeWidth={2.5} dot={{ fill: '#F5B800', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: '#F5B800' }} name="Value" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Session selector */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '14px 16px' : '20px 24px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '12px' }}>Select Count Period</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From Count</label>
                  <select value={sessionB || ''} onChange={e => setSessionB(e.target.value)} style={selectStyle}>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.count_date}{s.counted_by ? ` · ${s.counted_by}` : ''}{s.total_value ? ` · ${fmtK(s.total_value)}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To Count</label>
                  <select value={sessionA || ''} onChange={e => setSessionA(e.target.value)} style={selectStyle}>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.count_date}{s.counted_by ? ` · ${s.counted_by}` : ''}{s.total_value ? ` · ${fmtK(s.total_value)}` : ''}</option>)}
                  </select>
                </div>
                <button onClick={runReport} disabled={runningReport || !sessionA || !sessionB || sessionA === sessionB}
                  style={{ background: runningReport ? '#ccc' : '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: runningReport ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto' }}>
                  {runningReport ? 'Running...' : 'Run Report'}
                </button>
              </div>
            </div>

            {/* Report results */}
            {varianceReport.length > 0 && (
              <>
                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '10px', marginBottom: '16px' }}>
                  {[
                    { label: 'Period', val: `${earlier?.count_date}`, val2: `→ ${later?.count_date}`, sub: 'count period', color: '#000', small: true },
                    { label: 'Total Usage Cost', val: fmtK(totalUsageCost), sub: 'product consumed', color: '#000' },
                    { label: 'Invoices In', val: fmtK(invoiceTotal), sub: 'cost of goods in', color: '#185FA5' },
                    { label: 'Shrinkage', val: fmtK(shrinkageCost), sub: `${shrinkageItems.length} items`, color: shrinkageCost > 0 ? '#E24B4A' : '#3B6D11' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '12px 14px' : '16px 20px' }}>
                      <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.label}</div>
                      <div style={{ fontSize: s.small ? '12px' : isMobile ? '16px' : '22px', fontWeight: '700', color: s.color, lineHeight: '1.2' }}>{s.val}</div>
                      {s.val2 && <div style={{ fontSize: '12px', fontWeight: '700', color: s.color }}>{s.val2}</div>}
                      <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Category breakdown chart */}
                {categoryTrend.length > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: isMobile ? '14px 16px' : '20px 24px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '14px' }}>Opening vs Closing by Category</div>
                    <ResponsiveContainer width="100%" height={isMobile ? 150 : 180}>
                      <BarChart data={categoryTrend} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                        <XAxis dataKey="category" tick={{ fontSize: isMobile ? 10 : 12, fill: '#555' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => '$' + v} tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} width={44} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f5f3' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="opening" name="Opening" fill="#e8e8e8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="closing" name="Closing" fill="#F5B800" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="usage" name="Usage" fill="#333" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tabs + filter */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[{ key: 'variance', label: 'Variance' }, { key: 'usage', label: 'Usage' }].map(t => (
                      <button key={t.key} onClick={() => setActiveTab(t.key)}
                        style={{ padding: '7px 14px', border: '1px solid', borderColor: activeTab === t.key ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: activeTab === t.key ? '700' : '400', cursor: 'pointer', background: activeTab === t.key ? '#F5B800' : '#fff', color: activeTab === t.key ? '#000' : '#666' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <button onClick={() => setFilterCategory('all')}
                      style={{ padding: '5px 10px', border: '1px solid', borderColor: filterCategory === 'all' ? '#333' : '#e8e8e8', borderRadius: '20px', fontSize: '11px', fontWeight: filterCategory === 'all' ? '600' : '400', cursor: 'pointer', background: filterCategory === 'all' ? '#333' : '#fff', color: filterCategory === 'all' ? '#fff' : '#666' }}>
                      All
                    </button>
                    {CATEGORIES.map(c => (
                      <button key={c.key} onClick={() => setFilterCategory(c.key)}
                        style={{ padding: '5px 10px', border: '1px solid', borderColor: filterCategory === c.key ? '#333' : '#e8e8e8', borderRadius: '20px', fontSize: '11px', fontWeight: filterCategory === c.key ? '600' : '400', cursor: 'pointer', background: filterCategory === c.key ? '#333' : '#fff', color: filterCategory === c.key ? '#fff' : '#666' }}>
                        {isMobile ? c.label.slice(0, 3) : c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variance table / cards */}
                {activeTab === 'variance' && (
                  isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredVariance.map((item, i) => (
                        <div key={i} style={{ background: item.variance < -1 ? '#fff8f8' : '#fff', border: `1px solid ${item.variance < -1 ? '#fca5a5' : '#e8e8e8'}`, borderRadius: '12px', padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ flex: 1, marginRight: '12px' }}>
                              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{item.name}</div>
                              <div style={{ fontSize: '11px', color: '#aaa' }}>{item.category}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: item.varianceCost >= 0 ? '#3B6D11' : '#E24B4A' }}>
                                {item.varianceCost >= 0 ? '+' : ''}{fmt(item.varianceCost)}
                              </div>
                              <div style={{ fontSize: '11px', color: item.variance >= 0 ? '#3B6D11' : '#E24B4A', fontWeight: '500' }}>
                                {item.variance >= 0 ? '+' : ''}{item.variance.toFixed(2)} units
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                            <div><div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', marginBottom: '1px' }}>Opening</div><div style={{ fontSize: '12px', color: '#555' }}>{item.openingQty.toFixed(2)}</div></div>
                            <div><div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', marginBottom: '1px' }}>Closing</div><div style={{ fontSize: '12px', color: '#555' }}>{item.closingQty.toFixed(2)}</div></div>
                          </div>
                        </div>
                      ))}
                      <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#000' }}>Total Variance</div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: totalVarianceCost >= 0 ? '#3B6D11' : '#E24B4A' }}>{totalVarianceCost >= 0 ? '+' : ''}{fmt(totalVarianceCost)}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>{['Item', 'Category', 'Opening', 'Closing', 'Variance', 'Value Variance'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {filteredVariance.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5', background: item.variance < -1 ? '#fff8f8' : 'transparent' }}>
                              <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{item.name}</td>
                              <td style={{ padding: '10px 14px' }}><span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{item.category}</span></td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{item.openingQty.toFixed(2)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{item.closingQty.toFixed(2)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '13px', color: item.variance >= 0 ? '#3B6D11' : '#E24B4A' }}>{item.variance >= 0 ? '+' : ''}{item.variance.toFixed(2)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '13px', color: item.varianceCost >= 0 ? '#3B6D11' : '#E24B4A' }}>{item.varianceCost >= 0 ? '+' : ''}{fmt(item.varianceCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#fafafa', borderTop: '2px solid #f0f0f0' }}>
                            <td colSpan={4} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: '#000' }}>Total</td>
                            <td />
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', fontSize: '13px', color: totalVarianceCost >= 0 ? '#3B6D11' : '#E24B4A' }}>{totalVarianceCost >= 0 ? '+' : ''}{fmt(totalVarianceCost)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                )}

                {/* Usage table / cards */}
                {activeTab === 'usage' && (
                  isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredUsage.map((item, i) => (
                        <div key={i} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ flex: 1, marginRight: '12px' }}>
                              <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{item.name}</div>
                              <div style={{ fontSize: '11px', color: '#aaa' }}>{item.category}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '14px', fontWeight: '700', color: '#F5B800' }}>{fmt(item.usageCost)}</div>
                              <div style={{ fontSize: '11px', color: '#555' }}>{item.usage.toFixed(2)} used</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                            <div><div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', marginBottom: '1px' }}>Opening</div><div style={{ fontSize: '12px', color: '#555' }}>{item.openingQty.toFixed(2)}</div></div>
                            <div><div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', marginBottom: '1px' }}>Received</div><div style={{ fontSize: '12px', color: item.received > 0 ? '#185FA5' : '#aaa', fontWeight: item.received > 0 ? '500' : '400' }}>{item.received > 0 ? '+' + item.received.toFixed(2) : '--'}</div></div>
                            <div><div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', marginBottom: '1px' }}>Closing</div><div style={{ fontSize: '12px', color: '#555' }}>{item.closingQty.toFixed(2)}</div></div>
                          </div>
                        </div>
                      ))}
                      <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#000' }}>Total Usage Cost</div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#F5B800' }}>{fmt(totalUsageCost)}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>{['Item', 'Category', 'Opening', 'Received', 'Closing', 'Usage', 'Usage Cost'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {filteredUsage.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                              <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{item.name}</td>
                              <td style={{ padding: '10px 14px' }}><span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{item.category}</span></td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{item.openingQty.toFixed(2)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#185FA5', fontSize: '12px', fontWeight: '500' }}>{item.received > 0 ? '+' + item.received.toFixed(2) : '--'}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{item.closingQty.toFixed(2)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '13px', color: '#000' }}>{item.usage.toFixed(2)}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '13px', color: '#F5B800' }}>{fmt(item.usageCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#fafafa', borderTop: '2px solid #f0f0f0' }}>
                            <td colSpan={5} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: '#000' }}>Total Usage Cost</td>
                            <td />
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', fontSize: '13px', color: '#F5B800' }}>{fmt(totalUsageCost)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}