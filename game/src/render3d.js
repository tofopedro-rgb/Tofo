// Renderização 2.5D: um parque à noite pintado em camadas. Fundo em silhuetas com perspectiva atmosférica,
// flora luminosa, fachos de luar, vaga-lumes e pós-processamento (profundidade de campo, bloom, cor fria, vinheta).
// Todo o cenário é desenhado por código; só os personagens são imagens.
(() => {
'use strict';
const TT = window.TT, C = TT.C, S = TT.S;
const { W, H, GROUND, ARENA_X } = C;
const R = TT.R = { ready: false, quality: 2, flash: 0 };
const cv = document.getElementById('c');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { TT.noWebGL = true; return; }
const GL2 = renderer.capabilities.isWebGL2;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0c1c);
const FOV = 28, CAM_D = (H / 2) / Math.tan(FOV * Math.PI / 360), CAM_Y = 272, LOOK_Y = 176;
const camera = new THREE.PerspectiveCamera(FOV, W / H, 60, 12000);

// paleta: do mais distante (claro, enevoado) ao mais próximo (quase preto)
const PAL = { far: '#c9687a', mid: '#8a3f5e', near: '#3b1a38', back: '#2a1430', front: '#14081a',
  cyan: 0xffe6b0, violet: 0xc79bff, warm: 0xffb866, mint: 0xffc0e0 };

// ---------------- texturas ----------------
THREE.DefaultLoadingManager.onLoad = () => { R.ready = true; TT.emit('assetsReady'); };
const TL = new THREE.TextureLoader();
const load = p => { const t = TL.load('assets/' + p); t.anisotropy = 4; return t; };
const AR = { 'tintim-idle': 232 / 220, 'tintim-run': 258 / 200, 'tintim-jump': 270 / 200, 'tintim-fall': 240 / 220, 'tintim-hurt': 218 / 220,
  'tintim-win': 189 / 240, 'pug-walk': 269 / 200, 'pug-charge': 309 / 200, 'pug-stun': 313 / 130, pigeon: 138 / 120, monkey: 126 / 140,
  banana: 1, cookie: 129 / 90, 'chi-pb': 245 / 300, 'chi-br': 223 / 300 };
const TEX = {};
for (const k in AR) TEX[k] = load('sprites/' + k + '.png');
TEX['tintim-run'].repeat.set(0.25, 1);
// perfis dos chihuahuas (para quando correm); a proporção vem da própria imagem
['chi-pb-run', 'chi-br-run'].forEach(k => { AR[k] = 1.2; TEX[k] = TL.load('assets/sprites/' + k + '.png', t => { AR[k] = t.image.width / t.image.height; }); TEX[k].anisotropy = 4; });

function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 2;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speckle(x, w, h, n, colors, r = 1.4, rnd = Math.random) {
  for (let i = 0; i < n; i++) { x.fillStyle = colors[i % colors.length]; x.globalAlpha = 0.1 + rnd() * 0.25;
    x.beginPath(); x.arc(rnd() * w, rnd() * h, rnd() * r + 0.3, 0, 7); x.fill(); }
  x.globalAlpha = 1;
}

// céu: degradê noturno, lua, um véu violeta e estrelas
const texSky = canvasTex(1024, 512, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  [[0, '#241846'], [0.26, '#5b2a63'], [0.46, '#b84a6e'], [0.6, '#f08a55'], [0.7, '#ffc27a'], [0.82, '#f39a6a'], [1, '#6a3050']].forEach(([s, c]) => g.addColorStop(s, c));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const blob = (cx, cy, r, stops) => { const q = x.createRadialGradient(cx, cy, 0, cx, cy, r); stops.forEach(([s, c]) => q.addColorStop(s, c)); x.fillStyle = q; x.fillRect(0, 0, w, h); };
  [[230, 150, 300], [520, 90, 240], [900, 200, 280]].forEach(([a, b, c]) => blob(a, b, c, [[0, 'rgba(255,160,150,.30)'], [1, 'rgba(255,160,150,0)']]));
  blob(690, 300, 330, [[0, 'rgba(255,244,205,.95)'], [0.16, 'rgba(255,190,110,.55)'], [0.5, 'rgba(255,130,90,.18)'], [1, 'rgba(255,130,90,0)']]);
  x.fillStyle = '#fff6dc'; x.beginPath(); x.arc(690, 300, 36, 0, 7); x.fill();
  const r = rng(7);
  for (let i = 0; i < 60; i++) { x.globalAlpha = 0.1 + r() * 0.4; x.fillStyle = i % 5 ? '#cfefff' : '#ffe9c4'; x.beginPath(); x.arc(r() * w, r() * h * 0.2, r() * 1.1 + 0.25, 0, 7); x.fill(); }
  x.globalAlpha = 1;
});

// uma camada de árvores em silhueta; cada árvore é desenhada três vezes (x, x±largura) para a textura emendar sem costura
function treeLayer(seed, col, n, size, rim, leaf, leafHi) {
  return canvasTex(2048, 1024, (x, w, h) => {
    const r = rng(seed); x.fillStyle = x.strokeStyle = col; x.lineCap = 'round';
    const blob = (q, cx, cy, rad) => { if (leaf) x.fillStyle = leaf; const hi = [];
      for (let k = 0; k < 9; k++) { const a = q() * 6.28, d = q() * rad * 0.8, ex = cx + Math.cos(a) * d, ey = cy + Math.sin(a) * d * 0.6, rx = rad * (0.45 + q() * 0.4), ry = rad * (0.3 + q() * 0.3); x.beginPath(); x.ellipse(ex, ey, rx, ry, 0, 0, 7); x.fill(); hi.push([ex, ey, rx, ry]); }
      if (leafHi) { x.fillStyle = leafHi; hi.forEach(([ex, ey, rx, ry], k) => { if (k % 2) return; x.beginPath(); x.ellipse(ex - rx * 0.12, ey - ry * 0.32, rx * 0.62, ry * 0.5, 0, 0, 7); x.fill(); }); }
      x.fillStyle = col; };
    const tree = (q, bx, by) => {
      const th = h * (0.62 + q() * 0.5) * size, tw = (26 + q() * 34) * size, lean = (q() - 0.5) * tw * 3, tx = bx + lean, ty = by - th;
      x.beginPath(); x.moveTo(bx - tw * 0.8, by); x.bezierCurveTo(bx - tw * 0.3, by - th * 0.3, tx - tw * 0.32, by - th * 0.7, tx - tw * 0.16, ty);
      x.lineTo(tx + tw * 0.16, ty); x.bezierCurveTo(tx + tw * 0.32, by - th * 0.7, bx + tw * 0.36, by - th * 0.3, bx + tw * 0.9, by); x.fill();
      const nb = 3 + Math.floor(q() * 3);
      for (let k = 0; k < nb; k++) { const t = 0.42 + q() * 0.5, px = bx + lean * t, py = by - th * t, dir = k % 2 ? 1 : -1, len = (80 + q() * 150) * (th / 900), ex = px + dir * len, ey = py - len * (0.25 + q() * 0.5);
        x.lineWidth = Math.max(2, tw * 0.24 * (1.25 - t)); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + dir * len * 0.5, py - len * 0.04, ex, ey); x.stroke();
        blob(q, ex, ey, (55 + q() * 70) * (th / 900)); }
      blob(q, tx, ty, (90 + q() * 80) * (th / 900));
    };
    x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 32; i++) x.lineTo(i * w / 32, h - 62 - Math.sin(i / 32 * Math.PI * 4 + seed) * 16 - Math.sin(i / 32 * Math.PI * 10) * 7); x.lineTo(w, h); x.fill();
    for (let i = 0; i < n; i++) { const s = Math.floor(r() * 1e9), bx = (i + 0.2 + r() * 0.6) * w / n; [-w, 0, w].forEach(o => tree(rng(s), bx + o, h - 52)); }
    if (rim) { // luar roçando o topo das copas
      x.globalCompositeOperation = 'source-atop'; const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rim); g.addColorStop(0.55, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over'; }
  });
}
const texTreesFar = treeLayer(11, PAL.far, 7, 0.82, 'rgba(255,200,140,.4)');
const texTreesMid = treeLayer(23, PAL.mid, 6, 0.95, 'rgba(255,170,120,.22)', '#a3485a', '#cf6a5c');
const texTreesNear = treeLayer(37, PAL.near, 4, 1.25, null, '#8c3327', '#e0692f');

// arbustos atrás do caminho, com florzinhas acesas
const texHedge = canvasTex(1024, 256, (x, w, h) => {
  const r = rng(5); x.fillStyle = PAL.back;
  for (let i = 0; i < 40; i++) { const s = Math.floor(r() * 1e9), bx = r() * w; [-w, 0, w].forEach(o => { const q = rng(s), rad = 44 + q() * 50;
    x.beginPath(); x.ellipse(bx + o, h - 20 - q() * 46, rad, rad * (0.6 + q() * 0.3), 0, 0, 7); x.fill(); }); }
  x.fillRect(0, h - 40, w, 40);
  x.globalCompositeOperation = 'source-atop'; const tg = x.createLinearGradient(0, 60, 0, h); tg.addColorStop(0, 'rgba(225,105,60,.6)'); tg.addColorStop(0.7, 'rgba(225,105,60,0)'); x.fillStyle = tg; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 70; i++) { const px = r() * w, py = h - 30 - r() * 120, c = i % 4 ? '255,225,160' : '255,180,225';
    const g = x.createRadialGradient(px, py, 0, px, py, 7); g.addColorStop(0, `rgba(${c},.9)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(px - 7, py - 7, 14, 14); }
});
// folhagem de primeiro plano (quase preta, fica desfocada)
const texBush = canvasTex(512, 256, x => { x.filter = 'blur(5px)';
  for (let k = 0; k < 13; k++) { const a = -Math.PI / 2 + (k - 6) * 0.22, len = 150 + (k * 37 % 80);
    x.save(); x.translate(256, 270); x.rotate(a); x.fillStyle = k % 2 ? PAL.front : '#210e24';
    x.beginPath(); x.ellipse(len / 2, 0, len / 2, 15, 0, 0, 7); x.fill(); x.restore(); } });
const texGrass = canvasTex(512, 64, (x, w, h) => { // fileira de capim com pontas iluminadas
  const r = rng(3);
  for (let i = 0; i < 150; i++) { const bx = r() * w, hh = 18 + r() * 44, lean = (r() - 0.5) * 18;
    const g = x.createLinearGradient(0, h, 0, h - hh); g.addColorStop(0, '#2a2a18'); g.addColorStop(0.7, '#5c6b22'); g.addColorStop(1, i % 6 ? '#d8c85a' : '#fff0a0');
    x.strokeStyle = g; x.lineWidth = 1.6 + r() * 1.6; x.lineCap = 'round';
    [-w, 0, w].forEach(o => { x.beginPath(); x.moveTo(bx + o, h); x.quadraticCurveTo(bx + o + lean * 0.2, h - hh * 0.6, bx + o + lean, h - hh); x.stroke(); }); }
}, true);
const texTurf = canvasTex(512, 512, (x, w, h) => { // gramado escuro
  x.fillStyle = '#4a4a26'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) { x.fillStyle = i % 2 ? 'rgba(190,150,60,.16)' : 'rgba(40,14,36,.2)'; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 80, 14 + Math.random() * 30, Math.random() * 3, 0, 7); x.fill(); }
  speckle(x, w, h, 3200, ['#7a7a30', '#2e2618', '#a89a3e'], 1.3);
  speckle(x, w, h, 60, ['#ffe9a0', '#ffc0d0'], 1.2);
}, true);
const texPath = canvasTex(512, 256, (x, w, h) => { // caminho de pedra do parque
  x.fillStyle = '#4a3440'; x.fillRect(0, 0, w, h);
  const r = rng(9);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { const px = i * 64 + (j % 2) * 32 + 4, py = j * 64 + 4, l = 40 + r() * 12;
    x.fillStyle = `hsl(20, 26%, ${l}%)`; x.beginPath(); x.roundRect(px, py, 56, 56, 12); x.fill(); if (px + 56 > w) { x.beginPath(); x.roundRect(px - w, py, 56, 56, 12); x.fill(); }
    x.fillStyle = 'rgba(255,225,185,.14)'; x.beginPath(); x.roundRect(px + 3, py + 3, 50, 16, 8); x.fill(); }
  speckle(x, w, h, 1400, ['#2c1c28', '#c09a86'], 1.2, r);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(74,74,38,1)'); g.addColorStop(0.16, 'rgba(74,74,38,0)'); g.addColorStop(0.84, 'rgba(74,74,38,0)'); g.addColorStop(1, 'rgba(74,74,38,1)');
  x.fillStyle = g; x.fillRect(0, 0, w, h); // as bordas se dissolvem no gramado
});
texPath.wrapS = THREE.RepeatWrapping;
const texSand = canvasTex(512, 512, (x, w, h) => { // areia do parquinho sob o luar
  x.fillStyle = '#b07a52'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { x.fillStyle = i % 2 ? 'rgba(255,225,170,.12)' : 'rgba(70,24,44,.14)';
    x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 70, 8 + Math.random() * 12, 0, 0, 7); x.fill(); }
  speckle(x, w, h, 5000, ['#7a4a38', '#e6b888', '#c08a5a'], 1.1);
}, true);
const texRock = canvasTex(256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6a4650'); g.addColorStop(1, '#26141f'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  speckle(x, w, h, 1500, ['#2c1824', '#9a7a72']);
  x.strokeStyle = 'rgba(20,6,14,.5)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { let px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (Math.random() - 0.5) * 60; py += Math.random() * 40; x.lineTo(px, py); } x.stroke(); }
}, true);
const texMoss = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#6a7a2a'; x.fillRect(0, 0, w, h);
  speckle(x, w, h, 2200, ['#3e4a1a', '#a2b03c', '#7f8f30'], 2);
  speckle(x, w, h, 90, ['#fff0a0', '#ffd0e0'], 1.5);
}, true);
const texRoots = canvasTex(256, 128, (x, w, h) => { // raízes e cipós pendurados sob as plataformas
  const r = rng(13); x.lineCap = 'round';
  for (let i = 0; i < 26; i++) { const bx = 6 + r() * (w - 12), len = 20 + r() * 100, sway = (r() - 0.5) * 26;
    x.strokeStyle = i % 3 ? '#2a1426' : '#4a4a1e'; x.lineWidth = 1.5 + r() * 3; x.beginPath(); x.moveTo(bx, 0); x.quadraticCurveTo(bx + sway, len * 0.6, bx + sway * 0.4, len); x.stroke();
    if (i % 5 === 0) { const g = x.createRadialGradient(bx + sway * 0.4, len, 0, bx + sway * 0.4, len, 7); g.addColorStop(0, 'rgba(255,225,150,.9)'); g.addColorStop(1, 'rgba(255,225,150,0)'); x.fillStyle = g; x.fillRect(bx + sway * 0.4 - 7, len - 7, 14, 14); } }
});
const texSoft = canvasTex(64, 64, x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const texStar = canvasTex(64, 64, x => { x.fillStyle = '#ffe9a8'; x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 10 : 28; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); });
const texShaft = canvasTex(64, 256, (x, w, h) => { // facho de luar
  const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'destination-in'; const v = x.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,.9)'); v.addColorStop(0.75, 'rgba(0,0,0,.35)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, w, h); });
const texMist = canvasTex(256, 128, (x, w, h) => { const v = x.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.6, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = v; x.fillRect(0, 0, w, h); });
// plantas luminosas: 0 = flores-lanterna em hastes, 1 = cogumelos, 2 = samambaia de luz
function plantTex(kind, rgb) {
  return canvasTex(128, 192, (x, w, h) => {
    const glow = (cx, cy, r, a = 0.8) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
    x.lineCap = 'round';
    if (kind === 0) [[-34, 74], [26, 132], [4, 176], [44, 62]].forEach(([dx, hh], i) => { const tx = 64 + dx, ty = h - hh;
      x.strokeStyle = '#3a2a2e'; x.lineWidth = 3; x.beginPath(); x.moveTo(64 + dx * 0.25, h); x.quadraticCurveTo(64 + dx * 0.2, h - hh * 0.8, tx, ty); x.stroke();
      glow(tx, ty + 6, 26, 0.55); x.fillStyle = `rgb(${rgb})`; x.beginPath(); x.moveTo(tx - 9, ty + 12); x.quadraticCurveTo(tx - 12, ty - 8, tx, ty - 9); x.quadraticCurveTo(tx + 12, ty - 8, tx + 9, ty + 12); x.quadraticCurveTo(tx, ty + 7, tx - 9, ty + 12); x.fill();
      x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.ellipse(tx, ty + 3, 3.5, 6, 0, 0, 7); x.fill(); });
    if (kind === 1) [[-26, 58, 22], [16, 104, 34], [42, 40, 16]].forEach(([dx, hh, cw]) => { const tx = 64 + dx, ty = h - hh;
      x.strokeStyle = '#e0c2a8'; x.lineWidth = cw * 0.28; x.beginPath(); x.moveTo(tx + 3, h); x.quadraticCurveTo(tx - 4, h - hh * 0.5, tx, ty + 4); x.stroke();
      glow(tx, ty, cw * 1.5, 0.6); x.fillStyle = `rgb(${rgb})`; x.beginPath(); x.ellipse(tx, ty, cw, cw * 0.62, 0, Math.PI, 0); x.quadraticCurveTo(tx, ty + cw * 0.3, tx - cw, ty); x.fill();
      x.fillStyle = 'rgba(255,255,255,.8)'; [[-0.45, -0.3, 0.14], [0.3, -0.38, 0.1], [0, -0.12, 0.08]].forEach(([a, b, s]) => { x.beginPath(); x.arc(tx + a * cw, ty + b * cw, s * cw, 0, 7); x.fill(); }); });
    if (kind === 2) for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.2, len = 120 + (k * 53 % 60);
      const g = x.createLinearGradient(64, h, 64 + Math.cos(a) * len, h + Math.sin(a) * len); g.addColorStop(0, '#3a3a1c'); g.addColorStop(1, `rgb(${rgb})`);
      x.strokeStyle = g; x.lineWidth = 3; x.beginPath(); x.moveTo(64, h); x.quadraticCurveTo(64 + Math.cos(a) * len * 0.5, h + Math.sin(a) * len * 0.75, 64 + Math.cos(a) * len * 0.92, h + Math.sin(a) * len * 0.82); x.stroke();
      glow(64 + Math.cos(a) * len * 0.92, h + Math.sin(a) * len * 0.82, 9, 0.9); }
  });
}
const PLANTS = [[0, '214,170,255', PAL.violet], [1, '255,150,95', PAL.warm], [2, '255,225,150', PAL.cyan], [1, '235,160,255', PAL.violet], [0, '255,190,220', PAL.mint]]
  .map(([k, rgb, glow]) => ({ tex: plantTex(k, rgb), glow }));
const texLamp = canvasTex(96, 320, (x, w, h) => { // poste do parque com lanterna acesa
  x.fillStyle = '#1c0c1e'; x.fillRect(44, 70, 8, h - 70); x.fillRect(36, h - 22, 24, 22); x.fillRect(40, 96, 16, 5);
  x.fillStyle = 'rgba(255,190,130,.45)'; x.fillRect(44, 70, 2, h - 70);
  x.fillStyle = '#1c0c1e'; x.beginPath(); x.moveTo(26, 22); x.lineTo(70, 22); x.lineTo(62, 12); x.lineTo(34, 12); x.closePath(); x.fill(); x.fillRect(45, 4, 6, 9);
  const g = x.createLinearGradient(0, 22, 0, 72); g.addColorStop(0, '#fff3d0'); g.addColorStop(1, '#ffb45a'); x.fillStyle = g;
  x.beginPath(); x.moveTo(29, 24); x.lineTo(67, 24); x.lineTo(58, 70); x.lineTo(38, 70); x.closePath(); x.fill();
  x.strokeStyle = '#1c0c1e'; x.lineWidth = 3; x.stroke(); x.beginPath(); x.moveTo(48, 24); x.lineTo(48, 70); x.stroke();
});
const texBench = canvasTex(256, 128, (x, w, h) => { // banco de praça em silhueta
  x.fillStyle = '#1e0e20'; [[22, 40, 212, 12], [22, 58, 212, 10], [14, 78, 228, 14]].forEach(([a, b, c, d]) => { x.beginPath(); x.roundRect(a, b, c, d, 4); x.fill(); });
  [[34, 36, 9, 92], [213, 36, 9, 92], [22, 90, 9, 38], [225, 90, 9, 38]].forEach(([a, b, c, d]) => x.fillRect(a, b, c, d));
  x.fillStyle = 'rgba(255,190,130,.5)'; [[22, 40, 212, 2], [14, 78, 228, 2]].forEach(([a, b, c, d]) => x.fillRect(a, b, c, d));
});
const texPlay = canvasTex(2048, 1024, (x, w, h) => { // parquinho: balanço, escorregador, trepa-trepa e gangorra em silhueta com contraluz
  const ink = '#24102a', rim = 'rgba(255,190,120,.75)'; x.lineCap = x.lineJoin = 'round';
  const line = (pts, lw) => { [[ink, lw, 0], [rim, Math.max(2, lw * 0.22), -lw * 0.3]].forEach(([c, l, o]) => { x.strokeStyle = c; x.lineWidth = l; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a + o, b + o) : x.moveTo(a + o, b + o)); x.stroke(); }); };
  const B = h - 40;
  // balanço
  line([[150, B], [250, 330], [350, B]], 22); line([[690, B], [790, 330], [890, B]], 22); line([[230, 335], [810, 335]], 24);
  [[400, 14], [620, -10]].forEach(([sx, sw]) => { line([[sx, 340], [sx + sw, 760]], 6); line([[sx + 110, 340], [sx + 110 + sw, 760]], 6); line([[sx + sw - 8, 764], [sx + 118 + sw, 764]], 16); });
  // escorregador
  line([[1010, B], [1010, 430]], 20); line([[1130, B], [1130, 430]], 20); for (let y = 500; y < B; y += 70) line([[1010, y], [1130, y]], 10);
  line([[990, 440], [1150, 440]], 22); line([[1010, 430], [1010, 350], [1130, 350], [1130, 430]], 12);
  x.strokeStyle = ink; x.lineWidth = 46; x.beginPath(); x.moveTo(1140, 455); x.bezierCurveTo(1270, 470, 1330, 800, 1500, B - 26); x.stroke();
  x.strokeStyle = rim; x.lineWidth = 5; x.beginPath(); x.moveTo(1140, 432); x.bezierCurveTo(1280, 446, 1340, 780, 1500, B - 50); x.stroke();
  // trepa-trepa em cúpula
  for (let k = 0; k < 4; k++) { const rr = 250 - k * 0; x.strokeStyle = ink; x.lineWidth = 13; x.beginPath(); x.ellipse(1770, B, rr * (1 - k * 0.27), 300, 0, Math.PI, 0); x.stroke(); }
  [0.34, 0.68].forEach(t => { x.strokeStyle = ink; x.lineWidth = 11; x.beginPath(); x.ellipse(1770, B - 300 * t, 250 * Math.sqrt(1 - t * t), 26, 0, 0, 7); x.stroke(); });
  x.strokeStyle = rim; x.lineWidth = 3; x.beginPath(); x.ellipse(1770, B, 256, 306, 0, Math.PI * 1.08, Math.PI * 1.6); x.stroke();
  x.fillStyle = ink; x.fillRect(0, B - 6, w, 60);
});

// ---------------- geometria ----------------
const planeGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);           // âncora na base (pés)
const planeGeoC = new THREE.PlaneGeometry(1, 1);                                // âncora no centro
// plano com a fileira de baixo móvel: balançar esses vértices faz as patas darem passos
const legGeo = () => { const g = new THREE.PlaneGeometry(1, 1, 4, 3).translate(0, 0.5, 0); g.userData.base = Float32Array.from(g.attributes.position.array); return g; };
function legs(m, ph, amp) { const pos = m.geometry.attributes.position, b = m.geometry.userData.base;
  for (let i = 0; i < pos.count; i++) { const bx = b[i * 3], by = b[i * 3 + 1]; if (by > 0.01) continue;
    const a = ph + (bx < -0.3 ? 0 : bx < -0.05 ? 1.6 : bx > 0.3 ? Math.PI : bx > 0.05 ? Math.PI + 1.6 : 0.8), k = Math.abs(bx) < 0.05 ? 0.3 : 1;
    pos.setX(i, bx + Math.sin(a) * amp * k); pos.setY(i, by + Math.max(0, Math.cos(a)) * amp * 0.55 * k); }
  pos.needsUpdate = true; }
const planeGeoTop = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);        // âncora no topo (coisas penduradas)
function boxUV(w, h, d, tile) { // caixa com UVs proporcionais ao tamanho (textura não estica)
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
  return g;
}
const add = (m, order) => { if (order !== undefined) m.renderOrder = order; scene.add(m); return m; };
// recortes entram na passada opaca, que é desenhada de frente para trás: o que fica escondido nem chega a ser pintado
const flatMat = (map, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ map, alphaTest: 0.5, fog: false }, o));
const glowMat = (c, op = 1) => new THREE.MeshBasicMaterial({ map: texSoft, color: c, opacity: op, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const addMat = (map, c, op) => new THREE.MeshBasicMaterial({ map, color: c, opacity: op, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });

// ---------------- mundo estático ----------------
const FLOOR_Z0 = -104, FLOOR_Z1 = 470, FD = FLOOR_Z1 - FLOOR_Z0, FZ = (FLOOR_Z0 + FLOOR_Z1) / 2;
const pulses = [], shafts = [], mists = [];
const sky = add(new THREE.Mesh(planeGeoC, new THREE.MeshBasicMaterial({ map: texSky, fog: false })), 1); // por último entre os opacos
sky.scale.set(4700, 2700, 1); sky.position.set(0, 300, -3000);
(function buildWorld() {
  const r = rng(101);
  // camadas de árvores: a distância real dá o parallax; a cor mais clara ao longe dá a névoa
  const layer = (tex, z, y0, w, hgt) => { const m = flatMat(tex);
    for (let x = -3400; x < 13400; x += w) { const q = new THREE.Mesh(planeGeo, m); q.scale.set(w + 2, hgt, 1); q.position.set(x + w / 2, y0, z); add(q); } };
  layer(texTreesFar, -2200, -580, 3400, 1700, -24);
  layer(texTreesMid, -1300, -340, 2600, 1300, -20);
  layer(texTreesNear, -520, -160, 1900, 950, -16);
  layer(texHedge, -98, -6, 760, 190, -8);
  // névoa entre as camadas e fachos de luar
  [[-1750, -360, 900, 0xffa07a, 0.26, -22], [-900, -230, 620, 0xff8f78, 0.17, -18], [-300, -70, 330, 0xd9708a, 0.1, -12]].forEach(([z, y, hgt, c, op, order], i) => {
    const m = add(new THREE.Mesh(planeGeo, addMat(texMist, c, op)), order); m.scale.set(20000, hgt, 1); m.position.set(5000, y, z); mists.push({ m, op, i }); });
  for (let i = 0; i < 22; i++) { const near = i % 3 === 0, z = near ? -260 : -1050, k = near ? 1 : 1.9;
    const m = add(new THREE.Mesh(planeGeoTop, addMat(texShaft, i % 4 === 1 ? 0xffb0c0 : 0xffd9a0, 0.2)), near ? -11 : -19);
    m.scale.set((150 + r() * 190) * k, 1150 * k, 1); m.position.set(-400 + i * 560 + r() * 300, 760 * (near ? 1 : 1.25), z); m.rotation.z = -0.34 - r() * 0.1; shafts.push({ m, ph: r() * 6, op: near ? 0.12 : 0.2 }); }
  // abismo e fundação
  const dark = new THREE.MeshBasicMaterial({ color: 0x160a18, fog: false });
  const pit = new THREE.Mesh(planeGeoC, dark); pit.scale.set(16000, 700, 1); pit.rotation.x = -Math.PI / 2; pit.position.set(5000, -300, 180); add(pit);
  const found = new THREE.Mesh(planeGeoC, dark); found.scale.set(16000, 300, 1); found.position.set(5000, -150, -100); add(found);
  // chão: cada trecho é um bloco de pedra coberto de grama; os buracos são vãos de verdade
  const side = new THREE.MeshLambertMaterial({ map: texRock });
  const grassM = flatMat(texGrass, { alphaTest: 0.35, side: THREE.DoubleSide });
  const grassRow = (x0, x1, y, z, hgt, order) => { const w = x1 - x0, g = new THREE.PlaneGeometry(w, hgt).translate(0, hgt / 2, 0), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * w / (hgt * 8) + z * 0.013);
    const m = new THREE.Mesh(g, grassM); m.position.set(x0 + w / 2, y, z); add(m); };
  const mk = (x0, x1, top, arena) => {
    const w = x1 - x0, g = boxUV(w, 300, FD, 180), topM = new THREE.MeshLambertMaterial({ map: top });
    const m = new THREE.Mesh(g, [side, side, topM, side, side, side]); m.position.set(x0 + w / 2, -150, FZ); m.receiveShadow = true; add(m);
    if (arena) return;
    const pg = new THREE.PlaneGeometry(w, 150), uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (x0 + uv.getX(i) * w) / 300);
    const p = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ map: texPath, transparent: true })); p.rotation.x = -Math.PI / 2; p.position.set(x0 + w / 2, 0.6, 6); p.receiveShadow = true; add(p, -1);
    grassRow(x0, x1, 0, -86, 30, -7); grassRow(x0, x1, 0, 92, 15, 6); grassRow(x0, x1, 0, 210, 22, 6);
  };
  const spans = [];
  C.grounds.forEach(([x, w], i) => {
    const x0 = i === 0 ? -1600 : x, x1 = x + w;
    if (x1 > ARENA_X) { mk(x0, ARENA_X, texTurf); mk(ARENA_X, ARENA_X + 2400, texSand, true); spans.push([x0, ARENA_X]); } else { mk(x0, x1, texTurf); spans.push([x0, x1]); }
  });
  const curb = new THREE.Mesh(boxUV(14, 10, FD, 60), side); curb.position.set(ARENA_X, 4, FZ); curb.receiveShadow = true; add(curb);
  // plataformas: lajes de pedra com musgo luminoso e raízes penduradas
  const moss = new THREE.MeshLambertMaterial({ map: texMoss, emissive: 0x2a3010 }), rootM = flatMat(texRoots, { alphaTest: 0.3 });
  for (const [x, y, w] of C.plats) {
    const m = new THREE.Mesh(boxUV(w, 18, 70, 120), [side, side, moss, side, side, side]);
    m.position.set(x + w / 2, GROUND - y - 9, 0); m.castShadow = m.receiveShadow = true; add(m);
    const rt = add(new THREE.Mesh(planeGeoTop, rootM)); rt.scale.set(w * 0.96, 54 + (x % 40), 1); rt.position.set(x + w / 2, GROUND - y - 16, 30);
    const gl = add(new THREE.Mesh(planeGeoC, glowMat(PAL.mint, 0.22)), 3); gl.scale.set(w * 1.5, 46, 1); gl.position.set(x + w / 2, GROUND - y + 2, 34);
    pulses.push({ m: gl, base: 0.22, ph: x });
  }
  // flora luminosa atrás e à frente do caminho
  const plantM = PLANTS.map(p => flatMat(p.tex, { transparent: true, alphaTest: 0.08, depthWrite: false, side: THREE.DoubleSide }));
  for (const [x0, x1] of spans.concat([[ARENA_X + 20, ARENA_X + 1000]])) for (let x = Math.max(-300, x0 + 50); x < x1 - 50; x += 120 + r() * 170) {
    const k = Math.floor(r() * PLANTS.length), front = x0 < ARENA_X && r() < 0.22, hgt = (front ? 42 : 60) + r() * 60, z = front ? 120 + r() * 120 : -92 + r() * 44;
    const m = add(new THREE.Mesh(planeGeo, plantM[k]), front ? 8 : -6); m.scale.set(hgt * 0.667 * (r() < 0.5 ? -1 : 1), hgt, 1); m.position.set(x, 0, z);
    const g = add(new THREE.Mesh(planeGeoC, glowMat(PLANTS[k].glow, 0.3)), front ? 8 : -6); g.scale.set(hgt * 2.3, hgt * 2, 1); g.position.set(x, hgt * 0.62, z - 1); pulses.push({ m: g, base: 0.3, ph: x * 0.37 });
  }
  // postes com luz quente, e a poça de luz que eles fazem no chão
  const lampM = flatMat(texLamp, { alphaTest: 0.4 }), benchM = flatMat(texBench, { alphaTest: 0.4 });
  for (let x = 260, i = 0; x < ARENA_X - 100; x += 880, i++) {
    if (!spans.some(([a, b]) => x > a + 40 && x < b - 40)) x += 170;
    const m = add(new THREE.Mesh(planeGeo, lampM)); m.scale.set(66, 220, 1); m.position.set(x, 0, -72);
    const g = add(new THREE.Mesh(planeGeoC, glowMat(PAL.warm, 0.6)), -4); g.scale.set(230, 230, 1); g.position.set(x, 187, -70); pulses.push({ m: g, base: 0.6, ph: i * 2.2, slow: true });
    const pool = add(new THREE.Mesh(planeGeoC, glowMat(PAL.warm, 0.2)), 0); pool.rotation.x = -Math.PI / 2; pool.scale.set(420, 230, 1); pool.position.set(x, 1.2, -10);
    if (i % 2 === 0 && spans.some(([a, b]) => x + 150 > a + 60 && x + 150 < b - 60)) { const b = add(new THREE.Mesh(planeGeo, benchM)); b.scale.set(112, 56, 1); b.position.set(x + 150, 0, -78); }
  }
  // varal de luzinhas nas cores da bandana do Timtim
  const cols = [0xff7a2a, 0xffd23f, 0x35d68f, 0xff5a6e, 0x5aa2ff, 0xfff0d6].map(c => new THREE.Color(c));
  const pos = [], col = [], line = [];
  for (let x0 = 150; x0 < ARENA_X - 600; x0 += 760) {
    const len = 560, n = 13;
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + t * len, y = 268 - Math.sin(t * Math.PI) * 38;
      if (i > 0) line.push(x, y, -60); if (i < n) line.push(x, y, -60);
      if (i > 0 && i < n) { const c = cols[i % cols.length]; pos.push(x, y - 6, -59); col.push(c.r, c.g, c.b); } }
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  add(new THREE.Points(bg, new THREE.PointsMaterial({ map: texSoft, size: 95, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })), -3);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
  add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a1430, fog: false })), -4);
  // placa do parquinho, com letras acesas
  const poleM = new THREE.MeshLambertMaterial({ color: 0x4a2838 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 120, 8), poleM); pole.position.set(ARENA_X - 150, 60, -45); pole.castShadow = true; add(pole);
  const signT = canvasTex(512, 192, x => { x.fillStyle = '#2a1430'; x.fillRect(0, 0, 512, 192); x.strokeStyle = '#ffd9a8'; x.lineWidth = 6; x.strokeRect(10, 10, 492, 172);
    x.shadowColor = '#ffb866'; x.shadowBlur = 18; x.fillStyle = '#fff3dc'; x.font = '600 70px Georgia, serif'; x.textAlign = 'center'; x.fillText('PARQUINHO', 256, 102); x.font = 'bold 46px system-ui'; x.fillStyle = '#ffd98a'; x.shadowColor = '#ffb866'; x.fillText('➜', 256, 160); });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(150, 56, 6), new THREE.MeshBasicMaterial({ map: signT, fog: false })); sign.position.set(ARENA_X - 150, 128, -41); add(sign);
  // parquinho: silhuetas contra um clarão de lua
  const moon = add(new THREE.Mesh(planeGeoC, glowMat(0xffa860, 0.55)), -15); moon.scale.set(1500, 1300, 1); moon.position.set(ARENA_X + 500, 240, -500); pulses.push({ m: moon, base: 0.5, ph: 1, slow: true });
  const play = add(new THREE.Mesh(planeGeo, flatMat(texPlay, { alphaTest: 0.3 }))); play.scale.set(1180, 590, 1); play.position.set(ARENA_X + 480, -22, -90);
  const apool = add(new THREE.Mesh(planeGeoC, glowMat(0xffc890, 0.16)), 0); apool.rotation.x = -Math.PI / 2; apool.scale.set(1100, 420, 1); apool.position.set(ARENA_X + 480, 1.2, 40);
  // primeiro plano: folhagens escuras entre a câmera e o jogo, embaixo e penduradas em cima
  const bushM = new THREE.MeshBasicMaterial({ map: texBush, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  for (let i = 0, x = -200; x < ARENA_X - 300; i++, x += 620 + (i * 397 % 420)) {
    const m = new THREE.Mesh(planeGeo, bushM); m.scale.set(300 + (i % 3) * 60, 118, 1); m.position.set(x, -46, 350 + (i % 2) * 50); add(m, 9);
    if (i % 2) { const t = new THREE.Mesh(planeGeo, bushM); t.scale.set(420, -150, 1); t.position.set(x + 310, 384, 330); add(t, 9); }
  }
})();
// checkpoints: uma lanterna que acende
const flags = C.checkpoints.map(x => {
  const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 110, 8), new THREE.MeshLambertMaterial({ color: 0x4a2a3a }))); pole.position.set(x, 55, -40); pole.castShadow = true;
  const halo = add(new THREE.Mesh(planeGeoC, glowMat(0xc8a8b0, 0.15)), 3); halo.position.set(x, 122, -38);
  const core = add(new THREE.Mesh(planeGeoC, glowMat(0xffffff, 0.3)), 3); core.position.set(x, 122, -37);
  return { halo, core, up: 0, on: false };
});
// vaga-lumes e esporos de luz flutuando em volta da câmera
const FLY = 70, flies = [];
{ const r = rng(55); for (let i = 0; i < FLY; i++) { const m = add(new THREE.Mesh(planeGeoC, glowMat(i % 5 === 0 ? 0xffc0e0 : i % 3 === 0 ? 0xffffff : 0xffe9a8, 0.8)), 8);
  flies.push({ m, x: r() * 1500, y: 20 + r() * 400, z: -90 + r() * 400, s: 4 + r() * 9, ph: r() * 6.28, sp: 0.4 + r() * 1.2 }); } }

// ---------------- luz e sombra ----------------
scene.add(new THREE.AmbientLight(0xffd6c4, 0.95));
const sun = new THREE.DirectionalLight(0xffb880, 0.7); sun.castShadow = true; // o sol baixo
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.5;
Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 620, bottom: -420, near: 100, far: 2200 });
scene.add(sun); scene.add(sun.target);
const heroLight = new THREE.PointLight(0xfff0d8, 0.5, 430, 1.5); scene.add(heroLight); // o Timtim ilumina o chão por onde passa

// ---------------- sprites ----------------
function sprite(name, order = 5, shadow = true, tint = 0xffffff) {
  const mat = new THREE.MeshBasicMaterial({ map: TEX[name], color: tint, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(planeGeo, mat);
  if (shadow) { m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: TEX[name], alphaTest: 0.5, side: THREE.DoubleSide }); }
  m.userData.name = name; return add(m, order);
}
function setAnim(m, name, h, flip, frame = 0, n = 1) {
  if (m.userData.name !== name) { m.material.map = TEX[name]; if (m.customDepthMaterial) m.customDepthMaterial.map = TEX[name]; m.userData.name = name; }
  if (n > 1) TEX[name].offset.x = frame / n;
  m.scale.set(h * AR[name] * (flip ? -1 : 1), h, 1);
}
const NIGHT = 0xf2d8cc; // criaturas sob o luar; o Timtim e os amigos têm luz própria
const tintim = sprite('tintim-idle', 6, true, 0xfffaf2);
const halo = add(new THREE.Mesh(planeGeoC, glowMat(0xfff2d0, 0.3)), 4);
const aura = add(new THREE.Mesh(planeGeoC, glowMat(0xffaa33)), 5); aura.visible = false;
const ghostM = [0, 1, 2, 3, 4, 5].map(() => { const m = add(new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: TEX['tintim-jump'], color: 0xff9a50, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })), 4); m.visible = false; return m; });
const ghosts = []; let ghostT = 0;
const pugM = [0, 1].map(i => { const m = sprite('pug-walk', 5, true, i ? 0xd8bcc4 : NIGHT); m.geometry = legGeo(); m.userData.ph = i * 2;
  m.userData.stars = [0, 1, 2].map(() => { const s = add(new THREE.Mesh(planeGeoC, new THREE.MeshBasicMaterial({ map: texStar, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })), 7); s.scale.set(16, 16, 1); s.visible = false; return s; });
  return m; });
const pigeonM = S.enemies.map(() => sprite('pigeon', 5, true, NIGHT));
const itemM = S.items.map(it => { const m = sprite(it.type === 'gold' ? 'cookie' : it.type, 5, false, it.type === 'gold' ? 0xffd640 : 0xfff4e0); m.geometry = planeGeoC;
  m.userData.glow = add(new THREE.Mesh(planeGeoC, glowMat(it.type === 'monkey' ? 0xff8a2a : it.type === 'cookie' ? 0xffc76a : 0xffe14d)), 4);
  return m; });
const friendM = S.friends.map(f => { const m = sprite(f.kind, 5, true, 0xfff6ec); m.geometry = legGeo();
  m.userData.glow = add(new THREE.Mesh(planeGeoC, glowMat(0xffd9a0, 0.3)), 4); return m; });
const giftM = [0, 1].map(() => { const m = sprite('cookie', 7, false); m.geometry = planeGeoC; m.visible = false;
  m.userData.glow = add(new THREE.Mesh(planeGeoC, glowMat(0xffd27a, 0.8)), 6); m.userData.glow.visible = false; return m; });
let runPhase = 0, sq = 1, sqV = 0, rotS = 0;

// ---------------- partículas (todas de luz) ----------------
const POOL = 170, parts = [], pmesh = [];
for (let i = 0; i < POOL; i++) { const m = add(new THREE.Mesh(planeGeoC, glowMat(0xffffff)), 7); m.visible = false; pmesh.push(m); }
function spawn(o) { if (parts.length < POOL) parts.push(Object.assign({ vx: 0, vy: 0, g: 900, life: 0.6, r: 4, grow: 0, color: 0xffffff, z: 8, hard: false }, o)); }
function burst(x, y, colors, n, spd = 260, g = 500) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random() * 0.7);
    spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, g, life: 0.5 + Math.random() * 0.5, r: 3 + Math.random() * 4, color: colors[i % colors.length], hard: true }); }
}
const MOTE = [0xfff2c8, 0xffd9a0, 0xffe6f0];
const dustPuff = (x, y, n, spread) => { for (let i = 0; i < n; i++) spawn({ x, y: y - 2, vx: (Math.random() - 0.5) * spread, vy: -20 - Math.random() * 70, g: -40, life: 0.6, r: 3 + Math.random() * 3, grow: 5, color: MOTE[i % 3] }); };
TT.on('dust', e => spawn({ x: e.x, y: e.y - 4, vx: e.dir * (20 + Math.random() * 50), vy: -30 - Math.random() * 50, g: -60, life: 0.7, r: 2.5 + Math.random() * 2.5, grow: 3, color: MOTE[Math.floor(Math.random() * 3)] }));
TT.on('land', e => { dustPuff(e.x, e.y, 10, 260); sqV -= 5; });
TT.on('pugLand', e => dustPuff(e.x, e.y, 9, 320));
TT.on('jump', e => { dustPuff(e.x, e.y, 5, 120); sqV += 3.4; });
TT.on('jump2', e => { sqV += 3; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; spawn({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 14, vx: Math.cos(a) * 190, vy: Math.sin(a) * 120, g: 0, life: 0.4, r: 4, grow: -4, color: MOTE[i % 3], hard: true }); } });
TT.on('cookie', e => burst(e.x, e.y, [0xffd98a, 0xffb65a, 0xfff2c8], 8, 170));
TT.on('power', e => burst(e.x, e.y, [0xffe14d, 0xff8a2a, 0xffffff], 24, 320));
TT.on('hurt', e => burst(e.x, e.y + 20, [0xff5a7e, 0xffc0d0], 12, 240));
TT.on('stomp', e => { burst(e.x, e.y, [0xfff2c8, 0xffc0d0, 0xffffff], e.boss ? 22 : 12, e.boss ? 380 : 260); dustPuff(e.x, e.y + 40, 6, 300); });
TT.on('finalBlow', e => { R.flash = 0.85; burst(e.x, e.y, [0xffc0d0, 0xffd98a, 0xffffff, 0xc79bff], 40, 520); });
TT.on('checkpoint', e => { flags[e.index].on = true; burst(e.x, GROUND - 122, [0xffd98a, 0xffb866, 0xffffff], 18, 240, 200); });
TT.on('friend', e => burst(e.x, e.y, [0xffd98a, 0xff9fc0, 0xffffff], 10, 150, 100));
TT.on('gift', e => burst(e.x, e.y, [0xffd98a, 0xff7d9c, 0xffffff, 0x8fe9ff], 22, 260, 200));
TT.on('start', e => { parts.length = 0; ghosts.length = 0; R.flash = 0; R.zoom = 1; sq = 1; sqV = 0; if (!e.retry) flags.forEach(f => { f.on = false; f.up = 0; }); });
let confettiT = 0;
TT.on('win', () => { confettiT = 4; });

// ---------------- pós-processamento ----------------
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
let rt, rtA, rtB;
if (GL2) {
  rt = new THREE.WebGLRenderTarget(W, H, { depthTexture: new THREE.DepthTexture(W, H) });
  rtA = new THREE.WebGLRenderTarget(W / 4, H / 4); rtB = new THREE.WebGLRenderTarget(W / 4, H / 4);
}
const brightMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() } }, vertexShader: VERT, depthTest: false, fragmentShader: `
  precision mediump float; uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
  void main(){ vec3 c = (texture2D(t, vUv + px * vec2(-1., -1.)).rgb + texture2D(t, vUv + px * vec2(1., -1.)).rgb + texture2D(t, vUv + px * vec2(-1., 1.)).rgb + texture2D(t, vUv + px * vec2(1., 1.)).rgb) * .25;
    float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(.66, 1., l), 1.); }` });
const blurMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VERT, depthTest: false, fragmentShader: `
  precision mediump float; uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
  void main(){ vec3 c = texture2D(t, vUv).rgb * .227;
    c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * .316;
    c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * .0703; gl_FragColor = vec4(c, 1.); }` });
const compMat = new THREE.ShaderMaterial({ depthTest: false, vertexShader: VERT,
  uniforms: { tScene: { value: null }, tDepth: { value: null }, tBloom: { value: null }, res: { value: new THREE.Vector2(W, H) },
    near: { value: camera.near }, far: { value: camera.far }, focus: { value: CAM_D }, dof: { value: 1 }, time: { value: 0 }, flash: { value: 0 }, gray: { value: 0 } },
  fragmentShader: `
  precision highp float;
  uniform sampler2D tScene, tDepth, tBloom; uniform vec2 res; uniform float near, far, focus, dof, time, flash, gray;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec3 col = texture2D(tScene, vUv).rgb;
    if (dof > 0.) {
      // profundidade de campo: o plano do jogo fica nítido; o fundo vira pintura e o primeiro plano desfoca
      float z = texture2D(tDepth, vUv).x * 2. - 1.;
      float d = 2. * near * far / (far + near - z * (far - near));
      float coc = clamp((abs(d - focus) / focus - .11) * 1.5, 0., 1.) * (d > focus ? .7 : 1.);
      if (coc > .02) {
        vec2 r = coc * dof * 4.2 * (res.y / 540.) / res;
        col += texture2D(tScene, vUv + r * vec2(1., 0.)).rgb + texture2D(tScene, vUv + r * vec2(-1., 0.)).rgb
             + texture2D(tScene, vUv + r * vec2(0., 1.)).rgb + texture2D(tScene, vUv + r * vec2(0., -1.)).rgb
             + texture2D(tScene, vUv + r * vec2(.7, .7)).rgb + texture2D(tScene, vUv + r * vec2(-.7, .7)).rgb
             + texture2D(tScene, vUv + r * vec2(.7, -.7)).rgb + texture2D(tScene, vUv + r * vec2(-.7, -.7)).rgb;
        col /= 9.;
      }
    }
    vec3 bl = texture2D(tBloom, vUv).rgb;
    col += bl * .55;                                                 // bloom: tudo que brilha vaza luz
    col = 1. - exp(-col * 1.5);                                      // as luzes saturam com suavidade, sem estourar
    float l = dot(col, vec3(.299, .587, .114));
    col = mix(vec3(l), col, 1.18 * (1. - gray));                     // saturação
    col = clamp(col, 0., 1.); col = mix(col, col * col * (3. - 2. * col), .5);                // contraste suave
    col = mix(col * vec3(1.04, .86, 1.14), col, smoothstep(.15, .8, l)) * vec3(1.04, 1., .95); // sombras puxam para o roxo; as luzes ficam douradas
    vec2 q = vUv - .5; col *= 1. - dot(q, q) * .75;                 // vinheta
    col += (hash(vUv * res + time) - .5) * .014;                     // grão fino
    gl_FragColor = vec4(mix(col, vec3(1., .95, .85), flash), 1.);
  }` });
function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }

// ---------------- qualidade e tamanho ----------------
const MAX_SCALE = [1, 1.5, 2];
R.resize = () => {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const sc = Math.min(MAX_SCALE[R.quality], Math.max(1, (r.width || W) * dpr / W));
  const w = Math.round(W * sc), h = Math.round(H * sc);
  renderer.setSize(w, h, false);
  if (GL2) { rt.setSize(w, h); rtA.setSize(w >> 2, h >> 2); rtB.setSize(w >> 2, h >> 2); compMat.uniforms.res.value.set(w, h); }
};
R.setQuality = q => { R.quality = Math.max(0, Math.min(2, q)); sun.castShadow = R.quality > 0; compMat.uniforms.dof.value = R.quality > 1 ? 1 : 0;
  const rich = R.quality > 0; // no nível mais leve saem a névoa, os fachos e metade dos vaga-lumes
  mists.forEach(q => { q.m.visible = rich || q.i === 0; }); shafts.forEach((q, i) => { q.m.visible = rich || i % 3 === 0; }); flies.forEach((f, i) => { f.m.visible = rich || i % 2 === 0; }); pulses.forEach(q => { q.m.visible = rich || !!q.slow; });
  R.resize(); };
addEventListener('resize', R.resize); R.resize();

// ---------------- quadro a quadro ----------------
const Y = y => GROUND - y;
R.zoom = 1; let fxS = W / 2, fyS = LOOK_Y, time = 0;
const ease = t => t * t * (3 - 2 * t);
R.frame = (rdt) => {
  time += rdt;
  const p = S.player, clock = S.clock, live = S.hitstop > 0 ? 0 : rdt * S.timeScale;

  // Timtim: o corpo estica e achata com uma mola, inclina com a velocidade e dá uma pirueta no pulo duplo
  const moving = Math.abs(p.vx) > 20 && p.onGround, fast = p.fast > 0 || p.mega > 0;
  if (moving) runPhase += Math.abs(p.vx) * live / 26; // passo acompanha a velocidade: as patas não patinam
  let name = 'tintim-idle', h = 80, fr = 0, nf = 1;
  if (p.won) { name = 'tintim-win'; h = 92; }
  else if (p.hurtT > 0 || S.mode === 'lose') name = 'tintim-hurt';
  else if (!p.onGround) { if (p.vy < 0 || p.djT > 0) { name = 'tintim-jump'; h = 66; } else { name = 'tintim-fall'; h = 78; } }
  else if (moving) { name = 'tintim-run'; h = 72; nf = 4; fr = Math.floor(runPhase) % 4; }
  setAnim(tintim, name, h, p.face < 0, fr, nf);
  const sdt = Math.min(live, 0.02);
  sqV += (-(sq - 1) * 260 - sqV * 15) * sdt; sq = Math.max(0.72, Math.min(1.3, sq + sqV * sdt));
  const squash = sq * (p.onGround ? 1 + Math.sin(clock * 3) * 0.015 : 1 + Math.min(0.08, Math.abs(p.vy) / 9000));
  tintim.scale.x *= 2 - squash; tintim.scale.y *= squash;
  const tx = p.x + p.w / 2, ty = Y(p.y + p.h) - 2 + (moving ? Math.abs(Math.sin(runPhase * Math.PI / 2)) * 3 : 0);
  const rotT = p.won ? 0 : p.onGround ? -(p.vx / C.FAST) * 0.07 : -Math.max(-0.32, Math.min(0.32, p.vy / 2400)) * p.face;
  rotS += (rotT - rotS) * Math.min(1, rdt * 16);
  const flip = p.djT > 0 ? -p.face * Math.PI * 2 * ease(1 - p.djT / 0.42) : 0;
  tintim.rotation.z = rotS + flip;
  const pivot = flip ? h * 0.5 : 0; // a pirueta gira em torno do meio do corpo, não dos pés
  tintim.position.set(tx + Math.sin(tintim.rotation.z) * pivot, ty + pivot - Math.cos(tintim.rotation.z) * pivot, 3);
  tintim.visible = !(p.inv > 0 && Math.floor(time * 20) % 2);
  const hs = 150 + Math.sin(time * 2.4) * 10 + (fast ? 30 : 0);
  halo.position.set(tx, ty + 34, 1); halo.scale.set(hs, hs * 0.9, 1); halo.material.opacity = (S.mode === 'lose' ? 0.08 : 0.28) + Math.sin(time * 3.1) * 0.04;
  heroLight.position.set(tx, ty + 46, 60); heroLight.intensity = S.mode === 'lose' ? 0.15 : 0.5 + Math.sin(time * 3.1) * 0.05;
  aura.visible = fast;
  if (aura.visible) { aura.position.set(tx, ty + 38, 1); const s = 130 + Math.sin(time * 9) * 12; aura.scale.set(s, s, 1);
    if (p.mega > 0) aura.material.color.setHSL((time * 0.9) % 1, 1, 0.5); else aura.material.color.set(0xffd23f); aura.material.opacity = p.mega > 0 ? 0.7 : 0.4; }
  // rastro de luz: silhuetas que ficam para trás na pirueta e no turbo
  ghostT -= live;
  if ((p.djT > 0 || (fast && Math.abs(p.vx) > 200)) && ghostT <= 0 && tintim.visible) { ghostT = 0.04; if (ghosts.length >= ghostM.length) ghosts.shift();
    ghosts.push({ name, x: tintim.position.x, y: tintim.position.y, sx: tintim.scale.x, sy: tintim.scale.y, rot: tintim.rotation.z, life: 0.28 }); }
  for (let i = ghosts.length - 1; i >= 0; i--) { ghosts[i].life -= live; if (ghosts[i].life <= 0) ghosts.splice(i, 1); }
  ghostM.forEach((m, i) => { const g = ghosts[i]; m.visible = !!g; if (!g) return;
    if (m.material.map !== TEX[g.name]) m.material.map = TEX[g.name];
    m.position.set(g.x, g.y, 2); m.scale.set(g.sx, g.sy, 1); m.rotation.z = g.rot; m.material.opacity = g.life * 1.6; });

  // amigos chihuahuas e o biscoito que eles jogam
  S.friends.forEach((f, i) => {
    const m = friendM[i], near = Math.abs(tx - f.x) < 420;
    const run = Math.abs(f.vx) > 40, gal = f.t * 15 + i;
    const party = S.mode === 'winning' || S.mode === 'win';
    const jump = f.hop > 0 ? Math.abs(Math.sin(f.hop * Math.PI / 0.3)) * 28 * Math.min(1, f.hop * 2.5) : party && !run ? Math.abs(Math.sin(f.t * 8 + i * 1.3)) * 24 : 0;
    const hop = jump + (run ? Math.abs(Math.sin(gal)) * 9 : near ? Math.abs(Math.sin(f.t * 7)) * 5 : 0);
    setAnim(m, run ? f.kind + '-run' : f.kind, run ? 54 : 62, f.face < 0);
    // galope: estica no ar e achata no chão; parado, respira; no pulo de alegria, estica
    const br = run ? 1 + Math.sin(gal * 2) * 0.07 : jump > 2 ? 1.1 : 1 + Math.sin(f.t * 3 + i) * 0.025; m.scale.x *= 2 - br; m.scale.y *= br;
    m.position.set(f.x, hop, -36 + (run || f.follow > 0 ? 14 : 0)); m.rotation.z = run ? Math.sin(gal) * 0.13 * -f.face : Math.sin(f.t * (near ? 9 : 2)) * (near ? 0.06 : 0.015);
    legs(m, gal, run ? 0.1 : 0);
    const g = m.userData.glow; g.position.set(f.x, 30 + hop, -38); const s = 120 + Math.sin(f.t * 2.2) * 8; g.scale.set(s, s, 1); g.material.opacity = f.given ? 0.2 : 0.34;
  });
  giftM.forEach((m, i) => { const g = S.gifts[i], gl = m.userData.glow; m.visible = gl.visible = !!g; if (!g) return;
    m.scale.set(30 * AR.cookie, 30, 1); m.position.set(g.x, Y(g.y), 5); m.rotation.z = g.t * 9; gl.position.set(g.x, Y(g.y), 4); gl.scale.set(86, 86, 1);
    if (Math.random() < 0.6) spawn({ x: g.x, y: g.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, g: 60, life: 0.45, r: 3, color: 0xffd98a }); });

  // pugs
  S.pugs.forEach((g, i) => {
    const m = pugM[i], x = g.x + g.w / 2, flip = g.dir > 0;
    let n = 'pug-walk', ph = 86, y = Y(g.y + g.h) - 3, walking = false;
    if (g.hp <= 0) { n = 'pug-stun'; ph = 56; }
    else if (g.stun > 0) { n = 'pug-stun'; ph = 56; }
    else if (g.y + g.h < GROUND - 4 || Math.abs(g.vx) > 200) n = 'pug-charge';
    else { walking = Math.abs(g.vx) > 12 && g.wind <= 0; if (walking) { m.userData.ph += Math.abs(g.vx) * live / 11; y += Math.abs(Math.sin(m.userData.ph)) * 3.5; } }
    const turn = g.turnT > 0 ? g.turnT / 0.2 : 0; // ao virar, o corpo gira de lado em vez de espelhar de uma vez
    setAnim(m, n, ph, turn > 0.5 ? !flip : flip);
    let sy = 1, rot = 0, dx = 0;
    if (g.hp > 0 && g.stun <= 0) {
      const air = g.y + g.h < GROUND - 4;
      if (g.wind > 0) { const k = Math.min(1, (0.34 - g.wind) / 0.2); sy = 1 - 0.2 * k; rot = g.dir * 0.1 * k; dx = Math.sin(time * 70) * 2.2 * k; } // agacha e treme antes da investida
      else if (air) { sy = 1 + Math.min(0.14, Math.abs(g.vy) / 4500); rot = -g.dir * Math.max(-0.3, Math.min(0.3, g.vy / 2600)); }
      else if (g.landT > 0) sy = 1 - g.landT * 1.3;
      else if (Math.abs(g.vx) > 200) rot = -g.dir * 0.06;
      else sy = 1 + Math.sin(clock * 11 + i * 2) * 0.03; // ofegante
    }
    m.scale.x *= (2 - sy) * (turn > 0 ? Math.abs(1 - 2 * (1 - turn)) * 0.9 + 0.1 : 1); m.scale.y *= sy;
    if (g.stun > 0 && g.hp > 0) m.scale.y *= 0.85 + Math.min(0.15, (1.1 - g.stun) * 0.5);
    m.position.set(x + dx, y, i * 1.5); m.rotation.z = g.hp <= 0 ? g.spin : rot + (walking ? Math.sin(m.userData.ph) * 0.045 : 0);
    legs(m, m.userData.ph, walking ? 0.085 : 0); // passos: as patas da frente e de trás alternam
    const stp = Math.floor(m.userData.ph / Math.PI); if (walking && stp !== m.userData.stp) { m.userData.stp = stp; spawn({ x: x + g.dir * 20, y: GROUND - 3, vx: -g.dir * 30, vy: -25, g: -30, life: 0.4, r: 3, grow: 5, color: 0xfff2c8 }); }
    m.visible = !(g.hurt > 0 && Math.floor(time * 30) % 2) && (S.arena || S.cam.x > ARENA_X - W - 200) && g.y < H + 300;
    m.userData.stars.forEach((s, k) => { s.visible = g.stun > 0 && g.hp > 0; if (s.visible) { const a = time * 6 + k * 2.1; s.position.set(x - g.dir * 26 + Math.cos(a) * 22, y + 62 + Math.sin(a) * 6, 4 + Math.sin(a)); s.rotation.z = a; } });
  });
  // pombos
  S.enemies.forEach((e, i) => {
    const m = pigeonM[i]; setAnim(m, 'pigeon', 46, e.dir > 0);
    m.position.set(e.x + e.w / 2, Y(e.y + e.h) - 2 + (e.alive ? Math.abs(Math.sin(e.t * 12)) * 3 : 0), 0);
    m.rotation.z = e.alive ? 0 : Math.PI; m.visible = e.y < H + 200; m.castShadow = e.alive;
  });
  // itens: flutuam, giram devagar e pulsam como pequenas luzes
  S.items.forEach((it, i) => {
    const m = itemM[i]; m.visible = !it.got; const g = m.userData.glow; g.visible = !it.got;
    if (it.got) return;
    const ck = it.type === 'cookie', gd = it.type === 'gold', hh = ck ? 27 : gd ? 36 : it.type === 'banana' ? 46 : 54, bob = Math.sin(clock * 3 + it.x * 0.05) * 5;
    m.scale.set(hh * AR[gd ? 'cookie' : it.type], hh, 1); m.position.set(it.x, Y(it.y) + bob, 0);
    m.rotation.y = Math.sin(clock * 2.2 + it.x * 0.01) * (ck ? 0.75 : 0.4); m.rotation.z = Math.sin(clock * 3 + it.x) * 0.12;
    const s = (ck ? 62 : 104) + Math.sin(clock * 5 + it.x * 0.03) * (ck ? 8 : 12); g.scale.set(s, s, 1); g.position.set(it.x, Y(it.y) + bob, -2); g.material.opacity = ck ? 0.5 : 0.6;
  });
  // lanternas de checkpoint, flora, fachos e névoa respirando
  flags.forEach((f, i) => { f.up += ((f.on ? 1 : 0) - f.up) * Math.min(1, rdt * 4); const s = 46 + f.up * 150 + (f.on ? Math.sin(time * 3 + i) * 10 : 0);
    f.halo.scale.set(s, s, 1); f.halo.material.color.set(f.on ? 0xffc27a : 0xc8a8b0); f.halo.material.opacity = 0.15 + f.up * 0.6; f.core.scale.set(22 + f.up * 14, 22 + f.up * 14, 1); f.core.material.opacity = 0.3 + f.up * 0.7; });
  for (const q of pulses) q.m.material.opacity = q.base * (0.78 + 0.22 * Math.sin(time * (q.slow ? 0.9 : 1.9) + q.ph));
  for (const q of shafts) q.m.material.opacity = q.op * (0.55 + 0.45 * Math.sin(time * 0.35 + q.ph));
  for (const q of mists) { q.m.material.opacity = q.op * (0.85 + 0.15 * Math.sin(time * 0.25 + q.i * 2)); q.m.position.x = 5000 + Math.sin(time * 0.05 + q.i) * 120; }

  // partículas
  if (confettiT > 0) { confettiT -= rdt; for (let k = 0; k < 2; k++) spawn({ x: S.cam.x + Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 120, vy: 60 + Math.random() * 120, g: 60, life: 3.2, r: 3 + Math.random() * 3,
    color: [0x8fe9ff, 0xffd98a, 0x7dffd0, 0xff9fc0, 0xa98bff][Math.floor(Math.random() * 5)], hard: true }); }
  for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= live; if (q.life <= 0) { parts.splice(i, 1); continue; }
    q.vy += q.g * live; q.x += q.vx * live; q.y += q.vy * live; q.r = Math.max(0.5, q.r + q.grow * live); }
  for (let i = 0; i < POOL; i++) { const m = pmesh[i], q = parts[i]; m.visible = !!q; if (!q) continue;
    m.position.set(q.x, Y(q.y), q.z); m.scale.set(q.r * 3.2, q.r * 3.2, 1); m.material.color.set(q.color); m.material.opacity = Math.min(1, q.life * (q.hard ? 3 : 1.8)); }

  // câmera: segue, olha à frente, treme com o impacto, e aproxima nas cenas
  const cx = S.cam.x + W / 2, up = -S.cam.y;
  let zt = 1, fx = cx, fy = LOOK_Y + up * 0.9;
  if (S.cine && S.cine.type === 'boss') { const t = S.cine.t, k = ease(Math.min(1, t / 0.7)) * (1 - ease(Math.max(0, Math.min(1, (t - 2.8) / 0.6))));
    zt = 1 + 0.34 * k; fx = cx + (ARENA_X + 665 - cx) * k; fy = LOOK_Y - 95 * k; }
  else if (S.mode === 'winning' || S.mode === 'win') { zt = 1.2; fx = cx + (p.x + p.w / 2 - cx) * 0.6; fy = LOOK_Y - 60; }
  const kk = Math.min(1, rdt * 4);
  R.zoom += (zt - R.zoom) * kk; fxS += (fx - fxS) * (S.cine || S.mode !== 'play' ? kk : 1); fyS += (fy - fyS) * (S.cine || S.mode !== 'play' ? kk : 1);
  const tr = S.trauma * S.trauma, sx = tr * 16 * Math.sin(time * 71), sy = tr * 11 * Math.sin(time * 93 + 1);
  camera.position.set(fxS + sx + Math.sin(time * 0.6) * 1.5, CAM_Y + (fyS - LOOK_Y) + sy + Math.sin(time * 0.8) * 1.2, CAM_D);
  camera.lookAt(fxS + sx, fyS + sy, 0); camera.rotation.z += tr * 0.025 * Math.sin(time * 57);
  camera.zoom = R.zoom; camera.updateProjectionMatrix();
  sun.target.position.set(fxS, 0, 0); sun.position.set(fxS + 250, 820, 380); sun.target.updateMatrixWorld();
  sky.position.set(camera.position.x, camera.position.y + 30, -3000); // o céu está no infinito: acompanha a câmera
  for (const f of flies) { const fxw = ((f.x - fxS * 0.9 + time * 12 * f.sp) % 1500 + 1500) % 1500 - 750;
    f.m.position.set(fxS + fxw + Math.sin(time * f.sp + f.ph) * 26, f.y + Math.sin(time * f.sp * 0.7 + f.ph * 2) * 34, f.z);
    const tw = Math.max(0, Math.sin(time * f.sp * 1.6 + f.ph)); f.m.scale.set(f.s * (0.6 + tw), f.s * (0.6 + tw), 1); f.m.material.opacity = 0.15 + tw * 0.75; }

  R.flash = Math.max(0, R.flash - rdt * 2.2);
  if (GL2 && R.quality > 0) {
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    brightMat.uniforms.t.value = rt.texture; brightMat.uniforms.px.value.set(1 / rt.width, 1 / rt.height); pass(brightMat, rtA);
    for (let i = 1; i <= 2; i++) { // dois passes de desfoque, o segundo mais largo: halos macios
      blurMat.uniforms.t.value = rtA.texture; blurMat.uniforms.dir.value.set(i * 1.6 / rtA.width, 0); pass(blurMat, rtB);
      blurMat.uniforms.t.value = rtB.texture; blurMat.uniforms.dir.value.set(0, i * 1.6 / rtA.height); pass(blurMat, rtA); }
    const u = compMat.uniforms; u.tScene.value = rt.texture; u.tDepth.value = rt.depthTexture; u.tBloom.value = rtA.texture;
    u.time.value = time % 100; u.flash.value = R.flash; u.gray.value += ((S.mode === 'lose' ? 0.75 : 0) - u.gray.value) * Math.min(1, rdt * 3);
    pass(compMat, null);
  } else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
};
// projeta um ponto do mundo na tela (0..1), para efeitos de interface como a íris
R.toScreen = (x, y) => { const v = new THREE.Vector3(x, Y(y), 0).project(camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; };
})();
