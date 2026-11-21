"""One-shot Kokoro mute protocol line → public/audio/mute/mute.wav"""
from pathlib import Path
import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio" / "mute" / "mute.wav"
TEXT = "Watch your mouth. Mic's off until you apologize."
VOICE = "af_bella"

def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    chunks = []
    for _gs, _ps, audio in pipe(TEXT, voice=VOICE, speed=1.1):
        chunks.append(np.asarray(audio, dtype=np.float32).reshape(-1))
    audio = np.concatenate(chunks)
    peak = float(np.max(np.abs(audio))) or 1.0
    sf.write(str(OUT), audio * (0.95 / peak), 24000, subtype="PCM_16")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
