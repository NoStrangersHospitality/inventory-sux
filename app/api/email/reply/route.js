import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const formData = await request.formData()
    
    const from = formData.get('from') || formData.get('From') || ''
    const subject = formData.get('subject') || formData.get('Subject') || ''
    const text = formData.get('text') || formData.get('Text') || ''
    const html = formData.get('html') || formData.get('Html') || ''
    const messageId = formData.get('Message-ID') || formData.get('message-id') || ''

    // Extract email address from from field
    const emailMatch = from.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    const fromEmail = emailMatch ? emailMatch[0].toLowerCase() : ''

    if (!fromEmail) {
      return Response.json({ error: 'No sender email found' }, { status: 400 })
    }

    // Use plain text body, fall back to stripping HTML
    let messageBody = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Strip quoted reply content (lines starting with > or "On ... wrote:")
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

    // Find distributor by email
    const { data: distributors } = await supabase
      .from('distributors')
      .select('id, name, user_id')
      .ilike('email', fromEmail)

    if (!distributors || distributors.length === 0) {
      console.log('No distributor found for email:', fromEmail)
      return Response.json({ received: true })
    }

    const dist = distributors[0]

    // Find most recent order for this distributor
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

    const orderId = recentLine.orders.id
    const userId = recentLine.orders.user_id

    // Save reply
    await supabase.from('order_replies').insert({
      order_id: orderId,
      user_id: userId,
      distributor_id: dist.id,
      distributor_name: dist.name,
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