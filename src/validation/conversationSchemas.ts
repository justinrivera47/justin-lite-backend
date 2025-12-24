import { z } from "zod"

export const createConversationSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  system_prompt: z.string().max(2000).optional(),
})
