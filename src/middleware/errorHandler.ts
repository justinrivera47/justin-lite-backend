import type { Request, Response, NextFunction } from "express"
import { AppError } from "../errors/AppError"
import { ValidationError } from "../errors/ValidationError"

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const base = { error: err.message, code: err.code }
    if (err instanceof ValidationError && err.details) {
      return res.status(err.statusCode).json({ ...base, details: err.details })
    }
    return res.status(err.statusCode).json(base)
  }

  console.error("UNHANDLED ERROR:", err)
  return res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" })
}
