#!/bin/bash
# render_all.sh WORK [workers=4] [fps=30]  ->  WORK/out/video.mp4 (silent, END seconds)
set -e; W="$(cd "$1" && pwd)"; NW=${2:-4}; FPS=${3:-30}; D="$(cd "$(dirname "$0")" && pwd)"; O="$W/out"; mkdir -p "$O"
END=$(node "$D/render.js" "$W/engine" end | tail -1); N=$(python3 -c "print(int(round($END * $FPS)))"); Q=$(( (N + NW - 1) / NW ))
echo "END=$END s, $N frames, $NW workers"
for ((i = 0; i < NW; i++)); do a=$((i * Q)); b=$(((i + 1) * Q)); [ $b -gt $N ] && b=$N
  node "$D/render.js" "$W/engine" video "$O/part$i.mp4" $a $b $FPS > "$O/part$i.log" 2>&1 & done
wait; grep -h "ERR\|done" "$O"/part*.log | head -8 || true
: > "$O/parts.txt"; for ((i = 0; i < NW; i++)); do echo "file 'part$i.mp4'" >> "$O/parts.txt"; done
ffmpeg -v error -y -f concat -safe 0 -i "$O/parts.txt" -c copy "$O/video.mp4" && rm -f "$O"/part*.mp4 "$O"/part*.log "$O/parts.txt"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$O/video.mp4"
