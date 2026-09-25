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
  const STATUS_BLOQUEADOS = ["N/A"];

  // Linhas PAGO: só entram as parcelas pagas nos últimos DIAS_PAGO_RECENTE dias
  // (dias corridos, contando hoje), conferidas na aba Relatório de Pagamentos
  // pelo par Requisição + Número do Título.
  const STATUS_PAGO = "PAGO";
  const DIAS_PAGO_RECENTE = 10;
  const ABA_PAGAMENTOS = "Relatório de Pagamentos";
  const LINHA_CABECALHO_PAGAMENTOS = 2;
  const COL_PAG_REQUISICAO = "Requisição";
  const COL_PAG_TITULO = "Número do Título";
  const COL_PAG_DATA = "Prog.Pagto.";

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

  const pagoNormalizado = normalizarStatus(STATUS_PAGO);

  // Normaliza Requisição / NF para comparação entre as abas:
  // maiúsculas, sem espaços, sem ".0" de número e sem zeros à esquerda
  // ("012345" e 12345 viram "12345"; "009999a" vira "9999A").
  function normalizarChave(valor) {
    if (valor === null || valor === undefined) return "";

    return valor
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/\.0+$/, "")
      .replace(/^0+(?=.)/, "");
  }

  // Converte o valor de uma célula de data (Date ou texto dd/mm/aaaa) em milissegundos
  function converterData(valor) {
    if (valor instanceof Date) return valor.getTime();
    if (valor === null || valor === undefined || valor.toString().trim() === "") return NaN;

    const texto = valor.toString().trim();
    const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

    if (br) {
      return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])).getTime();
    }

    return new Date(texto).getTime();
  }

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
  // PAGAMENTOS RECENTES (RELATÓRIO DE PAGAMENTOS)
  // Lido uma única vez. Guarda só o que foi pago na janela,
  // com a chave "REQUISIÇÃO|NÚMERO DO TÍTULO".
  // ============================================================

  const abaPagamentos = ss.getSheetByName(ABA_PAGAMENTOS);

  if (!abaPagamentos) {
    SpreadsheetApp.getUi().alert("Aba " + ABA_PAGAMENTOS + " não encontrada.");
    return;
  }

  const hoje = new Date();
  const fimJanela = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1).getTime();
  const inicioJanela = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - DIAS_PAGO_RECENTE).getTime();

  const ultimaColunaPag = abaPagamentos.getLastColumn();
  const ultimaLinhaPag = abaPagamentos.getLastRow();

  const cabecalhoPag = ultimaColunaPag > 0
    ? abaPagamentos
        .getRange(LINHA_CABECALHO_PAGAMENTOS, 1, 1, ultimaColunaPag)
        .getValues()[0]
        .map(c => c.toString().trim().toUpperCase())
    : [];

  const idxPagReq = cabecalhoPag.indexOf(COL_PAG_REQUISICAO.toUpperCase());
  const idxPagTitulo = cabecalhoPag.indexOf(COL_PAG_TITULO.toUpperCase());
  const idxPagData = cabecalhoPag.indexOf(COL_PAG_DATA.toUpperCase());

  const faltantesPag = [];
  if (idxPagReq === -1) faltantesPag.push(COL_PAG_REQUISICAO);
  if (idxPagTitulo === -1) faltantesPag.push(COL_PAG_TITULO);
  if (idxPagData === -1) faltantesPag.push(COL_PAG_DATA);

  if (faltantesPag.length > 0) {
    SpreadsheetApp.getUi().alert(
      "As seguintes colunas não foram encontradas na linha " +
      LINHA_CABECALHO_PAGAMENTOS + " da aba " + ABA_PAGAMENTOS + ":\n\n" +
      faltantesPag.join("\n")
    );
    return;
  }

  const pagosRecentes = new Set();

  if (ultimaLinhaPag > LINHA_CABECALHO_PAGAMENTOS) {
    // Lê só o trecho de colunas que contém as 3 colunas usadas
    const colIni = Math.min(idxPagReq, idxPagTitulo, idxPagData);
    const colFim = Math.max(idxPagReq, idxPagTitulo, idxPagData);

    const dadosPag = abaPagamentos
      .getRange(
        LINHA_CABECALHO_PAGAMENTOS + 1,
        colIni + 1,
        ultimaLinhaPag - LINHA_CABECALHO_PAGAMENTOS,
        colFim - colIni + 1
      )
      .getValues();

    dadosPag.forEach(l => {
      const dPag = converterData(l[idxPagData - colIni]);
      if (isNaN(dPag) || dPag < inicioJanela || dPag >= fimJanela) return;

      const req = normalizarChave(l[idxPagReq - colIni]);
      const titulo = normalizarChave(l[idxPagTitulo - colIni]);
      if (req === "" || titulo === "") return;

      pagosRecentes.add(req + "|" + titulo);
    });
  }

  // Diz se a parcela i da linha foi paga na janela.
  // 1) Tenta o par exato Requisição + NF (ex.: 012345 + 9999A, ou 012345 + 9999).
  // 2) Se a NF da parcela não tiver letra (ex.: 9999) e a nota foi dividida no
  //    relatório (9999A, 9999B...), a letra é a ordem da parcela entre as
  //    parcelas da linha com a mesma Requisição + NF: 1ª = A, 2ª = B...
  function parcelaPagaRecente(linha, i) {
    const req = normalizarChave(linha[idxO[`REQ MXM PARCELA ${i}`]]);
    const nf = normalizarChave(linha[idxO[`NF ou ND PARCELA ${i}`]]);
    if (req === "" || nf === "") return false;

    if (pagosRecentes.has(req + "|" + nf)) return true;
    if (!/\d$/.test(nf)) return false;

    let ordem = 0;
    for (let j = 1; j <= i; j++) {
      if (
        normalizarChave(linha[idxO[`REQ MXM PARCELA ${j}`]]) === req &&
        normalizarChave(linha[idxO[`NF ou ND PARCELA ${j}`]]) === nf
      ) {
        ordem++;
      }
    }

    return ordem <= 26 && pagosRecentes.has(req + "|" + nf + String.fromCharCode(64 + ordem));
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
  let parcelasPagasRecentes = 0;

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
      // N/A nunca entra. PAGO entra só com as parcelas pagas
      // nos últimos DIAS_PAGO_RECENTE dias.
      // ========================================================

      const statusPagamento = normalizarStatus(
        linha[idxO[COL_STATUS_PGTO]]
      );

      if (bloqueadosNormalizados.indexOf(statusPagamento) !== -1) {
        ignoradasPorStatus++;
        return;
      }

      const somentePagasRecentes = statusPagamento === pagoNormalizado;

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

          // Linha PAGO: a parcela só entra se foi paga na janela
          if (somentePagasRecentes) {
            if (!parcelaPagaRecente(linha, i)) continue;
            parcelasPagasRecentes++;
          }

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

      // (linhas PAGO não entram sem parcela paga na janela)
      if (!temAlgumVencimento && !somentePagasRecentes) {

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
    "Linhas ignoradas por " + COL_STATUS_PGTO + " = N/A: " +
    ignoradasPorStatus + "\n" +
    "Parcelas PAGO incluídas (pagas nos últimos " + DIAS_PAGO_RECENTE + " dias): " +
    parcelasPagasRecentes
  );
}
