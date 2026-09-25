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
