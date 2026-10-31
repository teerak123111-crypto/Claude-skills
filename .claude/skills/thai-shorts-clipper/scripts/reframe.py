"""Face tracking + active-speaker guess for 9:16 reframing.

Samples the clip at ANALYSIS_FPS, finds faces (OpenCV YuNet, or Haar frontal + profile as fallback), groups them into
people by horizontal position, and scores who is talking from mouth-area motion. Produces a
per-sample plan the renderer can look up: which person to frame and where they are.
"""
import subprocess

import cv2
import numpy as np

ANALYSIS_FPS = 5
ANALYSIS_W = 640


def read_frames(src, start, dur, fps, width):
    """Yield BGR frames from ffmpeg at a fixed fps/width (accurate seeking, any codec)."""
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height", "-of", "csv=p=0:s=x", src],
        capture_output=True, text=True, check=True).stdout.strip().split("\n")[0]
    sw, sh = map(int, probe.split("x")[:2])
    h = int(round(sh * width / sw / 2) * 2)
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", src,
           "-vf", f"fps={fps},scale={width}:{h}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    size = width * h * 3
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, width, 3)
    p.wait()


YUNET_URL = ("https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/"
             "face_detection_yunet/face_detection_yunet_2023mar.onnx")
YUNET_SHA256 = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"


def _yunet_path():
    """Cached YuNet model (230 KB). Downloaded once; verified by SHA-256."""
    import hashlib
    import os
    import urllib.request
    path = os.path.join(os.path.expanduser("~/.cache/thai-shorts-clipper"), "yunet_2023mar.onnx")
    if not os.path.exists(path):
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            urllib.request.urlretrieve(YUNET_URL, path + ".part")
            os.replace(path + ".part", path)
        except Exception as e:  # offline etc. -> Haar fallback
            print(f"  YuNet download failed ({e}); using Haar cascades", flush=True)
            return None
    with open(path, "rb") as f:
        if hashlib.sha256(f.read()).hexdigest() != YUNET_SHA256:
            print("  YuNet model checksum mismatch; using Haar cascades", flush=True)
            return None
    return path


def make_detector():
    """Return detect(frame_bgr) -> [(x, y, w, h)]. YuNet (better on side faces) or Haar."""
    model = _yunet_path() if hasattr(cv2, "FaceDetectorYN") else None
    if model:
        yn = cv2.FaceDetectorYN.create(model, "", (320, 320), 0.7)

        def detect_yunet(frame):
            h, w = frame.shape[:2]
            yn.setInputSize((w, h))
            _, faces = yn.detect(frame)
            min_s = h / 22
            return [tuple(int(v) for v in f[:4]) for f in (faces if faces is not None else [])
                    if f[3] >= min_s]
        return detect_yunet
    if not hasattr(cv2, "CascadeClassifier"):
        return None
    base = cv2.data.haarcascades
    frontal = cv2.CascadeClassifier(base + "haarcascade_frontalface_default.xml")
    profile = cv2.CascadeClassifier(base + "haarcascade_profileface.xml")

    def detect_haar(frame):
        gray = cv2.equalizeHist(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
        return detect(gray, frontal, profile)
    return detect_haar


def detect(gray, frontal, profile):
    h = gray.shape[0]
    min_s = max(24, h // 14)
    faces = list(frontal.detectMultiScale(gray, 1.15, 6, minSize=(min_s, min_s)))
    if not faces:
        faces = list(profile.detectMultiScale(gray, 1.15, 6, minSize=(min_s, min_s)))
        flipped = cv2.flip(gray, 1)
        w = gray.shape[1]
        for (x, y, fw, fh) in profile.detectMultiScale(flipped, 1.15, 6, minSize=(min_s, min_s)):
            faces.append((w - x - fw, y, fw, fh))
    return faces


def analyze(src, start, dur, src_w, src_h):
    """Return dict with people tracks and the speaker to frame at each analysis sample."""
    detector = make_detector()
    if detector is None:
        print("  no face detector available (install opencv-python-headless<5): "
              "using centre/fit framing", flush=True)
        return {"n": 0, "people": [], "speaker": [], "cx": [], "cy": []}
    scale = src_w / ANALYSIS_W
    samples, prev = [], None
    for frame in read_frames(src, start, dur, ANALYSIS_FPS, ANALYSIS_W):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        dets = []
        for (x, y, w, h) in detector(frame):
            motion = 0.0
            if prev is not None:
                my0, my1 = y + int(h * 0.62), min(y + h + int(h * 0.15), gray.shape[0])
                mx0, mx1 = x + int(w * 0.2), x + int(w * 0.8)
                a, b = gray[my0:my1, mx0:mx1], prev[my0:my1, mx0:mx1]
                if a.size:
                    motion = float(cv2.absdiff(a, b).mean())
            dets.append({"cx": (x + w / 2) * scale, "cy": (y + h / 2) * scale,
                         "size": h * scale, "motion": motion})
        samples.append(dets)
        prev = gray
    n = len(samples)
    if n == 0:
        return {"n": 0, "people": [], "speaker": [], "cx": [], "cy": []}

    # cluster detections into people by x position (1-D gap clustering)
    xs = sorted(d["cx"] for s in samples for d in s)
    centers = []
    gap = src_w * 0.12
    for x in xs:
        if centers and x - centers[-1][-1] < gap:
            centers[-1].append(x)
        else:
            centers.append([x])
    people = [float(np.median(c)) for c in centers if len(c) >= max(3, n * 0.15)]

    k = len(people)
    if k == 0:
        return {"n": n, "people": [], "speaker": [None] * n,
                "cx": [src_w / 2] * n, "cy": [src_h / 2] * n}

    pos = np.full((n, k), np.nan)
    posy = np.full((n, k), np.nan)
    mot = np.zeros((n, k))
    for i, s in enumerate(samples):
        for d in s:
            j = int(np.argmin([abs(d["cx"] - p) for p in people]))
            if abs(d["cx"] - people[j]) > src_w * 0.2:
                continue
            pos[i, j], posy[i, j] = d["cx"], d["cy"] - d["size"] * 0.15
            mot[i, j] = max(mot[i, j], d["motion"] / max(d["size"] / scale, 1) * 100)

    # fill gaps in each person's track; smooth it so the camera does not jitter
    for j in range(k):
        for arr, default in ((pos, people[j]), (posy, src_h * 0.42)):
            col = arr[:, j]
            ok = ~np.isnan(col)
            col[:] = np.interp(np.arange(n), np.flatnonzero(ok), col[ok]) if ok.any() else default
            alpha = 0.25
            for i in range(1, n):
                col[i] = col[i - 1] + alpha * (col[i] - col[i - 1])

    # speaker choice: smoothed mouth motion with hysteresis (hold >= 1.2 s before switching)
    win = max(1, ANALYSIS_FPS)
    kernel = np.ones(win) / win
    sm = np.stack([np.convolve(mot[:, j], kernel, mode="same") for j in range(k)], axis=1)
    hold = int(1.2 * ANALYSIS_FPS)
    speaker, cur, cand, cand_run = [], int(np.argmax(sm[: hold * 2].sum(axis=0))), None, 0
    for i in range(n):
        best = int(np.argmax(sm[i]))
        if best != cur and sm[i, best] > sm[i, cur] * 1.3:
            cand_run = cand_run + 1 if cand == best else 1
            cand = best
            if cand_run >= hold:
                cur, cand, cand_run = best, None, 0
                # cut to the new speaker from when they started talking, not 1.2 s late
                speaker[len(speaker) - hold + 1:] = [cur] * (hold - 1)
        else:
            cand, cand_run = None, 0
        speaker.append(cur)

    return {"n": n, "people": people, "speaker": speaker,
            "cx": [float(pos[i, speaker[i]]) for i in range(n)],
            "cy": [float(posy[i, speaker[i]]) for i in range(n)],
            "pos": pos.tolist(), "posy": posy.tolist()}
