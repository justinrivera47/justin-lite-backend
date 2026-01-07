// services/accountServices.ts
import { getSupabaseAdmin } from "../lib/supabase"
import { getStripe } from "../lib/stripe"

export async function deleteUserAccount(userId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const stripe = getStripe()

  // 1. Stripe Cleanup
  const { data: subRow } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle()

  if (subRow?.stripe_subscription_id && subRow.status !== 'canceled') {
    await stripe.subscriptions.cancel(subRow.stripe_subscription_id)
  }

  // 2. Data Scrubbing (Dependency Order)
  // We include user_memories here to ensure complete deletion
  const tables = ["messages", "conversations", "user_memories", "user_context", "subscriptions"]
  
  for (const table of tables) {
    await supabaseAdmin.from(table).delete().eq("user_id", userId)
  }

  // 3. Final Identity Deletion
  await supabaseAdmin.from("users").delete().eq("id", userId)
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  
  if (authErr) throw authErr
}