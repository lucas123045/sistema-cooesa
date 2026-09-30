# Correções de pendências de dados — 30/09/2026

Autorizadas por Lucas. Aplicadas pelo script `scripts/correcoes/2026-09-30-pendencias.ts`
(idempotente; pode ser relido para ver exatamente o que foi feito).

**Nada foi apagado.** Os textos originais da planilha continuam nos campos `data_ini_texto`,
`valor_texto`, `empresa_texto` e `empresa_original`. Toda alteração está em
`historico_alteracoes` com o usuário `sistema (service_role)` — o script rodou com a chave de
serviço, porque a unificação pela tela exige um administrador logado e ainda não havia nenhum.
As pendências marcadas como revisadas guardam o motivo em `pendencias_revisadas.observacao`.

Resultado: **119 → 32 pendências abertas** (87 resolvidas).

## Critério

Só foi corrigido o que os próprios dados sustentam. Quando havia mais de uma leitura
possível, o item ficou em aberto para quem conhece o histórico da empresa decidir.

## O que foi corrigido

### Datas de início ilegíveis (7 de 9)

A numeração da planilha é cronológica, então a data correta precisa cair entre as datas dos
registros vizinhos. Em cada caso abaixo, só uma leitura do texto cabe nesse intervalo.

| Nº | Texto na planilha | Data gravada | Vizinhos |
|---|---|---|---|
| 440 | 002.10.06 | 02/10/2006 | 439 = 26/09/2006 · 441 = 17/10/2006 |
| 519 | 211.01.08 | 21/01/2008 | 518 = 15/01/2008 · 520 = 21/01/2008 (11/01 ficaria antes do 518) |
| 563 | 09.09.8 | 09/09/2008 | 562 = 08/09/2008 · 564 = 11/09/2008 |
| 577 | 19.103.09 | 19/03/2009 | 576 = 06/03/2009 · 578 = 23/03/2009 (19/10 não cabe) |
| 685 | 22+..11 | 22/06/2011 | 684 = 21/06/2011 · 686 = 27/06/2011 (só junho cabe) |
| 726 | 18.01.+13 | 18/01/2013 | 725 = 17/12/2012 · 727 = 29/01/2013 |
| 777 | 15.05.156 | 15/05/2015 | 776 = 09/04/2015 · 778 = 08/06/2015 |

### Datas de encerramento “mês/ano” confirmadas (16 de 18)

Abreviação do mês inequívoca (ex.: “des/02” = dezembro, “st/06” = setembro, “aabr/06” = abril).
O dia 1º é a convenção da extração. Registros: 59, 77, 158, 173, 222, 306, 308, 324, 373, 385,
393, 398, 459, 722, 723, 895.

### Valores em texto sem valor numérico único (12 de 15)

Confirmado que ficam sem valor numérico (o texto continua visível no registro):
650, 748, 851, 899, 900, 914 (“-”); 755 (“VARIÁVEL”); 970 (“Cancelada” na coluna de valor);
221, 231, 247 (valores por hora); 291 (25% da produção).

### Nomes unificados na extração (5 de 5) e totais divergentes (2 de 2)

- SCHAIN→SCHAHIN (218), DALLACQUA→DALL'ACQUA (650), BIO ENERGY→BIOENERGY (727),
  ARCARDIS→ARCADIS (898), CONCRENAT→CONCREMAT (970): erros de digitação evidentes.
- Outubro/2020 e julho/2024: o sistema sempre soma todas as notas; os totais digitados na
  planilha estavam incompletos.

### Clientes

**Unificados (3)** — mesmo contato pedindo o mesmo tipo de serviço:

| De | Para | Evidência |
|---|---|---|
| ENERGI | ENERGISA | contato Juraci, obras da Elektro em 2013 |
| DH | DHIDROVIÁRIO | contato Sampaio, fiscalização da manutenção de eclusas |
| VIVAN | VIVAN ENGENHARIA | contato Milton Vivan, projetos de barragens |

**Marcados como empresas diferentes (11)** — nomes só começam com as mesmas letras; contatos,
áreas e épocas distintos: GE × GEOCOMPANY, GE × GEVISA, GE × GEOTEL, GE × GEOLT, GE × GENPRO,
COP × COPRO, STE × STERLITE / THREE AR, TEM × TEMAT, MAP × MAPAL, CPFL × CPFL RENOVÁVEIS,
CPFL × CPFL JAGUARIÚNA (empresas distintas do grupo CPFL).

O par ENERGI × ENERGIAS saiu da lista sozinho com a unificação de ENERGI.

### Acompanhamentos antigos vinculados (10 de 12)

| # | Registro | Evidência |
|---|---|---|
| 69, 70 | 137 | “CTHI” = “CTIH” com letras trocadas; licenciamento ambiental em Indaiatuba |
| 72 | 256 | AES Tietê, leituristas; mesmo valor a receber (R$ 13.866) já ligado ao 256 em 2004 |
| 73, 77 | 175 | Sistema PRI / CDHU R$/mês; mesmo valor a receber (R$ 2.514) já ligado ao 175 em 2004 |
| 74 | 334 | Produquímica, avaliação da PCH Cunha |
| 75, 78 | 348 | Eletropaulo, desenhos físico-dimensionais em AutoCAD |
| 76 | 367 | Termoconsult; valor a receber igual ao valor do contrato (R$ 4.320) |
| 79 | 397 | escopo idêntico (“Serviços Extras de Projeto Loja Santana”) |

### Notas fiscais ligadas a clientes (20 de 22)

Pelo título da NF. Quando a planilha já ligava uma nota da mesma série a um registro, as
demais da série foram ligadas ao mesmo registro.

| Notas (id) | Cliente | Registro | Evidência |
|---|---|---|---|
| 102–106 | TSEA / THREE AR | 925 | série “BMS - Itamaracá - Lote 11”; a BMS 01 já estava no 925 |
| 110, 112 | TSEA / THREE AR | 896 | série “Básico Jandaíra”; a BMS 03 já estava no 896 |
| 113 | TSEA / THREE AR | 873 | “LT Itamaracá”; a BMS 03 - LT Itamaracá já estava no 873 |
| 107–109, 111 | TSEA / THREE AR | (mantido) | título “COOESA-TSEA” |
| 114–116 | BRZ EXPERTS | — | título “BRZ-Cooesa” |
| 117, 119 | ZX | 938 | 2ª e 3ª parcelas dos Projetos Básicos das CGH |
| 118 | ZX | 907 | “Hidrológicos MS QL” = hidrologia Monte Serrat / Quilombo |
| 120 | GE / THREE AR | 880 | “Suportes Padre Paraíso e João Neiva” = escopo do 880 |
| 121 | PCH SAL | 969 | “PCH do Sal - Estudos Pré” = pré-viabilidade |

## O que ficou para decisão humana (32)

| Pendência | Por quê |
|---|---|
| Datas de início 407 (“125.04.06”) e 803 (“31.04.2017”) | 407 pode ser 12/04 ou 15/04 (os dois cabem); 31/04 não existe |
| Encerramentos 864 (“jin/20”) e 908 (“ju/20”) | junho ou janeiro; junho ou julho |
| Valores 61 (“19.600,00/mês”), 838 (“15 milhões”), 839 (“23,7 milhões”) | preencher muda os totais históricos; 838 e 839 são orçamentos de leilão, talvez não o valor da proposta |
| Nº 368 sem situação · Nº 108 sem escopo | não há dado que diga qual é |
| 12 pares de clientes | ver abaixo |
| Acompanhamentos #71 (NOVA I) e #80 (AES Eletropaulo) | #71 serve para o 122 ou o 222; #80 não tem escopo equivalente |
| 2 notas Engekraft Radani (“SE Bandeirantes”) | o único registro RADANI é de outra obra (Metrô) |
| 7 notas sem cliente nem data (2023–2024) | a planilha só tem o valor |

Pares de clientes em aberto: QUANTA × QUANTA CONSULTORIA, GE × GE - GENERAL ELECTRIC,
GE × GE-BETZ, ARCADIS × ARCADIS LOGOS (provável mudança de nome), SINER × SINERCONSULT,
PLANSERV × PLANSERVI, MAP × MAP AUDITORIA, COP × COP - CONSÓRCIO OPERACIONAL DO PISF, e os nomes
com barra que podem indicar cliente final ou consórcio: GE / THREE AR, ENIND / THREE AR,
PROJECT / ELETROPAULO, ANEEL / CSPE.

## Efeito na conferência da carga

`npm run conferir` passa a mostrar 3 diferenças em relação à planilha original, todas
esperadas: clientes distintos 332 → 329 (unificações) e acompanhamentos vinculados 68 → 78 /
não vinculados 12 → 2. Os totais de valores e de notas não mudaram.
