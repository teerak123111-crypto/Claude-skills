// Renders an engine folder (index.html + format.js + kit/ + episode.js + assets/) with headless Chromium.
//   node render.js ENGINE end                          print END (seconds)
//   node render.js ENGINE info                         format, size, scenes, assets still missing (placeholders)
//   node render.js ENGINE snap OUTDIR t1,t2,...        stills s0012.50.jpg ...
//   node render.js ENGINE video OUT.mp4 F0 F1 [fps]    frames F0..F1-1 -> mp4 (crf 16, re-encoded later by finish.sh)
//   node render.js ENGINE cover OUT.jpg                thumbnail from cover()
//   node render.js ENGINE cues OUT.json                sound cues for audio.py
//   node render.js ENGINE prompts WORK                 image worksheet WORK/prompts.html + prompts.md + WORK/out/assets.json
// FMT=16:9 (or 9:16) env var overrides engine/format.js for this run.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
(async () => {
  const eng = path.resolve(process.argv[2]), mode = process.argv[3], a = process.argv.slice(4);
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] }); // file:// images must not taint the canvas
  const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (!/Failed to load resource/.test(m.text())) console.log('LOG', m.text()); }); // missing assets are reported once as PLACEHOLDER
  await p.goto('file://' + path.join(eng, 'index.html') + (process.env.FMT ? '?fmt=' + encodeURIComponent(process.env.FMT) : ''));
  const info = await p.evaluate(() => window.ready());
  if (info.missing.length && mode !== 'end') console.log(`PLACEHOLDER ${info.missing.length} assets: ${info.missing.join(', ')}`);
  if (info.noalpha.length && mode !== 'end') console.log(`NOALPHA ${info.noalpha.length} cut-outs still have a background (oval fallback): ${info.noalpha.join(', ')}`);
  const jpg = (file, d) => fs.writeFileSync(file, Buffer.from(d.split(',')[1], 'base64'));
  if (mode === 'end') console.log((await p.evaluate(() => window.meta())).end);
  else if (mode === 'info') {
    const m = await p.evaluate(() => window.meta()); console.log(JSON.stringify(m, null, 1));
    if (m.speaker) { const s = m.speaker, ok = s.full >= 5 && s.full <= 15 && s.circle >= 60 && s.circle <= 90;
      console.log(`SPEAKER full ${s.full}% circle ${s.circle}% off ${s.off}%` + (ok ? ' (ok)' : '  <- aim for full ~10%, circle 60-90%, off the rest')); }
  }
  else if (mode === 'prompts') {
    const r = require('./worksheet.js').build(await p.evaluate(() => window.promptData())), W = path.resolve(a[0] || path.join(eng, '..'));
    fs.mkdirSync(path.join(W, 'out'), { recursive: true }); fs.mkdirSync(path.join(W, 'images'), { recursive: true });
    fs.writeFileSync(path.join(W, 'prompts.html'), r.html); fs.writeFileSync(path.join(W, 'prompts.md'), r.md); fs.writeFileSync(path.join(W, 'out', 'assets.json'), JSON.stringify(r.json, null, 1));
    console.log('worksheet', path.join(W, 'prompts.html'), r.json.assets.length, 'images,', r.json.assets.filter(x => x.status === 'ok').length, 'done');
  }
  else if (mode === 'cover') jpg(a[0], await p.evaluate(() => window.coverJPEG(.95)));
  else if (mode === 'cues') { const c = await p.evaluate(() => window.cueScan()); fs.writeFileSync(a[0], JSON.stringify(c, null, 1)); console.log(c.events.length, 'events,', c.transitions.length, 'transitions,', c.sfx.length, 'extra sfx'); }
  else if (mode === 'snap') {
    fs.mkdirSync(a[0], { recursive: true });
    for (const t of a[1].split(',').map(Number)) jpg(`${a[0]}/s${t.toFixed(2).padStart(7, '0')}.jpg`, await p.evaluate(t => window.frameJPEG(t, .9), t));
  } else if (mode === 'video') {
    const [out, f0, f1] = [a[0], +a[1], +a[2]], fps = +(a[3] || 30);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const T0 = Date.now();
    for (let f = f0; f < f1; f++) {
      const d = await p.evaluate(t => window.frameJPEG(t, .94), f / fps);
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('done', out, (Date.now() - T0) / 1000 + 's');
  } else console.log('unknown mode', mode);
  await b.close();
})();
