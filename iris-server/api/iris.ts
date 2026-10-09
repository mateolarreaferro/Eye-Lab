// POST /api/iris: the Eye Lab app sends the conversation; this adds Iris's system
// prompt and tools, calls Claude, and returns the reply. The app runs the tools
// locally and posts the tool results back in the next call.
//
// Who pays: if the request carries the player's own Claude API key
// (x-anthropic-key, set in the app's Settings), it is used for this one call and
// never stored or logged. Otherwise the shared access code (x-eyelab-key) must
// match EYELAB_APP_KEY and the server's ANTHROPIC_API_KEY is used.

import Anthropic from "@anthropic-ai/sdk";
import { MODEL, SYSTEM_PROMPT, TOOLS } from "../lib/iris.js";

const serverClient = new Anthropic(); // ANTHROPIC_API_KEY from the Vercel environment

// The Eye Lab website (mateolarreaferro.com/eyelab) calls this from the browser.
const ALLOWED_ORIGINS = ["https://mateolarreaferro.com", "https://www.mateolarreaferro.com"];
const isAllowedOrigin = (o: string | null) =>
  !!o && (ALLOWED_ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));

const MAX_BODY_BYTES = 300_000;
const MAX_MESSAGES = 80;          // ~40 exchanges, including tool rounds
const MAX_USER_TEXT = 2_000;      // characters per typed message
const MAX_CONTEXT = 2_000;        // the app's "Right now" block

export async function POST(request: Request): Promise<Response> {
  return withCors(request, await handle(request));
}

/** Browser preflight for the website's requests (x-anthropic-key is a custom header). */
export function OPTIONS(request: Request): Response {
  return withCors(request, new Response(null, { status: 204 }), true);
}

function withCors(request: Request, response: Response, preflight = false): Response {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) return response;
  response.headers.set("access-control-allow-origin", origin!);
  response.headers.set("vary", "origin");
  if (preflight) {
    response.headers.set("access-control-allow-methods", "POST, OPTIONS");
    response.headers.set("access-control-allow-headers", "content-type, x-anthropic-key, x-eyelab-key");
    response.headers.set("access-control-max-age", "600");
  }
  return response;
}

async function handle(request: Request): Promise<Response> {
  const userKey = request.headers.get("x-anthropic-key")?.trim();
  let client = serverClient;
  if (userKey) {
    if (!userKey.startsWith("sk-ant-") || userKey.length > 300) {
      return json({ error: "invalid_api_key" }, 401);
    }
    client = new Anthropic({ apiKey: userKey });
  } else {
    const appKey = process.env.EYELAB_APP_KEY;
    if (!appKey || request.headers.get("x-eyelab-key") !== appKey) {
      return json({ error: "unauthorized" }, 401);
    }
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "conversation too long; start a new chat" }, 413);
  }
  let messages: Anthropic.Beta.BetaMessageParam[];
  let context: unknown;
  try {
    ({ messages, context } = JSON.parse(raw));
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const problem = validate(messages);
  if (problem) {
    return json({ error: problem }, 400);
  }
  if (context !== undefined && (typeof context !== "string" || context.length > MAX_CONTEXT)) {
    return json({ error: "bad context" }, 400);
  }

  // The app's "Right now" block (date, player, screen, filter, settings) rides
  // after the cached prompt so the prompt cache still hits.
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  if (typeof context === "string" && context.trim()) system.push({ type: "text", text: `## Right now\n${context.trim()}` });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      tools: TOOLS,
      messages,
    });
    return json({ content: response.content, stop_reason: response.stop_reason });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "busy" }, 429);
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return json({ error: userKey ? "invalid_api_key" : "server key rejected" }, userKey ? 401 : 502);
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
