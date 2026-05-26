import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// AI provider — currently Groq (Llama 3.3 70B, free tier: 6,000 req/day).
//
// Named `ai-provider` rather than `groq` so we can swap to Claude or any
// other model later without touching the page or API route. The page
// only knows it talks to /api/ai/chat — the route only knows it calls
// askAI() — and only this file knows the actual provider.
//
// To swap models later: replace the constants + request/response shapes
// and leave the rest of the codebase untouched.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL    = 'llama-3.3-70b-versatile'
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

interface GroqResponse {
  choices?: Array<{
    message?: { content?: string }
    finish_reason?: string
  }>
  error?: { message?: string; type?: string }
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
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'GROQ_API_KEY is not configured on the server.', model: MODEL }
  }

  const messages: Array<{ role: string; content: string }> = []
  if (opts.systemInstruction) {
    messages.push({ role: 'system', content: opts.systemInstruction })
  }
  messages.push({ role: 'user', content: prompt })

  const body = {
    model: MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens:  opts.maxTokens  ?? 2048,
  }

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body:  JSON.stringify(body),
      cache: 'no-store',
    })
  } catch (err) {
    return { ok: false, error: `Network error contacting AI provider: ${(err as Error).message}`, model: MODEL }
  }

  let json: GroqResponse
  try {
    json = (await res.json()) as GroqResponse
  } catch {
    return { ok: false, error: `AI provider returned non-JSON (HTTP ${res.status}).`, model: MODEL }
  }

  if (!res.ok || json.error) {
    return { ok: false, error: json.error?.message ?? `AI provider HTTP ${res.status}`, model: MODEL }
  }

  const text = json.choices?.[0]?.message?.content ?? ''
  if (!text) {
    return { ok: false, error: 'AI provider returned an empty response.', model: MODEL }
  }

  return { ok: true, text, model: MODEL }
}
