# Controle Financeiro — como instalar na base oficial (10 minutos)

O painel só altera a planilha pelo detalhe do centro de custo (clique no nome), só nas abas de **Projeções** e só para quem tem permissão.
Toda alteração fica registrada na aba **Auditoria**.

**Antes de começar, confira na base oficial:**
- As abas se chamam **Orçamento**, **Projeções - Supply**, **Projeções - Engenharia**, **Realizado Controladoria**, **Usinas** e **Setores / CCs**.
- Os cabeçalhos usados estão com estes nomes (a posição da coluna não importa):
  - Orçamento (cabeçalho na linha 1): PROJETO, CENTRO DE CUSTO, VALOR A PAGAR, DATA DE VENCIMENTO
  - Projeções - Supply (cabeçalho na linha 1): Projeto Padrão, Centro de Custo Padrão, Valor, Data programada de pgto,
    Data do Fluxo (Fornecedor e Comentário aparecem no Detalhar, se existirem)
  - Realizado Controladoria (cabeçalho na linha 1): Cod. Projeto (código da usina), C. Custo (código), Pagamentos, Pagto.
    (Favorecido, Documento e Consolidado aparecem no Detalhar)
- Usinas e centros de custo são ligados pelo **código** (usina "A0162-4", centro de custo "801"), não pela descrição.
  Os nomes mostrados vêm das abas **Usinas** e **Setores / CCs**.

## 1. Colar os arquivos

1. Abra a planilha de **Controle Financeiro**.
2. Menu **Extensões → Apps Script**.
3. No arquivo `Código.gs`, apague tudo e cole o conteúdo do arquivo `Codigo.gs` deste pacote.
4. No arquivo **`Painel`** (HTML), apague tudo e cole o conteúdo do arquivo `Painel.html`.
   Se ainda não existir: clique no **+** ao lado de "Arquivos" → **HTML** → nome exato **`Painel`**.
5. Salve (Ctrl+S).

## 2. Testar

1. No topo do editor, escolha a função **`diagnosticar`** e clique em **Executar ▷**.
2. Vá em **Registros de execução**. Para cada aba, deve aparecer quantas linhas foram lidas.
   - Se aparecer **"Colunas NÃO encontradas"**, o nome daquela coluna na planilha está diferente. Me mande o print.
   - Aparecem as projeções em centros de custo fora da lista do setor (não entram nos números).
   - Em cada setor aparece quantos centros de custo ele tem na aba **Setores / CCs**.

## 3. Abrir o painel

- **Dentro da planilha:** recarregue a página. Menu **Controle Financeiro → Abrir painel**.
- **Link para a Diretoria:** **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**.
  O link continua o mesmo. (Primeira vez: **Implantar → Nova implantação → App da Web**, "Executar como: **Eu**",
  "Quem pode acessar: **Qualquer pessoa da SolarGrid**".)

## Controle de acesso

Cada pessoa vê só as abas de setor liberadas para ela. O que ela não pode ver nem chega ao navegador.

1. Menu **Controle Financeiro → Criar abas de acesso** (se ainda não existirem):
   - **Setores / CCs**: uma linha por centro de custo → `Setor | Código | Centro de Custo`.
     Os setores são **Supply**, **Projetos**, **EP** e **GA**. É essa lista que define quais centros de custo do
     **Orçamento**, das **Projeções** e do **Realizado Controladoria** entram em cada aba do painel.
     (Se um setor não tiver nenhum centro de custo aqui, o painel usa os que aparecem na aba de Projeções dele.)
   - **Acessos**: uma linha por pessoa e setor → `E-mail | Setor | Edita`. O setor **TODOS** libera todas as abas.
     Na coluna **Edita**, **Sim** = pode editar as Projeções daquele setor; em branco = só consulta.
     O dono do script sempre vê e edita tudo.
2. **Importante:** quem só pode ver o próprio setor **não pode ter acesso à planilha**. A pessoa usa só o link do painel.

Enquanto a aba **Acessos** não existir, todos veem todas as abas e só o dono edita.

## 4. O que o painel faz

No topo há uma aba por setor: **Supply**, **Projetos**, **EP** e **GA** (Projetos ainda em construção).

**EP** (igual ao Supply, com uma projeção só)
1. Escolha as usinas na lista (os nomes aparecem só com a descrição, sem o código). Na lista só entram as usinas com algum
   lançamento de EP (orçado, projeção ou realizado).
2. Faixa de resumo: velocímetro, **Orçado**, **Projeção**, **Realizado acumulado** e **Saldo** (ou Estouro previsto). No EP não há Realizado semanal.
3. Tabela com os centros de custo de EP: Orçado · Projeção (com o balão de comentário) · Realizado acumulado ·
   **Δ Orçado − (Projeção + Realizado)** · **Δ Orçado − Realizado** · Aderência orçamentária. Clique num centro de custo para ver os lançamentos.
4. Regras:
   - **Projeção** = aba **Projeções - Engenharia**, só as linhas com **Setor = EP** (se "Setor Corrigido" estiver preenchido, vale ele;
     se "Centro de Custo Corrijido" estiver preenchido, vale ele). Não há "Data do Fluxo", então não há comparação de semanas.
   - **Orçado** e **Realizado** = linhas cujo centro de custo é de EP na aba **Setores / CCs** (956 a 971).
   - Comentários funcionam como no Supply, mas sem separação por semana.
5. **Lançamentos do centro de custo:** Projeção, Orçado e Realizado acumulado (com a coluna **Consolidado**).
6. **Editar a Projeção pelo painel** (só no EP e só para quem tem **Sim** na coluna Edita da aba Acessos, no setor EP ou TODOS):
   - **lápis**: altera só o **Valor** e a **Data programada de pgto** daquela linha;
   - **lixeira vermelha**: apaga a linha da aba Projeções - Engenharia;
   - **+ Nova projeção**: inclui uma linha no centro de custo aberto (escolha a usina, o valor e a data).
     Setor = EP, Situação = Em Aberto e Fornecedor = A DEFINIR são preenchidos sozinhos.
   - O painel só mexe em linhas com Setor = EP; Orçamento, Realizado e as linhas de Projetos não podem ser alterados.
   - Toda alteração fica registrada na aba **Auditoria** (data, e-mail, linha, campo, antes e depois).

**GA** (só Orçado × Realizado; GA não tem projeção)
1. Não tem filtro: a tabela mostra direto os 5 centros de custo de GA (CPX Manutenção Geral, GPX Manutenção Inversor,
   Garantias, Reinvestimento e Sinistro). Clique na **setinha** para abrir as usinas daquele centro de custo.
2. No topo, escolha o ano: **Total** (todos os anos, inclusive o orçamento futuro), **2025**, **2026**, os demais anos na lista
   **Outros anos**, ou **Comparar anos** (Orçado, Realizado e Δ de 2025, 2026 e do total, lado a lado).
   Os valores do resumo (velocímetro, Orçado, Realizado acumulado e semanal, Saldo) e da tabela seguem o ano escolhido.
   Ao lado, a **busca**: digite uma palavra ou valor (usina, centro de custo, fornecedor, documento, data ou valor) e a aba inteira
   (resumo, tabela e lançamentos) passa a mostrar só o que bate. Para limpar, apague o texto ou aperte Esc.
3. Colunas: Orçado · Realizado (com o semanal embaixo) · **Δ (Orçado − Realizado)** · Aderência orçamentária.
4. Clique numa usina para ver os lançamentos de Orçado, Realizado acumulado e Realizado semanal.
5. Regras:
   - **Orçado** = só as linhas do Orçamento com SETOR = **GE - ENG - GESTÃO DE ATIVO** (VALOR A PAGAR, ano da DATA DE VENCIMENTO).
   - **Realizado** = linhas do Realizado Controladoria com centro de custo de GA (pelo código ou pelo nome na coluna Centro de Custo),
     ano da coluna Pagto.
   - O centro de custo aparece se estiver no orçado, no realizado ou nos dois; dentro dele aparecem todas as usinas em que foi usado.
   - Os 5 centros de custo de GA vêm da aba **Setores / CCs** (setor **GA**).
   - **Nome da usina:** sempre só a descrição, sem o código (padrão do Orçamento). Vem da aba **Usinas**; se a usina não estiver lá,
     do texto do Orçamento; se só tiver realizado, da coluna **Projeto** (descrição) do Realizado Controladoria.
     A ligação entre as abas continua pelo código (coluna **Cod. Projeto** no Realizado) ou, sem código, pela descrição igual à da aba Usinas.

**Supply**
1. **Escolha as usinas** na lista suspensa (dá para digitar e marcar várias). Sem usina marcada, o painel pede uma.
2. **Projeção anterior** e **Projeção atual**: datas da coluna "Data do Fluxo" de Projeções - Supply.
   A anterior já vem com a **menor** data e a atual com a **maior**. Ao trocar, a tabela muda na hora.
3. No topo, uma **faixa de resumo**: velocímetro (% do orçado comprometido), **Orçado**, **Projeção atual**, **Realizado acumulado**,
   o quadro **Semana** (realizado na semana × queda da projeção e a diferença entre os dois, que deve ficar perto de zero)
   e o **Saldo** (ou Estouro previsto). O quadro **Semana** fica no canto direito.
4. A **tabela** separa os centros de custo em **Curva A**, **BOP** e **Outros** (pela descrição), com subtotal de cada grupo
   (clique no grupo para abrir ou fechar). Colunas: Orçado · **Projeção atual** (com a anterior embaixo, entre parênteses) ·
   **Δ semana** (▼ verde = a projeção caiu, ▲ vermelho = subiu, com o % embaixo) · **Realizado semanal** (com o acumulado
   embaixo) · **Δ (Orçado − Realizado)** · Aderência orçamentária. A tabela vem do maior risco para o menor; clique no título de uma
   coluna para ordenar por ela.
5. Clique num centro de custo para ver os lançamentos.
6. **Clique no nome do centro de custo** para abrir os lançamentos: **Projeção atual** (aberta), Projeção anterior, Orçado, Realizado acumulado e Realizado semanal (fechados).
   No **Supply**, o painel é só de consulta (nada é alterado na planilha). Para liberar a edição de um setor, use `editavel` em `CONFIG.SETORES`.
   Cada alteração vira linhas na aba **Auditoria**: Data e hora · E-mail · Aba · Linha · Ação · Campo · Antes · Depois.

**Comentários**
- O balão 💬 fica na coluna **Projeção atual (anterior)**, ao lado do valor: é a variação da projeção que se comenta.
  Ele só fica **laranja, com número,** quando há comentário **da semana em análise** (a Data do Fluxo escolhida em "Projeção atual").
- **Passando o mouse** no balão laranja, o comentário aparece na hora (data + texto). **Clicando**, abre a janela para escrever. Comentários de outras semanas ficam
  recolhidos em "Semanas anteriores". O comentário vale para todas as usinas selecionadas.
- Tudo fica salvo na aba **Comentários** (o cabeçalho é criado sozinho): Data do comentário · E-mail · Setor · Código e nome da usina ·
  Código e nome do centro de custo · Data do Fluxo atual e anterior · Comentário · e os valores do momento (Orçado, Projeção anterior,
  Projeção atual, Δ semana, Realizado semanal e acumulado) · Usinas na análise.
- Todos que acessam o setor veem os comentários. Quem não tem acesso ao setor não vê nem comenta.

**Regras usadas:**
- **Orçado** = VALOR A PAGAR, pelo mês da DATA DE VENCIMENTO.
- **Projeção** = soma de "Valor" das linhas daquela Data do Fluxo, pelo mês da Data programada de pgto.
- **Realizado acumulado** = "Pagamentos" do Realizado Controladoria (todas as linhas), pelo mês da coluna Pagto.
- **Realizado semanal** = mesma soma, só das linhas com **Semanal** na coluna "Semanal / Acumulado".
- **Quais centros de custo entram no Supply** (mesma regra nas três abas, ligando pelo código):
  1. Código cadastrado na aba Setores / CCs → vale o setor de lá (Supply entra; outro setor fica de fora).
  2. Sem cadastro: nas Projeções - Supply, entra (centro de custo vazio aparece como "(em branco)");
     no Orçamento e no Realizado, entra se a descrição tiver BOP, CURVA A, SUPPLY, SUP, LOG, LOGÍSTICA ou COMPRAS,
     ou, no Orçamento, se a coluna SETOR tiver BOP, CURVA A ou LOGÍSTICA.
  3. Só aparecem os que têm algum valor para as usinas escolhidas.
- O **diagnosticar** lista o que entrou sem cadastro e o que ficou de fora por ser de outro setor.
- Valores negativos aparecem em vermelho.

## 5. Ajustes sem programar

No topo do `Codigo.gs`, em `CONFIG`:

- `SETORES`: para ligar outro setor, escreva o nome da aba de projeções dele (ex.: `projecoes: 'Projeções - EP'`).
  As palavras que puxam centros de custo sem cadastro para o setor ficam em `palavras` e `orcSetor`.
- `CACHE_MINUTOS`: por quantos minutos os dados ficam guardados para o painel abrir rápido (padrão 10).
  O botão **Atualizar** sempre busca os dados novos na hora.
