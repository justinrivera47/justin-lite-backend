import { openai } from "../lib/openai"
import { getSupabaseAdmin } from "../lib/supabase"
import type { ChatCompletionMessageParam } from "openai/resources/chat"

export async function extractUserMemory(
  userId: string,
  summaries: string[]
) {
  if (summaries.length === 0) return
  const supabaseAdmin = getSupabaseAdmin()
  
  const { data: existingMemory } = await supabaseAdmin
    .from("user_memories")
    .select("key, value")
    .eq("user_id", userId)

  const memoryPrompt: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `Extract long-term facts about this user that will remain true across conversations.

WHAT TO EXTRACT:
- Core struggles they have named (e.g., "primary_struggle": "porn addiction recovery")
- Life context that affects their patterns (e.g., "relationship_status": "married, wife unaware of relapse history")
- Self-identified triggers or drift patterns (e.g., "known_trigger": "late nights alone after wife sleeps")
- Goals or commitments they have stated (e.g., "commitment": "90 days without relapse")

WHAT NOT TO EXTRACT:
- Temporary emotions or single-event details
- Anything that sounds like advice or interpretation
- Vague statements without specificity

RULES:
- Use snake_case for keys
- Keep values as concise factual statements
- If an existing memory is outdated based on new information, update the value
- If a memory is no longer relevant, omit it from output

OUTPUT FORMAT:
{"memories": [{"key": "snake_case_key", "value": "concise factual statement"}]}`,
    },
    {
      role: "user",
      content: `EXISTING MEMORIES:\n${JSON.stringify(existingMemory ?? [])}\n\nRECENT SUMMARIES:\n${summaries.join("\n\n")}`,
    },
  ]

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL!,
    messages: memoryPrompt,
    temperature: 0.1,
    response_format: { type: "json_object" }
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) return

  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed.memories)) return

  for (const mem of parsed.memories) {
    if (!mem.key || !mem.value) continue

    const { error } = await supabaseAdmin
      .from("user_memories")
      .upsert(
        { user_id: userId, key: mem.key, value: mem.value },
        { onConflict: 'user_id, key' }
      )
      
    if (error) console.error("Memory Upsert Error:", error)
  }
}