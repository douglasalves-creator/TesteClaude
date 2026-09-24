// =============================================================================
// CONFIGURAÇÕES GLOBAIS
// =============================================================================
const ASANA_TOKEN = PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN'); // Configure em: Configurações do projeto > Propriedades do script
const PROJECT_ID = '1214318804639859';
const SHEET_NAME_SC = 'SC'; // Alterado para evitar conflitos
const DATA_LIMIT_ASANA = new Date('2026-05-25T00:00:00Z');

const COLUNAS_ASANA = [
  "SC", "Data de Solicitação", "Tipo da Compra", "UFV (Supply)", 
  "Criticidade da Necessidade", "Material / Equipamento", "Quantidade", 
  "Prioridade da Compra", "Setores da SolarGrid", "Data de Necessidade Obra (Prévia)", 
  "Data Baseline PMO", "Nome do Fornecedor", "PC de Compra MXM", "Data Entrega Prev. (CIF)"
];

// =============================================================================
// FUNÇÕES DE APOIO (TRATAMENTO DE DADOS)
// =============================================================================
function tratarValor(valor, nomeCampo) {
  if (valor === null || valor === undefined || valor === "") return "";
  let stringValor = valor.toString();

  // O bloco que tratava a "UFV (Supply)" com .split(" - ") foi removido daqui.

  if (stringValor.match(/^\d{4}-\d{2}-\d{2}/)) {
    const dataAjustada = new Date(stringValor.split('T')[0] + 'T12:00:00');
    return Utilities.formatDate(dataAjustada, "GMT-3", "dd/MM/yyyy");
  }

  if (!isNaN(stringValor) && stringValor.includes('.')) {
    let numero = parseFloat(stringValor);
    if (numero % 1 === 0) return numero.toString();
  }
  return stringValor;
}

// =============================================================================
// 1. IMPORTAÇÃO DO ASANA + NOVAS FÓRMULAS
// =============================================================================
function importarDoAsana() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_SC);
  if (!sheet) return SpreadsheetApp.getUi().alert("Erro: Aba SC não encontrada.");

  const url = `https://app.asana.com/api/1.0/projects/${PROJECT_ID}/tasks?opt_fields=name,created_at,custom_fields.name,custom_fields.display_value`;
  const options = {'method': 'get', 'headers': {'Authorization': `Bearer ${ASANA_TOKEN}`}, 'muteHttpExceptions': true};
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  
  if (!json.data) return SpreadsheetApp.getUi().alert("Erro na API do Asana.");

  if (sheet.getLastRow() === 0) {
    const cabecalho = ['Task ID'].concat(COLUNAS_ASANA);
    sheet.appendRow(cabecalho);
  }

  const dadosAtuais = sheet.getDataRange().getValues();
  const cabecalhoAtual = dadosAtuais[0].map(c => c.toString().trim());
  const idsExistentes = dadosAtuais.map(row => row[0].toString());
  let novasTarefas = 0;

  json.data.forEach(task => {
    const dataCriacao = new Date(task.created_at);
    const gidStr = "'" + task.gid.toString(); 
    
    if (idsExistentes.indexOf(task.gid.toString()) === -1 && dataCriacao >= DATA_LIMIT_ASANA) {
      let camposTask = {};
      if (task.custom_fields) {
        task.custom_fields.forEach(f => { Logger.log(JSON.stringify(f));
          Logger.log(JSON.stringify(f));
camposTask[f.name] = tratarValor(f.display_value, f.name);
        });
      }
      let linha = [gidStr]; 
      COLUNAS_ASANA.forEach(colunaNome => {
        linha.push(camposTask[colunaNome] || "");
      });
      sheet.appendRow(linha);
      novasTarefas++;
    }
  });

  // Insere as fórmulas ARRAYFORMULA solicitadas
  if (sheet.getLastRow() > 1) {
    const inserirFormulaSC = (nomeCol, formula) => {
      let idx = cabecalhoAtual.indexOf(nomeCol) + 1;
      if (idx > 0) sheet.getRange(2, idx).setFormula(formula);
    };

    inserirFormulaSC("Nome do Fornecedor", "=ARRAYFORMULA(IF(B2:B=\"\";\"\";XLOOKUP(B2:B;'Compras + Logística'!A:A;'Compras + Logística'!Z:Z;\"\")))");
    inserirFormulaSC("PC de Compra MXM", "=ARRAYFORMULA(IF(B2:B=\"\";\"\";XLOOKUP(B2:B;'Compras + Logística'!A:A;'Compras + Logística'!AH:AH;\"\")))");
    inserirFormulaSC("Data Entrega Prev. (CIF)", "=ARRAYFORMULA(IF(B2:B=\"\";\"\";XLOOKUP(B2:B;'Compras + Logística'!A:A;'Compras + Logística'!AM:AM;\"\")))");
  }

  SpreadsheetApp.getUi().alert(novasTarefas > 0 ? `${novasTarefas} importadas e fórmulas aplicadas!` : "Fórmulas atualizadas. Nenhuma tarefa nova.");
}

// =============================================================================
// 2. TRANSFERÊNCIA SC -> COMPRAS + LOGÍSTICA (REGRAS DE FÓRMULAS) - OTIMIZADO
// =============================================================================
function atualizarComprasLogistica() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaOrigem = ss.getSheetByName("SC");
  const abaDestino = ss.getSheetByName("Compras + Logística");

  if (!abaOrigem || !abaDestino) {
    SpreadsheetApp.getUi().alert("Erro nas abas.");
    return;
  }

  const mapaColunas = {
    "SC": "SC",
    "Data de solicitação": "SOLICITAÇÃO DE COMPRA",
    "Tipo da Compra": "TIPO DA COMPRA",
    "UFV (Supply)": "UFV",
    "Criticidade da Necessidade": "CRITICIDADE DA COMPRA",
    "Material / Equipamento": "DESCRIÇÃO COMPLETA",
    "Quantidade": "QUANTIDADE SOLICITADA",
    "Setores da SolarGrid": "SETOR RESPONSÁVEL",
    "Data de Necessidade Obra (Prévia)": "NECESSIDADE PRELIMINAR",
    "Data Baseline PMO": "BASELINE"
  };

  const colunasComFormula = [
    "MOBILIZAÇÃO",
    "STATUS - SOLICITAÇÃO DE COMPRA",
    "CENTRO DE CUSTO",
    "FAMÍLIA DE MATERIAIS",
    "LEAD TIME PADRÃO",
    "NECESSIDADE DO MATERIAL EM OBRA",
    "CÓD. MXM",
    "MEDIDA",
    "COMPRADOR",
    "ÚLTIMO VALOR PRATICADO",
    "VALOR TOTAL (BRL)",
    "ADERENCIA PEDIDO COMPRA",
    "ADERENCIA ENTREGA CRONOGRAMA",
    "DESVIO CRONOGRAMA X DATA CIF",
    "SLA PMO P/ SUPPLY",
    "ACOMPANHAMENTO - FOLLOW UP",
    "ADERENCIA DA ENTREGA",
    "STATUS GERAL DE PAGAMENTO (100%)"
  ];

  // Quantidade de linhas processadas por vez.
  // Isso evita o erro de "dados solicitados excedem o tamanho máximo permitido".
  const TAMANHO_BLOCO = 1000;

  // ------------------------------------------------------------------
  // 1. CABEÇALHOS
  // ------------------------------------------------------------------

  const maxColOrigem = abaOrigem.getLastColumn();
  const maxColDestino = abaDestino.getLastColumn();

  if (maxColOrigem === 0 || maxColDestino === 0) {
    SpreadsheetApp.getUi().alert("Aba(s) sem colunas.");
    return;
  }

  const cabecalhoOrigem = abaOrigem
    .getRange(1, 1, 1, maxColOrigem)
    .getValues()[0]
    .map(c => c.toString().trim());

  const cabecalhoDestino = abaDestino
    .getRange(1, 1, 1, maxColDestino)
    .getValues()[0]
    .map(c => c.toString().trim());

  const idxScOrigem = cabecalhoOrigem.indexOf("SC");
  const idxScDestino = cabecalhoDestino.indexOf("SC");
  const idxStatusPedido = cabecalhoDestino.indexOf("STATUS - PEDIDO DE COMPRA");

  if (idxScOrigem === -1 || idxScDestino === -1) {
    SpreadsheetApp.getUi().alert("Coluna 'SC' não encontrada em uma das abas.");
    return;
  }

  // ------------------------------------------------------------------
  // 2. FUNÇÃO PARA ENCONTRAR A ÚLTIMA LINHA REAL DE UMA COLUNA
  //    Processa em blocos para não estourar o limite.
  // ------------------------------------------------------------------

  function encontrarUltimaLinhaReal(sheet, coluna, ultimaLinhaPlanilha) {
    if (ultimaLinhaPlanilha <= 1) return 1;

    for (
      let inicio = ultimaLinhaPlanilha;
      inicio >= 2;
      inicio -= TAMANHO_BLOCO
    ) {
      const fim = Math.max(2, inicio - TAMANHO_BLOCO + 1);
      const quantidade = inicio - fim + 1;

      const valores = sheet
        .getRange(fim, coluna, quantidade, 1)
        .getValues();

      for (let i = valores.length - 1; i >= 0; i--) {
        if (valores[i][0].toString().trim() !== "") {
          return fim + i;
        }
      }
    }

    return 1;
  }

  // ------------------------------------------------------------------
  // 2.1 ÚLTIMA LINHA OCUPADA DO DESTINO (INDEPENDENTE DA COLUNA SC)
  //     Considera qualquer célula com valor digitado em qualquer coluna.
  //     Células com fórmula (e colunas com ARRAYFORMULA) são ignoradas,
  //     para que fórmulas arrastadas não sejam tratadas como dados.
  // ------------------------------------------------------------------

  function encontrarUltimaLinhaOcupada(sheet, numColunas, ultimaLinhaPlanilha, colunasIgnoradas) {
    if (ultimaLinhaPlanilha <= 1) return 1;

    for (
      let inicio = ultimaLinhaPlanilha;
      inicio >= 2;
      inicio -= TAMANHO_BLOCO
    ) {
      const fim = Math.max(2, inicio - TAMANHO_BLOCO + 1);
      const quantidade = inicio - fim + 1;

      const intervalo = sheet.getRange(fim, 1, quantidade, numColunas);
      const valores = intervalo.getValues();
      const formulas = intervalo.getFormulas();

      for (let i = valores.length - 1; i >= 0; i--) {
        for (let c = 0; c < numColunas; c++) {
          if (colunasIgnoradas.has(c)) continue;
          if (formulas[i][c] !== "") continue;
          if (valores[i][c].toString().trim() !== "") {
            return fim + i;
          }
        }
      }
    }

    return 1;
  }

  // ------------------------------------------------------------------
  // 3. DESCOBRIR ÚLTIMAS LINHAS REAIS
  // ------------------------------------------------------------------

  const ultLinhaOrigemPlanilha = abaOrigem.getLastRow();
  const ultLinhaDestinoPlanilha = abaDestino.getLastRow();

  const realUltimaLinhaOrigem = encontrarUltimaLinhaReal(
    abaOrigem,
    idxScOrigem + 1,
    ultLinhaOrigemPlanilha
  );

  // Colunas ignoradas na busca da última linha ocupada:
  // colunas com fórmula padrão + colunas com ARRAYFORMULA na linha 2.
  const colunasIgnoradasDestino = new Set();

  colunasComFormula.forEach(nomeCol => {
    const idx = cabecalhoDestino.indexOf(nomeCol);
    if (idx > -1) colunasIgnoradasDestino.add(idx);
  });

  if (ultLinhaDestinoPlanilha >= 2) {
    abaDestino
      .getRange(2, 1, 1, maxColDestino)
      .getFormulas()[0]
      .forEach((f, idx) => {
        if (f.toUpperCase().indexOf("ARRAYFORMULA") > -1) {
          colunasIgnoradasDestino.add(idx);
        }
      });
  }

  // A próxima linha livre é calculada pela última linha com QUALQUER dado,
  // e não apenas pela última linha com SC preenchida.
  const realUltimaLinhaDestino = encontrarUltimaLinhaOcupada(
    abaDestino,
    maxColDestino,
    ultLinhaDestinoPlanilha,
    colunasIgnoradasDestino
  );

  if (realUltimaLinhaOrigem < 2) {
    SpreadsheetApp.getUi().alert(
      "Nenhum dado encontrado na coluna SC da aba origem."
    );
    return;
  }

  // ------------------------------------------------------------------
  // 4. MAPEAR COLUNAS
  // ------------------------------------------------------------------

  let maxIdxColunaNecessaria = 0;
  const mapeamentoIndices = [];

  for (const campoOrigem in mapaColunas) {
    const origemIdx = cabecalhoOrigem.indexOf(campoOrigem);
    const destinoIdx = cabecalhoDestino.indexOf(mapaColunas[campoOrigem]);

    if (origemIdx > -1 && destinoIdx > -1) {
      mapeamentoIndices.push({
        origem: origemIdx,
        destino: destinoIdx
      });

      if (origemIdx > maxIdxColunaNecessaria) {
        maxIdxColunaNecessaria = origemIdx;
      }
    }
  }

  const numColunasDestino = cabecalhoDestino.length;

  // ------------------------------------------------------------------
  // 5. CARREGAR SCs JÁ EXISTENTES NO DESTINO
  //    Também em blocos.
  // ------------------------------------------------------------------

  const idsExistentes = new Set();

  if (realUltimaLinhaDestino > 1) {
    for (
      let inicio = 2;
      inicio <= realUltimaLinhaDestino;
      inicio += TAMANHO_BLOCO
    ) {
      const quantidade = Math.min(
        TAMANHO_BLOCO,
        realUltimaLinhaDestino - inicio + 1
      );

      const valores = abaDestino
        .getRange(inicio, idxScDestino + 1, quantidade, 1)
        .getValues();

      valores.forEach(linha => {
        const valor = linha[0].toString().trim();

        if (valor !== "") {
          idsExistentes.add(valor);
        }
      });
    }
  }

  // ------------------------------------------------------------------
  // 6. PREPARAR ÍNDICES DAS COLUNAS COM FÓRMULA
  // ------------------------------------------------------------------

  const indicesColunasFormula = [];

  colunasComFormula.forEach(nomeCol => {
    const idx = cabecalhoDestino.indexOf(nomeCol);

    if (idx > -1) {
      indicesColunasFormula.push(idx);
    }
  });

  // ------------------------------------------------------------------
  // 7. PROCESSAR A ORIGEM EM BLOCOS
  // ------------------------------------------------------------------

  let proximaLinhaDestino = realUltimaLinhaDestino + 1;
  let totalNovas = 0;

  for (
    let inicio = 2;
    inicio <= realUltimaLinhaOrigem;
    inicio += TAMANHO_BLOCO
  ) {
    const quantidade = Math.min(
      TAMANHO_BLOCO,
      realUltimaLinhaOrigem - inicio + 1
    );

    const dadosOrigem = abaOrigem
      .getRange(
        inicio,
        1,
        quantidade,
        maxIdxColunaNecessaria + 1
      )
      .getValues();

    const novasLinhasData = [];

    dadosOrigem.forEach(linhaOrigem => {
      const valorSc = linhaOrigem[idxScOrigem]
        ? linhaOrigem[idxScOrigem].toString().trim()
        : "";

      if (valorSc !== "" && !idsExistentes.has(valorSc)) {

        const novaLinha = new Array(numColunasDestino).fill("");

        mapeamentoIndices.forEach(mapa => {
          novaLinha[mapa.destino] = linhaOrigem[mapa.origem];
        });

        // Status inicial
        if (idxStatusPedido > -1) {
          novaLinha[idxStatusPedido] = "NÃO INICIADO";
        }

        novasLinhasData.push(novaLinha);

        // Marca imediatamente como existente para evitar duplicação
        // dentro da própria execução.
        idsExistentes.add(valorSc);
      }
    });

    // ----------------------------------------------------------------
    // 8. GRAVAR O BLOCO
    // ----------------------------------------------------------------

    if (novasLinhasData.length > 0) {

      const qtdBloco = novasLinhasData.length;

      // Garante que existam linhas físicas suficientes na aba,
      // criando novas linhas abaixo da última quando necessário.
      const ultimaLinhaNecessaria = proximaLinhaDestino + qtdBloco - 1;
      const maxLinhasAba = abaDestino.getMaxRows();

      if (ultimaLinhaNecessaria > maxLinhasAba) {
        abaDestino.insertRowsAfter(
          maxLinhasAba,
          ultimaLinhaNecessaria - maxLinhasAba
        );
      }

      abaDestino
        .getRange(
          proximaLinhaDestino,
          1,
          qtdBloco,
          numColunasDestino
        )
        .setValues(novasLinhasData);

      // --------------------------------------------------------------
      // 9. COPIAR FÓRMULAS PARA O BLOCO
      // --------------------------------------------------------------

      if (realUltimaLinhaDestino > 1) {

        indicesColunasFormula.forEach(colIdx => {

          const linhaFormula = abaDestino.getRange(
            realUltimaLinhaDestino,
            colIdx + 1
          );

          const intervaloDestino = abaDestino.getRange(
            proximaLinhaDestino,
            colIdx + 1,
            qtdBloco,
            1
          );

          linhaFormula.copyTo(
            intervaloDestino,
            SpreadsheetApp.CopyPasteType.PASTE_FORMULA
          );
        });
      }

      proximaLinhaDestino += qtdBloco;
      totalNovas += qtdBloco;
    }
  }

  // ------------------------------------------------------------------
  // 10. RESULTADO
  // ------------------------------------------------------------------

  if (totalNovas > 0) {
    SpreadsheetApp.getUi().alert(
      `${totalNovas} linhas processadas com sucesso!`
    );
  } else {
    SpreadsheetApp.getUi().alert("Nada novo.");
  }
}
// =============================================================================
// 3. ORGANIZAÇÃO BACKOFFICE (FINANCEIRO) - REFRESH TOTAL
// =============================================================================
function organizarParcelasBackoffice_PreservarFormato() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaOrigem = ss.getSheetByName("Compras + Logística");
  const abaDestino = ss.getSheetByName("Backoffice");

  if (!abaOrigem || !abaDestino) return;

  // ============================================================
  // CONFIGURAÇÕES
  // ============================================================

  const DATA_LIMITE_FIN = new Date("2026-01-01T00:00:00").getTime();
  const TAMANHO_BLOCO = 1000;

  // Coluna de filtro na ORIGEM e os status que NÃO devem ser levados
  const COL_STATUS_PGTO = "STATUS GERAL DE PAGAMENTO (100%)";
  const STATUS_BLOQUEADOS = ["PAGO", "N/A"];

  // Mapa: COLUNA NO BACKOFFICE -> COLUNA NA COMPRAS + LOGÍSTICA
  const colunasFixas = {
    "UFV": "UFV",
    "FORNECEDOR": "FORNECEDOR",
    "COMPRADOR": "COMPRADOR",
    "N. PEDIDO DE COMPRA": "N. PEDIDO DE COMPRA",
    "TIPO DE PAGAMENTO": "TIPO DE PAGAMENTO",
    "STATUS - PEDIDO DE COMPRA": "STATUS - PEDIDO DE COMPRA",
    "CENTRO DE CUSTO": "CENTRO DE CUSTO"
  };

  // A coluna STATUS do Backoffice recebe o STATUS GERAL DE PAGAMENTO (100%) da origem
  colunasFixas["STATUS"] = COL_STATUS_PGTO;

  // Normaliza texto para comparação (maiúsculas, sem espaços/pontos extras)
  function normalizarStatus(valor) {
    if (valor === null || valor === undefined) return "";

    return valor
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")   // "N / A" -> "N/A"
      .replace(/\./g, "")    // "N.A."  -> "NA"
      .replace(/^#/, "");    // "#N/A"  -> "N/A"
  }

  // Lista de bloqueados já normalizada (inclui variações de N/A)
  const bloqueadosNormalizados = STATUS_BLOQUEADOS
    .map(normalizarStatus)
    .concat(["NA"]);

  // ============================================================
  // CABEÇALHOS
  // ============================================================

  const ultimaColunaOrigem = abaOrigem.getLastColumn();
  const ultimaColunaDestino = abaDestino.getLastColumn();

  if (ultimaColunaOrigem === 0 || ultimaColunaDestino === 0) return;

  const cabecalhoOrigem = abaOrigem
    .getRange(1, 1, 1, ultimaColunaOrigem)
    .getValues()[0]
    .map(c => c.toString().trim());

  const cabecalhoDestino = abaDestino
    .getRange(1, 1, 1, ultimaColunaDestino)
    .getValues()[0]
    .map(c => c.toString().trim());

  // ============================================================
  // ÍNDICES DAS COLUNAS DA ORIGEM
  // ============================================================

  const idxO = {};

  cabecalhoOrigem.forEach((nome, i) => {
    idxO[nome] = i;
  });

  // ============================================================
  // VERIFICAÇÃO DAS COLUNAS OBRIGATÓRIAS
  // ============================================================

  const colunasObrigatorias = [
    "STATUS - PEDIDO DE COMPRA",
    COL_STATUS_PGTO,
    "UFV",
    "FORNECEDOR",
    "COMPRADOR",
    "N. PEDIDO DE COMPRA",
    "TIPO DE PAGAMENTO",
    "CENTRO DE CUSTO"
  ];

  for (let i = 1; i <= 10; i++) {
    colunasObrigatorias.push(`VENCIMENTO PARCELA ${i}`);
    colunasObrigatorias.push(`NF ou ND PARCELA ${i}`);
    colunasObrigatorias.push(`REQ MXM PARCELA ${i}`);
    colunasObrigatorias.push(`VALOR PARCELA ${i}`);
  }

  const faltantes = colunasObrigatorias.filter(col => idxO[col] === undefined);

  if (faltantes.length > 0) {
    SpreadsheetApp.getUi().alert(
      "As seguintes colunas não foram encontradas na aba Compras + Logística:\n\n" +
      faltantes.join("\n")
    );
    return;
  }

  // ============================================================
  // LIMPAR DADOS EXISTENTES DO BACKOFFICE
  // ============================================================

  const ultimaLinhaDestino = abaDestino.getLastRow();

  if (ultimaLinhaDestino > 1) {
    for (
      let inicio = 2;
      inicio <= ultimaLinhaDestino;
      inicio += TAMANHO_BLOCO
    ) {
      const quantidade = Math.min(
        TAMANHO_BLOCO,
        ultimaLinhaDestino - inicio + 1
      );

      abaDestino
        .getRange(inicio, 1, quantidade, ultimaColunaDestino)
        .clearContent();
    }
  }

  // ============================================================
  // PROCESSAMENTO DA ORIGEM EM BLOCOS
  // ============================================================

  const ultimaLinhaOrigem = abaOrigem.getLastRow();

  if (ultimaLinhaOrigem <= 1) return;

  let proximaLinhaDestino = 2;
  let ignoradasPorStatus = 0;

  for (
    let inicio = 2;
    inicio <= ultimaLinhaOrigem;
    inicio += TAMANHO_BLOCO
  ) {

    const quantidade = Math.min(
      TAMANHO_BLOCO,
      ultimaLinhaOrigem - inicio + 1
    );

    // Lê somente o intervalo necessário
    const dadosOrigem = abaOrigem
      .getRange(
        inicio,
        1,
        quantidade,
        ultimaColunaOrigem
      )
      .getValues();

    const matrizFinal = [];

    // ==========================================================
    // PROCESSAR LINHAS
    // ==========================================================

    dadosOrigem.forEach(linha => {

      const status = linha[idxO["STATUS - PEDIDO DE COMPRA"]]
        ? linha[idxO["STATUS - PEDIDO DE COMPRA"]].toString().trim()
        : "";

      // Ignora cancelados
      if (status === "CANCELADO") return;

      // ========================================================
      // FILTRO: STATUS GERAL DE PAGAMENTO (100%)
      // Só leva o que for DIFERENTE de PAGO e de N/A
      // ========================================================

      const statusPagamento = normalizarStatus(
        linha[idxO[COL_STATUS_PGTO]]
      );

      if (bloqueadosNormalizados.indexOf(statusPagamento) !== -1) {
        ignoradasPorStatus++;
        return;
      }

      let temAlgumVencimento = false;

      // ========================================================
      // PARCELAS 1 A 10
      // ========================================================

      for (let i = 1; i <= 10; i++) {

        const venc = linha[idxO[`VENCIMENTO PARCELA ${i}`]];

        // Só processa parcela que possui vencimento
        if (
          venc === "" ||
          venc === null ||
          venc === undefined ||
          venc.toString().trim() === ""
        ) {
          continue;
        }

        temAlgumVencimento = true;

        let dVenc;

        if (venc instanceof Date) {
          dVenc = venc.getTime();
        } else {
          dVenc = new Date(venc).getTime();
        }

        // Só entram parcelas a partir de 01/01/2026
        if (!isNaN(dVenc) && dVenc >= DATA_LIMITE_FIN) {

          const nf = linha[idxO[`NF ou ND PARCELA ${i}`]];

          const novaLinha = cabecalhoDestino.map(col => {

            // Colunas fixas
            if (colunasFixas[col]) {
              return linha[idxO[colunasFixas[col]]];
            }

            // Número da parcela
            if (col === "Nº DA PARCELA") {
              return i;
            }

            // REQ MXM
            if (col === "REQ MXM") {
              return linha[idxO[`REQ MXM PARCELA ${i}`]];
            }

            // Vencimento
            if (col === "VENCIMENTO") {
              return venc;
            }

            // Valor
            if (col === "VALOR") {
              return linha[idxO[`VALOR PARCELA ${i}`]];
            }

            // NF / ND
            if (col === "NF OU ND") {
              return nf;
            }

            // Demais colunas ficam vazias
            return "";
          });

          matrizFinal.push(novaLinha);
        }
      }

      // ========================================================
      // SEM NENHUM VENCIMENTO
      // ========================================================

      if (!temAlgumVencimento) {

        const linhaBase = cabecalhoDestino.map(col => {

          if (colunasFixas[col]) {
            return linha[idxO[colunasFixas[col]]];
          }

          return "";
        });

        matrizFinal.push(linhaBase);
      }
    });

    // ==========================================================
    // GRAVAR BLOCO
    // ==========================================================

    if (matrizFinal.length > 0) {

      abaDestino
        .getRange(
          proximaLinhaDestino,
          1,
          matrizFinal.length,
          cabecalhoDestino.length
        )
        .setValues(matrizFinal);

      proximaLinhaDestino += matrizFinal.length;
    }
  }

  // ============================================================
  // INSERIR FÓRMULAS
  // ============================================================

  function inserirFormulaBO(nomeColuna, formula) {

    const idx = cabecalhoDestino.indexOf(nomeColuna) + 1;

    if (idx > 0) {
      abaDestino
        .getRange(2, idx)
        .setFormula(formula);
    }
  }

  // ============================================================
  // STATUS GERAL DE PAGAMENTO
  // ============================================================

  inserirFormulaBO(
    "STATUS GERAL DE PAGAMENTO (100%)",
    '=ARRAYFORMULA(IF(F2:F="";"Sem Requisição";IFERROR(IF(XLOOKUP(F2:F;\'Relatório de Pagamentos\'!C:C;\'Relatório de Pagamentos\'!H:H)="Sim";"Pago";IF(XLOOKUP(F2:F;\'Relatório de Pagamentos\'!C:C;\'Relatório de Pagamentos\'!H:H)="Não";"Pendente";"Em Aprovação"));"Não Encontrado")))'
  );

  // ============================================================
  // MÊS
  // ============================================================

  inserirFormulaBO(
    "Mês",
    '=ARRAYFORMULA(IF(I2:I="";"";MONTH(I2:I)))'
  );

  // ============================================================
  // ANO
  // ============================================================

  inserirFormulaBO(
    "Ano",
    '=ARRAYFORMULA(IF(I2:I="";"";YEAR(I2:I)))'
  );

  // ============================================================
  // FÓRMULA
  // ============================================================

  inserirFormulaBO(
  "Fórmula",
  '=LET(kH;ARRAYFORMULA(IF($H2:$H="";"";IFERROR(VALUE($H2:$H)&"";TRIM($H2:$H&""))));kK;ARRAYFORMULA(IF($K2:$K="";"";IFERROR(VALUE($K2:$K)&"";TRIM($K2:$K&""))));bC;ARRAYFORMULA(IF(\'Relatório de Pagamentos\'!$C$3:$C="";"";IFERROR(VALUE(\'Relatório de Pagamentos\'!$C$3:$C)&"";TRIM(\'Relatório de Pagamentos\'!$C$3:$C&""))));bA;ARRAYFORMULA(IF(\'Relatório de Pagamentos\'!$A$3:$A="";"";IFERROR(VALUE(\'Relatório de Pagamentos\'!$A$3:$A)&"";TRIM(\'Relatório de Pagamentos\'!$A$3:$A&""))));tab;ARRAYFORMULA({bC&"|"&bA\\TRIM(\'Relatório de Pagamentos\'!$H$3:$H&"")});p;ARRAYFORMULA(IFERROR(VLOOKUP(ARRAYFORMULA(kH&"|"&kK);tab;2;FALSE);"##NE##"));ARRAYFORMULA(IF(($H2:$H="")*($K2:$K="");"";IF(p="##NE##";"Verificar";IF(p="";"Em Aprovação";IF(UPPER(LEFT(p;1))="S";"Pago";IF(UPPER(LEFT(p;1))="N";"Em Aberto";p)))))))'
);

  SpreadsheetApp.flush();

  SpreadsheetApp.getUi().alert(
    "Backoffice atualizado com sucesso!\n\n" +
    "Linhas ignoradas por " + COL_STATUS_PGTO + " = PAGO ou N/A: " +
    ignoradasPorStatus
  );
}

