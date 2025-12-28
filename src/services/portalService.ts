import { getStripe } from "../lib/stripe"
import { getSupabaseAdmin } from "../lib/supabase"

export async function createPortalSession(userId: string) {
  const stripe = getStripe()
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!data?.stripe_customer_id) {
    throw new Error("No Stripe customer found")
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/settings`,
  })

  return session.url
}
