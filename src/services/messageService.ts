import { NotFoundError } from "../errors/NotFoundError"
import { ValidationError } from "../errors/ValidationError"
import { supabaseAdmin } from "../lib/supabase"
import { updateConversationSummary } from "./summaryService"

type MessageRole = "user" | "assistant" | "system"

export async function getMessagesForConversation(
  conversationId: string,
  userId: string
) {
  // Ownership check via conversation
  const { data: convo } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single()

  if (!convo) {
  throw new NotFoundError("Conversation not found")
}

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data
}

export async function createMessage(
  conversationId: string,
  userId: string,
  role: MessageRole,
  content: string
) {

if (!content || content.trim().length === 0) {
  throw new ValidationError("Message content cannot be empty")
}


  // Ownership check
  const { data: convo } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single()

  if (!convo) {
  throw new NotFoundError("Conversation not found")
}

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

