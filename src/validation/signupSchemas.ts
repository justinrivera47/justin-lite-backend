// src/validation/signupSchemas.ts
import { z } from "zod"

export const completeSignupSchema = z.object({
  session_id: z.string().min(1, "Session ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})
