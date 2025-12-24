import rateLimit from "express-rate-limit"
import { Request } from "express"

const userKeyGenerator = (req: Request): string => {
  if (req.user && req.user.id) {
    return `user:${req.user.id}`
  }

  return `ip:${req.ip}`
}

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: {
    error: "Too many AI requests. Please slow down.",
  },
})

// Moderate limiter for writes
export const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: {
    error: "Too many requests. Please slow down.",
  },
})

export const readRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
})
