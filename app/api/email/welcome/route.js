import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function POST(request) {
  try {
    const { firstName, email, barName } = await request.json()

    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME,
      },
      subject: `Welcome to Inventory Sux, ${firstName}!`,
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

            <div style="padding:40px 32px;">
              <h1 style="font-size:22px;font-weight:600;color:#000;margin:0 0 8px;">Welcome, ${firstName}! 🥃</h1>
              <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
                Your 14-day free trial for <strong>${barName}</strong> is now active. No charge until day 15.
              </p>

              <div style="background:#f5f5f3;border-radius:12px;padding:24px;margin-bottom:28px;">
                <div style="font-size:13px;font-weight:600;color:#000;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px;">Get started in 3 steps</div>
                <div style="margin-bottom:14px;display:flex;align-items:flex-start;">
                  <div style="width:24px;height:24px;background:#F5B800;border-radius:50%;font-size:12px;font-weight:700;color:#000;flex-shrink:0;margin-right:12px;text-align:center;line-height:24px;">1</div>
                  <div>
                    <div style="font-size:13px;font-weight:500;color:#000;">Add your distributors</div>
                    <div style="font-size:12px;color:#aaa;margin-top:2px;">FOH → Ordering → Distributors</div>
                  </div>
                </div>
                <div style="margin-bottom:14px;display:flex;align-items:flex-start;">
                  <div style="width:24px;height:24px;background:#F5B800;border-radius:50%;font-size:12px;font-weight:700;color:#000;flex-shrink:0;margin-right:12px;text-align:center;line-height:24px;">2</div>
                  <div>
                    <div style="font-size:13px;font-weight:500;color:#000;">Set up your inventory database</div>
                    <div style="font-size:12px;color:#aaa;margin-top:2px;">FOH → Inventory → Database</div>
                  </div>
                </div>
                <div style="display:flex;align-items:flex-start;">
                  <div style="width:24px;height:24px;background:#F5B800;border-radius:50%;font-size:12px;font-weight:700;color:#000;flex-shrink:0;margin-right:12px;text-align:center;line-height:24px;">3</div>
                  <div>
                    <div style="font-size:13px;font-weight:500;color:#000;">Build your first order</div>
                    <div style="font-size:12px;color:#aaa;margin-top:2px;">FOH → Ordering → Order</div>
                  </div>
                </div>
              </div>

              <div style="text-align:center;margin-bottom:28px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
                   style="display:inline-block;background:#F5B800;color:#000;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;">
                  Go to Dashboard →
                </a>
              </div>

              <div style="background:#E6F1FB;border-radius:10px;padding:16px 20px;">
                <div style="font-size:13px;font-weight:500;color:#0C447C;margin-bottom:4px;">Need help getting started?</div>
                <div style="font-size:12px;color:#185FA5;">
                  Browse our <a href="${process.env.NEXT_PUBLIC_APP_URL}/help" style="color:#185FA5;">Help Center</a> or 
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/support" style="color:#185FA5;">open a support ticket</a> and we'll get back to you within one business day.
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
    console.error('Welcome email error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}