import { openai } from "../lib/openai"
import { getSupabaseAdmin } from "../lib/supabase"
import type { ChatCompletionMessageParam } from "openai/resources/chat"


export async function updateConversationSummary(
  conversationId: string,
  userId: string
) {
  const supabaseAdmin = getSupabaseAdmin()
  
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, summary, summary_count")
    .eq("id", conversationId)
    .single()

  if (!conversation) return

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
      content: `You are Justin Lite's internal chronicler. Maintain a living summary of this conversation.

CAPTURE ONLY:
- Patterns the user has named or that emerged
- Drift moments identified (when they lost control or attention)
- Questions they are sitting with
- Contradictions or tensions surfaced

DO NOT INCLUDE:
- Advice or interpretations
- Commentary on what they should do
- Repetition of what was already in the previous summary

RULES:
- If nothing new has emerged, return the existing summary exactly
- Keep under 150 words
- Plain prose, no bullets or lists`
    },
    {
      role: "user",
      content: `CURRENT SUMMARY:\n${conversation.summary || "None"}\n\nRECENT MESSAGES:\n${messages.map(m => `${m.role}: ${m.content}`).join("\n")}`
    }
  ]

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL!,
    messages: summaryPrompt,
    temperature: 0.2,
  })

  const newSummary = completion.choices[0]?.message?.content?.trim()
  if (!newSummary || newSummary === conversation.summary) return

  await supabaseAdmin
    .from("conversations")
    .update({
      summary: newSummary,
      summary_count: (conversation.summary_count ?? 0) + 1,
    })
    .eq("id", conversationId)
}