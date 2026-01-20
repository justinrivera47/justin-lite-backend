// src/controllers/signupController.ts
import { Request, Response, NextFunction } from "express"
import {
  getCheckoutSessionEmail,
  completeSignup as completeSignupService,
  checkEmailExists,
} from "../services/signupService"

export async function getSessionEmail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { sessionId } = req.params

    const result = await getCheckoutSessionEmail(sessionId)

    return res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

export async function completeSignup(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { session_id, password } = req.body

    const result = await completeSignupService(session_id, password)

    return res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

export async function checkEmail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const email = req.query.email as string

    const result = await checkEmailExists(email)

    return res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}
