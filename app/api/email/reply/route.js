import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const formData = await request.formData()

    const from = formData.get('from') || formData.get('From') || ''
    const subject = formData.get('subject') || formData.get('Subject') || ''
    const text = formData.get('text') || formData.get('Text') || ''
    const html = formData.get('html') || formData.get('Html') || ''
    const messageId = formData.get('Message-ID') || formData.get('message-id') || ''

    const emailMatch = from.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    const fromEmail = emailMatch ? emailMatch[0].toLowerCase() : ''

    if (!fromEmail) {
      return Response.json({ error: 'No sender email found' }, { status: 400 })
    }

    // Use plain text body, fall back to stripped HTML
    let rawBody = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Extract just the reply — everything before the quoted thread starts
    const messageBody = extractReply(rawBody)

    if (!messageBody) {
      return Response.json({ error: 'No message body found' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const orderIdMatch = subject.match(/\[#([A-Z0-9]{8})\]/)

    let orderId, userId, distName

    if (orderIdMatch) {
      const orderPrefix = orderIdMatch[1].toLowerCase()
      const { data: orders } = await supabase
        .rpc('find_order_by_prefix', { prefix: orderPrefix })

      if (orders && orders.length > 0) {
        const order = orders[0]
        orderId = order.id
        userId = order.user_id
        distName = order.distributor_name || 'Unknown'
      }
    }

    if (!orderId) {
      const { data: distributors } = await supabase
        .from('distributors')
        .select('id, name, user_id')
        .ilike('email', fromEmail)

      if (!distributors || distributors.length === 0) {
        console.log('No distributor found for email:', fromEmail)
        return Response.json({ received: true })
      }

      const dist = distributors[0]
      distName = dist.name

      const { data: recentLine } = await supabase
        .from('order_lines')
        .select('order_id, orders(id, user_id)')
        .eq('distributor_id', dist.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!recentLine?.orders) {
        console.log('No recent order found for distributor:', distName)
        return Response.json({ received: true })
      }

      orderId = recentLine.orders.id
      userId = recentLine.orders.user_id
    }

    if (!orderId || !userId) {
      console.log('Could not resolve order for reply from:', fromEmail)
      return Response.json({ received: true })
    }

    await supabase.from('order_replies').insert({
      order_id: orderId,
      user_id: userId,
      distributor_name: distName,
      message: messageBody,
      channel: 'email',
      from_number: fromEmail,
      twilio_sid: messageId,
      read: false
    })

    return Response.json({ received: true })
  } catch (error) {
    console.error('Email reply webhook error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

function extractReply(body) {
  if (!body) return ''

  const lines = body.split('\n')
  const cutPatterns = [
    // Standard quoted reply headers
    /^From:\s+/i,
    /^-{3,}\s*Original Message\s*-{3,}/i,
    /^-{3,}\s*Forwarded Message\s*-{3,}/i,
    /^On .+ wrote:$/i,
    /^_{3,}/,
    // Outlook-style
    /^Sent:\s+/i,
    // Inventory Sux order block — the order we sent is quoted back
    /^Inventory Sux New Order/i,
    /^Submitted by/i,
    /^Order #[A-Z0-9]/i,
    // Security warning banners (corporate IT)
    /^\[?\s*EXTERNAL\s*\]?/i,
    /^CAUTION:/i,
    /^WARNING:/i,
  ]

  let cutAt = lines.length
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (cutPatterns.some(p => p.test(line))) {
      cutAt = i
      break
    }
    // Also cut at Gmail-style > quoted lines
    if (line.startsWith('>')) {
      cutAt = i
      break
    }
  }

  const reply = lines
    .slice(0, cutAt)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n')
    .trim()

  return reply || ''
}