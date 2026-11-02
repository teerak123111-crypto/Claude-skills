// ---------- kit/lib.js: format, math, assets (images + clips), 2.5D camera, plates, cut-outs, kinetic words ----------
// Format comes from engine/format.js (FORMAT = '9:16' | '16:9'); ?fmt=16:9 in the page URL overrides it (render.js FMT=..).
const FMT = new URLSearchParams(location.search).get('fmt') || (typeof FORMAT !== 'undefined' ? FORMAT : '9:16');
const [W, H] = FMT === '16:9' ? [1920, 1080] : [1080, 1920];
const PORTRAIT = H > W, U = Math.min(W, H) / 1080; // U = size unit: 1 on both formats' short side
const cv = document.getElementById('c'); cv.width = W; cv.height = H; let ctx = cv.getContext('2d');
const TAU = Math.PI * 2;
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
const easeIn = t => { t = clamp(t); return t * t * t; };
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const seg = (t, a, b) => clamp((t - a) / (b - a));
const pick = (p, l) => PORTRAIT ? p : l; // layout switch: pick(valueFor9x16, valueFor16x9)
function noise1(x, seed = 1) { const i = Math.floor(x), f = x - i, h = n => { const s = Math.sin((n + seed * 57.3) * 127.1) * 43758.5453; return s - Math.floor(s); }; return lerp(h(i), h(i + 1), smooth(f)) * 2 - 1; }

// ---------- palette ----------
const P = {
  red: '#c8232f', redDk: '#8e1620', redInk: '#b0161f',
  paper: '#e4d6bd', paperDk: '#bda68e', card: '#9f7c5e', cardDk: '#6e5139',
  ink: '#2a211b', dark: '#15100c', wood: '#3a2a20', gold: '#d9a441', warm: '#f2b56b', cream: '#f4ead6', white: '#fbf6ec',
  cork: '#b07a48', photo: '#f1ebdd', tape: 'rgba(236,226,196,.78)', hl: '#f6d84a'
};
function hex(c) { if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; const n = parseInt(c.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }

// ---------- cue log (tools/audio.py): appear() / words() / marker() etc. register sounds while cueScan() runs ----------
let CUESCAN = false; const CUELOG = new Map();
function cue(t0, type) { if (CUESCAN) { const k = Math.round(t0 * 100) / 100 + ':' + type; CUELOG.set(k, [Math.round(t0 * 100) / 100, type]); } }

// ---------- offscreen canvases ----------
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
const _cache = new Map();
function cached(key, w, h, draw) { let c = _cache.get(key); if (!c) { c = mkCanvas(w, h); const o = ctx; ctx = c.getContext('2d'); draw(c.width, c.height); ctx = o; _cache.set(key, c); } return c; }

// ---------- assets ----------
// ASSETS (episode) = { name: { prompt, note, cut, char, text, shot } , ... }   (file = assets/<name>.jpg, or .png when cut: true)
//   prompt = what to generate (English, without the STYLE prefix), note = Thai label for the placeholder / worksheet,
//   cut = transparent cut-out subject, photo = shown as a printed photo (4:5), char = key of CHARS (character lock), text = where the words go ('top' | 'middle' | 'bottom'),
//   shot = worksheet label ('ช็อต 1 · 0-4.6 วิ'). Short forms still work: 'assets/x.jpg' or ['assets/x.png', 'note'].
// Missing file -> labelled placeholder (animatic mode); a cut-out without transparency -> soft oval-feathered fallback.
// CLIPS (episode, optional) = { name: { dir: 'assets/clipname', n: 120, fps: 24 } } frames f0001.jpg.. extracted with ffmpeg.
const IMG = {}, MISSING = [], NOALPHA = [], _loads = [];
function assetSpec(name, v) {
  if (typeof v === 'string') v = [v, ''];
  if (Array.isArray(v)) return { name, file: v[0], note: v[1] || '', cut: /\.png$/i.test(v[0]) };
  const cut = !!v.cut; return Object.assign({ note: '', prompt: '' }, v, { name, cut, file: v.file || `assets/${name}.${cut ? 'png' : 'jpg'}` });
}
const assetList = () => Object.entries(typeof ASSETS === 'undefined' ? {} : ASSETS).map(([k, v]) => assetSpec(k, v));
function hasAlpha(im) { // any clearly transparent pixel on the border?
  const c = mkCanvas(64, 64), g = c.getContext('2d'); g.drawImage(im, 0, 0, 64, 64); const d = g.getImageData(0, 0, 64, 64).data;
  for (let i = 0; i < 64; i++) for (const [x, y] of [[i, 0], [i, 63], [0, i], [63, i]]) if (d[(y * 64 + x) * 4 + 3] < 30) return true;
  return false;
}
function feathered(im) { // fallback for a cut-out that still has its background: soft oval vignette
  const c = mkCanvas(im.width, im.height), g = c.getContext('2d'); g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'destination-in'; g.translate(im.width / 2, im.height / 2); g.scale(im.width / 2, im.height / 2);
  const gr = g.createRadialGradient(0, 0, .55, 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); return c;
}
function placeholder(name, note, isCut) {
  const pw = isCut ? 900 : W * 1.3, ph = isCut ? 1500 : H * 1.3, c = mkCanvas(pw, ph), g = c.getContext('2d'), R = rng(name.length * 17 + 3);
  if (isCut) {
    g.fillStyle = '#3b3029'; g.beginPath(); g.ellipse(pw / 2, ph * .13, pw * .12, pw * .15, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(pw * .18, ph); g.quadraticCurveTo(pw * .16, ph * .3, pw / 2, ph * .26); g.quadraticCurveTo(pw * .84, ph * .3, pw * .82, ph); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'bold 54px PlexB'; g.textAlign = 'center'; g.fillText(name, pw / 2, ph * .55);
    g.font = '34px PlexM'; wrapText(g, note || 'cut-out', pw / 2, ph * .61, pw * .55, 44);
  } else {
    const gr = g.createLinearGradient(0, 0, 0, ph); gr.addColorStop(0, '#8a7560'); gr.addColorStop(1, '#3d2f25'); g.fillStyle = gr; g.fillRect(0, 0, pw, ph);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,236,200,${.03 + R() * .05})`; g.beginPath(); g.ellipse(R() * pw, R() * ph, 80 + R() * 300, 60 + R() * 200, R() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(255,240,215,.25)'; g.lineWidth = 3; for (let x = 0; x < pw; x += 120) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, ph); g.stroke(); }
    for (let y = 0; y < ph; y += 120) { g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); }
    g.fillStyle = 'rgba(255,245,225,.9)'; g.font = `bold ${70 * U}px PlexB`; g.textAlign = 'center'; g.fillText('[ ' + name + ' ]', pw / 2, ph / 2 - 40 * U);
    g.font = `${40 * U}px PlexM`; wrapText(g, note || 'plate', pw / 2, ph / 2 + 40 * U, pw * .6, 54 * U);
  }
  c.placeholder = true; return c;
}
function wrapText(g, s, x, y, maxW, lh) { // greedy wrap on spaces (Thai notes: put spaces between phrases)
  const ws = String(s).split(' '); let line = '', yy = y;
  for (const w of ws) { const tst = line ? line + ' ' + w : w; if (g.measureText(tst).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = tst; }
  if (line) g.fillText(line, x, yy);
}
function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function loadAssets() {
  for (const a of assetList())
    _loads.push(loadImg(a.file).then(im => {
      if (!im) { IMG[a.name] = placeholder(a.name, a.note, a.cut); MISSING.push(a.name); }
      else if (a.cut && !hasAlpha(im)) { IMG[a.name] = feathered(im); NOALPHA.push(a.name); }
      else IMG[a.name] = im;
    }));
}
function img(name) { const i = IMG[name]; if (!i) throw new Error('asset not declared in ASSETS: ' + name); return i; }
// video clips as frame sequences: draw calls request frames, frameJPEG() loads them and redraws
const CLIPF = new Map(), _need = new Set();
function clipInfo(name) {
  if (typeof SPEAKER !== 'undefined' && name === SPEAKER.clip) return SPEAKER;
  const C = typeof CLIPS !== 'undefined' && CLIPS[name]; if (!C) throw new Error('clip not declared in CLIPS: ' + name); return C;
}
function clipFrame(name, tl) {
  const C = clipInfo(name), n = Math.min(C.n, Math.max(1, Math.floor(tl * (C.fps || 24)) + 1)), key = name + n, f = CLIPF.get(key);
  if (f) return f; _need.add(key + '|' + `${C.dir}/f${String(n).padStart(4, '0')}.jpg`);
  for (let k = n - 1; k >= 1; k--) { const g = CLIPF.get(name + k); if (g) return g; } return null;
}
async function loadNeeded() {
  const L = [..._need]; _need.clear();
  await Promise.all(L.map(s => { const [key, src] = s.split('|'); return loadImg(src).then(im => CLIPF.set(key, im || mkCanvas(8, 8))); }));
  if (CLIPF.size > 400) { const ks = [...CLIPF.keys()].slice(0, CLIPF.size - 300); ks.forEach(k => CLIPF.delete(k)); }
  return L.length;
}

// ---------- 2.5D camera ----------
// camera(x, y, z, rot): x/y = pan in px (0,0 = centre), z = zoom (1 = rest). Each layer has a depth d:
//   d = 0 fixed to the screen, .3-.6 far background, 1 = subject plane, 1.3-2 foreground (moves/zooms more).
let CAM = { x: 0, y: 0, z: 1, r: 0 };
function camera(x = 0, y = 0, z = 1, r = 0) { CAM = { x, y, z, r }; }
function camMove(t, t0, t1, from, to, e = ease) { const k = e(seg(t, t0, t1)); camera(...from.map((v, i) => lerp(v, to[i] != null ? to[i] : v, k))); }
function drift(t, amp = 6, seed = 1) { CAM.x += noise1(t * .35, seed) * amp * U; CAM.y += noise1(t * .3, seed + 9) * amp * U; } // hand-held float
function depth(d) {
  const z = Math.pow(CAM.z, d);
  ctx.translate(W / 2, H / 2); if (CAM.r) ctx.rotate(CAM.r * d); ctx.scale(z, z); ctx.translate(-CAM.x * d, -CAM.y * d); ctx.translate(-W / 2, -H / 2);
}
function layer(d, fn) { ctx.save(); depth(d); fn(); ctx.restore(); }

// ---------- blur helper (ctx.filter on the drawImage) ----------
function withFx(o, fn) {
  ctx.save(); const f = [];
  if (o.blur > .3) f.push(`blur(${o.blur * U}px)`);
  if (o.filter) f.push(o.filter);
  if (f.length) ctx.filter = f.join(' ');
  if (o.a != null) ctx.globalAlpha *= clamp(o.a);
  if (o.blend) ctx.globalCompositeOperation = o.blend;
  fn(); ctx.restore();
}

// ---------- plates (background stills) ----------
// plate(name, {d=.5, over=1.15, focus=[.5,.5], blur, filter, a, x, y, s}) cover-fits the image to the frame * over,
// cropped around focus (fx, fy in 0..1 of the image) so one image works for both 9:16 and 16:9.
function plate(name, o = {}) {
  const im = img(name), iw = im.width, ih = im.height, over = o.over || 1.15, fc = o.focus || [.5, .5];
  const d = o.d != null ? o.d : .5, z = Math.pow(CAM.z, d);
  const sc = Math.max(W / iw, H / ih) * Math.max(over * (o.s || 1), 1.02 / z), dw = iw * sc, dh = ih * sc;
  let x = W / 2 - fc[0] * dw + (o.x || 0), y = H / 2 - fc[1] * dh + (o.y || 0);  // focus point to the centre ...
  // ... but never show an edge: keep the plate covering the frame under this layer's camera transform
  const cx = CAM.x * d + W / 2, cy = CAM.y * d + H / 2;
  x = clamp(x, cx + W / (2 * z) - dw, cx - W / (2 * z)); y = clamp(y, cy + H / (2 * z) - dh, cy - H / (2 * z));
  layer(d, () => withFx(o, () => ctx.drawImage(im, x, y, dw, dh)));
}
// clip(name, tl, {...plate options}) = a video clip (frame sequence) used as a plate; tl = seconds into the clip
function clip(name, tl, o = {}) {
  const f = clipFrame(name, Math.max(0, tl)); if (!f) { ctx.fillStyle = P.dark; ctx.fillRect(0, 0, W, H); return; }
  IMG['__clip'] = f; plate('__clip', o);
}

// ---------- cut-outs (transparent PNG subjects) ----------
// cut(name, x, y, h, {d=1, anchor=[.5,1], a, blur, filter, flip, rot, shadow}) x,y in frame px (anchor point), h = height px
function cut(name, x, y, h, o = {}) {
  const im = img(name), sc = h / im.height, w = im.width * sc, an = o.anchor || [.5, 1];
  layer(o.d != null ? o.d : 1, () => {
    ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1);
    if (o.shadow) { ctx.save(); ctx.globalAlpha *= (o.a != null ? o.a : 1) * o.shadow; ctx.fillStyle = rgba('#000000', .55); ctx.filter = `blur(${18 * U}px)`; ctx.beginPath(); ctx.ellipse(0, 0, w * .38, h * .025 + 8, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    withFx(o, () => ctx.drawImage(im, -an[0] * w, -an[1] * h, w, h));
  });
}

// ---------- appear / disappear (blur-in, rise, grow, fade) ----------
// appear(t, t0, kind, dur) -> {a, blur, s, dy}; registers a sound cue ('soft' whoosh) at t0 unless kind ends with '!'
function appear(t, t0, kind = 'blur', dur = .6, snd = 'soft') {
  if (snd) cue(t0, snd);
  const k = easeOut(seg(t, t0, t0 + dur)), r = { a: k, blur: 0, s: 1, dy: 0 };
  if (kind === 'blur') { r.blur = (1 - k) * 22; r.s = lerp(1.08, 1, k); }
  else if (kind === 'rise') { r.dy = (1 - k) * 60 * U; r.blur = (1 - k) * 8; }
  else if (kind === 'grow') { r.s = lerp(.55, 1, k); r.a = clamp(k * 3); }
  else if (kind === 'slam') { const e = 1 - Math.pow(1 - seg(t, t0, t0 + dur * .5), 3); r.s = lerp(1.9, 1, e); r.a = clamp(seg(t, t0, t0 + .08)); }
  return r;
}
const vanish = (t, t1, dur = .5) => 1 - ease(seg(t, t1, t1 + dur)); // multiply alphas with this to take things off

// ---------- kinetic words ----------
// FONTS: sans = IBM Plex Sans Thai Bold, serif = bold italic serif (Times on Latin, Sathu, Thonburi/Thonburi fallback on Thai)
const FONT = { sans: w => `700 ${w}px PlexB, Thonburi`, serifI: w => `italic 700 ${w}px "Times New Roman", Times, Sathu, Thonburi, serif`,
  serif: w => `700 ${w}px "Times New Roman", Times, Sathu, Thonburi, serif`, light: w => `500 ${w}px PlexM, Thonburi`, semi: w => `600 ${w}px PlexS, Thonburi` };
// words(t, lines, {x, y, size, col, gap, align, d, kind, dur, rough, shadow, maxW, a})
//   lines = [[word, at, style?, size?], ...] one entry per line; or [[[w, at, style], [w, at, style]], ...] for several words on a line.
//   style: 'sans' (default) | 'serifI' | 'serif' | 'light' | 'semi'.  at = time the word appears (from words.json).
// Draw words() BEFORE cut() to put the text behind a subject (the reference's main trick).
function words(t, lines, o = {}) {
  const size0 = (o.size || 150) * U, col = o.col || P.red, gap = (o.gap != null ? o.gap : .1) * size0, kind = o.kind || 'blur';
  const L = lines.map(l => (Array.isArray(l[0]) ? l : [l]).map(w => ({ s: w[0], at: w[1], st: w[2] || o.style || 'sans', sz: (w[3] || 1) * size0 })));
  // measure, auto-shrink lines wider than maxW
  const maxW = (o.maxW || .86) * W; let hTot = 0;
  for (const line of L) {
    let wsum = 0; for (const w of line) { ctx.font = FONT[w.st](w.sz); w.w = ctx.measureText(w.s).width; wsum += w.w; } wsum += (line.length - 1) * size0 * .25;
    const k = wsum > maxW ? maxW / wsum : 1; for (const w of line) { w.sz *= k; w.w *= k; } line.wsum = wsum * k; line.h = Math.max(...line.map(w => w.sz)) * .95; hTot += line.h + gap;
  }
  hTot -= gap; let y = (o.y != null ? o.y : H / 2) - hTot / 2;
  layer(o.d != null ? o.d : .8, () => {
    for (const line of L) {
      let x = (o.x != null ? o.x : W / 2) - (o.align === 'left' ? 0 : o.align === 'right' ? line.wsum : line.wsum / 2);
      for (const w of line) {
        const r = appear(t, w.at, kind, o.dur || .55, o.snd !== undefined ? o.snd : 'soft'), a = r.a * (o.a != null ? o.a : 1);
        if (a > .003) {
          ctx.save(); const cx = x + w.w / 2, cy = y + line.h / 2 + r.dy;
          ctx.translate(cx, cy); ctx.scale(r.s, r.s);
          roughText(w.s, 0, 0, FONT[w.st](w.sz), col, a, r.blur, o.rough != null ? o.rough : .35, o.shadow);
          ctx.restore();
        }
        x += w.w + size0 * .25;
      }
      y += line.h + gap;
    }
  });
}
// text with a printed-ink look: ink speckle knocked out of the glyphs (cached per string+font)
function roughText(s, x, y, font, col, a = 1, blur = 0, rough = .35, shadow) {
  const key = 'T' + s + font + col + rough;
  let c = _cache.get(key);
  if (!c) {
    const g0 = mkCanvas(8, 8).getContext('2d'); g0.font = font; const m = g0.measureText(s), sz = parseFloat(font.match(/(\d+(\.\d+)?)px/)[1]);
    const w = m.width + sz * .5, h = sz * 1.6; c = mkCanvas(w, h); const g = c.getContext('2d');
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(s, w / 2, h / 2);
    if (rough > 0) { g.globalCompositeOperation = 'destination-out'; const R = rng(s.length * 31 + Math.round(sz));
      for (let i = 0; i < w * h / 90; i++) { g.globalAlpha = R() * rough * .55; const r = R() * sz * .03 + .6; g.beginPath(); g.arc(R() * w, R() * h, r, 0, TAU); g.fill(); }
      g.globalAlpha = rough * .25; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(R() * w, R() * h, sz * (.3 + R()), sz * (.1 + R() * .2), R() * 3, 0, TAU); g.fill(); } }
    _cache.set(key, c);
  }
  ctx.save(); ctx.globalAlpha *= a; if (blur > .3) ctx.filter = `blur(${blur * U}px)`;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,' + shadow + ')'; ctx.shadowBlur = 30 * U; ctx.shadowOffsetY = 6 * U; }
  ctx.drawImage(c, x - c.width / 2, y - c.height / 2); ctx.restore();
}
// plain line of text (captions, paper cards): txt(s, x, y, size, col, style, align)
function txt(s, x, y, size, col = P.white, style = 'light', align = 'center', a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.font = FONT[style](size * U); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); ctx.restore();
}
