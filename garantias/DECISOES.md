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

O link abre numa **tela de início** com três cartões — Solicitação, Processos e
Painel — sobre fundo Eclipse. O menu superior só aparece **depois** de escolher
um módulo. Título **Controle de Acionamentos** com
**SolarGrid** em Aurora na linha de baixo, saudação, e o aviso de acesso
restrito centralizado no pé. O logo no topo e o botão **Início** voltam para lá.

### Sem saudação com nome

Decidido em 08/09/2026: a tela mostra apenas **"Escolha por onde começar."**

Motivo: o Google entrega só o **e-mail**, nunca o nome. E-mails como `m.souza@`
ou `procurement.eng@` não permitem deduzir o primeiro nome de forma confiável,
e chamar alguém de "M" ou pelo nome do setor é pior do que não saudar.

1. **Solicitação** — formulário de abertura de um novo acionamento (cria a linha na aba).
2. **Processos** — lista todos os acionamentos, independente do status, com edição dos
   campos de tratamento.
3. **Painel** — indicadores de acompanhamento (ver seção própria).

Todos os usuários do domínio enxergam os três módulos (sem perfis/permissões por enquanto).

## Módulo Solicitação — campos do formulário

Ordem e comportamento definidos em 08/09/2026. Nenhum outro campo aparece.

| Campo | Comportamento |
|---|---|
| SCGAR | Gerado automaticamente. **Não aparece** na tela; vai para a planilha. |
| Data de Solicitação | Preenchida com a data de hoje e **travada** para o usuário. |
| RMA / OS (Nº) | Texto livre. **Opcional.** |
| Tipo de Acionamento | Lista suspensa. **Obrigatório.** |
| UFV de Origem | Lista suspensa vinda da validação da planilha. **Obrigatório.** |
| Fornecedor | Lista suspensa vinda da validação da planilha. **Obrigatório.** |
| Material/Equipamento | Lista suspensa vinda da validação da planilha. **Obrigatório.** |
| Qtd | **Somente números inteiros.** Vírgula, ponto e letra são bloqueados na digitação e recusados na gravação. **Obrigatório.** |
| Motivo Inicial | Texto livre, campo largo. **Obrigatório.** |
| Equipamento Principal | Lista suspensa vinda da validação da planilha. **Obrigatório.** |
| MAC | Código livre (letras e números), gravado como texto. **Opcional.** |
| NS | Código livre (letras e números), gravado como texto. **Opcional.** |

Ou seja: **tudo obrigatório, menos RMA / OS, MAC e NS.**

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

## Módulo Painel

Definido em 08/09/2026. Quatro contagens, calculadas **na mesma leitura da
planilha** que monta a lista de Processos — não custa ida extra ao servidor.

| Gráfico | Coluna analisada | Mostra |
|---|---|---|
| Acionamentos por mês | `Data de Solicitação` | os últimos 24 meses |
| Fornecedores mais acionados | `Fornecedor` | os 10 primeiros |
| Equipamentos com mais acionamentos | `Equipamento Principal` | os 10 primeiros |
| Acionamentos por status | `Status Geral do Acionamento` | todos, para comparar |
| Acionamentos por usina | `UFV de Origem` | as 10 primeiras |

Acima deles, quatro números: total de acionamentos, e quantos fornecedores,
usinas e equipamentos distintos aparecem — todos respeitando o cruzamento.

### Cada gráfico com a forma da pergunta que responde

| Gráfico | Forma | Por quê |
|---|---|---|
| Acionamentos por mês | **linha do tempo** | é a única dimensão contínua; linha só faz sentido sobre tempo |
| Fornecedores / Equipamentos | **barras horizontais** | comparar magnitude com nomes longos |
| Status | **barras com a cor do status** | a cor aqui tem significado e é a mesma da tabela |
| Usinas | **pontos numa régua** | ranking com muitas categorias de nome comprido |

Não usei linha para as usinas, embora tenha sido sugerido: linha liga pontos e
sugere continuidade entre eles, o que faria parecer que uma usina "vira" a
seguinte. Para ranking, a régua de pontos dá a mesma leveza sem essa leitura
errada.

### Cruzamento entre os gráficos

Clicar numa categoria filtra **todos os outros gráficos** e os números do topo,
como no Power BI. Regras:

- Um clique escolhe, outro na mesma categoria desfaz.
- Dá para combinar dimensões (fornecedor + status + mês, por exemplo).
- Cada gráfico continua mostrando as opções da **sua própria** dimensão, com as
  não escolhidas apagadas — assim dá para trocar a escolha sem limpar tudo.
- Os marcadores no topo mostram o que está filtrado e permitem tirar um a um.
- As contagens são feitas **na tela**, sobre o índice que já foi baixado: o
  cruzamento é instantâneo e não custa ida ao servidor.

### Outras decisões

- Quantidade escrita na ponta de cada barra; balão ao passar o mouse com o nome
  completo, a quantidade e o percentual.
- Cada gráfico tem **Ver todos**, que abre a lista completa em tabela — é por
  onde se vê o que ficou fora dos 10 primeiros. O subtítulo já diz o total
  ("Os 10 primeiros de 144"), então o rodapé com a contagem das restantes foi
  removido em 09/09/2026 por ser repetido.
- **Grafias diferentes do mesmo nome são somadas.** `Huawei` e `HUAWEI` contam
  como um só, e aparece a grafia mais frequente.

## Notificação

- A cada nova solicitação, envia e-mail para **supplychain.eng@solargrid.com.br**.

## Status Geral do Acionamento (lista oficial)

Pendente · Em aprov . Orçamento · Em andamento análise · Em Trânsito ·
Em prog. de retorno · Em confirm. de conclusão · Concluído · Cancelado ·
Ag envio OEM · Em andamento para Envio

## Desempenho

O que custa tempo num aplicativo web do Apps Script é **cada ida e volta ao
servidor** (algo entre meio segundo e um segundo e meio, mesmo para uma resposta
pequena). Não há como encurtar essa ida e volta; o que dá é **fazer menos idas**
e **não deixar a pessoa esperando por elas**. Foi essa a estratégia.

| Ação | Antes | Agora |
|---|---|---|
| Abrir o link | 2 idas em fila | **2 idas ao mesmo tempo** — a espera é a da mais demorada, não a soma |
| Entrar em Processos | 2 idas | **nenhuma** — a lista já foi buscada na abertura e a primeira página vem junto dela |
| Trocar de página | 1 ida | **nenhuma** — a página seguinte é buscada de véspera, em segundo plano |
| Abrir um acionamento | 1 ida | **nenhuma** — o conteúdo da página exibida já está na tela |
| Salvar | 2 idas (gravar + recarregar a lista) | **nenhuma espera** — a tela mostra o valor novo na hora e grava em segundo plano |

Medido em navegador com **800 ms simulados** por ida e volta:

| Ação | Tempo |
|---|---|
| lista pronta ao abrir | 842 ms (era ~1 600 ms, a soma das duas idas) |
| entrar em Processos | 505 ms |
| trocar para a página 2 | 506 ms |
| abrir um acionamento | 92 ms |
| abrir o Painel | 110 ms |

Outros cuidados:
- A lista traz só as colunas de filtro de todas as linhas; o conteúdo completo
  vem apenas da página exibida.
- O resultado fica guardado por **30 minutos** (`CACHE_LISTA_SEG`). A leitura da
  planilha inteira é a parte mais cara de tudo; guardando por esse tempo, ela
  acontece uma vez e os acessos seguintes são instantâneos. Gravar **pelo
  sistema** limpa o guardado na hora, então o que o time faz aparece na mesma
  hora; só alteração feita **direto na planilha** pode levar até 30 minutos para
  aparecer, e o botão **Atualizar** força na hora.
- O índice viaja em **formato de tabela** (uma lista de listas) em vez de uma
  lista de objetos: são os mesmos dados sem repetir o nome de cada campo em
  todas as linhas. Caiu de 560 KB para 413 KB, e a tela remonta os objetos
  instantaneamente.
- Gravação sempre pontual (célula ou linha), nunca reescrita da aba.
- `salvarProcesso` lê a linha inteira uma vez antes e uma vez depois, em vez de
  ler duas vezes por campo alterado.
- Filtros, busca e paginação rodam no navegador.

### Sobre gravar "em segundo plano"

Quando a pessoa salva, a tela já mostra o valor novo e fecha. Se o servidor
recusar (planilha bloqueada, linha que mudou de lugar, data inválida), a tela
**volta ao valor anterior** e mostra o motivo em vermelho. Vale para a edição
individual e para o lote.

### Por que não a API do Sheets direto do navegador

Foi considerado e **descartado**:

- A ida e volta continuaria existindo — o ganho seria pequeno.
- Exigiria um projeto OAuth próprio e **cada pessoa autorizando** o acesso.
- Cada usuário precisaria de permissão de edição **na planilha**, em vez de o
  script gravar em nome de um só dono. Isso é uma perda de controle, não um
  ganho.

O caminho que realmente resolve, se um dia o volume exigir, é trocar a planilha
por um banco de dados. Hoje não é o caso.

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

Uma linha por campo alterado nas edições, e **uma linha só** por solicitação
aberta. A coluna `Ação` recebe:

| Ação | Quando |
|---|---|
| `Solicitação` | abertura pelo formulário |
| `Edição` | alteração de um acionamento |
| `Edição em lote` | alteração aplicada a vários |

`De → Para` mostra os valores como aparecem na planilha, com `(vazio)` quando o
campo estava ou ficou em branco. Na abertura, o campo é
`ABERTURA DA SOLICITAÇÃO` e o para traz o código e a quantidade de anexos.

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

## Onde a linha nova é criada

**Sempre depois da última linha da planilha**, tenha ela conteúdo ou não
(decisão de 08/09/2026). Como a coluna de fórmula `CÓD MXM` está arrastada
centenas de linhas abaixo da última solicitação, a linha nova entra depois de
toda essa região — é o comportamento pedido.

Cuidados que continuam valendo:

1. O módulo Processos considera acionamento **toda linha com qualquer
   conteúdo**, inclusive os processos antigos sem SCGAR preenchido. As colunas
   de fórmula não contam para essa decisão — do contrário a região do `CÓD MXM`
   arrastada para baixo apareceria como centenas de acionamentos vazios.
2. Se a linha nova já tiver fórmula em alguma coluna, a fórmula é devolvida em
   vez de apagada.
3. Espaço na grade é criado apenas quando falta, e **uma linha por vez** —
   antes eram 20 de cada vez, o que parecia criação de várias linhas.

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
- **Todas** as colunas da aba aparecem, **na ordem da planilha**, e as linhas
  também seguem a ordem da planilha (de cima para baixo, sem inverter).
- As colunas são montadas lendo o **cabeçalho da aba**, não a lista `CAMPOS`.
  Qualquer coluna que exista na aba entra na tabela automaticamente, mesmo sem
  estar mapeada no código — importante para a reestruturação que a planilha vai
  passar. As não mapeadas viram texto simples e aparecem no grupo
  **Outras colunas** da tela de tratamento, onde podem ser editadas normalmente,
  inclusive em lote.
- A legenda mostra quantas colunas foram encontradas, para conferência.
- **Largura ajustável por coluna, nas duas visões**: arraste a borda direita do
  cabeçalho. Duplo clique na borda devolve o padrão daquela coluna, e o botão
  **Redefinir colunas** devolve tudo ao padrão.
- **Uma linha por célula, com "…" no fim do que não couber** (decisão de
  08/09/2026). A quebra de texto foi testada e descartada: com 60 colunas,
  basta uma ter texto longo para a linha inteira ficar alta, e a tabela perde a
  aparência de tabela. Para ver o conteúdo cortado: alargar a coluna, passar o
  mouse (balão com o texto inteiro) ou abrir o acionamento.
- A **largura inicial de cada coluna cabe o título inteiro**: o texto do
  cabeçalho é medido com a fonte real da tabela, e a largura de partida é a
  maior entre o que o tipo de informação pede e o que o título precisa (com o
  padding e o espaço da alça). Limitada a 420px, para um título muito comprido
  não criar uma coluna gigante. O ajuste manual segue livre — dá para estreitar
  abaixo disso se você quiser — e **Redefinir colunas** volta a esse padrão.
- Detalhe técnico que fez a diferença: a largura da tabela é definida pela
  **soma exata das colunas**, mais uma coluna de sobra invisível para encostar
  na borda. Com `width: max-content` o navegador esticava as colunas para
  preencher o espaço e a largura escolhida pelo usuário era ignorada.
- O `<col>` da coluna é procurado **no momento do arraste**, nunca guardado: a
  tabela é redesenhada a cada página e visão, e um elemento guardado ficava
  velho.
- O ajuste é **individual**: fica no armazenamento local do navegador de cada
  pessoa, então o que um faz não muda nada para os outros. Se o navegador
  bloquear o armazenamento, o ajuste vale só enquanto a aba estiver aberta.
- Rolagem lateral livre. **Nenhuma coluna de dado fica congelada** — o SCGAR
  rola junto com as outras (decisão de 08/09/2026). Só a caixinha de seleção
  permanece fixa à esquerda, porque é controle de tela e não informação.
- Cabeçalho fixo no topo durante a rolagem vertical, dentro do próprio quadro da
  tabela (era o que causava o descasamento anterior).
- **100 acionamentos por página**, com navegação Anterior / Próxima.
- O índice de todas as linhas é leve e vem de uma vez; o conteúdo completo é
  buscado só das 100 linhas da página exibida e fica guardado na tela.

### Visões da tabela

Um seletor no topo do módulo troca o recorte de colunas. Definidas na lista
`VISOES`, no início do `AppGarantia1.gs`:

### Blocos da tela de tratamento

Definidos em 08/09/2026, valem para a edição individual e para o lote:

| Bloco | Colunas |
|---|---|
| **Identificação** | de `SCGAR` a `NS` (23 colunas) |
| **Supply** | `Vigencia da Garantia`, `Data Emissão Declaração`, `NS FINAL`, `Nota Fiscal Retorno` |
| **Fornecedor** | de `Valor do Frete (Envio)` a `Data Chegada na usina` (19 colunas) |
| **Follow Up** | `FUP - Comentarios`, `FUP - Ações Futuras (TROCA EM AVANÇO)`, `Ação` |
| **Outras colunas** | qualquer coluna da aba que não esteja mapeada no código |

A coluna `Ação` não constava na divisão pedida; foi colocada em **Follow Up**
por ficar ao lado das outras duas na planilha.

Dentro de cada bloco os campos seguem a **ordem das colunas da planilha**, não a
ordem da lista `CAMPOS` — essa continua servindo para a sequência do formulário
de solicitação, que é outra.

| Visão | O que mostra |
|---|---|
| **Completa** | **todas** as colunas da aba, sempre |
| **Reunião** | as 18 colunas listadas abaixo (definido em 09/09/2026) |

O recorte vale **só para a visão Reunião**. A Completa nunca esconde coluna, e a
tela de tratamento (individual e lote) também mostra todas.

Colunas da visão Reunião, nesta ordem:

`Data de Solicitação` · `RMA / OS (Nº)` · `Tipo de Acionamento` ·
`Responsável Atual` · `Status Geral do Acionamento` · `UFV de Origem` ·
`Fornecedor` · `Material/Equipamento` · `Qtd` · `NS` · `Data envio/Coleta` ·
`Codigo Rastreio / Romaneio RFQ (envio)` · `Coberto em Garantia` ·
`Data Saida / Coleta Fornecedor (Real)` ·
`Codigo Rastreio / Romaneio RFQ (retorno)` · `Data Chegada na usina` ·
`FUP - Comentarios` · `FUP - Ações Futuras (TROCA EM AVANÇO)`

As duas colunas de rastreio têm o mesmo título na planilha; na lista `VISOES`
elas são escritas como `Codigo Rastreio / Romaneio RFQ` (a primeira, de envio) e
`Codigo Rastreio / Romaneio RFQ#2` (a segunda, de retorno).

Para criar ou mudar uma visão, basta editar a lista de cabeçalhos em `VISOES`.
Cabeçalho que não existir na aba é ignorado sem erro. A visão escolhida fica
guardada no navegador de cada pessoa.

No módulo Processos, **tudo usa a largura da tela**. Os filtros ficam num
painel único, com as bordas alinhadas às da tabela (decisão de 09/09/2026):

- **topo do painel**: seletor de visão e a contagem de colunas à esquerda; os
  botões *Limpar filtros*, *Atualizar* e *Redefinir colunas* à direita;
- **meio**: os filtros num grid `auto-fit` com faixas de `1fr` — eles esticam e
  preenchem a largura toda, sejam 4 ou 9, e quebram sozinhos para uma segunda
  linha em telas estreitas;
- **pé**: a busca livre ocupando a largura inteira.

Os outros módulos seguem na medida de leitura de 1360px.

**Edição direto na célula** funciona nas visões recortadas (não na Completa,
onde as 51 colunas fariam o clique atrapalhar a leitura):

- clique na célula → ela vira campo, com o mesmo tipo da edição normal
  (calendário para data, R$ para valor, lista suspensa para status);
- **Enter** grava, **Esc** cancela, **Tab** grava e pula para a próxima célula
  editável da linha — que é o ritmo de uma reunião;
- a primeira coluna não é editável de propósito: clicar nela abre o acionamento
  completo, com todos os campos;
- a gravação é a mesma da edição individual, então passa pelas mesmas regras e
  entra na aba Auditoria como `Edição`;
- as listas suspensas abertas dentro da tabela **flutuam por cima da tela**
  (posição fixa, ancorada no campo, virando para cima quando não cabe embaixo).
  Sem isso ficavam cortadas pela borda do quadro que rola, e as opções não
  apareciam.

Colunas de valor recebem formato de moeda (`R$ #,##0.00`) na planilha ao serem
gravadas, para o valor aparecer igual na planilha e na tela.

### Filtros
Uma caixinha de seleção múltipla para **Status** (dá para marcar vários), mais
filtros para: SCGAR, Data de Solicitação (de / até), RMA / OS (Nº),
Tipo de Acionamento, Responsável Atual, UFV de Origem e Fornecedor.

- Campos com opções conhecidas viram caixinha de seleção múltipla com busca.
- **Os filtros funcionam em cascata**: cada caixinha só oferece o que ainda
  existe depois dos outros filtros. Filtrando o fornecedor X, o filtro de Status
  passa a mostrar apenas os status presentes nos acionamentos daquele
  fornecedor. Um filtro nunca restringe a si mesmo, e valores já marcados
  continuam visíveis para poderem ser desmarcados. O rótulo da caixinha mostra
  quantas opções restam.
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

## Painel — cartões do mesmo tamanho
Os cartões de gráfico da mesma faixa passaram a ter altura idêntica
(`align-items:stretch` na grade + o corpo do gráfico ocupando a sobra).
As linhas dos gráficos de barra e de pontos também ficaram com a mesma
altura (30 px), para "Acionamentos por status" e "Acionamentos por usina"
ficarem alinhados lado a lado, mesmo com quantidades diferentes de itens.

## Painel — escolher mais de uma categoria (Ctrl+clique)
Clique simples troca a escolha (e clicar de novo na mesma limpa).
**Ctrl+clique** (ou Cmd, ou Shift) **soma** a categoria às que já estavam
escolhidas, em qualquer gráfico e em qualquer combinação de gráficos.
Cada escolha vira um marcador branco em "Filtrando por" — no mesmo estilo dos
cartões da página, com qualquer quantidade de marcadores — e dá para tirar um a um.
Por dentro, `SELECAO` passou a guardar uma lista de valores por dimensão.
Todo gráfico novo ganha isso de graça: basta ligar o clique dos itens com
`ligarEscolha(elemento, dimensao, nome)`.

## Painel — filtro de período
Uma barra no topo do painel recorta tudo (números e os cinco gráficos) pela
coluna **Data de Solicitação**, de duas formas ligadas entre si:
1. dois campos de data — inicial e final;
2. uma régua com duas pontas para arrastar.
Mexer em um atualiza o outro. Os extremos da régua são a data mais antiga e
a mais nova que existem na planilha, e datas fora disso são trazidas para
dentro. "Limpar filtro" volta ao período todo. Enquanto a régua é
arrastada, os gráficos são recalculados a cada 130 ms, para não travar.
Observação: com período ativo, linhas sem data de solicitação ficam de fora.
A barra é um cartão branco, igual aos outros da página (o fundo escuro que
tinha antes destoava do layout).
