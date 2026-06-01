import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const formData = await request.formData()
    
    const from = formData.get('from') || formData.get('From') || ''
    const subject = formData.get('subject') || formData.get('Subject') || ''
    const text = formData.get('text') || formData.get('Text') || ''
    const html = formData.get('html') || formData.get('Html') || ''
    const messageId = formData.get('Message-ID') || formData.get('message-id') || ''

    console.log('=== INBOUND EMAIL DEBUG ===')
    console.log('from:', from)
    console.log('subject:', subject)
    console.log('messageId:', messageId)

    const emailMatch = from.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    const fromEmail = emailMatch ? emailMatch[0].toLowerCase() : ''
    console.log('fromEmail:', fromEmail)

    if (!fromEmail) {
      console.log('BAIL: no sender email')
      return Response.json({ error: 'No sender email found' }, { status: 400 })
    }

    let messageBody = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    messageBody = messageBody
      .split('\n')
      .filter(line => !line.startsWith('>') && !line.match(/^On .* wrote:/))
      .join('\n')
      .trim()

    console.log('messageBody length:', messageBody.length)

    if (!messageBody) {
      console.log('BAIL: no message body')
      return Response.json({ error: 'No message body found' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const orderIdMatch = subject.match(/\[#([A-Z0-9]{8})\]/)
    console.log('orderIdMatch:', orderIdMatch)

    let orderId, userId, distId, distName

    if (orderIdMatch) {
      const orderPrefix = orderIdMatch[1].toLowerCase()
      console.log('orderPrefix:', orderPrefix)

      const { data: orders, error: rpcError } = await supabase
        .rpc('find_order_by_prefix', { prefix: orderPrefix })

      console.log('rpc result:', JSON.stringify(orders))
      console.log('rpc error:', JSON.stringify(rpcError))

      if (orders && orders.length > 0) {
        const order = orders[0]
        orderId = order.id
        userId = order.user_id
        distId = order.distributor_id
        distName = order.distributor_name || 'Unknown'
        console.log('matched order:', orderId, 'user:', userId)
      }
    }

    if (!orderId) {
      console.log('falling back to distributor email match')
      const { data: distributors, error: distError } = await supabase
        .from('distributors')
        .select('id, name, user_id')
        .ilike('email', fromEmail)

      console.log('distributors:', JSON.stringify(distributors))
      console.log('distError:', JSON.stringify(distError))

      if (!distributors || distributors.length === 0) {
        console.log('BAIL: no distributor found')
        return Response.json({ received: true })
      }

      const dist = distributors[0]
      distId = dist.id
      distName = dist.name

      const { data: recentLine, error: lineError } = await supabase
        .from('order_lines')
        .select('order_id, orders(id, user_id)')
        .eq('distributor_id', dist.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      console.log('recentLine:', JSON.stringify(recentLine))
      console.log('lineError:', JSON.stringify(lineError))

      if (!recentLine?.orders) {
        console.log('BAIL: no recent order')
        return Response.json({ received: true })
      }

      orderId = recentLine.orders.id
      userId = recentLine.orders.user_id
    }

    if (!orderId || !userId) {
      console.log('BAIL: could not resolve order')
      return Response.json({ received: true })
    }

    console.log('inserting reply for order:', orderId, 'user:', userId)

    const { error: insertError } = await supabase.from('order_replies').insert({
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

    console.log('insertError:', JSON.stringify(insertError))
    console.log('=== END DEBUG ===')

    return Response.json({ received: true })
  } catch (error) {
    console.error('Email reply webhook error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}