# Painel de Aprovação de Fretes — como instalar

Este painel lê a aba **"Controle de Frete 2024_2025_2026"** e mostra tudo que
está com status **"Aguardando Aprovação"**, agrupando por Rota quando várias
RFQs formam uma rota só.

## 1. Colunas que a sua planilha precisa ter

Estas colunas já fazem parte da estrutura que você descreveu — confirme que
os nomes na planilha são exatamente estes (o script busca pelo nome exato do
cabeçalho, então acentos e espaços importam):

```
RFQ, Rota, Status da SC, Setor Solicitante, Motivo do Frete, Modalidade,
Tipo de Frete, Material, Qtde solicitada, Tipo de Volume, Valor Unitário,
Valor da NF., Origem, Destino,
Transportador 1 (nome), Valor (All In) 1, Ad Valorem 1, Prazo de Pagamento 1, Transit Time 1, Veículo 1,
Transportador 2 (nome), Valor (All In) 2, Ad Valorem 2, Prazo de Pagamento 2, Transit Time 2, Veículo 2,
Transportador 3 (nome), Valor (All In) 3, Ad Valorem 3, Prazo de Pagamento 3, Transit Time 3, Veículo 3,
Rota - Transportador, Rota - Valor (All In), Rota - Ad Valorem, Rota - Prazo de Pagamento, Rota - Transit Time, Rota - Veículo
```

**Além dessas, crie 5 colunas novas** — é onde o painel grava a aprovação.
Pode colocar em qualquer lugar da planilha, a ordem não importa:

```
Aprovador
Data da Aprovação
Decisão da Aprovação
Transportador Aprovado
Valor Aprovado
```

## 2. Como preencher uma Rota

- RFQ 001 e RFQ 002 ficam em linhas separadas, cada uma com seu próprio
  Transportador 1/2/3 (as cotações individuais daquele trecho).
- Na coluna **Rota**, escreva o mesmo código (ex: `ROTA-010`) nas duas linhas.
- Nas colunas **Rota - Transportador**, **Rota - Valor (All In)**, etc.,
  preencha a cotação consolidada da rota inteira — pode repetir os mesmos
  valores nas duas linhas (001 e 002), o painel entende os dois jeitos.
- Se só existir 1 RFQ com aquele status, deixe a coluna Rota em branco.

## 3. Instalar o script na planilha

1. Abra a planilha no Google Sheets.
2. Menu **Extensões → Apps Script**.
3. Se já existir um arquivo `Código.gs` de uma tentativa anterior, apague o
   conteúdo dele. Cole o conteúdo do arquivo `Codigo.gs` (deste pacote) no
   lugar.
4. Clique no `+` ao lado de "Arquivos" → **HTML** → nomeie exatamente
   `Aprovacao` (sem acento) → cole o conteúdo do arquivo `Aprovacao.html`.
5. Salve (ícone de disquete ou Ctrl+S).

## 4. Testar antes de usar

1. Ainda no editor do Apps Script, no menu de funções (topo), escolha
   `diagnosticar` e clique em **Executar** ▷.
2. Na primeira vez vai pedir autorização — aceite (é a sua própria planilha).
3. Depois de rodar, vá em **Ver → Registros de execução**. Você vai ver
   quantas linhas foram encontradas, quais colunas não foram achadas (se
   faltar alguma) e quantas estão pendentes.
4. Se aparecer "Colunas não encontradas", confira o nome exato dessas colunas
   na planilha — normalmente é diferença de acento/espaço.

## 5. Abrir o painel

Volte para a planilha (não o editor de script) e **recarregue a página**.
Vai aparecer um novo menu **"Aprovação de Fretes"** → **"Abrir painel de
aprovação"**. É assim que o gestor vai abrir o painel — sem precisar de link
nem publicação.

Se um dia você quiser um link externo (para abrir fora do Sheets), dá para
publicar como App da Web (**Implantar → Nova implantação**), mas isso não é
necessário para o uso normal.

## 6. Ajustes que você mesmo pode fazer (sem programar)

Tudo fica no topo do arquivo `Codigo.gs`, dentro de `const CONFIG = { ... }`:

- **Nome da aba**: troque o texto em `SHEET_NAME`.
- **Texto do status pendente**: troque o texto dentro de `STATUS_PENDENTE`.
  Pode colocar mais de um, separado por vírgula, ex:
  `STATUS_PENDENTE: ['Aguardando Aprovação', 'Em Aprovação']`.

Qualquer outra coisa (adicionar coluna nova pro painel mostrar, mudar cores,
mudar textos), me chame que eu ajusto o código.
