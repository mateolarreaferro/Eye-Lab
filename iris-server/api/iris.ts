// POST /api/iris: the Eye Lab app sends the conversation; this adds Iris's system
// prompt and tools, calls Claude with the server's API key, and returns the reply.
// The app runs the tools locally and posts the tool results back in the next call.

import Anthropic from "@anthropic-ai/sdk";
import { MODEL, SYSTEM_PROMPT, TOOLS } from "../lib/iris.js";

const client = new Anthropic(); // ANTHROPIC_API_KEY from the Vercel environment

const MAX_BODY_BYTES = 300_000;
const MAX_MESSAGES = 80;          // ~40 exchanges, including tool rounds
const MAX_USER_TEXT = 2_000;      // characters per typed message

export async function POST(request: Request): Promise<Response> {
  const appKey = process.env.EYELAB_APP_KEY;
  if (!appKey || request.headers.get("x-eyelab-key") !== appKey) {
    return json({ error: "unauthorized" }, 401);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "conversation too long; start a new chat" }, 413);
  }
  let messages: Anthropic.Beta.BetaMessageParam[];
  try {
    messages = JSON.parse(raw).messages;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const problem = validate(messages);
  if (problem) {
    return json({ error: problem }, 400);
  }

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });
    return json({ content: response.content, stop_reason: response.stop_reason });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "busy" }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      return json({ error: err.message }, err.status && err.status >= 500 ? 502 : 400);
    }
    throw err;
  }
}

export function GET(): Response {
  return json({ ok: true, service: "Eye Lab Iris" });
}

/** Only well-formed Iris conversations get through: user/assistant turns that start
 * and end with the user, bounded in length. */
function validate(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return "messages must be a non-empty array";
  if (messages.length > MAX_MESSAGES) return "conversation too long; start a new chat";
  for (const m of messages) {
    if (typeof m !== "object" || m === null) return "bad message";
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return "only user and assistant turns are allowed";
    if (typeof content === "string") {
      if (role === "user" && content.length > MAX_USER_TEXT) return "message too long";
    } else if (!Array.isArray(content)) {
      return "bad message content";
    }
  }
  if ((messages[0] as { role: string }).role !== "user") return "conversation must start with the user";
  if ((messages[messages.length - 1] as { role: string }).role !== "user") return "last turn must be the user's";
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
