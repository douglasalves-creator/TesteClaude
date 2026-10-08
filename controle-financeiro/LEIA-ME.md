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

| Tela | Para quê |
|---|---|
| **Resumo** | Clique nos botões com o nome das usinas (dá para marcar mais de uma). Aparece a tabela por centro de custo: Orçado, Projetado, Realizado, **Orç − Proj − Real** e **Orç − Real**. Embaixo fica o gráfico com as três linhas no tempo, "Mês a mês" ou "Acumulado". Clique num centro de custo para ver os lançamentos e escrever uma observação. |
| **Envios do fluxo** | Como a previsão mudou a cada envio semanal do Fluxo de Caixa, mês a mês. |
| **Lançamentos** | As três abas linha a linha, com opção de editar, incluir, excluir ou marcar como pago. |

**Testar sem instalar:** abra o arquivo `Painel.html` direto, fora da planilha. Ele entra em **Modo demonstração**, com dados fictícios, e dá para clicar em tudo. Nada é gravado.

**Regras usadas:**
- **Projetado** = itens **Em Aberto** do fluxo escolhido (padrão: o mais recente). O que já foi pago está no Realizado.
- **Realizado** = "Real Acumulado" + "REAL S" (última semana).
- Valores negativos nos deltas aparecem em vermelho.
- As observações ficam numa aba nova, **"Painel - Justificativas"**, que é criada sozinha.
- A aba **Realizado Controladoria** fica só para leitura. As abas **Orçamento** e **Fluxo de Caixa** podem ser editadas pelo painel.

## 5. Ajustes sem programar

Todos ficam no topo do `Codigo.gs`, em `CONFIG`:

- `PROJETADO_SO_EM_ABERTO`: troque para `false` se o Projetado tiver que somar também o que já está "Pago" no fluxo.
- `EDITAVEL`: quais abas podem ser alteradas pelo painel.
- `REALIZADO_SOMA_SEMANA`: troque para `false` se o "Real Acumulado" já incluir a última semana.
