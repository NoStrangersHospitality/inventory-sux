import { createClient } from '@supabase/supabase-js'

function extractReply(text) {
  if (!text) return ''
  const cutPatterns = [
    /^From:/m,
    /^-+\s*Original Message\s*-+/im,
    /^-+\s*Forwarded Message\s*-+/im,
    /^On .+ wrote:/m,
    /^Sent:/m,
    /^Inventory Sux New Order/m,
    /^Submitted by/m,
    /^Order #/m,
    /^\[EXTERNAL\]/m,
    /^CAUTION:/m,
    /^WARNING:/m,
    /^>{1}/m,
  ]
  const lines = text.split('\n')
  const cutIndex = lines.findIndex(line =>
    cutPatterns.some(pattern => pattern.test(line.trim()))
  )
  const replyLines = cutIndex >= 0 ? lines.slice(0, cutIndex) : lines
  return replyLines.join('\n').trim()
}

export async function POST(request) {
  try {
    const formData = await request.formData()

    const from = formData.get('from') || formData.get('From') || ''
    const text = formData.get('text') || formData.get('Text') || ''
    const html = formData.get('html') || formData.get('Html') || ''

    // Extract sender email
    const emailMatch = from.match(/<(.+?)>/) || from.match(/([^\s]+@[^\s]+)/)
    const senderEmail = emailMatch ? emailMatch[1].toLowerCase().trim() : from.toLowerCase().trim()

    if (!senderEmail) {
      return Response.json({ error: 'No sender email found' }, { status: 400 })
    }

    // Use plain text body, fall back to stripped HTML
    const rawBody = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Extract just the reply — everything before the quoted thread starts
    const messageBody = extractReply(rawBody)

    if (!messageBody) {
      return Response.json({ error: 'No message body found' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Step 1: Try exact email match first — most reliable, avoids domain collisions
    // where two reps at the same company (e.g. sgws.com) would both match a domain
    // search and the wrong one gets picked based on order recency.
    let matchedDistributor = null

    const { data: exactMatches } = await supabase
      .from('distributors')
      .select('id, name, user_id')
      .ilike('email', senderEmail)

    if (exactMatches && exactMatches.length > 0) {
      matchedDistributor = exactMatches[0]
    }

    // Step 2: If no exact match, fall back to domain-level match
    // (handles cases where the stored email differs from the reply-from address,
    // e.g. rep uses a different alias than what was entered in distributors)
    if (!matchedDistributor) {
      const senderDomain = senderEmail.split('@')[1]
      if (senderDomain) {
        const { data: domainMatches } = await supabase
          .from('distributors')
          .select('id, name, user_id')
          .ilike('email', `%@${senderDomain}`)

        if (domainMatches && domainMatches.length > 0) {
          if (domainMatches.length === 1) {
            matchedDistributor = domainMatches[0]
          } else {
            // Multiple reps at same domain — pick the one with the most recent order
            let bestDate = null
            for (const dist of domainMatches) {
              const { data: recentLine } = await supabase
                .from('order_lines')
                .select('order_id, created_at, orders(id, submitted_at)')
                .eq('distributor_id', dist.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
              if (recentLine?.orders) {
                const orderDate = new Date(recentLine.orders.submitted_at || recentLine.orders.created_at)
                if (!bestDate || orderDate > bestDate) {
                  bestDate = orderDate
                  matchedDistributor = dist
                }
              }
            }
            if (!matchedDistributor) matchedDistributor = domainMatches[0]
          }
        }
      }
    }

    // Step 3: Find the most recent order for the matched distributor
    let orderId = null
    let userId = matchedDistributor?.user_id || null

    if (matchedDistributor) {
      const { data: recentLine } = await supabase
        .from('order_lines')
        .select('order_id, orders(id, user_id, submitted_at)')
        .eq('distributor_id', matchedDistributor.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (recentLine?.orders) {
        orderId = recentLine.orders.id
        userId = recentLine.orders.user_id
      }
    }

    if (!userId) {
      console.log('Email reply: no matching distributor found for', senderEmail)
      return Response.json({ error: 'No matching distributor found' }, { status: 404 })
    }

    const { error: insertError } = await supabase.from('order_replies').insert({
      order_id: orderId,
      user_id: userId,
      // Always use the matched distributor's stored name — never derive the name
      // from order data, which caused the wrong-distributor-name bug
      distributor_name: matchedDistributor?.name || senderEmail,
      reply_channel: 'email',
      reply_from: senderEmail,
      message: messageBody,
      channel: 'email',
      read: false,
      archived: false,
    })

    if (insertError) {
      console.error('Email reply insert error:', insertError)
      return Response.json({ error: 'Failed to save reply' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Email reply error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}