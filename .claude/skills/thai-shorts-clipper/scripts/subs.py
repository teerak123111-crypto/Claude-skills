"""Subtitle building: transcript words -> editable lines -> ASS (Thai-aware) and SRT."""
import json
import os
import re
import unicodedata

LATIN = re.compile(r"[A-Za-z0-9]")
THAI_PUNCT_BREAK = set("?!.,ๆ")


def visible_len(text):
    """Count characters that take horizontal space (Thai vowels/tone marks above/below do not)."""
    return sum(1 for ch in text if unicodedata.category(ch) not in ("Mn", "Me"))


def join_words(words):
    out = ""
    for w in words:
        if out and LATIN.search(out[-1]) and LATIN.search(w[0]):
            out += " "
        out += w
    return out


def words_in_range(transcript, start, end):
    words = []
    for seg in transcript["segments"]:
        if seg["end"] < start or seg["start"] > end:
            continue
        seg_words = seg.get("words") or []
        for i, w in enumerate(seg_words):
            if w["start"] >= start - 0.05 and w["end"] <= end + 0.05:
                words.append({"w": w["w"], "start": max(w["start"], start) - start,
                              "end": min(w["end"], end) - start,
                              "seg_end": i == len(seg_words) - 1})
    return words


def group_lines(words, max_chars=16, max_pause=0.45, max_dur=3.2):
    lines, cur = [], []
    for w in words:
        if cur:
            text = join_words([x["w"] for x in cur] + [w["w"]])
            gap = w["start"] - cur[-1]["end"]
            if (visible_len(text) > max_chars or gap > max_pause
                    or w["end"] - cur[0]["start"] > max_dur):
                lines.append(cur)
                cur = []
        cur.append(w)
        if w.get("seg_end") or w["w"][-1:] in THAI_PUNCT_BREAK:
            lines.append(cur)
            cur = []
    if cur:
        lines.append(cur)
    # merge tiny orphan lines (one short word) into the previous line when close in time
    merged = []
    for ln in lines:
        if (merged and len(ln) == 1 and visible_len(ln[0]["w"]) <= 3
                and ln[0]["start"] - merged[-1][-1]["end"] < 0.3
                and visible_len(join_words([x["w"] for x in merged[-1] + ln])) <= max_chars + 4):
            merged[-1].extend(ln)
        else:
            merged.append(ln)
    return merged


def mark_emphasis(line_words, phrases):
    """Return set of word indexes that belong to any emphasis phrase (spaces ignored)."""
    text, spans = "", []
    for w in line_words:
        a = len(text)
        text += w["w"].replace(" ", "")
        spans.append((a, len(text)))
    hit = set()
    for ph in phrases or []:
        ph = ph.replace(" ", "")
        if not ph:
            continue
        for m in re.finditer(re.escape(ph), text):
            for i, (a, b) in enumerate(spans):
                if a < m.end() and b > m.start():
                    hit.add(i)
    return hit


def nospace(text):
    return text.replace(" ", "")


def keep_phrases_together(lines, phrases):
    """If an emphasis phrase got split across two lines, move its first part to the next line."""
    phrases = [p.strip() for p in phrases or [] if p.strip()]
    for i in range(len(lines) - 1):
        a, b = lines[i], lines[i + 1]
        a_text, b_text = join_words([w["w"] for w in a]), join_words([w["w"] for w in b])
        for k in range(1, min(len(a), 4)):
            joined = join_words([w["w"] for w in a[-k:] + b])
            if any(nospace(ph) in nospace(joined) and nospace(ph) not in nospace(a_text)
                   and nospace(ph) not in nospace(b_text) for ph in phrases):
                lines[i], lines[i + 1] = a[:-k], a[-k:] + b
                break
    return lines


def build_sub_lines(transcript, clip, style):
    words = words_in_range(transcript, clip["start"], clip["end"])
    lines = group_lines(words, max_chars=style.get("max_chars", 16))
    lines = keep_phrases_together(lines, clip.get("emphasis"))
    out = []
    for ln in lines:
        hi = mark_emphasis(ln, clip.get("emphasis"))
        out.append({
            "start": round(ln[0]["start"], 3),
            "end": round(ln[-1]["end"], 3),
            "text": join_words([w["w"] for w in ln]),
            "words": [{"w": w["w"], "start": round(w["start"], 3), "end": round(w["end"], 3),
                       **({"hi": True} if i in hi else {})} for i, w in enumerate(ln)],
        })
    # keep each line on screen until the next one starts (no flicker on short gaps)
    for a, b in zip(out, out[1:]):
        if 0 < b["start"] - a["end"] < 0.6:
            a["end"] = b["start"]
    return out


def resync_edited(lines, emphasis):
    """If a user edited a line's `text`, re-split it and spread the line's time over the new words."""
    for ln in lines:
        current = join_words([w["w"] for w in ln.get("words", [])])
        if ln.get("words") and current == ln["text"]:
            continue
        try:
            from pythainlp.tokenize import word_tokenize
            toks = [t for t in word_tokenize(ln["text"], engine="newmm") if t.strip()]
        except ImportError:
            toks = ln["text"].split()
        total = sum(visible_len(t) for t in toks) or 1
        t, dur, words = ln["start"], ln["end"] - ln["start"], []
        for tok in toks:
            d = dur * visible_len(tok) / total
            words.append({"w": tok, "start": round(t, 3), "end": round(t + d, 3)})
            t += d
        hi = mark_emphasis(words, emphasis)
        for i in hi:
            words[i]["hi"] = True
        ln["words"] = words
    return lines


def load_or_build(path, transcript, clip, style, rebuild=False):
    if os.path.exists(path) and not rebuild:
        with open(path, encoding="utf-8") as f:
            lines = json.load(f)
        lines = resync_edited(lines, clip.get("emphasis"))
    else:
        lines = build_sub_lines(transcript, clip, style)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(lines, f, ensure_ascii=False, indent=1)
    return lines


# ---------------------------------------------------------------- ASS / SRT

def ass_color(hex_color, alpha=0):
    h = hex_color.lstrip("#")
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H{alpha:02X}{b}{g}{r}".upper()


def ass_time(t):
    t = max(t, 0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def esc(text):
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


def write_ass(path, lines, clip, style, W=1080, H=1920, duration=None):
    font = style.get("font", "Kanit")
    size = style.get("size", 88)
    color = style.get("color", "#FFFFFF")
    hl = style.get("highlight", "#FFD400")
    outline = style.get("outline", "#000000")
    mode = style.get("mode", "build")
    pos = style.get("position", "lower")
    align, margin_v = (2, int(H * 0.24)) if pos == "lower" else (5, 0)

    hook = clip.get("hook") or {}
    if isinstance(hook, str):
        hook = {"text": hook}
    hook_size = style.get("hook_size", 62)

    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{font},{size},{ass_color(color)},{ass_color(hl)},{ass_color(outline)},{ass_color('#000000', 0x80)},-1,0,0,0,100,100,0,0,1,6,2,{align},60,60,{margin_v},1
Style: Hook,{font},{hook_size},{ass_color('#FFFFFF')},{ass_color(hl)},{ass_color('#000000', 0x50)},{ass_color('#000000', 0x50)},-1,0,0,0,100,100,0,0,3,18,0,8,80,80,{int(H * 0.11)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    c_norm, c_hi = ass_color(color), ass_color(hl)

    def render_words(words, active=None, upto=None):
        parts, prev = [], ""
        for i, w in enumerate(words):
            sep = " " if prev and LATIN.search(prev[-1]) and LATIN.search(w["w"][0]) else ""
            col = c_hi if (w.get("hi") or i == active) else c_norm
            tags = f"\\c{col}"
            if upto is not None and i > upto:
                tags += "\\alpha&HFF&"
            elif upto is not None or i == active:
                tags += "\\alpha&H00&"
            if i == active and mode == "karaoke":
                tags += "\\fscx108\\fscy108"
            elif mode == "karaoke":
                tags += "\\fscx100\\fscy100"
            parts.append(f"{sep}{{{tags}}}{esc(w['w'])}")
            prev = w["w"]
        return "".join(parts)

    for ln in lines:
        words = ln["words"]
        if mode == "line" or len(words) == 1:
            ev.append((ln["start"], ln["end"], "Sub", render_words(words)))
            continue
        for i, w in enumerate(words):
            a = ln["start"] if i == 0 else w["start"]
            b = words[i + 1]["start"] if i + 1 < len(words) else ln["end"]
            if b - a < 0.01:
                continue
            if mode == "karaoke":
                ev.append((a, b, "Sub", render_words(words, active=i)))
            else:  # build: words appear as they are spoken; layout stays fixed
                ev.append((a, b, "Sub", render_words(words, upto=i)))

    if hook.get("text"):
        end = hook.get("duration") or duration or (lines[-1]["end"] if lines else 5)
        ev.append((0, end, "Hook", "{\\fad(150,150)}" + esc(hook["text"])))

    with open(path, "w", encoding="utf-8") as f:
        f.write(head)
        for a, b, st, txt in ev:
            layer = 1 if st == "Hook" else 0
            f.write(f"Dialogue: {layer},{ass_time(a)},{ass_time(b)},{st},,0,0,0,,{txt}\n")


def srt_time(t):
    ms = int(round(max(t, 0) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(path, lines):
    with open(path, "w", encoding="utf-8") as f:
        for i, ln in enumerate(lines, 1):
            f.write(f"{i}\n{srt_time(ln['start'])} --> {srt_time(ln['end'])}\n{ln['text']}\n\n")
