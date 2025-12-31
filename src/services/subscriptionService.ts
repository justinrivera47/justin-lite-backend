import { getSupabaseAdmin } from "../lib/supabase"

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

export async function upsertSubscription({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  currentPeriodStart = null,
  currentPeriodEnd = null,
  planCode = "pro_15",
  stripePriceId = null,
}: PersistSubscriptionArgs) {
  const supabaseAdmin = getSupabaseAdmin()

  const currentStartIso = toIso(currentPeriodStart)
  const currentEndIso = toIso(currentPeriodEnd)

  // 1) subscriptions (canonical record)
  const { error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        status,
        plan_code: planCode,
        stripe_price_id: stripePriceId,
        current_period_start: currentStartIso,
        current_period_end: currentEndIso,
      },
      { onConflict: "user_id" } // requires UNIQUE on subscriptions.user_id
    )

  if (subErr) {
    console.error("Failed to persist subscription:", subErr)
    throw subErr
  }

  // 2) users (denormalized fields for fast gating/UI)
  const { error: userErr } = await supabaseAdmin
    .from("users")
    .update({
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_status: status,
      plan_code: planCode,
      current_period_end: currentEndIso,
    })
    .eq("id", userId)

  if (userErr) {
    console.error("Failed to update user subscription fields:", userErr)
    throw userErr
  }
}
