// src/services/aiService.ts
import OpenAI from "openai"
import { openai } from "../lib/openai"
import { getSupabaseAdmin } from "../lib/supabase"

type ChatRole = "system" | "user" | "assistant"

export async function generateAssistantResponse(conversationId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, system_prompt, summary")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single()

  if (!conversation) throw new Error("Conversation not found or access denied")

  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (!messages || messages.length === 0) throw new Error("No messages to respond to")

  const prompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  const baseSystemPrompt =
    process.env.SYSTEM_PROMPT?.trim() ||
    "You are Justin Lite — a deliberately reflective assistant."

  prompt.push({ role: "system", content: baseSystemPrompt })

  if (conversation.system_prompt) {
    prompt.push({ role: "system", content: conversation.system_prompt })
  }

  if (conversation.summary) {
    prompt.push({
      role: "system",
      content: `Conversation summary:\n${conversation.summary}`,
    })
  }

  const { data: memory } = await supabaseAdmin
    .from("user_context")
    .select("key, value")
    .eq("user_id", userId)

  if (memory?.length) {
    prompt.push({
      role: "system",
      content:
        "User memory:\n" +
        memory.slice(0, 5).map((m) => `- ${m.value}`).join("\n"),
    })
  }

  // ✅ windowed recent messages only
  for (const msg of messages.slice(-10)) {
    prompt.push({ role: msg.role as ChatRole, content: msg.content })
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL!,
    messages: prompt,
    temperature: 0.7,
  })

  const assistantContent = completion.choices[0]?.message?.content?.trim()
  if (!assistantContent) throw new Error("No assistant response generated")

  const { data: savedMessage, error } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: conversationId, role: "assistant", content: assistantContent })
    .select()
    .single()

  if (error) throw error
  return savedMessage
}
