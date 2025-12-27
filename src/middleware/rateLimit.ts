// src/middleware/rateLimit.ts
import { rateLimit, ipKeyGenerator } from "express-rate-limit"
import type { Request } from "express"

const keyFromReq = (req: Request) => ipKeyGenerator(req.ip ?? "unknown")

export const readRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFromReq,
})

export const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyFromReq,
})

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as any).user?.id ?? keyFromReq(req),
})
