import { openai } from "../lib/openai"
import { getSupabaseAdmin } from "../lib/supabase"
import type { ChatCompletionMessageParam } from "openai/resources/chat"

interface MemoryExtractionResult {
  extracted: number
  errors: number
  skipped: boolean
}

export async function extractUserMemory(
  userId: string,
  summaries: string[]
): Promise<MemoryExtractionResult> {
  if (summaries.length === 0) {
    return { extracted: 0, errors: 0, skipped: true }
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: existingMemory, error: fetchError } = await supabaseAdmin
    .from("user_memories")
    .select("key, value")
    .eq("user_id", userId)

  if (fetchError) {
    console.error("Memory fetch error:", fetchError)
    return { extracted: 0, errors: 1, skipped: false }
  }

  const memoryPrompt: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
        You extract long-term user memory into a JSON format.
        Output must be a valid JSON object: {"memories": [{"key": "...", "value": "..."}]}

        Rules:
        - Only extract stable truths likely to remain valid over time.
        - Output strictly in JSON.
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

  let completion
  try {
    completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: memoryPrompt,
      temperature: 0.1,
      response_format: { type: "json_object" },
    })
  } catch (aiError) {
    console.error("Memory extraction AI error:", aiError)
    return { extracted: 0, errors: 1, skipped: false }
  }

  const raw = completion.choices[0]?.message?.content
  if (!raw) {
    return { extracted: 0, errors: 0, skipped: true }
  }

  let parsed: { memories?: Array<{ key: string; value: string }> }
  try {
    parsed = JSON.parse(raw)
  } catch (parseError) {
    console.error("Memory JSON parse error:", parseError)
    return { extracted: 0, errors: 1, skipped: false }
  }

  if (!Array.isArray(parsed.memories)) {
    return { extracted: 0, errors: 0, skipped: true }
  }

  let extracted = 0
  let errors = 0

  for (const mem of parsed.memories) {
    if (!mem.key || !mem.value) continue

    const { error } = await supabaseAdmin
      .from("user_memories")
      .upsert(
        { user_id: userId, key: mem.key, value: mem.value },
        { onConflict: "user_id, key" }
      )

    if (error) {
      console.error("Memory upsert error:", error)
      errors++
    } else {
      extracted++
    }
  }

  return { extracted, errors, skipped: false }
}
