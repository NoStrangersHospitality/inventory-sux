import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

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

    // Clean the phone number for matching
    const cleanPhone = from.replace(/\D/g, '')

    // Find the distributor by phone number
    const { data: distributors } = await supabase
      .from('distributors')
      .select('id, name, user_id')
      .or(`phone.ilike.%${cleanPhone.slice(-10)}%`)

    if (distributors && distributors.length > 0) {
      const dist = distributors[0]

      // Find the most recent order for this distributor
      const { data: recentOrder } = await supabase
        .from('order_lines')
        .select('order_id, orders(id, user_id)')
        .eq('distributor_id', dist.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (recentOrder?.orders) {
        const orderId = recentOrder.orders.id
        const userId = recentOrder.orders.user_id

        // Save the reply
        await supabase.from('order_replies').insert({
          order_id: orderId,
          user_id: userId,
          distributor_id: dist.id,
          distributor_name: dist.name,
          message: body,
          channel: 'sms',
          from_number: from,
          twilio_sid: messageSid,
          read: false
        })
      }
    }

    // Return empty TwiML response
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