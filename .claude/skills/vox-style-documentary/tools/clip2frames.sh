#!/bin/bash
# clip2frames.sh IN.mp4 ENGINE/assets/NAME [fps=24] [height]  ->  frame sequence f0001.jpg... for CLIPS = { NAME: { dir, n, fps } }
# use for AI video clips (image-to-video) placed as moving plates; prints the CLIPS line to paste into episode.js
set -e; IN="$1"; OUT="$2"; FPS=${3:-24}; HT=${4:-1920}; mkdir -p "$OUT"
ffmpeg -v error -y -i "$IN" -vf "fps=$FPS,scale=-2:'min($HT,ih)'" -q:v 3 "$OUT/f%04d.jpg"
N=$(ls "$OUT"/f*.jpg | wc -l | tr -d ' '); echo "$(basename "$OUT"): { dir: 'assets/$(basename "$OUT")', n: $N, fps: $FPS },"
