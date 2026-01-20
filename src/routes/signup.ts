// src/routes/signup.ts
import { Router } from "express"
import { validate } from "../middleware/validate"
import { writeRateLimiter } from "../middleware/rateLimit"
import { completeSignupSchema } from "../validation/signupSchemas"
import { getSessionEmail, completeSignup } from "../controllers/signupController"

const router = Router()

// Public endpoints - no auth required (user doesn't exist yet)
router.get("/session/:sessionId", getSessionEmail)
router.post("/complete", writeRateLimiter, validate(completeSignupSchema), completeSignup)

export default router
