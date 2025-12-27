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
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", req.user.id)
    .single()

  if (!data || data.status !== "active") {
    throw new AuthError("Active subscription required")
  }

  next()
}
