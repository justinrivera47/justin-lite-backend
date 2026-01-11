// Environment variable validation and access
// This module should be imported early in the application lifecycle

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

// Validate required environment variables at startup
export function validateEnv(): void {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "FRONTEND_URL",
  ]

  const missing: string[] = []
  for (const name of required) {
    if (!process.env[name]) {
      missing.push(name)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }

  // Validate FRONTEND_URL format
  const frontendUrl = process.env.FRONTEND_URL!
  if (!frontendUrl.startsWith("http://") && !frontendUrl.startsWith("https://")) {
    throw new Error("FRONTEND_URL must include http:// or https://")
  }

  // Validate Supabase URL format
  const supabaseUrl = process.env.SUPABASE_URL!
  if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
    throw new Error("SUPABASE_URL must include http:// or https://")
  }

  // Warn about optional but recommended variables
  const recommended = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID",
  ]

  for (const name of recommended) {
    if (!process.env[name]) {
      console.warn(`[env] Warning: ${name} not set - billing features will be disabled`)
    }
  }
}

// Exported validated values
export const FRONTEND_URL = requireEnv("FRONTEND_URL")

// Stripe environment variables (optional for non-billing deployments)
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID
export const STRIPE_MAILCHIMP_PRICE_ID = process.env.STRIPE_MAILCHIMP_PRICE_ID
export const STRIPE_MAILCHIMP_PAYMENT_LINK_ID = process.env.STRIPE_MAILCHIMP_PAYMENT_LINK_ID || "plink_1SoEKuGuDQYqi1LCMmaHul0F"
export const STRIPE_PAYMENT_LINK_ID = process.env.STRIPE_PAYMENT_LINK_ID
