import { supabaseAdmin } from "../lib/supabase"

type PersistSubscriptionArgs = {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  status: string
  currentPeriodEnd?: number
  planCode?: string
}

export async function upsertSubscription({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  currentPeriodEnd,
  planCode,
}: PersistSubscriptionArgs) {
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert({
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      status,
      current_period_end: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
      plan_code: planCode ?? null,
    })

  if (error) {
    console.error("Failed to persist subscription:", error)
    throw error
  }
}
