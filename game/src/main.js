// Laço principal, trilha/efeitos ligados aos eventos, e qualidade adaptativa.
(() => {
'use strict';
const TT = window.TT, S = TT.S, R = TT.R;

const sfxOn = (ev, name) => TT.on(ev, () => TT.sfx(name));
sfxOn('jump', 'jump'); sfxOn('jump2', 'jump2'); sfxOn('friend', 'friend'); sfxOn('gift', 'gift'); sfxOn('land', 'land'); sfxOn('cookie', 'cookie'); sfxOn('power', 'power'); sfxOn('stomp', 'stomp'); sfxOn('hurt', 'hurt');
sfxOn('bark', 'bark'); sfxOn('choco', 'choco'); sfxOn('checkpoint', 'checkpoint'); sfxOn('bossIntro', 'boss'); sfxOn('finalBlow', 'final');
TT.on('start', () => { TT.music(S.arena ? 'boss' : 'level'); TT.audioDuck(false); });
TT.on('bossIntro', () => TT.music(null));
TT.on('cineEnd', () => TT.music('boss'));
TT.on('banner', e => { if (/Revanche/.test(e.text)) TT.music('boss'); });
TT.on('finalBlow', () => TT.music(null));
TT.on('win', () => TT.sfx('win'));
TT.on('lose', () => { TT.music(null); TT.sfx('lose'); });
TT.on('pause', () => TT.audioDuck(true)); TT.on('resume', () => TT.audioDuck(false));
TT.on('checkpoint', () => TT.emit('banner', { text: 'Checkpoint!' }));

if (TT.noWebGL || !R || !R.frame) return;
const qp = new URLSearchParams(location.search).get('q'); // ?q=0..2 fixa a qualidade (para testes)
if (qp !== null) R.setQuality(+qp);
let last = performance.now(), acc = 0, n = 0, warm = 0;
TT.on('start', () => { warm = 2; acc = 0; n = 0; });
function loop(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.033, raw); last = now;
  TT.pollPad();
  TT.update(dt);
  R.frame(dt);
  TT.uiFrame();
  // qualidade adaptativa: abaixo de ~45 quadros por segundo, simplifica (sem desfoque → sem sombras/pós)
  warm -= raw;
  if (qp === null && warm < 0 && S.mode === 'play' && raw < 0.5) { acc += raw; n++; if (acc > 2.5) { if (n / acc < 45 && R.quality > 0) R.setQuality(R.quality - 1); acc = 0; n = 0; } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__tintim = { get state() { return S.mode; }, get player() { return S.player; }, get pugs() { return S.pugs; }, S, R };
})();
