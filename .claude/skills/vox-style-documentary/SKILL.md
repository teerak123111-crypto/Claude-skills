---
name: vox-style-documentary
description: Make a Vox-style documentary / history / mystery explainer clip from a Thai voice-over, in vertical 9:16 OR horizontal 16:9 (always ask which first). AI-generated cinematic stills composited in code as 2.5D parallax layers (plate + cut-out subject + foreground), bold red kinetic words behind the subject; by default the user generates the stills themselves from a prompt worksheet (copy buttons) and the skill checks / cuts them out, film grain, aged paper, fog, light leaks, evidence boards with red marker / stamps / red string, whip / zoom-through / defocus-dip transitions, tension underscore + SFX, -14 LUFS. Also takes a face-to-camera talking-head video: the speaker becomes a small circle at the bottom centre (full screen ~10 %), and characters can wear the speaker's face. Use for "สไตล์ Vox", Vox-style, documentary / true crime / history / mystery clips (คลิปสารคดี, คลิปประวัติศาสตร์, คลิปปริศนา) and AE-style parallax photo animation.
---

# Vox-style documentary (2.5D photo collage)

Reply to the user in Thai. Paths below are relative to this skill folder (`S`).

Style source: a 32 s 9:16 After Effects tutorial result ("How I Made This Vox-Style Animation", Victor Lustig sells the
Eiffel Tower, 1925). Analysis in `reference/style-analysis.md` (the clip itself is not included). Worked example: `example/db-cooper/` (script,
episode.js with the image prompts in ASSETS, the generated worksheet prompts.html / prompts.md, animatic sheets). `engine/episode.js` is the same demo and works without any images (labelled placeholders).

## Step 0: ask first (AskUserQuestion, one call, before anything else)
1. **Format**: แนวตั้ง 9:16 (TikTok / Reels / Shorts, 1080x1920) or แนวนอน 16:9 (YouTube, 1920x1080). Never assume.
   Write the answer into `engine/format.js` (`var FORMAT = '9:16'` / `'16:9'`) and generate every image at that aspect.
2. **Images**, three options, recommend the first:
   - **"ส่ง prompt ให้ฉันไปเจนเอง" (default)**: the skill writes a worksheet (`prompts.html`, one card per image with
     a copy button, file name, aspect, size, character reference to attach); the user generates in any tool they
     have (ChatGPT, Gemini, Midjourney, Leonardo ...) and drops the files into `WORK/images/`. Free for the user,
     works for students without an API account.
   - generate here with the image tool connected in this session (e.g. fal), price quoted first;
   - the user's own images / footage.
3. Unless already given: the narration and the exact script text, and the topic / cover title. The narration is either
   a voice file (mp3) or a **talking-head video** (the person speaks to the camera): then use talking-head mode below.

## Talking-head mode (face-to-camera video)
- `python3 $S/tools/speaker.py talk.mp4 $W` instead of tighten.py: keeps the timeline (no pause cutting, the lips must
  stay in sync), writes vo-tight.wav + chunks for align.py, the video as frames, `engine/speaker.js` (SPEAKER with the
  face position found by Apple Vision) and `images/speaker_ref.jpg` (clearest frontal frame). END >= SPEAKER.dur.
- The speaker is drawn by the engine on top of the graphics, per scene (`SC` opts `spk`):
  `full` = full screen, **about 10 % of the clip** (the opening hook and the ending, `over: fn` puts words on top);
  `circle` (default) = a small round face video at the **bottom centre**, **60-90 % of the clip**, over the subject's
  legs; `off` = graphics only for the rest (paper card, evidence board, big reveal). Morphs between them are automatic.
  `node render.js engine info` prints the shares and flags them when off target.
- The speaker keeps the video's own colours: no grade, grain or paper over the face (drawn after the film finish),
  only the graphics behind it are graded. `SPKGRADE = true` in episode.js grades it too, only if the user asks.
- Layout with the circle: faces of cut-outs, words and key details above `spkTop()`; a standing cut-out can go down
  to the bottom edge (the circle hides the legs, as in the reference). `SPKC = {x, y, d}` moves / resizes it.
- Example: `example/talking-head/episode.js`.

## Who is in the pictures (faces)
- The story is about the speaker -> characters with the speaker's own face: `CHARS.me = { ref: 'speaker', desc }`;
  the worksheet tells the user to attach `images/speaker_ref.jpg` (made by speaker.py) to those prompts.
- The story is about another notable real person -> their face: `CHARS.x = { ref: 'photo', who: 'name', desc }`; the
  user finds a clear frontal photo they may use (e.g. Wikimedia Commons) and saves it as `images/x_ref.jpg`. If the
  image tool refuses a real person, use that photo itself on the board (`photo()`) instead of generated scenes.
- Everyone and everything else (other people, crowds, places, objects) -> prompts in the worksheet for the user to
  generate; a recurring invented character gets `CHARS.y = 'description'` and a ★ reference prompt generated first.

## The look (keep it)
- Every shot = 1-3 photo layers moving at different depths: `plate()` background (d .3-.6), optional words layer,
  `cut()` subject PNG (d 1), optional foreground (fog, bushes, a blurred shoulder, d 1.3-2). The camera always moves
  (`camMove` push-in / pull-out / tilt, + `drift`), never a still frame; a shot lasts 3-5 s.
- **Red words behind the subject**: draw `words()` before `cut()`. Mix fonts: `serifI` (bold italic serif) for names
  and the twist word, `sans` (IBM Plex Sans Thai Bold) for years, numbers and verbs. 1-3 words per beat, they appear
  on the spoken word (blur-in). No full subtitles (the reference has none; `sub()` exists if the user asks for them).
- Warm sepia film: `LOOK` = grade warm (sepia / noir / cold for other moods), grain, paper texture, dust, vignette,
  lifted blacks. Bright scenes look printed on old paper, interiors are dark wood with warm practical light
  (`rays`, `leak`, `motes`), fog drifts through openings and big title words (`fog`).
- Graphics drawn in code, no image needed: brown paper card with white text (`paperCard` + `txt`) for the
  cliff-hanger line, cork board (`cork`) with typed documents (`doc`), printed photos (`photo`), pins, tape, red string
  (`string`), red marker loops / underlines / arrows / crosses (`markerCircle` ...), rubber stamps (`stamp`),
  highlighter and redaction bars.
- Transitions (`TR`): `whip` (motion-blur pan) between places, `zoom` into a detail that becomes the next scene
  (a picture frame, a photo, a window), `dip` (defocus to dark) for time jumps / bad news, `blur` dissolve inside a
  sequence, `burn` for memories, `cut` + hit into the paper card.
- Sound: tension underscore (D minor drones, piano motif, pulsing bass, ticks), soft whoosh on every word, hits on
  key reveals, scribble for the marker, thud for stamps. Narration -14 LUFS.

## Script (if the user has none)
Vox-style mystery, ~60 s ≈ 700-750 Thai characters: hook with a year and a place -> who -> what they did (numbers) ->
how it went wrong / the chase -> twist -> "และที่แปลกที่สุดคือ..." cliff-hanger or closing question. Short phrases
separated by spaces / new lines exactly as sent to the voice, numbers spelled the way they are spoken, sources for
every fact. Give it to the user to record (ElevenLabs), then continue.

## Pipeline (tools/, run from a WORK folder)
```
S=<skill>; W=<work>; mkdir -p $W && cp -r $S/engine $W/engine && cp vo.mp3 script.txt $W/ && cd $W
# engine/format.js <- the user's answer
python3 $S/tools/tighten.py vo.mp3 vo-tight.wav 0.35 1.04 0.4     # cap pauses .35 s, speed 1.04, lead-in .4 s
#   talking-head video instead of a voice file: python3 $S/tools/speaker.py talk.mp4 .   (keeps sync, no pause cutting)
python3 $S/tools/align.py script.txt vo-tight-chunks.json words.json
#  1) plan the shots, write engine/episode.js: TITLE, STYLE, CHARS, ASSETS (one entry per image, with its prompt), scenes
#  2) ANIMATIC with placeholders, show the sheet; adjust timing before anyone makes images
node $S/tools/render.js engine snap snaps 1,3,5,...  &&  python3 $S/tools/sheet.py snaps sheet.jpg 6
#  3) images. Worksheet (default mode): give the user prompts.html (open it / send it) and wait for "ใส่ภาพแล้ว"
node $S/tools/render.js engine prompts .            # -> prompts.html + prompts.md + images/ folder
python3 $S/tools/check_images.py .                  # images/ -> engine/assets/: names, sizes, auto cut-out, report
#     repeat check_images after every batch; send the user its report in Thai (what is missing / too small / wrong way)
bash $S/tools/render_all.sh $W 4 30                 # 4 workers -> out/video.mp4 (25 s ≈ 30 s on 4 cores)
bash $S/tools/finish.sh $W "<ชื่อคลิป>"              # cues -> audio.py -> -14 LUFS mux -> final/ + ปก.jpg
```
Needs node + playwright (chromium), ffmpeg, python3 with numpy, scipy, pillow (SETUP.md). Deliver
`<name> (มีเพลง).mp4`, `<name> (ไม่มีเพลง).mp4`, `ปก.jpg`. Grain makes files ~1.5 MB/s (capped at 12 Mbit/s).

## Images
- The prompts live in `ASSETS` (episode.js), so the worksheet, the placeholders and check_images always agree:
  `name: { prompt, note, shot, cut, photo, char, text }`. Write `prompt` in English without the style (worksheet.js
  adds `STYLE`, the character text from `CHARS`, the aspect, "empty space for text", "isolated on plain grey" for
  cut-outs and "no text / watermark / grain"); `note` and `shot` in Thai for the card and the placeholder.
- Keep it doable: ~1 image per 3-5 s of clip, at most ~2 cut-outs per shot, reuse a plate for two shots with a
  different `focus` / camera move. Characters: one `CHARS` entry each; the worksheet asks for a `<char>_ref` image
  first and to attach it to every prompt with that person.
- check_images.py: matches names loosely (case, spaces, "(1)"), converts webp / heic / png -> jpg plates, warns about
  too small or wrong-orientation images, removes cut-out backgrounds with `tools/cutout.swift` (Apple Vision, free,
  macOS 14+). On Windows: remove.bg / Canva / Photos, save as PNG. A cut-out that still has its background is drawn
  with a soft oval fade (`render.js` prints NOALPHA) so the clip never breaks.
- Generating here (paid mode): show the animatic + image list + price first, generate only after a yes; same prompts.
- Style prefix on every prompt: cinematic documentary photograph, the era, warm muted palette, motivated light,
  shallow depth of field, realistic, **no text, no watermark, no grain** (the engine adds grain and paper).
- Lock the character: make one reference image first, then every shot of that person from it with a reference /
  image-edit model. Same clothes and props in every prompt.
- Plates: at the chosen aspect, 1152x2048 (9:16) or 2048x1152 (16:9) or larger; leave empty space where the words go.
  `plate(name, {focus: [fx, fy]})` picks the crop centre, so a 16:9 image can still serve a 9:16 shot when needed.
- Cut-outs: generate the subject alone on a plain light-grey background, full body / whole object, then run a
  background-removal model and save as `.png` with alpha (the `.png` extension is what makes it a cut-out).
- Optional motion: image-to-video for 1-3 key shots (5 s), then `bash $S/tools/clip2frames.sh clip.mp4
  engine/assets/<name> 24` and add the printed line to `CLIPS`; draw it with `clip(name, t - t0, {...})`.
- With the user's own images: put them in `images/` named like the worksheet and run check_images.py.

## Writing episode.js
- Globals: `TITLE`, `STYLE`, `CHARS`, `ASSETS`, `END`, scene functions, `SC = [[t0, t1, sX, look?], ...]`, `TR = [[t, type, dur, opts?], ...]`,
  `cover()`; optional `LOOK`, `CLIPS`, `CUES` (music sections, extra SFX, `mute`). kit/stage.js header documents them.
- One layout for both formats: positions as fractions of `W` / `H`, sizes in `U` units, and `pick(v9x16, v16x9)`
  where the two need different values (text size, subject height, where the words sit).
- Plan from words.json: one shot per idea (3-5 s, ~14 shots per minute); a shot starts 0.1-0.3 s before its first
  phrase; every boundary gets a transition centred on it. Words appear on their spoken word (`at` from words.json).
- Stateless frames: everything is a function of t (`seg`, `ease`, `camMove`, `appear`); randomness only via `rng(seed)`.
- Layers: `plate(name, {d, over, focus, blur, filter, a})`, `cut(name, x, y, h, {d, anchor, a, blur, shadow, rot,
  flip})`, `words(t, lines, {x, y, size, col, d, kind, style, maxW, a})`, `layer(d, () => ...)` for anything drawn in
  code at a depth. `appear(t, t0, 'blur'|'rise'|'grow'|'slam', dur)` gives {a, blur, s, dy}; `vanish(t, t1)` fades out.
- Sounds come from the drawing calls (words -> soft whoosh, stamp -> thud, marker -> scribble, transitions -> whooshes);
  add `CUES.sfx` for hits / booms / risers / ticks / typewriter / paper / shutter / heartbeat, `CUES.music` presets
  intro mystery tension noir drive reveal sad hush outro (follow the story: hush right before the twist).

## Checks before delivering
- Sheet of stills every ~2 s at the chosen format + full-size frames at transition midpoints.
- No placeholders left and no NOALPHA cut-outs (`render.js engine info`, `check_images.py`), words inside the safe area (9:16: keep the bottom 20 % and right
  edge free of key text for the app UI), words match the script, faces not covered by words.
- Both versions ≈ -14 LUFS, length = END. Put the result in a folder the user can open and tell them where.
- Fix rounds: re-render only the changed range (`render.js engine video part.mp4 F0 F1`) when the user agrees.

## Gotchas
- render.js starts Chromium with `--allow-file-access-from-files`; without it photos taint the canvas.
- Thai has no italics: `serifI` on Thai falls back to a system Thai font with a slant; keep Latin names in serifI and
  Thai names short. Keep a word line within `maxW` (auto-shrinks).
- Placeholders keep the animatic honest about timing only; judge colour / grade on real images.
- `zoom` transitions zoom into `opts.at` of the OLD frame: put the detail (photo, frame, window) exactly there.
- Big blur values are slow; keep `blur` ≤ 40 and use it only during transitions or on far plates.
