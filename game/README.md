# Timtim e os Pugs da Bruxa

Jogo de plataforma 2.5D curtinho: a vizinha bruxa mandou seus dois pugs infernizarem a Reserva Alpha Village, e só o Timtim pode derrotá-los. Os dois amigos chihuahuas esperam no caminho e dão poderes (turbo e invencibilidade). Uma partida leva em torno de 2 minutos.

## Como jogar
- ← → / A D: andar · Espaço / ↑ / W: pular (segure para pular mais alto; aperte de novo no ar para a pirueta, um pulo duplo) · P ou Esc: pausa · M: som
- Celular: botões na tela. Controle (gamepad): direcional + botão A.
- 🍪 Biscoito: pontos · 🍌 Banana de pelúcia: turbo por 7s · 🐒 Macaco de pelúcia: invencível por 8s e +1 coração
- 🐶 Amigos chihuahuas: os dois esperam no caminho e, quando o Timtim chega perto, jogam um biscoito de presente (+3 biscoitos e +1 coração)
- Pombos: pise por cima. Chefões: 3 pisões em cada pug; o último fica mais bravo.
- Estrelas: 1 por vencer, 1 por pegar 80% dos biscoitos, 1 por achar os 3 biscoitos dourados (só o pulo duplo alcança).

## Rodar
O jogo usa WebGL, então precisa de um servidor (abrir o arquivo direto não carrega as imagens):
```
cd game && python3 -m http.server 8765   # abrir http://localhost:8765
```
`?q=0`, `?q=1` ou `?q=2` na URL fixa a qualidade gráfica; sem isso ela se ajusta sozinha ao aparelho.

## Estrutura
| Arquivo | Papel |
|---|---|
| `src/game.js` | Regras: física, inimigos, chefão, checkpoints, fluxo. Avisa o resto por eventos. |
| `src/render3d.js` | Cenário 3D (three.js) desenhado por código, sprites, sombras, luzes, partículas, câmera e pós-processamento. |
| `src/ui.js` | Controles, placar, telas e transições (HTML/CSS). |
| `src/audio.js` | Efeitos gerados no navegador e trilha orquestral gravada (`assets/music`), tocada em laço; a trilha sintetizada cobre enquanto o arquivo carrega. |
| `src/main.js` | Laço principal e qualidade adaptativa. |
| `docs/design.md` | Decisões de design e de arte. |
| `tests/smoke.js` | Teste automático do caminho crítico (`node game/tests/smoke.js`). |

Arte dos personagens gerada no Higgsfield a partir das fotos do Timtim; os chihuahuas foram recortados da folha de personagens. O cenário inteiro é desenhado por código em `render3d.js`, sem imagens de fundo. `vendor/three.min.js` é a three.js r149 (licença MIT).
