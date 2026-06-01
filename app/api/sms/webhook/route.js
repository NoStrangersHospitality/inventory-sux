import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const from = formData.get('From')
    const body = formData.get('Body')
    const messageSid = formData.get('MessageSid')

    if (!from || !body) {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const cleanPhone = from.replace(/\D/g, '').slice(-10)

    const { data: distributors } = await supabase
      .from('distributors')
      .select('id, name, user_id')
      .ilike('phone', `%${cleanPhone}%`)

    if (!distributors || distributors.length === 0) {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    let bestMatch = null
    let bestOrderDate = null

    for (const dist of distributors) {
      const { data: recentLine } = await supabase
        .from('order_lines')
        .select('order_id, created_at, orders(id, user_id, created_at)')
        .eq('distributor_id', dist.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (recentLine?.orders) {
        const orderDate = new Date(recentLine.orders.created_at)
        if (!bestOrderDate || orderDate > bestOrderDate) {
          bestOrderDate = orderDate
          bestMatch = {
            orderId: recentLine.orders.id,
            userId: recentLine.orders.user_id,
            distName: dist.name
          }
        }
      }
    }

    if (bestMatch) {
      await supabase.from('order_replies').insert({
        order_id: bestMatch.orderId,
        user_id: bestMatch.userId,
        distributor_name: bestMatch.distName,
        message: body,
        channel: 'sms',
        from_number: from,
        twilio_sid: messageSid,
        read: false
      })
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    })
  } catch (error) {
    console.error('SMS webhook error:', error)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}