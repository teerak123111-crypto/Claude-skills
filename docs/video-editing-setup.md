# ติดตั้งสกิลตัดต่อวิดีโอบนเครื่องตัวเอง

สกิล [longform-video-skill](https://github.com/tonsasawat-bit/longform-video-skill) ทำงานอยู่ภายในโปรเจกต์
[HyperFrames Student Kit](https://github.com/nateherkai/hyperframes-student-kit) (ขนาดประมาณ 400 MB)
จึงติดตั้งบนเครื่องตัวเองแทน cloud session

## 1. เตรียมเครื่องมือ

| เครื่องมือ | ตรวจด้วยคำสั่ง | ถ้ายังไม่มี |
|---|---|---|
| Node.js 22 ขึ้นไป | `node -v` | https://nodejs.org (เลือก LTS) |
| Git | `git --version` | https://git-scm.com |
| FFmpeg (มี ffprobe ด้วย) | `ffmpeg -version` | macOS: `brew install ffmpeg` · Windows: `winget install Gyan.FFmpeg` |
| Google Chrome | — | https://www.google.com/chrome |
| Claude Code | `claude --version` | https://claude.com/claude-code |

Windows: ปิดแล้วเปิด terminal ใหม่หลังติดตั้ง FFmpeg และใช้ **Git Bash** รันคำสั่งในข้อ 2
(เพราะ `install.sh` เป็นสคริปต์ bash)

## 2. ติดตั้ง

```bash
git clone https://github.com/nateherkai/hyperframes-student-kit.git
cd hyperframes-student-kit && npm ci && npm run setup && cd ..
git clone https://github.com/tonsasawat-bit/longform-video-skill.git
./longform-video-skill/install.sh ./hyperframes-student-kit
```

| คำสั่ง | ทำอะไร |
|---|---|
| `git clone …hyperframes-student-kit` | ดาวน์โหลดชุดตัดต่อ |
| `npm ci` | ติดตั้ง library ตาม `package-lock.json` |
| `npm run setup` | ตรวจว่ามีเครื่องมือครบ และสร้างไฟล์ `.env` (ไว้ใส่ API key) ถ้ายังไม่มี |
| `git clone …longform-video-skill` | ดาวน์โหลดสกิลตัดต่อแบบยาว |
| `./longform-video-skill/install.sh …` | เอาสกิลไปแทน `edit-video` เดิม (สำรองของเดิมไว้เป็น `edit-video.backup-…`) |

ตรวจว่าใช้งานได้ (ไม่ต้องใช้ key): `cd hyperframes-student-kit && npm test`

## 3. การถอดเสียง (เลือกอย่างใดอย่างหนึ่ง)

| ตัวเลือก | ต้องใช้ | หมายเหตุ |
|---|---|---|
| ElevenLabs Scribe (ค่าเริ่มต้น) | API key ที่มีสิทธิ์ `speech_to_text` | ใส่ใน `.env` เป็น `ELEVENLABS_API_KEY=...` เสียค่าใช้จ่ายตามการใช้งาน |
| Whisper บนเครื่อง | ดาวน์โหลดโมเดล ใช้ CPU/GPU ของเครื่อง | ฟรี ไม่ส่งเสียงออกนอกเครื่อง บอก Claude ว่า "ใช้ local Whisper แทน ElevenLabs" |

**อย่า** commit ไฟล์ `.env` หรือวาง key ลงในแชท

## 4. ใช้งาน

```bash
cd hyperframes-student-kit
claude
```

แล้วพิมพ์ใน Claude Code:

```
/edit-video ตัดต่อคลิปนี้ /path/to/my-video.mov
```

ปัญหาที่พบบ่อย: ElevenLabs ตอบ 401 = key ผิด, 403 = key ไม่มีสิทธิ์ `speech_to_text`;
render ไม่ได้ให้รัน `npx hyperframes doctor`
