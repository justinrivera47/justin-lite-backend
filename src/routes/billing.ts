import { Router } from "express"
import { requireAuth } from "../middleware/requireAuth"
import {
  getSubscriptionStatus,
  startCheckoutSession,
  startPortalSession,
} from "../controllers/billingController"

const router = Router()

router.get("/status", requireAuth, getSubscriptionStatus)
router.post("/create-checkout-session", requireAuth, startCheckoutSession)
router.post("/create-portal-session", requireAuth, startPortalSession)

export default router
