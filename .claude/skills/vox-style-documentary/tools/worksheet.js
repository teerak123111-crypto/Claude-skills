// Image worksheet for people who generate the pictures themselves (ChatGPT, Gemini, Midjourney, Leonardo ...).
// build(data) -> { html, md, json }   data = window.promptData() from the engine (render.js prompts WORK)
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TEXTPOS = { top: 'upper third', middle: 'middle', bottom: 'lower third' };
function prompts(d) {
  const portrait = d.H > d.W, ar = portrait ? '9:16' : '16:9', orient = portrait ? 'vertical 9:16 portrait' : 'wide 16:9 landscape';
  const min = portrait ? '1152x2048' : '2048x1152', style = d.style ? d.style.replace(/[.\s]+$/, '') + '. ' : '';
  // CHARS: 'description' (a reference image is generated first) or { desc, ref: 'speaker' | 'photo', who }
  //   ref 'speaker' = the narrator's own face (images/speaker_ref.jpg, taken from the talking-head video by speaker.py)
  //   ref 'photo'   = a real photo of someone else the story is about, found by the user (images/<key>_ref.jpg)
  const CH = Object.fromEntries(Object.entries(d.chars || {}).map(([k, v]) => [k, typeof v === 'string' ? { desc: v } : v]));
  const chars = Object.entries(CH).map(([k, c]) => {
    if (c.ref === 'speaker') return { key: k, kind: 'speaker', file: 'speaker_ref.jpg', who: c.who || 'ผู้พูด' };
    if (c.ref === 'photo') return { key: k, kind: 'photo', file: `${k}_ref.jpg`, who: c.who || k };
    return { key: k, kind: 'gen', file: `${k}_ref.png`, who: c.who || k, prompt: `${style}Character reference sheet of ${c.desc}. Full body front view and a close-up of the face side by side, neutral expression, plain light-grey studio background, even soft light. No text, no watermark.` };
  });
  const refFile = k => (chars.find(c => c.key === k) || {}).file || '';
  const items = d.assets.map((a, i) => {
    const c = a.char && CH[a.char], same = c && c.ref ? ' Keep the exact face and identity of the person in the attached reference photo.' : '';
    const ch = c ? ` The person is ${c.desc || (c.who || 'the person in the reference photo')}.${same}` : '';
    const body = (a.prompt || a.note || a.name).replace(/[.\s]+$/, '') + '.';
    const p = a.cut
      ? `${style}${body}${ch} The whole subject fully in frame, nothing cropped, centered, isolated on a plain flat light-grey studio background, soft even light, no shadow on the background. No text, no watermark.`
      : a.photo ? `${style}${body}${ch} 4:5 framing, subject centered. No text, no letters, no watermark, no border, no film grain.`
      : `${style}${body}${ch} ${orient[0].toUpperCase() + orient.slice(1)} composition${a.text ? `, leave calm empty space in the ${TEXTPOS[a.text] || a.text} for title text` : ''}. No text, no letters, no watermark, no border, no film grain.`;
    const ext = a.cut ? 'png' : 'jpg';
    return { n: i + 1, name: a.name, file: `${a.name}.${ext}`, cut: !!a.cut, note: a.note || '', shot: a.shot || '', char: a.char ? refFile(a.char) : '',
      ar: a.cut ? (portrait ? '2:3 หรือ 9:16' : '2:3 หรือ 1:1') : a.photo ? '4:5' : ar, min: a.cut ? 'สูงอย่างน้อย 1500 px' : a.photo ? 'อย่างน้อย 1024x1280' : `อย่างน้อย ${min}`, prompt: p, status: a.status };
  });
  return { ar, min, chars, items };
}
function build(d) {
  const P = prompts(d), title = d.title || 'ภาพสำหรับคลิป';
  const done = P.items.filter(x => x.status === 'ok').length;
  const ST = { ok: ['ok', 'มีแล้ว'], noalpha: ['warn', 'ยังไม่โปร่งใส'], missing: ['todo', 'ยังไม่มี'] };
  const card = (x, i) => `
<article class="card" data-k="${esc(x.file)}">
  <header><span class="num">${x.n}</span><div><div class="fname"><code>${esc(x.file)}</code><button class="copy small" data-copy="${esc(x.file)}">คัดลอกชื่อไฟล์</button></div>
  <div class="meta">${x.cut ? '<span class="tag cut">ตัวละคร/วัตถุ ไดคัท</span>' : '<span class="tag plate">ฉากหลัง</span>'} ${esc(x.shot)} ${esc(x.note)}</div></div>
  <span class="st ${ST[x.status][0]}">${ST[x.status][1]}</span><label class="chk"><input type="checkbox"> เสร็จ</label></header>
  <ul class="how"><li>สัดส่วนภาพ <b>${x.ar}</b> · ${x.min}</li>${x.char ? `<li>แนบภาพอ้างอิง <code>${esc(x.char)}</code> ไปด้วยทุกครั้ง (ให้หน้าตาตัวละครตรงกัน)</li>` : ''}
  ${x.cut ? '<li>ได้ภาพที่พื้นหลังเรียบแล้ว ไม่ต้องลบพื้นหลังเอง โปรแกรมตรวจภาพจะไดคัทให้บน Mac (หรือใช้ remove.bg / Canva)</li>' : ''}</ul>
  <pre>${esc(x.prompt)}</pre><button class="copy" data-copy="${esc(x.prompt)}">คัดลอก prompt</button>
</article>`;
  const REFTXT = {
    speaker: c => `<span class="tag ref">หน้าผู้พูด · มีให้แล้ว</span> ดึงจากคลิปนั่งพูดให้อัตโนมัติ อยู่ในโฟลเดอร์ <code>images</code> แล้ว ใช้แนบตอนเจนภาพที่ผู้พูดสวมบทเป็นตัวละคร`,
    photo: c => `<span class="tag ref">ภาพถ่ายบุคคลจริง · หาเอง</span> หาภาพถ่ายหน้าตรงที่ชัดของ <b>${esc(c.who)}</b> (เช่น จาก Wikimedia Commons หรือภาพที่มีสิทธิ์ใช้) บันทึกเป็นชื่อนี้ในโฟลเดอร์ <code>images</code> แล้วแนบตอนเจนภาพที่มีคนนี้ (เครื่องมือบางตัวไม่ยอมเจนหน้าคนดัง ถ้าไม่ยอมให้ใช้ภาพถ่ายนั้นเป็นภาพติดบอร์ดแทน)`,
    gen: c => `<span class="tag ref">ภาพอ้างอิงตัวละคร · ทำก่อน</span> เจนภาพนี้ก่อน แล้วแนบตอนเจนภาพที่มีคนนี้ (ไม่ได้ใส่ในคลิป)` };
  const chars = P.chars.map(c => `
<article class="card ref"><header><span class="num">★</span><div><div class="fname"><code>${esc(c.file)}</code><button class="copy small" data-copy="${esc(c.file)}">คัดลอกชื่อไฟล์</button></div>
  <div class="meta">${REFTXT[c.kind](c)}</div></div><label class="chk"><input type="checkbox"> เสร็จ</label></header>
  ${c.prompt ? `<pre>${esc(c.prompt)}</pre><button class="copy" data-copy="${esc(c.prompt)}">คัดลอก prompt</button>` : ''}</article>`).join('');
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ใบงานภาพ · ${esc(title)}</title><style>
:root{--bg:#f4efe6;--card:#fffdf8;--ink:#231c16;--mute:#6f6255;--line:#e2d8c8;--red:#c8232f;--ok:#2f7d4a;--warn:#b7791f}
@media (prefers-color-scheme:dark){:root{--bg:#17130f;--card:#211b16;--ink:#efe6d8;--mute:#a89a8a;--line:#3a3129}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "IBM Plex Sans Thai",Thonburi,"Leelawadee UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 80px}h1{font-size:28px;margin:0 0 4px;color:var(--red)}.sub{color:var(--mute);margin:0 0 20px}
.steps{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px 14px 36px;margin-bottom:22px}.steps li{margin:4px 0}
.prog{font-weight:600;margin:0 0 14px}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 14px}
.card.ref{border-color:var(--red)}header{display:flex;gap:12px;align-items:flex-start}.num{flex:none;width:34px;height:34px;border-radius:50%;background:var(--red);color:#fff;display:grid;place-items:center;font-weight:700}
header>div{flex:1;min-width:0}.fname{display:flex;gap:8px;flex-wrap:wrap;align-items:center}code{font:600 15px ui-monospace,Menlo,monospace;background:var(--bg);padding:2px 6px;border-radius:6px}
.meta{color:var(--mute);font-size:14px;margin-top:2px}.tag{font-size:12px;padding:1px 8px;border-radius:99px;border:1px solid var(--line);margin-right:4px}.tag.cut{border-color:var(--warn);color:var(--warn)}.tag.ref{border-color:var(--red);color:var(--red)}
.st{flex:none;font-size:13px;font-weight:600;padding:2px 8px;border-radius:6px}.st.ok{color:#fff;background:var(--ok)}.st.warn{color:#fff;background:var(--warn)}.st.todo{color:var(--mute);border:1px solid var(--line)}
.chk{flex:none;font-size:14px;color:var(--mute);white-space:nowrap}.how{margin:8px 0;padding-left:20px;font-size:14px;color:var(--mute)}
pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border-radius:8px;padding:10px 12px;margin:8px 0;font:14px/1.5 ui-monospace,Menlo,monospace}
button.copy{border:0;background:var(--ink);color:var(--bg);border-radius:8px;padding:8px 14px;font:inherit;font-size:14px;cursor:pointer}button.copy.small{padding:2px 10px;font-size:13px;background:transparent;color:var(--ink);border:1px solid var(--line)}
button.copy.done{background:var(--ok);color:#fff}.card.isdone{opacity:.55}
</style></head><body><main>
<h1>ใบงานภาพ: ${esc(title)}</h1><p class="sub">คลิปแนว${P.ar === '9:16' ? 'ตั้ง 9:16' : 'นอน 16:9'} · ภาพทั้งหมด ${P.items.length} ภาพ${P.chars.length ? ` + ภาพอ้างอิงตัวละคร ${P.chars.length} ภาพ` : ''}</p>
<ol class="steps">
<li>${P.chars.length ? 'เตรียมภาพอ้างอิงตัวละคร (การ์ดขอบแดง) ก่อน แล้วแนบภาพนั้นไปทุกครั้งที่เจนภาพที่มีคนคนนั้น' : 'เจนภาพตามลำดับการ์ด'}</li>
<li>กด "คัดลอก prompt" แล้ววางในเครื่องมือเจนภาพ (ChatGPT, Gemini, Midjourney, Leonardo ฯลฯ) ตั้งสัดส่วนภาพตามที่เขียนไว้</li>
<li>ดาวน์โหลดภาพ แล้ว<b>ตั้งชื่อไฟล์ตามที่เขียนไว้</b> (นามสกุล .jpg .png .webp ใช้ได้หมด) วางไว้ในโฟลเดอร์ <code>images</code> ของงาน</li>
<li>ภาพไดคัท: เจนบนพื้นหลังสีเทาเรียบก็พอ โปรแกรมจะลบพื้นหลังให้</li>
<li>ครบแล้วบอก Claude ว่า "ใส่ภาพแล้ว" (หรือรัน <code>python3 tools/check_images.py งาน</code>) ระบบจะตรวจขนาด ไดคัท แล้วแจ้งภาพที่ต้องแก้</li>
</ol>
<p class="prog">มีภาพแล้ว ${done} จาก ${P.items.length}</p>
${chars}${P.items.map(card).join('')}
</main><script>
document.querySelectorAll('button.copy').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy)}catch(e){const t=document.createElement('textarea');t.value=b.dataset.copy;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove()}
const o=b.textContent;b.textContent='คัดลอกแล้ว';b.classList.add('done');setTimeout(()=>{b.textContent=o;b.classList.remove('done')},1400)});
const K='ws:'+document.title;let S={};try{S=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
document.querySelectorAll('.card').forEach((c,i)=>{const x=c.querySelector('input');const k=c.dataset.k||('r'+i);x.checked=!!S[k];c.classList.toggle('isdone',x.checked);
x.onchange=()=>{S[k]=x.checked;c.classList.toggle('isdone',x.checked);try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}});
</script></body></html>`;
  const md = [`# ใบงานภาพ: ${title}`, '', `คลิปแนว${P.ar === '9:16' ? 'ตั้ง 9:16' : 'นอน 16:9'} · ตั้งชื่อไฟล์ตามที่เขียนไว้ แล้ววางในโฟลเดอร์ \`images\``, '',
    ...P.chars.map(c => c.kind === 'speaker' ? `## ★ ${c.file} (หน้าผู้พูด ดึงจากคลิปให้แล้ว)\n` : c.kind === 'photo' ? `## ★ ${c.file} (ภาพถ่ายหน้าตรงของ ${c.who} หาเอง แล้วบันทึกชื่อนี้)\n` : `## ★ ${c.file} (ภาพอ้างอิงตัวละคร ทำก่อน)\n\n\`\`\`\n${c.prompt}\n\`\`\`\n`),
    ...P.items.map(x => `## ${x.n}. ${x.file} (${x.cut ? 'ไดคัท' : 'ฉากหลัง'}, ${x.ar})${x.status === 'ok' ? ' ✓' : ''}\n${[x.shot, x.note].filter(Boolean).join(' · ')}${x.char ? `\nแนบภาพอ้างอิง ${x.char}.png` : ''}\n\n\`\`\`\n${x.prompt}\n\`\`\`\n`)].join('\n');
  const json = { W: d.W, H: d.H, FMT: d.FMT, refs: P.chars.map(c => ({ key: c.key, kind: c.kind, file: c.file, who: c.who })), assets: P.items.map(x => ({ name: x.name, file: x.file, cut: x.cut, photo: !!d.assets[x.n - 1].photo, status: x.status })) };
  return { html, md, json };
}
module.exports = { build };
