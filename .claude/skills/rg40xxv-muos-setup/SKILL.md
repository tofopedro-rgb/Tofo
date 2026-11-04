---
name: rg40xxv-muos-setup
description: Roteiro para trocar o sistema de fábrica do Anbernic RG40XX V pelo muOS num PC Windows, com backup, migração de saves, biblioteca organizada (PS1, SNES, GBA), capas, tema e emuladores ajustados. Use quando o usuário pedir para configurar, instalar ou organizar o RG40XX V, o muOS ou os cartões do console.
---

# RG40XX V → muOS (no Windows)

Você está no PC Windows do usuário, com o Claude Code. Os dois microSD do console estão (ou vão estar) num leitor de cartão. Fale com o usuário em português, de forma curta.

## Contexto

- Console: **Anbernic RG40XX V** (vertical, chip Allwinner H700, tela 4" 640×480, 4:3).
- Hoje roda o **sistema de fábrica da Anbernic**.
  - **Cartão 1 (TF1):** sistema.
  - **Cartão 2 (TF2):** jogos (confirme isso olhando o conteúdo).
- Destino: **muOS**.
  - Escolhido por ser bem mantido: a versão **2606.0 Andromeda** saiu em 24/out/2026.
  - Também por ser leve e por ter melhorado os temas.
- Consoles principais: **PS1, SNES e GBA**.
- Objetivo: biblioteca organizadíssima, com capas, tema bonito e emuladores bem ajustados.
- O usuário quer o Castlevania SOTN. O port SymphonyRecomp é só para PC, sem versão ARM nem no PortMaster (pesquisado em nov/2026). Use a versão de PS1 no emulador e cheque o PortMaster de novo na etapa 8.

## Regras de segurança (não pule)

1. **Nunca grave, formate ou apague um disco sem antes mostrar ao usuário** a letra da unidade, o tamanho e o rótulo, e receber um "sim" explícito. Confunda o disco e você apaga o HD do PC.
2. **Backup antes de tudo** (etapa 1). Só siga depois de conferir que o backup abre e tem o tamanho esperado.
3. **Não baixe ROMs nem BIOS.** Só organize os arquivos que o usuário já tem.
4. Para gravar imagens, prefira as ferramentas gráficas (balenaEtcher ou Rufus). Guie o usuário clique a clique, em vez de gravar no disco bruto pela linha de comando.
5. Fatos marcados com **[verificar]** vieram de memória e o muOS muda bastante entre versões. Confirme na documentação oficial (muos.dev) e nas releases (`github.com/MustardOS/internal/releases`) antes de agir.

## Ferramentas (instale com winget quando der, ou peça para o usuário baixar)

| Ferramenta | Para quê |
|---|---|
| balenaEtcher ou Rufus | gravar a imagem do muOS |
| Win32 Disk Imager | backup em imagem do cartão de sistema |
| 7-Zip | descompactar a imagem |
| chdman (vem no MAME para Windows) | converter PS1 para `.chd` |
| Skraper (skraper.net) | capas e prévias via ScreenScraper |
| WinSCP | acessar o console por SFTP pelo Wi-Fi |

## Etapas

### 0. Reconhecimento (somente leitura)
- Liste as unidades com `Get-Volume` e `Get-Disk` no PowerShell e identifique os dois cartões pelo tamanho e pelo conteúdo.
- Mapeie o que existe:
  - pastas de ROMs por console;
  - BIOS (`scph*.bin`, `gba_bios.bin`);
  - saves (`.srm`, `.sav`, `.mcr`, `.mcd`);
  - save states (`.state*`).
- Mostre um resumo ao usuário: quantos jogos por console, quanto espaço ocupam e onde estão os saves e as BIOS.

### 1. Backup
- **Cartão de sistema:** imagem completa com o Win32 Disk Imager (botão Read), salva em `C:\RG40XXV-backup\tf1-stock.img`. Assim dá para voltar ao sistema de fábrica.
- **Cartão de jogos:** copie tudo para `C:\RG40XXV-backup\tf2\` com `robocopy <origem> <destino> /E /COPY:DT /R:1 /W:1`.
- Copie também **todos os saves e as BIOS** para `C:\RG40XXV-backup\saves-bios\`, mantendo as pastas de origem.
- Confira: compare os tamanhos e a contagem de arquivos e mostre ao usuário.

### 2. Baixar o muOS
- Pegue a versão estável mais recente (em nov/2026 era a **2606.0 Andromeda**) no site muos.dev ou nas releases do GitHub.
- **[verificar]** se existe uma imagem específica para o **RG40XX V** ou uma imagem única para a família H700, e o nome exato do arquivo.
- Confira o checksum se houver.

### 3. Gravar o muOS no cartão de sistema
- Isso apaga o cartão. Siga a regra de segurança 1.
- Guie o usuário no balenaEtcher: escolher a imagem, escolher o cartão certo e gravar.
- O usuário põe o cartão no slot 1 e liga o console. O primeiro boot faz a instalação e demora.
- Configure no aparelho: idioma, fuso horário e Wi-Fi.

### 4. Decidir onde ficam os jogos
- O muOS costuma usar o **cartão 2** para ROMs, BIOS, saves e artes quando ele está presente. **[verificar]** a opção de preferência de armazenamento (algo como "Storage" nas configurações) e os sistemas de arquivos aceitos (FAT32 e exFAT).
- Opção A: se o cartão 2 já estiver em exFAT/FAT32, reaproveite-o e só reorganize as pastas.
- Opção B: formate o cartão 2 em exFAT (regra 1, com backup já feito) e copie a biblioteca organizada.
- Opção C: deixe tudo no cartão 1.
- Recomende a opção A ou B: separar sistema e jogos facilita atualizar o muOS depois sem mexer na biblioteca.

### 5. Organizar a biblioteca (no PC, antes de copiar)
Estrutura esperada (**[verificar]** no cartão depois do primeiro boot; o muOS cria as pastas sozinho):
```
ROMS/<pasta por sistema>/     ex.: ROMS/PS, ROMS/SFC (ou SNES), ROMS/GBA
MUOS/bios/
MUOS/info/catalogue/<Sistema>/box/      capas
MUOS/info/catalogue/<Sistema>/preview/  prévias
MUOS/save/file/<core>/                  saves
```
- **Pastas e cores:** no muOS o nome da pasta é livre e cada pasta é ligada a um sistema e core ("Assign Core"). Ele detecta nomes comuns automaticamente. Use nomes curtos e claros e confirme a associação no aparelho na etapa 7.
- **Nomes:** padronize no estilo No-Intro/Redump, como `Castlevania - Symphony of the Night (USA).chd`. Remova duplicatas, versões repetidas e lixo (`.txt`, `.url`, imagens soltas). Mostre a lista de mudanças antes de renomear.
- **PS1 para CHD:** `chdman createcd -i "jogo.cue" -o "jogo.chd"`. Rode em lote e confira se cada `.chd` foi gerado sem erro. Só apague os originais com aprovação do usuário (o backup existe).
- **PS1 com vários discos:** crie um `.m3u` listando os `.chd`. **[verificar]** como o muOS esconde os discos individuais (subpasta ou nome de pasta oculto).
- **BIOS:** copie para `MUOS/bios/` com os nomes exatos. Para PS1 o ideal é `scph5501.bin` (EUA), além de `scph1001.bin` e `scph7001.bin` se houver. Para GBA, `gba_bios.bin` (opcional). Confira os MD5 com a lista de BIOS do libretro.
- **Saves do sistema de fábrica:** os `.srm` vão para a pasta de saves do **core** correspondente (**[verificar]** o caminho e o nome da pasta do core, como `PCSX-ReARMed`, `Snes9x` ou `mGBA`). Use o **mesmo nome-base da ROM**: se renomeou a ROM, renomeie o save junto. Os save states da Anbernic provavelmente não são compatíveis; avise o usuário.

### 6. Capas e prévias
- Use o **Skraper** no PC com a conta ScreenScraper do usuário (peça o login, não guarde a senha em arquivos).
- **[verificar]** o formato e a pasta que o muOS espera (`MUOS/info/catalogue/<Sistema>/box/<nome-da-rom>.png`, o nome da subpasta de sistema e o tamanho ideal para 640×480). Se o muos.dev tiver um perfil ou guia de Skraper para muOS, siga-o.
- Combine com o usuário o estilo: box art 2D ou mix com logo.

### 7. Copiar para o console e ajustar
- Copie a biblioteca para o destino da etapa 4 (pelo leitor de cartão, ou por SFTP com o WinSCP).
- **SFTP/SSH:** ative nos serviços de rede do muOS e pegue o IP. **[verificar]** o usuário e a senha padrão. Sugira trocar a senha depois.
- **Tema:** o muOS tem gerenciador e downloader de temas. A Andromeda trouxe cores alternativas, escolha de fonte e logo de boot. Escolha com o usuário um tema que funcione bem em **640×480 / 4:3** e mostre as opções. Ajuste a cor e a fonte ao gosto dele.
- **Cores e emuladores** (o usuário quer um RetroArch organizadíssimo). **[verificar]** se a Andromeda usa o RetroArch ou o player próprio ("Pickles") por padrão e se dá para escolher por sistema:
  - **PS1:** **PCSX ReARMed** (o mais rápido em ARM), com BIOS real. A tela 4:3 já encaixa bem; filtro suave opcional.
  - **SNES:** **Snes9x**, com **escala inteira** e shader leve de CRT ou scanlines, se o usuário gostar.
  - **GBA:** **mGBA**, escala inteira e filtro de LCD opcional. O GBA é 3:2, então vai sobrar borda; ofereça um overlay.
  - **Hotkeys:** confira os atalhos de menu, save state, load e fast forward, e mostre a lista ao usuário.
  - **RetroAchievements:** só se o usuário quiser e passar o login pelo aparelho.
- Confira no aparelho se cada pasta de ROMs está ligada ao core certo ("Assign Core").

### 8. Extras
- **PortMaster:** atualize, mostre alguns ports que rodam sem arquivos comerciais e procure de novo um port do SOTN.
- **Coleções/favoritos:** monte "Metroidvanias", "RPGs" e "Favoritos" com os jogos dele.
- **Backup dos saves:** deixe um script `.ps1` em `C:\RG40XXV-backup\` que copia os saves do console para o PC por SFTP ou pelo leitor de cartão.

### 9. Conferência final
Teste com o usuário:
- 1 jogo de cada console abre, salva, fecha e carrega o save;
- um jogo de PS1 com vários discos troca de disco;
- capas aparecem;
- o tema está aplicado;
- os saves antigos foram reconhecidos.

Entregue um resumo curto do que foi feito e onde está o backup.
