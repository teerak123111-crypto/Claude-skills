// ---------- kit/fx.js: film finish (grain, paper, dust, grade, vignette), atmosphere (fog, leaks, rays) and
// evidence-board graphics drawn in code (paper cards, documents, photos, pins, tape, red string, marker, stamps) ----------

// ---------- film finish: applied by stage.js after every frame, settings from LOOK (episode) ----------
const LOOK0 = { grain: .14, paper: .16, dust: .35, vignette: .5, grade: 'warm', fade: .5, flicker: .025 };
function grainTex(i) {
  return cached('grain' + i, W / 2, H / 2, (w, h) => {
    const d = ctx.createImageData(w, h), R = rng(91 + i), a = d.data;
    for (let k = 0; k < a.length; k += 4) { const v = 128 + (R() + R() + R() - 1.5) * 120; a[k] = a[k + 1] = a[k + 2] = v; a[k + 3] = 255; }
    ctx.putImageData(d, 0, 0);
  });
}
function grain(t, a) {
  if (a <= 0) return; const f = Math.floor(t * 12), i = f % 6, R = rng(i * 13 + f), c = grainTex(i); // 12 grain changes/s: filmic + keeps the mp4 small
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = a; ctx.imageSmoothingEnabled = false;
  const ox = -R() * 40, oy = -R() * 40; ctx.drawImage(c, ox, oy, W + 80, H + 80); ctx.restore();
}
function paperTex(seed = 1, base = P.paper, k = 1) { // aged-paper texture, full frame, cached; k = blotch strength
  return cached('paper' + seed + base + k, W, H, (w, h) => {
    const R = rng(seed * 7 + 1); ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (const [n, sc, al0] of [[14, 4, .12], [60, 2, .1], [220, 1, .07]]) { // blotches at 3 scales
      const al = al0 * k;
      for (let i = 0; i < n; i++) { const x = R() * w, y = R() * h, r = (80 + R() * 160) * sc * U;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r), dark = R() < .6; g.addColorStop(0, dark ? `rgba(90,60,30,${al})` : `rgba(255,248,230,${al})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); } }
    ctx.globalAlpha = .07; ctx.strokeStyle = '#5a3c20'; ctx.lineWidth = 1; // fibres
    for (let i = 0; i < 900; i++) { const x = R() * w, y = R() * h, l = 6 + R() * 26, an = R() * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); ctx.stroke(); }
    ctx.globalAlpha = .25; ctx.fillStyle = '#4a2f18'; for (let i = 0; i < 2500; i++) { ctx.fillRect(R() * w, R() * h, 1 + R() * 1.6, 1 + R() * 1.6); }
    ctx.globalAlpha = 1; const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75); // burnt edges
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(70,40,15,.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  });
}
function paperOverlay(a, seed = 1) { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a; ctx.drawImage(paperTex(seed), 0, 0); ctx.restore(); }
function dust(t, a) {
  if (a <= 0) return; const f = Math.floor(t * 12), R = rng(f * 7 + 3);
  ctx.save(); ctx.globalAlpha = a;
  for (let i = 0; i < 14; i++) { ctx.fillStyle = R() < .7 ? 'rgba(30,20,12,.7)' : 'rgba(255,245,225,.7)'; ctx.beginPath(); ctx.ellipse(R() * W, R() * H, (1 + R() * 3) * U, (1 + R() * 2) * U, R() * 3, 0, TAU); ctx.fill(); }
  if (R() < .35) { ctx.strokeStyle = 'rgba(30,20,12,.5)'; ctx.lineWidth = 1.2 * U; const x = R() * W, y = R() * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 20 * U, y + 30 * U, x - 10 * U, y + 50 * U, x + 15 * U, y + 80 * U); ctx.stroke(); }
  if (R() < .25) { ctx.fillStyle = 'rgba(255,240,215,.25)'; ctx.fillRect(R() * W, 0, 1.5 * U, H); } // vertical scratch
  ctx.restore();
}
function vignette(a = .5, col = '#0b0705') {
  if (a <= 0) return; const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .58);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, a)); ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
const GRADES = { // [desaturate, soft-light tint, tint alpha, lifted-black colour]
  warm: [.25, '#c9935a', .35, '#24170e'], sepia: [.6, '#b98a55', .55, '#2a1a0e'], noir: [.85, '#8a7a6a', .2, '#141210'],
  cold: [.35, '#5b7896', .35, '#0f1418'], none: [0, '#808080', 0, '#000000']
};
function grade(name, fade = .5) {
  const g = GRADES[name] || GRADES.warm; ctx.save();
  if (g[0]) { ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = g[0]; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); }
  if (g[2]) { ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = g[2]; ctx.fillStyle = g[1]; ctx.fillRect(0, 0, W, H); }
  if (fade) { ctx.globalCompositeOperation = 'lighten'; ctx.globalAlpha = fade; ctx.fillStyle = g[3]; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
function filmFinish(t, L) {
  grade(L.grade, L.fade); paperOverlay(L.paper, L.paperSeed || 1); grain(t, L.grain); dust(t, L.dust); vignette(L.vignette);
  if (L.flicker) { const f = noise1(t * 9, 4) * L.flicker; ctx.save(); ctx.globalAlpha = Math.abs(f); ctx.fillStyle = f > 0 ? '#fff4e0' : '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// ---------- atmosphere ----------
function puff(seed) { // soft cloud sprite
  return cached('puff' + seed, 512, 384, (w, h) => {
    const R = rng(seed);
    for (let i = 0; i < 26; i++) { const x = w * (.2 + R() * .6), y = h * (.3 + R() * .45), r = w * (.08 + R() * .16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  });
}
// fog(t, a, {seed, n, col, d, speed:[vx,vy], y0, y1, size}) drifting fog puffs (tinted), drawn in a depth layer
function fog(t, a, o = {}) {
  if (a <= 0) return; const R = rng(o.seed || 5), n = o.n || 14, sp = o.speed || [30, -6], sz = (o.size || 1) * U, y0 = (o.y0 != null ? o.y0 : 0) * H, y1 = (o.y1 != null ? o.y1 : 1) * H;
  const col = o.col || '#efe3cc';
  layer(o.d != null ? o.d : 1.4, () => {
    ctx.save(); ctx.globalAlpha = a;
    for (let i = 0; i < n; i++) {
      const w = (700 + R() * 900) * sz, h = w * .7, span = W + w * 2, x = ((R() * span + t * sp[0] * (.6 + R() * .8) * U) % span + span) % span - w, y = lerp(y0, y1, R()) - h / 2 + t * sp[1] * U;
      const c = cached('puffc' + (i % 5) + col, 512, 384, (cw, ch) => { ctx.drawImage(puff(i % 5 + 1), 0, 0); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = col; ctx.fillRect(0, 0, cw, ch); });
      ctx.drawImage(c, x, y, w, h);
    }
    ctx.restore();
  });
}
// leak(t, a, x, y, r, col) warm light leak (screen), slowly breathing
function leak(t, a, x = W * .85, y = H * .1, r = 900, col = '#ffb25c') {
  if (a <= 0) return; const k = 1 + noise1(t * .6, 3) * .15, g = ctx.createRadialGradient(x, y, 0, x, y, r * U * k);
  g.addColorStop(0, rgba(col, .75)); g.addColorStop(.4, rgba(col, .25)); g.addColorStop(1, rgba(col, 0));
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
// rays(t, a, x, y, ang, spread, len, col) god rays from a window / lamp
function rays(t, a, x, y, ang = Math.PI / 2, spread = .5, len = 1600, col = '#ffd59a', n = 9, seed = 2) {
  if (a <= 0) return; const R = rng(seed); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${14 * U}px)`;
  for (let i = 0; i < n; i++) {
    const an = ang + (R() - .5) * spread, w = (.02 + R() * .05), L = len * U * (.6 + R() * .4), al = a * (.25 + .25 * (noise1(t * .5 + i, seed) + 1));
    const g = ctx.createLinearGradient(x, y, x + Math.cos(an) * L, y + Math.sin(an) * L); g.addColorStop(0, rgba(col, al)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an - w) * L, y + Math.sin(an - w) * L); ctx.lineTo(x + Math.cos(an + w) * L, y + Math.sin(an + w) * L); ctx.fill();
  }
  ctx.restore();
}
function motes(t, a, o = {}) { // dust motes floating in a light beam
  if (a <= 0) return; const R = rng(o.seed || 8), n = o.n || 60, box = o.box || [0, 0, W, H];
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) { const x = box[0] + ((R() * box[2] + t * (8 + R() * 14) * U) % box[2]), y = box[1] + ((R() * box[3] - t * (4 + R() * 10) * U) % box[3] + box[3]) % box[3], r = (1 + R() * 2.5) * U;
    ctx.globalAlpha = a * (.3 + .7 * Math.abs(Math.sin(t * (1 + R()) + i))); ctx.fillStyle = '#fff1d6'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------- backgrounds drawn in code ----------
function paperCard(seed = 3, base = P.card) { ctx.drawImage(paperTex(seed, base, .6), 0, 0); }
function cork(seed = 4) {
  ctx.drawImage(cached('cork' + seed, W, H, (w, h) => {
    const R = rng(seed); ctx.fillStyle = P.cork; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 40; i++) { const v = R(); ctx.fillStyle = v < .5 ? `rgba(80,45,20,${.15 + R() * .3})` : `rgba(230,180,120,${.1 + R() * .25})`; ctx.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); }
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .2, w / 2, h / 2, Math.max(w, h) * .7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,5,.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }), 0, 0);
}

// ---------- evidence-board graphics ----------
function dropShadow(fn, blur = 22, dx = 8, dy = 14, a = .45) { ctx.save(); ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur * U; ctx.shadowOffsetX = dx * U; ctx.shadowOffsetY = dy * U; fn(); ctx.restore(); }
// doc(x, y, w, h, {rot, seed, title, lines, stamp, sign, base}) aged typed document centred at x,y
function doc(x, y, w, h, o = {}) {
  const seed = o.seed || 1, key = ['doc', seed, Math.round(w), Math.round(h), o.title || '', o.base || ''].join(':');
  const c = cached(key, w, h, (cw, ch) => {
    const R = rng(seed); ctx.fillStyle = o.base || '#efe6d2'; ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 10; i++) { const x0 = R() * cw, y0 = R() * ch, r = cw * (.2 + R() * .4), g = ctx.createRadialGradient(x0, y0, 0, x0, y0, r); g.addColorStop(0, `rgba(150,110,60,${.08 + R() * .1})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch); }
    const e = ctx.createLinearGradient(0, 0, cw, 0); e.addColorStop(0, 'rgba(120,80,40,.25)'); e.addColorStop(.08, 'rgba(0,0,0,0)'); e.addColorStop(.92, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(120,80,40,.25)'); ctx.fillStyle = e; ctx.fillRect(0, 0, cw, ch);
    const m = cw * .1; let yy = ch * .1;
    if (o.title) { ctx.fillStyle = '#2b241d'; ctx.font = `700 ${cw * .07}px "Times New Roman", Sathu, Thonburi, serif`; ctx.textAlign = 'center'; ctx.fillText(o.title, cw / 2, yy + cw * .05); yy += cw * .13;
      ctx.fillRect(m, yy - cw * .03, cw - 2 * m, 1.5); }
    ctx.fillStyle = 'rgba(43,36,29,.55)'; const lh = cw * .042, n = o.lines || Math.floor((ch * .78 - yy) / lh);
    for (let i = 0; i < n && yy < ch * .85; i++) { const para = R() < .12; if (para) { yy += lh * .6; continue; } const lw = (cw - 2 * m) * (R() < .15 ? .3 + R() * .4 : .85 + R() * .15);
      let xx = m; while (xx < m + lw) { const ww = cw * (.02 + R() * .07); ctx.fillRect(xx, yy, Math.min(ww, m + lw - xx), lh * .32); xx += ww + cw * .012; } yy += lh; }
    if (o.sign !== false) { ctx.strokeStyle = 'rgba(30,30,70,.7)'; ctx.lineWidth = 2; ctx.beginPath(); const sx = cw * .6, sy = ch * .9; ctx.moveTo(sx, sy); for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(sx + i * cw * .03 + cw * .015, sy - cw * (.04 * R()), sx + (i + 1) * cw * .03, sy + cw * .01 * (R() - .5)); ctx.stroke(); }
  });
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); dropShadow(() => ctx.drawImage(c, -w / 2, -h / 2)); ctx.restore();
}
// photo(name, x, y, w, {ar, rot, border, filter, focus, a, caption}) printed photo with white border (name = asset)
function photo(name, x, y, w, o = {}) {
  const im = img(name), ar = o.ar || 1.25, h = w * ar, b = (o.border != null ? o.border : .06) * w, iw = w - 2 * b, ih = h - 2 * b - (o.caption ? w * .12 : 0);
  const sc = Math.max(iw / im.width, ih / im.height), fc = o.focus || [.5, .4], sw = iw / sc, sh = ih / sc;
  const sx = clamp(fc[0] * im.width - sw / 2, 0, im.width - sw), sy = clamp(fc[1] * im.height - sh / 2, 0, im.height - sh);
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); if (o.a != null) ctx.globalAlpha *= o.a;
  dropShadow(() => { ctx.fillStyle = P.photo; ctx.fillRect(-w / 2, -h / 2, w, h); });
  ctx.filter = o.filter || 'grayscale(1) sepia(.35) contrast(1.1)'; ctx.drawImage(im, sx, sy, sw, sh, -w / 2 + b, -h / 2 + b, iw, ih); ctx.filter = 'none';
  if (o.caption) { ctx.fillStyle = '#2b241d'; ctx.font = `italic ${w * .07}px "Times New Roman", Sathu, Thonburi, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.caption, 0, h / 2 - w * .09); }
  ctx.restore();
}
function pin(x, y, col = '#c0272d', r = 16) {
  r *= U; ctx.save(); dropShadow(() => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }, 8, 4, 6, .5);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x - r * .35, y - r * .35, r * .3, 0, TAU); ctx.fill(); ctx.restore();
}
function tape(x, y, w = 160, ang = -.3) {
  w *= U; const h = w * .32; ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = P.tape; ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2); for (let i = 0; i <= 6; i++) ctx.lineTo(-w / 2 + (i % 2 ? 4 : -2) * U, -h / 2 + h * i / 6); ctx.lineTo(w / 2, h / 2);
  for (let i = 6; i >= 0; i--) ctx.lineTo(w / 2 + (i % 2 ? -4 : 2) * U, -h / 2 + h * i / 6); ctx.fill(); ctx.restore();
}
// red string between two pins, p = 0..1 how much is drawn
function string(x0, y0, x1, y1, p = 1, sag = .08, col = '#b5151c') {
  if (p <= 0) return; const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + Math.hypot(x1 - x0, y1 - y0) * sag, N = 40;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4 * U; ctx.lineCap = 'round'; dropShadow(() => { ctx.beginPath();
    for (let i = 0; i <= N * p; i++) { const k = i / N, x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * mx + k * k * x1, y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * my + k * k * y1; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); }, 6, 3, 6, .4); ctx.restore();
}
// ---------- red marker (hand-drawn, animated) ----------
// marker(pts, p, {w, col, t0}) draws polyline pts up to fraction p of its length; t0 registers a 'marker' sound
function marker(pts, p, o = {}) {
  if (o.t0 != null) cue(o.t0, 'marker'); if (p <= 0) return;
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const lim = L[L.length - 1] * clamp(p), w = (o.w || 9) * U;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = o.col || P.redInk; ctx.globalAlpha *= .92;
  for (const [lw, al, off] of [[w, 1, 0], [w * .45, .35, w * .2]]) {
    ctx.lineWidth = lw; ctx.globalAlpha = al * .92; ctx.beginPath(); ctx.moveTo(pts[0][0] + off, pts[0][1]);
    for (let i = 1; i < pts.length; i++) { if (L[i] > lim) { const k = (lim - L[i - 1]) / (L[i] - L[i - 1]); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k) + off, lerp(pts[i - 1][1], pts[i][1], k)); break; } ctx.lineTo(pts[i][0] + off, pts[i][1]); }
    ctx.stroke();
  }
  ctx.restore();
}
// markerCircle(t, t0, dur, cx, cy, rx, ry, {seed, w}) the reference's loose loop that overshoots into a tail
function markerCircle(t, t0, dur, cx, cy, rx, ry, o = {}) {
  const R = rng(o.seed || 3), a0 = -2.6 + R() * .4, pts = [], N = 90, ph = R() * 9;
  for (let i = 0; i <= N; i++) { const k = i / N, an = a0 + k * TAU * 1.12, rr = 1 + .06 * noise1(k * 6 + ph) + k * .08; pts.push([cx + Math.cos(an) * rx * rr, cy + Math.sin(an) * ry * rr]); }
  const e = pts[N], an = a0 + TAU * 1.12; pts.push([e[0] + Math.cos(an + 1.3) * rx * .35, e[1] + Math.sin(an + 1.3) * ry * .35]);
  marker(pts, easeOut(seg(t, t0, t0 + dur)), { ...o, t0 });
}
function markerUnderline(t, t0, dur, x0, x1, y, o = {}) { const R = rng(o.seed || 5), pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20; pts.push([lerp(x0, x1, k), y + noise1(k * 4, o.seed || 5) * 5 * U + k * 6 * U * (R() - .3)]); } marker(pts, easeOut(seg(t, t0, t0 + dur)), { ...o, t0 }); }
function markerX(t, t0, dur, cx, cy, s, o = {}) { const k = seg(t, t0, t0 + dur); marker([[cx - s, cy - s], [cx + s * .9, cy + s * 1.05]], easeOut(k * 2), { ...o, t0 }); marker([[cx + s, cy - s * .9], [cx - s * .95, cy + s]], easeOut(k * 2 - 1), o); }
function markerArrow(t, t0, dur, x0, y0, x1, y1, o = {}) {
  const k = seg(t, t0, t0 + dur), mx = (x0 + x1) / 2 + (y1 - y0) * .2, my = (y0 + y1) / 2 - (x1 - x0) * .2, pts = [];
  for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1]); }
  marker(pts, easeOut(k * 1.3), { ...o, t0 }); const an = Math.atan2(y1 - pts[17][1], x1 - pts[17][0]), hl = 40 * U;
  const hk = seg(k, .75, 1); marker([[x1 - Math.cos(an - .5) * hl, y1 - Math.sin(an - .5) * hl], [x1, y1], [x1 - Math.cos(an + .5) * hl, y1 - Math.sin(an + .5) * hl]], hk, o);
}
// highlighter swipe over a line of text / a region
function highlight(x, y, w, h, p, col = P.hl) { if (p <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .75; ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w * clamp(p), h, h * .2); ctx.fill(); ctx.restore(); }
function redact(x, y, w, h, p) { if (p <= 0) return; ctx.save(); ctx.fillStyle = '#121010'; ctx.fillRect(x, y, w * clamp(p), h); ctx.restore(); }
// stamp(t, t0, x, y, text, {size, rot, col}) rubber stamp that slams in (sound 'thud')
function stamp(t, t0, x, y, s, o = {}) {
  const r = appear(t, t0, 'slam', .35, 'thud'); if (r.a <= 0) return; const sz = (o.size || 60) * U, col = o.col || P.redInk;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot != null ? o.rot : -.18); ctx.scale(r.s, r.s); ctx.globalAlpha *= r.a * .9;
  ctx.font = FONT.sans(sz); const w = ctx.measureText(s).width + sz * .9, h = sz * 1.5;
  ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = col; ctx.lineWidth = sz * .09; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.lineWidth = sz * .04; ctx.strokeRect(-w / 2 + sz * .14, -h / 2 + sz * .14, w - sz * .28, h - sz * .28);
  roughText(s, 0, 0, FONT.sans(sz), col, 1, 0, .8); ctx.restore();
}
// lower caption (optional, the reference has none): sub(text, a, {y, size})
function sub(s, a = 1, o = {}) { if (a <= 0) return; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 16 * U; txt(s, W / 2, o.y || H * pick(.78, .88), o.size || 46, P.white, 'semi', 'center', a); ctx.restore(); }
