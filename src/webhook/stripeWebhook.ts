import type { Request, Response } from "express"
import Stripe from "stripe"
import { getStripe } from "../lib/stripe"
import { upsertSubscription } from "../services/subscriptionService"
import { getSupabaseAdmin } from "../lib/supabase"

// Valid Stripe subscription statuses
const VALID_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "past_due",
  "canceled",
  "trialing",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
])

function getStripeSignature(req: Request): string | null {
  const sig = req.headers["stripe-signature"]
  if (!sig) return null
  return Array.isArray(sig) ? sig[0] : sig
}

// Extract plan code from Stripe price metadata or default based on price
function getPlanCodeFromSubscription(subscription: Stripe.Subscription): string {
  const priceId = subscription.items?.data?.[0]?.price?.id
  const priceMetadata = subscription.items?.data?.[0]?.price?.metadata

  // Check price metadata for plan_code
  if (priceMetadata?.plan_code) {
    return priceMetadata.plan_code
  }

  // Check subscription metadata
  if (subscription.metadata?.plan_code) {
    return subscription.metadata.plan_code
  }

  // Map known price IDs (add your Stripe price IDs here)
  const priceIdToPlan: Record<string, string> = {
    [process.env.STRIPE_PRICE_ID || ""]: "pro_15",
    [process.env.STRIPE_MAILCHIMP_PRICE_ID || ""]: "pro_15_trial",
  }

  return priceIdToPlan[priceId || ""] || "pro_15"
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const stripe = getStripe()
  const supabaseAdmin = getSupabaseAdmin()

  const sig = getStripeSignature(req)
  if (!sig) return res.status(400).json({ error: "Missing Stripe signature" })

  // Validate webhook secret is configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET not configured")
    return res.status(500).json({ error: "Webhook not configured" })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err: any) {
    console.error("[stripe] signature verification failed:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // IDEMPOTENCY: Check if we've already processed this event
  const { data: existingEvent } = await supabaseAdmin
    .from("stripe_events")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle()

  if (existingEvent) {
    // Already processed, return success
    return res.status(200).json({ received: true, skipped: "duplicate" })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        if (!session.subscription || !session.customer) break

        const subscription = (await stripe.subscriptions.retrieve(
          session.subscription as string
        )) as Stripe.Subscription

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

        // Validate status
        if (!VALID_SUBSCRIPTION_STATUSES.has(subscription.status)) {
          console.error("[stripe] Invalid subscription status:", subscription.status)
          break
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start ?? null,
          currentPeriodEnd: subscription.current_period_end ?? null,
          stripePriceId: subscription.items?.data?.[0]?.price?.id ?? null,
          planCode: getPlanCodeFromSubscription(subscription),
        })

        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        // 1. Try to get userId directly from the SUBSCRIPTION metadata first
        let userId = subscription.metadata?.userId

        // 2. If not found, fall back to fetching the CUSTOMER and checking there
        if (!userId) {
          const customer = (await stripe.customers.retrieve(
            subscription.customer as string
          )) as Stripe.Customer
          userId = customer.metadata?.userId
        }

        // 3. Final check: If we still don't have a userId, we can't update the DB
        if (!userId) {
          console.warn("[stripe] No userId found in subscription or customer metadata", {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
          })
          // RETURN 200 so Stripe stops retrying a "broken" event
          return res.status(200).json({ received: true, warning: "No userId mapped" })
        }

        // Validate status
        if (!VALID_SUBSCRIPTION_STATUSES.has(subscription.status)) {
          console.error("[stripe] Invalid subscription status:", subscription.status)
          return res.status(200).json({ received: true, warning: "Invalid status" })
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          // FIXED: Correct property path (was subscription.subscription.current_period_start)
          currentPeriodStart: subscription.current_period_start ?? null,
          currentPeriodEnd: subscription.current_period_end ?? null,
          stripePriceId: subscription.items?.data?.[0]?.price?.id ?? null,
          planCode: getPlanCodeFromSubscription(subscription),
        })

        break
      }

      default:
        break
    }

    // IDEMPOTENCY: Record that we processed this event
    await supabaseAdmin.from("stripe_events").insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    })

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error("[stripe] webhook handler error:", err.message)
    return res.status(500).json({ error: "Webhook handler failed" })
  }
}
