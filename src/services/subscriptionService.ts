import { getSupabaseAdmin } from "../lib/supabase"

type PersistSubscriptionArgs = {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  status: string
  currentPeriodEnd?: number | null
  planCode?: string | null
  stripePriceId?: string | null
}

export async function upsertSubscription({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  currentPeriodEnd = null,
  planCode = "pro_15",
  stripePriceId = null,
}: PersistSubscriptionArgs) {
  const supabaseAdmin = getSupabaseAdmin()

  const payload = {
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    status,
    current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null,
    plan_code: planCode,
    stripe_price_id: stripePriceId,
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(payload, { onConflict: "user_id" })

  if (error) {
    console.error("Failed to persist subscription:", error)
    throw error
  }
}
