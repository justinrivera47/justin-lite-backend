import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { AppError } from "../errors/AppError"

let _admin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new AppError(
      "Missing Supabase environment variables",
      500,
      "ENV_MISCONFIGURED"
    )
  }

  _admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  return _admin
}
