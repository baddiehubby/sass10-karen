# Karen Audio Bank (premium MP3s)

Record these lines with ElevenLabs / Fish Audio and drop files to match paths
from `lib/karen/audio-bank.ts` → `listExpectedAudioPaths()`.

Suggested folders:

- `questions/` — `q1_gym.mp3` …
- `roasts/` — `q1_gym_a_0.mp3` …
- `verdicts/` — `overthinking_title.mp3` …
- `proud/` — `proud_01.mp3` …
- `checkin/` — `yes.mp3`, `no.mp3`
- `system/` — `morning_roast.mp3`, `afternoon_nudge.mp3`
- `reactions/` — `rx_01.mp3` … plus `forgive.mp3`
- `rare/` — `rare_roast.mp3` (3-day streak unlock)

Until files exist, playback falls back to `window.speechSynthesis`.
