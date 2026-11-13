// Teste de fumaça: joga o caminho crítico num navegador sem tela e falha se algo quebrar.
// Uso: (cd game && python3 -m http.server 8765 &) ; node game/tests/smoke.js [url]
// Espera por condições (e não por tempo fixo), então funciona mesmo em máquina lenta sem placa de vídeo.
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/';
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  pg.on('requestfailed', r => errs.push('falhou: ' + r.url()));
  const ev = f => pg.evaluate(f);
  const until = (f, ms = 20000) => pg.waitForFunction(f, null, { timeout: ms, polling: 50 }).then(() => true, () => false);
  const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg); if (!ok) process.exitCode = 1; };
  await pg.goto(url + '?q=0');
  check(await until(() => window.__tintim && __tintim.R.ready && __tintim.state === 'title'), 'abre na tela de título');
  await pg.waitForTimeout(600); await pg.click('#btnStart');
  check(await until(() => __tintim.state === 'play'), 'Jogar inicia a partida');
  await pg.keyboard.down('ArrowRight');
  check(await until(() => __tintim.player.x > 300), 'Tintim anda para a direita');
  check(await until(() => __tintim.S.cookies > 0), 'coleta biscoitos');
  await pg.keyboard.up('ArrowRight');
  await pg.keyboard.down('Space'); await until(() => !__tintim.player.onGround && __tintim.player.vy > -500); await pg.keyboard.up('Space');
  await pg.waitForTimeout(80); await pg.keyboard.down('Space');
  check(await until(() => __tintim.player.dj === false, 3000), 'pulo duplo no ar'); await pg.keyboard.up('Space');
  await until(() => __tintim.player.onGround);
  const ck = await ev(() => { const p = __tintim.player; p.x = 2010; p.y = 380; return __tintim.S.cookies; });
  check(await until(() => __tintim.S.friends[0].given) && await until(() => __tintim.S.gifts.length === 0) && await ev(() => __tintim.S.cookies) === ck + 3, 'amigo chihuahua entrega o biscoito');
  await pg.keyboard.press('KeyP');
  check(await until(() => __tintim.state === 'pause', 3000), 'P pausa');
  await pg.waitForTimeout(500); await pg.click('#btnResume');
  check(await until(() => __tintim.state === 'play', 3000), 'Continuar retoma');
  await ev(() => { const p = __tintim.player; p.x = 4200; p.y = 300; });
  check(await until(() => __tintim.S.checkpoint === 0, 5000), 'checkpoint ativado');
  await ev(() => { __tintim.player.hp = 1; __tintim.player.x = 4000; __tintim.player.y = 700; });
  check(await until(() => __tintim.state === 'lose'), 'cair no buraco sem corações perde');
  await pg.waitForSelector('#lose.on', { timeout: 20000 }); await pg.waitForTimeout(700); await pg.click('#btnRetry');
  check(await until(() => __tintim.state === 'play' && __tintim.player.x > 4100 && __tintim.player.hp === 3), 'tentar de novo volta ao checkpoint com 3 corações');
  await ev(() => { const p = __tintim.player; p.x = 9400; p.y = 300; });
  await pg.keyboard.down('ArrowRight');
  check(await until(() => !!__tintim.S.cine), 'cena de introdução dos pugs');
  await pg.keyboard.up('ArrowRight');
  check(await until(() => !__tintim.S.cine && __tintim.S.arena, 40000), 'luta começa depois da cena');
  for (let i = 0; i < 12; i++) {
    const hp = await ev(() => { const g = __tintim.pugs.find(g => g.hp > 0); if (!g || __tintim.state !== 'play') return -1;
      const p = __tintim.player; p.inv = 5; p.x = g.x + 10; p.y = g.y - 70; p.vy = 300; return __tintim.pugs.reduce((a, g) => a + g.hp, 0); });
    if (hp < 0) break;
    await pg.waitForFunction(h => __tintim.pugs.reduce((a, g) => a + g.hp, 0) < h || __tintim.state !== 'play', hp, { timeout: 8000, polling: 50 }).catch(() => {});
    await until(() => __tintim.state !== 'play' || __tintim.pugs.every(g => g.hp <= 0 || g.stun <= 0.5), 8000);
  }
  check(await until(() => __tintim.state === 'win', 40000), '6 pisões vencem os pugs');
  check(await pg.waitForSelector('#win.on', { timeout: 30000 }).then(() => true, () => false), 'tela de vitória aparece');
  check(errs.length === 0, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})();
