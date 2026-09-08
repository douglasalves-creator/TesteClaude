# Acionamento de Garantias — decisões do projeto

Documento vivo. Toda decisão combinada fica registrada aqui antes de virar código.

## Regra de ouro (inegociável)

**O código NUNCA se liga à ordem/letra das colunas. Sempre ao texto do cabeçalho.**

Consequências práticas:
- O cabeçalho é lido em tempo de execução e vira um mapa `nome do cabeçalho -> posição`.
- Colunas podem ser movidas, inseridas ou removidas na planilha sem quebrar o sistema.
- A comparação de nomes é tolerante: ignora maiúsculas/minúsculas, acentos e espaços
  duplicados/nas pontas (ex.: `Codigo Rastreio / Romaneio  RFQ` casa com
  `Código Rastreio / Romaneio RFQ`).
- Se um cabeçalho esperado não for encontrado, o sistema avisa de forma clara em vez de
  gravar no lugar errado.

## Fonte de dados

- Planilha: `1CMPJz2lpDODEm3jO5KqmJaiOv4Sb2-bNh8SYvYOJkLI`
- Aba: `Controle Acionamento`
- Linha do cabeçalho: **6** (dados começam na linha 7)
- Volume atual: ~840 linhas
- Outras abas: fora de escopo por enquanto.
- Fase de desenvolvimento roda em uma **cópia** da planilha; ao final trocamos o ID
  para a original (mudança de 1 linha de configuração).

## Acesso e segurança

- Publicação como aplicativo web do Google (Apps Script), executando na conta do usuário.
- Somente e-mails do domínio **@solargrid.com.br** conseguem entrar. Fora do domínio: tela
  de acesso negado.
- Um único link é distribuído para todos os usuários.

## Módulos

1. **Solicitação** — formulário de abertura de um novo acionamento (cria a linha na aba).
2. **Processos** — lista todos os acionamentos, independente do status, com edição dos
   campos de tratamento.
3. **Painel** — reservado para dashboard futuro. Por ora, tela vazia com aviso.

Todos os usuários do domínio enxergam os três módulos (sem perfis/permissões por enquanto).

## Módulo Solicitação — campos do formulário

Ordem e comportamento definidos em 08/09/2026. Nenhum outro campo aparece.

| Campo | Comportamento |
|---|---|
| SCGAR | Gerado automaticamente. **Não aparece** na tela; vai para a planilha. |
| Data de Solicitação | Preenchida com a data de hoje e **travada** para o usuário. |
| RMA / OS (Nº) | Texto livre. **Obrigatório.** |
| Tipo de Acionamento | Lista suspensa. **Obrigatório.** |
| UFV de Origem | Lista suspensa vinda da validação da planilha. |
| Fornecedor | Lista suspensa vinda da validação da planilha. |
| Material/Equipamento | Lista suspensa vinda da validação da planilha. |
| Qtd | **Somente números inteiros.** Vírgula, ponto e letra são bloqueados na digitação e recusados na gravação. |
| Motivo Inicial | Texto livre, campo largo. |
| Equipamento Principal | Lista suspensa vinda da validação da planilha. |
| MAC | Código livre (letras e números), gravado como texto. |
| NS | Código livre (letras e números), gravado como texto. |

Ao salvar, `Status Geral do Acionamento` entra como **Pendente**.

### Como as listas suspensas funcionam

O sistema lê a **regra de validação de dados** da própria coluna na aba
`Controle Acionamento` — inclusive quando ela aponta para outra aba. São
exatamente as mesmas opções que aparecem ao preencher a planilha à mão, e elas
se atualizam sozinhas quando a lista de origem muda (o cache dura 6 horas).

Quando a coluna **não tem** regra de validação, o campo vira sugestão livre com
os valores já digitados naquela coluna.

### Códigos como texto

`MAC` e `NS` recebem formato de texto puro (`@`) na célula antes da gravação,
para não perder zero à esquerda nem virar notação científica.

## Anexos no Google Drive

Definido em 08/09/2026. Anexar arquivo é **obrigatório** para abrir a
solicitação.

- Pasta-mãe: `1IUG089u2h0i3VEHRADwY_HuZTT9pRIVc` (`CONFIG.PASTA_DRIVE_ID`).
- Ao enviar, o sistema cria dentro dela uma subpasta com o nome do SCGAR
  (ex.: `SCGAR-5212`) e grava os arquivos lá. Se a pasta já existir, ela é
  reaproveitada em vez de duplicada.
- Limite somado de **25 MB** por solicitação (`CONFIG.ANEXO_MAX_MB`), conferido
  na tela e no servidor.
- Nomes de arquivo são limpos dos caracteres que o Drive não aceita
  (`NF: 12345/2026.pdf` → `NF- 12345-2026.pdf`).
- A tela aceita arrastar e soltar, lista os arquivos com tamanho, permite
  remover, não repete o mesmo arquivo duas vezes e mostra o andamento.
- No fim aparece uma caixa verde com o botão **Abrir a pasta no Drive**; o mesmo
  link vai no e-mail de aviso, junto da lista de arquivos.

**Ordem da gravação:** os arquivos sobem para o Drive **antes** de a linha ser
criada na planilha. Se o Drive falhar, nada é gravado na planilha e o usuário
pode tentar de novo — não sobra solicitação sem anexo.

Por usar o Drive, o script pede uma **nova autorização** na primeira publicação
depois desta mudança.

Não foi criada coluna para o link da pasta (decisão de 08/09/2026); se quiser
depois, basta criar o cabeçalho e incluí-lo na lista `CAMPOS`.

## Notificação

- A cada nova solicitação, envia e-mail para **procurement.eng@solargrid.com.br**.

## Status Geral do Acionamento (lista oficial)

Pendente · Em aprov . Orçamento · Em andamento análise · Em Trânsito ·
Em prog. de retorno · Em confirm. de conclusão · Concluído · Cancelado ·
Ag envio OEM · Em andamento para Envio

## Desempenho

Meta: nenhuma ação deve passar de poucos segundos.
- A lista carrega apenas as colunas necessárias, não a planilha inteira.
- Os dados ficam em cache por alguns minutos; gravações limpam o cache.
- Gravação sempre pontual (célula/linha específica), nunca reescrita da aba.

## Identidade visual

Baseada no brandbook SolarGrid (abril/2026):

| Token | Cor | Uso na tela |
|---|---|---|
| Aurora | `#EC6E2D` | cor principal, botões, destaques, status ativo |
| Eclipse | `#0A0F14` | barra superior, cabeçalho da gaveta, textos |
| Sirius | `#F3F3F3` | fundo geral, cabeçalho de tabela |
| Cosmos | `#0D3459` | apoio em status e gráficos futuros |
| Névoa | `#D8D8D8` | bordas e divisores |
| Amarelo Solar | `#EAFF67` | acento pontual (status Em Trânsito) |

Fonte **Montserrat** em todos os pesos. Cantos de **12px**. Estética minimalista,
fundo claro com blocos escuros de destaque. Logo: `CONFIG.LOGO_URL` aceita o
endereço da imagem oficial; enquanto vazio, usa o nome escrito em Montserrat.

## Código SCGAR

Formato `SCGAR-0001`. A contagem parte de `CONFIG.SCGAR_MINIMO` (**5211**) e
avança de um em um: `SCGAR-5212`, `SCGAR-5213`, `SCGAR-5214`...

**Não** se usa o maior número da coluna. A planilha tem códigos herdados de
outros sistemas com numeração bem mais alta (faixa 15xxx) e olhar para o maior
fazia o sistema entregar `SCGAR-15950`. Em vez disso, o último número entregue
fica guardado nas propriedades do script (`gar_ultimo_scgar`) e o sistema só
confere se o código seguinte já está em uso na coluna, pulando para o próximo
livre se estiver.

Para reiniciar a contagem: mude `CONFIG.SCGAR_MINIMO` e apague a propriedade
`gar_ultimo_scgar` em *Configurações do projeto → Propriedades do script*.

Tudo dentro de uma trava, para dois usuários simultâneos não pegarem o mesmo
número.

## Aba Auditoria

Aba `Auditoria`, cabeçalho na linha 1, colunas **Data / Hora · Usuário · Ação ·
Linha · SC · Campo · De → Para**. Como no resto do sistema, as colunas são
localizadas pelo texto do cabeçalho e podem ser reordenadas.

Uma linha por campo alterado. A coluna `Ação` recebe:

| Ação | Quando |
|---|---|
| `Solicitação` | abertura pelo formulário |
| `Edição` | alteração de um acionamento |
| `Edição em lote` | alteração aplicada a vários |

`De → Para` mostra os valores como aparecem na planilha, com `(vazio)` quando o
campo estava ou ficou em branco. Na abertura, além de uma linha por campo
preenchido, entra uma linha `ABERTURA DA SOLICITAÇÃO` com o código e a
quantidade de anexos.

O registro nunca derruba a operação: se a aba não existir ou falhar, a gravação
na planilha continua valendo e o erro fica só no log do script. Para desligar,
deixe `CONFIG.ABA_AUDITORIA` em branco.

## Colunas duplicadas

Resolvido em 08/09/2026: os cabeçalhos foram renomeados na planilha para
`Aprov Marcella (Envio) / (Reparo) / (Retorno)`, `Aprov Felipe (...)` e
`Valor do Frete / Envio Estimado (Envio) / (Retorno)`.

Resta **um** par duplicado: `Codigo Rastreio / Romaneio RFQ` aparece duas vezes
(a segunda com espaço duplo). Por serem títulos iguais, o sistema as diferencia
pela ordem de aparição — 1ª = envio, 2ª = retorno (campo `ocor` na lista
`CAMPOS`). É o **único** ponto do projeto onde a ordem importa. Renomear para
`(Envio)` e `(Retorno)` elimina a exceção.

## Proteções na gravação

- Grava só as células alteradas, nunca a aba inteira.
- Confere se o SCGAR da linha continua o mesmo antes de gravar; se alguém apagou
  ou inseriu linhas no meio, recusa e pede para atualizar a lista.
- Colunas de fórmula (`CÓD MXM`) e campos automáticos (`SCGAR`,
  `Data de Solicitação`) são somente leitura — nunca sobrescritos.
- `LockService` evita duas gravações simultâneas.
- Na abertura, a fórmula do `CÓD MXM` é copiada da linha de cima.

## Verificação já feita

Simulação com os 49 cabeçalhos reais:
- 49 de 49 campos resolvidos pelo nome.
- Com as colunas **invertidas de ordem e 5 apagadas**: 44 resolvidos e os 5
  ausentes corretamente reportados — nada gravado fora de lugar.
- SCGAR sequencial, datas em 3 formatos, valores com vírgula e a trava de linha
  trocada: todos aprovados.

## Módulo Processos

Definido em 08/09/2026.

### Tabela
- **Todas** as colunas da aba aparecem, na ordem da lista `CAMPOS`.
- Rolagem lateral livre; as colunas de seleção e **SCGAR** ficam travadas à
  esquerda para não perder a referência.
- Cabeçalho fixo no topo durante a rolagem vertical, dentro do próprio quadro da
  tabela (era o que causava o descasamento anterior).
- **100 acionamentos por página**, com navegação Anterior / Próxima.
- O índice de todas as linhas é leve e vem de uma vez; o conteúdo completo é
  buscado só das 100 linhas da página exibida e fica guardado na tela.

### Filtros
Uma caixinha de seleção múltipla para **Status** (dá para marcar vários), mais
filtros para: SCGAR, Data de Solicitação (de / até), RMA / OS (Nº),
Tipo de Acionamento, Responsável Atual, UFV de Origem e Fornecedor.

- Campos com opções conhecidas viram caixinha de seleção múltipla com busca.
- SCGAR e RMA / OS são busca por trecho.
- Data de Solicitação é intervalo.
- Há ainda a busca livre, que procura em qualquer campo da linha.
- Todo filtro roda no navegador — resposta imediata, sem ir à planilha.

### Edição em lote
Caixas de seleção por linha (e uma para marcar a página inteira). Com pelo menos
um marcado, aparece a barra **Editar em lote**.

Na gaveta de lote, cada campo tem uma marca de "aplicar" que se liga sozinha
quando você mexe no campo. **Só os campos marcados são gravados** — o resto das
colunas dos acionamentos selecionados não é tocado.

A gravação em lote acontece uma coluna por vez, em um único movimento, e devolve
intacto (inclusive fórmulas) o conteúdo das linhas que **não** foram
selecionadas.

As regras de preenchimento são as mesmas da edição individual.

### Paginação
Botões **Início · Anterior · Próxima · Fim**, com desligamento automático nas
pontas.

### Listas suspensas — seletor próprio
Todos os campos de lista usam um seletor construído por nós, não o `<select>` do
navegador. Motivo: colunas sem regra de validação (como `Equipamento Principal`)
caem para os valores já digitados, o que pode passar de cem itens — o navegador
desenhava esse caso como um painel gigante fora do lugar, diferente dos demais
campos.

O seletor tem campo de busca, mostra no máximo 300 itens por vez (com contagem
do total), tem a opção "Deixar em branco" e fica com a mesma largura e a mesma
aparência em todos os campos, no formulário, na edição individual e no lote.

### Regras de preenchimento

| Campos | Regra |
|---|---|
| Valor do Frete / Envio Estimado (Envio), Valor Reparo, Valor do Frete / Envio Estimado (Retorno) | Valor em R$. Vazio mostra `R$ 0,00`; os dígitos entram da direita para a esquerda. Só é gravado se o campo for realmente mexido. |
| Data Emissão Declaração, Aprov Marcella (Envio/Reparo/Retorno), Aprov Felipe (Envio/Reparo/Retorno), Data envio/Coleta, Data Chegada no Fornecedor, Data Saida / Coleta Fornecedor (Real), Data Chegada na usina | **Somente data.** Seletor de calendário na tela e recusa no servidor para qualquer coisa que não seja data válida (31/02 e 45/13 inclusive). |
| Qtd | Somente números inteiros. |
| MAC, NS | Texto puro, preserva zero à esquerda. |

Os seis campos `Aprov Marcella` / `Aprov Felipe` deixaram de ser
Aprovado/Reprovado e passaram a ser **data da aprovação**.

## Verificação em navegador

Testado em Chromium com 840 linhas simuladas e os 49 cabeçalhos reais:

- Formulário com os 11 campos certos, na ordem certa; as 4 listas suspensas
  como caixa de seleção fechada, incluindo Equipamento Principal.
- Tabela com 50 colunas (49 + seleção), 100 linhas por página, 9 páginas,
  cabeçalho alinhado, rolagem lateral de 6072px e SCGAR travado à esquerda.
- Filtros: 2 status marcados → 280 de 840; SCGAR "5211" → 1; intervalo de datas
  → 90; busca livre "Huawei" → 210; limpar → 840.
- Dinheiro: vazio `R$ 0,00`; digitar 123456 → `R$ 1.234,56`; apagar → `R$ 123,45`.
- Os 11 campos de data renderizam como seletor de calendário.
- Salvar sem mexer em nada não envia nada; mexendo em 2 campos, envia exatamente
  esses 2.
- Lote em 3 acionamentos envia só o campo marcado; as linhas vizinhas na planilha
  ficam intactas.

## Pendências em aberto

- Validar na cópia da planilha com dados reais.
- Definir os indicadores do módulo Painel.
- Renomear o par `Codigo Rastreio / Romaneio RFQ` (opcional).
