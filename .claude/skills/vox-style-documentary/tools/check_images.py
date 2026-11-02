"""Check and prepare the images a person generated from the worksheet (prompts.html), then refresh the worksheet.
usage: check_images.py WORK          (images dropped into WORK/images/ named like the worksheet; any of jpg png webp heic)
- finds each asset in WORK/images/ (name match ignores case, spaces and download suffixes like " (1)"), else keeps the
  one already in WORK/engine/assets/
- plates  -> RGB JPEG, resized to what the frame needs; warns when too small or the wrong orientation
- cut-outs -> transparent PNG: keeps real transparency (trimmed), otherwise removes the background with
  tools/cutout.swift (Apple Vision, macOS 14+); without it the engine falls back to a soft oval
- prints a Thai report and rewrites WORK/prompts.html / prompts.md with the new status"""
import sys, os, re, json, glob, shutil, subprocess, tempfile, platform
from PIL import Image
work = os.path.abspath(sys.argv[1]); T = os.path.dirname(os.path.abspath(__file__))
eng, inbox, assets = os.path.join(work, 'engine'), os.path.join(work, 'images'), os.path.join(work, 'engine', 'assets')
os.makedirs(inbox, exist_ok=True); os.makedirs(assets, exist_ok=True)
def worksheet(): return subprocess.run(['node', os.path.join(T, 'render.js'), eng, 'prompts', work], capture_output=True, text=True)
r = worksheet()
if r.returncode: print(r.stdout, r.stderr); sys.exit('render.js prompts failed')
A = json.load(open(os.path.join(work, 'out', 'assets.json'))); FW, FH = A['W'], A['H']; portrait = FH > FW
EXT = ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.tif', '.tiff', '.bmp')
def norm(s): return re.sub(r'(\s*\(\d+\)|[-_ ]copy|\s+)', '', s.lower())
files = [f for f in glob.glob(os.path.join(inbox, '*')) if f.lower().endswith(EXT)]
def find(name):
    hits = [f for f in files if norm(os.path.splitext(os.path.basename(f))[0]) == norm(name)]
    return max(hits, key=os.path.getmtime) if hits else None
def opened(path):  # PIL, or macOS sips for HEIC / AVIF
    try: im = Image.open(path); im.load(); return im
    except Exception:
        if shutil.which('sips'):
            tmp = tempfile.mktemp(suffix='.png'); subprocess.run(['sips', '-s', 'format', 'png', path, '--out', tmp], capture_output=True)
            if os.path.exists(tmp): im = Image.open(tmp); im.load(); return im
        return None
def has_alpha(im):
    if im.mode not in ('RGBA', 'LA', 'PA') and not (im.mode == 'P' and 'transparency' in im.info): return False
    a = im.convert('RGBA').getchannel('A'); w, h = a.size
    border = [a.getpixel((x, y)) for x in range(0, w, max(1, w // 64)) for y in (0, h - 1)] + [a.getpixel((x, y)) for y in range(0, h, max(1, h // 64)) for x in (0, w - 1)]
    return min(border) < 30
def trim(im):
    im = im.convert('RGBA'); bb = im.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    if bb: m = int(max(im.size) * .01); im = im.crop((max(0, bb[0] - m), max(0, bb[1] - m), min(im.width, bb[2] + m), min(im.height, bb[3] + m)))
    return im
CUT = os.path.join(T, 'cutout.swift'); can_cut = platform.system() == 'Darwin' and shutil.which('swift') and os.path.exists(CUT)
def vision_cut(src):
    tmp_in = tempfile.mktemp(suffix='.png'); tmp_out = tempfile.mktemp(suffix='.png'); opened(src).convert('RGB').save(tmp_in)
    p = subprocess.run(['swift', CUT, tmp_in, tmp_out], capture_output=True, text=True)
    return (Image.open(tmp_out), '') if p.returncode == 0 and os.path.exists(tmp_out) else (None, (p.stdout + p.stderr).strip()[-120:])
rows = []
for a in A['assets']:
    name, cut = a['name'], a['cut']; dst = os.path.join(assets, a['file']); src = find(name)
    if not src and cut and os.path.exists(dst) and not has_alpha(opened(dst) or Image.new('RGBA', (8, 8))): src = dst  # cut-out put straight into assets/ with its background
    if not src:
        rows.append((name, 'มีแล้ว' if os.path.exists(dst) else 'ยังไม่มี', '' if os.path.exists(dst) else f'บันทึกเป็น images/{a["file"]}')); continue
    if src != dst and os.path.exists(dst) and os.path.getmtime(dst) > os.path.getmtime(src): rows.append((name, 'มีแล้ว', 'ใช้ภาพที่เตรียมไว้')); continue
    im = opened(src)
    if im is None: rows.append((name, 'เปิดไม่ได้', os.path.basename(src))); continue
    notes = []
    if not cut:
        im = im.convert('RGB'); s = max(FW / im.width, FH / im.height)
        need = '1024x1280' if a.get('photo') else f'{FW}x{FH}'
        if a.get('photo'): s = 900 / min(im.size)  # printed photo on a board: ~900 px short side is plenty
        if s > 1.25: notes.append(f'ภาพเล็กไป ({im.width}x{im.height}) อาจแตก ควรได้อย่างน้อย {need}')
        if not a.get('photo') and (im.width > im.height) == portrait and abs(im.width / im.height - FW / FH) > .3:
            notes.append('ภาพผิดแนว (ควรเป็น' + ('แนวตั้ง' if portrait else 'แนวนอน') + ') จะถูกครอปมาก')
        k = min(1, 1.6 * s)  # keep at most 1.6x the frame's cover size
        if k < 1: im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im.save(dst, quality=92); rows.append((name, 'โอเค' if not notes else 'ใช้ได้ แต่…', ' / '.join(notes)))
    else:
        if has_alpha(im): out = trim(im); how = 'พื้นหลังโปร่งใสอยู่แล้ว'
        elif can_cut:
            out, err = vision_cut(src); how = 'ไดคัทอัตโนมัติ (Vision)'
            if out is None: out = im.convert('RGBA'); how = 'ไดคัทไม่สำเร็จ: ' + err
        else: out = im.convert('RGBA'); how = 'ยังมีพื้นหลัง: ใช้ remove.bg / Canva แล้วบันทึกเป็น PNG'
        if out.height > 2000: out = out.resize((round(out.width * 2000 / out.height), 2000), Image.LANCZOS)
        if out.height < 700: notes.append(f'ภาพเล็กไป (สูง {out.height}px)')
        out.save(dst); ok = has_alpha(out)
        rows.append((name, 'โอเค' if ok and not notes else ('ต้องแก้' if not ok else 'ใช้ได้ แต่…'), ' / '.join([how] + notes)))
worksheet()
w = max(len(n) for n, _, _ in rows) if rows else 4
print(f"\nภาพ {sum(1 for _, s, _ in rows if s in ('โอเค', 'มีแล้ว', 'ใช้ได้ แต่…'))}/{len(rows)} พร้อมใช้ (คลิปแนว{'ตั้ง 9:16' if portrait else 'นอน 16:9'})")
for n, s, note in rows: print(f"  {n.ljust(w)}  {s}{('  ' + note) if note else ''}")
stem = lambda f: norm(os.path.splitext(os.path.basename(f))[0])
extra = [os.path.basename(f) for f in files if stem(f) not in {norm(a['name']) for a in A['assets']} and not stem(f).endswith('_ref')]  # *_ref = character references
if extra: print('  ไฟล์ที่ไม่ตรงกับชื่อในใบงาน:', ', '.join(extra))
for r in A.get('refs', []):  # character reference images (attached when generating, not used in the clip)
    have = find(os.path.splitext(r['file'])[0])
    tip = {'speaker': 'รัน speaker.py กับคลิปนั่งพูดก่อน', 'photo': f"หาภาพถ่ายหน้าตรงของ {r['who']} บันทึกเป็น images/{r['file']}", 'gen': f"เจนตามการ์ด ★ แล้วบันทึกเป็น images/{r['file']}"}[r['kind']]
    print(f"  ภาพอ้างอิง {r['file']}: {'มีแล้ว' if have else 'ยังไม่มี  ' + tip}")
print('ใบงานอัปเดตแล้ว:', os.path.join(work, 'prompts.html'))
