import type { Request, Response, NextFunction } from "express"
import { deleteUserAccount } from "../services/accountService"
import { getSupabaseAdmin } from "../lib/supabase"

export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    await deleteUserAccount(userId)
    return res.status(204).send()
  } catch (err) {
    return next(err)
  }
}

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("email, first_name, last_name")
      .eq("id", req.user!.id)
      .single()

      if (!data) {
       return res.status(404).json({ error: "Profile not found" })
       }

    if (error) throw error

    return res.json(data)
  } catch (err) {
    next(err)
  }
}
