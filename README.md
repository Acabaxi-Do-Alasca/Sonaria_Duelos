# Sonaria Duelos

Calculadora de face tank para **Creatures of Sonaria**: escolha duas criaturas, monte a build de cada uma e veja, segundo a segundo, quem cai primeiro.

## Páginas

- **Início** (`index.html`): um duelo em destaque e as criaturas mais novas.
- **Simulador** (`simulator.html`): monte e simule o duelo.
- **Bestiário** (`creatures.html`): as 488 criaturas, com busca e filtros.

## O que o simulador considera

- **Atributos oficiais** de todas as criaturas: vida, dano, peso, recarga, regeneração, passivas e habilidades.
- **Dano pelo peso:** `dano × (1 + min(peso/alvo, 3)) / 2`.
- **Status:** sangramento, veneno, queimadura, congelamento, corrosão (reduz o peso), radiação, doença e sonolência, com bloqueios e versões defensivas.
- **Sopros, feixes e lanças**, com os multiplicadores da wiki.
- **Build da criatura:** ancião e veneração, traits com ascensões, pelúcias, buffs e habilidades ativas.
- **Condições:** estação (Frosty, Volcanic e o inverno), dia/noite, Lua de Sangue, Lua Azul, Nevasca e Onda de Calor.
- **Relatório do duelo:** tabela comparativa, gráfico de vida e registro completo da luta.

## Como rodar

O site é estático. Basta abrir o `index.html` no navegador ou servir a pasta:

```bash
python -m http.server 5173
```

## Atualizar os dados

Este comando baixa da wiki oficial os atributos e imagens das criaturas e as raridades e imagens das pelúcias:

```bash
python scripts/atualizar_dados.py
```

As imagens ficam salvas em `img/criaturas` e `img/pelucias`, em WebP. Assim o site não depende do servidor da Fandom, que bloqueia imagens carregadas por outros sites. O script reaproveita as imagens já baixadas. Se a Fandom limitar os downloads, é só rodar o comando de novo para completar. Ele usa o Pillow (`pip install pillow`).

## Créditos

Os atributos e imagens vêm da [wiki oficial de Creatures of Sonaria](https://creatures-of-sonaria-official.fandom.com/wiki/Creature_Stats_List) (CC BY-SA). Este é um projeto de fã, sem afiliação com o jogo. Os valores que a wiki não documenta são estimados e aparecem marcados com "≈" no site.
