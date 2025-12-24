import { createClient } from "@supabase/supabase-js"
import { AppError } from "../errors/AppError"

const supabaseUrl = process.env.SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new AppError(
    "Missing Supabase environment variables",
    500,
    "ENV_MISCONFIGURED"
  )
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
    },
  }
)
