# Mapa "O caminho de Vincent"

Gera `img/mapa-caminho.svg`. Os contornos dos países vêm do pacote npm `world-atlas@2.0.2` (Natural Earth, domínio público):

    npm pack world-atlas@2.0.2 && tar xzf world-atlas-2.0.2.tgz
    python3 mkmap.py   # gera base.json a partir de package/countries-10m.json
    python3 page.py    # gera mapa.svg; copie para ../../img/mapa-caminho.svg
