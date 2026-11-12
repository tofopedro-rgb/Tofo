// Som: efeitos e trilha gerados no navegador (WebAudio), sem arquivos de áudio.
(() => {
'use strict';
const TT = window.TT;
let ctx = null, master, musicBus, sfxBus, noiseBuf;
let muted = false;
try { muted = localStorage.getItem('tintim-mute') === '1'; } catch (_) {}

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp).connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  } catch (_) { ctx = null; return false; }
}

function tone(f, t, dur, { type = 'triangle', vol = 0.2, slide = 0, bus = sfxBus, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, { vol = 0.2, freq = 2000, q = 1, type = 'bandpass', bus = sfxBus } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.02);
}

const sfx = {
  jump: t => { tone(330, t, 0.16, { type: 'sine', vol: 0.22, slide: 2.1 }); noise(t, 0.06, { vol: 0.05, freq: 3000 }); },
  jump2: t => { tone(520, t, 0.22, { type: 'sine', vol: 0.16, slide: 2.4 }); tone(1040, t + 0.03, 0.3, { type: 'triangle', vol: 0.06, slide: 1.8 }); noise(t, 0.18, { vol: 0.04, freq: 5200, q: 2 }); },
  friend: t => { [0, 0.11].forEach(o => tone(760, t + o, 0.08, { type: 'triangle', vol: 0.13, slide: 1.35 })); },
  gift: t => [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.4, { type: 'sine', vol: 0.13, attack: 0.01 })),
  land: t => { tone(120, t, 0.09, { type: 'sine', vol: 0.18, slide: 0.5 }); noise(t, 0.07, { vol: 0.07, freq: 700 }); },
  cookie: t => { tone(1175, t, 0.07, { vol: 0.16 }); tone(1568, t + 0.06, 0.12, { vol: 0.16 }); },
  power: t => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.06, 0.18, { vol: 0.16 })),
  stomp: t => { tone(180, t, 0.2, { type: 'sine', vol: 0.4, slide: 0.35 }); noise(t, 0.12, { vol: 0.2, freq: 900 }); tone(660, t + 0.02, 0.1, { type: 'square', vol: 0.06, slide: 1.6 }); },
  hurt: t => { tone(300, t, 0.28, { type: 'sawtooth', vol: 0.16, slide: 0.4 }); noise(t, 0.15, { vol: 0.12, freq: 500 }); },
  bark: t => { [0, 0.13].forEach(o => { tone(260, t + o, 0.09, { type: 'sawtooth', vol: 0.14, slide: 1.5 }); noise(t + o, 0.08, { vol: 0.1, freq: 1100, q: 2 }); }); },
  checkpoint: t => [659, 880, 1318].forEach((f, i) => tone(f, t + i * 0.09, 0.2, { vol: 0.14 })),
  boss: t => { tone(70, t, 1.2, { type: 'sawtooth', vol: 0.2, slide: 0.6 }); noise(t, 0.9, { vol: 0.12, freq: 200, type: 'lowpass' }); },
  final: t => { tone(90, t, 0.9, { type: 'sine', vol: 0.5, slide: 0.3 }); noise(t, 0.5, { vol: 0.25, freq: 600 }); },
  win: t => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.13, 0.3, { vol: 0.18 })),
  lose: t => [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * 0.18, 0.35, { vol: 0.16, type: 'sine' })),
  star: t => { tone(1318, t, 0.1, { vol: 0.16 }); tone(1976, t + 0.07, 0.25, { vol: 0.14 }); },
  ui: t => tone(880, t, 0.05, { vol: 0.1 }),
};
TT.sfx = name => { if (!init() || !sfx[name]) return; sfx[name](ctx.currentTime); };

// ---- trilha: caixinha de música etérea para a fase e um baião tenso para os pugs ----
const N = n => 440 * Math.pow(2, (n - 69) / 12);
const SONGS = {
  level: { bpm: 100, soft: true,
    lead: [74, 0, 78, 81, 0, 78, 81, 83, 81, 0, 78, 0, 76, 78, 74, 0,  76, 0, 79, 83, 0, 79, 83, 84, 83, 0, 79, 0, 78, 76, 74, 0,
           74, 0, 78, 81, 0, 78, 81, 83, 86, 0, 84, 0, 83, 81, 78, 0,  79, 0, 78, 76, 0, 74, 76, 78, 74, 0, 0, 0, 74, 0, 0, 0],
    bass: [50, 50, 55, 57], },
  boss: { bpm: 150,
    lead: [69, 0, 69, 72, 0, 69, 76, 0, 75, 0, 72, 0, 69, 0, 67, 0,  69, 0, 69, 72, 0, 69, 77, 0, 76, 0, 72, 0, 71, 0, 68, 0],
    bass: [45, 45, 41, 40], },
};
let song = null, step = 0, nextT = 0, timer = null;
function schedule() {
  if (!ctx || !song) return;
  const s = SONGS[song], st = 60 / s.bpm / 4;
  while (nextT < ctx.currentTime + 0.15) {
    const i = step % s.lead.length, bar = Math.floor(step / 16) % s.bass.length, b = step % 16;
    const n = s.lead[i];
    if (s.soft) { // fase: a mesma melodia, tocada como caixinha de música sobre um colchão de notas longas
      if (n) { tone(N(n), nextT, st * 4.5, { type: 'sine', vol: 0.11, attack: 0.012, bus: musicBus }); tone(N(n) * 2, nextT, st * 2.5, { type: 'triangle', vol: 0.028, bus: musicBus }); }
      if (b === 0) [0, 7, 12, 16].forEach((o, k) => tone(N(s.bass[bar] + o), nextT, st * 17, { type: 'sine', vol: k ? 0.035 : 0.09, attack: 0.5, bus: musicBus }));
      if (b === 8) tone(N(s.bass[bar] + 12), nextT, st * 6, { type: 'triangle', vol: 0.05, attack: 0.05, bus: musicBus });
      if (b % 4 === 2) noise(nextT, 0.05, { vol: 0.012, freq: 6000, q: 3, bus: musicBus });
      step++; nextT += st; continue;
    }
    if (n) { tone(N(n), nextT, st * 1.8, { type: 'square', vol: 0.09, bus: musicBus }); tone(N(n) * 2, nextT, st, { type: 'triangle', vol: 0.05, bus: musicBus }); }
    // baixo no ritmo do baião: 1, "e" do 2, 3
    if (b === 0 || b === 6 || b === 8 || b === 14) tone(N(s.bass[bar] - (b === 6 || b === 14 ? 0 : 0)), nextT, st * 2.4, { type: 'triangle', vol: 0.26, bus: musicBus });
    if (b === 0 || b === 6 || b === 8) tone(110, nextT, 0.12, { type: 'sine', vol: 0.32, slide: 0.4, bus: musicBus }); // zabumba
    if (b % 2 === 0) noise(nextT, 0.03, { vol: b % 4 === 2 ? 0.07 : 0.035, freq: 7000, q: 3, bus: musicBus });         // triângulo
    step++; nextT += st;
  }
}
TT.music = name => {
  if (name === song) return;
  song = name; step = 0;
  if (!name) { clearInterval(timer); timer = null; return; }
  if (!init()) return;
  nextT = ctx.currentTime + 0.08;
  if (!timer) timer = setInterval(schedule, 40);
};
TT.setMuted = m => {
  muted = m; try { localStorage.setItem('tintim-mute', m ? '1' : '0'); } catch (_) {}
  if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.03);
};
TT.isMuted = () => muted;
TT.audioDuck = on => { if (ctx) musicBus.gain.setTargetAtTime(on ? 0.1 : 0.32, ctx.currentTime, 0.1); };
TT.audioInit = init;
})();
