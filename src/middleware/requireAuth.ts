import { Request, Response, NextFunction } from "express"
import { supabaseAdmin } from "../lib/supabase"

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" })
    }

    const token = authHeader.replace("Bearer ", "").trim()

    const { data, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" })
    }

    req.user = data.user
    next()
  } catch (err) {
    console.error("[Auth Error]", err)
    return res.status(401).json({ error: "Unauthorized" })
  }
}
