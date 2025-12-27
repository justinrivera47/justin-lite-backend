import { Request, Response } from "express"
import { stripe } from "../lib/stripe"
import { upsertSubscription } from "../services/subscriptionService"
import Stripe from "stripe"

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"]

  if (!sig) {
    return res.status(400).json({ error: "Missing Stripe signature" })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any
if (!session.subscription || !session.customer) {
    break
  }

 const subscription = await stripe.subscriptions.retrieve(session.subscription as string)


  const customer = await stripe.customers.retrieve(
    session.customer
  ) as Stripe.Customer

  const userId = customer.metadata?.userId

  if (!userId) {
    console.error("Missing userId in Stripe customer metadata")
    break
  }

  await upsertSubscription({
    userId,
    stripeCustomerId: customer.id,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: subscription.items.data[0]?.current_period_end ?? null,
    planCode: subscription.items.data[0]?.price?.id,
  })

  break
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as any
const customer = await stripe.customers.retrieve(
    subscription.customer
  ) as any

  const userId = customer.metadata?.userId

  if (!userId) {
    console.error("Missing userId in Stripe customer metadata")
    break
  }

  await upsertSubscription({
    userId,
    stripeCustomerId: customer.id,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    planCode: subscription.items.data[0]?.price?.id,
  })
      break
    }
  }

  res.status(200).json({ received: true })
}
