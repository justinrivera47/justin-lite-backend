// src/services/signupService.ts
import { getStripe } from "../lib/stripe"
import { getSupabaseAdmin } from "../lib/supabase"
import { upsertSubscription } from "./subscriptionService"
import { AppError } from "../errors/AppError"

type CheckoutEmailResult = {
  email: string
  exists: boolean
}

type CheckEmailResult = {
  exists: boolean
}

type CompleteSignupResult = {
  success: boolean
  userId: string
}

export async function getCheckoutSessionEmail(
  sessionId: string
): Promise<CheckoutEmailResult> {
  const stripe = getStripe()
  const supabaseAdmin = getSupabaseAdmin()

  // Retrieve the checkout session from Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (!session) {
    throw new AppError("Invalid checkout session", 400, "INVALID_SESSION")
  }

  if (session.payment_status !== "paid") {
    throw new AppError("Payment not completed", 400, "PAYMENT_INCOMPLETE")
  }

  const email = session.customer_details?.email
  if (!email) {
    throw new AppError("No email found in checkout session", 400, "NO_EMAIL")
  }

  // Check if user already exists
  const { data: existingUsers } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(1)

  const exists = !!(existingUsers && existingUsers.length > 0)

  return { email, exists }
}

export async function completeSignup(
  sessionId: string,
  password: string
): Promise<CompleteSignupResult> {
  const stripe = getStripe()
  const supabaseAdmin = getSupabaseAdmin()

  // Retrieve the checkout session from Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (!session) {
    throw new AppError("Invalid checkout session", 400, "INVALID_SESSION")
  }

  if (session.payment_status !== "paid") {
    throw new AppError("Payment not completed", 400, "PAYMENT_INCOMPLETE")
  }

  const email = session.customer_details?.email
  if (!email) {
    throw new AppError("No email found in checkout session", 400, "NO_EMAIL")
  }

  // Check if user already exists
  const { data: existingUsers } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(1)

  if (existingUsers && existingUsers.length > 0) {
    throw new AppError("User already exists", 409, "USER_EXISTS")
  }

  // Create the user in Supabase Auth
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since they paid
    })

  if (authError || !authData.user) {
    console.error("[signup] Failed to create user:", authError)
    throw new AppError(
      authError?.message || "Failed to create account",
      500,
      "USER_CREATION_FAILED"
    )
  }

  const userId = authData.user.id

  // Create user record in users table
  const { error: userTableError } = await supabaseAdmin.from("users").insert({
    id: userId,
    email,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (userTableError) {
    console.error("[signup] Failed to create user record:", userTableError)
    // Don't fail the whole signup, auth user is created
  }

  // Get the Stripe customer ID and subscription
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (customerId && subscriptionId) {
    // Update Stripe customer with userId metadata
    await stripe.customers.update(customerId, {
      metadata: { userId },
    })

    // Retrieve subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    // Update subscription metadata
    await stripe.subscriptions.update(subscriptionId, {
      metadata: { userId },
    })

    // Extract period from subscription items (Stripe API 2025+)
    const item = subscription.items?.data?.[0]

    // Create subscription record in database
    await upsertSubscription({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: subscription.status,
      currentPeriodStart: item?.current_period_start ?? null,
      currentPeriodEnd: item?.current_period_end ?? null,
      stripePriceId: item?.price?.id ?? null,
      planCode: "pro_15",
    })
  }

  return { success: true, userId }
}

export async function checkEmailExists(email: string): Promise<CheckEmailResult> {
  const supabaseAdmin = getSupabaseAdmin()

  if (!email) {
    throw new AppError("Email is required", 400, "EMAIL_REQUIRED")
  }

  const { data: existingUsers } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .limit(1)

  const exists = !!(existingUsers && existingUsers.length > 0)

  return { exists }
}
