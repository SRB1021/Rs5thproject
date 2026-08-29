export async function fetchVoices() {
  const res = await fetch("/api/tts/voices");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Failed to load voices (${res.status})`);
  return data.voices || [];
}

// A silent, valid WAV file used to "unlock" audio playback on browsers
// (Safari especially) that block audio.play() unless it was already
// allowed to play something during a direct user gesture.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

// Unlocks the given <audio> element for later playback outside a direct
// user gesture. Must be called synchronously from within a real user
// gesture handler (e.g. a click/tap), and only needs to happen once.
export async function unlockAudioElement(audioEl) {
  try {
    audioEl.src = SILENT_WAV;
    await audioEl.play();
    audioEl.pause();
    audioEl.currentTime = 0;
  } catch {
    // If this fails, subsequent playback will just fall back to the
    // browser voice, same as any other ElevenLabs playback failure.
  }
}

// Resolves once playback finishes. Throws if synthesis fails.
// Pass a previously-unlocked <audio> element (see unlockAudioElement) to
// reuse it, which is more reliable across a call's async turns on Safari
// than creating a fresh Audio() each time.
export async function speakWithElevenLabs(text, voiceId, audioEl) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Voice synthesis failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = audioEl || new Audio();
  audio.src = url;

  try {
    await new Promise((resolve, reject) => {
      audio.onended = resolve;
      audio.onerror = () => reject(new Error("Playback failed"));
      audio.play().catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Sends a recorded audio blob for transcription. Returns the transcript text.
export async function transcribeAudio(blob) {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");

  const res = await fetch("/api/stt", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `Transcription failed (${res.status})`);
  return data.text || "";
}
