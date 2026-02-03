import type { Request, Response } from "express"
import Stripe from "stripe"
import { getStripe } from "../lib/stripe"
import { upsertSubscription } from "../services/subscriptionService"

function getStripeSignature(req: Request): string | null {
  const sig = req.headers["stripe-signature"]
  if (!sig) return null
  return Array.isArray(sig) ? sig[0] : sig
}

/** Extract period dates from subscription items (moved from top-level in Stripe API 2025+) */
function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0]
  return {
    currentPeriodStart: item?.current_period_start ?? null,
    currentPeriodEnd: item?.current_period_end ?? null,
    stripePriceId: item?.price?.id ?? null,
  }
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

  console.log(`[stripe] webhook received: ${event.type} (${event.id})`)

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        if (!session.subscription || !session.customer) {
          console.log("[stripe] checkout.session.completed: no subscription or customer, skipping")
          break
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        )

        const customer = await stripe.customers.retrieve(
          session.customer as string
        )

        // Deleted customers don't have metadata
        if (customer.deleted) {
          console.warn("[stripe] Customer was deleted, skipping", { customerId: (customer as any).id })
          break
        }

        const userId = (customer as Stripe.Customer).metadata?.userId
        if (!userId) {
          // This is expected for Payment Link customers who haven't completed signup yet
          console.log("[stripe] checkout.session.completed: no userId in customer metadata (Payment Link flow)", {
            customerId: (customer as Stripe.Customer).id,
          })
          break
        }

        const period = getSubscriptionPeriod(subscription)

        await upsertSubscription({
          userId,
          stripeCustomerId: (customer as Stripe.Customer).id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: period.currentPeriodStart,
          currentPeriodEnd: period.currentPeriodEnd,
          stripePriceId: period.stripePriceId,
          planCode: "pro_15",
        })

        console.log("[stripe] checkout.session.completed: subscription upserted", { userId })
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        // 1. Try subscription metadata first
        let userId = subscription.metadata?.userId

        // 2. Fall back to customer metadata
        if (!userId) {
          const customer = await stripe.customers.retrieve(
            subscription.customer as string
          )

          if (!customer.deleted) {
            userId = (customer as Stripe.Customer).metadata?.userId
          }
        }

        // 3. No userId — can't update DB, return 200 to stop retries
        if (!userId) {
          console.warn("[stripe] No userId in subscription or customer metadata", {
            event: event.type,
            subscriptionId: subscription.id,
            customerId: subscription.customer,
          })
          return res.status(200).json({ received: true, warning: "No userId mapped" })
        }

        const period = getSubscriptionPeriod(subscription)

        await upsertSubscription({
          userId,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: period.currentPeriodStart,
          currentPeriodEnd: period.currentPeriodEnd,
          stripePriceId: period.stripePriceId,
          planCode: "pro_15",
        })

        console.log(`[stripe] ${event.type}: subscription upserted`, { userId, status: subscription.status })
        break
      }

      default:
        console.log(`[stripe] unhandled event type: ${event.type}`)
        break
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error("[stripe] webhook handler error:", {
      event: event.type,
      eventId: event.id,
      error: err.message,
      stack: err.stack,
    })
    // Return 200 for errors that retrying won't fix (DB schema issues, missing data)
    // Only return 500 for truly transient errors
    return res.status(200).json({ received: true, error: "Handler error logged" })
  }
}
