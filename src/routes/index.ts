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
import { validate } from "../middleware/validate"
import { createConversationSchema } from "../validation/conversationSchemas"
import { createMessageSchema, respondSchema } from "../validation/messageSchemas"
import { aiRateLimiter, readRateLimiter, writeRateLimiter } from "../middleware/rateLimit"
import billingRoutes from "./billing"

const router = Router()

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

router.use("/billing", billingRoutes)


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
  async (req, res, next) => {
    try {
      const conversationId = req.params.id
      const userId = req.user!.id
      const content: string = req.body.content

      const userMessage = await createMessage(
        conversationId,
        userId,
        "user",
        content
      )

      const assistantMessage = await generateAssistantResponse(
        conversationId,
        userId
      )

      return res.status(201).json({ userMessage, assistantMessage })
    } catch (err) {
      return next(err)
    }
  }
)


export default router