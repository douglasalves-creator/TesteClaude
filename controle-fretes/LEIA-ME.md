# Controle de Fretes — como instalar

Sistema com três módulos em um único HTML, lendo e gravando na aba real
**"Controle de Frete 2024_2025_2026"** da planilha de controle:

| Módulo | O que faz |
|---|---|
| **Formulário** | Abre uma nova solicitação: cria uma linha nova na aba, com RFQ gerada automaticamente (maior RFQ + 1), data de solicitação, ano e status **Solicitado**. |
| **Processos** | Lista todas as RFQs com filtros (status, setor, motivo, ano, em aberto, atrasadas, sem transportadora), busca livre e ordenação. Ao abrir uma RFQ, dá para atualizar cotação, veículo, datas de coleta/entrega, motorista, placa, CTE, centro de custo, status de pagamento e status da SC. |
| **Painel** | Indicadores: carteira por status, motivo, setor, modalidade, solicitações por mês, rotas mais usadas, gasto por transportadora, gasto no ano/mês, ticket médio, ciclo médio (solicitação → entrega), % no prazo, atrasos e RFQs paradas. |

Este projeto é **independente do Painel de Aprovação**: todos os nomes usam o
prefixo `cf`/`CF_`, então os dois podem conviver sem conflito.

## O que ele NÃO faz na planilha

- Não cria, renomeia nem reordena colunas da aba de controle.
- Não mexe em linhas existentes que você não abrir no módulo Processos.
- Ao criar uma solicitação, grava **só nas células das colunas mapeadas** —
  colunas com fórmula arrastada continuam intactas.
- A única aba que ele cria é **"Histórico do Controle"** (quem mudou o quê e
  quando). Para desligar, deixe `SHEET_HIST: ''` na configuração.

## 1. Instalar

O jeito mais simples, por ser um projeto separado:

1. Abra <https://script.google.com> → **Novo projeto**.
2. Cole o conteúdo de `Codigo.gs` no arquivo `Código.gs`.
3. `+` ao lado de "Arquivos" → **HTML** → nomeie exatamente `ControleFretes`
   (sem acento) → cole o conteúdo de `ControleFretes.html`.
4. Salve. O ID da planilha já está preenchido em
   `CF_CONFIG.SPREADSHEET_ID` (a planilha de Controle de Frete).
5. No menu de funções, escolha `cfDiagnosticar` e clique em **Executar** ▷.
   Na primeira vez o Google pede autorização — aceite.
6. Veja o resultado: ele mostra a aba encontrada, a linha do cabeçalho,
   quantas RFQs foram lidas e se alguma coluna não foi encontrada.

Para abrir o sistema:

- **Como link (recomendado neste formato):** **Implantar → Nova implantação →
  App da Web** → *Executar como: eu* / *Quem pode acessar: qualquer pessoa da
  organização* → copie o link.
- **Como menu dentro da planilha:** cole os dois arquivos no projeto do Apps
  Script vinculado à planilha (Extensões → Apps Script). Se esse projeto já
  tiver um `onOpen` (é o caso do Painel de Aprovação), **apague o `onOpen`
  deste arquivo** e chame `cfMenu()` de dentro do `onOpen` que já existe.
  Recarregue a planilha: aparece o menu **Controle de Fretes → Abrir sistema**.

## 2. Colunas usadas

O script procura as colunas pelo nome do cabeçalho, ignorando acento, espaço
e maiúscula, e encontra sozinho a linha do cabeçalho (na sua planilha é a 2ª,
porque a 1ª é o agrupamento visual). São elas:

```
RFQ, Rota, Data de Solicitação, Ano, Status da SC, Setor Solicitante,
Motivo do Frete, Modalidade, Tipo de Frete, RFQ Agrupadas, Empresa, Material,
Qtde solicitada, Especificação/Serie, Dimensões Unitaria, M3 Total,
Peso Total ( KG), NCM, Tipo de Volume, Qtde de volume, Valor Unitário,
Valor da NF., NF/ TIQUETE / RMA, Origem, CNPJ de Origem, Endereço da Origem,
Link Coordenadas Origem, Destino, CNPJ de Destino, Endereço de Destino,
Link Coordenadas Destino, Total KM a percorrer, Transportadora Aprovada,
Valor (All In), Aprovação da Cotação, Aprovador, Justificativa de frete,
Data de Coleta, Previsão de Entrega, Data da entrega, Nome Motorista, Placa,
Veiculo, CTE, Centro de Custo, Status de pagamento, Trajeto
```

Se alguma faltar, o sistema avisa em uma faixa amarela no topo e continua
funcionando — só não grava aquele dado. Se você renomear uma coluna na
planilha, ajuste o texto correspondente no bloco `CF_CAMPOS` do `Codigo.gs`.

## 3. Ajustes que você faz sem programar

Tudo no topo do `Codigo.gs`, em `CF_CONFIG`:

- **`SHEET_NAME`** — nome da aba de controle.
- **`STATUS`** — a lista de status que aparece nos filtros e no módulo
  Processos. Status que já existem na planilha e não estão nesta lista são
  acrescentados automaticamente, então nada some.
- **`STATUS_FINAIS`** — o que conta como encerrado (`Concluído`, `Cancelado`).
- **`SETORES`, `MOTIVOS`, `MODALIDADES`, `TIPOS_FRETE`, `TIPOS_VOLUME`,
  `VEICULOS`, `STATUS_PAGAMENTO`** — as listas dos campos de seleção. Valores
  já usados na planilha entram sozinhos nas listas.
- **`EMAIL_AVISO`** — e-mail avisado a cada nova solicitação (`''` desativa).
- **`DIAS_PARADO`** — a partir de quantos dias sem transportadora uma RFQ em
  aberto aparece em "Parados" no painel.
- **`EMPRESA_NOME`** — nome exibido no cabeçalho.

## 4. Regras de preenchimento que o sistema aplica

- Formulário só envia com: setor, motivo, modalidade, material, qtde
  solicitada, origem e destino.
- A RFQ nova recebe `Trajeto` no mesmo padrão das linhas antigas:
  `RFQ 123 - ORIGEM x DESTINO`.
- Em Processos, marcar uma RFQ como **Concluído** exige a Data da entrega.
- Cada campo alterado vira uma linha na aba "Histórico do Controle", com
  usuário, valor anterior, valor novo e o comentário que você escrever.

Qualquer coisa que faltar (coluna nova no painel, outro indicador, mudar
cores ou textos), é só pedir.
