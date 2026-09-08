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

Formato `SCGAR-0001`. Gerado a partir do maior número já existente na coluna
`SCGAR` + 1, dentro de uma trava para dois usuários não pegarem o mesmo número.

O último código real da planilha é **SCGAR-5211**, então `CONFIG.SCGAR_MINIMO`
está em `5211`: nenhum código novo sai abaixo disso, mesmo que a cópia da
planilha não tenha o histórico completo. O próximo será `SCGAR-5212`.

Configurável em `CONFIG.SCGAR_PREFIXO`, `CONFIG.SCGAR_DIGITOS` e
`CONFIG.SCGAR_MINIMO`.

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

## Pendências em aberto

- Instalar na cópia da planilha e validar com dados reais.
- Definir os indicadores do módulo Painel.
- Renomear o par `Codigo Rastreio / Romaneio RFQ` (opcional).
