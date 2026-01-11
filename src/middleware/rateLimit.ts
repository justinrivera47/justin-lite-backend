// src/middleware/rateLimit.ts
import rateLimit from "express-rate-limit"
import type { Request } from "express"

/**
 * Generate a rate limit key from the request.
 * Uses IP when available, falls back to a fingerprint of headers.
 */
function getClientKey(req: Request): string {
  // Primary: Use IP address
  const ip = req.ip || req.socket?.remoteAddress

  if (ip && ip !== "::1" && ip !== "127.0.0.1") {
    return `ip:${ip}`
  }

  // Fallback: Create a fingerprint from headers
  const userAgent = req.headers["user-agent"] || ""
  const acceptLang = req.headers["accept-language"] || ""
  const fingerprint = `${userAgent.slice(0, 50)}:${acceptLang.slice(0, 20)}`

  // Use a hash-like approach to avoid very long keys
  let hash = 0
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return `fp:${hash}`
}

/**
 * Rate limiter for read operations (GET requests)
 * Higher limit as reads are less resource-intensive
 */
export const readRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 240, // 240 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: { error: "Too many requests, please try again later", code: "RATE_LIMITED" },
})

/**
 * Rate limiter for write operations (POST, PUT, PATCH, DELETE)
 * Lower limit as writes are more resource-intensive
 */
export const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  message: { error: "Too many requests, please try again later", code: "RATE_LIMITED" },
})

/**
 * Rate limiter for AI operations
 * Most restrictive as these are expensive API calls
 * Uses user ID when available for more accurate limiting
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Prefer user ID for authenticated requests
    const userId = (req as any).user?.id
    if (typeof userId === "string" && userId.length > 0) {
      return `user:${userId}`
    }
    // Fall back to client key
    return getClientKey(req)
  },
  message: { error: "Too many AI requests, please try again later", code: "AI_RATE_LIMITED" },
})

/**
 * Stricter rate limiter for sensitive operations like account deletion
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as any).user?.id
    if (typeof userId === "string" && userId.length > 0) {
      return `user:${userId}`
    }
    return getClientKey(req)
  },
  message: { error: "Too many attempts, please try again later", code: "STRICT_RATE_LIMITED" },
})
