"""Contact sheet of stills (any aspect: 9:16 or 16:9) for checking a whole clip at a glance.
usage: sheet.py SNAPDIR out.jpg [cols=6] [width=300]   (stills from: node render.js ENGINE snap SNAPDIR 1,3.5,6,...)"""
import sys, glob, re, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6; w = int(sys.argv[4]) if len(sys.argv) > 4 else 300
fs = sorted(glob.glob(os.path.join(d, 's*.jpg')), key=lambda f: float(re.findall(r's([\d.]+)\.jpg', os.path.basename(f))[0]))
im0 = Image.open(fs[0]); h = w * im0.height // im0.width
rows = (len(fs) + cols - 1) // cols; S = Image.new('RGB', (w * cols, h * rows), '#000'); dr = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    x, y = (i % cols) * w, (i // cols) * h; S.paste(Image.open(f).resize((w, h)), (x, y))
    t = re.findall(r's([\d.]+)\.jpg', os.path.basename(f))[0]; dr.rectangle([x, y, x + 62, y + 20], fill='#000'); dr.text((x + 5, y + 4), f'{float(t):.1f}s', fill='#fff')
S.save(out, quality=88); print(out, len(fs), 'stills')
