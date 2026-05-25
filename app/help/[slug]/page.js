'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'

export default function Article() {
  const [article, setArticle] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

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
      const { data: art } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', params.slug)
        .eq('published', true)
        .single()

      if (!art) { router.push('/help'); return }
      setArticle(art)

      // Load related articles from same category
      const { data: rel } = await supabase
        .from('articles')
        .select('id, title, slug')
        .eq('published', true)
        .eq('category', art.category)
        .neq('id', art.id)
        .limit(4)
      setRelated(rel || [])
      setLoading(false)
    }
    init()
  }, [params.slug])

  // Simple markdown-like renderer
  const renderContent = (content) => {
    if (!content) return null
    const lines = content.split('\n')
    const elements = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={i} style={{ fontSize: '17px', fontWeight: '600', color: '#000', marginTop: '24px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0' }}>
            {line.replace('## ', '')}
          </h2>
        )
      } else if (line.startsWith('# ')) {
        elements.push(
          <h1 key={i} style={{ fontSize: '20px', fontWeight: '700', color: '#000', marginBottom: '12px' }}>
            {line.replace('# ', '')}
          </h1>
        )
      } else if (line.startsWith('- ')) {
        // Collect list items
        const listItems = []
        while (i < lines.length && lines[i].startsWith('- ')) {
          listItems.push(lines[i].replace('- ', ''))
          i++
        }
        elements.push(
          <ul key={`ul-${i}`} style={{ marginBottom: '12px', paddingLeft: '20px' }}>
            {listItems.map((item, j) => (
              <li key={j} style={{ fontSize: '14px', color: '#333', lineHeight: '1.7', marginBottom: '4px' }}>
                {renderInline(item)}
              </li>
            ))}
          </ul>
        )
        continue
      } else if (line.match(/^\d+\. /)) {
        // Ordered list
        const listItems = []
        while (i < lines.length && lines[i].match(/^\d+\. /)) {
          listItems.push(lines[i].replace(/^\d+\. /, ''))
          i++
        }
        elements.push(
          <ol key={`ol-${i}`} style={{ marginBottom: '12px', paddingLeft: '20px' }}>
            {listItems.map((item, j) => (
              <li key={j} style={{ fontSize: '14px', color: '#333', lineHeight: '1.7', marginBottom: '4px' }}>
                {renderInline(item)}
              </li>
            ))}
          </ol>
        )
        continue
      } else if (line === '') {
        elements.push(<div key={i} style={{ height: '8px' }} />)
      } else {
        elements.push(
          <p key={i} style={{ fontSize: '14px', color: '#333', lineHeight: '1.8', marginBottom: '8px' }}>
            {renderInline(line)}
          </p>
        )
      }
      i++
    }
    return elements
  }

  const renderInline = (text) => {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#aaa', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  if (!article) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f3', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '2px solid #F5B800', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={() => router.push('/dashboard')} style={{ fontSize: '22px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
          <span style={{ color: '#000' }}>Inventory</span><span style={{ color: '#F5B800' }}>Sux</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/support')} style={{ background: 'none', border: '1px solid #e8e8e8', color: '#555', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>🎫 Get Help</button>
          <button onClick={() => router.push('/help')} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>← Help Center</button>
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: '800px', margin: '0 auto' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>
          <span style={{ cursor: 'pointer' }} onClick={() => router.push('/help')}>Help Center</span>
          <span>›</span>
          <span style={{ cursor: 'pointer' }} onClick={() => router.push('/help')}>{article.category}</span>
          <span>›</span>
          <span style={{ color: '#555' }}>{article.title}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '24px', alignItems: 'flex-start' }}>

          {/* Article */}
          <div>
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '28px 32px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px' }}>{CATEGORY_ICONS[article.category]}</span>
                <span style={{ fontSize: '12px', color: '#aaa' }}>{article.category}</span>
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#000', marginBottom: '20px', lineHeight: '1.3' }}>{article.title}</h1>
              <div>{renderContent(article.content)}</div>
            </div>

            {/* Was this helpful */}
            <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#555', marginBottom: '12px' }}>Was this article helpful?</div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={() => alert('Thanks for the feedback!')}
                  style={{ background: '#EAF3DE', color: '#27500A', border: '1px solid #97C459', padding: '7px 20px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  👍 Yes
                </button>
                <button onClick={() => router.push('/support')}
                  style={{ background: '#fff', color: '#555', border: '1px solid #e8e8e8', padding: '7px 20px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  👎 No — get help
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            {related.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Related Articles</div>
                {related.map((rel, idx) => (
                  <div key={rel.id} onClick={() => router.push(`/help/${rel.slug}`)}
                    style={{ padding: '8px 0', borderBottom: idx < related.length - 1 ? '1px solid #f5f5f5' : 'none', cursor: 'pointer', fontSize: '13px', color: '#185FA5' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#0C447C'}
                    onMouseLeave={e => e.currentTarget.style.color = '#185FA5'}>
                    {rel.title}
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: '#111', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', marginBottom: '4px' }}>Need more help?</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '12px' }}>Open a support ticket</div>
              <button onClick={() => router.push('/support')}
                style={{ background: '#F5B800', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}