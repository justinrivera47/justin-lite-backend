import { NotFoundError } from "../errors/NotFoundError"
import { getSupabaseAdmin} from "../lib/supabase"


export async function createConversation(userId: string, title?: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      user_id: userId,
      title: title ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUserConversations(userId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function getConversationById(
  conversationId: string,
  userId: string
) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    throw new NotFoundError("Conversation not found")
  }

  return data
}

export async function deleteConversation(
  conversationId: string,
  userId: string
) {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId)

  if (error) throw error
}
