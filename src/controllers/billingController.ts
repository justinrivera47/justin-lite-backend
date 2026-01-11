import { Request, Response, NextFunction } from "express"
import { getSupabaseAdmin } from "../lib/supabase"
import {
  createCheckoutSession,
  getPaymentLinkUrl,
  CheckoutSource,
} from "../services/checkoutService"
import { createPortalSession } from "../services/portalService"
import { AppError } from "../errors/AppError"

export async function startPortalSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id
    const url = await createPortalSession(userId)
    res.status(200).json({ url })
  } catch (err) {
    next(err)
  }
}

export async function startCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id
    const email = req.user!.email

    if (!email) {
      throw new AppError("Email is required for checkout", 400, "EMAIL_REQUIRED")
    }

    // Get source from query or body (default: direct)
    const source = (req.query.source || req.body.source || "direct") as CheckoutSource

    // Validate source
    if (source !== "direct" && source !== "mailchimp") {
      throw new AppError("Invalid checkout source", 400, "INVALID_SOURCE")
    }

    const result = await createCheckoutSession(userId, email, source)

    if (!result.url) {
      throw new AppError("Failed to create checkout session", 500, "CHECKOUT_FAILED")
    }

    res.status(200).json({ url: result.url })
  } catch (err) {
    next(err)
  }
}

export async function getPaymentLink(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id

    // Get source from query (default: direct)
    const source = (req.query.source || "direct") as CheckoutSource

    // Validate source
    if (source !== "direct" && source !== "mailchimp") {
      throw new AppError("Invalid checkout source", 400, "INVALID_SOURCE")
    }

    const url = getPaymentLinkUrl(userId, source)
    res.status(200).json({ url })
  } catch (err) {
    next(err)
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

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("status, current_period_end, plan_code")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      throw new AppError(
        "Failed to fetch subscription status",
        500,
        "SUBSCRIPTION_FETCH_FAILED"
      )
    }

    const active =
      data?.status === "active" || data?.status === "trialing"

    res.setHeader("Cache-Control", "no-store")
    res.setHeader("Pragma", "no-cache")
    res.status(200).json({
      active,
      status: data?.status ?? "none",
      plan_code: data?.plan_code ?? null,
      current_period_end: data?.current_period_end ?? null,
    })
  } catch (err) {
    next(err)
  }
}
