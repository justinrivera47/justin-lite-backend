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
    .from("user_context")
    .select("key, value")
    .eq("user_id", userId)

  const memoryPrompt: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
You extract long-term user memory.

Rules:
- Only extract stable truths likely to remain valid over time.
- Do NOT extract moods, emotions, or temporary states.
- Do NOT repeat existing memory unless meaningfully changed.
- Use short, factual statements.
- Output valid JSON only.
`,
    },
    {
      role: "user",
      content: `
Existing memory:
${JSON.stringify(existingMemory ?? [], null, 2)}

Conversation summaries:
${summaries.join("\n\n")}
`,
    },
  ]

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL!,
    messages: memoryPrompt,
    temperature: 0.1,
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) return

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }

  if (!Array.isArray(parsed.memories)) return

  for (const mem of parsed.memories) {
    if (!mem.key || !mem.value) continue

    const existing = existingMemory?.find(
      (m) => m.key === mem.key
    )

    if (!existing) {
      await supabaseAdmin.from("user_context").insert({
        user_id: userId,
        key: mem.key,
        value: mem.value,
      })
    } else if (existing.value !== mem.value) {
      await supabaseAdmin
        .from("user_context")
        .update({ value: mem.value })
        .eq("user_id", userId)
        .eq("key", mem.key)
    }
  }
}
