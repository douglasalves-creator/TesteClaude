# Farol de Aprovações: como instalar

O painel tem duas abas, cada uma lendo uma aba da planilha:

| Aba do farol | Aba da planilha |
|---|---|
| Pagamentos | **Relatório de Aprovações - Pagamentos** |
| Adiantamentos | **Relatório de Aprovações - Adiantamentos** |

Em cada uma, mostra as requisições com status **"Em Aprovação"**: com quem está cada uma, quantos níveis faltam e o
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
2. Na aba correspondente (**Relatório de Aprovações - Pagamentos** ou
   **- Adiantamentos**), apague tudo e cole o relatório inteiro,
   como veio (inclusive a linha 1 com "Data: ... Hora: ...").
3. Pronto. Ao colar, o script já processa o relatório em segundo plano e
   guarda o resultado em cache. Nas próximas aberturas o farol carrega na hora.
   Se o farol já estiver aberto, clique em **Atualizar**.

Não é preciso mexer em mais nada. O script acha o cabeçalho sozinho.

O cache vale por 6 horas e é refeito sozinho quando o relatório muda ou o dia
vira. Quando isso acontece, a primeira abertura leva alguns segundos.

## 4.1 Downloads

- **Com quem está → ícone de download** ao lado de cada aprovador: baixa um
  Excel com as requisições pendentes com ele (respeitando os filtros ativos),
  uma linha por rateio, com as colunas Cd.Empresa, St.Requisição, Centro de
  Custo, Número do Título, Número Req. Pagto, Valor líquido - Apr, Projeto, Setor,
  Data Vencimento, Fora do Prazo, Aprovador alocado e Fornecedor.
- **Exportar Excel**: a lista que está na tela.
- **Copiar nº das requisições**: copia os números da lista (um por linha),
  para conferir com o relatório.

O Excel é gerado no navegador com a biblioteca SheetJS (cdnjs.cloudflare.com).
Se a rede da empresa bloquear esse endereço, o download não funciona.

## 5. Regras usadas

- **Com quem está (Pagamentos e Adiantamentos):** o primeiro nível ainda sem data de
  aprovação. A ordem dos níveis é aprendida das requisições já aprovadas no próprio relatório
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

## 7. Adiantamentos

O relatório "Requisição de Adiantamento" do MXM tem colunas diferentes do de
Pagamentos. O mapa de cada um fica em `LAYOUTS`, no `Codigo.gs`:

| Uso no farol | Pagamentos | Adiantamentos |
|---|---|---|
| Nº da requisição | Número Req. Pagto | Número Requisição |
| Status | St.Requisição | Status |
| Prog. pagto | Data Prog.Pagto. | Data Prog. Pag. |
| Valor | Líquido - Títulos | Valor Adiantamento |
| Data da aprovação | Aprovação (2ª coluna) | Data Aprovação |

O Excel por aprovador de Adiantamentos traz: Cd.Empresa, Status, Centro de
Custo, Código Projeto, Doc. Antecipação, Número Requisição, Vlr Grp.
Antecipação, Valor Adiantamento, Descrição Setor, Data Prog. Pag., Aprovador
Alocado, Fornecedor e Justificativa. Para mudar, edite `arquivo` em
`LAYOUTS.adiantamentos`.

## 8. Relatórios pela pasta do Drive (rotina atual)

O farol lê os relatórios direto da pasta do Drive configurada em
`CONFIG.PASTA_ID`. Não é preciso importar nem renomear abas.

**Rotina:** baixe os dois relatórios do MXM e coloque os .xlsx na pasta, sem
renomear. Em cada tipo vale o arquivo mais recente (o nome deve conter
"pagamento" ou "adiantamento"; a linha 1 é conferida). Arquivos antigos podem
ficar ou ser apagados.

**Instalação (uma vez):**
1. Apps Script → Configurações do projeto (engrenagem) → marque
   "Mostrar arquivo de manifesto appsscript.json no editor".
2. No editor, abra `appsscript.json` e substitua todo o conteúdo pelo deste
   pacote. Ele já ativa os serviços Drive API e Google Sheets API e trava as
   permissões.
3. Substitua `Código.gs` e `Farol`, salve, execute `diagnosticar` e autorize.
4. Se usa o link do App da Web: Implantar → Gerenciar implantações → editar →
   Nova versão.

**Segurança (permissões pedidas):**
| Permissão | Para quê |
|---|---|
| Ver arquivos do Drive (só leitura) | listar a pasta e abrir os .xlsx |
| Arquivos criados pelo próprio app | criar e apagar a cópia temporária usada para ler o .xlsx |
| Só esta planilha | aba Feriados (opcional) e abas antigas |
| Janelas na planilha | menu e janela do farol |

O app não edita nem apaga nada no Drive além da própria cópia temporária, e
só lê a pasta configurada. Pelo link do App da Web, o farol roda com a conta
de quem implantou: quem abre vê só o painel, sem acesso à pasta. Pelo menu da
planilha, roda com a conta de quem clicou, que precisa ter acesso à pasta.

Se não houver relatório na pasta, o farol usa a aba antiga
(`Relatório de Aprovações - ...`), se existir.
