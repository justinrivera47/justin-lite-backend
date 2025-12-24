import { z } from "zod"

export const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
})

export const respondSchema = z.object({
  // no body required now, but keeps contract explicit
})
