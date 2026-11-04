---
name: rg40xxv-knulli-setup
description: Roteiro para trocar o sistema de fábrica do Anbernic RG40XX V pelo Knulli num PC Windows, com backup, migração de saves, biblioteca organizada (PS1, SNES, GBA), capas, tema e RetroArch ajustado. Use quando o usuário pedir para configurar, instalar ou organizar o RG40XX V, o Knulli ou os cartões do console.
---

# RG40XX V → Knulli (no Windows)

Você está no PC Windows do usuário, com o Claude Code. Os dois microSD do console estão (ou vão estar) num leitor de cartão. Fale com o usuário em português, de forma curta.

## Contexto

- Console: **Anbernic RG40XX V** (vertical, chip Allwinner H700, tela 4" 640×480, 4:3).
- Hoje roda o **sistema de fábrica da Anbernic**.
  - **Cartão 1 (TF1):** sistema.
  - **Cartão 2 (TF2):** jogos (confirme isso olhando o conteúdo).
- Destino: **Knulli** (escolhido pela interface bonita).
- Consoles principais: **PS1, SNES e GBA**.
- Objetivo: uma biblioteca organizadíssima, com capas, tema caprichado e RetroArch bem ajustado.
- O usuário quer o Castlevania SOTN. O port SymphonyRecomp é só para PC e ainda não tem versão ARM nem no PortMaster (pesquisado em nov/2026). Use a versão de PS1 no emulador e cheque o PortMaster de novo na etapa 8.

## Regras de segurança (não pule)

1. **Nunca grave, formate ou apague um disco sem antes mostrar ao usuário** a letra da unidade, o tamanho e o rótulo, e receber um "sim" explícito. Confunda o disco e você apaga o HD do PC.
2. **Backup antes de tudo** (etapa 1). Só siga depois de conferir que o backup abre e tem o tamanho esperado.
3. **Não baixe ROMs nem BIOS.** Só organize os arquivos que o usuário já tem.
4. Para gravar imagens de disco, prefira as ferramentas gráficas (balenaEtcher ou Rufus). Guie o usuário clique a clique, em vez de gravar no disco bruto pela linha de comando.
5. Fatos marcados com **[verificar]** vieram de memória. Confirme na documentação oficial (knulli.org e as releases do GitHub) antes de agir.

## Ferramentas (instale com winget quando der, ou peça para o usuário baixar)

| Ferramenta | Para quê |
|---|---|
| balenaEtcher ou Rufus | gravar a imagem do Knulli |
| Win32 Disk Imager | backup em imagem do cartão de sistema |
| 7-Zip | descompactar `.img.gz` |
| chdman (vem no MAME para Windows) | converter PS1 para `.chd` |
| Skraper (skraper.net) | capas, vídeos e logos via ScreenScraper |
| WinSCP | acessar o console por SSH/SFTP pelo Wi-Fi |

## Etapas

### 0. Reconhecimento (somente leitura)
- Liste as unidades com `Get-Volume` e `Get-Disk` no PowerShell e identifique os dois cartões pelo tamanho e pelo conteúdo.
- Mapeie o que existe:
  - pastas de ROMs por console;
  - BIOS (procure `scph*.bin` e `gba_bios.bin`);
  - saves (`.srm`, `.sav`, `.mcr`, `.mcd`);
  - save states (`.state*`).
- Mostre um resumo ao usuário: quantos jogos por console, quanto espaço ocupam e onde estão os saves e as BIOS.

### 1. Backup
- **Cartão de sistema:** imagem completa com o Win32 Disk Imager (botão Read), salva em `C:\RG40XXV-backup\tf1-stock.img`. Assim dá para voltar ao sistema de fábrica.
- **Cartão de jogos:** copie tudo para `C:\RG40XXV-backup\tf2\` com `robocopy <origem> <destino> /E /COPY:DT /R:1 /W:1`.
- Copie também **todos os saves e as BIOS** para `C:\RG40XXV-backup\saves-bios\`, mantendo as pastas de origem.
- Confira: compare os tamanhos e a contagem de arquivos e mostre ao usuário.

### 2. Baixar o Knulli
- Pegue a release estável mais recente em `github.com/knulli-cfw/knulli-linux/releases` (o repositório antigo, `knulli-cfw/distribution`, parou em ago/2025). Em nov/2026 a mais recente era a **Scarab (20260511)**. Baixe a **imagem do H700** (cobre o RG40XX V). **[verificar]** o nome exato do arquivo e se saiu versão mais nova.
- Confira o checksum se a release publicar um.

### 3. Gravar o Knulli no cartão de sistema
- Isso apaga o cartão. Siga a regra de segurança 1.
- Guie o usuário no balenaEtcher: escolher a imagem, escolher o cartão certo e gravar.
- O usuário põe o cartão no slot 1 e liga o console. O primeiro boot expande as partições e demora.
- Configure no aparelho: idioma português, fuso horário e Wi-Fi.

### 4. Decidir onde ficam os jogos
- **[verificar]** se o Knulli atual permite usar o **cartão 2** como armazenamento dos jogos (procure no menu de sistema ou na wiki uma opção de "storage" ou "SD2") e qual sistema de arquivos ele exige.
- Opção A, se o cartão 2 for aceito sem formatar: reaproveite-o e só reorganize as pastas.
- Opção B: formate o cartão 2 do jeito que o Knulli pede (regra 1, com backup já feito) e copie a biblioteca organizada.
- Opção C: deixe tudo no cartão 1 (a partição SHARE), se ele for grande o bastante.
- Apresente as opções ao usuário com a sua recomendação e deixe ele escolher.

### 5. Organizar a biblioteca (no PC, antes de copiar)
Estrutura no padrão Batocera/Knulli (**[verificar]** os nomes das pastas no próprio cartão depois do primeiro boot):
```
roms/psx/   roms/snes/   roms/gba/   (outros consoles que existirem, com o nome de pasta do Knulli)
bios/
saves/<sistema>/
```
- **Nomes:** padronize no estilo No-Intro/Redump, como `Castlevania - Symphony of the Night (USA).chd`. Remova duplicatas, versões repetidas e lixo (`.txt`, `.url`, imagens soltas). Mostre a lista de mudanças antes de renomear.
- **PS1 para CHD:** `chdman createcd -i "jogo.cue" -o "jogo.chd"`. Rode em lote e confira se cada `.chd` foi gerado sem erro. Só apague os `.bin/.cue` originais depois que o usuário aprovar (o backup existe).
- **PS1 com vários discos:** crie um `.m3u` listando os `.chd` (Disc 1, Disc 2…), para o jogo aparecer como um item só. **[verificar]** como o Knulli prefere esconder os discos individuais (subpasta ou `gamelist`).
- **BIOS:** copie para `bios/` com os nomes exatos. Para PS1 o ideal é `scph5501.bin` (EUA), além de `scph1001.bin` e `scph7001.bin` se houver. Para GBA, `gba_bios.bin` (opcional). Confira os MD5 com a lista oficial de BIOS do Batocera/Knulli.
- **Saves do sistema de fábrica:** copie os `.srm` para `saves/<sistema>/` com o **mesmo nome-base da ROM** (se você renomeou a ROM, renomeie o save junto). Os save states da Anbernic provavelmente não são compatíveis; avise o usuário.

### 6. Capas e mídia
- Use o **Skraper** no PC com a conta ScreenScraper do usuário (peça o login, não guarde a senha em arquivos).
- Para a tela de 640×480, prefira box art 2D ou mix com logo e vídeos curtos. Os vídeos ocupam espaço: pergunte ao usuário se quer.
- Gere `gamelist.xml` por sistema, no formato EmulationStation.

### 7. Copiar para o console e ajustar
- Copie a biblioteca para o destino escolhido na etapa 4 (pelo leitor de cartão, ou por SFTP com o WinSCP).
- **SSH/SFTP:** pegue o IP no menu de rede do console. **[verificar]** o usuário e a senha padrão (no Batocera é `root` / `linux`). Sugira trocar a senha depois.
- **Tema:** baixe pelo menu de atualizações e downloads do Knulli. Escolha com o usuário um tema que funcione bem em **640×480 / 4:3** e mostre as opções.
- **RetroArch e emuladores** (configure pelo menu do Knulli; se editar `batocera.conf` via SSH, faça backup do arquivo antes):
  - **PS1:** core **PCSX ReARMed** (o mais leve e rápido em ARM). Use BIOS real, escala inteira desligada (a tela 4:3 já encaixa bem) e filtro suave opcional.
  - **SNES:** core **Snes9x**, com **escala inteira ligada** e shader leve de CRT ou scanlines, se o usuário gostar.
  - **GBA:** core **mGBA**, escala inteira e shader leve de LCD (grade) opcional. O GBA é 3:2, então vai sobrar borda; ofereça um bezel/overlay.
  - **Hotkeys:** confira o botão de hotkey e os atalhos de save state, load e fast forward, e mostre a lista ao usuário.
  - **RetroAchievements:** só se o usuário quiser e passar o login pelo menu.

### 8. Extras
- **PortMaster:** atualize, mostre ao usuário alguns ports que rodam sem arquivos comerciais e procure de novo um port do SOTN.
- **Coleções:** crie "Metroidvanias", "RPGs" e "Favoritos" com os jogos que ele tiver.
- **Backup dos saves:** deixe um script `.ps1` em `C:\RG40XXV-backup\` que copia `saves/` do console para o PC por SFTP ou pelo leitor de cartão.

### 9. Conferência final
Teste com o usuário:
- 1 jogo de cada console abre, salva, fecha e carrega o save;
- um jogo de PS1 com vários discos troca de disco;
- capas aparecem;
- o tema está aplicado;
- os saves antigos foram reconhecidos.

Entregue um resumo curto do que foi feito e onde está o backup.
