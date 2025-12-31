import type { Request, Response } from "express"
import Stripe from "stripe"
import { getStripe } from "../lib/stripe"
import { upsertSubscription } from "../services/subscriptionService"

function getStripeSignature(req: Request): string | null {
  const sig = req.headers["stripe-signature"]
  if (!sig) return null
  return Array.isArray(sig) ? sig[0] : sig
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const stripe = getStripe()

  const sig = getStripeSignature(req)
  if (!sig) return res.status(400).json({ error: "Missing Stripe signature" })

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error("[stripe] signature verification failed:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        if (!session.subscription || !session.customer) break

        const subscription = (await stripe.subscriptions.retrieve(
          session.subscription as string
        )) as unknown as Stripe.Subscription

        const customer = (await stripe.customers.retrieve(
          session.customer as string
        )) as Stripe.Customer

        const userId = customer.metadata?.userId
        if (!userId) {
          console.error("[stripe] Missing userId in customer metadata", {
            customerId: customer.id,
          })
          break
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: (subscription as any).current_period_start ?? null,
          currentPeriodEnd: (subscription as any).current_period_end ?? null,
          stripePriceId:
            (subscription as any).items?.data?.[0]?.price?.id ?? null,
          planCode: "pro_15",
        })

        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        const customer = (await stripe.customers.retrieve(
          subscription.customer as string
        )) as Stripe.Customer

        const userId = customer.metadata?.userId
        if (!userId) {
          console.error("[stripe] Missing userId in customer metadata", {
            customerId: customer.id,
            subscriptionId: subscription.id,
          })
          break
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: (subscription as any).current_period_start ?? null,
          currentPeriodEnd: (subscription as any).current_period_end ?? null,
          stripePriceId:
            (subscription as any).items?.data?.[0]?.price?.id ?? null,
          planCode: "pro_15",
        })

        break
      }

      default:
        break
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error("[stripe] webhook handler error:", err.message)
    return res.status(500).json({ error: "Webhook handler failed" })
  }
}
