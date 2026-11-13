// Interface: controles (teclado, toque, gamepad), placar, telas e transições.
(() => {
'use strict';
const TT = window.TT, S = TT.S, C = TT.C, I = TT.input;
const $ = id => document.getElementById(id);
const stage = $('stage');

// ---------------- controles ----------------
const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' };
const press = (k, on) => { if (k === 'jump' && on && !I.jump) I.jumpPressed = true; I[k] = on; };
addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { S.mode === 'pause' ? TT.resume() : TT.pause(); return; }
  if (e.code === 'KeyM') return toggleMute();
  if (e.code === 'Enter' || e.code === 'Space') {
    const b = { title: 'btnStart', pause: 'btnResume', lose: 'btnRetry', win: 'btnAgain' }[S.mode];
    if (b && $(S.mode).classList.contains('on')) { e.preventDefault(); $(b).click(); return; }
  }
  const k = keyMap[e.code]; if (!k) return; e.preventDefault(); if (!e.repeat) press(k, true);
});
addEventListener('keyup', e => { const k = keyMap[e.code]; if (k) press(k, false); });
addEventListener('blur', () => { I.left = I.right = I.jump = false; TT.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) TT.pause(); });

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) $('touch').classList.add('on');
document.querySelectorAll('.tbtn').forEach(b => {
  const k = b.dataset.k;
  const set = on => { press(k, on); b.classList.toggle('down', on); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => set(false)));
  b.addEventListener('contextmenu', e => e.preventDefault());
});
let padPrev = {};
TT.pollPad = () => {
  const gp = navigator.getGamepads && [...navigator.getGamepads()].find(g => g);
  if (!gp) return;
  const ax = gp.axes[0] || 0, b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const now = { left: ax < -0.35 || b(14), right: ax > 0.35 || b(15), jump: b(0) || b(1), start: b(9) };
  for (const k of ['left', 'right', 'jump']) if (now[k] !== !!padPrev[k]) press(k, now[k]);
  if (now.start && !padPrev.start) { if (S.mode === 'play') TT.pause(); else if (S.mode === 'pause') TT.resume(); else if (S.mode === 'title') $('btnStart').click(); }
  padPrev = now;
};

// ---------------- telas ----------------
const screens = ['title', 'pause', 'lose', 'win'];
const show = name => screens.forEach(s => $(s).classList.toggle('on', s === name));
const iris = $('iris');
function irisTo(closed, at) {
  if (at) { iris.style.setProperty('--x', (at.x * 100).toFixed(1) + '%'); iris.style.setProperty('--y', (at.y * 100).toFixed(1) + '%'); }
  iris.classList.toggle('closed', closed);
}
function irisOpenFromBlack() { iris.style.transition = 'none'; irisTo(true, { x: 0.3, y: 0.7 }); void iris.offsetWidth; iris.style.transition = ''; requestAnimationFrame(() => irisTo(false)); }

function begin(fn) { TT.audioInit(); TT.sfx('ui'); irisTo(true, { x: 0.5, y: 0.5 }); setTimeout(() => { fn(); }, 520); }
// abertura: introdução cinematográfica (src/intro.js) — três quadros com zoom lento e uma frase em cada. Qualquer toque pula.
const titleEl = $('title'), STORY = ['A Vizinha Bruxa tirou a paz da Vila de Reserva com seus Pugs barulhentos.', 'Agora cabe ao Timtim…', '…com a ajuda de seus amigos Zara e Elvis, restaurar a paz e a harmonia deste lugar.'];
const DUR = (TT.intro && TT.intro.durations) || [3.1, 3.1, 3.1];
let storyTimer = null, storyAt = 0;
function storyLine(i) { if (i >= STORY.length) return endStory(); if (TT.intro) TT.intro.scene(i); const l = $('storyLine'); l.textContent = STORY[i]; l.dataset.pos = $('introScrim').dataset.pos = (TT.intro && TT.intro.textPos[i]) || ''; l.style.setProperty('--d', DUR[i] + 's'); l.classList.remove('show'); void l.offsetWidth; l.classList.add('show'); storyTimer = setTimeout(() => storyLine(i + 1), DUR[i] * 1000); }
function endStory() { if (!titleEl.classList.contains('story') || titleEl.classList.contains('leaving')) return; clearTimeout(storyTimer); titleEl.classList.add('leaving'); begin(TT.start); }
$('btnStart').onclick = () => { if (titleEl.classList.contains('story')) return endStory(); TT.audioInit(); TT.sfx('ui'); TT.music('title'); titleEl.classList.add('story'); storyAt = performance.now(); storyLine(0); };
titleEl.addEventListener('pointerdown', () => { if (titleEl.classList.contains('story') && performance.now() - storyAt > 500) endStory(); });
const firstTouch = () => { if (S.mode === 'title') { TT.audioInit(); TT.music('title'); } removeEventListener('pointerdown', firstTouch); removeEventListener('keydown', firstTouch); };
addEventListener('pointerdown', firstTouch); addEventListener('keydown', firstTouch);
TT.on('start', () => setTimeout(() => { titleEl.classList.remove('story', 'leaving'); if (TT.intro) TT.intro.stop(); }, 600));
$('btnAgain').onclick = () => begin(TT.start);
$('btnRestart').onclick = () => begin(TT.start);
$('btnLoseRestart').onclick = () => begin(TT.start);
$('btnRetry').onclick = () => begin(TT.retry);
$('btnResume').onclick = () => TT.resume();
$('btnPause').onclick = () => TT.pause();
const toggleMute = () => { TT.setMuted(!TT.isMuted()); $('btnMute').classList.toggle('muted', TT.isMuted()); };
$('btnMute').onclick = toggleMute; $('btnMute').classList.toggle('muted', TT.isMuted());

let best = null;
try { best = JSON.parse(localStorage.getItem('tintim-best') || 'null'); } catch (_) {}
const showBest = () => { $('best').textContent = best ? `Seu recorde: ${'★'.repeat(best.stars)}${'☆'.repeat(3 - best.stars)} em ${best.time.toFixed(1)}s` : ''; };
showBest();

// ---------------- placar ----------------
const hearts = [...document.querySelectorAll('.heart')], segs = [...document.querySelectorAll('.bossRow')].map(r => [...r.querySelectorAll('.seg')]);
const last = {};
const setIf = (key, val, fn) => { if (last[key] !== val) { last[key] = val; fn(val); } };
TT.uiFrame = () => {
  const p = S.player;
  setIf('hp', p.hp, v => hearts.forEach((h, i) => h.classList.toggle('off', i >= v)));
  setIf('ck', S.cookies, v => { const n = $('cookieN'); n.textContent = v; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); });
  setIf('fast', Math.ceil(p.fast), v => { $('chipFast').classList.toggle('on', v > 0); $('chipFast').lastElementChild.textContent = v; });
  setIf('slow', Math.ceil(p.slow), v => { $('chipSlow').classList.toggle('on', v > 0); $('chipSlow').lastElementChild.textContent = v; });
  setIf('mega', Math.ceil(p.mega), v => { $('chipMega').classList.toggle('on', v > 0); $('chipMega').lastElementChild.textContent = v; });
  setIf('boss', S.arena, v => $('hr').classList.toggle('boss', v));
  if (!S.arena) setIf('prog', Math.round(Math.min(1, p.x / C.ARENA_X) * 200) / 2, v => { $('progFill').style.width = v + '%'; $('progDog').style.left = v + '%'; });
  else S.pugs.forEach((g, i) => setIf('pug' + i, g.hp, v => segs[i].forEach((s, k) => s.classList.toggle('off', k >= v))));
};

const banner = $('banner');
TT.on('banner', e => { banner.textContent = e.text; banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); });
TT.on('hurt', () => { const h = hearts[Math.max(0, S.player.hp)]; if (h) { h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit'); } });
TT.on('start', () => { show(null); $('hud').classList.add('on'); stage.classList.remove('cine'); $('bossCard').classList.remove('show'); $('cookieT').textContent = '/' + S.totalCookies; irisOpenFromBlack(); });
// balão dos amigos
const say = $('say'), LINES = ['Toma um turbo, Timtim!', 'Fica invencível, Timtim!']; let sayF = null, sayEnd = 0;
TT.on('friend', e => { sayF = S.friends.reduce((a, f) => Math.abs(f.x - e.x) < Math.abs(a.x - e.x) ? f : a); say.textContent = LINES[S.friends.indexOf(sayF) % 2]; sayEnd = performance.now() + 2600; say.classList.add('on'); });
const uiFrame0 = TT.uiFrame;
TT.uiFrame = () => { uiFrame0(); if (!sayF) return;
  if (performance.now() > sayEnd || S.mode === 'lose') { say.classList.remove('on'); sayF = null; return; }
  const at = TT.R.toScreen(sayF.x, C.GROUND - 118); say.style.left = (at.x * 100).toFixed(2) + '%'; say.style.top = (at.y * 100).toFixed(2) + '%'; };
TT.on('pause', () => show('pause'));
TT.on('resume', () => show(null));
TT.on('bossIntro', () => { stage.classList.add('cine'); setTimeout(() => $('bossCard').classList.add('show'), 650); });
TT.on('cineEnd', () => { stage.classList.remove('cine'); $('bossCard').classList.remove('show'); });
TT.on('lose', () => {
  $('loseText').textContent = S.checkpoint >= 0 ? 'Você volta do último checkpoint com os corações cheios.' : 'Cuidado com os buracos e pise nos pombos por cima.';
  setTimeout(() => { if (S.mode === 'lose') show('lose'); }, 1100);
});
TT.on('win', st => {
  if (!best || st.stars > best.stars || (st.stars === best.stars && st.time < best.time)) { best = { stars: st.stars, time: st.time }; try { localStorage.setItem('tintim-best', JSON.stringify(best)); } catch (_) {} }
  showBest();
  $('stCookies').firstElementChild.textContent = `${st.cookies}/${st.total}`; $('stCookies').classList.toggle('ok', st.allCookies);
  $('stHearts').firstElementChild.textContent = st.gold + '/3'; $('stHearts').classList.toggle('ok', st.allGold);
  $('stTime').firstElementChild.textContent = st.time.toFixed(1) + 's';
  const stars = [...document.querySelectorAll('.star')]; stars.forEach(s => s.classList.remove('got'));
  const p = S.player, at = TT.R && TT.R.toScreen ? TT.R.toScreen(p.x + p.w / 2, p.y + 10) : { x: 0.5, y: 0.6 };
  setTimeout(() => irisTo(true, at), 900);
  setTimeout(() => { if (S.mode !== 'win') return; show('win'); $('hud').classList.remove('on'); irisTo(false);
    // estrelas na ordem: vencer, biscoitos, os três dourados
    [true, st.allCookies, st.allGold].forEach((ok, i) => { if (ok) setTimeout(() => { stars[i].style.animationDelay = '0s'; stars[i].classList.add('got'); TT.sfx('star'); }, 500 + i * 380); });
  }, 1900);
});
TT.on('assetsReady', () => $('msg').classList.add('hide'));
if (TT.noWebGL) $('msg').textContent = 'Este navegador não conseguiu ligar o modo 3D (WebGL). Tente no Chrome ou Safari atualizados.';
})();
