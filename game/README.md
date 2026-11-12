# Tintim: A Fuga do Térreo

Jogo de plataforma curtinho com o Tintim de protagonista. HTML5 + Canvas, sem build: abra `index.html` no navegador.

## Como jogar
- ← → / A D: andar · Espaço / ↑ / W: pular (segure para pular mais alto)
- No celular aparecem botões na tela.
- 🍪 Biscoito: pontos · 🍌 Banana de pelúcia: turbo por 7s · 🐒 Macaco de pelúcia: invencível por 8s e +1 vida
- Pombos: pise neles. Chefões no parquinho: **os dois Pugs** (3 pisões cada; o último fica mais bravo).

## Rodar localmente
```
cd game && python3 -m http.server 8000   # abrir http://localhost:8000
```

## Arte
Sprites e cenários gerados no Higgsfield (GPT Image 2.6, fundo transparente) usando o character sheet e a foto do Tintim como referência:
- `assets/sprites/`: Tintim (parado, correndo em 4 quadros, pulando, caindo, levando dano, comemorando), Pug (andando, investindo, tonto), pombo, macaco, banana, biscoito
- `assets/bg/`: horizonte da cidade, muro do térreo com plantas e parquinho

Se alguma imagem não carregar, o jogo usa os desenhos vetoriais de reserva em `index.html`.

## Próximos passos
1. Publicar no GitHub Pages para mandar o link para os amigos.
2. Fotos reais do macaco de pelúcia e dos pugs da vizinha para gerar versões mais fiéis.
3. Música e efeitos sonoros.
