import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.supabase_user_id
        const plan = session.metadata?.plan || 'foh'
        if (!userId) break

        const isBOH = plan === 'bundle' || plan === 'boh_addon'
        const tier = plan === 'bundle' ? 'both' : 'foh'

        await supabase.from('profiles').update({
          subscription_status: 'trial',
          subscription_tier: tier,
          boh_access: isBOH,
          stripe_subscription_id: session.subscription,
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq('id', userId)
        break
      }

      case 'customer.subscription.trial_will_end': {
        // 3 days before trial ends — good place to send reminder email later
        console.log('Trial ending soon for subscription:', event.data.object.id)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        const status = subscription.status
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()

        let subscriptionStatus = 'active'
        if (status === 'trialing') subscriptionStatus = 'trial'
        if (status === 'past_due') subscriptionStatus = 'past_due'
        if (status === 'canceled') subscriptionStatus = 'cancelled'
        if (status === 'unpaid') subscriptionStatus = 'cancelled'

        await supabase.from('profiles').update({
          subscription_status: subscriptionStatus,
          current_period_ends_at: periodEnd,
        }).eq('id', userId)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        await supabase.from('profiles').update({
          subscription_status: 'cancelled',
          boh_access: false,
        }).eq('id', userId)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (!invoice.subscription) break

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription)
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        await supabase.from('profiles').update({
          subscription_status: 'active',
          current_period_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq('id', userId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        if (!invoice.subscription) break

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription)
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        await supabase.from('profiles').update({
          subscription_status: 'past_due',
        }).eq('id', userId)
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }
  } catch (error) {
    console.error('Webhook handler error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ received: true })
}