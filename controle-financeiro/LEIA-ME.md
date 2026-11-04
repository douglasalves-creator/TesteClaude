# Controle Financeiro — como instalar na base oficial (10 minutos)

O painel só altera a planilha pelo botão **Detalhar**, só nas abas de **Projeções** e só para quem tem permissão.
Toda alteração fica registrada na aba **Auditoria**.

**Antes de começar, confira na base oficial:**
- As abas se chamam **Orçamento**, **Projeções - Supply** e **Pagamentos / Adiantamentos**.
- Os cabeçalhos usados estão com estes nomes (a posição da coluna não importa):
  - Orçamento (cabeçalho na linha 1): PROJETO, CENTRO DE CUSTO, VALOR A PAGAR, DATA DE VENCIMENTO
  - Projeções - Supply (cabeçalho na linha 1): Projeto Padrão, Centro de Custo Padrão, Valor, Data programada de pgto,
    Data do Fluxo (Fornecedor e Comentário aparecem no Detalhar, se existirem)
  - Pagamentos / Adiantamentos (cabeçalho na linha 2): Data Prog.Pagto., Pago(Sim/Não), Valor líquido (Cont), Projeto,
    Centro Custo Contab (Fornecedor e Documento aparecem no Detalhar, se existirem)
- Os nomes das usinas e dos centros de custo estão escritos igual nas três abas.

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
   - Em Pagamentos / Adiantamentos aparece quantas linhas foram ignoradas por não estarem com **Sim** em Pago.
   - Em cada setor aparece quantos centros de custo ele tem na aba **Setores / CCs**.

## 3. Abrir o painel

- **Dentro da planilha:** recarregue a página. Menu **Controle Financeiro → Abrir painel**.
- **Link para a Diretoria:** **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**.
  O link continua o mesmo. (Primeira vez: **Implantar → Nova implantação → App da Web**, "Executar como: **Eu**",
  "Quem pode acessar: **Qualquer pessoa da SolarGrid**".)

## Controle de acesso

Cada pessoa vê só as abas de setor liberadas para ela. O que ela não pode ver nem chega ao navegador.

1. Menu **Controle Financeiro → Criar abas de acesso** (se ainda não existirem):
   - **Setores / CCs**: uma linha por centro de custo → `Setor | Centro de Custo`.
     Os setores são **Supply**, **Projetos**, **EP** e **GA**. É essa lista que define quais centros de custo do
     **Orçamento** e de **Pagamentos / Adiantamentos** entram em cada aba do painel.
     (Se um setor não tiver nenhum centro de custo aqui, o painel usa os que aparecem na aba de Projeções dele.)
   - **Acessos**: uma linha por pessoa e setor → `E-mail | Setor | Edita`. O setor **TODOS** libera todas as abas.
     Na coluna **Edita**, **Sim** = pode editar as Projeções daquele setor; em branco = só consulta.
     O dono do script sempre vê e edita tudo.
2. **Importante:** quem só pode ver o próprio setor **não pode ter acesso à planilha**. A pessoa usa só o link do painel.

Enquanto a aba **Acessos** não existir, todos veem todas as abas e só o dono edita.

## 4. O que o painel faz

No topo há uma aba por setor: **Supply**, **Projetos**, **EP** e **GA** (as três últimas ainda em construção).

**Supply**
1. **Escolha as usinas** na lista suspensa (dá para digitar e marcar várias). Sem usina marcada, o painel pede uma.
2. **Projeção anterior** e **Projeção atual**: datas da coluna "Data do Fluxo" de Projeções - Supply.
   A anterior já vem com a **menor** data e a atual com a **maior**. Ao trocar, a tabela muda na hora.
3. A **tabela** mostra cada centro de custo com algum valor:
   Orçado · Projeção anterior · Projeção atual · Realizado ·
   **Δ Projeções (Anterior − Atual)** · **Δ (Orçado − Projeção atual − Realizado)** · **Δ (Orçado − Realizado)**.
4. **Clique nos centros de custo** para ver só eles no gráfico.
5. O **gráfico** mostra Orçado, Projeção atual e Realizado mês a mês (clique no nome para esconder uma linha).
   Embaixo, a tabela com o valor de cada mês.
6. **Detalhar** abre os lançamentos: **Projeção atual** (aberta), Projeção anterior, Orçado e Realizado (fechados).
   Quem tem permissão vê **Editar**, **Excluir** e **+ Novo** nas Projeções. Orçamento e Pagamentos são imutáveis.
   Cada alteração vira linhas na aba **Auditoria**: Data e hora · E-mail · Aba · Linha · Ação · Campo · Antes · Depois.

**Regras usadas:**
- **Orçado** = VALOR A PAGAR, pelo mês da DATA DE VENCIMENTO.
- **Projeção** = soma de "Valor" das linhas daquela Data do Fluxo, pelo mês da Data programada de pgto.
- **Realizado** = "Valor líquido (Cont)" só das linhas com **Sim** em Pago, pelo mês da Data Prog.Pagto.
  ("Não" = aprovado e não pago; em branco = em aprovação: não entram.)
- Valores negativos aparecem em vermelho.

## 5. Ajustes sem programar

No topo do `Codigo.gs`, em `CONFIG`:

- `SETORES`: para ligar outro setor, escreva o nome da aba de projeções dele (ex.: `projecoes: 'Projeções - EP'`).
- `CACHE_MINUTOS`: por quantos minutos os dados ficam guardados para o painel abrir rápido (padrão 10).
  O botão **Atualizar** sempre busca os dados novos na hora.
