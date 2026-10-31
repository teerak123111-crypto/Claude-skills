#!/usr/bin/env python3
"""Render short vertical clips (9:16) from a clip plan.

Usage:
    python render_clip.py --plan work/clips.json --transcript work/transcript.json --out work/clips
        [--only 01,03] [--subs-only] [--rebuild-subs] [--preview 8] [--fps 30] [--fontsdir fonts/]

Per clip it writes:
    <id>.subs.json  editable subtitle lines (edit `text`, then re-run; timings are kept)
    <id>.srt        plain subtitles for upload platforms
    <id>.ass        styled subtitles (word pop, keyword colour, hook)
    <id>.mp4        final 1080x1920 clip (unless --subs-only)
"""
import argparse
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reframe  # noqa: E402
import subs  # noqa: E402

OUT_W, OUT_H = 1080, 1920
WORK_MAX_W = 1920


def probe(src):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate:stream_side_data=rotation", "-of", "json", src],
        capture_output=True, text=True, check=True).stdout
    st = json.loads(out)["streams"][0]
    num, den = map(int, st["r_frame_rate"].split("/"))
    w, h = st["width"], st["height"]
    rot = 0
    for sd in st.get("side_data_list", []) or []:
        rot = int(sd.get("rotation", 0) or 0)
    if abs(rot) in (90, 270):
        w, h = h, w
    has_audio = bool(json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
         "-of", "json", src], capture_output=True, text=True).stdout or "{}").get("streams"))
    return w, h, num / max(den, 1), has_audio


# ---------------------------------------------------------------- zoom

def ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * min(max(x, 0), 1))


def zoom_events(clip, lines, dur):
    z = clip.get("zoom", "auto")
    if z in (None, "off", False):
        return []
    if isinstance(z, list):
        return [{"at": e["at"] - clip["start"], "dur": e.get("dur", 1.6),
                 "scale": e.get("scale", 1.15)} for e in z]
    # auto: punch in on emphasised words, at most one zoom every 6 s
    events, last = [], -99
    for ln in lines:
        for w in ln["words"]:
            if w.get("hi") and w["start"] - last >= 6 and w["start"] < dur - 1:
                events.append({"at": max(w["start"] - 0.25, 0), "dur": 1.8, "scale": 1.15})
                last = w["start"]
    return events


def zoom_at(t, events):
    s = 1.0
    for e in events:
        ramp = 0.35
        a, b = e["at"], e["at"] + e["dur"]
        if a <= t <= b:
            k = min(ease((t - a) / ramp), ease((b - t) / ramp))
            s = max(s, 1 + (e["scale"] - 1) * k)
    return s


# ---------------------------------------------------------------- framing

def crop_cover(img, cx, cy, out_w, out_h, zoom=1.0):
    """Crop a window with the out aspect centred near (cx, cy), then resize to out size."""
    h, w = img.shape[:2]
    aspect = out_w / out_h
    ch = h / zoom
    cw = ch * aspect
    if cw > w:
        cw = w / zoom
        ch = cw / aspect
    x0 = int(round(min(max(cx - cw / 2, 0), w - cw)))
    y0 = int(round(min(max(cy - ch / 2, 0), h - ch)))
    crop = img[y0:y0 + int(round(ch)), x0:x0 + int(round(cw))]
    return cv2.resize(crop, (out_w, out_h), interpolation=cv2.INTER_LINEAR)


def fit_frame(img, zoom=1.0):
    h, w = img.shape[:2]
    bg = crop_cover(img, w / 2, h / 2, OUT_W // 4, OUT_H // 4)
    bg = cv2.GaussianBlur(bg, (0, 0), 12)
    bg = cv2.resize((bg * 0.55).astype(np.uint8), (OUT_W, OUT_H))
    fw = int(OUT_W * zoom)
    fh = int(h * fw / w)
    fg = cv2.resize(img, (fw, fh), interpolation=cv2.INTER_AREA)
    if fw > OUT_W:
        x0 = (fw - OUT_W) // 2
        fg = fg[:, x0:x0 + OUT_W]
        fw = OUT_W
    fh = min(fh, OUT_H)
    y0 = int(OUT_H * 0.42 - fh / 2)
    y0 = min(max(y0, 0), OUT_H - fh)
    x0 = (OUT_W - fw) // 2
    bg[y0:y0 + fh, x0:x0 + fw] = fg[:fh]
    return bg


class Framer:
    def __init__(self, clip, info, w, h):
        self.w, self.h, self.info = w, h, info
        layout = clip.get("layout", "auto")
        people = info["people"]
        vertical = w / h <= 0.65
        if layout == "auto":
            if vertical:
                layout = "full"
            elif not people:
                layout = "fit"
            else:
                layout = "full"
        if layout == "split" and len(people) < 2:
            print(f"  [{clip['id']}] split needs 2 people, found {len(people)} -> full", file=sys.stderr)
            layout = "full"
        self.layout = layout
        # if every person fits inside one 9:16 window, frame the group instead of switching
        crop_w = h * 9 / 16
        self.group = len(people) >= 2 and max(people) - min(people) < crop_w * 0.7
        if len(people) >= 2:
            order = np.argsort(people)
            self.pair = (int(order[0]), int(order[-1]))

    def _idx(self, t):
        n = self.info["n"]
        return min(int(t * reframe.ANALYSIS_FPS), n - 1) if n else None

    def frame(self, img, t, zoom):
        i = self._idx(t)
        if self.layout == "fit":
            return fit_frame(img, zoom)
        if self.layout == "split" and i is not None:
            a, b = self.pair
            pos, posy = self.info["pos"], self.info["posy"]
            half = OUT_H // 2
            top = crop_cover(img, pos[i][a], posy[i][a] + self.h * 0.1, OUT_W, half, 1.35 * zoom)
            bot = crop_cover(img, pos[i][b], posy[i][b] + self.h * 0.1, OUT_W, half, 1.35 * zoom)
            out = np.vstack([top, bot])
            out[half - 3:half + 3] = 0
            return out
        if i is None or not self.info["people"]:
            cx, cy = self.w / 2, self.h / 2
        elif self.group:
            cx = float(np.mean(self.info["pos"][i]))
            cy = float(np.mean(self.info["posy"][i]))
        else:
            cx, cy = self.info["cx"][i], self.info["cy"][i]
        # when zooming, drift the vertical centre toward the face
        k = min(max((zoom - 1) / 0.15, 0), 1)
        cy = self.h / 2 + (cy - self.h / 2) * k
        return crop_cover(img, cx, cy, OUT_W, OUT_H, zoom)


# ---------------------------------------------------------------- b-roll

class BRoll:
    IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".bmp")

    def __init__(self, items, clip_start, base, fps):
        self.items = []
        for it in items or []:
            path = it["path"] if os.path.isabs(it["path"]) else os.path.join(base, it["path"])
            if not os.path.exists(path):
                print(f"  b-roll missing, skipped: {path}", file=sys.stderr)
                continue
            self.items.append({"path": path, "a": it["start"] - clip_start,
                               "b": it["end"] - clip_start, "gen": None, "img": None})
        self.fps = fps

    def frame(self, t):
        for it in self.items:
            if not (it["a"] <= t < it["b"]):
                continue
            if it["path"].lower().endswith(self.IMG_EXT):
                if it["img"] is None:
                    it["img"] = cv2.imread(it["path"])
                img = it["img"]
                prog = (t - it["a"]) / max(it["b"] - it["a"], 0.1)
                return crop_cover(img, img.shape[1] / 2, img.shape[0] / 2, OUT_W, OUT_H, 1 + 0.08 * prog)
            if it["gen"] is None:
                it["gen"] = self._video(it["path"], it["b"] - it["a"])
            return next(it["gen"], None)
        return None

    def _video(self, path, dur):
        vf = (f"fps={self.fps},scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,"
              f"crop={OUT_W}:{OUT_H}")
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-t", f"{dur:.3f}", "-i", path, "-vf", vf,
                              "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
        size = OUT_W * OUT_H * 3
        while True:
            buf = p.stdout.read(size)
            if len(buf) < size:
                break
            yield np.frombuffer(buf, np.uint8).reshape(OUT_H, OUT_W, 3)
        p.wait()


# ---------------------------------------------------------------- main

def ff_escape(path):
    return path.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def render(clip, plan, transcript, args, base):
    src = plan["source"] if os.path.isabs(plan["source"]) else os.path.join(base, plan["source"])
    style = {**plan.get("style", {}), **clip.get("style", {})}
    cid = str(clip["id"])
    start, end = float(clip["start"]), float(clip["end"])
    dur = end - start
    if args.preview:
        dur = min(dur, args.preview)

    sub_path = os.path.join(args.out, f"{cid}.subs.json")
    lines = subs.load_or_build(sub_path, transcript, clip, style, rebuild=args.rebuild_subs)
    subs.write_srt(os.path.join(args.out, f"{cid}.srt"), lines)
    ass_path = os.path.join(args.out, f"{cid}.ass")
    subs.write_ass(ass_path, lines, clip, style, OUT_W, OUT_H, duration=dur)
    if args.subs_only:
        print(f"[{cid}] subtitles -> {sub_path}", file=sys.stderr)
        return None

    sw, sh, src_fps, has_audio = probe(src)
    fps = min(args.fps, src_fps) if src_fps > 0 else args.fps
    work_w = min(sw, WORK_MAX_W)
    work_w -= work_w % 2
    work_h = int(round(sh * work_w / sw / 2) * 2)

    print(f"[{cid}] analysing faces {start:.1f}-{start + dur:.1f}s ...", file=sys.stderr)
    info = reframe.analyze(src, start, dur, work_w, work_h)
    framer = Framer(clip, info, work_w, work_h)
    print(f"[{cid}] layout={framer.layout} people={len(info['people'])}", file=sys.stderr)
    zooms = zoom_events(clip, lines, dur)
    broll = BRoll(clip.get("broll"), start, base, fps)

    out_mp4 = os.path.join(args.out, f"{cid}.mp4")
    vf = f"ass='{ff_escape(os.path.abspath(ass_path))}'"
    if args.fontsdir:
        vf += f":fontsdir='{ff_escape(os.path.abspath(args.fontsdir))}'"
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
           "-s", f"{OUT_W}x{OUT_H}", "-r", f"{fps:.3f}", "-i", "-"]
    if has_audio:
        cmd += ["-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", src, "-map", "0:v", "-map", "1:a:0",
                "-af", f"afade=t=in:d=0.05,afade=t=out:st={max(dur - 0.08, 0):.3f}:d=0.08",
                "-c:a", "aac", "-b:a", "160k"]
    cmd += ["-vf", vf, "-c:v", "libx264", "-preset", args.preset, "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-shortest", out_mp4]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    n = 0
    for img in reframe.read_frames(src, start, dur, fps, work_w):
        t = n / fps
        out = broll.frame(t)
        if out is None:
            out = framer.frame(img, t, zoom_at(t, zooms))
        enc.stdin.write(np.ascontiguousarray(out).tobytes())
        n += 1
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit(f"ffmpeg failed for clip {cid}")
    print(f"[{cid}] {n} frames -> {out_mp4}", file=sys.stderr)
    return {"id": cid, "file": out_mp4, "layout": framer.layout, "dur": round(dur, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--transcript", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", default="", help="comma-separated clip ids")
    ap.add_argument("--subs-only", action="store_true", help="only (re)write subtitle files")
    ap.add_argument("--rebuild-subs", action="store_true", help="discard edited <id>.subs.json")
    ap.add_argument("--preview", type=float, default=0, help="render only the first N seconds")
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--preset", default="medium", help="x264 preset (ultrafast..slow)")
    ap.add_argument("--fontsdir", default="", help="folder with .ttf/.otf fonts (e.g. Kanit)")
    args = ap.parse_args()

    with open(args.plan, encoding="utf-8") as f:
        plan = json.load(f)
    with open(args.transcript, encoding="utf-8") as f:
        transcript = json.load(f)
    plan.setdefault("source", transcript.get("source"))
    base = os.path.dirname(os.path.abspath(args.plan))
    os.makedirs(args.out, exist_ok=True)
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    results = []
    for clip in plan["clips"]:
        if only and str(clip["id"]) not in only:
            continue
        r = render(clip, plan, transcript, args, base)
        if r:
            r.update(title=clip.get("title", ""), hook=(clip.get("hook") or {}).get("text", "")
                     if isinstance(clip.get("hook"), dict) else clip.get("hook", ""))
            results.append(r)
    if results:
        with open(os.path.join(args.out, "clips.md"), "w", encoding="utf-8") as f:
            f.write("| id | title | hook | layout | sec | file |\n|---|---|---|---|---|---|\n")
            for r in results:
                f.write(f"| {r['id']} | {r['title']} | {r['hook']} | {r['layout']} | {r['dur']} | "
                        f"{os.path.basename(r['file'])} |\n")


if __name__ == "__main__":
    main()
