"""Talking-head mode: prepare a face-to-camera video (the person narrates on camera) for the engine.
usage: speaker.py talk.mp4 WORK [fps=30]
writes  WORK/vo-tight.wav            the video's audio, timeline kept as is (the picture must stay in sync: no pause cutting)
        WORK/vo-tight-chunks.json    speech chunks for align.py (same format tighten.py writes)
        WORK/engine/assets/speaker/  the video as frames f0001.jpg ... at fps
        WORK/engine/speaker.js       SPEAKER = { clip, n, fps, dur, face: [cx, cy, size] }  (cx, cy in 0..1, size = face px / frame width;
                                     from Apple Vision, else a guess)
        WORK/images/speaker_ref.jpg  the clearest frontal frame: reference image for characters that have the speaker's face
then: python3 align.py script.txt vo-tight-chunks.json words.json, and END >= SPEAKER.dur in episode.js"""
import sys, os, re, json, glob, shutil, subprocess, platform, statistics
src, work = sys.argv[1], os.path.abspath(sys.argv[2]); FPS = int(sys.argv[3]) if len(sys.argv) > 3 else 30
T = os.path.dirname(os.path.abspath(__file__)); eng = os.path.join(work, 'engine'); fr = os.path.join(eng, 'assets', 'speaker')
os.makedirs(fr, exist_ok=True); os.makedirs(os.path.join(work, 'images'), exist_ok=True)
for f in glob.glob(os.path.join(fr, 'f*.jpg')): os.remove(f)
run = lambda *a: subprocess.run(a, capture_output=True, text=True)
dur = float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src).stdout.strip())
# audio: keep the timeline (video and voice must match frame for frame)
vo = os.path.join(work, 'vo-tight.wav'); run('ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-ac', '1', '-ar', '44100', vo)
log = run('ffmpeg', '-i', vo, '-af', 'silencedetect=n=-40dB:d=0.15', '-f', 'null', '-').stderr
st = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', log)]; en = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', log)]
ch, t = [], 0.0
for a, b in zip(st, en):
    if a > t + .05: ch.append([t, a])
    t = b
if t < dur - .05: ch.append([t, dur])
chunks = [dict(s=round(a, 3), e=round(b, 3), gap=round((ch[i + 1][0] - b) if i + 1 < len(ch) else 0, 3)) for i, (a, b) in enumerate(ch)]
json.dump(chunks, open(os.path.join(work, 'vo-tight-chunks.json'), 'w'), indent=0)
# frames: portrait sources keep up to 1920 px height, landscape up to 1920 px width
run('ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f"fps={FPS},scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'", '-q:v', '3', os.path.join(fr, 'f%04d.jpg'))
frames = sorted(glob.glob(os.path.join(fr, 'f*.jpg'))); n = len(frames)
# face position: Vision on ~16 frames spread over the clip
face, best = [.5, .38, .28], frames[min(n - 1, int(n * .3))]
if platform.system() == 'Darwin' and shutil.which('swift') and n:
    sample = [frames[int(i * (n - 1) / 15)] for i in range(16)]
    out = run('swift', os.path.join(T, 'face.swift'), *sample).stdout.splitlines()
    hits = []
    for line in out:
        try: d = json.loads(line)
        except ValueError: continue
        if d['faces']: f = max(d['faces'], key=lambda x: x[2] * x[3]); hits.append((d['f'], f))
    if hits:
        from PIL import Image; iw, ih = Image.open(frames[0]).size  # face size = larger side in px, as a fraction of the frame width
        face = [round(statistics.median(h[1][i] for h in hits), 4) for i in (0, 1)] + [round(statistics.median(max(h[1][2] * iw, h[1][3] * ih) / iw for h in hits), 4)]
        # reference frame: big, confident, close to the median position (= looking at the camera, not mid-gesture)
        best = max(hits, key=lambda h: h[1][4] * h[1][2] * h[1][3] - abs(h[1][0] - face[0]) - abs(h[1][1] - face[1]))[0]
    else: print('no face found by Vision: using a centred guess, set SPEAKER.face by hand if the crop is off')
shutil.copy(best, os.path.join(work, 'images', 'speaker_ref.jpg'))
spk = dict(clip='speaker', dir='assets/speaker', n=n, fps=FPS, dur=round(dur, 3), face=face)
open(os.path.join(eng, 'speaker.js'), 'w').write('// written by tools/speaker.py: the talking-head video as frames + where the face is (cx, cy, size in 0..1)\nvar SPEAKER = ' + json.dumps(spk) + ';\n')
print(f'speaker: {n} frames @ {FPS} fps, {dur:.2f} s, face {face}, {len(chunks)} speech chunks, ref -> images/speaker_ref.jpg')
