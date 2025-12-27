// src/middleware/rateLimit.ts
import rateLimit, { ipKeyGenerator } from "express-rate-limit"
import type { Request } from "express"

export const readRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown"),
})

export const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown"),
})

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id
    return typeof userId === "string" && userId.length > 0
      ? userId
      : ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown")
  },
})
