#!/usr/bin/env python3
"""Transcribe a long video into Thai-aware, word-timed JSON + a readable transcript.

Usage:
    python transcribe.py INPUT.mp4 --out work/ [--model large-v3] [--lang th]

Outputs (in --out):
    transcript.json  {"duration", "language", "segments":[{"start","end","text","words":[{"w","start","end"}]}]}
    transcript.txt   one line per segment: "[mm:ss.s - mm:ss.s] text"  (for Claude to read and pick highlights)

Whisper splits Thai into sub-word pieces. We rebuild real Thai words with PyThaiNLP and
give each word the timing of the characters it covers, so subtitles pop word by word.
"""
import argparse
import json
import os
import subprocess
import sys


def fmt(t):
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:04.1f}"


def media_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def load_audio(path, sr=16000):
    """Decode any media file to 16 kHz mono float32 with ffmpeg (avoids PyAV version issues)."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def char_times(pieces):
    """Spread each whisper piece's [start,end] across its characters."""
    chars, times = [], []
    for p in pieces:
        txt = p["word"]
        n = max(len(txt), 1)
        for i, ch in enumerate(txt):
            a = p["start"] + (p["end"] - p["start"]) * i / n
            b = p["start"] + (p["end"] - p["start"]) * (i + 1) / n
            chars.append(ch)
            times.append((a, b))
    return "".join(chars), times


def retokenize(pieces, lang):
    """Re-split whisper pieces into proper words (Thai via PyThaiNLP), keeping timings."""
    text, times = char_times(pieces)
    if not text.strip():
        return []
    if lang == "th":
        from pythainlp.tokenize import word_tokenize
        tokens = word_tokenize(text, engine="newmm", keep_whitespace=True)
    else:
        tokens = text.split(" ")
        tokens = [t + " " for t in tokens[:-1]] + tokens[-1:]
    words, pos = [], 0
    for tok in tokens:
        span = (pos, pos + len(tok))
        pos += len(tok)
        clean = tok.strip()
        if not clean:
            continue
        # skip leading/trailing spaces of the token when taking times
        a = span[0] + (len(tok) - len(tok.lstrip()))
        b = span[1] - (len(tok) - len(tok.rstrip())) - 1
        words.append({"w": clean, "start": round(times[a][0], 3), "end": round(times[b][1], 3)})
    return words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="large-v3",
                    help="tiny|base|small|medium|large-v3 (Thai needs medium or larger for good accuracy)")
    ap.add_argument("--lang", default="th", help="language code, or 'auto'")
    ap.add_argument("--device", default="auto", help="auto|cpu|cuda")
    ap.add_argument("--prompt", default="",
                    help="initial prompt: names/jargon to help spelling, e.g. channel or product names")
    args = ap.parse_args()

    from faster_whisper import WhisperModel

    os.makedirs(args.out, exist_ok=True)
    compute = "int8" if args.device in ("cpu", "auto") else "float16"
    model = WhisperModel(args.model, device=args.device, compute_type=compute)
    seg_iter, info = model.transcribe(
        load_audio(args.input),
        language=None if args.lang == "auto" else args.lang,
        word_timestamps=True,
        vad_filter=True,
        initial_prompt=args.prompt or None,
    )
    lang = info.language
    segments = []
    for s in seg_iter:
        pieces = [{"word": w.word, "start": w.start, "end": w.end} for w in (s.words or [])]
        words = retokenize(pieces, lang) if pieces else []
        segments.append({"start": round(s.start, 3), "end": round(s.end, 3),
                         "text": s.text.strip(), "words": words})
        print(f"[{fmt(s.start)} - {fmt(s.end)}] {s.text.strip()}", file=sys.stderr)

    data = {"source": os.path.abspath(args.input), "duration": media_duration(args.input),
            "language": lang, "segments": segments}
    with open(os.path.join(args.out, "transcript.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(os.path.join(args.out, "transcript.txt"), "w", encoding="utf-8") as f:
        for s in segments:
            f.write(f"[{fmt(s['start'])} - {fmt(s['end'])}] {s['text']}\n")
    print(f"wrote {len(segments)} segments -> {args.out}/transcript.json", file=sys.stderr)


if __name__ == "__main__":
    main()
