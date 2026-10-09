# Painel Financeiro — como instalar (10 minutos)

## 1. Colar os arquivos

1. Abra a planilha de **Controle Financeiro**.
2. Menu **Extensões → Apps Script**.
3. No arquivo `Código.gs`, apague tudo e cole o conteúdo do arquivo `Codigo.gs` deste pacote.
4. Clique no **+** ao lado de "Arquivos" → **HTML** → dê o nome exato **`Painel`** e cole o conteúdo do arquivo `Painel.html`.
5. Salve (Ctrl+S).

## 2. Testar

1. No topo do editor, escolha a função **`diagnosticar`** e clique em **Executar ▷**.
2. Aceite a autorização (é a sua própria planilha).
3. Vá em **Registros de execução**. Para cada aba, deve aparecer quantas linhas foram lidas.
   Se aparecer **"Colunas NÃO encontradas"**, o nome daquela coluna na planilha está diferente.
   Me mande o print que eu ajusto.

## 3. Abrir o painel

- **Dentro da planilha:** recarregue a página. Vai aparecer o menu **Painel Financeiro → Abrir painel**.
- **Em tela cheia (para a Diretoria):** no editor, clique em **Implantar → Nova implantação → tipo "App da Web"**.
  Em "Executar como", escolha **Eu**. Em "Quem pode acessar", escolha **Qualquer pessoa da SolarGrid**. Depois clique em **Implantar** e copie o link.
  Depois de qualquer alteração no código: **Implantar → Gerenciar implantações → editar (lápis) → Nova versão**.

## 4. O que o painel faz

O painel é só de consulta: ele não altera nada na planilha.

1. **Escolha as usinas** na lista suspensa do topo. Dá para digitar o nome para procurar e marcar várias.
   Sem nenhuma usina marcada, o painel pede para selecionar uma.
2. **Escolha o fluxo** em "Fluxo de". Ele já vem com o envio mais recente.
   Em **"comparar com"**, escolha outro envio (já vem o da semana anterior). A variação do Projetado aparece em letra pequena
   abaixo de cada valor, e o gráfico ganha uma linha cinza com o Projetado daquele envio. Escolha "Não comparar" para esconder.
3. A **tabela** mostra todos os centros de custo, com centavos: Orçado, Projetado, Realizado, **Orç − Proj − Real** e **Orç − Real**.
   Com várias usinas marcadas, os valores são somados.
4. **Clique nos centros de custo** para marcar quais aparecem no gráfico. Sem nenhum marcado, o gráfico mostra todos.
5. O botão **Detalhar** abre ao lado todos os lançamentos daquele centro de custo, separados em Orçado, Projetado e Realizado.
6. O **gráfico** mostra Orçado, Projetado e Realizado mês a mês. Embaixo dele há uma tabela com o valor de cada mês.

**Regras usadas:**
- **Projetado** = itens **Em Aberto** do fluxo escolhido. O que já foi pago está no Realizado.
- **Realizado** = "Real Acumulado" + "REAL S" (última semana).
- Valores negativos aparecem em vermelho.

## 5. Ajustes sem programar

Todos ficam no topo do `Codigo.gs`, em `CONFIG`:

- `PROJETADO_SO_EM_ABERTO`: troque para `false` se o Projetado tiver que somar também o que já está "Pago" no fluxo.
- `REALIZADO_SOMA_SEMANA`: troque para `false` se o "Real Acumulado" já incluir a última semana.
