// Timtim e os Pugs — regras do jogo (física, inimigos, chefão, fluxo). Sem nada de desenho aqui.
(() => {
'use strict';
const TT = window.TT = window.TT || {};

const C = TT.C = {
  W: 960, H: 540, GROUND: 452, GRAV: 2300, JUMP_V: -860, RUN: 310, TIME: 120, FAST: 440,
  LEVEL_END: 9800, ARENA_X: 8840,
  grounds: [[0, 1250], [1400, 1000], [2520, 820], [3480, 1100], [4740, 900], [5830, 760], [6820, 700], [7680, 2120]],
  plats: [
    [520, 340, 160], [820, 270, 140], [1180, 330, 150], [1700, 330, 180], [1960, 250, 140],
    [2380, 330, 160], [2850, 320, 140], [3100, 240, 160], [3330, 330, 120], [3800, 320, 200],
    [4150, 250, 160], [4400, 330, 150], [4620, 300, 120], [5150, 320, 180], [5480, 250, 140],
    [5700, 300, 110], [5950, 320, 170], [6230, 230, 150], [6470, 140, 130], [6660, 300, 110], [6950, 320, 160], [7200, 235, 140],
    [7420, 150, 130], [7560, 300, 100], [7900, 320, 180], [8200, 250, 140],
  ],
  checkpoints: [3560, 5880, 8660],
  // amigos chihuahuas que esperam no caminho e entregam biscoito
  friends: [{ x: 1452, kind: 'chi-pb' }, { x: 4792, kind: 'chi-br' }], GIFT: 3,
};
const { W, H, GROUND, GRAV, JUMP_V, RUN, FAST, LEVEL_END, ARENA_X } = C;

// ---- eventos (o jogo avisa; som, tela e interface reagem) ----
const handlers = {};
TT.on = (n, f) => { (handlers[n] = handlers[n] || []).push(f); };
const emit = TT.emit = (n, d) => { (handlers[n] || []).forEach(f => f(d || {})); };

TT.input = { left: false, right: false, jump: false, jumpPressed: false };

function makeItems() {
  const it = [];
  const cookie = (x, y) => it.push({ type: 'cookie', x, y, got: false });
  [300, 360, 420].forEach(x => cookie(x, GROUND - 40));
  [560, 600, 640].forEach(x => cookie(x, 300));
  cookie(890, 230); cookie(1225, 290);
  for (let x = 1290; x <= 1370; x += 40) cookie(x, 330);
  [1740, 1790, 1840].forEach(x => cookie(x, 290));
  cookie(2030, 210); cookie(2430, 290);
  for (let x = 2620; x <= 2820; x += 50) cookie(x, GROUND - 40);
  [3140, 3190, 3240].forEach(x => cookie(x, 200));
  [3870, 3920, 3970].forEach(x => cookie(x, 280));
  cookie(4220, 210); cookie(4680, 260);
  for (let x = 4850; x <= 5050; x += 50) cookie(x, GROUND - 40);
  [5520, 5570].forEach(x => cookie(x, 210));
  cookie(5755, 260); [5990, 6040, 6090].forEach(x => cookie(x, 280)); cookie(6300, 190); cookie(6535, 100); cookie(6715, 260);
  for (let x = 6880; x <= 7080; x += 50) cookie(x, GROUND - 40);
  cookie(7270, 195); cookie(7485, 110); [7950, 8000, 8050].forEach(x => cookie(x, 280)); cookie(8270, 210);
  for (let x = 8350; x <= 8550; x += 50) cookie(x, GROUND - 40);
  // biscoitos dourados: só o pulo duplo alcança
  [[1325, 165], [3410, 70], [7610, 40]].forEach(([x, y]) => it.push({ type: 'gold', x, y, got: false }));
  it.push({ type: 'banana', x: 7270, y: 150, got: false });
  it.push({ type: 'banana', x: 2010, y: 205, got: false });
  it.push({ type: 'monkey', x: 4220, y: 170, got: false });
  it.push({ type: 'banana', x: 5550, y: 160, got: false });
  return it;
}
function makeEnemies() {
  return [[900, 700, 1150], [1700, 1570, 2300], [2700, 2560, 3300], [3700, 3520, 4500], [4300, 4150, 4300], [5100, 4930, 5600], [6100, 5860, 6560], [7100, 6840, 7500], [8100, 7700, 8700]]
    .map(([x, a, b]) => ({ x, y: GROUND - 30, w: 38, h: 30, a, b, dir: -1, alive: true, t: Math.random() * 6, dy: 0 }));
}
function makePugs() {
  return [
    { name: 'Pug nº 1', x: ARENA_X + 640, y: GROUND - 56, w: 74, h: 56, vx: 0, vy: 0, dir: -1, hp: 3, stun: 0, cd: 1.2, hurt: 0, spin: 0, wind: 0, landT: 0, turnT: 0 },
    { name: 'Pug nº 2', x: ARENA_X + 790, y: GROUND - 56, w: 74, h: 56, vx: 0, vy: 0, dir: -1, hp: 3, stun: 0, cd: 2.4, hurt: 0, spin: 0, wind: 0, landT: 0, turnT: 0 },
  ];
}
function makePlayer(x) {
  return { x, y: GROUND - 60, w: 54, h: 50, vx: 0, vy: 0, onGround: false, face: 1, hp: 3, inv: 0, fast: 0, mega: 0,
    safeX: x, coyote: 0, buffer: 0, landT: 0, won: false, hurtT: 0, dj: true, djT: 0 };
}

const SOLIDS = [];
for (const [x, w] of C.grounds) SOLIDS.push({ x, y: GROUND, w, h: 200, oneWay: false });
for (const [x, y, w] of C.plats) SOLIDS.push({ x, y, w, h: 18, oneWay: true });
TT.SOLIDS = SOLIDS;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const S = TT.S = { mode: 'title' };
function reset() {
  Object.assign(S, {
    player: makePlayer(120), items: makeItems(), enemies: makeEnemies(), pugs: makePugs(),
    cam: { x: 0, y: 0, look: 0 }, time: 0, clock: 0, cookies: 0, arena: false, trauma: 0, hitstop: 0,
    gold: 0, timeScale: 1, slowT: 0, cine: null, checkpoint: -1, bossSeen: false, hpLost: 0, winT: 0, dustT: 0, ckTime: 0, timeout: false,
    friends: C.friends.map(f => ({ x: f.x, home: f.x, vx: 0, follow: 0, kind: f.kind, given: false, hop: 0, face: -1, t: 0 })), gifts: [],
  });
  S.totalCookies = S.items.filter(i => i.type === 'cookie').length + C.friends.length * C.GIFT;
}
reset();

TT.start = () => { reset(); S.mode = 'play'; emit('start'); emit('banner', { text: 'Os pugs da bruxa estão infernizando a vila…' }); };
TT.retry = () => {
  if (S.checkpoint < 0) return TT.start();
  const x = C.checkpoints[S.checkpoint];
  S.player = makePlayer(x); S.player.inv = 1.6; S.pugs = makePugs(); S.arena = false; S.cine = null; S.timeScale = 1; S.slowT = 0; S.hitstop = 0; S.gifts = [];
  S.cam.x = Math.max(0, x - W * 0.4); S.cam.look = 0; S.mode = 'play'; S.timeout = false; S.time = Math.min(S.ckTime, C.TIME - 45);
  emit('start', { retry: true }); emit('banner', { text: 'De volta ao checkpoint!' });
};
TT.pause = () => { if (S.mode === 'play') { S.mode = 'pause'; emit('pause'); } };
TT.resume = () => { if (S.mode === 'pause') { S.mode = 'play'; emit('resume'); } };

function stats() {
  const allCookies = S.cookies >= Math.ceil(S.totalCookies * 0.8), noHit = S.hpLost === 0, allGold = S.gold >= 3;
  return { cookies: S.cookies, total: S.totalCookies, time: S.time, hpLost: S.hpLost, gold: S.gold, allCookies, noHit, allGold, stars: 1 + (allCookies ? 1 : 0) + (allGold ? 1 : 0) };
}

function hurt() {
  const p = S.player;
  if (p.inv > 0 || p.mega > 0 || S.mode !== 'play') return;
  p.hp--; S.hpLost++; p.inv = 1.6; p.hurtT = 0.5; S.trauma = Math.min(1, S.trauma + 0.6); S.hitstop = 0.08;
  p.vy = -500; p.vx = -p.face * 260;
  emit('hurt', { x: p.x + p.w / 2, y: p.y });
  if (p.hp <= 0) { S.mode = 'lose'; emit('lose', stats()); }
}

// ---------------- atualização ----------------
TT.update = (rdt) => {
  S.trauma = Math.max(0, S.trauma - rdt * 1.4);
  if (!['play', 'winning', 'win', 'lose'].includes(S.mode)) return;
  if (S.hitstop > 0) { S.hitstop -= rdt; return; } // congela um instante no impacto
  if (S.slowT > 0) { S.slowT -= rdt; S.timeScale = S.slowT > 0 ? 0.2 : 1; }
  const dt = rdt * S.timeScale;
  S.clock += dt;
  if (S.cine) { S.cine.t += rdt; if (S.cine.t >= S.cine.dur) { S.cine = null; emit('cineEnd'); } }
  const playing = S.mode === 'play', locked = !playing || !!S.cine;
  if (playing && !S.cine) S.time += dt;
  if (playing && !S.winT && S.time >= C.TIME) { S.timeout = true; S.mode = 'lose'; emit('lose', stats()); return; }
  if (S.mode === 'winning') {
    S.winT += rdt;
    if (S.winT > 0.9 && S.player.onGround) S.player.won = true;
    if (S.winT > 2.4) { S.mode = 'win'; S.player.won = true; emit('win', stats()); }
  }

  const p = S.player, I = TT.input;
  p.inv = Math.max(0, p.inv - dt); p.fast = Math.max(0, p.fast - dt); p.mega = Math.max(0, p.mega - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);

  const speed = p.fast > 0 || p.mega > 0 ? FAST : RUN;
  const dir = locked ? 0 : (I.right ? 1 : 0) - (I.left ? 1 : 0);
  const target = dir * speed, accel = p.onGround ? 2600 : 1900;
  if (p.vx < target) p.vx = Math.min(target, p.vx + accel * dt);
  else if (p.vx > target) p.vx = Math.max(target, p.vx - accel * dt);
  if (dir) p.face = dir;

  p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
  const pressedNow = !locked && I.jumpPressed;
  p.buffer = pressedNow ? 0.12 : Math.max(0, p.buffer - dt);
  I.jumpPressed = false;
  if (p.onGround) p.dj = true;
  p.djT = Math.max(0, p.djT - dt);
  if (p.buffer > 0 && p.coyote > 0) { p.vy = JUMP_V; p.coyote = 0; p.buffer = 0; p.onGround = false; emit('jump', { x: p.x + p.w / 2, y: p.y + p.h }); }
  else if (pressedNow && !p.onGround && p.dj) { // pulo duplo: uma pirueta no ar
    p.dj = false; p.buffer = 0; p.vy = JUMP_V * 0.86; p.djT = 0.42; if (dir) p.vx = dir * Math.max(Math.abs(p.vx), speed * 0.8);
    emit('jump2', { x: p.x + p.w / 2, y: p.y + p.h / 2 });
  }
  if ((locked || !I.jump) && p.vy < -300) p.vy += GRAV * 1.4 * dt; // pulo variável
  const hang = !p.onGround && I.jump && !locked && Math.abs(p.vy) < 130 ? 0.55 : 1; // flutua um instante no topo do pulo
  p.vy = Math.min(p.vy + GRAV * hang * dt, 1200);

  p.x += p.vx * dt;
  p.x = Math.max(S.arena ? ARENA_X + 4 : 0, Math.min(LEVEL_END - p.w - 4, p.x));
  for (const s of SOLIDS) if (!s.oneWay && overlap(p, s)) { if (p.vx > 0) p.x = s.x - p.w; else if (p.vx < 0) p.x = s.x + s.w; }
  const prevBottom = p.y + p.h;
  p.y += p.vy * dt;
  const wasGround = p.onGround; p.onGround = false;
  for (const s of SOLIDS) {
    if (!overlap(p, s)) continue;
    if (s.oneWay) { if (p.vy >= 0 && prevBottom <= s.y + 2) { p.y = s.y - p.h; p.vy = 0; p.onGround = true; } }
    else if (p.vy >= 0) { p.y = s.y - p.h; p.vy = 0; p.onGround = true; }
    else { p.y = s.y + s.h; p.vy = 0; }
  }
  if (p.onGround && !wasGround) { p.landT = 0.18; emit('land', { x: p.x + p.w / 2, y: p.y + p.h }); }
  p.landT = Math.max(0, p.landT - dt);
  if (p.onGround && p.y + p.h >= GROUND - 1) p.safeX = p.x;
  S.dustT -= dt;
  if (p.onGround && Math.abs(p.vx) > 160 && S.dustT <= 0) { S.dustT = 0.06; emit('dust', { x: p.x + p.w / 2 - p.face * 14, y: p.y + p.h, dir: -p.face }); }

  // buraco
  if (p.y > H + 80) {
    if (!playing) { p.y = H + 80; p.vy = 0; }
    else {
      p.hp--; S.hpLost++; S.trauma = 0.6; emit('hurt', { x: p.x, y: H });
      if (p.hp <= 0) { S.mode = 'lose'; emit('lose', stats()); }
      else Object.assign(p, { x: p.safeX - 40 * p.face, y: GROUND - 160, vx: 0, vy: 0, inv: 1.6 });
    }
  }

  if (playing) {
    // checkpoints
    C.checkpoints.forEach((cx, i) => { if (i > S.checkpoint && p.x > cx) { S.checkpoint = i; S.ckTime = S.time; emit('checkpoint', { index: i, x: cx }); } });
    // itens
    for (const it of S.items) {
      if (it.got) continue;
      const box = { x: it.x - 20, y: it.y - 20, w: 40, h: 40 };
      if (!overlap(p, box)) continue;
      it.got = true;
      if (it.type === 'cookie') { S.cookies++; emit('cookie', it); }
      if (it.type === 'gold') { S.gold++; emit('power', it); emit('banner', { text: 'Biscoito dourado! ' + S.gold + ' de 3' }); }
      if (it.type === 'banana') { p.fast = 7; emit('power', it); emit('banner', { text: 'Banana de pelúcia: turbo!' }); }
      if (it.type === 'monkey') { p.mega = 8; p.hp = Math.min(3, p.hp + 1); emit('power', it); emit('banner', { text: 'Macaco de pelúcia: invencível!' }); }
    }
  }

  // amigos: quando o Timtim chega perto, dão um pulinho e jogam um biscoito de presente
  const pcx = p.x + p.w / 2;
  for (const f of S.friends) {
    f.t += dt; f.hop = Math.max(0, f.hop - dt); f.follow = Math.max(0, f.follow - dt);
    // corre ao encontro do Timtim, acompanha uns passos depois do presente e volta para o seu lugar
    const seen = playing && Math.abs(pcx - f.home) < 460, chase = seen && (!f.given || f.follow > 0);
    const goal = Math.max(f.home - 20, Math.min(f.home + 280, chase ? pcx - Math.sign(pcx - f.x) * 70 : f.home));
    const want = f.hop > 0.35 || Math.abs(goal - f.x) < 10 ? 0 : Math.sign(goal - f.x) * (chase || !playing ? 260 : 130);
    f.vx += (want - f.vx) * Math.min(1, dt * 9); f.x += f.vx * dt;
    if (Math.abs(f.vx) > 30) f.face = Math.sign(f.vx); else if (seen || !playing) f.face = pcx < f.x ? -1 : 1;
    if (playing && !f.given && Math.abs(pcx - f.x) < 120) {
      f.given = true; f.hop = 0.9; f.follow = 3.2; S.gifts.push({ sx: f.x + f.face * 18, sy: GROUND - 58, x: f.x, y: GROUND - 58, t: 0, kind: S.friends.indexOf(f) });
      emit('friend', { x: f.x, y: GROUND - 70 });
    }
  }
  for (let i = S.gifts.length - 1; i >= 0; i--) {
    const g = S.gifts[i]; g.t += dt / 0.8; const k = Math.min(1, g.t), e = k * k * (3 - 2 * k);
    g.x = g.sx + (pcx - g.sx) * e; g.y = g.sy + (p.y + p.h / 2 - g.sy) * e - Math.sin(k * Math.PI) * 110;
    if (k >= 1) {
      S.gifts.splice(i, 1); S.cookies += C.GIFT; p.hp = Math.min(3, p.hp + 1);
      if (g.kind === 0) p.fast = 8; else p.mega = 9;
      emit('gift', { x: g.x, y: g.y }); emit('power', g); emit('banner', { text: g.kind === 0 ? 'Poder do amigo: turbo!' : 'Poder do amigo: invencível!' });
    }
  }

  // pombos
  for (const e of S.enemies) {
    if (!e.alive) { e.dy += GRAV * dt; e.y += e.dy * dt; continue; }
    e.t += dt; e.x += e.dir * 70 * dt;
    if (e.x < e.a) { e.x = e.a; e.dir = 1; } if (e.x > e.b) { e.x = e.b; e.dir = -1; }
    if (!playing || !overlap(p, e)) continue;
    if (p.mega > 0 || (p.vy > 0 && prevBottom <= e.y + 14)) {
      e.alive = false; e.dy = -400; S.hitstop = 0.05; S.trauma = Math.min(1, S.trauma + 0.25);
      if (p.mega <= 0) p.vy = -560;
      emit('stomp', { x: e.x + e.w / 2, y: e.y, boss: false });
    } else hurt();
  }

  // arena
  if (playing && !S.arena && p.x > ARENA_X + 120) {
    S.arena = true;
    if (!S.bossSeen) { S.bossSeen = true; S.cine = { type: 'boss', t: 0, dur: 3.4, barks: 0 }; emit('bossIntro'); }
    else emit('banner', { text: 'Revanche contra os Pugs!' });
  }
  if (S.arena) updatePugs(dt, prevBottom, playing);

  // câmera
  const cam = S.cam;
  cam.look += (p.vx * 0.32 - cam.look) * Math.min(1, dt * 2.5);
  const want = S.arena ? ARENA_X : Math.max(0, Math.min(ARENA_X, p.x - W * 0.4 + cam.look));
  cam.x += (want - cam.x) * Math.min(1, dt * 5);
  const wantY = S.arena ? Math.max(-60, Math.min(0, (p.y + p.h - (GROUND - 150)) * 0.3)) : Math.max(-150, Math.min(0, (p.y + p.h - (GROUND - 70)) * 0.42));
  cam.y += (wantY - cam.y) * Math.min(1, dt * 3.4);
};

function updatePugs(dt, prevBottom, playing) {
  const p = S.player, alive = S.pugs.filter(g => g.hp > 0);
  const cine = S.cine && S.cine.type === 'boss' ? S.cine : null;
  if (cine) { // os dois latem para a câmera
    const n = cine.t > 1.7 ? 2 : cine.t > 1.0 ? 1 : 0;
    if (n > cine.barks) { cine.barks = n; S.pugs.forEach((g, i) => { if (i === (n + 1) % 2 || n === 2) g.vy = -380; }); emit('bark'); S.trauma = Math.min(1, S.trauma + 0.2); }
  }
  for (const g of S.pugs) {
    if (g.hp <= 0) { g.vy += GRAV * dt; g.y += g.vy * dt; g.x += g.vx * dt; g.spin += dt * 9; continue; }
    g.hurt = Math.max(0, g.hurt - dt); g.landT = Math.max(0, g.landT - dt); g.turnT = Math.max(0, g.turnT - dt);
    const rage = alive.length === 1 ? 1.5 : 1;
    const onGround = g.y + g.h >= GROUND - 0.5;
    if (g.stun > 0) { g.stun -= dt; g.vx *= 0.9; g.wind = 0; }
    else if (!cine && playing) {
      const nd = Math.sign(p.x - g.x) || g.dir;
      if (nd !== g.dir && g.wind <= 0 && onGround) { g.dir = nd; g.turnT = 0.2; }
      if (g.wind > 0) { // agacha antes de investir: dá para ler o ataque
        g.wind -= dt; g.vx *= 0.8;
        if (g.wind <= 0) { g.vx = g.dir * (300 + 60 * (3 - g.hp)) * rage; g.vy = Math.random() < 0.45 ? -620 : -260; g.cd = (1.4 + Math.random()) / rage; emit('bark'); }
      } else {
        g.cd -= dt;
        if (g.cd <= 0 && onGround) g.wind = 0.34 / rage;
        else if (onGround) g.vx += (g.dir * 90 * rage - g.vx) * Math.min(1, dt * 3);
      }
    } else g.vx *= 0.9;
    g.vy += GRAV * dt; g.x += g.vx * dt; g.y += g.vy * dt;
    if (g.y + g.h > GROUND) { if (g.vy > 350) { g.landT = 0.24; emit('pugLand', { x: g.x + g.w / 2, y: GROUND }); } g.y = GROUND - g.h; g.vy = 0; }
    if (g.x < ARENA_X + 10) { g.x = ARENA_X + 10; g.vx = Math.abs(g.vx); }
    if (g.x + g.w > ARENA_X + W - 10) { g.x = ARENA_X + W - 10 - g.w; g.vx = -Math.abs(g.vx); }

    if (!playing || cine) continue;
    const hb = { x: g.x + 6, y: g.y + 6, w: g.w - 12, h: g.h - 6 };
    if (!overlap(p, hb)) continue;
    if (g.stun <= 0.6 && p.vy > 0 && prevBottom <= g.y + 22) {
      g.hp--; g.stun = 1.1; g.hurt = 0.4; g.vx = 0; p.vy = -700;
      S.hitstop = 0.1; S.trauma = Math.min(1, S.trauma + 0.5);
      emit('stomp', { x: g.x + g.w / 2, y: g.y, boss: true, pug: g });
      if (g.hp <= 0) {
        g.vy = -620; g.vx = -g.dir * 260;
        if (S.pugs.every(q => q.hp <= 0)) { S.mode = 'winning'; S.winT = 0; S.slowT = 0.75;
          S.friends.forEach((f, i) => { f.x = S.cam.x - 60 - i * 90; f.home = Math.max(ARENA_X + 60, p.x - 120 - i * 85) + (p.x < ARENA_X + 300 ? 330 : 0); f.vx = 0; }); emit('finalBlow', { x: g.x + g.w / 2, y: g.y }); }
        else emit('banner', { text: g.name + ' foi pra casa!' });
      }
    } else if (g.stun <= 0) {
      if (p.mega > 0) { g.vx = -g.dir * 400; g.vy = -300; g.stun = 0.8; emit('stomp', { x: g.x + g.w / 2, y: g.y, boss: false }); }
      else hurt();
    }
  }
}
})();
