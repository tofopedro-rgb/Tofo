// Renderização 2.5D de verdade: cenário 3D com câmera em perspectiva, personagens como sprites em pé no mundo,
// sombras projetadas, neblina, e pós-processamento (profundidade de campo, bloom, correção de cor, vinheta).
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
scene.background = new THREE.Color(0x7db6f2);
scene.fog = new THREE.Fog(0xf3e4d0, 1700, 9500);
const FOV = 28, CAM_D = (H / 2) / Math.tan(FOV * Math.PI / 360), CAM_Y = 272, LOOK_Y = 176;
const camera = new THREE.PerspectiveCamera(FOV, W / H, 60, 12000);

// ---------------- texturas ----------------
THREE.DefaultLoadingManager.onLoad = () => { R.ready = true; TT.emit('assetsReady'); };
const TL = new THREE.TextureLoader();
const load = p => { const t = TL.load('assets/' + p); t.anisotropy = 4; return t; };
const AR = { 'tintim-idle': 232 / 220, 'tintim-run': 258 / 200, 'tintim-jump': 270 / 200, 'tintim-fall': 240 / 220, 'tintim-hurt': 218 / 220,
  'tintim-win': 189 / 240, 'pug-walk': 269 / 200, 'pug-charge': 309 / 200, 'pug-stun': 313 / 130, pigeon: 138 / 120, monkey: 126 / 140,
  banana: 1, cookie: 129 / 90 };
const TEX = {};
for (const k in AR) TEX[k] = load('sprites/' + k + '.png');
TEX['tintim-run'].repeat.set(0.25, 1);
const texFar = load('bg/far.jpg'), texMid = load('bg/mid.png'), texArena = load('bg/arena.jpg');

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speckle(x, w, h, n, colors, r = 1.4) {
  for (let i = 0; i < n; i++) { x.fillStyle = colors[i % colors.length]; x.globalAlpha = 0.1 + Math.random() * 0.25;
    x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * r + 0.3, 0, 7); x.fill(); }
  x.globalAlpha = 1;
}
const texTile = canvasTex(512, 512, (x, w, h) => { // lajotas de pedra clara com rejunte
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const l = 80 + ((i * 2 + j) * 37 % 5); x.fillStyle = `hsl(34, 34%, ${l}%)`; x.fillRect(i * 256, j * 256, 256, 256);
    const g = x.createLinearGradient(i * 256, j * 256, i * 256 + 256, j * 256 + 256);
    g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(120,80,40,.10)'); x.fillStyle = g; x.fillRect(i * 256, j * 256, 256, 256);
  }
  speckle(x, w, h, 2600, ['#b89a74', '#fff6e4', '#a58a66']);
  x.strokeStyle = 'rgba(120,92,62,.75)'; x.lineWidth = 5;
  [0, 256, 512].forEach(p => { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.moveTo(0, p); x.lineTo(w, p); x.stroke(); });
  x.strokeStyle = 'rgba(255,250,235,.5)'; x.lineWidth = 1.5;
  [5, 261].forEach(p => { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.moveTo(0, p); x.lineTo(w, p); x.stroke(); });
}, true);
const texSand = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#e7c489'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { x.fillStyle = i % 2 ? 'rgba(255,236,190,.16)' : 'rgba(170,120,60,.10)';
    x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 70, 8 + Math.random() * 12, 0, 0, 7); x.fill(); }
  speckle(x, w, h, 5000, ['#c9a064', '#fff2cf', '#b98d52'], 1.1);
}, true);
const texWood = canvasTex(256, 128, (x, w, h) => {
  x.fillStyle = '#a8703f'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { x.strokeStyle = i % 3 ? 'rgba(80,45,20,.18)' : 'rgba(255,220,170,.14)'; x.lineWidth = 1 + Math.random() * 1.5;
    const y = Math.random() * h; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(80, y + 4, 170, y - 4, w, y + 2); x.stroke(); }
  x.fillStyle = 'rgba(60,32,14,.55)'; [0, 42, 85].forEach(y => x.fillRect(0, y, w, 2.5));
}, true);
const texConcrete = canvasTex(256, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8d7964'); g.addColorStop(1, '#3d2f26'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  speckle(x, w, h, 1500, ['#5e4c3d', '#a8937a']);
}, true);
const texSoft = canvasTex(64, 64, x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const texStar = canvasTex(64, 64, x => { x.fillStyle = '#ffd23f'; x.strokeStyle = '#b7791f'; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 28; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); });
const texCloud = canvasTex(256, 128, x => { x.filter = 'blur(6px)'; x.fillStyle = 'rgba(255,255,255,.95)';
  [[70, 78, 44], [118, 60, 52], [170, 74, 46], [128, 88, 60], [96, 86, 40]].forEach(([a, b, r]) => { x.beginPath(); x.ellipse(a, b, r, r * 0.62, 0, 0, 7); x.fill(); }); });
const texBush = canvasTex(512, 256, x => { x.filter = 'blur(7px)';
  for (let k = 0; k < 11; k++) { const a = -Math.PI / 2 + (k - 5) * 0.24, len = 150 + (k * 37 % 70);
    x.save(); x.translate(256, 270); x.rotate(a); x.fillStyle = k % 2 ? 'rgba(20,58,32,.96)' : 'rgba(34,84,44,.96)';
    x.beginPath(); x.ellipse(len / 2, 0, len / 2, 17, 0, 0, 7); x.fill(); x.restore(); } });

// ---------------- geometria ----------------
const planeGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);           // âncora na base (pés)
const planeGeoC = new THREE.PlaneGeometry(1, 1);                                // âncora no centro
const planeGeoFlip = planeGeo.clone(); { const uv = planeGeoFlip.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
function boxUV(w, h, d, tile) { // caixa com UVs proporcionais ao tamanho (textura não estica)
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
  return g;
}
const add = (m, order) => { if (order !== undefined) m.renderOrder = order; scene.add(m); return m; };

// ---------------- mundo estático ----------------
const FLOOR_Z0 = -104, FLOOR_Z1 = 470, FD = FLOOR_Z1 - FLOOR_Z0, FZ = (FLOOR_Z0 + FLOOR_Z1) / 2;
(function buildWorld() {
  // horizonte da cidade, bem longe: o parallax vem da distância real
  const farMat = new THREE.MeshBasicMaterial({ map: texFar });
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(i % 2 ? planeGeoFlip : planeGeo, farMat); m.scale.set(2800, 1200, 1); m.position.set(i * 2800, -300, -2600); add(m); }
  // chão do abismo e fundação
  const dark = new THREE.MeshBasicMaterial({ color: 0x1d1410, fog: false });
  const pit = new THREE.Mesh(planeGeoC, dark); pit.scale.set(11000, 700, 1); pit.rotation.x = -Math.PI / 2; pit.position.set(3500, -300, 180); add(pit);
  const found = new THREE.Mesh(planeGeoC, dark); found.scale.set(11000, 300, 1); found.position.set(3500, -150, -92); add(found);
  // piso: cada trecho é um bloco; os buracos são vãos de verdade
  const side = new THREE.MeshLambertMaterial({ map: texConcrete });
  const mk = (x0, x1, top) => {
    const w = x1 - x0, g = boxUV(w, 300, FD, 180), topM = new THREE.MeshLambertMaterial({ map: top });
    const m = new THREE.Mesh(g, [side, side, topM, side, side, side]); m.position.set(x0 + w / 2, -150, FZ); m.receiveShadow = true; add(m);
  };
  C.grounds.forEach(([x, w], i) => {
    const x0 = i === 0 ? -1600 : x, x1 = x + w;
    if (x1 > ARENA_X) { mk(x0, ARENA_X, texTile); mk(ARENA_X, 8400, texSand); } else mk(x0, x1, texTile);
  });
  const curb = new THREE.Mesh(boxUV(14, 10, FD, 60), new THREE.MeshLambertMaterial({ map: texWood })); curb.position.set(ARENA_X, 4, FZ); curb.receiveShadow = true; add(curb);
  // muro do térreo com as plantas
  const wallMat = new THREE.MeshLambertMaterial({ map: texMid, transparent: true, alphaTest: 0.08 });
  const WH = 190, WW = WH * 870 / 220;
  for (let x = -1600, i = 0; x < ARENA_X - 60; x += WW, i++) {
    const m = new THREE.Mesh(i % 2 ? planeGeoFlip : planeGeo, wallMat); m.scale.set(WW + 1, WH, 1); m.position.set(x + WW / 2, -4, -90); m.receiveShadow = true; add(m, 1);
  }
  // parquinho (pintura de fundo; o chão de areia é 3D)
  const aw = 1180, ah = aw * 724 / 1280;
  const ar = new THREE.Mesh(planeGeo, new THREE.MeshLambertMaterial({ map: texArena })); ar.scale.set(aw, ah, 1); ar.position.set(ARENA_X + 480, -ah * 0.14, -88); ar.receiveShadow = true; add(ar);
  // bancos de madeira
  const wood = new THREE.MeshLambertMaterial({ map: texWood }), woodDark = new THREE.MeshLambertMaterial({ map: texWood, color: 0x9a8474 });
  for (const [x, y, w] of C.plats) {
    const m = new THREE.Mesh(boxUV(w, 16, 66, 110), [woodDark, woodDark, wood, woodDark, woodDark, woodDark]);
    m.position.set(x + w / 2, GROUND - y - 8, 0); m.castShadow = m.receiveShadow = true; add(m);
  }
  // bandeirinhas de festa junina (como a bandana do Tintim)
  const cols = [0xff6a14, 0xffd23f, 0x1fa36b, 0xe8323c, 0x3c78d8, 0xfff6e6].map(c => new THREE.Color(c));
  const pos = [], col = [], line = [];
  for (let x0 = 150; x0 < ARENA_X - 600; x0 += 760) {
    const len = 560, n = 15;
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + t * len, y = 262 - Math.sin(t * Math.PI) * 34;
      if (i > 0) line.push(x, y, -60); if (i < n) line.push(x, y, -60);
      if (i < n) { const t2 = (i + 0.8) / n, x2 = x0 + t2 * len, y2 = 262 - Math.sin(t2 * Math.PI) * 34, c = cols[i % cols.length];
        pos.push(x + 3, y, -60, x2, y2, -60, (x + x2) / 2 + 1, (y + y2) / 2 - 34, -60); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b); } }
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  add(new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
  add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5a3b22 })));
  // placa do parquinho
  const poleM = new THREE.MeshLambertMaterial({ color: 0x7a5132 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 120, 8), poleM); pole.position.set(ARENA_X - 150, 60, -45); pole.castShadow = true; add(pole);
  const signT = canvasTex(512, 192, x => { x.fillStyle = '#fff6e6'; x.fillRect(0, 0, 512, 192); x.strokeStyle = '#7a5132'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 178);
    x.fillStyle = '#7a5132'; x.font = 'bold 76px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('PARQUINHO', 256, 104); x.font = 'bold 48px system-ui'; x.fillStyle = '#ff6a14'; x.fillText('➜', 256, 162); });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(150, 56, 6), new THREE.MeshLambertMaterial({ map: signT })); sign.position.set(ARENA_X - 150, 128, -41); sign.castShadow = true; add(sign);
  // primeiro plano: folhagens desfocadas entre a câmera e o jogo
  const bushM = new THREE.MeshBasicMaterial({ map: texBush, transparent: true, depthWrite: false, fog: false });
  for (let i = 0, x = -200; x < ARENA_X - 500; i++, x += 760 + (i * 397 % 420)) {
    const m = new THREE.Mesh(planeGeo, bushM); m.scale.set(300 + (i % 3) * 60, 118, 1); m.position.set(x, -44, 350 + (i % 2) * 50); add(m, 9);
  }
})();
// nuvens passando devagar
const clouds = [];
{ const m0 = new THREE.MeshBasicMaterial({ map: texCloud, transparent: true, depthWrite: false, opacity: 0.9, fog: false });
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(planeGeoC, m0); const s = 520 + (i * 131 % 300); m.scale.set(s, s * 0.45, 1);
    m.position.set(-800 + i * 1150 + (i * 277 % 400), 420 + (i * 97 % 260), -1900); clouds.push(add(m, -5)); } }
// checkpoints: mastro com bandeira que sobe
const flags = C.checkpoints.map(x => {
  const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 130, 8), new THREE.MeshLambertMaterial({ color: 0xe9e2d6 }))); pole.position.set(x, 65, -40); pole.castShadow = true;
  const flag = add(new THREE.Mesh(planeGeoC, new THREE.MeshBasicMaterial({ color: 0x9aa0a8, side: THREE.DoubleSide }))); flag.scale.set(46, 30, 1); flag.position.set(x + 26, 40, -40);
  return { flag, up: 0, on: false };
});

// ---------------- luz e sombra ----------------
scene.add(new THREE.AmbientLight(0xfff3e4, 0.66));
const sun = new THREE.DirectionalLight(0xffedd0, 0.5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.5;
Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 620, bottom: -420, near: 100, far: 2200 });
scene.add(sun); scene.add(sun.target);

// ---------------- sprites ----------------
function sprite(name, order = 5, shadow = true) {
  const mat = new THREE.MeshBasicMaterial({ map: TEX[name], transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  const m = new THREE.Mesh(planeGeo, mat);
  if (shadow) { m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: TEX[name], alphaTest: 0.5, side: THREE.DoubleSide }); }
  m.userData.name = name; return add(m, order);
}
function setAnim(m, name, h, flip, frame = 0, n = 1) {
  if (m.userData.name !== name) { m.material.map = TEX[name]; if (m.customDepthMaterial) m.customDepthMaterial.map = TEX[name]; m.userData.name = name; }
  if (n > 1) TEX[name].offset.x = frame / n;
  m.scale.set(h * AR[name] * (flip ? -1 : 1), h, 1);
}
const glowMat = c => new THREE.MeshBasicMaterial({ map: texSoft, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const tintim = sprite('tintim-idle', 6);
const aura = add(new THREE.Mesh(planeGeoC, glowMat(0xffaa33)), 5); aura.visible = false;
const pugM = [0, 1].map(i => { const m = sprite('pug-walk', 5); if (i) m.material.color.set(0xd6c2b4);
  m.userData.stars = [0, 1, 2].map(() => { const s = add(new THREE.Mesh(planeGeoC, new THREE.MeshBasicMaterial({ map: texStar, transparent: true, depthWrite: false })), 7); s.scale.set(16, 16, 1); s.visible = false; return s; });
  return m; });
const pigeonM = S.enemies.map(() => sprite('pigeon', 5));
const itemM = S.items.map(it => { const m = sprite(it.type, 5); m.geometry = planeGeoC;
  if (it.type !== 'cookie') { const g = add(new THREE.Mesh(planeGeoC, glowMat(it.type === 'monkey' ? 0xff8a2a : 0xffe14d)), 4); m.userData.glow = g; }
  return m; });
let runPhase = 0;

// ---------------- partículas ----------------
const POOL = 150, parts = [], pmesh = [];
for (let i = 0; i < POOL; i++) { const m = add(new THREE.Mesh(planeGeoC, new THREE.MeshBasicMaterial({ map: texSoft, transparent: true, depthWrite: false })), 7); m.visible = false; pmesh.push(m); }
function spawn(o) { if (parts.length < POOL) parts.push(Object.assign({ vx: 0, vy: 0, g: 900, life: 0.6, r: 4, grow: 0, color: 0xffffff, z: 8, hard: false }, o)); }
function burst(x, y, colors, n, spd = 260) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random() * 0.7);
    spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.5 + Math.random() * 0.4, r: 3 + Math.random() * 4, color: colors[i % colors.length], hard: true }); }
}
const dustPuff = (x, y, n, spread) => { for (let i = 0; i < n; i++) spawn({ x, y: y - 2, vx: (Math.random() - 0.5) * spread, vy: -20 - Math.random() * 50, g: -30, life: 0.5, r: 4 + Math.random() * 4, grow: 12, color: 0xefe3d0 }); };
TT.on('dust', e => spawn({ x: e.x, y: e.y - 2, vx: e.dir * (30 + Math.random() * 50), vy: -30 - Math.random() * 40, g: -40, life: 0.45, r: 4 + Math.random() * 4, grow: 14, color: 0xefe3d0 }));
TT.on('land', e => dustPuff(e.x, e.y, 10, 260));
TT.on('jump', e => dustPuff(e.x, e.y, 5, 120));
TT.on('cookie', e => burst(e.x, e.y, [0xffd98a, 0xe2a55a, 0xfff2c8], 8, 170));
TT.on('power', e => burst(e.x, e.y, [0xffe14d, 0xff8a2a, 0xffffff], 24, 320));
TT.on('hurt', e => burst(e.x, e.y + 20, [0xff5a6e, 0xffffff], 12, 240));
TT.on('stomp', e => { burst(e.x, e.y, [0xfff2c8, 0xffd23f, 0xffffff], e.boss ? 22 : 12, e.boss ? 380 : 260); dustPuff(e.x, e.y + 40, 6, 300); });
TT.on('finalBlow', e => { R.flash = 0.85; burst(e.x, e.y, [0xffd23f, 0xff6a14, 0xffffff, 0x1fa36b], 40, 520); });
TT.on('checkpoint', e => { flags[e.index].on = true; burst(e.x, GROUND - 110, [0xff6a14, 0xffd23f, 0x1fa36b], 16, 240); });
TT.on('start', e => { parts.length = 0; R.flash = 0; R.zoom = 1; if (!e.retry) flags.forEach(f => { f.on = false; f.up = 0; }); });
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
    float l = dot(c, vec3(.299, .587, .114)); gl_FragColor = vec4(c * smoothstep(.74, 1., l), 1.); }` });
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
      // profundidade de campo: o plano do jogo fica nítido; o horizonte e o chão perto da câmera desfocam
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
    col += texture2D(tBloom, vUv).rgb * .42;                         // bloom
    float l = dot(col, vec3(.299, .587, .114));
    col = mix(vec3(l), col, 1.14 * (1. - gray));                     // saturação
    col = mix(col, col * col * (3. - 2. * col), .32);                // contraste suave
    col *= vec3(1.035, 1., .96);                                     // luz de fim de tarde
    vec2 q = vUv - .5; col *= 1. - dot(q, q) * .62;                  // vinheta
    col += (hash(vUv * res + time) - .5) * .016;                     // grão fino
    gl_FragColor = vec4(mix(col, vec3(1.), flash), 1.);
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
R.setQuality = q => { R.quality = Math.max(0, Math.min(2, q)); sun.castShadow = R.quality > 0; compMat.uniforms.dof.value = R.quality > 1 ? 1 : 0; R.resize(); };
addEventListener('resize', R.resize); R.resize();

// ---------------- quadro a quadro ----------------
const Y = y => GROUND - y;
R.zoom = 1; let fxS = W / 2, fyS = LOOK_Y, time = 0;
const ease = t => t * t * (3 - 2 * t);
R.frame = (rdt) => {
  time += rdt;
  const p = S.player, clock = S.clock;

  // Tintim
  const moving = Math.abs(p.vx) > 20 && p.onGround, fast = p.fast > 0 || p.mega > 0;
  if (moving && S.hitstop <= 0) runPhase += Math.abs(p.vx) * rdt * S.timeScale / 26; // passo acompanha a velocidade: as patas não patinam
  let name = 'tintim-idle', h = 80, fr = 0, nf = 1;
  if (p.won) { name = 'tintim-win'; h = 92; }
  else if (p.hurtT > 0 || S.mode === 'lose') name = 'tintim-hurt';
  else if (!p.onGround) { if (p.vy < 0) { name = 'tintim-jump'; h = 66; } else { name = 'tintim-fall'; h = 78; } }
  else if (moving) { name = 'tintim-run'; h = 72; nf = 4; fr = Math.floor(runPhase) % 4; }
  setAnim(tintim, name, h, p.face < 0, fr, nf);
  const squash = p.landT > 0 ? 1 - p.landT * 0.8 : (!p.onGround ? 1.06 : 1 + Math.sin(clock * 3) * 0.015);
  tintim.scale.x *= 2 - squash; tintim.scale.y *= squash;
  tintim.position.set(p.x + p.w / 2, Y(p.y + p.h) - 2 + (moving ? Math.abs(Math.sin(runPhase * Math.PI / 2)) * 3 : 0), 3);
  tintim.rotation.z = p.won ? 0 : p.onGround ? -(p.vx / C.FAST) * 0.05 : -Math.max(-0.28, Math.min(0.28, p.vy / 2600)) * p.face;
  tintim.visible = !(p.inv > 0 && Math.floor(time * 20) % 2);
  aura.visible = p.mega > 0 || p.fast > 0;
  if (aura.visible) { aura.position.set(tintim.position.x, tintim.position.y + 38, 1); const s = 120 + Math.sin(time * 9) * 12; aura.scale.set(s, s, 1);
    if (p.mega > 0) aura.material.color.setHSL((time * 0.9) % 1, 1, 0.5); else aura.material.color.set(0xffd23f); aura.material.opacity = p.mega > 0 ? 0.75 : 0.4; }

  // pugs
  S.pugs.forEach((g, i) => {
    const m = pugM[i], x = g.x + g.w / 2, flip = g.dir > 0;
    let n = 'pug-walk', ph = 86, y = Y(g.y + g.h) - 3;
    if (g.hp <= 0) { n = 'pug-stun'; ph = 56; }
    else if (g.stun > 0) { n = 'pug-stun'; ph = 56; }
    else if (g.y + g.h < GROUND - 4 || Math.abs(g.vx) > 200) n = 'pug-charge';
    else y += Math.abs(Math.sin(clock * 10 + i)) * 3;
    setAnim(m, n, ph, flip);
    if (g.stun > 0 && g.hp > 0) m.scale.y *= 0.85 + Math.min(0.15, (1.1 - g.stun) * 0.5);
    m.position.set(x, y, i * 1.5); m.rotation.z = g.hp <= 0 ? g.spin : 0;
    m.visible = !(g.hurt > 0 && Math.floor(time * 30) % 2) && (S.arena || S.cam.x > ARENA_X - W - 200) && g.y < H + 300;
    m.userData.stars.forEach((s, k) => { s.visible = g.stun > 0 && g.hp > 0; if (s.visible) { const a = time * 6 + k * 2.1; s.position.set(x - g.dir * 26 + Math.cos(a) * 22, y + 62 + Math.sin(a) * 6, 4 + Math.sin(a)); s.rotation.z = a; } });
  });
  // pombos
  S.enemies.forEach((e, i) => {
    const m = pigeonM[i]; setAnim(m, 'pigeon', 46, e.dir > 0);
    m.position.set(e.x + e.w / 2, Y(e.y + e.h) - 2 + (e.alive ? Math.abs(Math.sin(e.t * 12)) * 3 : 0), 0);
    m.rotation.z = e.alive ? 0 : Math.PI; m.visible = e.y < H + 200; m.castShadow = e.alive;
  });
  // itens: flutuam e balançam como objetos no espaço
  S.items.forEach((it, i) => {
    const m = itemM[i]; m.visible = !it.got; const g = m.userData.glow; if (g) g.visible = !it.got;
    if (it.got) return;
    const hh = it.type === 'cookie' ? 27 : it.type === 'banana' ? 46 : 54, bob = Math.sin(clock * 4 + it.x) * 4;
    m.scale.set(hh * AR[it.type], hh, 1); m.position.set(it.x, Y(it.y) + bob, 0);
    m.rotation.y = Math.sin(clock * 2.2 + it.x * 0.01) * (it.type === 'cookie' ? 0.75 : 0.4); m.rotation.z = Math.sin(clock * 3 + it.x) * 0.12;
    if (g) { const s = 92 + Math.sin(clock * 6) * 10; g.scale.set(s, s, 1); g.position.set(it.x, Y(it.y) + bob, -2); g.material.opacity = 0.55; }
  });
  // bandeiras de checkpoint
  flags.forEach((f, i) => { f.up += ((f.on ? 1 : 0) - f.up) * Math.min(1, rdt * 5); f.flag.position.y = 40 + f.up * 72;
    f.flag.material.color.set(f.on ? 0xff6a14 : 0x9aa0a8); f.flag.rotation.y = Math.sin(time * 5 + i) * 0.35; });
  clouds.forEach(c => { c.position.x += rdt * 9; if (c.position.x > 9800) c.position.x = -1400; });

  // partículas
  if (confettiT > 0) { confettiT -= rdt; for (let k = 0; k < 2; k++) spawn({ x: S.cam.x + Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 120, vy: 60 + Math.random() * 120, g: 160, life: 3.2, r: 4 + Math.random() * 3,
    color: [0xff6a14, 0xffd23f, 0x1fa36b, 0xe8323c, 0x3c78d8][Math.floor(Math.random() * 5)], hard: true }); }
  const pdt = rdt * S.timeScale * (S.hitstop > 0 ? 0 : 1);
  for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= pdt; if (q.life <= 0) { parts.splice(i, 1); continue; }
    q.vy += q.g * pdt; q.x += q.vx * pdt; q.y += q.vy * pdt; q.r += q.grow * pdt; }
  for (let i = 0; i < POOL; i++) { const m = pmesh[i], q = parts[i]; m.visible = !!q; if (!q) continue;
    m.position.set(q.x, Y(q.y), q.z); m.scale.set(q.r * 2.4, q.r * 2.4, 1); m.material.color.set(q.color); m.material.opacity = Math.min(1, q.life * (q.hard ? 3 : 1.6)); }

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

  R.flash = Math.max(0, R.flash - rdt * 2.2);
  if (GL2 && R.quality > 0) {
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    brightMat.uniforms.t.value = rt.texture; brightMat.uniforms.px.value.set(1 / rt.width, 1 / rt.height); pass(brightMat, rtA);
    blurMat.uniforms.t.value = rtA.texture; blurMat.uniforms.dir.value.set(1 / rtA.width, 0); pass(blurMat, rtB);
    blurMat.uniforms.t.value = rtB.texture; blurMat.uniforms.dir.value.set(0, 1 / rtA.height); pass(blurMat, rtA);
    const u = compMat.uniforms; u.tScene.value = rt.texture; u.tDepth.value = rt.depthTexture; u.tBloom.value = rtA.texture;
    u.time.value = time % 100; u.flash.value = R.flash; u.gray.value += ((S.mode === 'lose' ? 0.75 : 0) - u.gray.value) * Math.min(1, rdt * 3);
    pass(compMat, null);
  } else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
};
// projeta um ponto do mundo na tela (0..1), para efeitos de interface como a íris
R.toScreen = (x, y) => { const v = new THREE.Vector3(x, Y(y), 0).project(camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; };
})();
