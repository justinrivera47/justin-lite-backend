import { getSupabaseAdmin, supabaseAdmin } from "../lib/supabase"
import { getStripe } from "../lib/stripe"

export async function deleteUserAccount(userId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const stripe = getStripe()

  // 1) Find subscription (if any)
  const { data: subRow, error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id, status")
    .eq("user_id", userId)
    .maybeSingle()

  if (subErr) throw subErr

  // 2) Cancel Stripe subscription if exists + not already canceled
  if (subRow?.stripe_subscription_id) {
    const status = subRow.status
    const shouldCancel =
      status === "active" || status === "trialing" || status === "past_due"

    if (shouldCancel) {
      await stripe.subscriptions.cancel(subRow.stripe_subscription_id)
      // Let webhook update DB status if you want; or update immediately below.
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", userId)
    }
  }

  // 3) Delete app data (recommended)
  // If your DB has ON DELETE CASCADE relationships, you can just delete the user row.
  // Otherwise delete in dependency order.
  await supabaseAdmin.from("messages").delete().eq("user_id", userId)
  await supabaseAdmin.from("conversations").delete().eq("user_id", userId)
  await supabaseAdmin.from("user_context").delete().eq("user_id", userId)
  await supabaseAdmin.from("subscriptions").delete().eq("user_id", userId)
  await supabaseAdmin.from("users").delete().eq("id", userId)

  // 4) Delete Supabase Auth user (this is what actually kills login)
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authErr) throw authErr
}

export async function updateUserProfile(
  userId: string,
  firstName?: string,
  lastName?: string
) {
  const update: Record<string, string> = {};

  if (firstName !== undefined) update.first_name = firstName;
  if (lastName !== undefined) update.last_name = lastName;

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(update)
    .eq("id", userId)
    .select("id, email, first_name, last_name")
    .single();

  if (error) throw error;
  return data;
}