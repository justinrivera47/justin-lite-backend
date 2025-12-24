import { Request, Response, NextFunction } from "express"
import { AppError } from "../errors/AppError"

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Known, trusted errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    })
  }

  // Unknown / programmer errors
  console.error("UNHANDLED ERROR:", err)

  return res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  })
}
