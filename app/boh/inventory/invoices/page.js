'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useRole } from '@/hooks/useRole'

export default function BOHInvoices() {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approvingId, setApprovingId] = useState(null)
  const [inventoryItems, setInventoryItems] = useState([])
  const [view, setView] = useState('hub')
  const [isMobile, setIsMobile] = useState(false)
  const [ownerIdResolved, setOwnerIdResolved] = useState(null)
  const fileRef = useRef()
  const router = useRouter()
  const { ownerId } = useRole()
  const initRan = useRef(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const BOH_CATEGORIES = [
    { key: 'proteins', label: 'Proteins' },
    { key: 'produce', label: 'Produce' },
    { key: 'dairy', label: 'Dairy' },
    { key: 'dry_goods', label: 'Dry Goods' },
    { key: 'dry_spices', label: 'Dry Spices' },
    { key: 'oils_fats', label: 'Oils & Fats' },
    { key: 'sauces', label: 'Sauces' },
    { key: 'misc', label: 'Misc' },
  ]

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!ownerId) return
    if (initRan.current) return
    initRan.current = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.boh_access && !prof?.owner_user_id) { router.push('/dashboard'); return }
      const ownerIdToUse = ownerId || session.user.id
      setOwnerIdResolved(ownerIdToUse)
      await loadData(ownerIdToUse)
      setLoading(false)
    }
    init()
  }, [ownerId])

  const loadData = async (ownerIdToUse) => {
    const [{ data: invs }, { data: items }] = await Promise.all([
      supabase.from('invoices').select('*').eq('user_id', ownerIdToUse).eq('area', 'boh').order('created_at', { ascending: false }).limit(20),
      supabase.from('inventory_items').select('*').eq('user_id', ownerIdToUse).eq('area', 'boh').order('name')
    ])
    setInvoices(invs || [])
    setInventoryItems(items || [])
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setScanning(true)
    setScanResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
const ownerIdToUse = ownerId || session.user.id
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', ownerIdToUse)
      formData.append('area', 'boh')
      const res = await fetch('/api/scan-invoice', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) { alert('Scan failed: ' + data.error); setScanning(false); return }
      const fileName = `${ownerIdToUse}/${Date.now()}_${file.name}`
      await supabase.storage.from('invoices').upload(fileName, file)
      const { data: invoice } = await supabase.from('invoices').insert({
        user_id: ownerIdToUse, vendor: data.vendor, invoice_number: data.invoice_number,
        invoice_date: data.invoice_date, total_amount: data.total_amount, status: 'processed',
        file_url: fileName, raw_text: JSON.stringify(data.line_items), area: 'boh'
      }).select().single()
      setScanResult({ ...data, invoice_id: invoice.id })
      setView('review')
    } catch (err) {
      alert('Error scanning invoice: ' + err.message)
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const updateLineMatch = (idx, itemId) => {
    const item = inventoryItems.find(i => i.id === itemId)
    setScanResult(prev => ({
      ...prev,
      line_items: prev.line_items.map((l, i) => i === idx ? {
        ...l,
        matched_item_id: itemId === '__create__' ? '__create__' : (itemId || null),
        matched_item_name: itemId === '__create__' ? l.raw_name : (item?.name || null),
        match_status: itemId === '__create__' ? 'create_new' : (itemId ? 'matched' : 'unmatched')
      } : l)
    }))
  }

  const updateLineQty = (idx, qty) => {
    setScanResult(prev => ({ ...prev, line_items: prev.line_items.map((l, i) => i === idx ? { ...l, qty } : l) }))
  }

  // Step 1: Save invoice lines — no inventory writes
  const saveInvoice = async () => {
    if (!scanResult) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
const ownerIdToUse = ownerId || session.user.id

    const linesToSave = (scanResult.line_items || []).map(line => ({
      invoice_id: scanResult.invoice_id,
      user_id: ownerIdToUse,
      raw_name: line.raw_name,
      matched_item_id: line.matched_item_id === '__create__' ? null : (line.matched_item_id || null),
      qty: parseFloat(line.qty) || 0,
      unit_cost: parseFloat(line.unit_cost) || 0,
      total_cost: parseFloat(line.total_cost) || 0,
      match_confidence: line.match_confidence || 0,
      match_status: line.match_status || 'unmatched',
      new_category: line.new_category || null,
      case_size: line.case_size || 1,
      is_create_new: line.matched_item_id === '__create__',
    }))

    await supabase.from('invoice_lines').delete().eq('invoice_id', scanResult.invoice_id)
await supabase.from('invoice_lines').insert(linesToSave)
    await supabase.from('invoices').update({ status: 'processed' }).eq('id', scanResult.invoice_id)

    await loadData(ownerIdToUse)
    setScanResult(null)
    setSaving(false)
    setView('hub')
  }

  // Step 2: Approve — read saved lines and write to inventory
  const approveInvoice = async (invoiceId) => {
    setApproving(true)
    setApprovingId(invoiceId)
    const { data: { session } } = await supabase.auth.getSession()
const ownerIdToUse = ownerId || session.user.id

    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    const { data: lines } = await supabase.from('invoice_lines').select('*').eq('invoice_id', invoiceId)

    if (!lines || lines.length === 0) {
      alert('No saved lines found for this invoice.')
      setApproving(false)
      setApprovingId(null)
      return
    }

    const { data: freshItems } = await supabase.from('inventory_items').select('*').eq('user_id', ownerIdToUse).eq('area', 'boh')
    const itemsMap = {}
    ;(freshItems || []).forEach(i => { itemsMap[i.id] = i })

    for (const line of lines) {
      if (line.is_create_new) {
        const unitCost = line.case_size > 1 ? (parseFloat(line.unit_cost) || 0) / (line.case_size || 1) : (parseFloat(line.unit_cost) || 0)
        const qtyOnHand = (parseFloat(line.qty) || 0) * (line.case_size || 1)
        const { data: newItem } = await supabase.from('inventory_items').insert({
          user_id: ownerIdToUse, name: line.raw_name, category: line.new_category || 'misc',
          item_type: 'unit', on_hand: qtyOnHand, unit: line.unit || 'unit',
          unit_cost: unitCost, par: 0, on_menu: false, area: 'boh',
          last_invoice_date: invoice?.invoice_date || new Date().toISOString().split('T')[0]
        }).select().single()
        if (!newItem) continue
        await supabase.from('invoice_lines').update({ matched_item_id: newItem.id, match_status: 'matched' }).eq('id', line.id)
        await supabase.from('inventory_history').insert({
          user_id: ownerIdToUse, inventory_item_id: newItem.id, item_name: newItem.name,
          category: newItem.category, area: 'boh', event_type: 'invoice', event_id: invoiceId,
          quantity_before: 0, quantity_change: qtyOnHand, quantity_after: qtyOnHand,
          unit_cost_at_time: unitCost, total_value_at_time: qtyOnHand * unitCost
        })
        await supabase.from('item_aliases').upsert({ user_id: ownerIdToUse, raw_name: line.raw_name.toLowerCase(), inventory_item_id: newItem.id, source: 'auto' }, { onConflict: 'user_id,raw_name' })
      } else if (line.matched_item_id) {
        const invItem = itemsMap[line.matched_item_id]
        if (!invItem) continue
        const qtyChange = (parseFloat(line.qty) || 0) * (line.case_size || 1)
        const newOnHand = (parseFloat(invItem.on_hand) || 0) + qtyChange
        const newUnitCost = line.unit_cost
          ? (line.case_size > 1 ? (parseFloat(line.unit_cost) || 0) / (line.case_size || 1) : parseFloat(line.unit_cost))
          : invItem.unit_cost
        await supabase.from('inventory_items').update({
          on_hand: newOnHand, unit_cost: newUnitCost,
          last_invoice_date: invoice?.invoice_date || new Date().toISOString().split('T')[0]
        }).eq('id', invItem.id)
        await supabase.from('inventory_history').insert({
          user_id: ownerIdToUse, inventory_item_id: invItem.id, item_name: invItem.name,
          category: invItem.category, area: 'boh', event_type: 'invoice', event_id: invoiceId,
          quantity_before: parseFloat(invItem.on_hand) || 0, quantity_change: qtyChange,
          quantity_after: newOnHand, unit_cost_at_time: newUnitCost, total_value_at_time: newOnHand * newUnitCost
        })
        if (line.raw_name) {
          await supabase.from('item_aliases').upsert({ user_id: ownerIdToUse, raw_name: line.raw_name.toLowerCase(), inventory_item_id: invItem.id, source: 'manual' }, { onConflict: 'user_id,raw_name' })
        }
      }
    }

    await supabase.from('invoices').update({ status: 'confirmed' }).eq('id', invoiceId)
    await loadData(ownerIdToUse)
    setApproving(false)
    setApprovingId(null)
  }

  const fmt = (n) => '$' + Number(n || 0).toFixed(2)

  const statusColor = (s) => {
    if (s === 'confirmed') return { bg: '#EAF3DE', color: '#27500A', border: '#97C459' }
    if (s === 'processed') return { bg: '#FAEEDA', color: '#854F0B', border: '#f0c080' }
    return { bg: '#f5f5f3', color: '#aaa', border: '#e8e8e8' }
  }

  const matchColor = (s) => {
    if (s === 'matched') return '#3B6D11'
    if (s === 'create_new') return '#185FA5'
    if (s === 'low_confidence') return '#e07b00'
    return '#E24B4A'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: isMobile ? '10px 16px' : '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <button onClick={() => view === 'hub' ? router.push('/boh/inventory') : setView('hub')}
          style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
          ← {view === 'hub' ? 'Inventory' : 'Back'}
        </button>
      </div>

      <div style={{ padding: isMobile ? '16px' : '28px 24px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* HUB */}
        {view === 'hub' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>BOH Invoice Scanning</h1>
                {!isMobile && <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>Scan a vendor invoice, review the lines, then approve to update kitchen inventory.</p>}
              </div>
              <label style={{ background: '#333', color: '#fff', border: 'none', padding: isMobile ? '8px 12px' : '10px 20px', borderRadius: '8px', fontSize: isMobile ? '12px' : '13px', fontWeight: '600', cursor: scanning ? 'not-allowed' : 'pointer', display: 'inline-block', opacity: scanning ? 0.7 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {scanning ? '⏳ Scanning...' : '📄 Scan Invoice'}
                <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display: 'none' }} disabled={scanning} />
              </label>
            </div>

            <div style={{ background: '#f0f8ff', border: '1px solid #b5d4f4', borderRadius: '10px', padding: isMobile ? '14px' : '16px 20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#185FA5', marginBottom: '10px' }}>How it works</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '12px' }}>
                {[
                  { step: '1', label: 'Upload', desc: 'Photo or PDF of your vendor invoice' },
                  { step: '2', label: 'Scan', desc: 'Claude reads every line item automatically' },
                  { step: '3', label: 'Review', desc: 'Match items and save — no inventory changes yet' },
                  { step: '4', label: 'Approve', desc: 'Hit Approve to update on hand quantities' },
                ].map(s => (
                  <div key={s.step} style={{ textAlign: 'center' }}>
                    <div style={{ width: '28px', height: '28px', background: '#185FA5', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', margin: '0 auto 6px' }}>{s.step}</div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#185FA5', marginBottom: '2px' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: '#5a9fd4' }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '12px' }}>Invoice History</div>
            {invoices.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
                No invoices scanned yet. Upload your first vendor invoice above.
              </div>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {invoices.map(inv => {
                  const sc = statusColor(inv.status)
                  return (
                    <div key={inv.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1, marginRight: '12px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#000', marginBottom: '2px' }}>{inv.vendor || '--'}</div>
                          <div style={{ fontSize: '12px', color: '#aaa' }}>
                            {inv.invoice_date || '--'}{inv.invoice_number ? ` · #${inv.invoice_number}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px', fontWeight: '500' }}>{inv.status}</span>
                          {inv.total_amount && <div style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{fmt(inv.total_amount)}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        {inv.file_url && (
                          <button onClick={async () => {
                            const filePath = inv.file_url.startsWith('http') ? inv.file_url.split('/invoices/')[1]?.split('?')[0] : inv.file_url
                            const { data } = await supabase.storage.from('invoices').createSignedUrl(filePath, 3600)
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                          }} style={{ background: 'none', border: '1px solid #e8e8e8', color: '#aaa', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                            View File
                          </button>
                        )}
                        {inv.status === 'processed' && (
                          <button onClick={() => approveInvoice(inv.id)} disabled={approving && approvingId === inv.id}
                            style={{ flex: 1, background: approving && approvingId === inv.id ? '#ccc' : '#3B6D11', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                            {approving && approvingId === inv.id ? 'Approving...' : '✓ Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Vendor', 'Invoice #', 'Date', 'Total', 'Status', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => {
                      const sc = statusColor(inv.status)
                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '12px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{inv.vendor || '--'}</td>
                          <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{inv.invoice_number || '--'}</td>
                          <td style={{ padding: '12px 14px', color: '#555', fontSize: '13px' }}>{inv.invoice_date || '--'}</td>
                          <td style={{ padding: '12px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{inv.total_amount ? fmt(inv.total_amount) : '--'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: '10px', fontSize: '11px', padding: '2px 8px', fontWeight: '500' }}>{inv.status}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {inv.file_url && (
                                <button onClick={async () => {
                                  const filePath = inv.file_url.startsWith('http') ? inv.file_url.split('/invoices/')[1]?.split('?')[0] : inv.file_url
                                  const { data } = await supabase.storage.from('invoices').createSignedUrl(filePath, 3600)
                                  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                                }} style={{ background: 'none', border: '1px solid #e8e8e8', color: '#aaa', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                  View
                                </button>
                              )}
                              {inv.status === 'processed' && (
                                <button onClick={() => approveInvoice(inv.id)} disabled={approving && approvingId === inv.id}
                                  style={{ background: approving && approvingId === inv.id ? '#ccc' : '#3B6D11', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                  {approving && approvingId === inv.id ? 'Approving...' : '✓ Approve'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* REVIEW */}
        {view === 'review' && scanResult && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '500', color: '#000' }}>Review BOH Invoice</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>
                  {scanResult.vendor && <strong>{scanResult.vendor}</strong>}
                  {scanResult.invoice_date && ` · ${scanResult.invoice_date}`}
                  {scanResult.total_amount && ` · ${fmt(scanResult.total_amount)}`}
                </p>
              </div>
              {!isMobile && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => { setScanResult(null); setView('hub') }} style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveInvoice} disabled={saving}
                    style={{ background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Saving...' : '💾 Save for Approval'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ background: '#fffbe6', border: '1px solid #f0d060', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#a07800' }}>
              💡 Review and match items below, then hit <strong>Save for Approval</strong>. Inventory won't update until you hit <strong>Approve</strong> on the hub.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Line Items', val: scanResult.line_items?.length || 0 },
                { label: 'Matched', val: scanResult.line_items?.filter(l => l.match_status === 'matched' || l.match_status === 'low_confidence').length || 0, color: '#3B6D11' },
                { label: 'Create New', val: scanResult.line_items?.filter(l => l.match_status === 'create_new').length || 0, color: '#185FA5' },
                { label: 'Unmatched', val: scanResult.line_items?.filter(l => l.match_status === 'unmatched').length || 0, color: '#E24B4A' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '10px', padding: isMobile ? '12px 10px' : '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: s.color || '#000' }}>{s.val}</div>
                </div>
              ))}
            </div>

            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(scanResult.line_items || []).map((line, idx) => (
                  <div key={idx} style={{ background: line.match_status === 'create_new' ? '#f0f8ff' : line.match_status === 'matched' ? '#f9fff5' : '#fff', border: `1px solid ${line.match_status === 'create_new' ? '#b5d4f4' : line.match_status === 'matched' ? '#97C459' : '#e8e8e8'}`, borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>{line.raw_name}</div>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: matchColor(line.match_status), flexShrink: 0, marginLeft: '8px' }}>
                        {line.match_status === 'matched' ? '✓' : line.match_status === 'create_new' ? '+ New' : line.match_status === 'low_confidence' ? '⚠' : '✗'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Qty</div>
                        <input type="number" step="0.01" min="0" value={line.qty || ''} onChange={e => updateLineQty(idx, e.target.value)}
                          style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '6px 8px', fontSize: '16px', color: '#000', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Unit Cost</div>
                        <div style={{ fontSize: '13px', color: '#555', paddingTop: '6px' }}>{line.unit_cost ? fmt(line.unit_cost) : '--'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px', textTransform: 'uppercase' }}>Total</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', paddingTop: '6px' }}>{line.total_cost ? fmt(line.total_cost) : '--'}</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase' }}>Match to BOH Inventory</div>
                      <select value={line.matched_item_id || ''} onChange={e => updateLineMatch(idx, e.target.value || null)}
                        style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '8px', fontSize: '16px', color: '#000', marginBottom: '6px' }}>
                        <option value="">-- No match --</option>
                        <option value="__create__">+ Create new item</option>
                        {inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      {line.match_status === 'create_new' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <select value={line.new_category || 'misc'} onChange={e => setScanResult(prev => ({ ...prev, line_items: prev.line_items.map((l, i) => i === idx ? { ...l, new_category: e.target.value } : l) }))}
                            style={{ width: '100%', background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: '6px', padding: '8px', fontSize: '16px', color: '#0C447C' }}>
                            {BOH_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="number" min="1" placeholder="Case size" value={line.case_size || ''}
                              onChange={e => setScanResult(prev => ({ ...prev, line_items: prev.line_items.map((l, i) => i === idx ? { ...l, case_size: parseInt(e.target.value) || 1 } : l) }))}
                              style={{ flex: 1, background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: '6px', padding: '8px', fontSize: '16px', color: '#0C447C', boxSizing: 'border-box' }} />
                            <span style={{ fontSize: '11px', color: '#5a9fd4', whiteSpace: 'nowrap' }}>units/case</span>
                          </div>
                          {line.case_size > 1 && (
                            <div style={{ fontSize: '11px', color: '#185FA5', background: '#ddeeff', borderRadius: '4px', padding: '4px 8px' }}>
                              {line.qty} × {line.case_size} = <strong>{(parseFloat(line.qty) || 0) * line.case_size} units</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Invoice Line Item', 'Qty', 'Unit Cost', 'Total', 'Match to BOH Inventory', 'Status'].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {(scanResult.line_items || []).map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5', background: line.match_status === 'create_new' ? '#f0f8ff' : line.match_status === 'matched' ? '#f9fff5' : 'transparent' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{line.raw_name}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <input type="number" step="0.01" min="0" value={line.qty || ''} onChange={e => updateLineQty(idx, e.target.value)}
                            style={{ width: '64px', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: '#000' }} />
                        </td>
                        <td style={{ padding: '10px 14px', color: '#555', fontSize: '13px' }}>{line.unit_cost ? fmt(line.unit_cost) : '--'}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '500', color: '#000', fontSize: '13px' }}>{line.total_cost ? fmt(line.total_cost) : '--'}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '260px' }}>
                            <select value={line.matched_item_id || ''} onChange={e => updateLineMatch(idx, e.target.value || null)}
                              style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#000' }}>
                              <option value="">-- No match --</option>
                              <option value="__create__">+ Create new item</option>
                              {inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                            {line.match_status === 'create_new' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <select value={line.new_category || 'misc'} onChange={e => setScanResult(prev => ({ ...prev, line_items: prev.line_items.map((l, i) => i === idx ? { ...l, new_category: e.target.value } : l) }))}
                                  style={{ width: '100%', background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#0C447C' }}>
                                  {BOH_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                </select>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input type="number" min="1" placeholder="Case size" value={line.case_size || ''}
                                    onChange={e => setScanResult(prev => ({ ...prev, line_items: prev.line_items.map((l, i) => i === idx ? { ...l, case_size: parseInt(e.target.value) || 1 } : l) }))}
                                    style={{ width: '100%', background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: '#0C447C' }} />
                                  <span style={{ fontSize: '10px', color: '#5a9fd4', whiteSpace: 'nowrap' }}>units/case</span>
                                </div>
                                {line.case_size > 1 && (
                                  <div style={{ fontSize: '10px', color: '#185FA5', background: '#ddeeff', borderRadius: '4px', padding: '3px 6px' }}>
                                    {line.qty} × {line.case_size} = <strong>{(parseFloat(line.qty) || 0) * line.case_size} units</strong>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '500', color: matchColor(line.match_status) }}>
                            {line.match_status === 'matched' ? '✓ Matched' : line.match_status === 'create_new' ? '+ New item' : line.match_status === 'low_confidence' ? '⚠ Low confidence' : '✗ Unmatched'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isMobile && (
              <div style={{ position: 'sticky', bottom: '16px', marginTop: '16px', display: 'flex', gap: '8px' }}>
                <button onClick={() => { setScanResult(null); setView('hub') }} style={{ flex: 1, background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveInvoice} disabled={saving}
                  style={{ flex: 2, background: saving ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : '💾 Save for Approval'}
                </button>
              </div>
            )}

            <div style={{ marginTop: '12px', fontSize: '12px', color: '#aaa' }}>
              Saving does not update inventory. Return to the hub and hit Approve when you're ready to apply the changes.
            </div>
          </>
        )}
      </div>
    </div>
  )
}