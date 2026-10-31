---
name: thai-shorts-clipper
description: Turn one long video (vlog, podcast, live stream, class, seminar, product review) into several short vertical 9:16 clips for TikTok / Reels / Shorts, with Thai word-by-word subtitles, keyword highlight colour, an AI hook headline, speaker-following reframe (full / split / fit layouts), auto punch-in zoom and optional B-roll. Use when the user asks to ตัดคลิป, ตัดคลิปสั้น, หาช่วงเด็ด, ทำ shorts/reels/tiktok จากวิดีโอยาว, ใส่ซับไทย, clip a long video, find highlights, or repurpose a video into shorts.
---

# Thai Shorts Clipper

Long video → transcript → **you choose the highlights** → rendered 1080×1920 clips.
Scripts do the mechanical work (transcribe, track faces, cut, subtitle, encode); your job is
the editorial part: picking moments, writing hooks, choosing keywords and layouts.

Scripts live in `scripts/` next to this file. Below, `$S` means that folder.

## 0. Setup (once per machine)

```bash
ffmpeg -version            # must exist (macOS: brew install ffmpeg · Windows: winget install Gyan.FFmpeg)
pip install -r $S/../requirements.txt
```

- OpenCV must be **4.x** (`opencv-python-headless<5`); 5.x has no Haar fallback.
- The YuNet face model (230 KB) downloads once to `~/.cache/thai-shorts-clipper/` and is checked by SHA-256.
- Fonts: libass uses system fonts. For the bold “shorts” look, put **Kanit** or **Prompt**
  (Google Fonts, free OFL) `.ttf` files in a `fonts/` folder and pass `--fontsdir fonts`.
  Set `style.font` to the exact family name (e.g. `"Kanit"`).

## 1. Transcribe

```bash
python $S/transcribe.py INPUT.mp4 --out work/ --model large-v3 --lang th \
  --prompt "ชื่อช่อง ชื่อสินค้า ศัพท์เฉพาะ"
```

- Thai needs `medium` or `large-v3`; `small` and below misspell a lot. CPU works but is slow
  (roughly real-time or slower for large-v3); `--device cuda` if there is a GPU.
- Outputs `work/transcript.json` (word timings, Thai words re-split with PyThaiNLP) and
  `work/transcript.txt` (one timed line per sentence; this is what you read).

## 2. Pick highlights and write the plan (your job)

Read **all** of `work/transcript.txt`, then follow `references/highlight-guide.md` to choose
clips, hooks, keywords and layouts. Write `work/clips.json` using the schema in
`references/clip-plan.md`.

Before rendering, show the user a table: id · time range · length · hook · why it works.
Let them drop/adjust clips (this is the “เลือก” step). Do not render everything blind.

## 3. Subtitles (optional review)

```bash
python $S/render_clip.py --plan work/clips.json --transcript work/transcript.json --out work/clips --subs-only
```

Writes `work/clips/<id>.subs.json`. To fix a misheard word, edit that line's `text` only;
timings are re-spread automatically on the next run. `--rebuild-subs` discards edits.
Mention to the user that Whisper's Thai is good but not perfect: names, slang and English
loanwords are the usual errors; skim each clip's lines.

## 4. Preview one clip, then render

```bash
python $S/render_clip.py ... --only 01 --preview 8 --preset veryfast
ffmpeg -v error -y -ss 4 -i work/clips/01.mp4 -frames:v 1 -vf scale=360:-1 work/clips/check.png
```

Look at `check.png` (Read it): is the face in frame, are subs readable and not covered by the
hook, are Thai vowels/tone marks rendering (if you see boxes, the font is missing Thai)?
Then render all clips (drop `--only/--preview`, default preset `medium`).

Outputs per clip: `<id>.mp4` (H.264/AAC, 1080×1920, faststart), `<id>.srt`, `<id>.ass`,
`<id>.subs.json`, plus `clips.md` summary. Report the table from `clips.md` to the user.

## Layouts

| `layout` | What it does | Use for |
|---|---|---|
| `auto` (default) | `full` if faces found (or source already vertical), `fit` if no faces | most videos |
| `full` | 9:16 crop that follows the active speaker (mouth-motion + 1.2 s hold before cutting); frames the group if everyone fits | vlog, 1–3 person talk |
| `split` | top/bottom halves, one person each (leftmost on top) | 2-person podcast/interview |
| `fit` | whole frame centred over a blurred copy (“ใส่กรอบ”) | screen recordings, slides, wide shots, product demos |

## Subtitle modes (`style.mode`)

- `build` (default): words appear as they are spoken; the line stays put. Keywords in highlight colour.
- `karaoke`: whole line visible, current word coloured and slightly enlarged.
- `line`: whole line at once, keywords coloured.

## Limits (tell the user when relevant)

- Speaker detection is a heuristic (mouth movement). Wrong picks happen with beards/masks,
  side-on faces, or when the listener nods a lot; fix with `layout: "split"` or `"fit"`.
- B-roll is **not generated**; the user supplies image/video files (`broll` in the plan).
  You may suggest *where* B-roll would help and what to shoot/find.
- No automatic posting. Hooks are suggestions; the user approves them.
- Respect copyright: only clip videos the user owns or has rights to.
