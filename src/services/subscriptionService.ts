import { getSupabaseAdmin } from "../lib/supabase"

// Valid Stripe subscription statuses
const VALID_STATUSES = new Set([
  "active",
  "past_due",
  "canceled",
  "trialing",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
])

type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "trialing"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"

type PersistSubscriptionArgs = {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  status: string
  currentPeriodStart?: number | null
  currentPeriodEnd?: number | null
  planCode?: string | null
  stripePriceId?: string | null
}

const toIso = (unix?: number | null) =>
  unix ? new Date(unix * 1000).toISOString() : null

/**
 * Upserts subscription data to both subscriptions and users tables.
 * Validates status against known Stripe statuses.
 */
export async function upsertSubscription({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  currentPeriodStart = null,
  currentPeriodEnd = null,
  planCode = "pro_15",
  stripePriceId = null,
}: PersistSubscriptionArgs): Promise<void> {
  // Validate status
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid subscription status: ${status}`)
  }

  const validatedStatus = status as SubscriptionStatus
  const supabaseAdmin = getSupabaseAdmin()

  const currentStartIso = toIso(currentPeriodStart)
  const currentEndIso = toIso(currentPeriodEnd)

  // Prepare subscription record
  const subscriptionRecord = {
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    status: validatedStatus,
    plan_code: planCode,
    stripe_price_id: stripePriceId,
    current_period_start: currentStartIso,
    current_period_end: currentEndIso,
    updated_at: new Date().toISOString(),
  }

  // Prepare user update
  const userUpdate = {
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    subscription_status: validatedStatus,
    plan_code: planCode,
    current_period_end: currentEndIso,
    updated_at: new Date().toISOString(),
  }

  // 1) subscriptions (canonical record)
  const { error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .upsert(subscriptionRecord, { onConflict: "user_id" })

  if (subErr) {
    console.error("Failed to persist subscription:", subErr)
    throw new Error(`Subscription upsert failed: ${subErr.message}`)
  }

  // 2) users (denormalized fields for fast gating/UI)
  const { error: userErr } = await supabaseAdmin
    .from("users")
    .update(userUpdate)
    .eq("id", userId)

  if (userErr) {
    // Log but don't throw - subscriptions table is canonical
    // The denormalized user fields can be fixed by a sync job
    console.error("Failed to update user subscription fields:", userErr)
  }
}

/**
 * Gets subscription status for a user
 */
export async function getSubscription(userId: string) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to get subscription: ${error.message}`)
  }

  return data
}

/**
 * Checks if a user has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getSubscription(userId)
  return subscription?.status === "active" || subscription?.status === "trialing"
}
