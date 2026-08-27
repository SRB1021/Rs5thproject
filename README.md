# TextMate

Text an AI that replies like a real person, and call it for a live voice
conversation (audio only — no video).

## Features

- **Texting** — an iMessage-style chat where the AI persona replies casually,
  in short bursts of separate bubbles, with typing indicators. It's prompted
  to never sound like an assistant.
- **Calling** — tap Call to start a live, audio-only conversation. Your voice
  is transcribed in the browser (Web Speech API), sent to the model, and the
  reply is spoken back out loud.
- **Editable profile** — tap the contact's name/photo in the chat header to
  change their name, personality/bio, profile picture, and call voice.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. Get an API key at
https://console.anthropic.com/.

## Notes

- Voice calling uses the browser's built-in speech recognition and
  speech synthesis (`SpeechRecognition` / `speechSynthesis`), so it works
  best in Chrome or Edge on desktop or Android. Safari/iOS support for
  `SpeechRecognition` is limited; texting always works everywhere.
- Conversation history and the persona/profile are stored in your browser's
  `localStorage` — nothing is saved server-side.
- This runs as a normal web app in a browser. It cannot be launched from
  Excel or any other office app.
