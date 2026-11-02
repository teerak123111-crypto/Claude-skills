#!/bin/bash
# finish.sh WORK "NAME"  ->  WORK/final/NAME (มีเพลง).mp4, NAME (ไม่มีเพลง).mp4, ปก.jpg
# needs WORK/out/video.mp4 (render_all.sh) and WORK/vo-tight.wav; both versions -14 LUFS / -1.5 dBTP, H.264 crf 22 capped at 12 Mbit/s (CRF=.. MAXRATE=.. to change; film grain makes files big)
set -e; W="$(cd "$1" && pwd)"; NAME="${2:-clip}"; D="$(cd "$(dirname "$0")" && pwd)"; O="$W/out"; F="$W/final"; mkdir -p "$O" "$F"
node "$D/render.js" "$W/engine" cues "$O/cues.json"
python3 "$D/audio.py" "$W" ${MUS_REL:--15} ${SFX_REL:--15}
node "$D/render.js" "$W/engine" cover "$O/cover.jpg"
for m in music nomusic; do
  if [ $m = music ]; then OUT="$F/$NAME (มีเพลง).mp4"; else OUT="$F/$NAME (ไม่มีเพลง).mp4"; fi
  J=$(ffmpeg -hide_banner -i "$O/mix-$m.wav" -af loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  g() { echo "$J" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
  ffmpeg -v error -y -i "$O/video.mp4" -i "$O/mix-$m.wav" -map 0:v -map 1:a -c:v libx264 -preset slow -crf ${CRF:-22} -maxrate ${MAXRATE:-12M} -bufsize 24M -pix_fmt yuv420p \
    -af "loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" \
    -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
done
cp "$O/cover.jpg" "$F/ปก.jpg"
for f in "$F/"*.mp4; do echo "$(basename "$f"): $(ffmpeg -i "$f" -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tr -s ' ') size $(du -h "$f" | cut -f1)"; done
