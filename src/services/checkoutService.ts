// src/services/checkoutService.ts

import { getStripe } from "../lib/stripe"
import { getSupabaseAdmin } from "../lib/supabase"
import { AppError } from "../errors/AppError"

export type CheckoutSource = "direct" | "mailchimp"

interface CheckoutResult {
  url: string | null
  error?: string
}

/**
 * Creates a checkout session for a user.
 * - Reuses existing Stripe customer if available
 * - Prevents duplicate checkouts for users with active subscriptions
 * - Supports multiple checkout sources (direct vs mailchimp with trial)
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  source: CheckoutSource = "direct"
): Promise<CheckoutResult> {
  const stripe = getStripe()
  const supabaseAdmin = getSupabaseAdmin()

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    throw new AppError("Invalid email address", 400, "INVALID_EMAIL")
  }

  // Check if user already has an active subscription
  const { data: existingSub } = await supabaseAdmin
    .from("subscriptions")
    .select("status, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (existingSub?.status === "active" || existingSub?.status === "trialing") {
    throw new AppError(
      "You already have an active subscription",
      409,
      "ALREADY_SUBSCRIBED"
    )
  }

  // Reuse existing Stripe customer if available
  let customerId = existingSub?.stripe_customer_id

  if (!customerId) {
    // Also check users table for existing customer ID
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle()

    customerId = user?.stripe_customer_id
  }

  // Only create new customer if we don't have one
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    })
    customerId = customer.id

    // Store customer ID immediately to prevent race conditions
    await supabaseAdmin
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId)
  }

  // Select price based on source
  const priceId =
    source === "mailchimp"
      ? process.env.STRIPE_MAILCHIMP_PRICE_ID
      : process.env.STRIPE_PRICE_ID

  if (!priceId) {
    throw new AppError(
      `Stripe price not configured for source: ${source}`,
      500,
      "PRICE_NOT_CONFIGURED"
    )
  }

  // Build session config
  const sessionConfig: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: { userId, source },
    },
    success_url: `${process.env.FRONTEND_URL}/billing/success`,
    cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
  }

  // Add trial period for mailchimp source
  if (source === "mailchimp") {
    sessionConfig.subscription_data!.trial_period_days = 7
  }

  const session = await stripe.checkout.sessions.create(sessionConfig)

  return { url: session.url }
}

/**
 * Creates a checkout URL using Stripe Payment Links
 * This is an alternative to checkout sessions for simpler flows
 */
export function getPaymentLinkUrl(
  userId: string,
  source: CheckoutSource = "direct"
): string {
  const linkId =
    source === "mailchimp"
      ? process.env.STRIPE_MAILCHIMP_PAYMENT_LINK_ID
      : process.env.STRIPE_PAYMENT_LINK_ID

  if (!linkId) {
    throw new AppError(
      `Payment link not configured for source: ${source}`,
      500,
      "LINK_NOT_CONFIGURED"
    )
  }

  // Payment links can have prefilled data via URL params
  const baseUrl = `https://buy.stripe.com/${linkId}`
  const params = new URLSearchParams({
    prefilled_email: "", // Will be filled by frontend
    client_reference_id: userId,
  })

  return `${baseUrl}?${params.toString()}`
}
