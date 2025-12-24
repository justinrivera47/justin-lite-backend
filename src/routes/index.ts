import { Router } from "express"
import { requireAuth } from "../middleware/requireAuth"
import {
  createConversation,
  getUserConversations,
  getConversationById,
  deleteConversation,
} from "../services/conversationService"
import {
  getMessagesForConversation,
  createMessage,
} from "../services/messageService"
import { generateAssistantResponse } from "../services/aiService"
import { extractUserMemory } from "../services/memoryService"
import { updateConversationSummary } from "../services/summaryService"
import { supabaseAdmin } from "../lib/supabase"
import { validate } from "../middleware/validate"
import { createConversationSchema } from "../validation/conversationSchemas"
import { createMessageSchema, respondSchema } from "../validation/messageSchemas"
import { aiRateLimiter, readRateLimiter, writeRateLimiter } from "../middleware/rateLimit"

const router = Router()

// ---- Conversations ----

router.post("/conversations", 
  requireAuth,
  writeRateLimiter, 
  validate(createConversationSchema), 
  async (req, res) => {
  try {
    const convo = await createConversation(
      req.user!.id,
      req.body.title
    )
    res.status(201).json(convo)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.get("/conversations", 
  requireAuth, 
  readRateLimiter,
  async (req, res) => {
  const convos = await getUserConversations(req.user!.id)
  res.json(convos)
})

router.get("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const convo = await getConversationById(
      req.params.id,
      req.user!.id
    )
    res.json(convo)
  } catch (err: any) {
    res.status(404).json({ error: err.message })
  }
})

router.delete("/conversations/:id", requireAuth, async (req, res) => {
  try {
    await deleteConversation(req.params.id, req.user!.id)
    res.status(204).send()
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// ---- Messages ----

router.get(
  "/conversations/:id/messages",
  requireAuth,
  async (req, res) => {
    try {
      const messages = await getMessagesForConversation(
        req.params.id,
        req.user!.id
      )
      res.json(messages)
    } catch (err: any) {
      res.status(404).json({ error: err.message })
    }
  }
)

router.post(
  "/conversations/:id/messages",
  requireAuth,
  writeRateLimiter,
  validate(createMessageSchema),
  async (req, res) => {
    try {
      const message = await createMessage(
        req.params.id,
        req.user!.id,
        "user",
        req.body.content
      )
      res.status(201).json(message)
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  }
)

router.post(
  "/conversations/:id/respond",
  requireAuth,
  aiRateLimiter,
  validate(respondSchema),
  async (req, res) => {
    try {
      const conversationId = req.params.id
      const userId = req.user!.id

      const assistantMessage =
        await generateAssistantResponse(conversationId, userId)

      const MESSAGE_THRESHOLD = 6
      const { count } = await supabaseAdmin
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversationId)

      if (count && count % MESSAGE_THRESHOLD === 0) {
        await updateConversationSummary(conversationId, userId)
      }

      const REFLECTION_THRESHOLD = 3
      const { data: convo } = await supabaseAdmin
        .from("conversations")
        .select("summary_count, user_id")
        .eq("id", conversationId)
        .single()

      if (
        convo &&
        convo.summary_count > 0 &&
        convo.summary_count % REFLECTION_THRESHOLD === 0
      ) {
        const { data: summaries } = await supabaseAdmin
          .from("conversations")
          .select("summary")
          .eq("user_id", convo.user_id)
          .order("updated_at", { ascending: false })
          .limit(REFLECTION_THRESHOLD)

        await extractUserMemory(
          convo.user_id,
          summaries?.map(s => s.summary).filter(Boolean) ?? []
        )
      }

      // 4️⃣ Respond
      res.status(201).json(assistantMessage)
    } catch (err: any) {
      console.error("[respond]", err)
      res.status(400).json({ error: err.message })
    }
  }
)

export default router