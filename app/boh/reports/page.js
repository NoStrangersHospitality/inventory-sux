'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'

export default function BOHReports() {
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
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    { key: 'proteins', label: 'Proteins', color: '#F5B800' },
    { key: 'produce', label: 'Produce', color: '#3B6D11' },
    { key: 'dairy', label: 'Dairy', color: '#185FA5' },
    { key: 'dry_goods', label: 'Dry Goods', color: '#854F0B' },
    { key: 'dry_spices', label: 'Dry Spices', color: '#9B4DCA' },
    { key: 'oils_fats', label: 'Oils & Fats', color: '#E07B00' },
    { key: 'sauces', label: 'Sauces', color: '#c53030' },
    { key: 'misc', label: 'Misc', color: '#aaa' },
  ]

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.boh_access) { router.push('/dashboard'); return }
      await loadSessions(session.user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadSessions = async (userId) => {
    const { data } = await supabase
      .from('count_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('area', 'boh')
      .eq('status', 'submitted')
      .order('count_date', { ascending: false })
      .limit(20)
    setSessions(data || [])

    if (data && data.length >= 2) {
      setSessionA(data[0].id)
      setSessionB(data[1].id)
    }

    if (data && data.length > 1) {
      setTrendData(
        [...data].reverse().map(s => ({
          date: new Date(s.count_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: parseFloat((s.total_value || 0).toFixed(2)),
          sessionId: s.id
        }))
      )
    }
  }

  const runReport = async () => {
    if (!sessionA || !sessionB) return
    setRunningReport(true)

    const { data: { session } } = await supabase.auth.getSession()
    const userId = session.user.id

    const sessA = sessions.find(s => s.id === sessionA)
    const sessB = sessions.find(s => s.id === sessionB)

    const [later, earlier] = new Date(sessA.count_date) > new Date(sessB.count_date)
      ? [sessA, sessB]
      : [sessB, sessA]

    const [{ data: laterLines }, { data: earlierLines }] = await Promise.all([
      supabase.from('count_lines').select('inventory_item_id, item_name, category, quantity, unit_cost, par').eq('session_id', later.id),
      supabase.from('count_lines').select('inventory_item_id, quantity').eq('session_id', earlier.id),
    ])

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, invoice_lines(*)')
      .eq('user_id', userId)
      .eq('area', 'boh')
      .eq('status', 'confirmed')
      .gte('invoice_date', earlier.count_date)
      .lte('invoice_date', later.count_date)

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
      if (!laterTotals[l.inventory_item_id]) {
        laterTotals[l.inventory_item_id] = {
          name: l.item_name,
          category: l.category,
          qty: 0,
          unit_cost: l.unit_cost,
          par: l.par
        }
      }
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

      return {
        id,
        name: data.name,
        category: data.category,
        unit_cost: data.unit_cost,
        par: data.par,
        openingQty,
        closingQty,
        received,
        usage,
        usageCost,
        variance,
        varianceCost,
      }
    }).sort((a, b) => Math.abs(b.varianceCost) - Math.abs(a.varianceCost))

    setVarianceReport(report)
    setUsageReport([...report].sort((a, b) => b.usageCost - a.usageCost))

    const catSummary = CATEGORIES.map(cat => {
      const catItems = report.filter(r => r.category === cat.key)
      return {
        category: cat.label,
        opening: parseFloat(catItems.reduce((s, i) => s + (i.openingQty * i.unit_cost), 0).toFixed(2)),
        closing: parseFloat(catItems.reduce((s, i) => s + (i.closingQty * i.unit_cost), 0).toFixed(2)),
        usage: parseFloat(catItems.reduce((s, i) => s + i.usageCost, 0).toFixed(2)),
      }
    }).filter(c => c.opening > 0 || c.closing > 0)
    setCategoryTrend(catSummary)

    setRunningReport(false)
  }

  const exportCSV = () => {
    const rows = [['Item', 'Category', 'Opening Qty', 'Received', 'Closing Qty', 'Usage', 'Usage Cost', 'Variance Qty', 'Variance Value', 'Unit Cost']]
    varianceReport.forEach(r => {
      rows.push([r.name, r.category, r.openingQty.toFixed(2), r.received.toFixed(2), r.closingQty.toFixed(2), r.usage.toFixed(2), r.usageCost.toFixed(2), r.variance.toFixed(2), r.varianceCost.toFixed(2), r.unit_cost.toFixed(2)])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const sessA = sessions.find(s => s.id === sessionA)
    const sessB = sessions.find(s => s.id === sessionB)
    a.download = `boh_report_${sessB?.count_date}_to_${sessA?.count_date}.csv`
    a.click()
  }

  const fmt = (n) => '$' + Number(n).toFixed(2)
  const fmtK = (n) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : fmt(n)

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
          <div style={{ fontWeight: '600', color: '#000', marginBottom: '4px' }}>{label}</div>
          {payload.map((p, i) => (
            <div key={i} style={{ color: p.color, fontWeight: '600' }}>{p.name}: {fmt(p.value)}</div>
          ))}
        </div>
      )
    }
    return null
  }

  const filteredVariance = filterCategory === 'all'
    ? varianceReport
    : varianceReport.filter(r => r.category === filterCategory)

  const filteredUsage = filterCategory === 'all'
    ? usageReport
    : usageReport.filter(r => r.category === filterCategory)

  const sessAObj = sessions.find(s => s.id === sessionA)
  const sessBObj = sessions.find(s => s.id === sessionB)
  const [later, earlier] = sessAObj && sessBObj
    ? new Date(sessAObj.count_date) > new Date(sessBObj.count_date)
      ? [sessAObj, sessBObj]
      : [sessBObj, sessAObj]
    : [null, null]

  const totalVarianceCost = varianceReport.reduce((s, r) => s + r.varianceCost, 0)
  const totalUsageCost = varianceReport.reduce((s, r) => s + r.usageCost, 0)
  const shrinkageItems = varianceReport.filter(r => r.variance < 0)
  const shrinkageCost = shrinkageItems.reduce((s, r) => s + Math.abs(r.varianceCost), 0)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => router.push('/boh')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← BOH</button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>BOH Reports</h1>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Variance, usage, and inventory trends across count periods.</p>
          </div>
          {varianceReport.length > 0 && (
            <button onClick={exportCSV} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              ↓ Export CSV
            </button>
          )}
        </div>

        {sessions.length < 2 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>Need at least two counts</div>
            <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '20px' }}>Run your first two BOH inventory counts to unlock variance and usage reports.</div>
            <button onClick={() => router.push('/boh/inventory/count')} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              Start a Count →
            </button>
          </div>
        ) : (
          <>
            {/* Trend chart */}
            {trendData.length >= 2 && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '16px' }}>Inventory Value Over Time</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => '$' + v} tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} width={56} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="#F5B800" strokeWidth={2.5} dot={{ fill: '#F5B800', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: '#F5B800' }} name="Value" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Session selector */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '14px' }}>Select Count Period</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From Count</label>
                  <select
                    value={sessionB || ''}
                    onChange={e => setSessionB(e.target.value)}
                    style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000' }}>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.count_date} {s.counted_by ? `· ${s.counted_by}` : ''} {s.total_value ? `· ${fmtK(s.total_value)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To Count</label>
                  <select
                    value={sessionA || ''}
                    onChange={e => setSessionA(e.target.value)}
                    style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000' }}>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.count_date} {s.counted_by ? `· ${s.counted_by}` : ''} {s.total_value ? `· ${fmtK(s.total_value)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={runReport} disabled={runningReport || !sessionA || !sessionB || sessionA === sessionB}
                  style={{ background: runningReport ? '#ccc' : '#333', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: runningReport ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {runningReport ? 'Running...' : 'Run Report'}
                </button>
              </div>
            </div>

            {/* Report results */}
            {varianceReport.length > 0 && (
              <>
                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Period', val: `${earlier?.count_date} → ${later?.count_date}`, sub: 'count period', color: '#000', small: true },
                    { label: 'Total Usage Cost', val: fmtK(totalUsageCost), sub: 'product consumed', color: '#000' },
                    { label: 'Invoices Received', val: fmtK(invoiceTotal), sub: 'cost of goods in', color: '#185FA5' },
                    { label: 'Shrinkage / Waste', val: fmtK(shrinkageCost), sub: `${shrinkageItems.length} items`, color: shrinkageCost > 0 ? '#E24B4A' : '#3B6D11' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px 20px' }}>
                      <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{s.label}</div>
                      <div style={{ fontSize: s.small ? '14px' : '22px', fontWeight: '700', color: s.color, marginBottom: '3px', lineHeight: s.small ? '1.3' : '1' }}>{s.val}</div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Category breakdown chart */}
                {categoryTrend.length > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#000', marginBottom: '16px' }}>Opening vs Closing Value by Category</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={categoryTrend} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                        <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => '$' + v} tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} width={56} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f5f3' }} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <Bar dataKey="opening" name="Opening" fill="#e8e8e8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="closing" name="Closing" fill="#F5B800" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="usage" name="Usage Cost" fill="#333" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tabs + filter */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { key: 'variance', label: 'Variance' },
                      { key: 'usage', label: 'Usage' },
                    ].map(t => (
                      <button key={t.key} onClick={() => setActiveTab(t.key)}
                        style={{ padding: '7px 16px', border: '1px solid', borderColor: activeTab === t.key ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: activeTab === t.key ? '700' : '400', cursor: 'pointer', background: activeTab === t.key ? '#F5B800' : '#fff', color: activeTab === t.key ? '#000' : '#666' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={() => setFilterCategory('all')}
                      style={{ padding: '5px 12px', border: '1px solid', borderColor: filterCategory === 'all' ? '#333' : '#e8e8e8', borderRadius: '20px', fontSize: '11px', fontWeight: filterCategory === 'all' ? '600' : '400', cursor: 'pointer', background: filterCategory === 'all' ? '#333' : '#fff', color: filterCategory === 'all' ? '#fff' : '#666' }}>
                      All
                    </button>
                    {CATEGORIES.map(c => (
                      <button key={c.key} onClick={() => setFilterCategory(c.key)}
                        style={{ padding: '5px 12px', border: '1px solid', borderColor: filterCategory === c.key ? '#333' : '#e8e8e8', borderRadius: '20px', fontSize: '11px', fontWeight: filterCategory === c.key ? '600' : '400', cursor: 'pointer', background: filterCategory === c.key ? '#333' : '#fff', color: filterCategory === c.key ? '#fff' : '#666' }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variance table */}
                {activeTab === 'variance' && (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Item', 'Category', 'Opening', 'Closing', 'Variance', 'Value Variance'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVariance.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f5f5f5', background: item.variance < -1 ? '#fff8f8' : 'transparent' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{item.name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{item.category}</span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{item.openingQty.toFixed(2)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#555', fontSize: '12px' }}>{item.closingQty.toFixed(2)}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '13px', color: item.variance >= 0 ? '#3B6D11' : '#E24B4A' }}>
                              {item.variance >= 0 ? '+' : ''}{item.variance.toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', fontSize: '13px', color: item.varianceCost >= 0 ? '#3B6D11' : '#E24B4A' }}>
                              {item.varianceCost >= 0 ? '+' : ''}{fmt(item.varianceCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#fafafa', borderTop: '2px solid #f0f0f0' }}>
                          <td colSpan={4} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: '#000' }}>Total</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }} />
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', fontSize: '13px', color: totalVarianceCost >= 0 ? '#3B6D11' : '#E24B4A' }}>
                            {totalVarianceCost >= 0 ? '+' : ''}{fmt(totalVarianceCost)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Usage table */}
                {activeTab === 'usage' && (
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Item', 'Category', 'Opening', 'Received', 'Closing', 'Usage', 'Usage Cost'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsage.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{item.name}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e8', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{item.category}</span>
                            </td>
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
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}