"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_PERSONA } from "../../lib/persona";
import { loadPersona, savePersona, saveMessages } from "../../lib/storage";
import { pickBestVoice, sortVoicesByQuality } from "../../lib/voices";

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [persona, setPersona] = useState(DEFAULT_PERSONA);
  const [voices, setVoices] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPersona(loadPersona(DEFAULT_PERSONA));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    function loadVoices() {
      const list = window.speechSynthesis.getVoices();
      if (!list.length) return;
      const sorted = sortVoicesByQuality(list);
      setVoices(sorted);
      // If no voice has been explicitly chosen yet, default to the best
      // available American English voice instead of the OS's raw default.
      setPersona((p) =>
        p.voiceURI ? p : { ...p, voiceURI: pickBestVoice(sorted)?.voiceURI || null }
      );
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  function update(field, value) {
    setPersona((p) => ({ ...p, [field]: value }));
    setSaved(false);
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => update("avatar", reader.result);
    reader.readAsDataURL(file);
  }

  function testVoice() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(
      `hey, it's ${persona.name || "your friend"}. this is what I sound like.`
    );
    const voice = voices.find((v) => v.voiceURI === persona.voiceURI);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function handleSave(e) {
    e.preventDefault();
    const cleaned = {
      ...persona,
      name: persona.name?.trim() || DEFAULT_PERSONA.name,
      bio: persona.bio?.trim() || DEFAULT_PERSONA.bio,
    };
    savePersona(cleaned);
    setPersona(cleaned);
    setSaved(true);
  }

  function handleResetChat() {
    if (!confirm("Clear the entire text history with " + persona.name + "?")) return;
    saveMessages([]);
    router.push("/");
  }

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link href="/" className="text-imessage-blue text-sm">
          ‹ Back
        </Link>
        <div className="text-sm font-semibold">Edit profile</div>
      </header>

      <form onSubmit={handleSave} className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative h-24 w-24 overflow-hidden rounded-full bg-white/10"
          >
            {persona.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={persona.avatar} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-semibold">
                {persona.name?.[0]?.toUpperCase() || "?"}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-[10px]">
              Change photo
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          {persona.avatar && (
            <button
              type="button"
              onClick={() => update("avatar", null)}
              className="text-xs text-red-400"
            >
              Remove photo
            </button>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">Name</label>
          <input
            value={persona.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-imessage-blue"
            maxLength={40}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">
            Personality / bio
          </label>
          <textarea
            value={persona.bio}
            onChange={(e) => update("bio", e.target.value)}
            rows={5}
            className="w-full resize-none rounded-lg bg-white/10 px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-imessage-blue"
            maxLength={1000}
          />
          <p className="mt-1 text-xs text-white/30">
            Describe who they are, how they talk, and what they're like. This shapes every reply.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">
            Voice (used on calls)
          </label>
          {voices.length > 0 ? (
            <div className="flex gap-2">
              <select
                value={persona.voiceURI || ""}
                onChange={(e) => update("voiceURI", e.target.value || null)}
                className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-imessage-blue"
              >
                <option value="">Auto (recommended)</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={testVoice}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm"
              >
                Test
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/30">
              No voices found yet. Voices are provided by your browser and may take a moment to
              load, or may be unavailable on this device.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-full bg-imessage-blue px-5 py-2 text-sm font-medium"
          >
            Save
          </button>
          {saved && <span className="text-xs text-green-400">Saved</span>}
        </div>

        <div className="border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={handleResetChat}
            className="text-xs text-red-400"
          >
            Clear text history
          </button>
        </div>
      </form>
    </div>
  );
}
