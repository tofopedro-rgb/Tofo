// Teste de fumaça: joga o caminho crítico num navegador sem tela e falha se algo quebrar.
// Uso: (cd game && python3 -m http.server 8765 &) ; node game/tests/smoke.js [url]
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/';
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  pg.on('requestfailed', r => errs.push('falhou: ' + r.url()));
  const st = () => pg.evaluate(() => __tintim.state), ev = f => pg.evaluate(f);
  const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg); if (!ok) process.exitCode = 1; };
  await pg.goto(url + '?q=0'); await pg.waitForTimeout(2000);
  check(await st() === 'title', 'abre na tela de título');
  await pg.click('#btnStart'); await pg.waitForTimeout(1500);
  check(await st() === 'play', 'Jogar inicia a partida');
  await pg.keyboard.down('ArrowRight'); await pg.waitForTimeout(1500); await pg.keyboard.up('ArrowRight');
  check(await ev(() => __tintim.player.x > 300), 'Tintim anda para a direita');
  check(await ev(() => __tintim.S.cookies > 0), 'coleta biscoitos');
  await pg.keyboard.press('KeyP'); await pg.waitForTimeout(300);
  check(await st() === 'pause', 'P pausa'); 
  await pg.click('#btnResume'); await pg.waitForTimeout(300);
  check(await st() === 'play', 'Continuar retoma');
  await ev(() => { const p = __tintim.player; p.x = 3600; p.y = 300; }); await pg.waitForTimeout(600);
  check(await ev(() => __tintim.S.checkpoint === 0), 'checkpoint ativado');
  await ev(() => { __tintim.player.hp = 1; __tintim.player.x = 3400; __tintim.player.y = 700; }); await pg.waitForTimeout(1800);
  check(await st() === 'lose', 'cair no buraco sem corações perde');
  await pg.click('#btnRetry'); await pg.waitForTimeout(1500);
  check(await st() === 'play' && await ev(() => __tintim.player.x > 3500 && __tintim.player.hp === 3), 'tentar de novo volta ao checkpoint com 3 corações');
  await ev(() => { const p = __tintim.player; p.x = 6000; p.y = 300; });
  await pg.keyboard.down('ArrowRight'); await pg.waitForTimeout(1200); await pg.keyboard.up('ArrowRight');
  check(await ev(() => !!__tintim.S.cine), 'cena de introdução dos pugs');
  await pg.waitForTimeout(3800);
  check(await ev(() => !__tintim.S.cine && __tintim.S.arena), 'luta começa depois da cena');
  for (let i = 0; i < 12; i++) {
    const r = await ev(() => { const g = __tintim.pugs.find(g => g.hp > 0); if (!g || __tintim.state !== 'play') return 'fim';
      const p = __tintim.player; p.inv = 5; p.x = g.x + 10; p.y = g.y - 70; p.vy = 300; return g.hp; });
    if (r === 'fim') break; await pg.waitForTimeout(1600);
  }
  await pg.waitForTimeout(5500);
  check(await st() === 'win', '6 pisões vencem os pugs');
  check(await pg.isVisible('#win.on'), 'tela de vitória aparece');
  check(errs.length === 0, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})();
