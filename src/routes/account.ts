// src/routes/account.ts
import { Router } from "express"
import { requireAuth } from "../middleware/requireAuth"
import { validate } from "../middleware/validate"
import { readRateLimiter, writeRateLimiter, strictRateLimiter } from "../middleware/rateLimit"
import { updateProfileSchema, deleteAccountSchema } from "../validation/accountSchemas"
import { updateUserProfile } from "../services/accountService"
import { deleteAccount, getProfile } from "../controllers/accountController"

const router = Router()

// Profile read (rate limited)
router.get("/profile", requireAuth, readRateLimiter, getProfile)

// Profile update (rate limited + validated)
router.patch(
  "/profile",
  requireAuth,
  writeRateLimiter,
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id
      const { first_name, last_name } = req.body
      const updated = await updateUserProfile(userId, first_name, last_name)
      res.json(updated)
    } catch (err) {
      next(err)
    }
  }
)

// Account deletion (requires confirmation, strictly rate limited)
router.delete(
  "/",
  requireAuth,
  strictRateLimiter,
  validate(deleteAccountSchema),
  deleteAccount
)

export default router
