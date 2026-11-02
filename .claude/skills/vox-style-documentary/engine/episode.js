// ---------- episode.js: starter template / demo ("ชายที่หายไปกลางฟ้า" ~25 s, D.B. Cooper 1971) ----------
// Works with no images at all (labelled placeholders = animatic). The image worksheet comes from ASSETS:
//   node tools/render.js engine prompts .   -> prompts.html (copy buttons) + prompts.md
// the person generates each picture, saves it as images/<name>.jpg|png, then tools/check_images.py prepares them.
// Layout is written once for both formats: W/H-relative positions + pick(valueFor9x16, valueFor16x9).
const TITLE = 'ชายที่หายไปกลางฟ้า';
const STYLE = 'Cinematic documentary photograph, 1971, warm muted sepia palette, soft motivated light, shallow depth of field, realistic, high detail';
const CHARS = { cooper: 'a man in his 40s with short dark hair, dark business suit, white shirt, thin black tie and dark sunglasses' };
const ASSETS = {
  sky:     { shot: 'ช็อต 1 · 0-4.6 วิ', note: 'ท้องฟ้าเหนือเมฆ ยามเย็น', text: 'middle',
             prompt: 'A sea of clouds at sunset seen from above, golden haze, empty sky' },
  plane:   { shot: 'ช็อต 1', note: 'เครื่องบินโบอิ้ง 727 (ไดคัท)', cut: true,
             prompt: 'A 1971 Boeing 727 airliner in flight, side three-quarter view' },
  airport: { shot: 'ช็อต 2 · 4.6-9 วิ', note: 'ลานบินกลางคืน ฝนพรำ', text: 'top',
             prompt: 'Rainy airport apron at night in 1971, wet tarmac reflections, boarding stairs to a Boeing 727, warm sodium lights' },
  cooper:  { shot: 'ช็อต 2', note: 'ชายสูทดำ แว่นดำ (ไดคัท)', cut: true, char: 'cooper',
             prompt: 'Full body portrait of the man standing, raincoat over one arm, holding a briefcase, looking at the camera' },
  sketch:  { shot: 'ช็อต 3 · 9-13.6 วิ', note: 'ภาพสเก็ตช์ผู้ต้องสงสัย (ติดบนบอร์ด)', char: 'cooper', photo: true,
             prompt: 'Police composite pencil sketch of the man, 1971 FBI wanted poster style, black and white drawing on paper' },
  cabin:   { shot: 'ช็อต 4 · 13.6-18 วิ', note: 'ห้องโดยสารเครื่องบินยุค 70', text: 'top',
             prompt: 'Dim 1970s airliner cabin interior at night, rows of seats, small window lights, light smoke haze' },
  money:   { shot: 'ช็อต 4', note: 'ถุงเงินดอลลาร์ (ไดคัท)', cut: true,
             prompt: 'A canvas bank bag overflowing with stacks of 1971 twenty dollar bills' },
  night:   { shot: 'ช็อต 5 · 18-21.8 วิ', note: 'ป่าสนกลางคืน ฝนตก', text: 'bottom',
             prompt: 'Dense pine forest seen from the air at night in heavy rain, misty valley, faint moonlight' },
  chute:   { shot: 'ช็อต 5', note: 'คนกระโดดร่ม (ไดคัท)', cut: true,
             prompt: 'Dark silhouette of a parachutist hanging under an open round parachute, seen from below' },
};
const END = 25.5;
const LOOK = { grade: 'warm', grain: .14, paper: .14, dust: .35, vignette: .5 };

// 1) 0-4.6  fog clears over the clouds, "ปี 1971" behind the plane, camera tilts down
function sOpen(t) {
  camMove(t, 0, 4.6, [0, -260 * U, 1.12], [0, 60 * U, 1.0]); drift(t, 5);
  plate('sky', { d: .4, over: 1.3, focus: [.5, .4] });
  words(t, [['ปี', .6, 'sans', .55], ['1971', 1.0, 'sans', 1.25]], { y: H * pick(.42, .45), size: pick(230, 200), d: .6 });
  const r = appear(t, 1.6, 'rise', 1.4, null);
  cut('plane', W * .5 + (t - 1.6) * 40 * U, H * pick(.66, .78) + r.dy, H * pick(.22, .42), { d: 1, a: r.a, blur: r.blur });
  fog(t, 1 - seg(t, .2, 2.4) * .75, { n: 16, d: 1.6, y0: .2, y1: .9, size: 1.3, speed: [60, -20] });
}
// 2) 4.6-9  the man: cut-out grows up in front of the airport, name in serif italic above him
function sMan(t) {
  camMove(t, 4.6, 9, [0, 0, 1.0], [0, -40 * U, 1.1]); drift(t, 4, 3);
  plate('airport', { d: .45, blur: 3 });
  rays(t, .45, W * .82, -40 * U, 2.1, .5, 2200, '#ffd7a0');
  const g = appear(t, 4.9, 'grow', 1.2, null), h = H * pick(.62, .8);
  cut('cooper', W * .5, H * .98, h * g.s, { d: 1, a: g.a, shadow: .8 });
  words(t, [['แดน คูเปอร์', 5.9, 'serifI']], { y: H * pick(.2, .14), size: pick(110, 96), d: .9 });
  words(t, [['ชายไม่ทราบชื่อ', 6.6, 'semi']], { y: H * pick(.27, .23), size: 46, col: P.cream, d: .9, rough: 0, shadow: .6 });
  fog(t, .35, { n: 8, d: 1.8, y0: .8, y1: 1.1, col: '#d8c7ab', speed: [20, 0] });
}
// 3) 9-13.6  evidence board drawn in code: doc + photo + pins + red string + marker loop + stamp
function sBoard(t) {
  camMove(t, 9, 13.6, [0, 0, 1.0], [40 * U, -30 * U, 1.16]);
  layer(.6, () => cork());
  layer(.85, () => {
    const dw = W * pick(.62, .34), dx = W * pick(.45, .4), dy = H * pick(.42, .48);
    doc(dx, dy, dw, dw * 1.35, { rot: -.04, seed: 7, title: 'WANTED BY THE FBI' });
    photo('sketch', W * pick(.72, .66), H * pick(.7, .55), W * pick(.34, .2), { rot: .09, caption: 'D.B. Cooper' });
    pin(dx, dy - dw * .64); pin(W * pick(.72, .66), H * pick(.7, .55) - W * pick(.34, .2) * .6);
    string(dx, dy - dw * .64, W * pick(.72, .66), H * pick(.7, .55) - W * pick(.34, .2) * .6, ease(seg(t, 10.2, 11)));
    markerCircle(t, 11.2, .9, dx, dy - dw * .3, dw * .38, dw * .12, { seed: 4 });
    stamp(t, 12.3, dx - dw * .1, dy + dw * .45, 'ยังไม่ปิดคดี', { size: 54 });
  });
}
// 4) 13.6-18  cabin: the amount sits BEHIND the money bag (text layer drawn before the cut-out)
function sMoney(t) {
  camMove(t, 13.6, 18, [0, 0, 1.18], [0, 0, 1.02]);
  plate('cabin', { d: .45, blur: 4 });
  leak(t, .5, W * .15, H * .2, 900, '#ff9f4a');
  words(t, [[['200,000', 14.4, 'serifI', 1.1]], [['ดอลลาร์', 15.0, 'sans', .75]]], { y: H * pick(.36, .4), size: pick(190, 170), d: .7 });
  const r = appear(t, 14.0, 'rise', .9, null);
  cut('money', W * .5, H * pick(.9, .98) + r.dy, H * pick(.36, .55), { d: 1.05, a: r.a, shadow: .9 });
  motes(t, .7, { n: 50 });
}
// 5) 18-21.8  the jump: parachute over the night forest, "หายไป" blurs away
function sJump(t) {
  camMove(t, 18, 21.8, [0, -120 * U, 1.0], [0, 80 * U, 1.12], smooth);
  plate('night', { d: .4, filter: 'brightness(.8)' });
  const y = lerp(H * .25, H * .55, seg(t, 18, 21.8));
  cut('chute', W * .55, y, H * pick(.4, .55), { d: 1.1, anchor: [.5, .5], rot: Math.sin(t * 1.3) * .05, a: 1 - seg(t, 20.8, 21.6), blur: seg(t, 20.6, 21.6) * 10 });
  words(t, [['หายไป', 19.4, 'sans']], { y: H * pick(.72, .78), size: pick(150, 130), d: .8, a: 1 - seg(t, 20.9, 21.7) });
  fog(t, .55, { n: 12, d: 1.5, y0: .5, y1: 1.1, col: '#9aa3a8', speed: [-30, 0] });
}
// 6) 21.8-END  paper card cliff-hanger (the reference's "And the strangest part")
function sCard(t) {
  camMove(t, 21.8, END, [0, 0, 1.0], [0, 0, 1.06]);
  layer(.5, () => paperCard(3));
  const r = appear(t, 22.2, 'blur', .8);
  txt('และที่แปลกที่สุดคือ...', W / 2, H / 2 + r.dy, pick(64, 60), P.white, 'light', 'center', r.a);
}
const SC = [[0, 4.6, sOpen], [4.6, 9, sMan], [9, 13.6, sBoard], [13.6, 18, sMoney], [18, 21.8, sJump], [21.8, END + 1, sCard, { grade: 'none', paper: .05 }]];
const TR = [[4.6, 'whip', .5, { dir: 'left' }], [9, 'blur', .7], [13.6, 'zoom', .8, { at: [W * pick(.72, .66), H * pick(.7, .55)] }], [18, 'dip', 1.0], [21.8, 'cut', .1, { snd: 'hit' }]];
const CUES = {
  music: [[0, 4.6, 'intro'], [4.6, 13.6, 'mystery'], [13.6, 21.6, 'tension'], [21.6, 22.2, 'hush'], [22.2, END, 'outro']],
  sfx: [[1.0, 'boom', .5], [14.4, 'hit', .4], [19.4, 'riser', 1.2]]
};
function cover() {
  camera(0, 0, 1.05); plate('night', { d: 1, filter: 'brightness(.75)' });
  words(99, [['ชายที่', 0, 'sans', .7], ['หายไป', 0, 'serifI', 1.3], ['กลางฟ้า', 0, 'sans', .9]], { y: H * pick(.34, .42), size: pick(200, 170), snd: null });
  cut('chute', W * .5, H * pick(.72, .78), H * pick(.36, .5), { anchor: [.5, .5] });
  filmFinish(0, look(SC[0]));
}
