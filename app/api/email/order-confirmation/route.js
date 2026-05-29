import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function POST(request) {
  try {
    const {
      email,
      barName,
      managerName,
      orderDate,
      orderId,
      pdfUrl,
      distributorGroups,
      totalItems
    } = await request.json()

    if (!email) {
      return Response.json({ error: 'No email provided' }, { status: 400 })
    }

    // Build distributor summary for email body
    const distSummary = distributorGroups.map(group => `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:#000;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #f0f0f0;">
          🚚 ${group.name}
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${group.lines.map(line => `
            <tr>
              <td style="padding:4px 0;font-size:12px;color:#333;">${line.item_name}</td>
              <td style="padding:4px 0;font-size:12px;color:#aaa;text-align:right;">${line.unit || ''}</td>
              <td style="padding:4px 0;font-size:12px;font-weight:600;color:#000;text-align:right;padding-left:16px;">×${line.final_qty}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `).join('')

    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME,
      },
      subject: `Order Confirmation — ${barName} · ${orderDate}`,
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
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                <div style="width:40px;height:40px;background:#EAF3DE;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;">✅</div>
                <div>
                  <div style="font-size:18px;font-weight:600;color:#000;">Order Submitted</div>
                  <div style="font-size:12px;color:#aaa;margin-top:2px;">Your order has been sent to your distributors.</div>
                </div>
              </div>

              <div style="background:#f5f5f3;border-radius:10px;padding:16px;margin-bottom:24px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  <div>
                    <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Bar / Restaurant</div>
                    <div style="font-size:13px;font-weight:500;color:#000;">${barName}</div>
                  </div>
                  <div>
                    <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Submitted By</div>
                    <div style="font-size:13px;font-weight:500;color:#000;">${managerName}</div>
                  </div>
                  <div>
                    <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Order Date</div>
                    <div style="font-size:13px;font-weight:500;color:#000;">${orderDate}</div>
                  </div>
                  <div>
                    <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Order #</div>
                    <div style="font-size:13px;font-weight:500;color:#000;">${orderId.slice(0, 8).toUpperCase()}</div>
                  </div>
                </div>
              </div>

              <div style="margin-bottom:24px;">
                <div style="font-size:13px;font-weight:600;color:#000;margin-bottom:14px;">
                  Order Summary — ${totalItems} items across ${distributorGroups.length} distributor${distributorGroups.length !== 1 ? 's' : ''}
                </div>
                ${distSummary}
              </div>

              ${pdfUrl ? `
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${pdfUrl}"
                   style="display:inline-block;background:#F5B800;color:#000;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;">
                  📄 Download Order PDF
                </a>
                <div style="font-size:11px;color:#aaa;margin-top:8px;">PDF link expires in 24 hours</div>
              </div>
              ` : ''}

              <div style="background:#E6F1FB;border-radius:10px;padding:14px 16px;">
                <div style="font-size:12px;color:#185FA5;line-height:1.6;">
                  Your distributors have been notified via their preferred contact method. 
                  Replies will appear in your <strong>notification inbox</strong> in the app.
                </div>
              </div>
            </div>

            <div style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="font-size:12px;color:#aaa;margin:0;">
                © ${new Date().getFullYear()} Inventory Sux LLC · Indianapolis, IN<br>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/account" style="color:#aaa;">Manage subscription</a> ·
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/support" style="color:#aaa;">Contact support</a>
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
    console.error('Order confirmation email error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}