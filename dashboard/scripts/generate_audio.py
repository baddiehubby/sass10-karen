#!/usr/bin/env python3
"""
Generate Karen smackback WAVs with local Maya1 TTS + SNAC 24kHz decoder.
Saves angry_01.wav … into public/audio/smackbacks/
"""

from __future__ import annotations

import gc
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from snac import SNAC
from transformers import AutoModelForCausalLM, AutoTokenizer

# Keep downloads on classic HTTP (Xet hangs on some Windows setups).
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "audio" / "smackbacks"
# Prefer a fully-downloaded local copy (curl-friendly) over Hub streaming.
LOCAL_MAYA1 = Path(__file__).resolve().parent / "maya_tts" / "models" / "maya1"
LOCAL_SNAC = Path(__file__).resolve().parent / "maya_tts" / "models" / "snac_24khz"
MAYA1_ID = (
    str(LOCAL_MAYA1)
    if (LOCAL_MAYA1 / "config.json").exists()
    and (LOCAL_MAYA1 / "model-00001-of-00002.safetensors").exists()
    else "maya-research/maya1"
)
SNAC_ID = (
    str(LOCAL_SNAC)
    if (LOCAL_SNAC / "config.json").exists()
    and (
        (LOCAL_SNAC / "pytorch_model.bin").exists()
        or (LOCAL_SNAC / "model.safetensors").exists()
    )
    else "hubertsiuzdak/snac_24khz"
)

CODE_START_TOKEN_ID = 128257
CODE_END_TOKEN_ID = 128258
CODE_TOKEN_OFFSET = 128266
SNAC_MIN_ID = 128266
SNAC_MAX_ID = 156937
SNAC_TOKENS_PER_FRAME = 7

SOH_ID = 128259
EOH_ID = 128260
SOA_ID = 128261
BOS_ID = 128000
TEXT_EOT_ID = 128009

VOICE_DESCRIPTION = (
    "Female voice in her late 30s with a sharp, commanding American accent. "
    "Authoritative and aggressive tone. Low pitch for a female, clipped and "
    "impatient pacing. High intensity."
)

# 10 combat test insults (Maya1 inline emotion tags)
INSULTS = [
    "Is that all you've got? <angry> Pathetic.</angry>",
    "Don't you dare raise your voice at me! <scream>",
    "You call that an argument? <angry> Sit down.</angry>",
    "Go ahead, cry about it. <laugh>",
    "Cute volume. Zero substance. <angry>",
    "Scream louder. Still wrong. <scream>",
    "Mid energy. Sit down. <angry>",
    "I heard you. Unimpressed. Next. <angry>",
    "Your Respect just took damage. Good. <laugh>",
    "Fighting me is free. Winning isn't. <angry>",
]


def pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def pick_dtype(device: str) -> torch.dtype:
    if device == "cuda" and torch.cuda.is_bf16_supported():
        return torch.bfloat16
    if device == "cuda":
        return torch.float16
    # CPU / no NVIDIA GPU: float16 halves RAM (~6.6GB vs ~13GB) so 16GB laptops can load.
    return torch.float16


def build_prompt(tokenizer, description: str, text: str) -> str:
    soh_token = tokenizer.decode([SOH_ID])
    eoh_token = tokenizer.decode([EOH_ID])
    soa_token = tokenizer.decode([SOA_ID])
    sos_token = tokenizer.decode([CODE_START_TOKEN_ID])
    eot_token = tokenizer.decode([TEXT_EOT_ID])
    bos_token = tokenizer.bos_token
    formatted_text = f'<description="{description}"> {text}'
    return (
        soh_token
        + bos_token
        + formatted_text
        + eot_token
        + eoh_token
        + soa_token
        + sos_token
    )


def extract_snac_codes(token_ids: list[int]) -> list[int]:
    try:
        eos_idx = token_ids.index(CODE_END_TOKEN_ID)
    except ValueError:
        eos_idx = len(token_ids)
    return [
        token_id
        for token_id in token_ids[:eos_idx]
        if SNAC_MIN_ID <= token_id <= SNAC_MAX_ID
    ]


def unpack_snac_from_7(snac_tokens: list[int]) -> list[list[int]]:
    if snac_tokens and snac_tokens[-1] == CODE_END_TOKEN_ID:
        snac_tokens = snac_tokens[:-1]
    frames = len(snac_tokens) // SNAC_TOKENS_PER_FRAME
    snac_tokens = snac_tokens[: frames * SNAC_TOKENS_PER_FRAME]
    if frames == 0:
        return [[], [], []]
    l1, l2, l3 = [], [], []
    for i in range(frames):
        slots = snac_tokens[i * 7 : (i + 1) * 7]
        l1.append((slots[0] - CODE_TOKEN_OFFSET) % 4096)
        l2.extend(
            [
                (slots[1] - CODE_TOKEN_OFFSET) % 4096,
                (slots[4] - CODE_TOKEN_OFFSET) % 4096,
            ]
        )
        l3.extend(
            [
                (slots[2] - CODE_TOKEN_OFFSET) % 4096,
                (slots[3] - CODE_TOKEN_OFFSET) % 4096,
                (slots[5] - CODE_TOKEN_OFFSET) % 4096,
                (slots[6] - CODE_TOKEN_OFFSET) % 4096,
            ]
        )
    return [l1, l2, l3]


def decode_audio(snac_model: SNAC, snac_tokens: list[int], device: str) -> np.ndarray:
    levels = unpack_snac_from_7(snac_tokens)
    if not levels[0]:
        raise RuntimeError("No SNAC frames to decode")
    codes_tensor = [
        torch.tensor(level, dtype=torch.long, device=device).unsqueeze(0)
        for level in levels
    ]
    with torch.inference_mode():
        z_q = snac_model.quantizer.from_codes(codes_tensor)
        audio = snac_model.decoder(z_q)[0, 0].detach().cpu().numpy()
    if len(audio) > 2048:
        audio = audio[2048:]
    return audio.astype(np.float32, copy=False)


def generate_one(
    model,
    tokenizer,
    snac_model: SNAC,
    description: str,
    text: str,
    device: str,
) -> np.ndarray:
    prompt = build_prompt(tokenizer, description, text)
    inputs = tokenizer(prompt, return_tensors="pt", add_special_tokens=False)
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=512,  # short insults; keep CPU runs finite
            min_new_tokens=28,
            temperature=0.4,
            top_p=0.9,
            repetition_penalty=1.1,
            do_sample=True,
            eos_token_id=CODE_END_TOKEN_ID,
            pad_token_id=tokenizer.pad_token_id,
        )

    generated_ids = outputs[0, inputs["input_ids"].shape[1] :].tolist()
    snac_tokens = extract_snac_codes(generated_ids)
    print(f"    generated={len(generated_ids)} tokens, snac={len(snac_tokens)}")
    if len(snac_tokens) < 7:
        raise RuntimeError(
            f"Not enough SNAC tokens ({len(snac_tokens)}). Try GPU or shorter text."
        )
    return decode_audio(snac_model, snac_tokens, device)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    device = pick_device()
    dtype = pick_dtype(device)
    print("=" * 60)
    print("Maya1 smackback generator")
    print(f"  device={device}  dtype={dtype}")
    print(f"  out={OUT_DIR}")
    if device == "cpu":
        print(
            "  WARNING: No CUDA GPU detected. Maya1 (~3.3B) on CPU is VERY slow "
            "and may run out of RAM. Prefer an NVIDIA GPU + CUDA torch."
        )
    print("=" * 60)

    print(f"\n[1/3] Loading Maya1 from {MAYA1_ID} ...")
    if MAYA1_ID == "maya-research/maya1":
        print("  (first run downloads ~6–7 GB — keep this window open)")
    else:
        print("  using local weights folder")
    load_kwargs: dict = {
        "dtype": dtype,
        "trust_remote_code": True,
        "low_cpu_mem_usage": True,
    }
    if device == "cuda":
        load_kwargs["device_map"] = "auto"
    try:
        model = AutoModelForCausalLM.from_pretrained(MAYA1_ID, **load_kwargs)
        if device != "cuda":
            model = model.to(device)
    except torch.OutOfMemoryError as exc:
        print(
            "\nOUT OF MEMORY loading Maya1.\n"
            "This PC has no NVIDIA CUDA GPU (nvidia-smi missing) and not enough "
            "free RAM for the 3.3B model.\n\n"
            "Fix options:\n"
            "  1) Close Chrome/Edge/Cursor tabs to free RAM, then re-run.\n"
            "  2) Install an NVIDIA GPU + CUDA drivers, then:\n"
            "       scripts\\maya_tts\\Scripts\\pip uninstall -y torch\n"
            "       scripts\\maya_tts\\Scripts\\pip install torch --index-url "
            "https://download.pytorch.org/whl/cu124\n"
            "  3) Or run this script on a cloud GPU (Colab / RunPod) with CUDA.\n",
            file=sys.stderr,
        )
        raise SystemExit(2) from exc
    model.eval()

    tokenizer = AutoTokenizer.from_pretrained(
        MAYA1_ID,
        trust_remote_code=True,
    )
    print(f"  vocab={len(tokenizer)}")

    print(f"\n[2/3] Loading {SNAC_ID} ...")
    snac_model = SNAC.from_pretrained(SNAC_ID).eval()
    snac_model = snac_model.to(device)
    print("  SNAC ready")

    print(f"\n[3/3] Generating {len(INSULTS)} files ...")
    print(f"  voice: {VOICE_DESCRIPTION[:72]}...")

    ok = 0
    for i, line in enumerate(INSULTS, start=1):
        name = f"angry_{i:02d}.wav"
        out_path = OUT_DIR / name
        print(f"\n[{i}/{len(INSULTS)}] {name}")
        print(f"  text: {line}")
        try:
            audio = generate_one(
                model, tokenizer, snac_model, VOICE_DESCRIPTION, line, device
            )
            sf.write(str(out_path), audio, 24000)
            dur = len(audio) / 24000
            print(f"  saved {out_path} ({dur:.2f}s)")
            ok += 1
            gc.collect()
        except Exception as exc:  # noqa: BLE001 — report per-line failures clearly
            print(f"  FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
            raise

    print("\n" + "=" * 60)
    print(f"Done. Wrote {ok}/{len(INSULTS)} WAVs to {OUT_DIR}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
