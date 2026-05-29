import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { priceId, userId, email, plan } = await request.json()

    if (!priceId || !userId || !email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, first_name, last_name, bar_name')
      .eq('id', userId)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
        metadata: {
          supabase_user_id: userId,
          bar_name: profile?.bar_name || ''
        }
      })
      customerId = customer.id

      await supabase.from('profiles').update({
        stripe_customer_id: customerId
      }).eq('id', userId)
    }

    // Create checkout session with 14 day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: userId,
          plan: plan || 'foh'
        }
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?subscription=cancelled`,
      metadata: {
        supabase_user_id: userId,
        plan: plan || 'foh'
      }
    })

    return Response.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}