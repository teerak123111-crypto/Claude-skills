"""Calm-narration tighten: keep the breathing, only cap long pauses, add a short lead-in, speed up a little.
usage: tighten.py vo.mp3 vo-tight.wav [maxgap=0.30] [speed=1.06] [lead=0.50]
writes vo-tight.wav + vo-tight-chunks.json (speech chunks on the new timeline, for align.py)
       + vo-tight-map.json ([original start, new start] per chunk)"""
import subprocess, sys, re, json, numpy as np
src, out = sys.argv[1:3]
MAXGAP = float(sys.argv[3]) if len(sys.argv) > 3 else .30
SPEED = float(sys.argv[4]) if len(sys.argv) > 4 else 1.06
LEAD = float(sys.argv[5]) if len(sys.argv) > 5 else .50
SR = 44100; PAD = .04
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout, np.float32)
log = subprocess.run(["ffmpeg", "-i", src, "-af", "silencedetect=n=-40dB:d=0.15", "-f", "null", "-"], capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]; en = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
dur = len(x) / SR; sp = []; t = 0.0
for a, b in zip(st, en):
    if a > t: sp.append((max(0, t - PAD), min(dur, a + PAD)))
    t = b
if t < dur - .05: sp.append((max(0, t - PAD), dur))
parts = [np.zeros(int(LEAD * SR), np.float32)]; f = int(.006 * SR); m = []; ch = []; tt = LEAD
for k, (a, b) in enumerate(sp):
    s = x[int(a * SR):int(b * SR)].copy(); s[:f] *= np.linspace(0, 1, f); s[-f:] *= np.linspace(1, 0, f); parts.append(s)
    gap0 = (sp[k + 1][0] - b) if k + 1 < len(sp) else 0
    m.append([round(a, 3), round(tt / SPEED, 3)]); ch.append(dict(s=round(tt / SPEED, 3), e=round((tt + b - a) / SPEED, 3), gap=round(gap0, 3))); tt += b - a
    if k + 1 < len(sp):
        g = min(MAXGAP, gap0); parts.append(np.zeros(int(g * SR), np.float32)); tt += g
parts.append(np.zeros(int(.3 * SR), np.float32))
y = np.concatenate(parts)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", f"atempo={SPEED}", out], input=y.tobytes(), check=True)
base = out.rsplit(".", 1)[0]
json.dump(m, open(base + "-map.json", "w")); json.dump(ch, open(base + "-chunks.json", "w"), indent=0)
print(len(sp), "chunks", round(dur, 2), "s ->", round(len(y) / SR / SPEED, 2), "s")
