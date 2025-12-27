import { AppError } from "../errors/AppError"
import { NotFoundError } from "../errors/NotFoundError"
import { openai } from "../lib/openai"
import { getSupabaseAdmin } from "../lib/supabase"

type ChatRole = "system" | "user" | "assistant"

export async function generateAssistantResponse(
  conversationId: string,
  userId: string
) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, system_prompt, summary")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single()

  if (!conversation) {
  throw new NotFoundError("Conversation not found")
}

  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

if (!messages || messages.length === 0) {
  throw new NotFoundError("No messages to respond to")
}


  const prompt: { role: ChatRole; content: string }[] = []

  // 1️⃣ Global doctrine (FIRST, always)
  prompt.push({
    role: "system",
    content:
      process.env.SYSTEM_PROMPT?.trim() ||
      "You are Justin Lite, a deliberately reflective assistant.",
  })

  // 2️⃣ Conversation-specific system prompt (optional)
  if (conversation.system_prompt) {
    prompt.push({
      role: "system",
      content: conversation.system_prompt,
    })
  }

  // 3️⃣ User memory (quiet, limited)
  const { data: memory } = await supabaseAdmin
    .from("user_context")
    .select("value")
    .eq("user_id", userId)
    .limit(5)

  if (memory && memory.length > 0) {
    prompt.push({
      role: "system",
      content:
        "User memory:\n" +
        memory.map((m) => `- ${m.value}`).join("\n"),
    })
  }

  // 4️⃣ Rolling conversation summary
  if (conversation.summary) {
    prompt.push({
      role: "system",
      content: `Conversation summary:\n${conversation.summary}`,
    })
  }

  // 5️⃣ Recent messages only (windowed)
  for (const msg of messages.slice(-10)) {
    prompt.push({
      role: msg.role as ChatRole,
      content: msg.content,
    })
  }

  // 6️⃣ OpenAI call
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL!,
    messages: prompt,
    temperature: 0.7,
  })

  const assistantContent =
    completion.choices[0]?.message?.content?.trim()

if (!assistantContent) {
  throw new AppError(
    "No assistant response generated",
    502,
    "AI_RESPONSE_EMPTY"
  )
}


  // 7️⃣ Persist assistant message
  const { data: savedMessage, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: assistantContent,
    })
    .select()
    .single()

  if (error) throw error

  return savedMessage
}
