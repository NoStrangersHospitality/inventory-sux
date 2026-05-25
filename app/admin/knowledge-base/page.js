'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AdminKnowledgeBase() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [activeFilter, setActiveFilter] = useState('all')
  const [bulkAction, setBulkAction] = useState('')
  const [form, setForm] = useState({
    title: '',
    slug: '',
    category: 'Getting Started',
    content: '',
    published: false,
    archived: false,
    sort_order: 0,
  })
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    'Getting Started',
    'FOH Ordering',
    'FOH Inventory',
    'COGS & Pour Cost',
    'BOH Ordering',
    'BOH Inventory',
    'Invoice Scanning',
    'Account & Billing',
  ]

  const CATEGORY_ICONS = {
    'Getting Started': '🚀',
    'FOH Ordering': '🛒',
    'FOH Inventory': '📦',
    'COGS & Pour Cost': '🧮',
    'BOH Ordering': '🥩',
    'BOH Inventory': '🗄️',
    'Invoice Scanning': '📄',
    'Account & Billing': '💳',
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.is_admin) { router.push('/dashboard'); return }
      await loadArticles()
      setLoading(false)
    }
    init()
  }, [])

  const loadArticles = async () => {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .order('sort_order', { ascending: true })
    setArticles(data || [])
    setSelected(new Set())
  }

  const filtered = articles.filter(a => {
    if (activeFilter === 'published') return a.published && !a.archived
    if (activeFilter === 'drafts') return !a.published && !a.archived
    if (activeFilter === 'archived') return a.archived
    return !a.archived // 'all' excludes archived
  })

  const counts = {
    all: articles.filter(a => !a.archived).length,
    published: articles.filter(a => a.published && !a.archived).length,
    drafts: articles.filter(a => !a.published && !a.archived).length,
    archived: articles.filter(a => a.archived).length,
  }

  const openNew = () => {
    setForm({ title: '', slug: '', category: 'Getting Started', content: '', published: false, archived: false, sort_order: articles.length + 1 })
    setEditingId(null)
    setView('edit')
  }

  const openEdit = (article) => {
    setForm({
      title: article.title,
      slug: article.slug,
      category: article.category,
      content: article.content || '',
      published: article.published,
      archived: article.archived || false,
      sort_order: article.sort_order || 0,
    })
    setEditingId(article.id)
    setView('edit')
  }

  const generateSlug = (title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  const saveArticle = async () => {
    if (!form.title || !form.slug) return
    setSaving(true)
    const payload = {
      title: form.title,
      slug: form.slug,
      category: form.category,
      content: form.content,
      published: form.published,
      archived: form.archived,
      sort_order: parseInt(form.sort_order) || 0,
      updated_at: new Date().toISOString(),
    }
    if (editingId) {
      await supabase.from('articles').update(payload).eq('id', editingId)
    } else {
      await supabase.from('articles').insert(payload)
    }
    await loadArticles()
    setSaving(false)
    setView('list')
  }

  const togglePublished = async (article) => {
    await supabase.from('articles').update({ published: !article.published }).eq('id', article.id)
    await loadArticles()
  }

  const toggleArchived = async (article) => {
    await supabase.from('articles').update({ archived: !article.archived, published: false }).eq('id', article.id)
    await loadArticles()
  }

  const deleteArticle = async (id) => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    await supabase.from('articles').delete().eq('id', id)
    await loadArticles()
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(a => a.id)))
    }
  }

  const applyBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return
    const ids = Array.from(selected)

    if (bulkAction === 'publish') {
      await supabase.from('articles').update({ published: true, archived: false }).in('id', ids)
    } else if (bulkAction === 'unpublish') {
      await supabase.from('articles').update({ published: false }).in('id', ids)
    } else if (bulkAction === 'archive') {
      await supabase.from('articles').update({ archived: true, published: false }).in('id', ids)
    } else if (bulkAction === 'unarchive') {
      await supabase.from('articles').update({ archived: false }).in('id', ids)
    } else if (bulkAction === 'delete') {
      if (!confirm(`Delete ${selected.size} article${selected.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
      await supabase.from('articles').delete().in('id', ids)
    }

    setBulkAction('')
    await loadArticles()
  }

  const statusBadge = (article) => {
    if (article.archived) return { label: 'Archived', bg: '#f5f5f3', color: '#aaa', border: '#e8e8e8' }
    if (article.published) return { label: 'Published', bg: '#EAF3DE', color: '#27500A', border: '#97C459' }
    return { label: 'Draft', bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB' }
  }

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#000', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }
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
          <div style={{ background: 'rgba(245,184,0,.15)', border: '1px solid rgba(245,184,0,.3)', color: '#F5B800', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px' }}>Admin · Knowledge Base</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => router.push('/help')} style={{ background: 'none', border: '1px solid rgba(255,255,255,.2)', color: '#aaa', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>👁 View Help Center</button>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: '1px solid rgba(255,255,255,.2)', color: '#aaa', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Admin</button>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* LIST VIEW */}
        {view === 'list' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>Knowledge Base</h1>
                <p style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>
                  {counts.published} published · {counts.drafts} draft{counts.drafts !== 1 ? 's' : ''} · {counts.archived} archived
                </p>
              </div>
              <button onClick={openNew}
                style={{ background: '#333', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                + New Article
              </button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[
                { key: 'all', label: `All (${counts.all})` },
                { key: 'published', label: `Published (${counts.published})` },
                { key: 'drafts', label: `Drafts (${counts.drafts})` },
                { key: 'archived', label: `Archived (${counts.archived})` },
              ].map(f => (
                <button key={f.key} onClick={() => { setActiveFilter(f.key); setSelected(new Set()) }}
                  style={{ padding: '6px 14px', border: '1px solid', borderColor: activeFilter === f.key ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: activeFilter === f.key ? '700' : '400', cursor: 'pointer', background: activeFilter === f.key ? '#F5B800' : '#fff', color: activeFilter === f.key ? '#000' : '#666' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div style={{ background: '#fffbe6', border: '1px solid #f0d060', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#854F0B', fontWeight: '500' }}>{selected.size} article{selected.size !== 1 ? 's' : ''} selected</span>
                <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                  style={{ background: '#fff', border: '1px solid #f0d060', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', color: '#854F0B', cursor: 'pointer' }}>
                  <option value="">Select action...</option>
                  <option value="publish">Publish</option>
                  <option value="unpublish">Unpublish</option>
                  <option value="archive">Archive</option>
                  <option value="unarchive">Unarchive</option>
                  <option value="delete">Delete</option>
                </select>
                <button onClick={applyBulkAction} disabled={!bulkAction}
                  style={{ background: bulkAction === 'delete' ? '#E24B4A' : '#333', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: bulkAction ? 'pointer' : 'not-allowed', opacity: bulkAction ? 1 : 0.5 }}>
                  Apply
                </button>
                <button onClick={() => setSelected(new Set())}
                  style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '12px', cursor: 'pointer' }}>
                  Clear
                </button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
                {activeFilter === 'archived' ? 'No archived articles.' : 'No articles yet. Create your first article above.'}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', width: '36px' }}>
                        <input type="checkbox"
                          checked={selected.size === filtered.length && filtered.length > 0}
                          onChange={toggleSelectAll}
                          style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#F5B800' }} />
                      </th>
                      {['Title', 'Category', 'Status', 'Order', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: 'left', fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '.4px', padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(article => {
                      const badge = statusBadge(article)
                      const isSelected = selected.has(article.id)
                      return (
                        <tr key={article.id} style={{ borderBottom: '1px solid #f5f5f5', background: isSelected ? '#fffdf0' : 'transparent' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(article.id)}
                              style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#F5B800' }} />
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '500', color: '#000', fontSize: '13px', marginBottom: '2px' }}>{article.title}</div>
                            <div style={{ fontSize: '11px', color: '#aaa' }}>/help/{article.slug}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#555' }}>
                            {CATEGORY_ICONS[article.category]} {article.category}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, borderRadius: '10px', fontSize: '11px', padding: '3px 10px', fontWeight: '500' }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#aaa' }}>{article.sort_order}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              {!article.archived && (
                                <button onClick={() => togglePublished(article)}
                                  style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                  {article.published ? 'Unpublish' : 'Publish'}
                                </button>
                              )}
                              <button onClick={() => toggleArchived(article)}
                                style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                                {article.archived ? 'Unarchive' : 'Archive'}
                              </button>
                              {!article.archived && (
                                <button onClick={() => router.push(`/help/${article.slug}`)}
                                  style={{ background: 'none', border: '1px solid #e8e8e8', color: '#aaa', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>View</button>
                              )}
                              <button onClick={() => openEdit(article)}
                                style={{ background: '#333', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                              <button onClick={() => deleteArticle(article.id)}
                                style={{ background: 'none', border: '1px solid #fca5a5', color: '#E24B4A', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
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

        {/* EDIT VIEW */}
        {view === 'edit' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#000' }}>{editingId ? 'Edit Article' : 'New Article'}</h1>
              <button onClick={() => setView('list')}
                style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                ← Back to list
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'flex-start' }}>

              {/* Main content */}
              <div>
                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Title</label>
                    <input style={inputStyle} placeholder="Article title" value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: editingId ? f.slug : generateSlug(e.target.value) }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Slug (URL)</label>
                    <input style={inputStyle} placeholder="article-slug" value={form.slug}
                      onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                    <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>Will be accessible at /help/{form.slug}</div>
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={labelStyle}>Content</label>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>## headings · **bold** · - lists · 1. numbered</div>
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: '420px', resize: 'vertical', lineHeight: '1.6', fontFamily: 'monospace', fontSize: '13px' }}
                    placeholder={`## Section heading\n\nYour content here. Use **bold** for emphasis.\n\n- Bullet point\n- Another point\n\n1. Numbered step\n2. Another step`}
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  />
                </div>
              </div>

              {/* Sidebar */}
              <div>
                <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#000', marginBottom: '14px' }}>Settings</div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Category</label>
                    <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Sort Order</label>
                    <input style={inputStyle} type="number" value={form.sort_order}
                      onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
                    <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>Lower numbers appear first</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: form.published ? '#EAF3DE' : '#fafafa', border: `1px solid ${form.published ? '#97C459' : '#e8e8e8'}`, borderRadius: '8px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>Published</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{form.published ? 'Visible to users' : 'Draft — not visible'}</div>
                    </div>
                    <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked, archived: e.target.checked ? false : f.archived }))}
                      style={{ width: '18px', height: '18px', accentColor: '#F5B800', cursor: 'pointer' }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: form.archived ? '#f5f5f3' : '#fafafa', border: `1px solid ${form.archived ? '#aaa' : '#e8e8e8'}`, borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#000' }}>Archived</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{form.archived ? 'Hidden from users' : 'Not archived'}</div>
                    </div>
                    <input type="checkbox" checked={form.archived} onChange={e => setForm(f => ({ ...f, archived: e.target.checked, published: e.target.checked ? false : f.published }))}
                      style={{ width: '18px', height: '18px', accentColor: '#333', cursor: 'pointer' }} />
                  </div>
                </div>

                <button onClick={saveArticle} disabled={saving || !form.title || !form.slug}
                  style={{ width: '100%', background: saving || !form.title || !form.slug ? '#ccc' : '#F5B800', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: saving || !form.title || !form.slug ? 'not-allowed' : 'pointer', marginBottom: '8px' }}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Article'}
                </button>

                {editingId && !form.archived && (
                  <button onClick={() => router.push(`/help/${form.slug}`)}
                    style={{ width: '100%', background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '10px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    👁 Preview Article
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}