'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function HelpCenter() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const CATEGORIES = [
    'All',
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
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('published', true)
        .order('sort_order', { ascending: true })
      setArticles(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const filtered = articles.filter(a => {
    const matchCat = activeCategory === 'All' || a.category === activeCategory
    const q = search.toLowerCase()
    const matchSearch = !q || a.title.toLowerCase().includes(q) || (a.content || '').toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const grouped = CATEGORIES.filter(c => c !== 'All').reduce((acc, cat) => {
    const catArticles = filtered.filter(a => a.category === cat)
    if (catArticles.length > 0) acc[cat] = catArticles
    return acc
  }, {})

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/support')} style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>🎫 Open a Ticket</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Dashboard</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: '#111', padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
          How can we help?
        </div>
        <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '24px' }}>
          Search our knowledge base or browse by category below.
        </div>
        <div style={{ maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveCategory('All') }}
            placeholder="Search articles..."
            style={{ width: '100%', background: '#fff', border: 'none', borderRadius: '10px', padding: '12px 16px', fontSize: '14px', color: '#000', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', outline: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '1000px', margin: '0 auto' }}>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveCategory(c)}
              style={{ padding: '6px 14px', border: '1px solid', borderColor: activeCategory === c ? '#F5B800' : '#e8e8e8', borderRadius: '20px', fontSize: '12px', fontWeight: activeCategory === c ? '700' : '400', cursor: 'pointer', background: activeCategory === c ? '#F5B800' : '#fff', color: activeCategory === c ? '#000' : '#666' }}>
              {c !== 'All' && CATEGORY_ICONS[c]} {c}
            </button>
          ))}
        </div>

        {/* Search results or grouped articles */}
        {filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
            No articles found. Try a different search or <span style={{ color: '#F5B800', cursor: 'pointer' }} onClick={() => router.push('/support')}>open a support ticket</span>.
          </div>
        ) : search ? (
          // Flat list for search results
          <div>
            <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '12px' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"</div>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
              {filtered.map((article, idx) => (
                <div key={article.id} onClick={() => router.push(`/help/${article.slug}`)}
                  style={{ padding: '16px 20px', borderBottom: idx < filtered.length - 1 ? '1px solid #f5f5f5' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#000', fontSize: '14px', marginBottom: '3px' }}>{article.title}</div>
                      <div style={{ fontSize: '12px', color: '#aaa' }}>{CATEGORY_ICONS[article.category]} {article.category}</div>
                    </div>
                    <span style={{ color: '#aaa', fontSize: '16px' }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Grouped by category
          Object.entries(grouped).map(([cat, catArticles]) => (
            <div key={cat} style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '18px' }}>{CATEGORY_ICONS[cat]}</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#000' }}>{cat}</span>
                <span style={{ fontSize: '12px', color: '#aaa' }}>· {catArticles.length} article{catArticles.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden' }}>
                {catArticles.map((article, idx) => (
                  <div key={article.id} onClick={() => router.push(`/help/${article.slug}`)}
                    style={{ padding: '14px 20px', borderBottom: idx < catArticles.length - 1 ? '1px solid #f5f5f5' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontWeight: '500', color: '#000', fontSize: '13px' }}>{article.title}</span>
                    <span style={{ color: '#aaa', fontSize: '14px' }}>→</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Still need help */}
        <div style={{ background: '#111', borderRadius: '12px', padding: '24px', textAlign: 'center', marginTop: '32px' }}>
          <div style={{ fontSize: '15px', fontWeight: '500', color: '#fff', marginBottom: '6px' }}>Still need help?</div>
          <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>Our support team typically responds within one business day.</div>
          <button onClick={() => router.push('/support')}
            style={{ background: '#F5B800', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            Open a Support Ticket
          </button>
        </div>
      </div>
    </div>
  )
}