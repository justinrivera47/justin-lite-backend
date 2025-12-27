import { z } from "zod"

export const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
})

export const respondSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(4000, "Message too long"),
})

