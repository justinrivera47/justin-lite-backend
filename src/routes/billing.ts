import { Router } from "express"
import { requireAuth } from "../middleware/requireAuth"
import { writeRateLimiter, readRateLimiter } from "../middleware/rateLimit"
import {
  getSubscriptionStatus,
  startCheckoutSession,
  startPortalSession,
  getPaymentLink,
} from "../controllers/billingController"

const router = Router()

// Read operations
router.get("/status", requireAuth, readRateLimiter, getSubscriptionStatus)

// Write operations (rate limited more strictly)
router.post("/create-checkout-session", requireAuth, writeRateLimiter, startCheckoutSession)
router.post("/create-portal-session", requireAuth, writeRateLimiter, startPortalSession)

// Payment link (alternative to checkout session)
router.get("/payment-link", requireAuth, readRateLimiter, getPaymentLink)

export default router
