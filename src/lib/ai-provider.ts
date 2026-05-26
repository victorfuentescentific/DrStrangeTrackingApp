import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// AI provider — currently Gemini 2.0 Flash via Google AI Studio (free tier:
// 1,500 req/day, 1M tokens/min — no billing required).
//
// IMPORTANT: use a key from https://aistudio.google.com/apikey — NOT from
// Google Cloud Console. GCP project keys have a free-tier quota of 0.
//
// Named `ai-provider` rather than `gemini` so we can swap providers later
// without touching the page or API route. Only this file knows the provider.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL    = 'gemini-2.0-flash'
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
      temperature:     opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens   ?? 2048,
    },
  }
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] }
  }

  let res: Response
  try {
    res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      cache:   'no-store',  // LLM responses are conversational — never cache
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
