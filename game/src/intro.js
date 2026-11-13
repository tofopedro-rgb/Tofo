// Introdução cinematográfica: três quadros pintados com zoom lento e "vida" desenhada por cima —
// vento nos pelos (deformação suave só nas regiões marcadas), vaga-lumes, folhas, névoa e brilhos pulsando.
// Tudo em canvas 2D, sem vídeo. Coordenadas das regiões no espaço da imagem (1280 × 714).
(() => {
'use strict';
const TT = window.TT;
const cv = document.getElementById('introC'); if (!cv) return;
const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
const IW = 1280, IH = 714, FADE = 0.9;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const load = src => { const i = new Image(); i.src = src; return i; };

// zoom: escala inicial → final em torno de um ponto; wind: regiões de pelo (ring = rosto parado, só a borda mexe)
const SCENES = [
  { img: load('assets/intro/1-bruxa.jpg'), dur: 4.6, zoom: [1.0, 1.1], at: [700, 380],
    wind: [ { x: 935, y: 275, rx: 95, ry: 60, amp: 2.2, speed: 5, freq: 0.08 },               // capa da bruxa
            { x: 416, y: 560, rx: 120, ry: 85, amp: 1.4, speed: 38, freq: 0.5, jitter: 1 },  // pugs latindo tremem
            { x: 600, y: 536, rx: 115, ry: 85, amp: 1.4, speed: 41, freq: 0.5, jitter: 1 } ],
    glow: [ { x: 888, y: 168, r: 260, c: '190,255,170', a: 0.16, pulse: 0.9 },
            { x: 720, y: 500, r: 70, c: '255,220,120', a: 0.35, pulse: 7 },
            { x: 1104, y: 432, r: 70, c: '255,190,110', a: 0.25, pulse: 3, flicker: 1 } ],
    flies: 16, leaves: 0, fog: 1, windX: 30 },
  { img: load('assets/intro/2-timtim.jpg'), dur: 4.4, zoom: [1.0, 1.12], at: [430, 330],
    wind: [ { x: 430, y: 320, rx: 270, ry: 270, amp: 3.2, speed: 2.6, freq: 0.035, ring: 1 }, // juba e orelhas
            { x: 90, y: 520, rx: 130, ry: 170, amp: 5, speed: 2.2, freq: 0.03 },              // rabo
            { x: 200, y: 460, rx: 70, ry: 50, amp: 4, speed: 4.2, freq: 0.09 },               // ponta da bandana
            { x: 470, y: 600, rx: 160, ry: 100, amp: 2.4, speed: 3.4, freq: 0.06 } ],         // bandana
    glow: [ { x: 790, y: 360, r: 190, c: '255,170,80', a: 0.22, pulse: 1.4 } ],
    flies: 22, leaves: 7, fog: 0, windX: 70 },
  { img: load('assets/intro/3-amigos.jpg'), dur: 5.4, zoom: [1.12, 1.0], at: [640, 430],
    wind: [ { x: 432, y: 480, rx: 130, ry: 140, amp: 2.4, speed: 2.4, freq: 0.04, ring: 1 },
            { x: 624, y: 490, rx: 140, ry: 160, amp: 2.4, speed: 2.7, freq: 0.04, ring: 1 },
            { x: 832, y: 500, rx: 130, ry: 140, amp: 2.4, speed: 2.2, freq: 0.04, ring: 1 } ],
    glow: [ { x: 800, y: 410, r: 230, c: '255,190,90', a: 0.24, pulse: 1.1 } ],
    flies: 30, leaves: 3, fog: 1, windX: 25, rise: 1 },
];

// pedaços reaproveitados: canvas de trabalho e textura de névoa
const off = document.createElement('canvas'), ox = off.getContext('2d');
const fog = document.createElement('canvas'); fog.width = 1024; fog.height = 256;
{ const f = fog.getContext('2d'), r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  for (let i = 0; i < 26; i++) { const x = r() * 1024, y = 90 + r() * 110, s = 60 + r() * 120, g = f.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, 'rgba(200,230,255,.22)'); g.addColorStop(1, 'rgba(200,230,255,0)'); f.fillStyle = g; f.fillRect(x - s, y - s, s * 2, s * 2);
    if (x < s) { f.save(); f.translate(1024, 0); f.fillRect(x - s, y - s, s * 2, s * 2); f.restore(); } } }

// rajadas de vento: sempre um pouco, às vezes mais forte
const gust = t => 0.55 + 0.3 * Math.sin(t * 1.1) + 0.15 * Math.sin(t * 2.7 + 1.3);

function windPatch(img, w, t) {
  const bw = Math.ceil(w.rx * 2), bh = Math.ceil(w.ry * 2), x0 = Math.round(w.x - w.rx), y0 = Math.round(w.y - w.ry);
  if (off.width < bw) off.width = bw; if (off.height < bh) off.height = bh;
  ox.globalCompositeOperation = 'source-over'; ox.clearRect(0, 0, bw, bh);
  const g = w.jitter ? 1 : gust(t), step = 3;
  for (let y = 0; y < bh; y += step) {
    // deslocamento horizontal em onda que desce pelo pelo; nas pontas (baixo/lados) balança mais
    const dx = w.amp * g * Math.sin(y * w.freq + t * w.speed) + (w.jitter ? 0 : w.amp * 0.5 * g);
    ox.drawImage(img, x0, y0 + y, bw, step, dx, y, bw, step);
  }
  // máscara macia: elipse que some na borda; no "ring" o centro (olhos, focinho) fica parado
  ox.globalCompositeOperation = 'destination-in';
  ox.save(); ox.translate(bw / 2, bh / 2); ox.scale(1, w.ry / w.rx);
  const m = ox.createRadialGradient(0, 0, 0, 0, 0, w.rx);
  if (w.ring) { m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.55, 'rgba(0,0,0,0)'); m.addColorStop(0.75, 'rgba(0,0,0,1)'); }
  else { m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.6, 'rgba(0,0,0,1)'); }
  m.addColorStop(1, 'rgba(0,0,0,0)');
  ox.fillStyle = m; ox.fillRect(-w.rx, -w.rx, w.rx * 2, w.rx * 2); ox.restore();
  ctx.drawImage(off, 0, 0, bw, bh, x0, y0, bw, bh);
}

function makeParts(s) {
  const r = Math.random, p = [];
  for (let i = 0; i < s.flies; i++) p.push({ k: 'fly', x: r() * IW, y: (s.rise ? 0.3 : 0.15) * IH + r() * IH * 0.8, ph: r() * 9, sz: 1.6 + r() * 2.4, sp: 0.4 + r() * 0.8 });
  for (let i = 0; i < s.leaves; i++) p.push({ k: 'leaf', x: -r() * IW, y: r() * IH * 0.8, ph: r() * 9, sz: 7 + r() * 7, sp: 0.7 + r() * 0.6 });
  return p;
}

function drawScene(s, t, alpha) {
  const img = s.img; if (!img.complete || !img.naturalWidth) return;
  const k = Math.min(1, t / s.dur), e = k * k * (3 - 2 * k) * 0.35 + k * 0.65; // zoom contínuo, levemente suavizado
  const sc = (s.zoom[0] + (s.zoom[1] - s.zoom[0]) * e) * Math.max(W / IW, H / IH);
  ctx.save(); ctx.globalAlpha = alpha;
  // zoom em torno de "at", sem deixar borda vazia
  let tx = W / 2 - s.at[0] * sc, ty = H / 2 - s.at[1] * sc;
  tx = Math.min(0, Math.max(W - IW * sc, tx)); ty = Math.min(0, Math.max(H - IH * sc, ty));
  ctx.setTransform(sc, 0, 0, sc, tx, ty);
  ctx.drawImage(img, 0, 0);
  if (!still) for (const w of s.wind) windPatch(img, w, t);
  ctx.globalCompositeOperation = 'lighter';
  for (const g of s.glow) {
    let a = g.a * (0.75 + 0.25 * Math.sin(t * g.pulse * 2));
    if (g.flicker) a *= 0.8 + 0.2 * Math.sin(t * 23) * Math.sin(t * 7.3);
    const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    gr.addColorStop(0, `rgba(${g.c},${a})`); gr.addColorStop(1, `rgba(${g.c},0)`); ctx.fillStyle = gr; ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
  }
  if (s.fog) { ctx.globalAlpha = alpha * 0.8; const fx = (t * 22) % 1024; for (let x = -fx; x < IW; x += 1024) ctx.drawImage(fog, x, IH - 300, 1024, 300); ctx.globalAlpha = alpha; }
  for (const p of s.parts) {
    const gx = s.windX * gust(t + p.ph);
    if (p.k === 'fly') {
      const x = (p.x + t * gx * p.sp + Math.sin(t * 1.3 + p.ph) * 14) % IW, y = p.y - (s.rise ? t * 26 * p.sp : 0) + Math.sin(t * 0.9 + p.ph * 2) * 10;
      const a = 0.5 + 0.5 * Math.sin(t * 3 * p.sp + p.ph), R = p.sz * 4;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(255,236,160,${0.9 * a})`); gr.addColorStop(0.25, `rgba(255,210,110,${0.45 * a})`); gr.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const p of s.parts) if (p.k === 'leaf') {
    const x = p.x + t * 260 * p.sp, y = p.y + t * 40 * p.sp + Math.sin(t * 2 + p.ph) * 24;
    if (x < -30 || x > IW + 30) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 * p.sp + p.ph); ctx.scale(1, 0.45 + 0.4 * Math.sin(t * 5 + p.ph));
    ctx.fillStyle = 'rgba(30,70,50,.85)'; ctx.beginPath(); ctx.ellipse(0, 0, p.sz, p.sz * 0.5, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

let cur = -1, prev = -1, t0 = 0, tp0 = 0, raf = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const t = (now - t0) / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#060a18'; ctx.fillRect(0, 0, W, H);
  if (prev >= 0 && t < FADE) drawScene(SCENES[prev], (now - tp0) / 1000, 1);
  if (cur >= 0) drawScene(SCENES[cur], t, Math.min(1, t / FADE));
}
TT.intro = {
  durations: SCENES.map(s => s.dur),
  scene(i) { const now = performance.now(); prev = cur; tp0 = t0; cur = i; t0 = now; SCENES[i].parts = makeParts(SCENES[i]); if (!raf) raf = requestAnimationFrame(frame); },
  stop() { cancelAnimationFrame(raf); raf = 0; cur = prev = -1; },
};
})();
