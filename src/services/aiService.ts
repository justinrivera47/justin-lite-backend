import OpenAI from "openai"
import { openai } from "../lib/openai"
import { getSupabaseAdmin } from "../lib/supabase"

type ChatRole = "system" | "user" | "assistant"

function cleanContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return (parsed.content || raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function generateAssistantResponse(conversationId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin()

  // SECURITY: Verify user owns this conversation
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, system_prompt, summary")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!conversation) throw new Error("Conversation not found or access denied")

  const { data: memories } = await supabaseAdmin
    .from("user_memories")
    .select("key, value")
    .eq("user_id", userId)

  // Fetch only recent messages (limit at DB level for efficiency)
  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(12)

  const prompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  const basePrompt = (process.env.SYSTEM_PROMPT || "You are Justin Lite.") + 
                     " Important: You must respond in a valid JSON format with a 'content' field.";
  prompt.push({ role: "system", content: basePrompt });

  if (memories?.length) {
    const memoryContext = memories.map(m => `- ${m.key}: ${m.value}`).join("\n")
    prompt.push({ 
      role: "system", 
      content: `STABLE USER TRUTHS (Do not re-explore these unless challenged by the user):\n${memoryContext}` 
    })
  }

  if (conversation.summary) {
    prompt.push({ role: "system", content: `LOCAL CONTEXT: ${conversation.summary}` })
  }

  // Reverse to get chronological order (we fetched desc to get most recent 12)
  const recentMessages = messages?.reverse() || []
  recentMessages.forEach(msg => {
    prompt.push({ role: msg.role as ChatRole, content: msg.content })
  })

 const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: prompt,
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" } 
  });

  const rawOutput = completion.choices[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(rawOutput);
    const extractedText = parsed.content || parsed.message || parsed.text;
    const finalContent = (extractedText && extractedText.trim()) ? extractedText.trim() : "..."; 

    const { data: savedMessage, error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({ 
        conversation_id: conversationId, 
        role: "assistant", 
        content: finalContent 
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return savedMessage;

  } catch (e) {
    // Re-throw to let error handler deal with it consistently
    throw e;
  }
}