import { Request, Response } from "express"
import { getSupabaseAdmin } from "../lib/supabase"
import { createCheckoutSession } from "../services/chechoutService"
import { createPortalSession } from "../services/portalService"

export async function startPortalSession(
  req: Request,
  res: Response
) {
  const userId = req.user!.id

  const url = await createPortalSession(userId)

  res.status(200).json({ url })
}


export async function startCheckoutSession(
  req: Request,
  res: Response
) {
  const userId = req.user!.id
  const email = req.user!.email!

  const url = await createCheckoutSession(userId, email)

  res.status(200).json({ url })
}


export async function getSubscriptionStatus(
  req: Request,
  res: Response
) {
  const userId = req.user!.id
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .single()

  const active = data?.status === "active"

  res.status(200).json({
    active,
    status: data?.status ?? "none",
    current_period_end: data?.current_period_end ?? null,
  })
}
