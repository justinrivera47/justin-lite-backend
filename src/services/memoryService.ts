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
      content: `
        You extract long-term user memory.
        Output format must be: {"memories": [{"key": "...", "value": "..."}]}
        
        Rules:
        - Only extract stable truths likely to remain valid over time.
        - Only extract facts/beliefs explicitly stated by the user.
        - Do NOT interpret or summarize.
        - Use short, factual statements.
        `,
    },
    {
      role: "user",
      content: `
Existing memory: ${JSON.stringify(existingMemory ?? [])}
Recent Summaries: ${summaries.join("\n\n")}
`,
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