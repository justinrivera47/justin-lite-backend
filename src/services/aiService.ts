// src/services/aiService.ts
import OpenAI from "openai"
import { openai } from "../lib/openai"
import { getSupabaseAdmin } from "../lib/supabase"

type ChatRole = "system" | "user" | "assistant"

// --- helper: parse content while stripping JSON markers if AI fails to be 'Lite' ---
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

  // 1. Fetch Convo State
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, system_prompt, summary")
    .eq("id", conversationId)
    .single()

  if (!conversation) throw new Error("Sanctuary not found")

  // 2. Fetch Global Memories (The Stability Anchor)
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

  const basePrompt = (process.env.SYSTEM_PROMPT || "You are Justin Lite.") + 
                     " Important: You must respond in a valid JSON format with a 'content' field.";
  prompt.push({ role: "system", content: basePrompt });

  // Inject Stable Truths as Constraints
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

  // 4. Message Window
  messages?.slice(-12).forEach(msg => {
    prompt.push({ role: msg.role as ChatRole, content: msg.content })
  })

  // 5. Completion with JSON enforcement
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o", // or your preferred model
    messages: prompt,
    temperature: 0.3,
    response_format: { type: "json_object" } 
  });

  const rawOutput = completion.choices[0]?.message?.content || "{}";
  console.log("DEBUG: AI raw output:", rawOutput); // Check your logs for this!

  try {
    const parsed = JSON.parse(rawOutput);
    const extractedText = parsed.content || parsed.message || parsed.text;
    const finalContent = (extractedText && extractedText.trim()) ? extractedText.trim() : "..."; 

    // 6. Persist Response
    const { data: savedMessage, error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({ 
        conversation_id: conversationId, 
        role: "assistant", 
        content: finalContent 
        // Note: No user_id here, as confirmed by your schema
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ DATABASE INSERT FAIL:", insertError);
      throw insertError;
    }

    return savedMessage; // Ensure this is returned!

  } catch (e) {
    console.error("🔥 AI RESPONSE CRASH. Raw Output:", rawOutput);
    return {
      role: "assistant",
      content: "The sanctuary is quiet. My thoughts are still forming.",
      error: true
    };
  }
}