import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function POST(request) {
  try {
    const { 
      distributorName, 
      distributorEmail, 
      barName, 
      managerName,
      orderLines,
      orderId,
      orderDate
    } = await request.json()

    if (!distributorEmail) {
      return Response.json({ error: 'No distributor email provided' }, { status: 400 })
    }

    const itemRows = orderLines.map(line => `
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#000;border-bottom:1px solid #f5f5f5;">${line.item_name}</td>
        <td style="padding:10px 14px;font-size:13px;color:#555;border-bottom:1px solid #f5f5f5;text-align:center;">${line.final_qty}</td>
        <td style="padding:10px 14px;font-size:13px;color:#aaa;border-bottom:1px solid #f5f5f5;text-align:center;">${line.unit || '--'}</td>
      </tr>
    `).join('')

    const msg = {
      to: distributorEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME,
      },
      replyTo: {
        email: `orders@parse.inventorysux.com`,
        name: `${managerName} via Inventory Sux`,
      },
      subject: `Order from ${barName} — ${orderDate} [#${orderId?.slice(0, 8).toUpperCase()}]`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background:#f5f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e8e8;">
            
            <div style="background:#111;padding:28px 32px;text-align:center;">
              <span style="font-size:28px;font-weight:900;font-style:italic;color:#fff;letter-spacing:-1px;">Inventory</span>
              <span style="font-size:28px;font-weight:900;font-style:italic;color:#F5B800;letter-spacing:-1px;">Sux</span>
            </div>

            <div style="padding:32px;">
              <h1 style="font-size:20px;font-weight:600;color:#000;margin:0 0 6px;">New Order from ${barName}</h1>
              <p style="font-size:13px;color:#aaa;margin:0 0 24px;">
                Submitted by ${managerName} · ${orderDate} · Order #${orderId?.slice(0, 8).toUpperCase()}
              </p>

              <div style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;margin-bottom:24px;">
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:#fafafa;">
                      <th style="padding:10px 14px;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;text-align:left;">Item</th>
                      <th style="padding:10px 14px;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;text-align:center;">Qty</th>
                      <th style="padding:10px 14px;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;text-align:center;">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows}
                  </tbody>
                </table>
              </div>

              <div style="background:#EAF3DE;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
                <div style="font-size:13px;font-weight:500;color:#27500A;margin-bottom:4px;">How to respond</div>
                <div style="font-size:12px;color:#3B6D11;line-height:1.6;">
                  Reply directly to this email to confirm, modify, or ask questions about this order. 
                  Your reply will go directly to ${managerName} at ${barName}.
                </div>
              </div>

              <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                Sent via Inventory Sux · inventorysux.com
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    }

    await sgMail.send(msg)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Order email error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}