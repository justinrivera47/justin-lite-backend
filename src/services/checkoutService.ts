// src/services/checkoutService.ts

import { getStripe } from "../lib/stripe"

export async function createCheckoutSession(userId: string, email: string) {
  const stripe = getStripe()

  const customer = await stripe.customers.create({
    email,
    metadata: { userId }, 
  })

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: { userId },
    },
    success_url: `${process.env.FRONTEND_URL}/billing/success`,
    cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
  })

  return session.url
}