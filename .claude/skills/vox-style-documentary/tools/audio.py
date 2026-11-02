"""Documentary-mystery underscore + SFX built from the episode's sound cues, ducked under the VO (no copyrighted music).
usage: audio.py WORK [music_rel=-15] [sfx_rel=-15]
reads  WORK/out/cues.json   (node render.js WORK/engine cues WORK/out/cues.json; finish.sh does this)
       WORK/vo-tight.wav    (optional; without it you get music + SFX only)
writes WORK/out/mix-music.wav and WORK/out/mix-nomusic.wav (VO + SFX); finish.sh normalises both to -14 LUFS.

cues.json = { end, events: [[t, type]...], transitions: [[t, sound, dur]...], music: [[t0, t1, preset]...], sfx: [[t, type, args...]...] }
music presets (D minor, 88 BPM): intro mystery tension noir drive reveal sad hush outro
sfx types: soft  thud  marker  hit [g]  boom [g]  whoosh  whoosh_soft  whoosh_big  whoosh_deep  whoosh_zoom  whoosh_long
           paper  shutter  type n  tick dur n  heartbeat n  riser [dur]  sting
(text appearing -> 'soft', stamp() -> 'thud', marker*() -> 'marker'; each transition gets its own whoosh)"""
import sys, os, json, re, subprocess, tempfile, numpy as np
from scipy.signal import butter, lfilter, fftconvolve
SR = 44100; work = sys.argv[1]; out = os.path.join(work, 'out')
C = json.load(open(os.path.join(out, 'cues.json'))); END = float(C['end']); N = int(END * SR)
rng = np.random.default_rng(11)
def lpf(x, f, o=2): b, a = butter(o, min(f, SR / 2 - 100) / (SR / 2)); return lfilter(b, a, x)
def hpf(x, f, o=2): b, a = butter(o, f / (SR / 2), 'high'); return lfilter(b, a, x)
def bpf(x, lo, hi): b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band'); return lfilter(b, a, x)
def env(n, a, r):
    e = np.ones(n); a = max(1, min(n, int(a * SR))); r = max(1, min(n, int(r * SR)))
    e[:a] = np.linspace(0, 1, a); e[-r:] *= np.linspace(1, 0, r); return e
def ir(d=3.2, damp=2800):
    n = int(d * SR); x = rng.normal(0, 1, (2, n)) * np.exp(-np.arange(n) / SR * 2.2)
    return np.stack([lpf(x[0], damp), lpf(x[1], damp)]) * .06
IR = ir()
def verb(x, wet=.35):
    y = np.stack([fftconvolve(x[0], IR[0])[:x.shape[1]], fftconvolve(x[1], IR[1])[:x.shape[1]]])
    return x * (1 - wet) + y * wet * 3
def note(m): return 440 * 2 ** ((m - 69) / 12)
def place(buf, x, t0, g=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= buf.shape[1] or i + len(x) <= 0: return
    j0 = max(0, -i); i = max(0, i); j = min(buf.shape[1], i + len(x) - j0)
    l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    buf[0, i:j] += x[j0:j0 + j - i] * g * l * 1.41; buf[1, i:j] += x[j0:j0 + j - i] * g * r * 1.41

# ---------------- music ----------------
BPM = 88; beat = 60 / BPM; bar = beat * 4
mus = np.zeros((2, N))
def pad(ms, t0, dur, g=.1, bright=1200):  # string-ish pad: detuned saws, slow swell
    n = int((dur + 1.5) * SR); tt = np.arange(n) / SR; y = np.zeros(n)
    for m in ms:
        for det in (-.1, 0, .1):
            ff = note(m) * 2 ** (det / 12 / 3)
            for k in range(1, 9): y += np.sin(2 * np.pi * ff * k * tt + k * det * 5) / k
    y = lpf(y, bright) * env(n, min(1.5, dur * .5), 1.6) / (len(ms) * 3)
    y *= 1 + .12 * np.sin(2 * np.pi * .18 * tt)
    place(mus, y, t0, g, -.25); place(mus, np.roll(y, 420), t0, g, .25)
def drone(m, t0, dur, g=.12):
    n = int((dur + 1) * SR); tt = np.arange(n) / SR; f = note(m)
    y = sum(np.sin(2 * np.pi * f * k * tt * (1 + .0015 * k)) / k ** 1.5 for k in range(1, 7))
    y = lpf(y, 400 + 250 * (1 + np.sin(2 * np.pi * .07 * tt)).mean()) * env(n, 1.5, 1.2) * (1 + .2 * np.sin(2 * np.pi * .11 * tt))
    place(mus, y, t0, g)
def piano(m, t0, g=.09, pan=0.0):
    n = int(3.5 * SR); tt = np.arange(n) / SR; f = note(m)
    y = sum(a * np.sin(2 * np.pi * f * h * (1 + .0004 * h * h) * tt) * np.exp(-tt * (1.1 + h * .9)) for h, a in ((1, 1), (2, .45), (3, .22), (4, .12), (5, .06)))
    y[:80] *= np.linspace(0, 1, 80); y += hpf(rng.normal(0, 1, n), 2000) * np.exp(-tt * 80) * .05  # hammer
    place(mus, y, t0, g, pan)
def pulse(m, t0, dur, g=.1, div=2):  # muted 8th-note bass ostinato
    k = 0; t = t0
    while t < t0 + dur - .02:
        n = int(beat / div * SR * .9); tt = np.arange(n) / SR; f = note(m)
        y = (np.sin(2 * np.pi * f * tt) + .5 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 9)
        y = lpf(y, 700); place(mus, y, t, g * (1 if k % 4 == 0 else .7)); t += beat / div; k += 1
def tick(g=.05): n = int(.02 * SR); return hpf(rng.normal(0, 1, n), 4000) * np.exp(-np.arange(n) / SR * 400) * g
def kick(t0, g=.2):
    n = int(.5 * SR); tt = np.arange(n) / SR; y = np.sin(2 * np.pi * (42 + 70 * np.exp(-tt * 28)) * tt) * np.exp(-tt * 8); place(mus, y, t0, g)
def brush(t0, g=.02): n = int(.18 * SR); y = bpf(rng.normal(0, 1, n), 3000, 9000) * env(n, .03, .12); place(mus, y, t0, g, .3)
def bell(m, t0, g=.05, pan=0.):
    n = int(3 * SR); tt = np.arange(n) / SR; f = note(m)
    y = sum(np.sin(2 * np.pi * f * h * tt) * np.exp(-tt * (1.5 + h)) * a for h, a in ((1, .6), (2.0, .25), (3.0, .1), (4.2, .05)))
    place(mus, y, t0, g, pan)
Dm = [50, 57, 62, 65, 69]; Bb = [46, 53, 58, 62, 65]; Gm = [43, 50, 55, 58, 62]; A7 = [45, 52, 57, 61, 64]
Dm9 = [50, 57, 60, 64, 65]; Gm9 = [43, 50, 53, 57, 58]; F = [41, 48, 53, 57, 60]; C_ = [48, 55, 60, 64, 67]; Am = [45, 52, 57, 60, 64]
MOTIF = [74, 72, 69, 70, 69, 65, 67, 62]  # sparse mystery piano line (D minor)
def section(t0, t1, pr):
    t = t0; k = 0
    while t < t1 - .05:
        d = min(bar, t1 - t)
        if pr in ('mystery', 'intro'):
            pad([Dm, Bb, Gm, A7][k % 4], t, d, .08, 900)
            if pr == 'mystery' or k > 0:
                for s in range(0, 4, 2):
                    if t + s * beat < t1: piano(MOTIF[(k * 2 + s // 2) % len(MOTIF)], t + s * beat, .07, (-.3, .3)[s // 2])
        elif pr == 'tension':
            pad([Dm, Dm, Bb, A7][k % 4], t, d, .07, 700); pulse(38 if k % 4 < 2 else 34, t, d, .11)
            for b in range(4):
                if t + b * beat < t1: place(mus, tick(), t + b * beat, 1, .4); place(mus, tick(.03), t + b * beat + beat / 2, 1, -.4)
        elif pr == 'noir':
            pad([Dm9, Gm9][k % 2], t, d, .08, 1600)
            for b in range(4):
                tb = t + b * beat
                if tb < t1: brush(tb + beat * .66, .025); bassn = [38, 41, 43, 45][b] if k % 2 == 0 else [43, 46, 48, 45][b]; pulse(bassn, tb, beat * .9, .09, 1)
        elif pr == 'drive':
            pad([Dm, Bb, F, C_][k % 4], t, d, .08, 1400); pulse([38, 34, 41, 36][k % 4], t, d, .12)
            for b in range(4):
                if t + b * beat < t1: kick(t + b * beat, .16 if b % 2 == 0 else .08)
        elif pr == 'reveal':
            pad([Bb, F, C_, Dm][k % 4], t, d, .1, 2200); bell([77, 76, 72, 74][k % 4], t, .045)
        elif pr == 'sad':
            pad([Dm, Bb, F, A7][k % 4], t, d, .07, 800); piano([Dm, Bb, F, A7][k % 4][2] + 12, t, .06); piano([Dm, Bb, F, A7][k % 4][3] + 12, t + beat * 2, .05)
        elif pr == 'outro':
            pad([Bb, Gm, A7, Dm][k % 4], t, d, .09, 1100)
            if k == 0: [piano(m, t + i * beat * .75, .06, (-.2, .2)[i % 2]) for i, m in enumerate((62, 65, 69, 74))]
        t += bar; k += 1
    if pr in ('mystery', 'tension', 'intro', 'hush', 'sad'): drone(26, t0, t1 - t0, .1 if pr != 'hush' else .06)
for t0, t1, pr in C.get('music', []):
    if pr == 'hush': drone(26, t0, max(.4, t1 - t0), .05); continue
    section(t0, t1, pr)

# ---------------- SFX ----------------
sfx = np.zeros((2, N))
def whoosh(d=.6, lo=300, hi=3000, g=.4, rev=False):
    n = int(d * SR); x = rng.normal(0, 1, n); e = np.sin(np.linspace(0, np.pi, n)) ** 2
    if rev: e = np.linspace(0, 1, n) ** 3
    return (bpf(x, lo, hi) * e) / 3 * g
def soft(): return whoosh(.45, 900, 6000, .22)                      # text breathing in
def boom(g=.6):
    n = int(2.5 * SR); tt = np.arange(n) / SR; y = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-tt * 1.2) + 28) / SR) * np.exp(-tt * 1.6)
    return (y + lpf(rng.normal(0, 1, n), 300) * np.exp(-tt * 5) * .5) * g
def hit(g=.5):
    y = boom(g * .8); w = whoosh(.25, 200, 3000, .5); y[:len(w)] += w; return y
def thud(g=.5):
    n = int(.4 * SR); tt = np.arange(n) / SR; y = np.sin(2 * np.pi * 90 * np.exp(-tt * 6) * tt) * np.exp(-tt * 18)
    return (y + bpf(rng.normal(0, 1, n), 800, 4000) * np.exp(-tt * 60) * .5) * g
def scribble(d=.7, g=.18):
    n = int(d * SR); tt = np.arange(n) / SR; x = bpf(rng.normal(0, 1, n), 2500, 7000)
    am = .5 + .5 * np.sin(2 * np.pi * (9 + 3 * np.sin(2 * np.pi * 1.3 * tt)) * tt); return x * am * env(n, .03, .15) * g
def paper(g=.25): n = int(.6 * SR); x = bpf(rng.normal(0, 1, n), 1500, 8000); am = np.abs(lpf(rng.normal(0, 1, n), 30)); return x * am * env(n, .02, .2) * g * 3
def shutter(g=.4): a = tick(1) * g; b = np.zeros(int(.09 * SR)); return np.concatenate([a, b, bpf(rng.normal(0, 1, int(.03 * SR)), 1000, 6000) * .4 * g])
def heartbeat(g=.4):
    one = lambda: np.sin(2 * np.pi * 50 * np.arange(int(.18 * SR)) / SR) * np.exp(-np.arange(int(.18 * SR)) / SR * 22)
    y = np.zeros(int(.6 * SR)); a = one(); y[:len(a)] += a; y[int(.22 * SR):int(.22 * SR) + len(a)] += a * .7; return y * g
def S(x, t0, g=1, pan=0): place(sfx, x, t0, g, pan)
def arg(a, i, default): return a[i] if len(a) > i else default
WH = {'whoosh': lambda d: whoosh(.6), 'whoosh_soft': lambda d: whoosh(max(.5, d), 300, 2500, .3), 'whoosh_big': lambda d: whoosh(.7, 600, 5000, .9),
      'whoosh_deep': lambda d: whoosh(max(.8, d), 120, 1800, .7), 'whoosh_zoom': lambda d: whoosh(max(.7, d * .8), 200, 4000, .7, True),
      'whoosh_long': lambda d: whoosh(1.8, 150, 2500, .6), 'hit': lambda d: hit(.5)}
for t, typ in C.get('events', []):
    if typ == 'soft': S(soft(), t - .05, .8, ((t * 7) % 2) - 1)
    elif typ == 'thud': S(thud(), t)
    elif typ == 'marker': S(scribble(), t)
for t, snd, d in C.get('transitions', []): S(WH.get(snd, WH['whoosh'])(d), t, .7)
for e in C.get('sfx', []):
    t, typ, a = e[0], e[1], e[2:]
    if typ in WH: S(WH[typ](arg(a, 0, .8)), t, .7)
    elif typ == 'soft': S(soft(), t)
    elif typ == 'thud': S(thud(), t)
    elif typ == 'marker': S(scribble(arg(a, 0, .7)), t)
    elif typ == 'boom': S(boom(arg(a, 0, .6)), t)
    elif typ == 'paper': S(paper(), t)
    elif typ == 'shutter': S(shutter(), t)
    elif typ == 'type':
        for i in range(int(arg(a, 0, 10))): S(tick(.35) + 0, t + i * .09 + (i % 3) * .02, 1, (i % 5) / 2.5 - 1)
    elif typ == 'tick':
        d, n = arg(a, 0, 2.0), int(arg(a, 1, 4))
        for i in range(n): S(tick(.3), t + i * d / max(1, n - 1))
    elif typ == 'heartbeat':
        for i in range(int(arg(a, 0, 3))): S(heartbeat(), t + i * .85)
    elif typ == 'riser':
        d = arg(a, 0, 1.5); n = int(d * SR); x = bpf(rng.normal(0, 1, n), 600, 6000) * np.linspace(0, 1, n) ** 2; place(mus, x, t - d, .06)
    elif typ == 'sting': piano(50, t, .12); piano(51, t, .1); piano(62, t, .08)
    else: print('unknown sfx', typ)
mus = verb(mus, .45)
fade0 = max(0, END - 1.8); i0 = int(fade0 * SR); mfade = np.ones(N); mfade[i0:] = np.linspace(1, 0, N - i0) ** 1.5; mus *= mfade
sfx = verb(sfx, .22)

# ---------------- VO + ducking ----------------
vp = os.path.join(work, 'vo-tight.wav'); v = np.zeros(N)
if os.path.exists(vp):
    vo = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', vp, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).astype(float)
    v[:min(N, len(vo))] = vo[:N]
has_vo = np.abs(v).max() > 1e-4
rms = np.sqrt(np.maximum(lpf(v ** 2, 4), 0))
duck = 1 - .6 * np.clip(rms / (rms.max() * .25 + 1e-9), 0, 1) if has_vo else np.ones(N); duck = lpf(duck, 3)
V = np.stack([v, v])
def wr(x, path): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', path], input=x.T.astype(np.float32).tobytes(), check=True)
def lufs(x):
    if np.abs(x).max() < 1e-6: return -70.0
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'l.wav'); wr(x, p); o = subprocess.run(['ffmpeg', '-i', p, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1])
MUS_REL = float(sys.argv[2]) if len(sys.argv) > 2 else -15; SFX_REL = float(sys.argv[3]) if len(sys.argv) > 3 else -15
Lm, Ls = lufs(mus), lufs(sfx); Lv = lufs(V) if has_vo else Lm - MUS_REL
gm = 10 ** ((Lv + MUS_REL - Lm) / 20) if Lm > -69 else 0; gs = 10 ** ((Lv + SFX_REL - Ls) / 20) if Ls > -69 else 0
print('LUFS vo/mus/sfx', round(Lv, 1), round(Lm, 1), round(Ls, 1), 'gains', round(gm, 3), round(gs, 3), '' if has_vo else '(no VO found)')
wr(V + mus * duck * gm + sfx * gs, os.path.join(out, 'mix-music.wav'))
wr(V + sfx * gs, os.path.join(out, 'mix-nomusic.wav'))
print('ok ->', os.path.join(out, 'mix-music.wav'), os.path.join(out, 'mix-nomusic.wav'))
