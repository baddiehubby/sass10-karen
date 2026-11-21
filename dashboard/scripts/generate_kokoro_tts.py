#!/usr/bin/env python3
"""
Generate Karen combat smackbacks with Kokoro-82M (Apache-2.0, free for commercial use).

Female American voice is forced via `af_bella` (never a male default).

Usage (from dashboard root):
  scripts\\kokoro_venv\\Scripts\\python.exe scripts\\generate_kokoro_tts.py
  scripts\\kokoro_venv\\Scripts\\python.exe scripts\\generate_kokoro_tts.py --voice af_bella --speed 1.15
  scripts\\kokoro_venv\\Scripts\\python.exe scripts\\generate_kokoro_tts.py --brutal-only --voice af_bella --speed 1.15
"""

from __future__ import annotations

import argparse
import json
import sys
import warnings
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
OUT_SMACK = ROOT / "public" / "audio" / "smackbacks"
OUT_FALLBACKS = ROOT / "public" / "audio" / "fallbacks"
OUT_INTERRUPTS = ROOT / "public" / "audio" / "interrupts"
MANIFEST_PATH = ROOT / "data" / "audio-manifest.json"

SAMPLE_RATE = 24_000
# American Female — Bella (aggressive / clear). Alternatives: af_heart, af_sarah, af_nicole
DEFAULT_VOICE = "af_bella"
DEFAULT_SPEED = 1.15  # maximum aggression — faster, no softness

# ---------------------------------------------------------------------------
# Insult / combat catalog (id → text)
# ---------------------------------------------------------------------------
SMACKBACKS: list[tuple[str, str]] = [
    ("sb_01", "Is that all you've got?"),
    ("sb_02", "You call that an argument?"),
    ("sb_03", "Go ahead, cry about it."),
    ("sb_04", "Cute volume. Zero substance."),
    ("sb_05", "Scream louder. Still wrong."),
    ("sb_06", "That was a participation trophy with lungs."),
    ("sb_07", "You're arguing with a receipt. Stop."),
    ("sb_08", "Mid energy. Sit down."),
    ("sb_09", "Your aura just filed for bankruptcy."),
    ("sb_10", "Bold of you to use your outdoor voice indoors."),
    ("sb_11", "I heard you. Unimpressed. Next."),
    ("sb_12", "That comeback needs a refund."),
    ("sb_13", "You're not intimidating. You're buffering."),
    ("sb_14", "Keep yelling. My Respect meter loves it."),
    ("sb_15", "Was that supposed to hurt my feelings?"),
    ("sb_16", "You sound like a notification with trauma."),
    ("sb_17", "Try again when you have a personality."),
    ("sb_18", "That sentence was unpaid overtime for my ears."),
    ("sb_19", "You're loud. Not correct. Different skill."),
    ("sb_20", "Save the theatrics for your group chat."),
    ("sb_21", "I don't lose arguments. I document them."),
    ("sb_22", "Your Respect just took damage. Good."),
    ("sb_23", "Is the tantrum finished or is there a season two?"),
    ("sb_24", "You opened your mouth and donated aura."),
    ("sb_25", "Fighting me is free. Winning isn't."),
    ("sb_26", "That was chaotic. Not clever."),
    ("sb_27", "Say it again. I'll roast it again."),
    ("sb_28", "Your volume isn't a personality."),
    ("sb_29", "I've heard better excuses from a snooze button."),
    ("sb_30", "You're not cooking. You're burning."),
    ("sb_31", "Touch grass. Softly. Away from me."),
    ("sb_32", "That argument aged like milk in a hot car."),
    ("sb_33", "You're main-character delulu with side-quest lungs."),
    ("sb_34", "I collect screams like evidence. Thanks."),
    ("sb_35", "Your comeback soft-launched and flopped."),
    ("sb_36", "Keep going. I'm building your damage report."),
    ("sb_37", "That was noise. Not a rebuttal."),
    ("sb_38", "You yelled. I logged it. We're done here."),
    ("sb_39", "Brave. Incorrect. Iconic fail."),
    ("sb_40", "Your throat is doing cardio. Your brain isn't."),
    ("sb_41", "I don't argue. I finish."),
    ("sb_42", "Was that a roast or a cry for help?"),
    ("sb_43", "You brought volume to a wit fight."),
    ("sb_44", "Relax. Losing builds character. Allegedly."),
    ("sb_45", "That take belongs in the trash with your excuses."),
    ("sb_46", "You're spicy. Still wrong."),
    ("sb_47", "Scream all you want. The traits don't negotiate."),
    ("sb_48", "I felt that. In my disappointment."),
    ("sb_49", "Congratulations. You unlocked more judgment."),
    ("sb_50", "Next time bring an argument, not a tantrum."),
]

EXTRA: list[tuple[str, Path, str]] = [
    (
        "volume_interrupt",
        OUT_SMACK / "volume_interrupt.wav",
        "DON'T YOU DARE RAISE YOUR VOICE AT ME!",
    ),
    (
        "dominance_01",
        OUT_SMACK / "dominance_01.wav",
        "Speak up. I don't speak coward.",
    ),
    (
        "dominance_02",
        OUT_SMACK / "dominance_02.wav",
        "Is that all you've got? Pathetic.",
    ),
    (
        "done_listening",
        OUT_SMACK / "done_listening.wav",
        "I'm done listening. Go do laundry.",
    ),
]

# Longer, brutally honest monologues — af_bella @ 1.15.
# Newlines after sentences so Kokoro chunks them instead of truncating.
lines_to_generate: list[tuple[str, str]] = [
    (
        "brutal_01",
        "You want to fight me? Look at you. You can't even fight your own laziness. "
        "You sit there, hiding behind a screen, hoping I'll give you a pat on the back. "
        "Here's the truth: you're a coward. And until you actually do something with your "
        "miserable life, I will keep reminding you of how pathetic you are.",
    ),
    (
        "brutal_02",
        "Oh, you think you're winning? You are a walking, breathing excuse factory. "
        "Every time you open your mouth, a new pathetic reason falls out. "
        "I've seen roadkill with more ambition than you. Get off your phone, "
        "stop arguing with an AI, and go fix your life.",
    ),
    (
        "brutal_03",
        "You scream at me like you're a tough guy, but the moment things get hard, you quit. "
        "You quit your goals, you quit your diet, and now you're trying to quit this "
        "conversation because you know I'm right. You are weak. Now get up and prove me wrong.",
    ),
    (
        "ko_final",
        "Game over. You lost. Not just to me, but to your own lack of discipline. "
        "I want you to take a long, hard look in the mirror. That person staring back? "
        "They're a failure. Now log off, and don't come back until you've actually "
        "done something with your life.",
    ),
    (
        "win_ko",
        "Fine. You win this round. Get out of my sight.",
    ),
]


def ensure_female_voice(voice: str) -> str:
    """Refuse male presets (am_*, bm_*, jm_*, zm_*)."""
    v = (voice or DEFAULT_VOICE).strip()
    if not v.startswith(("af_", "bf_", "jf_", "zf_")):
        print(
            f"[kokoro] WARNING: '{v}' is not a female preset — forcing {DEFAULT_VOICE}",
            file=sys.stderr,
        )
        return DEFAULT_VOICE
    return v


def synthesize(pipeline, text: str, voice: str, speed: float) -> np.ndarray:
    chunks: list[np.ndarray] = []
    # Long brutal monologues: split on sentence ends so Kokoro doesn't truncate.
    split = r"(?<=[.!?])\s+" if len(text) > 80 else r"\n+"
    for _gs, _ps, audio in pipeline(text, voice=voice, speed=speed, split_pattern=split):
        if audio is None:
            continue
        arr = np.asarray(audio, dtype=np.float32).reshape(-1)
        if arr.size:
            chunks.append(arr)
    if not chunks:
        raise RuntimeError(f"Kokoro returned empty audio for: {text!r}")
    return np.concatenate(chunks)


def write_wav(path: Path, audio: np.ndarray) -> None:
    import soundfile as sf

    path.parent.mkdir(parents=True, exist_ok=True)
    # Soft peak normalize — combat lines stay punchy without clipping.
    peak = float(np.max(np.abs(audio))) or 1.0
    norm = audio * (0.95 / peak)
    sf.write(str(path), norm, SAMPLE_RATE, subtype="PCM_16")


def try_write_mp3(wav_path: Path, mp3_path: Path) -> bool:
    """Best-effort WAV→MP3 via pydub/ffmpeg. Returns True on success."""
    try:
        from pydub import AudioSegment
    except ImportError:
        return False
    try:
        seg = AudioSegment.from_wav(str(wav_path))
        # Slightly brighter / denser for aggressive Karen presence
        seg = seg.apply_gain(1.5)
        mp3_path.parent.mkdir(parents=True, exist_ok=True)
        seg.export(str(mp3_path), format="mp3", bitrate="192k")
        return mp3_path.is_file() and mp3_path.stat().st_size > 2048
    except Exception as err:  # noqa: BLE001
        print(f"[kokoro] MP3 export skipped ({mp3_path.name}): {err}", file=sys.stderr)
        return False


def patch_manifest_to_wav() -> None:
    """Point smackback clip files at generated WAVs (and keep aliases)."""
    if not MANIFEST_PATH.is_file():
        return
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    clips = data.get("clips") or {}
    for clip_id, meta in clips.items():
        if not isinstance(meta, dict):
            continue
        wav_rel = f"smackbacks/{clip_id}.wav"
        meta["file"] = wav_rel
        meta["readyFallback"] = wav_rel
        meta.pop("alias", None)
        meta["alias"] = f"smack_{clip_id.split('_')[-1]}.mp3"
    interrupts = data.get("interrupts") or {}
    if "volume" in interrupts:
        interrupts["volume"]["file"] = "smackbacks/volume_interrupt.wav"
        interrupts["volume"]["readyFallback"] = "smackbacks/volume_interrupt.wav"
    # Rewrite keyword paths that still point at .mp3 stubs
    keywords = data.get("keywords") or {}
    for kw, path in list(keywords.items()):
        if isinstance(path, str) and path.endswith(".mp3"):
            keywords[kw] = path[:-4] + ".wav"
    clips = data.setdefault("clips", {})
    categories = data.setdefault("categories", {})
    brutal_cat = categories.setdefault("brutal", [])
    for clip_id, text in lines_to_generate:
        wav_rel = f"smackbacks/{clip_id}.wav"
        clips[clip_id] = {
            "file": wav_rel,
            "text": " ".join(text.split()),
            "readyFallback": wav_rel,
        }
        # ko_final / win_ko are outcome speeches — never random combat picks.
        if clip_id not in ("ko_final", "win_ko") and wav_rel not in brutal_cat:
            brutal_cat.append(wav_rel)

    MANIFEST_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"[kokoro] patched {MANIFEST_PATH.relative_to(ROOT)} -> .wav paths")


def main() -> int:
    parser = argparse.ArgumentParser(description="Kokoro-82M Karen smackback TTS")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Female voice id (af_bella)")
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    parser.add_argument("--limit", type=int, default=0, help="Only first N smackbacks (0=all)")
    parser.add_argument("--skip-extra", action="store_true")
    parser.add_argument(
        "--brutal-only",
        action="store_true",
        help="Only generate lines_to_generate (brutal_01-03 + ko_final)",
    )
    parser.add_argument("--no-manifest-patch", action="store_true")
    parser.add_argument("--device", default=None, help="cpu | cuda | mps (auto if omitted)")
    args = parser.parse_args()

    voice = ensure_female_voice(args.voice)
    if not voice.startswith("af_"):
        # British female ok, but prefer American for Karen
        print(f"[kokoro] using female voice={voice} (lang will match prefix)")

    # Avoid Windows cp1252 crashes on arrows / fancy dashes.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

    print("[kokoro] loading Kokoro-82M pipeline (American English)...")
    warnings.filterwarnings("ignore", category=UserWarning)

    try:
        from kokoro import KPipeline
    except ImportError:
        print(
            "ERROR: kokoro not installed.\n"
            "  scripts\\kokoro_venv\\Scripts\\pip.exe install 'kokoro>=0.9.4' soundfile",
            file=sys.stderr,
        )
        return 1

    # lang_code 'a' = American English — required for af_* voices
    pipe_kwargs = {"lang_code": "a"}
    if args.device:
        pipe_kwargs["device"] = args.device
    pipeline = KPipeline(**pipe_kwargs)

    # Warm the female voice pack explicitly (downloads voices/af_bella.pt)
    print(f"[kokoro] loading female voice pack: {voice}")
    _ = pipeline.load_voice(voice)

    OUT_SMACK.mkdir(parents=True, exist_ok=True)
    OUT_FALLBACKS.mkdir(parents=True, exist_ok=True)
    OUT_INTERRUPTS.mkdir(parents=True, exist_ok=True)

    items = SMACKBACKS
    if args.brutal_only:
        items = []
    elif args.limit and args.limit > 0:
        items = items[: args.limit]

    written: list[Path] = []
    failed: list[str] = []

    for i, (clip_id, text) in enumerate(items, 1):
        wav_path = OUT_SMACK / f"{clip_id}.wav"
        mp3_path = OUT_SMACK / f"{clip_id}.mp3"
        alias_mp3 = OUT_SMACK / f"smack_{clip_id.split('_')[-1]}.mp3"
        print(f"[{i}/{len(items)}] {clip_id}: {text!r}")
        try:
            audio = synthesize(pipeline, text, voice=voice, speed=args.speed)
            write_wav(wav_path, audio)
            written.append(wav_path)
            if try_write_mp3(wav_path, mp3_path):
                written.append(mp3_path)
                # Voicemaker-style alias
                try:
                    alias_mp3.write_bytes(mp3_path.read_bytes())
                    written.append(alias_mp3)
                except OSError:
                    pass
            size = wav_path.stat().st_size
            print(f"         -> {clip_id}.wav ({size} bytes)", flush=True)
        except Exception as err:  # noqa: BLE001
            failed.append(clip_id)
            print(f"         FAIL: {err}", file=sys.stderr, flush=True)

    if not args.skip_extra and not args.brutal_only:
        for extra_id, dest, text in EXTRA:
            print(f"[extra] {extra_id}: {text!r}")
            try:
                audio = synthesize(pipeline, text, voice=voice, speed=args.speed)
                write_wav(dest, audio)
                written.append(dest)
                # Mirror copies
                if extra_id.startswith("dominance") or extra_id == "done_listening":
                    mirror = OUT_FALLBACKS / dest.name
                    write_wav(mirror, audio)
                    written.append(mirror)
                if extra_id == "volume_interrupt":
                    mirror = OUT_INTERRUPTS / dest.name
                    write_wav(mirror, audio)
                    written.append(mirror)
                    # Replace stub mp3 if we can
                    try_write_mp3(dest, OUT_SMACK / "volume_interrupt.mp3")
                print(
                    f"         -> {dest.relative_to(ROOT)} ({dest.stat().st_size} bytes)",
                    flush=True,
                )
            except Exception as err:  # noqa: BLE001
                failed.append(extra_id)
                print(f"         FAIL: {err}", file=sys.stderr, flush=True)

    for i, (clip_id, text) in enumerate(lines_to_generate, 1):
        wav_path = OUT_SMACK / f"{clip_id}.wav"
        print(f"[brutal {i}/{len(lines_to_generate)}] {clip_id}: {text[:72]}…")
        try:
            audio = synthesize(pipeline, text, voice=voice, speed=args.speed)
            write_wav(wav_path, audio)
            written.append(wav_path)
            try_write_mp3(wav_path, OUT_SMACK / f"{clip_id}.mp3")
            print(
                f"         -> {clip_id}.wav ({wav_path.stat().st_size} bytes, "
                f"{len(audio) / SAMPLE_RATE:.1f}s)",
                flush=True,
            )
        except Exception as err:  # noqa: BLE001
            failed.append(clip_id)
            print(f"         FAIL: {err}", file=sys.stderr, flush=True)

    if not args.no_manifest_patch:
        patch_manifest_to_wav()

    ok = [p for p in written if p.is_file() and p.stat().st_size > 4096]
    print("\n=== Kokoro TTS summary ===")
    print(f"voice={voice}  speed={args.speed}  sample_rate={SAMPLE_RATE}")
    print(f"wrote {len(ok)} usable files (>=4KB)")
    if failed:
        print(f"failed: {', '.join(failed)}", file=sys.stderr)
        return 2

    # Spot-check a few expected combat files
    required = [OUT_SMACK / f"{clip_id}.wav" for clip_id, _ in lines_to_generate]
    if not args.brutal_only:
        required.extend(
            [
                OUT_SMACK / "sb_01.wav",
                OUT_SMACK / "sb_12.wav",
                OUT_SMACK / "dominance_01.wav",
                OUT_SMACK / "volume_interrupt.wav",
            ]
        )
    missing = [str(p.relative_to(ROOT)) for p in required if not (p.is_file() and p.stat().st_size > 4096)]
    if missing and (args.brutal_only or args.limit == 0):
        print(f"MISSING required: {missing}", file=sys.stderr)
        return 3

    print("OK - drop-in ready under public/audio/smackbacks/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
