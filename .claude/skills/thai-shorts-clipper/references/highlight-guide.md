# Choosing highlights, hooks and keywords

## How many clips

About 1 clip per 3–5 minutes of source, max ~10. Fewer strong clips beat many weak ones.
Rank them; say which 2–3 you would post first.

## What makes a good clip (score each candidate 1–5 on these)

| Criterion | Look for in the transcript |
|---|---|
| **Hook in the first 3 s** | the clip's first sentence is a claim, question, number, conflict or surprise, not “ครับ ก็…”, “อย่างที่บอกไป”, greetings |
| **Stands alone** | no “เขา/อันนั้น/เรื่องเมื่อกี้” that needs earlier context. If it does, move `start` back or skip |
| **Payoff** | a punchline, answer, lesson, number or reveal before `end`. End right after it (+0.2 s), not on “เดี๋ยวเราไปต่อ” |
| **Emotion / stakes** | money, failure, mistakes, strong opinion, funny moment, personal story, before/after |
| **Specificity** | concrete numbers, names, steps (“3 วิธี”, “ขาดทุน 2 แสน”) beat general talk |
| **Length** | 20–60 s is the sweet spot; up to 90 s only if the story holds. Under 15 s rarely works |

Keep candidates scoring ≥ 14/25. Never combine non-adjacent parts into one clip (this tool cuts
one continuous range), but you can trim a slow opening sentence by starting later.

Signals that a moment is strong: laughter words (555, ฮา), the speaker repeats or stresses a
point, a question from the host followed by a long answer, contrast words (แต่, จริงๆ แล้ว,
ไม่ใช่…แต่…), list openers (ข้อแรก, มี 3 อย่าง).

## Hook text (on-screen headline)

- Thai, ≤ 25 characters ideally, one line; may end with `?` or `…`
- Must be **true to the clip**: no promise the clip does not deliver
- Patterns that work:
  - Question: “ตัดคลิปวันละ 3 ชม.?”
  - Number/result: “งานแรกได้แค่ 500 บาท”
  - Contrarian: “อย่าเพิ่งลาออกไปเป็นฟรีแลนซ์”
  - Curiosity gap: “สิ่งที่ไม่มีใครบอกก่อนเริ่มทำช่อง”
  - Pain point: “ทำไมคลิปไม่มีคนดู”
- Offer 2 alternatives per clip in the table you show the user; put your pick in `clips.json`.

## Emphasis words

1–2 per ~10 s. Pick numbers, money, time, strong emotion words and the key noun of the
punchline (e.g. `"สามชั่วโมง"`, `"ขาดทุน"`, `"ฟรี"`). Copy the spelling exactly from the
transcript. These also drive auto zoom, so don't over-pick (more than ~6 per clip feels jumpy).

## Layout choice

- One person talking to camera → `auto`/`full`
- Two people, both reacting matters (podcast, interview) → `split`
- Two people, one mostly talks → `full` (follows the speaker)
- Screen, slides, product on a table, wide group shot → `fit`
- If the first preview shows the wrong person, switch to `split` or `fit` rather than fighting it.

## B-roll suggestions

Only if the user has footage. Suggest 1–3 spots per clip where the speaker describes something
visual (a place, product, screen, result) for 2–4 s; list them so the user can supply files.

## Table to show the user before rendering

| # | ช่วงเวลา | ยาว | Hook (ตัวเลือก) | ทำไมน่าสนใจ | Layout |
|---|---|---|---|---|---|
| 01 | 03:12–03:58 | 46 s | งานแรกได้แค่ 500 บาท / ฟรีแลนซ์ปีแรกได้เท่าไหร่ | ตัวเลขจริง + เรื่องส่วนตัว + จบด้วยบทเรียน | full |
