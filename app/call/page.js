"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { DEFAULT_PERSONA } from "../../lib/persona";
import { loadPersona, loadMessages, saveMessages } from "../../lib/storage";
import { fetchReply } from "../../lib/api";
import { pickBestVoice } from "../../lib/voices";
import { speakWithElevenLabs } from "../../lib/elevenlabs";

const STATUS = {
  IDLE: "idle",
  LISTENING: "listening",
  THINKING: "thinking",
  SPEAKING: "speaking",
  ENDED: "ended",
};

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallPage() {
  const [persona, setPersona] = useState(DEFAULT_PERSONA);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [transcriptLine, setTranscriptLine] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);

  const historyRef = useRef([]);
  const recognitionRef = useRef(null);
  const mutedRef = useRef(false);
  const activeRef = useRef(false);
  const timerRef = useRef(null);
  const voicesRef = useRef([]);

  useEffect(() => {
    setPersona(loadPersona(DEFAULT_PERSONA));
    historyRef.current = loadMessages();
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }

    function loadVoices() {
      voicesRef.current = window.speechSynthesis.getVoices();
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const speakWithBrowser = useCallback(
    (text) =>
      new Promise((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        const voice =
          voicesRef.current.find((v) => v.voiceURI === persona.voiceURI) ||
          pickBestVoice(voicesRef.current);
        if (voice) utterance.voice = voice;
        utterance.onend = resolve;
        utterance.onerror = resolve;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }),
    [persona.voiceURI]
  );

  const speak = useCallback(
    async (text) => {
      if (persona.ttsProvider === "elevenlabs" && persona.elevenlabsVoiceId) {
        try {
          await speakWithElevenLabs(text, persona.elevenlabsVoiceId);
          return;
        } catch (err) {
          console.error("ElevenLabs playback failed, falling back to browser voice:", err);
        }
      }
      await speakWithBrowser(text);
    },
    [persona.ttsProvider, persona.elevenlabsVoiceId, speakWithBrowser]
  );

  const listenOnce = useCallback(() => {
    return new Promise((resolve) => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      let finalText = "";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += chunk;
          else interim += chunk;
        }
        setTranscriptLine((finalText + interim).trim());
      };

      recognition.onend = () => resolve(finalText.trim());
      recognition.onerror = () => resolve(finalText.trim());

      try {
        recognition.start();
      } catch {
        resolve("");
      }
    });
  }, []);

  const runLoop = useCallback(async () => {
    while (activeRef.current) {
      setStatus(STATUS.LISTENING);
      setTranscriptLine("");
      const said = await listenOnce();
      if (!activeRef.current) break;

      if (!said || mutedRef.current) {
        continue;
      }

      const next = [...historyRef.current, { role: "user", content: said }];
      historyRef.current = next;
      saveMessages(next);

      setStatus(STATUS.THINKING);
      let reply = "";
      try {
        reply = await fetchReply({ messages: next, persona, mode: "call" });
      } catch (err) {
        setError(err.message || "Something went wrong");
        break;
      }
      if (!activeRef.current) break;

      const withReply = [...historyRef.current, { role: "assistant", content: reply }];
      historyRef.current = withReply;
      saveMessages(withReply);

      setStatus(STATUS.SPEAKING);
      setTranscriptLine(reply);
      await speak(reply);
    }
  }, [listenOnce, persona, speak]);

  function startCall() {
    setError("");
    activeRef.current = true;
    setStatus(STATUS.LISTENING);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    runLoop();
  }

  function endCall() {
    activeRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    clearInterval(timerRef.current);
    setStatus(STATUS.ENDED);
  }

  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      clearInterval(timerRef.current);
    };
  }, []);

  const statusLabel =
    {
      [STATUS.IDLE]: "Ready to call",
      [STATUS.LISTENING]: "Listening…",
      [STATUS.THINKING]: "…",
      [STATUS.SPEAKING]: `${persona.name} is talking…`,
      [STATUS.ENDED]: "Call ended",
    }[status] || "";

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col items-center justify-between bg-gradient-to-b from-fuchsia-900 via-indigo-900 to-slate-950 px-6 py-10">
      <div className="w-full">
        <Link href="/" className="text-sm text-white/40">
          ‹ Back to texts
        </Link>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-32 w-32 items-center justify-center">
          {status === STATUS.LISTENING && (
            <span className="absolute inset-0 rounded-full bg-green-500/40 animate-pulseRing" />
          )}
          {status === STATUS.SPEAKING && (
            <span className="absolute inset-0 rounded-full bg-imessage-blue/40 animate-pulseRing" />
          )}
          {persona.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={persona.avatar}
              alt={persona.name}
              className="relative h-28 w-28 rounded-full object-cover"
            />
          ) : (
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-3xl font-semibold">
              {persona.name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div className="text-xl font-semibold">{persona.name}</div>
        <div className="text-sm text-white/50">{statusLabel}</div>
        {activeRef.current && (
          <div className="text-xs text-white/30">{formatDuration(elapsed)}</div>
        )}
        {transcriptLine && (
          <p className="max-w-xs text-center text-sm text-white/70">{transcriptLine}</p>
        )}
        {error && <p className="max-w-xs text-center text-sm text-red-400">{error}</p>}
        {!supported && (
          <p className="max-w-xs text-center text-sm text-yellow-400">
            Voice calling needs browser speech support (works best in Chrome/Edge on
            desktop/Android). Your browser doesn't support it — you can still text instead.
          </p>
        )}
      </div>

      <div className="flex items-center gap-8 pb-6">
        {status === STATUS.IDLE || status === STATUS.ENDED ? (
          <button
            onClick={startCall}
            disabled={!supported}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-2xl disabled:opacity-30"
            aria-label="Start call"
          >
            📞
          </button>
        ) : (
          <>
            <button
              onClick={() => setMuted((m) => !m)}
              className={`flex h-14 w-14 items-center justify-center rounded-full text-xl ${
                muted ? "bg-yellow-500" : "bg-white/10"
              }`}
              aria-label="Toggle mute"
            >
              {muted ? "🔇" : "🎙️"}
            </button>
            <button
              onClick={endCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-2xl"
              aria-label="End call"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}
