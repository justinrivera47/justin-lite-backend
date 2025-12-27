import { Request, Response, NextFunction } from "express"
import { getSupabaseAdmin } from "../lib/supabase"
import { AuthError } from "../errors/AuthError"

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AuthError("Missing authorization token"))
  }

  const token = authHeader.slice("Bearer ".length).trim()

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !data.user) {
      return next(new AuthError("Invalid or expired token"))
    }

    req.user = data.user
    return next()
  } catch (err) {
    return next(err)
  }
}
