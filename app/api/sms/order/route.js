import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(request) {
  try {
    const {
      distributorPhone,
      barName,
      managerName,
      orderLines,
      orderId,
      orderDate
    } = await request.json()

    if (!distributorPhone) {
      return Response.json({ error: 'No distributor phone provided' }, { status: 400 })
    }

    // Format phone number
    const phone = distributorPhone.replace(/\D/g, '')
    const formattedPhone = phone.startsWith('1') ? `+${phone}` : `+1${phone}`

    // Build item list — keep SMS concise
    const itemList = orderLines
      .map(line => `• ${line.item_name} x${line.final_qty}`)
      .join('\n')

    const message = `New order from ${barName} (${orderDate}):

${itemList}

Order #${orderId?.slice(0, 8).toUpperCase()}
Submitted by ${managerName}

Reply to this message to confirm or ask questions.`

    await client.messages.create({
      body: message,
      // Use Messaging Service SID (not direct phone number) so messages are
      // sent under the verified A2P 10DLC campaign. Sending from a raw phone
      // number bypasses the campaign registration and risks carrier filtering.
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: formattedPhone,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Order SMS error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}