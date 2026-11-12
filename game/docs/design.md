# Tintim e os Pugs — design em uma página

**Promessa:** 2 a 3 minutos de plataforma que parecem um curta de animação estrelado por um cachorro de verdade. Feito para mostrar aos amigos.

## Pilares
1. **É o Tintim.** Mancha preta, bandana de festa junina, lacinho. As bandeirinhas do cenário e a interface repetem as cores da bandana.
2. **Controle gostoso antes de tudo.** Pulo variável, tolerância na borda (coyote time, 0,1s), pulo antecipado (buffer, 0,12s), câmera que olha à frente.
3. **Impacto.** Cada pisão congela o jogo por um instante (hitstop), treme a câmera e solta partículas. O golpe final é em câmera lenta.
4. **Piada interna.** Os chefões são "os pugs da vizinha", com cena de apresentação própria.

## 2.5D
- O mundo é 3D de verdade: piso em blocos (os buracos são vãos), muro e pintura do parquinho como planos em pé, horizonte a 2.600 unidades de distância. O parallax vem da perspectiva, não de truque.
- Personagens são sprites em pé no plano z=0 e projetam sombra recortada no chão e no muro.
- A câmera tem direção fixa e só desliza, aproxima e treme: nunca gira, para a pintura não revelar que é plana.
- Pós-processamento: profundidade de campo (plano do jogo nítido), bloom, contraste e cor de fim de tarde, vinheta e grão.
- Animação de corrida avança conforme a distância percorrida, para as patas não patinarem.

## Ritmo da fase
Início seguro com biscoitos no chão → primeiros bancos → primeiro buraco → banana (turbo) → checkpoint → macaco (invencível) → trecho final → parquinho → cena dos pugs → luta.

## Qualidade adaptativa
Três níveis. Se a média cair abaixo de 45 quadros por segundo: nível 1 desliga o desfoque e reduz a resolução; nível 0 desliga sombras e pós-processamento.

## Fora do escopo (por enquanto)
Mais fases, mais quadros de animação, sprites dos pugs reais, placar online.
