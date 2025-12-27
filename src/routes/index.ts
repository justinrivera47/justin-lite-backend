// src/routes/index.ts (or wherever your router lives)
import { Router } from "express"
import { requireAuth } from "../middleware/requireAuth"
import { aiRateLimiter } from "../middleware/rateLimit"
import { validate } from "../middleware/validate"
import { respondSchema } from "../validation/messageSchemas"

import { createMessage } from "../services/messageService"
import { generateAssistantResponse } from "../services/aiService"

import { getSupabaseAdmin } from "../lib/supabase"
import { updateConversationSummary } from "../services/summaryService"
import { extractUserMemory } from "../services/memoryService"

const router = Router()

router.post(
  "/conversations/:id/respond",
  requireAuth,
  aiRateLimiter,
  validate(respondSchema),
  async (req, res, next) => {
    try {
      const conversationId = req.params.id
      const userId = req.user!.id
      const content = req.body.content as string
      const userMessage = await createMessage(conversationId, userId, "user", content)
      const assistantMessage = await generateAssistantResponse(conversationId, userId)
      const supabaseAdmin = getSupabaseAdmin()

      const MESSAGE_THRESHOLD = 6
      const REFLECTION_THRESHOLD = 3

      const { count } = await supabaseAdmin
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversationId)

      if (count && count % MESSAGE_THRESHOLD === 0) {
        await updateConversationSummary(conversationId, userId)

        const { data: convo } = await supabaseAdmin
          .from("conversations")
          .select("summary_count, user_id")
          .eq("id", conversationId)
          .single()

        if (convo?.summary_count && convo.summary_count % REFLECTION_THRESHOLD === 0) {
          const { data: summaries } = await supabaseAdmin
            .from("conversations")
            .select("summary")
            .eq("user_id", convo.user_id)
            .order("updated_at", { ascending: false })
            .limit(REFLECTION_THRESHOLD)

          await extractUserMemory(
            convo.user_id,
            summaries?.map((s) => s.summary).filter(Boolean) ?? []
          )
        }
      }
      return res.status(201).json({ userMessage, assistantMessage })
    } catch (err) {
      return next(err)
    }
  }
)

export default router
