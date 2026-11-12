# Tintim e os Pugs — design em uma página

**Promessa:** 2 a 3 minutos de plataforma que parecem um curta de animação estrelado por um cachorro de verdade. Feito para mostrar aos amigos.

## Pilares
1. **É o Tintim.** Mancha preta, bandana de festa junina, lacinho. O varal de luzinhas do parque repete as cores da bandana.
2. **Fluidez antes de tudo.** Pulo variável, pulo duplo com pirueta, um instante de flutuação no topo do pulo, tolerância na borda (coyote time, 0,1s), pulo antecipado (buffer, 0,12s), câmera que olha à frente e acompanha a altura.
3. **Impacto.** Cada pisão congela o jogo por um instante (hitstop), treme a câmera e solta faíscas de luz. O golpe final é em câmera lenta.
4. **Piada interna.** Os chefões são "os pugs da vizinha", com cena de apresentação própria. Os dois amigos chihuahuas esperam no caminho e dão biscoito.

## Direção de arte: o parque ao entardecer
Referência de clima: plataformas atmosféricos de floresta luminosa. A identidade é nossa: um parque de bairro, com postes, bancos, caminho de pedra e parquinho.
- **Profundidade por valor.** Céu de pôr do sol (dourado, laranja, rosa). Quanto mais longe, mais claro e rosado; quanto mais perto, mais escuro e roxo. O primeiro plano é quase preto e desfocado.
- **A luz conta a história.** Luz quente e baixa, sombras roxas. O que importa para jogar brilha: o Tintim tem um halo suave, os biscoitos são luzes douradas, os postes fazem poças de luz âmbar.
- **O mundo respira.** Fachos de sol, névoa, flores e cogumelos que pulsam, vaga-lumes, capim na frente dos pés.
- **Movimento elástico.** O corpo do Tintim estica e achata com uma mola, inclina com a velocidade, e deixa um rastro de silhuetas de luz na pirueta e no turbo.
- **Interface discreta.** Vidro escuro, contornos finos de luz, letras serifadas que brilham. Nada de contorno grosso.

## 2.5D
- O mundo é 3D de verdade: piso em blocos (os buracos são vãos), camadas de árvores a até 2.200 unidades de distância, céu no infinito. O parallax vem da perspectiva, não de truque.
- O cenário é desenhado por código (texturas de canvas): dá controle total da paleta e não depende de imagens.
- Personagens são sprites em pé no plano z=0 e projetam sombra recortada no chão.
- A câmera tem direção fixa e só desliza, aproxima e treme: nunca gira.
- Pós-processamento: profundidade de campo (plano do jogo nítido), bloom largo, sombras puxadas para o roxo, vinheta e grão.
- Animação de corrida avança conforme a distância percorrida, para as patas não patinarem.

## Ritmo da fase
Início seguro com biscoitos no chão → primeiras lajes → primeiro buraco → **amigo preto e branco** (biscoito de presente) → banana (turbo) → checkpoint → macaco (invencível) → **amigo branco** → trecho final → parquinho → cena dos pugs → luta.

## Qualidade adaptativa
Três níveis. Se a média cair abaixo de 45 quadros por segundo: nível 1 desliga o desfoque e reduz a resolução; nível 0 desliga sombras, pós-processamento, névoa, parte dos fachos e dos halos.

## Fora do escopo (por enquanto)
Mais fases, mais quadros de animação (a corrida tem 4), animações próprias para os chihuahuas, sprites dos pugs reais, placar online.
