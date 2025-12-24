import { Request, Response, NextFunction } from "express"

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now()

  res.on("finish", () => {
    const duration = Date.now() - start

    const log = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      userId: req.user?.id || null,
      env: process.env.ENVIRONMENT || "unknown",
    }

    if (process.env.NODE_ENV !== "test") {
      if (res.statusCode >= 500) {
        console.error("[REQUEST_ERROR]", log)
      } else if (res.statusCode >= 400) {
        console.warn("[REQUEST_WARN]", log)
      } else {
        console.info("[REQUEST]", log)
      }
    }
  })

  next()
}
