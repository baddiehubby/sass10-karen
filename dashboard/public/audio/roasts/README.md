# Karen Premium Voice Pack

Place 20 pre-recorded MP3s here (ElevenLabs / similar). Filenames expected by `lib/karen/premium-voice-library.ts`:

## Angry (10)
- angry_01.mp3 … angry_10.mp3

## Proud (5)
- proud_01.mp3 … proud_05.mp3

## Sarcastic (5)
- sarcastic_01.mp3 … sarcastic_05.mp3

Until files exist, `speakLocalRoast()` falls back to `window.speechSynthesis`.
