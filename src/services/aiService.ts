import OpenAI from "openai";
import { openai } from "../lib/openai";
import { getSupabaseAdmin } from "../lib/supabase";

type ChatRole = "system" | "user" | "assistant";

export async function generateAssistantResponse(conversationId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const [convoRes, memoryRes, messageRes] = await Promise.all([
    supabaseAdmin.from("conversations").select("id, system_prompt, summary").eq("id", conversationId).single(),
    supabaseAdmin.from("user_memories").select("key, value").eq("user_id", userId),
    supabaseAdmin.from("messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: true })
  ]);

  if (convoRes.error || !convoRes.data) throw new Error("Sanctuary not found");
  
  const conversation = convoRes.data;
  const memories = memoryRes.data || [];
  const messages = messageRes.data || [];

  const prompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  
  const basePrompt = (process.env.SYSTEM_PROMPT || "You are Justin Lite.") + " Respond in JSON with a 'content' field.";
  prompt.push({ role: "system", content: basePrompt });

  if (memories.length) {
    const memoryContext = memories.map(m => `- ${m.key}: ${m.value}`).join("\n");
    prompt.push({ 
      role: "system", 
      content: `STABLE USER TRUTHS:\n${memoryContext}` 
    });
  }

  if (conversation.summary) {
    prompt.push({ role: "system", content: `LOCAL CONTEXT: ${conversation.summary}` });
  }

  messages.slice(-12).forEach(msg => {
    prompt.push({ role: msg.role as ChatRole, content: msg.content });
  });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: prompt,
    temperature: 0.3,
    response_format: { type: "json_object" }
  });

  const rawOutput = completion.choices[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(rawOutput);
    const finalContent = parsed.content?.trim() || "..."; 

    const { data: savedMessage, error: saveError } = await supabaseAdmin
      .from("messages")
      .insert({ 
        conversation_id: conversationId, 
        role: "assistant", 
        content: finalContent,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    
    return savedMessage;

  } catch (e) {
    console.error("🔥 AI SERVICE ERROR:", e, "Raw:", rawOutput);
    throw new Error("The sanctuary is quiet. Please try again.");
  }
}