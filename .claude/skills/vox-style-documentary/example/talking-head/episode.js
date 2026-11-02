// ---------- example/talking-head/episode.js: the narrator talks on camera, Vox graphics behind a small face circle ----------
// Prepare the video first:  python3 tools/speaker.py talk.mp4 WORK   (writes engine/speaker.js = SPEAKER, frames, vo-tight.wav,
// images/speaker_ref.jpg). Speaker per scene (SC opts.spk): 'full' ≈ 10 % of the clip (hook + ending), 'circle' 60-90 %,
// 'off' for the rest (paper card, evidence board, the big reveal). The circle sits at the bottom centre and covers the
// subject's legs, so faces and words stay above spkTop().
// Times are written for a ~30 s talk and scaled to the real video length (k); in a real episode use words.json times.
const TITLE = 'ผมตามหาชายที่หายไปกลางฟ้า';
const STYLE = 'Cinematic documentary photograph, 1971, warm muted sepia palette, soft motivated light, shallow depth of field, realistic, high detail';
// characters: the narrator himself (face from his own video) and a real person the story is about (a photo the user finds)
const CHARS = {
  me:     { ref: 'speaker', who: 'ผู้พูด', desc: 'the narrator from the attached photo, wearing a 1970s field jacket' },
  cooper: { ref: 'photo', who: 'D.B. Cooper (ภาพสเก็ตช์ FBI ปี 1971)', desc: 'the man from the attached FBI sketch, dark suit, thin black tie, dark sunglasses' },
};
const ASSETS = {
  sky:     { shot: 'ช็อต 2', note: 'ท้องฟ้าเหนือเมฆ', text: 'top', prompt: 'A sea of clouds at sunset seen from above, golden haze, empty sky' },
  plane:   { shot: 'ช็อต 2', note: 'เครื่องบิน 727 (ไดคัท)', cut: true, prompt: 'A 1971 Boeing 727 airliner in flight, side three-quarter view' },
  airport: { shot: 'ช็อต 3', note: 'ลานบินกลางคืน', text: 'top', prompt: 'Rainy airport apron at night in 1971, wet tarmac reflections, boarding stairs to a Boeing 727, warm sodium lights' },
  cooper:  { shot: 'ช็อต 3', note: 'คูเปอร์ยืนเต็มตัว (ไดคัท)', cut: true, char: 'cooper', prompt: 'Full body portrait of the man standing, raincoat over one arm, holding a briefcase' },
  sketch:  { shot: 'ช็อต 4', note: 'ภาพสเก็ตช์บนบอร์ด', photo: true, char: 'cooper', prompt: 'Police composite pencil sketch of the man, 1971 FBI wanted poster style, black and white drawing on paper' },
  cabin:   { shot: 'ช็อต 5', note: 'ห้องโดยสารยุค 70', text: 'top', prompt: 'Dim 1970s airliner cabin interior at night, rows of seats, small window lights, light smoke haze' },
  money:   { shot: 'ช็อต 5', note: 'ถุงเงิน (ไดคัท)', cut: true, prompt: 'A canvas bank bag overflowing with stacks of 1971 twenty dollar bills' },
  forest:  { shot: 'ช็อต 7', note: 'ป่าสนริมแม่น้ำ', text: 'top', prompt: 'Misty pine forest on a river bank in Washington state, overcast morning, wet ferns' },
  meWalk:  { shot: 'ช็อต 7', note: 'ผู้พูดในชุดนักสำรวจ (ไดคัท)', cut: true, char: 'me', prompt: 'Full body portrait of the narrator as a 1970s investigator, holding a flashlight and an old map, looking to the side' },
};
const END = typeof SPEAKER !== 'undefined' ? Math.max(10, SPEAKER.dur) : 30, k = END / 30, T = x => x * k;
const LOOK = { grade: 'warm', grain: .14, paper: .14, dust: .3, vignette: .45 };

function sHook(t) { ctx.fillStyle = P.dark; ctx.fillRect(0, 0, W, H); } // under the full-screen speaker
function hookWords(t) { // drawn over the full-screen speaker (SC opts.over)
  words(t, [['ชายที่หายไป', T(.4), 'sans', .8], ['กลางฟ้า', T(.9), 'serifI']], { y: H * pick(.2, .22), size: pick(150, 120), shadow: .5, a: vanish(t, T(2.2), .3) });
}
function sSky(t) {
  camMove(t, T(2.4), T(6.5), [0, -160 * U, 1.1], [0, 40 * U, 1.0]); drift(t, 5);
  plate('sky', { d: .4, over: 1.3 });
  words(t, [['ปี', T(3), 'sans', .55], ['1971', T(3.3), 'sans', 1.25]], { y: H * pick(.24, .28), size: pick(220, 180), d: .6 });
  const r = appear(t, T(3.6), 'rise', 1.2, null);
  cut('plane', W * .5 + (t - T(3.6)) * 40 * U, H * pick(.55, .6) + r.dy, H * pick(.2, .36), { d: 1, a: r.a, anchor: [.5, .5] });
  fog(t, .5 * (1 - seg(t, T(2.6), T(4.5))), { n: 12, d: 1.6, y0: .2, y1: .8 });
}
function sCooper(t) { // the circle covers his legs, name above his head
  camMove(t, T(6.5), T(11), [0, 0, 1.0], [0, -30 * U, 1.1]); drift(t, 4, 3);
  plate('airport', { d: .45, blur: 3 }); rays(t, .4, W * .82, -40 * U, 2.1, .5, 2200, '#ffd7a0');
  words(t, [['แดน คูเปอร์', T(7.4), 'serifI']], { y: H * pick(.13, .12), size: pick(110, 90), d: .9 });
  const g = appear(t, T(6.8), 'grow', 1.0, null);
  cut('cooper', W * .5, H * pick(.95, .98), H * pick(.74, .82) * g.s, { d: 1, a: g.a, shadow: .8 });
}
function sBoard(t) { // speaker off: the board needs the whole frame
  camMove(t, T(11), T(14.5), [0, 0, 1.0], [30 * U, -30 * U, 1.14]);
  layer(.6, () => cork());
  layer(.85, () => {
    const dw = W * pick(.62, .34), dx = W * pick(.45, .4), dy = H * pick(.42, .48), px = W * pick(.72, .66), py = H * pick(.7, .55), pw = W * pick(.34, .2);
    doc(dx, dy, dw, dw * 1.35, { rot: -.04, seed: 7, title: 'WANTED BY THE FBI' });
    photo('sketch', px, py, pw, { rot: .09, caption: 'D.B. Cooper' }); pin(dx, dy - dw * .64); pin(px, py - pw * .6);
    string(dx, dy - dw * .64, px, py - pw * .6, ease(seg(t, T(11.6), T(12.4))));
    markerCircle(t, T(12.5), .8, dx, dy - dw * .3, dw * .38, dw * .12, { seed: 4 });
    stamp(t, T(13.4), dx - dw * .1, dy + dw * .45, 'ยังไม่ปิดคดี', { size: 54 });
  });
}
function sMoney(t) {
  camMove(t, T(14.5), T(18.5), [0, 0, 1.16], [0, 0, 1.02]);
  plate('cabin', { d: .45, blur: 4 }); leak(t, .5, W * .15, H * .2, 900, '#ff9f4a');
  words(t, [[['200,000', T(15.2), 'serifI', 1.1]], [['ดอลลาร์', T(15.7), 'sans', .75]]], { y: H * pick(.22, .26), size: pick(180, 150), d: .7 });
  const r = appear(t, T(14.9), 'rise', .9, null);
  cut('money', W * .5, spkTop() + 40 * U + r.dy, H * pick(.3, .45), { d: 1.05, a: r.a, shadow: .9 });
  motes(t, .7, { n: 50 });
}
function sGone(t) { // the reveal: words sit above the circle
  camMove(t, T(18.5), T(21.5), [0, 0, 1.0], [0, 0, 1.12], smooth);
  plate('forest', { d: .4, filter: 'brightness(.75)' });
  words(t, [['หายไป', T(19.2), 'sans']], { y: H * pick(.4, .38), size: pick(170, 140), d: .8 });
  fog(t, .55, { n: 12, d: 1.5, y0: .4, y1: 1.1, col: '#9aa3a8', speed: [-30, 0] });
}
function sMe(t) { // the narrator himself, in costume (character with the speaker's own face)
  camMove(t, T(21.5), T(25.5), [40 * U, 0, 1.0], [-20 * U, -20 * U, 1.1]); drift(t, 4, 5);
  plate('forest', { d: .45, blur: 4, focus: [.3, .5] });
  words(t, [['ผมออกตามหา', T(22.2), 'sans', .7], ['ที่นี่', T(22.8), 'serifI']], { y: H * pick(.16, .14), size: pick(150, 120), d: .8 });
  const r = appear(t, T(21.9), 'rise', 1.0, null);
  cut('meWalk', W * pick(.5, .62), H * pick(.95, .98) + r.dy, H * pick(.72, .82), { d: 1, a: r.a, shadow: .8 });
}
function sCard(t) {
  layer(.5, () => paperCard(3)); const r = appear(t, T(25.8), 'blur', .8);
  txt('และที่แปลกที่สุดคือ...', W / 2, H * .45, pick(64, 60), P.white, 'light', 'center', r.a);
}
function sEnd(t) { ctx.fillStyle = P.dark; ctx.fillRect(0, 0, W, H); }
const SC = [
  [0, T(2.4), sHook, { spk: 'full', over: hookWords }],
  [T(2.4), T(6.5), sSky], [T(6.5), T(11), sCooper],
  [T(11), T(14.5), sBoard, { spk: 'off' }],
  [T(14.5), T(18.5), sMoney],
  [T(18.5), T(21.5), sGone],
  [T(21.5), T(25.5), sMe],
  [T(25.5), T(28.6), sCard, { spk: 'off', grade: 'none', paper: .05 }],
  [T(28.6), END + 1, sEnd, { spk: 'full' }],
];
const TR = [[T(2.4), 'fade', .5], [T(6.5), 'whip', .5, { dir: 'left' }], [T(11), 'blur', .6], [T(14.5), 'zoom', .8, { at: [W * pick(.72, .66), H * pick(.7, .55)] }],
  [T(18.5), 'dip', .9], [T(21.5), 'blur', .6], [T(25.5), 'cut', .1, { snd: 'hit' }], [T(28.6), 'fade', .5]];
const CUES = { music: [[0, T(6.5), 'intro'], [T(6.5), T(14.5), 'mystery'], [T(14.5), T(21.5), 'tension'], [T(21.5), T(25.5), 'reveal'], [T(25.5), T(26), 'hush'], [T(26), END, 'outro']] };
function cover() {
  camera(0, 0, 1.05); plate('airport', { d: 1, filter: 'brightness(.8)' });
  words(99, [['ชายที่', 0, 'sans', .7], ['หายไป', 0, 'serifI', 1.3], ['กลางฟ้า', 0, 'sans', .9]], { y: H * pick(.24, .3), size: pick(200, 160), snd: null });
  cut('cooper', W * .5, H, H * pick(.62, .8));
  filmFinish(0, look(SC[1]));
}
