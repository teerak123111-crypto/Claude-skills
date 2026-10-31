# clips.json schema

All times are **seconds in the source video** (absolute), as shown in `transcript.txt`
(`mm:ss.s` → convert: `03:12.4` = 192.4). Relative paths resolve from the folder of `clips.json`.

```json
{
  "source": "../my-video.mp4",
  "style": {
    "font": "Kanit",
    "size": 88,
    "color": "#FFFFFF",
    "highlight": "#FFD400",
    "outline": "#000000",
    "mode": "build",
    "position": "lower",
    "max_chars": 16,
    "hook_size": 62
  },
  "clips": [
    {
      "id": "01",
      "title": "งานแรกได้ 500",
      "start": 192.4,
      "end": 238.9,
      "hook": { "text": "งานแรกได้แค่ 500 บาท?", "duration": 0 },
      "emphasis": ["500 บาท", "ไม่มีวันหยุด"],
      "layout": "auto",
      "zoom": "auto",
      "broll": [ { "path": "broll/laptop.mp4", "start": 210.0, "end": 213.0 } ],
      "style": { "mode": "karaoke" }
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `source` | no | defaults to the path stored in `transcript.json` |
| `style.*` | no | defaults shown above; any clip can override with its own `style` |
| `style.position` | no | `lower` (above the TikTok/Reels caption area) or `middle` |
| `style.max_chars` | no | max visible characters per subtitle line (Thai tone marks not counted). 14–18 works at size 88 |
| `id` | yes | used for file names (`01.mp4`) |
| `start`, `end` | yes | snap to sentence boundaries from the transcript; add ~0.2 s padding at the end |
| `hook` | no | string or `{text, duration}`; `duration` 0/omitted = whole clip |
| `emphasis` | no | phrases as they appear in the transcript (spelling must match; spaces are ignored) → coloured + used for auto zoom |
| `layout` | no | `auto` · `full` · `split` · `fit` |
| `zoom` | no | `auto` (punch in on emphasis words, max one per 6 s) · `off` · list of `{ "at": 215.2, "dur": 1.6, "scale": 1.15 }` (absolute time) |
| `broll` | no | images (Ken Burns zoom) or videos (cover-cropped) shown full-screen; subtitles and hook stay on top |

Matching note: spaces are ignored when matching, so `"500 บาท"` matches `500บาท`, but the
Thai spelling must match the transcript exactly (e.g. `ชั่วโมง` vs `ชม.` are different).
