import { openai } from "../lib/openai"
import { getSupabaseAdmin } from "../lib/supabase"
import type { ChatCompletionMessageParam } from "openai/resources/chat"


export async function updateConversationSummary(
  conversationId: string,
  userId: string
): Promise<{ updated: boolean; error?: string }> {
  const supabaseAdmin = getSupabaseAdmin()

  // SECURITY: Verify user owns this conversation
  const { data: conversation, error: fetchError } = await supabaseAdmin
    .from("conversations")
    .select("id, summary, summary_count")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (fetchError) {
    return { updated: false, error: fetchError.message }
  }

  if (!conversation) {
    return { updated: false, error: "Conversation not found or access denied" }
  }

  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20)

  if (!messages || messages.length === 0) {
    return { updated: false, error: "No messages to summarize" }
  }

  const summaryPrompt: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "You are Justin Lite's internal chronicler. Document only settled insights. Do not add advice or noise. If no new insight exists, return the existing summary exactly."
    },
    {
      role: "user",
      content: `Current Summary: ${conversation.summary || "None"}\n\nRecent messages:\n${messages.map(m => `${m.role}: ${m.content}`).join("\n")}`
    }
  ]

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL!,
    messages: summaryPrompt,
    temperature: 0.2,
  })

  const newSummary = completion.choices[0]?.message?.content?.trim()
  if (!newSummary || newSummary === conversation.summary) {
    return { updated: false }
  }

  // SECURITY: Also verify user_id on update
  const { error: updateError } = await supabaseAdmin
    .from("conversations")
    .update({
      summary: newSummary,
      summary_count: (conversation.summary_count ?? 0) + 1,
    })
    .eq("id", conversationId)
    .eq("user_id", userId)

  if (updateError) {
    return { updated: false, error: updateError.message }
  }

  return { updated: true }
}