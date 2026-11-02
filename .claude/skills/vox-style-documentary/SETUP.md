# ติดตั้งครั้งแรก (Mac)

```bash
# 1) Homebrew (ถ้ายังไม่มี) แล้วติดตั้ง ffmpeg, node, python
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install ffmpeg node python

# 2) ไลบรารี Python
pip3 install numpy scipy pillow

# 3) Playwright + Chromium (ใช้วาดทุกเฟรม)
cd ~/.claude/skills/vox-style-documentary/tools
npm install
npx playwright install chromium
```

เช็ก: `ffmpeg -version`, `node -v`, `python3 -c "import numpy, scipy, PIL"` ไม่มี error = พร้อม

ทดสอบเร็ว (animatic 3 ภาพจากตัวอย่าง ไม่ต้องมีรูป):
```bash
S=~/.claude/skills/vox-style-documentary
node "$S/tools/render.js" "$S/engine" snap ~/Desktop/ทดสอบ 2,7,12
```

# ติดตั้งครั้งแรก (Windows)

1. ติดตั้งจากเว็บทางการ: **Node.js** (LTS) จาก nodejs.org, **Python 3** จาก python.org (ติ๊ก "Add python.exe to PATH"),
   **Git for Windows** จาก git-scm.com (ได้ Git Bash มาด้วย สำหรับรันสคริปต์ `.sh`)
2. ffmpeg: เปิด PowerShell แล้วรัน `winget install Gyan.FFmpeg` จากนั้นปิดและเปิด PowerShell ใหม่
3. เปิด **Git Bash** แล้วรัน
```bash
pip install numpy scipy pillow
cd ~/.claude/skills/vox-style-documentary/tools
npm install
npx playwright install chromium
```
4. ถ้าระบบเรียก `python3` ไม่เจอ ให้รัน `alias python3=python` ใน Git Bash ก่อน

เช็กแบบเดียวกับ Mac: `ffmpeg -version`, `node -v`, `python3 -c "import numpy, scipy, PIL"`

## ฟอนต์
IBM Plex Sans Thai (SIL Open Font License, ดู `engine/fonts/OFL.txt`) แนบมาในโฟลเดอร์ `engine/fonts` แล้ว
ตัว serif เอียงใช้ Times New Roman ที่มีอยู่แล้วทั้งบน Mac และ Windows (ตัวอักษรไทยจะใช้ฟอนต์ไทยของระบบแทน)

## การทำภาพ
ค่าเริ่มต้น: Claude ทำใบงาน `prompts.html` ให้ แล้วคุณนำ prompt ไปเจนในเครื่องมือไหนก็ได้ (ChatGPT, Gemini, Midjourney, Leonardo)
ลบพื้นหลังตัวละครอัตโนมัติ: ใช้ได้บน Mac ที่เป็น macOS 14 ขึ้นไป และต้องมีคำสั่ง `swift`
(ถ้ายังไม่มี ให้รัน `xcode-select --install` ครั้งเดียว) บน Windows ให้ลบพื้นหลังด้วย remove.bg หรือ Canva แล้วบันทึกเป็น PNG
ถ้าเชื่อมบริการเจนภาพแบบเสียเงินกับ Claude ไว้ (เช่น fal) ก็ให้ Claude เจนให้ได้ โดย Claude จะแจ้งราคาก่อนทุกครั้ง
