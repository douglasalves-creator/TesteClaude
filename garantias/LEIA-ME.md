# Acionamento de Garantias — SolarGrid

Sistema de abertura e tratamento dos acionamentos de garantia, com a planilha
`Controle Acionamento` como base de dados.

## Arquivos

| Arquivo | O que é |
|---|---|
| `AppGarantia1.gs` | O motor. Lê e grava na planilha, gera o SCGAR, envia o aviso por e-mail. |
| `AppGarantia2.html` | A tela do sistema (os três módulos). |
| `SemAcesso.html` | Tela mostrada para quem não é do domínio SolarGrid. |
| `DECISOES.md` | Registro das regras combinadas do projeto. |

## Como instalar (10 minutos, uma única vez)

1. Abra a **cópia** da planilha de garantias.
2. Menu **Extensões → Apps Script**. Abre o editor de código.
3. Apague o conteúdo do arquivo `Código.gs` que vem em branco e cole o conteúdo
   de `AppGarantia1.gs` deste repositório.
4. No editor, clique no **+** ao lado de "Arquivos" → **HTML**. Nomeie **`AppGarantia2`**
   (sem `.html`) e cole o conteúdo de `AppGarantia2.html`.
5. Repita para um HTML chamado **`SemAcesso`**, colando `SemAcesso.html`.
6. Clique no disquete para salvar tudo.
7. Botão azul **Implantar → Nova implantação**.
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa da SolarGrid** (ou "Qualquer pessoa com
     a conta do Google", que o próprio sistema já filtra pelo domínio)
8. Autorize quando o Google pedir (é a primeira vez).
9. Copie o **link do app da Web**. Esse é o link que vai para o time.

Depois de qualquer alteração no código: **Implantar → Gerenciar implantações →
lápis → Versão: Nova versão → Implantar**. O link continua o mesmo.

## Para trocar da cópia para a planilha original

No `AppGarantia1.gs`, no bloco `CONFIG` do início, preencha:

```js
SPREADSHEET_ID: 'cole-aqui-o-id-da-planilha-original',
```

O ID é o trecho entre `/d/` e `/edit` no endereço da planilha. Salve e publique
uma nova versão. Nada mais precisa mudar.

> Se o script estiver instalado dentro da própria planilha original, deixe
> `SPREADSHEET_ID: ''` — ele usa a planilha onde está.

## Regra que o sistema segue

**Tudo é localizado pelo nome do cabeçalho, nunca pela posição da coluna.**
A linha 6 é lida a cada uso, e a comparação ignora maiúsculas, acentos e espaços
repetidos. Consequências práticas:

- Colunas podem ser movidas, inseridas ou apagadas sem quebrar o sistema.
- Se uma coluna que o sistema usa deixar de existir, o campo simplesmente não
  aparece na tela e um aviso amarelo lista o que faltou. Nunca se grava no lugar
  errado.
- Na gravação, só as células realmente alteradas são escritas — nunca a aba
  inteira.
- Antes de gravar, o sistema confere se o SCGAR daquela linha continua o mesmo.
  Se alguém apagou ou inseriu linhas no meio, ele recusa e pede para atualizar.

## Ajustes que você mesmo pode fazer

Tudo no bloco `CONFIG`, nas primeiras linhas do `AppGarantia1.gs`:

| Item | O que faz |
|---|---|
| `SHEET_NAME` | Nome da aba usada. |
| `HEADER_ROW` | Linha dos títulos (hoje 6). |
| `DOMINIO_PERMITIDO` | Domínio de e-mail liberado. |
| `EMAIL_NOVA_SOLICITACAO` | Quem recebe o aviso de abertura. `''` desliga. |
| `SCGAR_PREFIXO` / `SCGAR_DIGITOS` | Formato do código (hoje `SCGAR-0001`). |
| `LOGO_URL` | Endereço de uma imagem do logo. Vazio usa o nome escrito. |
| `STATUS_GERAL` | A lista de status do acionamento. |

Para mudar quais campos aparecem em cada tela, edite a lista `CAMPOS`:
`sol: true` coloca o campo no formulário de Nova Solicitação, `lista: true`
coloca como coluna na tabela de Processos, e `grupo` define em que bloco ele
aparece na tela de tratamento.

## Velocidade

- A lista de processos fica guardada em memória por 3 minutos (`CACHE_LISTA_SEG`),
  então trocar de módulo e filtrar é instantâneo.
- Busca e filtros por status rodam no navegador, sem ir à planilha.
- Abrir um acionamento lê **uma única linha**.
- Salvar grava **apenas as células alteradas** e limpa o cache.

## Ponto de atenção sobre a planilha

A aba tem duas colunas chamadas `Codigo Rastreio / Romaneio RFQ` (uma delas com
espaço duplo). Como os dois títulos são iguais, o sistema as diferencia pela
ordem de aparição: a primeira é tratada como **envio** e a segunda como
**retorno**. É o único lugar onde a ordem importa. Renomear para
`... (Envio)` e `... (Retorno)` resolve de forma definitiva — quando isso for
feito, basta ajustar os dois `cab` correspondentes na lista `CAMPOS` e remover
os `ocor`.

## Convivência com outros códigos no mesmo projeto

Todo o sistema fica dentro de uma única "caixa" chamada `GAR_GARANTIAS`, então
ele **não conflita** com outros scripts que já existam no mesmo projeto do Apps
Script. Fora da caixa existem apenas estas funções, todas com prefixo próprio:

`gar_carregarInicio` · `gar_listarProcessos` · `gar_obterProcesso` ·
`gar_salvarProcesso` · `gar_criarSolicitacao`

A única exceção é o `doGet`, que o Google exige com esse nome exato para abrir o
link do app da Web. **Se o projeto já tiver outra função `doGet`**, as duas
precisam ser unificadas — nesse caso, avise para fazermos o ajuste.

## Módulo RNC
Arquivo novo: **AppRnc1** (tipo *Script*). Cole o conteúdo de `AppRnc1.gs`.
Lê a planilha `10XC9wnG3g9oaZVcja77ogyVVnLtKUBTLLoGQZgSQ1tE`, aba
`Lista EP ( Para conciliação)`, cabeçalho na **linha 9**. Na primeira
execução o Google pede autorização de novo, porque é outra planilha.
