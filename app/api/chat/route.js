import Anthropic from "@anthropic-ai/sdk";
import { textingSystemPrompt, callSystemPrompt } from "../../../lib/persona";

export const runtime = "nodejs";

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on the server");
  }
  return new Anthropic({ apiKey });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, persona, mode } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages must be a non-empty array" }, { status: 400 });
  }
  if (!persona || typeof persona.name !== "string" || typeof persona.bio !== "string") {
    return Response.json({ error: "persona {name, bio} is required" }, { status: 400 });
  }

  const cleanMessages = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
    .slice(-40);

  if (cleanMessages.length === 0) {
    return Response.json({ error: "no valid messages" }, { status: 400 });
  }

  const system = mode === "call" ? callSystemPrompt(persona) : textingSystemPrompt(persona);
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  let client;
  try {
    client = getClient();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 400,
      system,
      messages: cleanMessages,
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return Response.json({ text });
  } catch (err) {
    console.error("Anthropic API error:", err);
    return Response.json({ error: "Failed to reach the model" }, { status: 502 });
  }
}
