'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function BOHOrder() {
  const [items, setItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('select')
  const [selectedCats, setSelectedCats] = useState(new Set(['proteins', 'produce', 'dairy', 'dry_goods', 'dry_spices', 'oils_fats', 'sauces', 'misc']))
  const [orderRows, setOrderRows] = useState({})
  const [recapRows, setRecapRows] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    { key: 'proteins', label: 'Proteins', icon: '🥩' },
    { key: 'produce', label: 'Produce', icon: '🥦' },
    { key: 'dairy', label: 'Dairy', icon: '🧀' },
    { key: 'dry_goods', label: 'Dry Goods', icon: '🌾' },
    { key: 'dry_spices', label: 'Dry Spices', icon: '🧂' },
    { key: 'oils_fats', label: 'Oils & Fats', icon: '🫙' },
    { key: 'sauces', label: 'Sauces', icon: '🥫' },
    { key: 'misc', label: 'Misc', icon: '📦' },
  ]

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.boh_access) { router.push('/dashboard'); return }
      const [{ data: itemData }, { data: vendorData }] = await Promise.all([
        supabase.from('inventory_items')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('area', 'boh')
          .eq('on_menu', true)
          .order('name'),
        supabase.from('vendors').select('*').eq('user_id', session.user.id).order('name')
      ])
      setItems(itemData || [])
      setVendors(vendorData || [])
      setLoading(false)
    }
    init()
  }, [])

  const toggleCat = (cat) => {
    setSelectedCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const buildOrderSheet = () => {
    const allItems = []
    CATEGORIES.filter(c => selectedCats.has(c.key)).forEach(c => {
      items.filter(i => i.category === c.key).forEach(item => {
        allItems.push({ ...item, catLabel: c.label })
      })
    })
    if (!allItems.length) { alert('No items in selected categories.'); return }

    const byVendor = {}
    allItems.forEach(item => {
      const vendor = vendors.find(v => v.id === item.distributor_id)
      const key = vendor ? vendor.name : 'Unassigned'
      if (!byVendor[key]) byVendor[key] = []
      byVendor[key].push({
        ...item,
        vendorName: key,
        vendorObj: vendor,
        on_hand_count: 0,
        suggested: Math.max(0, Math.ceil(item.par || 0))
      })
    })
    setOrderRows(byVendor)
    setStep('sheet')
  }

  const updateRow = (vendorName, idx, field, val) => {
    setOrderRows(prev => {
      const next = { ...prev }
      const rows = [...next[vendorName]]
      rows[idx] = { ...rows[idx], [field]: val }
      const row = rows[idx]
      const par = field === 'par' ? val : (row.par || 0)
      const onHand = field === 'on_hand_count' ? val : (row.on_hand_count || 0)
      rows[idx].suggested = Math.max(0, Math.ceil(par - onHand))
      next[vendorName] = rows
      return next
    })
  }

  const buildRecap = () => {
    const rd = {}
    Object.keys(orderRows).forEach(vn => {
      const needed = orderRows[vn].filter(r => r.suggested > 0)
      if (needed.length) rd[vn] = needed.map(r => ({
        ...r,
        overrideQty: r.suggested,
        finalQty: r.suggested
      }))
    })
    if (!Object.keys(rd).length) { alert('No items need ordering.'); return }
    setRecapRows(rd)
    setStep('recap')
  }

  const updateRecapQty = (vendorName, idx, qty) => {
    setRecapRows(prev => {
      const next = { ...prev }
      const rows = [...next[vendorName]]
      rows[idx] = { ...rows[idx], overrideQty: qty, finalQty: qty }
      next[vendorName] = rows
      return next
    })
  }

  const submitOrder = async () => {
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, bar_name')
      .eq('id', session.user.id)
      .single()

    const managerName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
    const barName = profile?.bar_name || 'Your Bar'
    const orderDate = new Date().toLocaleDateString()

    const { data: order } = await supabase.from('orders').insert({
      user_id: session.user.id,
      status: 'submitted',
      area: 'boh',
      submitted_at: new Date().toISOString()
    }).select().single()

    const lines = []
    Object.keys(recapRows).forEach(vn => {
      recapRows[vn].forEach(row => {
        lines.push({
          order_id: order.id,
          user_id: session.user.id,
          item_id: row.id,
          item_name: row.name,
          distributor_id: row.distributor_id || null,
          distributor_name: vn,
          par: row.par || 0,
          shelf_count: row.on_hand_count || 0,
          well_count: 0,
          suggested_qty: row.suggested,
          final_qty: row.finalQty
        })
      })
    })

    console.log('BOH Lines to insert:', JSON.stringify(lines))
const { data: insertedLines, error: linesError } = await supabase.from('order_lines').insert(lines).select()
console.log('BOH Inserted lines:', insertedLines)
console.log('BOH Lines error:', linesError)

    const vendorGroups = {}
    lines.forEach(line => {
      if (!vendorGroups[line.distributor_name]) {
        vendorGroups[line.distributor_name] = {
          name: line.distributor_name,
          id: line.distributor_id,
          lines: []
        }
      }
      vendorGroups[line.distributor_name].lines.push(line)
    })

    const distIds = [...new Set(lines.map(l => l.distributor_id).filter(Boolean))]
    const { data: distContacts } = await supabase
      .from('vendors')
      .select('id, name, email, phone, order_method')
      .in('id', distIds)

      console.log('distIds:', distIds)
console.log('distContacts:', distContacts)

    for (const [vendorName, group] of Object.entries(vendorGroups)) {
      const contact = distContacts?.find(d => d.id === group.id)
      if (!contact) continue

      const orderLines = group.lines.filter(l => l.final_qty > 0)
      if (orderLines.length === 0) continue

      if (contact.email && (contact.order_method?.toLowerCase() === 'email' || contact.order_method?.toLowerCase() === 'both')) {
        try {
          await fetch('/api/email/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              distributorName: contact.name,
              distributorEmail: contact.email,
              barName,
              managerName,
              orderLines,
              orderId: order.id,
              orderDate
            })
          })
        } catch (err) {
          console.error('Order email failed for', contact.name, err)
        }
      }

      if (contact.phone && (contact.order_method?.toLowerCase() === 'sms' || contact.order_method?.toLowerCase() === 'both')) {
        try {
          await fetch('/api/sms/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              distributorPhone: contact.phone,
              distributorName: contact.name,
              barName,
              managerName,
              orderLines,
              orderId: order.id,
              orderDate
            })
          })
        } catch (err) {
          console.error('Order SMS failed for', contact.name, err)
        }
      }
    }

    // Generate order PDF and send confirmation email
    try {
      const distGroupsForPDF = Object.entries(vendorGroups).map(([name, group]) => {
        const contact = distContacts?.find(d => d.id === group.id)
        return {
          name,
          email: contact?.email || null,
          lines: group.lines.filter(l => l.final_qty > 0)
        }
      }).filter(g => g.lines.length > 0)

      const totalItems = distGroupsForPDF.reduce((sum, g) => sum + g.lines.length, 0)

      const pdfRes = await fetch('/api/orders/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          userId: session.user.id,
          barName,
          managerName,
          orderDate,
          distributorGroups: distGroupsForPDF,
          totalItems
        })
      })

      const pdfData = await pdfRes.json()
      console.log('PDF generation response:', pdfData)

      if (pdfData.pdfUrl) {
        const confirmRes = await fetch('/api/email/order-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session.user.email,
            barName,
            managerName,
            orderDate,
            orderId: order.id,
            pdfUrl: pdfData.pdfUrl,
            distributorGroups: distGroupsForPDF,
            totalItems
          })
        })
        const confirmData = await confirmRes.json()
        console.log('Confirmation email response:', confirmData)
      }
    } catch (err) {
      console.error('PDF/email confirmation error:', err)
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  const btnStyle = { background: '#F5B800', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '16px', padding: '48px', textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontSize: '52px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '8px' }}>Order submitted!</h2>
        <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '28px' }}>Your BOH order has been saved. SMS and email sends will be live once Twilio and SendGrid are connected.</p>
        <button onClick={() => router.push('/boh/ordering')} style={btnStyle}>← Back to BOH Ordering</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => step === 'select' ? router.push('/boh/ordering') : setStep(step === 'recap' ? 'sheet' : 'select')}
          style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {step === 'select' ? 'BOH Ordering' : step === 'sheet' ? 'Categories' : 'Order Sheet'}
        </button>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* STEP 1 — Category Select */}
        {step === 'select' && (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>Build BOH Order</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '24px' }}>Select which categories to include.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
              {CATEGORIES.map(c => {
                const count = items.filter(i => i.category === c.key).length
                const selected = selectedCats.has(c.key)
                return (
                  <div key={c.key} onClick={() => toggleCat(c.key)}
                    style={{ background: '#fff', border: `2px solid ${selected ? '#F5B800' : '#e8e8e8'}`, borderRadius: '12px', padding: '16px 8px', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s', boxShadow: selected ? '0 2px 12px rgba(245,184,0,.12)' : 'none' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>{c.icon}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#000', marginBottom: '2px' }}>{c.label}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{count} item{count !== 1 ? 's' : ''}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={buildOrderSheet} style={btnStyle}>Build Order Sheet →</button>
            </div>
          </>
        )}

        {/* STEP 2 — Order Sheet */}
        {step === 'sheet' && (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>BOH Order Sheet</h1>
            <div style={{ background: '#fffbe6', border: '1px solid #f0d060', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#a07800' }}>
              💡 On Hand defaults to zero. Enter what you actually have on hand right now — suggested qty will calculate automatically.
            </div>
            {Object.keys(orderRows).map(vn => {
              const vendor = vendors.find(v => v.name === vn)
              return (
                <div key={vn} style={{ marginBottom: '28px' }}>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px 10px 0 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>🚚</span>
                    <span style={{ fontWeight: '500', color: '#000', fontSize: '14px' }}>{vn}</span>
                    {vendor?.order_method && <span style={{ marginLeft: 'auto', background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{vendor.order_method}</span>}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          {['Item', 'Category', 'Unit', 'Par', 'On Hand', 'Suggested'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 2 ? 'center' : 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orderRows[vn].map((row, ri) => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                            <td style={{ padding: '8px 10px', fontSize: '12px' }}>
                              <div style={{ fontWeight: '500', color: '#000' }}>{row.name}</div>
                              {row.notes && <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>{row.notes}</div>}
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '11px', color: '#888' }}>{row.catLabel}</td>
                            <td style={{ padding: '8px 10px', fontSize: '11px', color: '#888' }}>{row.unit || '--'}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <input type="number" min="0" step="0.01" defaultValue={row.par || 0}
                                onChange={e => updateRow(vn, ri, 'par', parseFloat(e.target.value) || 0)}
                                style={{ width: '60px', textAlign: 'center', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '4px', fontSize: '12px', background: '#fafafa' }} />
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <input type="number" min="0" step="0.01" value={row.on_hand_count}
                                onChange={e => updateRow(vn, ri, 'on_hand_count', parseFloat(e.target.value) || 0)}
                                style={{ width: '60px', textAlign: 'center', border: '1px solid #F5B800', borderRadius: '6px', padding: '4px', fontSize: '12px', background: '#fffbe6', fontWeight: '500' }} />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: row.suggested > 0 ? '#3B6D11' : '#ccc', fontSize: '12px' }}>{row.suggested}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={buildRecap} style={btnStyle}>Review Order →</button>
            </div>
          </>
        )}

        {/* STEP 3 — Recap */}
        {step === 'recap' && (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000', marginBottom: '6px' }}>BOH Order Recap</h1>
            <p style={{ color: '#999', fontSize: '13px', marginBottom: '20px' }}>Adjust quantities if needed, then submit.</p>
            {Object.keys(recapRows).map(vn => {
              const vendor = vendors.find(v => v.name === vn)
              return (
                <div key={vn} style={{ marginBottom: '24px' }}>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px 10px 0 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>🚚</span>
                    <span style={{ fontWeight: '500', color: '#000', fontSize: '14px' }}>{vn}</span>
                    {vendor?.order_method && <span style={{ marginLeft: 'auto', background: '#fffbe6', color: '#a07800', border: '1px solid #f0d060', borderRadius: '10px', fontSize: '11px', padding: '2px 8px' }}>{vendor.order_method}</span>}
                    {vendor?.email && <span style={{ fontSize: '11px', color: '#aaa' }}>{vendor.email}</span>}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          {['Item', 'Unit', 'On Hand', 'Par', 'Suggested', 'Order Qty', 'Final'].map((h, i) => (
                            <th key={i} style={{ textAlign: i > 1 ? 'center' : 'left', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recapRows[vn].map((row, ri) => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                            <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                              <div style={{ fontWeight: '500', color: '#000' }}>{row.name}</div>
                              {row.notes && <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>{row.notes}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#888', fontSize: '12px', textAlign: 'center' }}>{row.unit || '--'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#555', fontSize: '12px' }}>{Number(row.on_hand_count || 0).toFixed(2)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#555', fontSize: '12px' }}>{row.par || 0}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#3B6D11', fontWeight: '600' }}>{row.suggested}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <input type="number" min="0" step="0.01" value={row.overrideQty}
                                onChange={e => updateRecapQty(vn, ri, parseFloat(e.target.value) || 0)}
                                style={{ width: '70px', textAlign: 'center', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '5px', fontSize: '13px', background: '#fafafa' }} />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#3B6D11', fontSize: '13px' }}>{row.finalQty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={submitOrder} disabled={submitting}
                style={{ ...btnStyle, background: submitting ? '#ccc' : '#333', color: '#fff', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Submitting...' : '✉️ Submit Order'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}