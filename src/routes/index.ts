import { Router } from "express"
import { requireAuth } from "../middleware/requireAuth"
import { validate } from "../middleware/validate"
import { readRateLimiter, writeRateLimiter, aiRateLimiter } from "../middleware/rateLimit"

import billingRoutes from "./billing"

import {
  createConversation,
  getUserConversations,
  getConversationById,
  deleteConversation,
} from "../services/conversationService"

import { getMessagesForConversation, createMessage } from "../services/messageService"
import { generateAssistantResponse } from "../services/aiService"

import { createConversationSchema } from "../validation/conversationSchemas"
import { createMessageSchema, respondSchema } from "../validation/messageSchemas"

const router = Router()

router.use("/billing", billingRoutes)

// ✅ Conversations
router.get("/conversations", requireAuth, readRateLimiter, async (req, res, next) => {
  try {
    const convos = await getUserConversations(req.user!.id)
    res.json(convos)
  } catch (err) {
    next(err)
  }
})

router.post(
  "/conversations",
  requireAuth,
  writeRateLimiter,
  validate(createConversationSchema),
  async (req, res, next) => {
    try {
      const convo = await createConversation(req.user!.id, req.body.title)
      res.status(201).json(convo)
    } catch (err) {
      next(err)
    }
  }
)

router.get("/conversations/:id", requireAuth, async (req, res, next) => {
  try {
    const convo = await getConversationById(req.params.id, req.user!.id)
    res.json(convo)
  } catch (err) {
    next(err)
  }
})

router.delete("/conversations/:id", requireAuth, async (req, res, next) => {
  try {
    await deleteConversation(req.params.id, req.user!.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ✅ Messages
router.get("/conversations/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const messages = await getMessagesForConversation(req.params.id, req.user!.id)
    res.json(messages)
  } catch (err) {
    next(err)
  }
})

router.post(
  "/conversations/:id/messages",
  requireAuth,
  writeRateLimiter,
  validate(createMessageSchema),
  async (req, res, next) => {
    try {
      const message = await createMessage(req.params.id, req.user!.id, "user", req.body.content)
      res.status(201).json(message)
    } catch (err) {
      next(err)
    }
  }
)

// ✅ Atomic respond
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

      return res.status(201).json({ userMessage, assistantMessage })
    } catch (err) {
      next(err)
    }
  }
)

export default router
