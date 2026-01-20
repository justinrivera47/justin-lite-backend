import { Request, Response, NextFunction } from "express"
import { getSupabaseAdmin } from "../lib/supabase"
import { createCheckoutSession } from "../services/checkoutService"
import { createPortalSession } from "../services/portalService"

export async function startPortalSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id
    const url = await createPortalSession(userId)
    return res.status(200).json({ url })
  } catch (err) {
    return next(err)
  }
}

export async function startCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id
    const email = req.user!.email!
    const url = await createCheckoutSession(userId, email)
    return res.status(200).json({ url })
  } catch (err) {
    return next(err)
  }
}

export async function getSubscriptionStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id
    const supabaseAdmin = getSupabaseAdmin()
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle()

    const active = data?.status === "active" || data?.status === "trialing"

    res.setHeader("Cache-Control", "no-store")
    res.setHeader("Pragma", "no-cache")
    return res.status(200).json({
      active,
      status: data?.status ?? "none",
      current_period_end: data?.current_period_end ?? null,
    })
  } catch (err) {
    return next(err)
  }
}
