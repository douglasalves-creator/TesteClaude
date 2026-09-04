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

## Módulo Solicitação — campos preenchidos pelo solicitante

| Campo | Observação |
|---|---|
| SCGAR | **Gerado automaticamente**, o usuário não digita |
| Data de Solicitação | preenchida automaticamente com a data do envio |
| RMA / OS (Nº) | |
| Tipo de Acionamento | |
| UFV de Origem | |
| Fornecedor | |
| Material/Equipamento | |
| Qtd | |
| Motivo Inicial | |
| Equipamento Principal | |
| MAC | |
| NS | |

Ao salvar, `Status Geral do Acionamento` entra como **Pendente**.

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

## Pendências em aberto

- **Cabeçalhos duplicados** na aba atual impedem identificação por nome. Precisam ser
  renomeados na cópia antes de o módulo Processos gravar nesses campos:
  - `Aprov Marcella` (3x)
  - `Aprov Felipe` (3x)
  - `Valor do Frete / Envio Estimado` (2x)
- Formato definitivo do código SCGAR.
- Quais campos exatamente o time preenche no módulo Processos (e em qual ordem/etapa).
