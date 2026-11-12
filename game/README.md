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

## Próximos passos (arte "2.5D realista")
1. Gerar sprites do Tintim (correr, parado, pular, aterrissar) a partir do character sheet em `assets/`, com fundo removido.
2. Gerar Pugs, pombos, macaco, banana, biscoito e cenários (térreo do prédio, parquinho) no mesmo estilo.
3. Trocar as funções `draw*` em `index.html` por `drawImage` com spritesheets.
4. Publicar no GitHub Pages para mandar o link para os amigos.
