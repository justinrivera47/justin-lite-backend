// src/services/onboardingService.ts
import { getSupabaseAdmin } from "../lib/supabase";

export async function initializeFirstConversation(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: conversation, error: convoError } = await supabaseAdmin
    .from("conversations")
    .insert({
      user_id: userId,
      title: "The First Mirror",
      system_prompt: process.env.SYSTEM_PROMPT
    })
    .select()
    .single();

  if (convoError) throw convoError;

  const welcomeContent = `Welcome to the Sanctuary. 

    I am Justin Lite. I am not here to solve your problems, offer advice, or comfort you with affirmations. 

    I am a mirror. I am here to help you see where you drift before you fall. 

    When you are ready, name a pattern you are noticing or a place where you feel the noise is winning.`;

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    role: "assistant",
    content: welcomeContent
  });

  return conversation;
}