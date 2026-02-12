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
    .single()

  if (!conversation) throw new Error("Sanctuary not found")

  const { data: memories } = await supabaseAdmin
    .from("user_memories")
    .select("key, value")
    .eq("user_id", userId)

  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  const prompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  const basePrompt = process.env.SYSTEM_PROMPT || "You are Justin Lite. Output valid JSON with a content field."
  prompt.push({ role: "system", content: basePrompt })

  if (memories?.length) {
    const memoryContext = memories.map(m => `- ${m.key}: ${m.value}`).join("\n")
    prompt.push({
      role: "system",
      content: `WHAT YOU KNOW ABOUT THIS USER (treat as settled unless they contradict it):\n${memoryContext}\n\nUse these to recognize patterns. Do not re-ask questions you already have answers to.`
    })
  }

  if (conversation.summary) {
    prompt.push({
      role: "system",
      content: `CONVERSATION SO FAR:\n${conversation.summary}\n\nBuild on this. Do not summarize it back to the user.`
    })
  }

  messages?.slice(-20).forEach(msg => {
    prompt.push({ role: msg.role as ChatRole, content: msg.content })
  })

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: prompt,
    temperature: 0.3,
    max_tokens: 700,
    response_format: { type: "json_object" }
  })

  const rawOutput = completion.choices[0]?.message?.content || "{}";
  console.log("DEBUG: AI raw output:", rawOutput);

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
      console.error("❌ DATABASE INSERT FAIL:", insertError);
      throw insertError;
    }

    return savedMessage;

  } catch (e) {
    console.error("🔥 AI RESPONSE CRASH:", e);
    return {
      role: "assistant",
      content: "The mirror is clouded right now. I'll leave you with your last thought until I can see clearly again.",
      error: true
    };
}
}