// src/routes/conversations.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { readRateLimiter, writeRateLimiter, aiRateLimiter } from "../middleware/rateLimit";

import {
  createConversation,
  getUserConversations,
  deleteConversation,
  updateConversationTitle,
} from "../services/conversationService";

import {
  getMessagesForConversation,
  createMessage,
} from "../services/messageService";

import { generateAssistantResponse } from "../services/aiService";
import { createConversationSchema } from "../validation/conversationSchemas";
import { respondSchema } from "../validation/messageSchemas";
import { z } from "zod";

const router = Router();

const updateTitleSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

// Conversations
router.get("/", requireAuth, readRateLimiter, async (req, res, next) => {
  try {
    res.json(await getUserConversations(req.user!.id));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  requireAuth,
  writeRateLimiter,
  validate(createConversationSchema),
  async (req, res, next) => {
    try {
      const convo = await createConversation(req.user!.id, req.body.title);
      res.status(201).json(convo);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/:id",
  requireAuth,
  validate(updateTitleSchema),
  async (req, res, next) => {
    try {
      res.json(
        await updateConversationTitle(req.params.id, req.user!.id, req.body.title)
      );
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await deleteConversation(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Messages
router.get("/:id/messages", requireAuth, async (req, res, next) => {
  try {
    res.json(await getMessagesForConversation(req.params.id, req.user!.id));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:id/respond",
  requireAuth,
  aiRateLimiter,
  validate(respondSchema),
  async (req, res, next) => {
    try {
      const { id: conversationId } = req.params;
      const userId = req.user!.id;

      const userMessage = await createMessage(
        conversationId,
        userId,
        "user",
        req.body.content
      );

      const assistantMessage = await generateAssistantResponse(
        conversationId,
        userId
      );

      res.status(201).json({ 
        userMessage, 
        assistantMessage 
      });
      
    } catch (err) {
      console.error("Error in /respond route:", err);
      next(err);
    }
  }
);

export default router;
