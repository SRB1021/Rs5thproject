export async function fetchReply({ messages, persona, mode }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, persona, mode }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data.text || "";
}

export function splitBubbles(text) {
  return text
    .split("|||")
    .map((s) => s.trim())
    .filter(Boolean);
}
