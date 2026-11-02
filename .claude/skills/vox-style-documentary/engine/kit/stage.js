// ---------- kit/stage.js: timeline driver, transitions, film finish, hooks for tools/render.js ----------
// Generic: no episode code here. An episode (engine/episode.js) defines
//   TITLE, STYLE (prompt prefix), CHARS = { key: 'character description' }  for the image worksheet
//   ASSETS = { name: { prompt, note, cut, char, text, shot } }  (see kit/lib.js; file = assets/<name>.jpg|.png)
//   CLIPS  (optional) = { name: { dir: 'assets/name', n: frames, fps: 24 } }  video clips as frame sequences
//   END    clip length in seconds
//   scene functions sX(t)  each draws one full frame for absolute time t (stateless!)
//   SC = [[t0, t1, sX, opts?], ...]  back to back; opts = film-look overrides {grade:'noir', paper:.4, ...} plus, in
//        talking-head mode, spk: 'circle' (default) | 'full' | 'off' and over: fn(t) drawn on top of the speaker
//   SPEAKER (engine/speaker.js, written by tools/speaker.py) = the narrator's face-to-camera video; SPKC (optional)
//        = { x, y, d } circle centre (0..1 of W/H) and diameter (px) to move it; the speaker keeps its own colours
//        (drawn after the film finish), SPKGRADE = true runs the film grade / grain over it as well
//   TR = [[t, type, dur, opts?], ...] centred on a scene boundary t. types:
//        cut | fade | blur (blurred dissolve) | dip (defocus to dark and back) | whip (motion-blur pan, opts.dir 'left'|'right'|'up'|'down')
//        push (slide, opts.dir) | zoom (zoom-through into opts.at [x,y] of the old frame) | burn (warm film-burn dissolve) | flash
//        opts.snd overrides the transition sound ('none' = silent)
//   LOOK   (optional) = { grain, paper, dust, vignette, grade: warm|sepia|noir|cold|none, fade, flicker }  film finish
//   cover()  draws the thumbnail at the clip's format
//   CUES   (optional) = { music: [[t0, t1, preset], ...], sfx: [[t, type, ...args], ...], mute: [t, ...] }
const offA = mkCanvas(W, H), offB = mkCanvas(W, H), offT = mkCanvas(W, H);
const xA = offA.getContext('2d'), xB = offB.getContext('2d'), xT = offT.getContext('2d');
function sceneAt(t) { for (const s of SC) if (t >= s[0] && t < s[1]) return s; return SC[SC.length - 1]; }
function look(s) { return Object.assign({}, LOOK0, typeof LOOK === 'undefined' ? {} : LOOK, s && s[3] || {}); }
function drawScene(c2, s, t) { // render scene s at time t into context c2
  const o = ctx; ctx = c2; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = P.dark; ctx.fillRect(0, 0, W, H); camera(); s[2](t); ctx.restore(); ctx = o;
}
function blit(c, o = {}) { // draw an offscreen frame onto ctx with alpha / blur / transform
  ctx.save(); if (o.a != null) ctx.globalAlpha = clamp(o.a); if (o.blur > .3) ctx.filter = `blur(${o.blur * U}px)`;
  if (o.s && o.s !== 1) { const ax = o.at ? o.at[0] : W / 2, ay = o.at ? o.at[1] : H / 2; ctx.translate(ax, ay); ctx.scale(o.s, o.s); ctx.translate(-ax, -ay); }
  ctx.drawImage(c, o.x || 0, o.y || 0); ctx.restore();
}
function mblur(c, dx, dy, n = 9) { // directional motion blur by averaging shifted copies
  xT.save(); xT.setTransform(1, 0, 0, 1, 0, 0); xT.clearRect(0, 0, W, H);
  for (let i = 0; i < n; i++) { xT.globalAlpha = 1 / (i + 1); const f = i / (n - 1) - .5; xT.drawImage(c, dx * f, dy * f); }
  xT.restore(); return offT;
}
const DIRV = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
function transition(t, tr) {
  const [t0, type, d, op = {}] = tr, k = (t - (t0 - d / 2)) / d, prev = SC.find(x => x[1] === t0), next = SC.find(x => x[0] === t0);
  if (!prev || !next) return false;
  if (type === 'cut') { drawScene(ctx, t < t0 ? prev : next, t); return true; }
  drawScene(xA, prev, t); drawScene(xB, next, t);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = P.dark; ctx.fillRect(0, 0, W, H);
  if (type === 'fade') { blit(offA); blit(offB, { a: smooth(k) }); }
  else if (type === 'blur') { const b = Math.sin(k * Math.PI) * (op.blur || 26); blit(offA, { blur: b }); blit(offB, { a: smooth(k), blur: b }); }
  else if (type === 'dip') {
    const col = op.col || '#0c0806';
    if (k < .5) { const u = easeIn(k * 2); blit(offA, { blur: u * 40, s: 1 + u * .04 }); ctx.globalAlpha = u * .96; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
    else { const u = easeOut((k - .5) * 2); blit(offB, { blur: (1 - u) * 40, s: 1.04 - u * .04 }); ctx.globalAlpha = (1 - u) * .96; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
  }
  else if (type === 'whip' || type === 'push') {
    const v = DIRV[op.dir || (PORTRAIT && type === 'push' ? 'up' : 'left')], e = ease(k), sp = Math.sin(k * Math.PI);
    const dx = v[0] * W * e, dy = v[1] * H * e;
    xT.save(); xT.setTransform(1, 0, 0, 1, 0, 0); xT.clearRect(0, 0, W, H); xT.drawImage(offA, dx, dy); xT.drawImage(offB, dx - v[0] * W, dy - v[1] * H); xT.restore();
    if (type === 'whip') { const tmp = mkTmp(); tmp.getContext('2d').drawImage(offT, 0, 0); blit(mblur(tmp, v[0] * sp * W * .35, v[1] * sp * H * .35)); }
    else blit(offT);
  }
  else if (type === 'zoom') {
    const at = op.at || [W / 2, H / 2], z = op.z || 7;
    if (k < .65) { const u = easeIn(k / .65); blit(offA, { s: Math.exp(u * Math.log(z)), at, blur: u * 14 }); }
    const u = smooth(seg(k, .35, 1)); if (u > 0) blit(offB, { a: u, s: lerp(1.5, 1, easeOut(seg(k, .35, 1))), blur: (1 - u) * 18 });
  }
  else if (type === 'burn') {
    blit(offA); blit(offB, { a: smooth(seg(k, .3, .75)) }); const b = Math.sin(k * Math.PI);
    const g = ctx.createRadialGradient(W * .7, H * .3, 0, W * .7, H * .3, Math.hypot(W, H) * (.3 + k * .6));
    g.addColorStop(0, `rgba(255,235,190,${b})`); g.addColorStop(.4, `rgba(255,150,60,${b * .8})`); g.addColorStop(1, 'rgba(120,30,0,0)');
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  else if (type === 'flash') { blit(t < t0 ? offA : offB); ctx.globalAlpha = Math.pow(Math.sin(k * Math.PI), 2); ctx.fillStyle = '#fff8ea'; ctx.fillRect(0, 0, W, H); }
  else blit(t < t0 ? offA : offB);
  ctx.restore(); return true;
}
let _tmp; function mkTmp() { if (!_tmp) _tmp = mkCanvas(W, H); const g = _tmp.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); return _tmp; }
// ---------- talking-head speaker: full screen <-> small circle at the bottom centre <-> off, per scene ----------
const hasSpk = () => typeof SPEAKER !== 'undefined';
const spkMode = s => (s && s[3] && s[3].spk) || 'circle';
function spkCircle() { const c = Object.assign({ x: .5, y: pick(.8, .79), d: pick(.42 * W, .34 * H) }, typeof SPKC === 'undefined' ? {} : SPKC); return { cx: c.x * W, cy: c.y * H, d: c.d }; }
const spkTop = () => { const c = spkCircle(); return c.cy - c.d / 2; }; // keep faces / key words above this y
function spkState(t, morph = .45) { // {f: 0 circle .. 1 full screen, v: 0 hidden .. 1 shown}
  const val = m => m === 'full' ? [1, 1] : m === 'off' ? [0, 0] : [0, 1];
  const i = SC.indexOf(sceneAt(t)); let [f, v] = val(spkMode(SC[i]));
  const b0 = SC[i][0], b1 = SC[i][1];
  if (i > 0 && t < b0 + morph) { const [pf, pv] = val(spkMode(SC[i - 1])), k = smooth(.5 + (t - b0) / (2 * morph)); f = lerp(pf, f, k); v = lerp(pv, v, k); }
  if (i < SC.length - 1 && t > b1 - morph) { const [nf, nv] = val(spkMode(SC[i + 1])), k = smooth(.5 - (b1 - t) / (2 * morph)); f = lerp(f, nf, k); v = lerp(v, nv, k); }
  return { f, v };
}
function drawSpeaker(t) {
  if (!hasSpk()) return; const { f, v } = spkState(t); if (v <= .002) return;
  const im = clipFrame(SPEAKER.clip, t); if (!im) return;
  const c = spkCircle(), d = c.d * lerp(.6, 1, easeOut(v)) , e = ease(f);
  const x = lerp(c.cx - d / 2, 0, e), y = lerp(c.cy - d / 2, 0, e), w = lerp(d, W, e), h = lerp(d, H, e), r = lerp(d / 2, 0, e);
  // source crop: whole frame (cover) when full, a square around the face (head + shoulders) in the circle
  const iw = im.width, ih = im.height, fc = SPEAKER.face || [.5, .38, .28], cs = Math.max(W / iw, H / ih);
  const fullW = W / cs, fullH = H / cs, fullX = clamp(fc[0] * iw - fullW / 2, 0, iw - fullW), fullY = clamp(fc[1] * ih - fullH / 2, 0, ih - fullH);
  const side = Math.min(iw, ih, fc[2] * iw * 2.3), cirX = clamp(fc[0] * iw - side / 2, 0, iw - side), cirY = clamp(fc[1] * ih - side * .42, 0, ih - side);
  const sh = Math.min(ih, lerp(side, fullH, e)), sw = Math.min(iw, sh * w / h); // same aspect as the box: no stretching while it morphs
  const sx = clamp(lerp(cirX + side / 2, fullX + fullW / 2, e) - sw / 2, 0, iw - sw), sy = clamp(lerp(cirY, fullY, e), 0, ih - sh);
  ctx.save(); ctx.globalAlpha = clamp(v * 1.5);
  if (e < .98) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40 * U; ctx.shadowOffsetY = 12 * U; ctx.fillStyle = P.dark; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h); ctx.restore();
  if (e < .98) { ctx.strokeStyle = rgba(P.cream, .9 * (1 - e)); ctx.lineWidth = 6 * U; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke(); }
  ctx.restore();
}
function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  const s = sceneAt(t); let done = false;
  for (const tr of TR) { const [t0, , d] = tr; if (t >= t0 - d / 2 && t < t0 + d / 2) { done = transition(t, tr); if (done) break; } }
  if (!done) drawScene(ctx, s, t);
  // the speaker keeps the video's own colours (no grade / grain on top) unless the episode sets SPKGRADE = true
  const graded = typeof SPKGRADE !== 'undefined' && SPKGRADE;
  if (!graded) { ctx.save(); filmFinish(t, look(s)); ctx.restore(); }
  drawSpeaker(t);
  if (s[3] && s[3].over) { ctx.save(); camera(); s[3].over(t); ctx.restore(); }
  if (graded) { ctx.save(); filmFinish(t, look(s)); ctx.restore(); }
}
function spkShare() { // seconds per speaker mode, for render.js info
  const r = { full: 0, circle: 0, off: 0 }; if (!hasSpk()) return null;
  for (const s of SC) r[spkMode(s)] += Math.max(0, Math.min(s[1], END) - s[0]);
  for (const k in r) r[k] = Math.round(r[k] / END * 100); return r;
}

// ---------- hooks used by tools/render.js ----------
window.ready = async () => { loadAssets(); await Promise.all([document.fonts.load('40px PlexB'), document.fonts.load('40px PlexM'), document.fonts.load('40px PlexS'), document.fonts.load('italic 700 40px "Times New Roman"'), document.fonts.load('italic 700 40px Sathu', 'ก'), ..._loads]); return { W, H, FMT, missing: MISSING, noalpha: NOALPHA }; };
window.meta = () => ({ end: END, W, H, FMT, speaker: spkShare(), scenes: SC.map(s => [s[0], s[1], s[2].name]), transitions: TR.map(r => [r[0], r[1], r[2]]), missing: MISSING, noalpha: NOALPHA });
// image worksheet data for tools/worksheet.js (prompts.html / prompts.md / out/assets.json)
window.promptData = () => ({ W, H, FMT, title: typeof TITLE === 'undefined' ? '' : TITLE, style: typeof STYLE === 'undefined' ? '' : STYLE,
  chars: typeof CHARS === 'undefined' ? {} : CHARS, assets: assetList().map(a => Object.assign(a, { status: MISSING.includes(a.name) ? 'missing' : NOALPHA.includes(a.name) ? 'noalpha' : 'ok' })) });
window.frameJPEG = async (t, q) => { frame(t); for (let i = 0; i < 3 && _need.size; i++) { await loadNeeded(); frame(t); } return cv.toDataURL('image/jpeg', q); };
window.coverJPEG = q => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.save(); camera(); cover(); ctx.restore(); return cv.toDataURL('image/jpeg', q); };
// cue scan for tools/audio.py: appear()/words() -> 'soft', stamp() -> 'thud', marker*() -> 'marker', every transition -> its whoosh
function autoMusic() { const M = ['mystery', 'tension', 'mystery', 'drive']; return SC.map((s, i) => [s[0], Math.min(s[1], END), i === 0 ? 'intro' : i === SC.length - 1 ? 'outro' : M[(i - 1) % M.length]]); }
const TRSND = { cut: 'none', fade: 'whoosh_soft', blur: 'whoosh_soft', dip: 'whoosh_deep', whip: 'whoosh_big', push: 'whoosh', zoom: 'whoosh_zoom', burn: 'whoosh_long', flash: 'hit' };
window.cueScan = (step = .1) => {
  CUELOG.clear(); CUESCAN = true;
  for (let t = 0; t < END; t += step) { const s = sceneAt(t); camera(); try { drawScene(xA, s, t); } catch (e) { } }
  CUESCAN = false;
  const C = typeof CUES === 'undefined' ? {} : CUES, mute = C.mute || [];
  let ev = [...CUELOG.values()].filter(([x]) => x >= 0 && x < END - .2 && !mute.some(m => Math.abs(m - x) < .05)).sort((a, b) => a[0] - b[0]);
  ev = ev.filter((e, i) => i === 0 || e[1] !== ev[i - 1][1] || e[0] - ev[i - 1][0] > .12);
  const tr = TR.map(r => { const snd = (r[3] && r[3].snd) || TRSND[r[1]] || 'whoosh'; return [Math.max(0, r[0] - r[2] * .45), snd, r[2]]; }).filter(r => r[1] !== 'none');
  return { end: END, events: ev, transitions: tr, music: C.music || autoMusic(), sfx: C.sfx || [] };
};
