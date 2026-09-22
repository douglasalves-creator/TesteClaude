# SolarGrid — Consulta (Apps Script)

Projeto de **consulta (só leitura)** da planilha de Supply Chain.
São dois arquivos, que vão para o mesmo projeto do Apps Script:

| Arquivo no Apps Script | Arquivo aqui |
|---|---|
| `Codigo.gs` (ou `Codigo_Consulta.gs`) | `Codigo_Consulta.gs` |
| `Index.html` | `Index.html` |

Depois de colar as alterações: **Implantar → Gerenciar implantações → lápis →
Nova versão → Implantar**.

## Abas

- **Compras** — aba `Compras + Logística` da planilha.
- **Serviços** — aba `Serviços`.
- **Valor Praticado** — resumo da aba `Compras + Logística`.

## Como a aba "Valor Praticado" funciona

Cada material aparece **uma única vez** (lista sem repetição da coluna
`DESCRIÇÃO COMPLETA`), com o **último valor praticado** ao lado.

Para achar esse valor, o sistema varre todo o intervalo da coluna
`DATA FORMALIZAÇÃO PEDIDO DE COMPRA E/OU CANCELAMENTO SC` e fica com a data
**mais próxima do dia de hoje**; o `VALOR UNITARIO (BRL)` dessa linha é o que
aparece na tabela. A data usada também é exibida, para conferência.

Regras de descarte (campo em branco não entra na análise):

- linha sem `DESCRIÇÃO COMPLETA` — ignorada;
- linha sem data de formalização, ou com data ilegível — ignorada;
- linha sem `VALOR UNITARIO (BRL)`, ou com erro de fórmula (`#N/D`, `#REF!`…) — ignorada.

Critérios de desempate: se duas datas ficarem à mesma distância do dia de hoje
(uma antes, outra depois), vale a que já passou; se for a mesma data, vale o
registro mais embaixo na planilha.

Os filtros, a busca, a ordenação por cabeçalho e o ajuste de largura das
colunas funcionam igual aos outros módulos. O resultado fica em cache por
6 horas — o botão **Atualizar** recalcula na hora.
