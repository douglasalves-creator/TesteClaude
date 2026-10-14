# Farol de Aprovações: como instalar

O painel lê a aba **"Relatório de Aprovações"** e mostra as requisições com
status **"Em Aprovação"**: com quem está cada uma, quantos níveis faltam e o
farol de prazo até a Prog. Pagto.

## 1. Instalar o script na planilha

1. Abra a planilha "Gestão de Aprovações - CSC" no Google Sheets.
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo do `Código.gs` e cole o conteúdo de `Codigo.gs` deste pacote.
4. Clique no `+` ao lado de "Arquivos" → **HTML** → nomeie exatamente `Farol`
   e cole o conteúdo de `Farol.html`.
5. Em **Configurações do projeto** (engrenagem), confira se o fuso horário é
   **(GMT-03:00) São Paulo**.
6. Salve (Ctrl+S).

## 2. Testar

1. No editor, escolha a função `diagnosticar` e clique em **Executar**.
2. Na primeira vez, aceite a autorização.
3. Em **Registros de execução** aparecem as linhas lidas, quantas requisições
   estão em aprovação e se faltou alguma coluna.

## 3. Abrir o farol

- **Dentro da planilha:** recarregue a página. Vai aparecer o menu
  **Farol de Aprovações → Abrir farol**.
- **Por link (tela cheia):** **Implantar → Nova implantação → App da Web**.
  Executar como "Eu" e acesso "Qualquer pessoa da SolarGrid". Copie o link gerado.

## 4. Atualizar os dados (rotina)

1. Baixe o relatório "Requisições Pagamento Status" no MXM.
2. Na aba **Relatório de Aprovações**, apague tudo e cole o relatório inteiro,
   como veio (inclusive a linha 1 com "Data: ... Hora: ...").
3. No farol, clique em **Atualizar**.

Não é preciso mexer em mais nada. O script acha o cabeçalho sozinho.

## 5. Regras usadas

- **Com quem está:** o primeiro nível ainda sem data em "Aprovação". A ordem
  dos níveis é aprendida das requisições já aprovadas no próprio relatório
  (quem costuma aprovar antes de quem). Se dois níveis nunca apareceram
  juntos, vale a ordem das linhas do relatório.
- **Aprovação por grupo:** níveis por categoria (ex.: Analista Contábil,
  Supervisão Billing) não têm aprovador alocado. O farol mostra o cargo e quem
  costuma aprovar esse nível no histórico.
- **Farol:** dias úteis de hoje até a Prog. Pagto, sem fins de semana e sem
  feriados nacionais (inclui Carnaval e Corpus Christi). Negativo = vencida.
- **Valor:** "Líquido - Títulos" da requisição.

## 6. Ajustes sem programar

No topo do `Codigo.gs`, em `const CONFIG = { ... }`:

- `LOGO_URL`: link público da imagem do logo. Vazio = texto "SolarGrid".
- `FAIXAS`: limites do farol (3, 6, 10 dias).
- `CONTAR_CARNAVAL_COMO_FERIADO` / `CONTAR_CORPUS_CHRISTI_COMO_FERIADO`.
- **Feriados locais:** crie uma aba **"Feriados"** com as datas na coluna A.
