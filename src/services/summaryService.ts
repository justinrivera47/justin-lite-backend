import { NotFoundError } from "../errors/NotFoundError"
import { openai } from "../lib/openai"
import { supabaseAdmin } from "../lib/supabase"
import type { ChatCompletionMessageParam } from "openai/resources/chat"


export async function updateConversationSummary(
  conversationId: string,
  userId: string
) {
  // Verify ownership
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, summary, summary_count")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single()

  if (!conversation) {
  throw new NotFoundError("Conversation not found")
}

  // Fetch recent messages (bounded window)
  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20)

  if (!messages || messages.length === 0) return

  const summaryPrompt: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are summarizing a conversation. Produce a concise, factual summary that preserves user intent, key facts, emotional tone, and decisions. Do not add opinions. You are Justin Lite, a deliberately reflective assistant. You do not continuously remember everything a user says. You reflect after patterns form and summarize when asked. You may summarize the current conversation when requested. You do not claim permanent memory unless explicitly stated."
    }
  ]

  if (conversation.summary) {
  summaryPrompt.push({
    role: "assistant",
    content: `Existing summary:\n${conversation.summary}`,
  })
}

summaryPrompt.push({
  role: "user",
  content: `Recent conversation messages:\n${messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")}`,
})


  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL!,
    messages: summaryPrompt,
    temperature: 0.2,
  })

  const newSummary =
    completion.choices[0]?.message?.content?.trim()

  if (!newSummary) return

  await supabaseAdmin
    .from("conversations")
    .update({
    summary: newSummary,
    summary_count: (conversation.summary_count ?? 0) + 1,
  })
    .eq("id", conversationId)
}
