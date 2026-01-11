import { Request, Response, NextFunction } from "express"
import { getSupabaseAdmin } from "../lib/supabase"
import { AuthError } from "../errors/AuthError"

export async function requireActiveSubscription(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.user) {
    throw new AuthError("Not authenticated")
  }
  const supabaseAdmin = getSupabaseAdmin()
  const allowed = new Set(["active", "trialing"])

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", req.user.id)
    .maybeSingle()

  if (error) {
    throw new AuthError("Failed to verify subscription")
  }

  if (!data || !allowed.has(data.status)) {
    throw new AuthError("Active subscription required")
  }

  next()
}
