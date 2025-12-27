// src/lib/stripe.ts
import Stripe from "stripe"
import { AppError } from "../errors/AppError"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new AppError("Missing STRIPE_SECRET_KEY", 500, "ENV_MISCONFIGURED")
  }

  _stripe = new Stripe(key, { apiVersion: "2025-12-15.clover" })
  return _stripe
}
