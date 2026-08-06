/**
 * PAINEL DE APROVAÇÃO DE FRETES — backend
 *
 * Fonte da verdade do que está pendente: a coluna "Status da SC".
 * Toda linha cujo status casar com CONFIG.STATUS_PENDENTE aparece no painel.
 *
 * Como funciona o agrupamento por Rota:
 *   - Cada linha é uma RFQ, com suas próprias 3 transportadoras (Transportador 1/2/3).
 *   - Quando 2+ RFQs formam uma rota, a coluna "Rota" tem o mesmo código em todas
 *     as linhas do grupo, e as colunas "Rota - ..." trazem a cotação consolidada
 *     (uma transportadora levando a rota inteira).
 *   - O gestor compara duas opções:
 *       Opção A — ROTEIRIZADO: a cotação das colunas "Rota - ...".
 *       Opção B — SEPARADO:    a melhor transportadora de cada RFQ isoladamente.
 *
 * Nada é criado ou reorganizado na planilha. A gravação da aprovação acontece só
 * nas colunas de aprovação (Aprovador, Data da Aprovação, Decisão da Aprovação,
 * Transportador Aprovado, Valor Aprovado), que já precisam existir na aba.
 */

const CONFIG = {
  SHEET_NAME: 'Controle de Frete 2024_2025_2026',

  // Nomes possíveis do arquivo HTML dentro do projeto (com e sem acento).
  HTML_FILES: ['Aprovação2', 'Aprovacao', 'Aprovação'],

  // Um status é "pendente de aprovação" se, depois de normalizado
  // (minúsculas, sem acento e sem espaço), contiver um destes trechos.
  // Para usar outro texto de status, troque os valores abaixo (mantenha as aspas).
  STATUS_PENDENTE: ['Ag Aprovação', 'Aguardando Aprovação'],

  // Texto gravado em "Status da SC" quando o gestor aprova a cotação.
  STATUS_APROVADO: 'Em programação',

  // Some o item da lista quando "Data da Aprovação" já estiver preenchida,
  // mesmo que o status ainda não tenha sido atualizado.
  ESCONDER_JA_APROVADO: true,

  HEADER_SCAN_ROWS: 20,
  NO_QUOTE_TEXTS: ['nao cotou', 'naocotou', 'sem cotacao', 'nc', 'n a', 'na', 'nd']
};

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Aprovação de Fretes')
    .addItem('Abrir painel de aprovação', 'abrirPainel')
    .addToUi();
}

function abrirPainel() {
  const html = buildTemplate_().evaluate().setWidth(1200).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, 'Aprovação de fretes');
}

/** Só é necessário se você for publicar o painel como link (Implantar > Nova implantação > App da Web). */
function doGet() {
  return buildTemplate_().evaluate()
    .setTitle('Aprovação de fretes')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function buildTemplate_() {
  const tentados = [];
  for (let i = 0; i < CONFIG.HTML_FILES.length; i++) {
    try {
      return HtmlService.createTemplateFromFile(CONFIG.HTML_FILES[i]);
    } catch (e) {
      tentados.push(CONFIG.HTML_FILES[i]);
    }
  }
  throw new Error('Não encontrei o arquivo HTML do painel. Procurei por: ' + tentados.join(', ') +
    '. Crie um arquivo HTML no projeto chamado "Aprovacao".');
}

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function norm_(str) {
  return String(str === null || str === undefined ? '' : str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function txt_(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

/** Converte "R$ 4.993,15", 4993.15 ou "" em número (ou null se não houver cotação). */
function parseMoney_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const raw = txt_(v);
  if (CONFIG.NO_QUOTE_TEXTS.indexOf(norm_(raw)) !== -1) return null;
  const cleaned = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    const alvo = norm_(CONFIG.SHEET_NAME);
    const achou = ss.getSheets().filter(function (s) { return norm_(s.getName()) === alvo; });
    if (achou.length) sheet = achou[0];
  }
  if (!sheet) {
    throw new Error('Não encontrei a aba "' + CONFIG.SHEET_NAME + '". Abas disponíveis: ' +
      SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) { return s.getName(); }).join(' | '));
  }
  return sheet;
}

/* ------------------------------------------------------------------ */
/* Cabeçalho e colunas                                                 */
/* ------------------------------------------------------------------ */

const HEADER_HINTS = ['rfq', 'rota', 'statusdasc', 'setorsolicitante', 'motivodofrete',
  'modalidade', 'tipodefrete', 'material', 'qtdesolicitada', 'tipodevolume', 'valorunitario',
  'valordanf', 'origem', 'destino', 'transportador1nome', 'valorallin1', 'rotatransportador'];

function detectHeaderRow_(data) {
  let melhor = -1, melhorScore = 0;
  const limite = Math.min(data.length, CONFIG.HEADER_SCAN_ROWS);
  for (let r = 0; r < limite; r++) {
    const cels = data[r].map(norm_);
    let score = 0;
    HEADER_HINTS.forEach(function (h) { if (cels.indexOf(h) !== -1) score += 2; });
    if (cels.indexOf('rfq') !== -1) score += 4;
    if (cels.indexOf('rota') !== -1) score += 2;
    if (score > melhorScore) { melhorScore = score; melhor = r; }
  }
  return melhorScore >= 6 ? melhor : -1;
}

function find_(headers, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const idx = headers.indexOf(norm_(aliases[i]));
    if (idx !== -1) return idx;
  }
  return -1;
}

function mapSheet_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return { data: data, headerRow: -1, col: {}, faltando: [] };

  const headerRow = detectHeaderRow_(data);
  if (headerRow === -1) return { data: data, headerRow: -1, col: {}, faltando: [] };

  const headers = data[headerRow].map(norm_);
  const faltando = [];
  const find = function (nomeExibido, aliases) {
    const idx = find_(headers, aliases);
    if (idx === -1) faltando.push(nomeExibido);
    return idx;
  };

  const col = {
    rfq: find('RFQ', ['RFQ']),
    rota: find('Rota', ['Rota']),
    status: find('Status da SC', ['Status da SC']),
    setor: find('Setor Solicitante', ['Setor Solicitante']),
    motivo: find('Motivo do Frete', ['Motivo do Frete']),
    modalidade: find('Modalidade', ['Modalidade']),
    tipo: find('Tipo de Frete', ['Tipo de Frete']),
    material: find('Material', ['Material']),
    qtde: find('Qtde solicitada', ['Qtde solicitada']),
    tipoVolume: find('Tipo de Volume', ['Tipo de Volume']),
    valUnit: find('Valor Unitário', ['Valor Unitário', 'Valor Unitario']),
    valNF: find('Valor da NF.', ['Valor da NF.', 'Valor da NF']),
    origem: find('Origem', ['Origem']),
    destino: find('Destino', ['Destino']),

    aprovador: find('Aprovador', ['Aprovador']),
    dataAprovacao: find('Aprovação da Cotação', ['Aprovação da Cotação', 'Aprovacao da Cotacao']),
    transportadorAprovado: find('Transportadora Aprovada', ['Transportadora Aprovada', 'TransportadorA Escolhida', 'Transportador Aprovado']),
    valorAprovado: find('Valor (All In)', ['Valor (All In)']),

    rotaQuote: {
      nome: find('Rota - Transportador', ['Rota - Transportador']),
      valor: find('Rota - Valor (All In)', ['Rota - Valor (All In)', 'Rota - Valor All In']),
      adValorem: find('Rota - Ad Valorem', ['Rota - Ad Valorem']),
      prazo: find('Rota - Prazo de Pagamento', ['Rota - Prazo de Pagamento']),
      transit: find('Rota - Transit Time', ['Rota - Transit Time']),
      veiculo: find('Rota - Veículo', ['Rota - Veículo', 'Rota - Veiculo'])
    }
  };

  col.carriers = [1, 2, 3].map(function (n) {
    return {
      slot: n,
      nome: find('Transportador ' + n + ' (nome)', ['Transportador ' + n + ' (nome)', 'Transportador ' + n]),
      valor: find('Valor (All In) ' + n, ['Valor (All In) ' + n]),
      adValorem: find('Ad Valorem ' + n, ['Ad Valorem ' + n]),
      prazo: find('Prazo de Pagamento ' + n, ['Prazo de Pagamento ' + n]),
      transit: find('Transit Time ' + n, ['Transit Time ' + n]),
      veiculo: find('Veículo ' + n, ['Veículo ' + n, 'Veiculo ' + n])
    };
  });

  return { data: data, headerRow: headerRow, col: col, faltando: faltando };
}

function cell_(row, idx) {
  return idx !== -1 ? row[idx] : '';
}

function statusPendente_(valor) {
  const n = norm_(valor);
  if (n === '') return false;
  for (let i = 0; i < CONFIG.STATUS_PENDENTE.length; i++) {
    if (n.indexOf(norm_(CONFIG.STATUS_PENDENTE[i])) !== -1) return true;
  }
  return false;
}

function isPending_(row, col) {
  if (CONFIG.ESCONDER_JA_APROVADO && col.dataAprovacao !== -1 && txt_(row[col.dataAprovacao]) !== '') return false;
  return statusPendente_(cell_(row, col.status));
}

/* ------------------------------------------------------------------ */
/* Leitura: linhas pendentes, decisões e diagnóstico                   */
/* ------------------------------------------------------------------ */

function getPendingGroups() {
  const sheet = getSheet_();
  const mapped = mapSheet_(sheet);

  const diag = {
    aba: sheet.getName(),
    linhaCabecalho: mapped.headerRow === -1 ? null : mapped.headerRow + 1,
    totalLinhas: Math.max(0, mapped.data.length - (mapped.headerRow + 1)),
    colunasNaoEncontradas: mapped.faltando || [],
    statusEncontrados: [],
    pendentes: 0,
    statusPendenteConfig: CONFIG.STATUS_PENDENTE.join(', ')
  };

  if (mapped.headerRow === -1) {
    diag.erro = 'Não identifiquei a linha de cabeçalho nas primeiras ' + CONFIG.HEADER_SCAN_ROWS + ' linhas da aba.';
    return { decisoes: [], linhas: [], diag: diag };
  }

  const data = mapped.data;
  const col = mapped.col;
  const contagemStatus = {};
  const groups = {};
  const order = [];
  const linhasPendentes = [];

  for (let i = mapped.headerRow + 1; i < data.length; i++) {
    const row = data[i];
    const rfq = txt_(cell_(row, col.rfq));
    const rota = txt_(cell_(row, col.rota));
    if (rfq === '' && rota === '') continue;

    const statusTxt = txt_(cell_(row, col.status)) || '(vazio)';
    if (!contagemStatus[statusTxt]) contagemStatus[statusTxt] = { total: 0, pendente: statusPendente_(statusTxt) };
    contagemStatus[statusTxt].total++;

    if (!isPending_(row, col)) continue;

    const item = buildRow_(row, i + 1, col);
    item.status = statusTxt;
    const key = rota !== '' ? 'ROTA::' + norm_(rota) : 'RFQ::' + i;
    item.decisionKey = key;

    if (!groups[key]) {
      groups[key] = { key: key, rota: rota, rows: [] };
      order.push(key);
    }
    groups[key].rows.push(item);
    linhasPendentes.push(item);
  }

  diag.pendentes = linhasPendentes.length;
  diag.statusEncontrados = Object.keys(contagemStatus).map(function (s) {
    return { status: s, total: contagemStatus[s].total, pendente: contagemStatus[s].pendente };
  }).sort(function (a, b) { return b.total - a.total; });

  const decisoes = order.map(function (key) { return buildDecision_(groups[key]); });

  const linhas = linhasPendentes.map(function (r) {
    const cotados = r.carriers.filter(function (c) { return c.cotou; });
    const melhor = cotados.length ? cotados.reduce(function (a, b) { return b.valor < a.valor ? b : a; }) : null;
    return {
      rowIndex: r.rowIndex,
      decisionKey: r.decisionKey,
      rfq: r.rfq,
      rota: r.rota,
      status: r.status,
      setor: r.setor,
      motivo: r.motivo,
      modalidade: r.modalidade,
      tipo: r.tipo,
      material: r.material,
      qtde: r.qtde,
      tipoVolume: r.tipoVolume,
      valorUnit: r.valorUnit,
      valorNF: r.valorNF,
      rotaTexto: r.rotaTexto,
      melhorNome: melhor ? melhor.nome : '',
      melhorValor: melhor ? melhor.valor : null
    };
  });

  return { decisoes: decisoes, linhas: linhas, diag: diag };
}

function buildRow_(row, rowIndex, col) {
  const carriers = [];
  col.carriers.forEach(function (c) {
    const nome = txt_(cell_(row, c.nome));
    const valorRaw = cell_(row, c.valor);
    const valor = parseMoney_(valorRaw);
    if (nome === '' && valor === null) return;
    carriers.push({
      slot: c.slot,
      nome: nome !== '' ? nome : 'Transportadora ' + c.slot,
      chave: norm_(nome !== '' ? nome : 'slot' + c.slot),
      valor: valor,
      cotou: valor !== null,
      naoCotouTexto: valor === null ? (txt_(valorRaw) || 'Não cotou') : '',
      veiculo: txt_(cell_(row, c.veiculo)),
      transit: txt_(cell_(row, c.transit)),
      adValorem: txt_(cell_(row, c.adValorem)),
      prazo: txt_(cell_(row, c.prazo))
    });
  });

  const origem = txt_(cell_(row, col.origem));
  const destino = txt_(cell_(row, col.destino));

  return {
    rowIndex: rowIndex,
    rfq: txt_(cell_(row, col.rfq)),
    rota: txt_(cell_(row, col.rota)),
    setor: txt_(cell_(row, col.setor)),
    motivo: txt_(cell_(row, col.motivo)),
    modalidade: txt_(cell_(row, col.modalidade)),
    tipo: txt_(cell_(row, col.tipo)),
    material: txt_(cell_(row, col.material)),
    qtde: txt_(cell_(row, col.qtde)),
    tipoVolume: txt_(cell_(row, col.tipoVolume)),
    valorUnit: parseMoney_(cell_(row, col.valUnit)),
    valorNF: parseMoney_(cell_(row, col.valNF)),
    origem: origem,
    destino: destino,
    rotaTexto: (origem || destino)
      ? ('Rota: ' + (origem || 'Origem não informada') + ' x ' + (destino || 'Destino não informado'))
      : 'Trecho não informado',
    carriers: carriers,
    rotaQuote: {
      nome: txt_(cell_(row, col.rotaQuote.nome)),
      valor: parseMoney_(cell_(row, col.rotaQuote.valor)),
      adValorem: txt_(cell_(row, col.rotaQuote.adValorem)),
      prazo: txt_(cell_(row, col.rotaQuote.prazo)),
      transit: txt_(cell_(row, col.rotaQuote.transit)),
      veiculo: txt_(cell_(row, col.rotaQuote.veiculo))
    }
  };
}

/**
 * Junta a cotação da rota (colunas "Rota - ...") das linhas do grupo.
 * O valor é a SOMA dos valores de cada linha (cada linha traz sua parte
 * proporcional); os outros dados (transportador, ad valorem, prazo, transit
 * time, veículo) são os mesmos em todas as linhas, então usamos o primeiro
 * que aparecer preenchido.
 */
function combineRotaQuote_(rows) {
  const comNome = rows.map(function (r) { return r.rotaQuote.nome; }).filter(function (n) { return n !== ''; });
  const comAdValorem = rows.map(function (r) { return r.rotaQuote.adValorem; }).filter(Boolean);
  const comPrazo = rows.map(function (r) { return r.rotaQuote.prazo; }).filter(Boolean);
  const comTransit = rows.map(function (r) { return r.rotaQuote.transit; }).filter(Boolean);
  const comVeiculo = rows.map(function (r) { return r.rotaQuote.veiculo; }).filter(Boolean);
  const todasComValor = rows.every(function (r) { return r.rotaQuote.valor !== null; });

  const nome = comNome.length ? comNome[0] : '';
  const valor = todasComValor ? rows.reduce(function (s, r) { return s + r.rotaQuote.valor; }, 0) : null;

  return {
    nome: nome, valor: valor,
    adValorem: comAdValorem.length ? comAdValorem[0] : '',
    prazo: comPrazo.length ? comPrazo[0] : '',
    transit: comTransit.length ? comTransit[0] : '',
    veiculo: comVeiculo.length ? comVeiculo[0] : '',
    completo: nome !== '' && valor !== null
  };
}

/**
 * Monta uma decisão a partir das linhas de um grupo (uma RFQ isolada, ou
 * todas as RFQs de uma mesma Rota).
 */
function buildDecision_(group) {
  const rows = group.rows;
  const isRota = group.rota !== '';
  const base = rows[0];

  const itens = rows.map(function (r) {
    const cotados = r.carriers.filter(function (c) { return c.cotou; });
    const melhor = cotados.length ? cotados.reduce(function (a, b) { return b.valor < a.valor ? b : a; }) : null;
    return {
      rowIndex: r.rowIndex, rfq: r.rfq, rotaTexto: r.rotaTexto, material: r.material,
      carriers: r.carriers, melhorChave: melhor ? melhor.chave : null, completo: melhor !== null,
      rotaValor: r.rotaQuote.valor
    };
  });

  const separado = {
    itens: itens,
    completo: itens.length > 0 && itens.every(function (i) { return i.completo; }),
    total: itens.reduce(function (sum, i) {
      const m = i.carriers.filter(function (c) { return c.chave === i.melhorChave; })[0];
      return sum + (m ? m.valor : 0);
    }, 0),
    semCotacao: itens.filter(function (i) { return !i.completo; }).map(function (i) { return i.rfq; })
  };

  let roteirizado = null;
  if (isRota) {
    const rq = combineRotaQuote_(rows);
    roteirizado = {
      nome: rq.nome, valor: rq.valor, adValorem: rq.adValorem, prazo: rq.prazo,
      transit: rq.transit, veiculo: rq.veiculo, completo: rq.completo,
      apenasUmaRfq: rows.length < 2
    };
  }

  return {
    key: group.key,
    tipoDecisao: isRota ? 'ROTA' : 'RFQ',
    rota: group.rota,
    titulo: isRota ? group.rota : ('RFQ ' + base.rfq),
    rfqs: rows.map(function (r) { return r.rfq; }),
    status: base.status,
    setor: base.setor,
    motivo: base.motivo,
    modalidade: base.modalidade,
    tipo: base.tipo,
    valorNFTotal: rows.reduce(function (s, r) { return s + (r.valorNF || 0); }, 0),
    materiais: rows.map(function (r) {
      return {
        rfq: r.rfq, material: r.material, qtde: r.qtde, tipoVolume: r.tipoVolume,
        valorUnit: r.valorUnit, valorNF: r.valorNF, rotaTexto: r.rotaTexto
      };
    }),
    separado: separado,
    roteirizado: roteirizado
  };
}

/* ------------------------------------------------------------------ */
/* Gravação da aprovação                                               */
/* ------------------------------------------------------------------ */

/**
 * payload = {
 *   cenario: 'ROTEIRIZADO' | 'SEPARADO',
 *   rota: 'ROTA-010',
 *   linhas: [{ rowIndex, rfq, transportadora, valor }]
 * }
 * "valor" é o que vai na coluna "Valor (All In)": em ROTEIRIZADO, é a parte
 * proporcional daquela linha na cotação da rota (coluna "Rota - Valor (All In)").
 */
function approveDecision(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('Outra aprovação está sendo gravada agora. Tente de novo em alguns segundos.');
  }

  try {
    const sheet = getSheet_();
    const mapped = mapSheet_(sheet);
    const col = mapped.col;
    if (mapped.headerRow === -1) throw new Error('Não consegui identificar o cabeçalho da aba.');

    if (col.aprovador === -1 && col.transportadorAprovado === -1 && col.valorAprovado === -1 && col.dataAprovacao === -1) {
      throw new Error('Não encontrei as colunas de aprovação. Crie na aba: Aprovador, Transportadora Aprovada, ' +
        'Valor (All In), Aprovação da Cotação.');
    }

    const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'não identificado';
    const agoraTexto = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');

    const ultimaLinha = sheet.getLastRow();
    payload.linhas.forEach(function (l) {
      if (!l.rowIndex || l.rowIndex <= mapped.headerRow + 1 || l.rowIndex > ultimaLinha) {
        throw new Error('Linha ' + l.rowIndex + ' fora da área de dados. Clique em Atualizar e tente de novo.');
      }
      const atual = sheet.getRange(l.rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
      const rfqAtual = txt_(cell_(atual, col.rfq));
      if (txt_(l.rfq) !== '' && norm_(rfqAtual) !== norm_(l.rfq)) {
        throw new Error('A planilha mudou desde que a tela foi carregada (linha ' + l.rowIndex +
          ' agora é "' + rfqAtual + '"). Clique em Atualizar e refaça a aprovação.');
      }
      if (CONFIG.ESCONDER_JA_APROVADO && col.dataAprovacao !== -1 && txt_(atual[col.dataAprovacao]) !== '') {
        throw new Error('A RFQ ' + rfqAtual + ' já foi aprovada por outra pessoa. Clique em Atualizar.');
      }
    });

    const tipoTexto = payload.cenario === 'ROTEIRIZADO' ? 'Roteirizado' : 'Único';
    payload.linhas.forEach(function (l) {
      if (col.aprovador !== -1) sheet.getRange(l.rowIndex, col.aprovador + 1).setValue(email);
      if (col.transportadorAprovado !== -1) sheet.getRange(l.rowIndex, col.transportadorAprovado + 1).setValue(l.transportadora);
      if (col.valorAprovado !== -1 && l.valor !== null && l.valor !== undefined) {
        sheet.getRange(l.rowIndex, col.valorAprovado + 1).setValue(l.valor);
      }
      if (col.dataAprovacao !== -1) sheet.getRange(l.rowIndex, col.dataAprovacao + 1).setValue(agoraTexto);
      if (col.status !== -1) sheet.getRange(l.rowIndex, col.status + 1).setValue(CONFIG.STATUS_APROVADO);
      if (col.tipo !== -1) sheet.getRange(l.rowIndex, col.tipo + 1).setValue(tipoTexto);
      if (col.rota !== -1 && payload.cenario === 'SEPARADO') sheet.getRange(l.rowIndex, col.rota + 1).setValue('');
    });

    SpreadsheetApp.flush();
    return { success: true, linhas: payload.linhas.length, aprovador: email };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Diagnóstico — rode no editor (menu Executar > diagnosticar)         */
/* e veja o resultado em Ver > Registros de execução.                  */
/* ------------------------------------------------------------------ */

function diagnosticar() {
  const r = getPendingGroups();
  Logger.log('Aba: %s | cabeçalho na linha %s | %s linhas de dados',
    r.diag.aba, r.diag.linhaCabecalho, r.diag.totalLinhas);
  Logger.log('Colunas não encontradas: %s', (r.diag.colunasNaoEncontradas || []).join(', ') || 'nenhuma');
  Logger.log('Status na planilha:');
  r.diag.statusEncontrados.forEach(function (s) {
    Logger.log('   %s → %s linha(s) %s', s.status, s.total, s.pendente ? '[PENDENTE]' : '');
  });
  Logger.log('Linhas pendentes: %s | decisões montadas: %s', r.diag.pendentes, r.decisoes.length);
  return r.diag;
}
