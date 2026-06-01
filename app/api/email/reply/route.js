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

    let messageBody = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    messageBody = messageBody
      .split('\n')
      .filter(line => !line.startsWith('>') && !line.match(/^On .* wrote:/))
      .join('\n')
      .trim()

    if (!messageBody) {
      return Response.json({ error: 'No message body found' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Try to match order directly from subject line first — bulletproof multi-tenant
    const orderIdMatch = subject.match(/\[#([A-Z0-9]{8})\]/)
    
    let orderId, userId, distId, distName

    if (orderIdMatch) {
      const orderPrefix = orderIdMatch[1].toLowerCase()

      const { data: orders } = await supabase
        .rpc('find_order_by_prefix', { prefix: orderPrefix })

      if (orders && orders.length > 0) {
        const order = orders[0]
        orderId = order.id
        userId = order.user_id
        distId = order.distributor_id
        distName = order.distributor_name || 'Unknown'
      }
    }

    // Fallback: match by distributor email if no order ID in subject
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
      distId = dist.id
      distName = dist.name

      const { data: recentLine } = await supabase
        .from('order_lines')
        .select('order_id, orders(id, user_id)')
        .eq('distributor_id', dist.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!recentLine?.orders) {
        console.log('No recent order found for distributor:', dist.name)
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
      distributor_id: distId,
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