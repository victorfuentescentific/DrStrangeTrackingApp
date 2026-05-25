import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// AI provider — currently Gemini 2.0 Flash (free tier).
//
// Named `ai-provider` rather than `gemini` so we can swap to Claude or any
// other model in Phase 2 without touching the page or API route. The page
// only knows it talks to /api/ai/chat — the route only knows it calls
// askAI() — and only this file knows it's actually Gemini.
//
// To swap models later: replace the fetch URL/body in askAI() and leave the
// rest of the codebase untouched.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

export interface AskAIOptions {
  systemInstruction?: string  // System prompt prepended to the conversation
  temperature?: number        // 0.0–2.0, default 0.7
  maxTokens?: number          // Output token cap, default 2048
}

export interface AskAIResult {
  ok: boolean
  text?: string
  error?: string
  model: string
}

export async function askAI(prompt: string, opts: AskAIOptions = {}): Promise<AskAIResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'GEMINI_API_KEY is not configured on the server.', model: MODEL }
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  }
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] }
  }

  let res: Response
  try {
    res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Don't cache LLM responses — they're conversational.
      cache: 'no-store',
    })
  } catch (err) {
    return { ok: false, error: `Network error contacting AI provider: ${(err as Error).message}`, model: MODEL }
  }

  let json: GeminiResponse
  try {
    json = (await res.json()) as GeminiResponse
  } catch {
    return { ok: false, error: `AI provider returned non-JSON (HTTP ${res.status}).`, model: MODEL }
  }

  if (!res.ok || json.error) {
    return { ok: false, error: json.error?.message ?? `AI provider HTTP ${res.status}`, model: MODEL }
  }

  if (json.promptFeedback?.blockReason) {
    return { ok: false, error: `Prompt blocked: ${json.promptFeedback.blockReason}`, model: MODEL }
  }

  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
  if (!text) {
    return { ok: false, error: 'AI provider returned an empty response.', model: MODEL }
  }

  return { ok: true, text, model: MODEL }
}
