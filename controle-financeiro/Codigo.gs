/**
 * PAINEL FINANCEIRO — Orçado × Projetado × Realizado, por Usina e Centro de Custo
 *
 * Lê três abas da planilha de Controle Financeiro:
 *   - Orçamento                 → ORÇADO
 *   - Fluxo de Caixa            → PROJETADO (por padrão, o fluxo mais recente enviado)
 *   - Realizado Controladoria   → REALIZADO
 *
 * As colunas são encontradas pelo NOME do cabeçalho (a posição não importa).
 * O painel pode editar, incluir e excluir linhas nas abas marcadas como
 * editáveis em CONFIG.EDITAVEL. Antes de gravar, ele confere se a linha não foi
 * alterada por outra pessoa desde que o painel foi aberto.
 *
 * As justificativas de divergência ficam numa aba própria (criada na primeira
 * vez que alguém salvar uma): CONFIG.ABA_JUSTIFICATIVAS.
 */

const CONFIG = {
  // Deixe '' para usar a planilha onde o script foi instalado (recomendado).
  // Para ler outra planilha, cole aqui o ID dela (o trecho da URL entre /d/ e /edit).
  PLANILHA_ID: '',

  // Nome do arquivo HTML dentro do projeto do Apps Script.
  HTML_FILE: 'Painel',

  EMPRESA: 'SolarGrid',

  // Semáforo do consumo do orçamento: (Realizado + Projetado em aberto) ÷ Orçado.
  // Acima de ATENCAO fica amarelo; acima de ESTOURO fica vermelho.
  ATENCAO: 0.90,
  ESTOURO: 1.00,

  // Quais abas o painel pode alterar. Por enquanto o painel é só de consulta:
  // tudo travado. Troque para true quando quiser liberar a edição.
  EDITAVEL: { orc: false, fluxo: false, real: false },

  // Na coluna "Real / Acumulado": true = "REAL S" (última semana) é SOMADO ao
  // "Real Acumulado". Use false se o "Real Acumulado" já incluir a última semana.
  REALIZADO_SOMA_SEMANA: true,

  // PROJETADO = só o que está "Em Aberto" no fluxo escolhido (o que já foi pago
  // já aparece no Realizado e não pode contar duas vezes). Use false para somar tudo.
  PROJETADO_SO_EM_ABERTO: true,

  // Saídas sempre aparecem positivas no painel. Se uma aba guardar os pagamentos
  // como número negativo, o painel percebe sozinho e inverte o sinal na tela
  // (e desinverte ao gravar).
  AJUSTAR_SINAL: true,

  ABA_JUSTIFICATIVAS: 'Painel - Justificativas',

  LINHAS_PROCURA_CABECALHO: 15
};

/* Colunas usadas de cada aba. "nome" é o cabeçalho na planilha; "alias" são
 * outros nomes aceitos. tipo: texto | data | valor. dic: texto que se repete
 * muito (vai compactado para o painel abrir mais rápido). */
const ABAS = {
  orc: {
    nome: 'Orçamento',
    campos: [
      { k: 'setor', nome: 'SETOR', tipo: 'texto', dic: true },
      { k: 'venc', nome: 'DATA DE VENCIMENTO', tipo: 'data', alias: ['VENCIMENTO'] },
      { k: 'valor', nome: 'VALOR A PAGAR', tipo: 'valor', alias: ['VALOR'] },
      { k: 'projeto', nome: 'PROJETO', tipo: 'texto', dic: true, alias: ['USINA'] },
      { k: 'cc', nome: 'CENTRO DE CUSTO', tipo: 'texto', dic: true }
    ]
  },
  real: {
    nome: 'Realizado Controladoria',
    campos: [
      { k: 'favorecido', nome: 'Favorecido', tipo: 'texto', dic: true },
      { k: 'ccCod', nome: 'C. Custo', tipo: 'texto', dic: true, alias: ['Cod. Custo', 'Cód. Centro de Custo'] },
      { k: 'ccDesc', nome: 'Centro de Custo', tipo: 'texto', dic: true },
      { k: 'projeto', nome: 'Projeto', tipo: 'texto', dic: true, alias: ['Usina'] },
      { k: 'doc', nome: 'Documento', tipo: 'texto' },
      { k: 'pagto', nome: 'Pagto.', tipo: 'data', alias: ['Pagto', 'Data Pagto', 'Data de Pagamento'] },
      { k: 'obs', nome: 'Consolidado', tipo: 'texto' },
      { k: 'valor', nome: 'Pagamentos', tipo: 'valor' },
      { k: 'tipo', nome: 'Real / Acumulado', tipo: 'texto', dic: true, alias: ['Real/Acumulado'] },
      { k: 'ccFull', nome: 'Código + Centro de Custo', tipo: 'texto', dic: true, alias: ['Codigo + Centro de Custo'] }
    ]
  },
  fluxo: {
    nome: 'Fluxo de Caixa',
    campos: [
      { k: 'dataProg', nome: 'Data programada de pgto', tipo: 'data', alias: ['Data programada de pagamento', 'Data programada'] },
      { k: 'fornecedor', nome: 'Fornecedor', tipo: 'texto', dic: true },
      { k: 'valor', nome: 'Valor', tipo: 'valor' },
      { k: 'coment', nome: 'Comentário', tipo: 'texto', alias: ['Comentarios', 'Comentários'] },
      { k: 'projeto', nome: 'Projeto', tipo: 'texto', dic: true, alias: ['Usina'] },
      { k: 'cc', nome: 'Centro de Custo', tipo: 'texto', dic: true },
      { k: 'situacao', nome: 'Situação', tipo: 'texto', dic: true, alias: ['Status'] },
      { k: 'dataFluxo', nome: 'Data do Fluxo', tipo: 'data', dic: true }
    ]
  }
};

const CAB_JUST = ['Chave', 'Usina', 'Centro de Custo', 'Status', 'Comentário', 'Ação / Ajuste',
  'Responsável', 'Atualizado em', 'Atualizado por'];

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Controle Financeiro')
    .addItem('Abrir painel', 'abrirPainel')
    .addItem('Link para a Diretoria (tela cheia)', 'mostrarLink')
    .addToUi();
}

function abrirPainel() {
  const html = paginaHtml_().setWidth(1500).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Controle Financeiro');
}

function mostrarLink() {
  const url = ScriptApp.getService().getUrl();
  const corpo = url
    ? '<p style="font:14px sans-serif">Link do painel em tela cheia:</p>' +
      '<p style="font:14px sans-serif"><a href="' + url + '" target="_blank">' + url + '</a></p>'
    : '<p style="font:14px sans-serif">O painel ainda não foi publicado como App da Web.<br><br>' +
      'No editor do Apps Script: <b>Implantar → Nova implantação → App da Web</b>. ' +
      'Veja o passo a passo no LEIA-ME.</p>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(corpo).setWidth(520).setHeight(180), 'Link do painel');
}

function doGet() {
  return paginaHtml_()
    .setTitle('Controle Financeiro — ' + CONFIG.EMPRESA)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function paginaHtml_() {
  return HtmlService.createHtmlOutputFromFile(CONFIG.HTML_FILE);
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function getSS_() {
  if (CONFIG.PLANILHA_ID) return SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Minúsculas, sem acento e só letras/números — para comparar nomes. */
function chave_(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getAba_(ss, nome, obrigatoria) {
  let aba = ss.getSheetByName(nome);
  if (!aba) {
    const alvo = chave_(nome);
    aba = ss.getSheets().filter(function (s) { return chave_(s.getName()) === alvo; })[0] || null;
  }
  if (!aba && obrigatoria) {
    throw new Error('Não achei a aba "' + nome + '". Abas existentes: ' +
      ss.getSheets().map(function (s) { return s.getName(); }).join(' | '));
  }
  return aba;
}

function parseValor_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s || s === '-') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[R$\s]/g, '');
  if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

/** Devolve a data como 'aaaa-mm-dd' (ou '' se não for data). */
function parseData_(v, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? '20' + m[3] : m[3];
    return ano + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // número de série do Sheets
    const d = new Date(Math.round((v - 25569) * 86400000));
    return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
  }
  return '';
}

/** Valor da célula no formato que o painel usa. */
function normalizar_(v, tipo, tz, sinal) {
  if (tipo === 'valor') {
    const n = parseValor_(v);
    return n === null ? null : Math.round(n * sinal * 100) / 100;
  }
  if (tipo === 'data') return parseData_(v, tz);
  if (Object.prototype.toString.call(v) === '[object Date]') return parseData_(v, tz);
  return String(v === null || v === undefined ? '' : v).trim();
}

function iguais_(a, b, tipo) {
  if (tipo === 'valor') {
    if (a === null || a === '' || a === undefined) return b === null || b === '' || b === undefined;
    if (b === null || b === '' || b === undefined) return false;
    return Math.abs(Number(a) - Number(b)) < 0.006;
  }
  return String(a === null || a === undefined ? '' : a).trim() ===
         String(b === null || b === undefined ? '' : b).trim();
}

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

/** Acha a linha de cabeçalho e a coluna de cada campo. */
function mapear_(sheet, def) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { linhaCab: 0, col: {}, faltando: def.campos.map(function (c) { return c.nome; }) };

  const nScan = Math.min(CONFIG.LINHAS_PROCURA_CABECALHO, lastRow);
  const topo = sheet.getRange(1, 1, nScan, lastCol).getDisplayValues();

  let melhor = { linha: 0, pontos: 0, col: {} };
  topo.forEach(function (linha, i) {
    const chaves = linha.map(chave_);
    const col = {};
    let pontos = 0;
    def.campos.forEach(function (c) {
      const nomes = [c.nome].concat(c.alias || []).map(chave_);
      for (let n = 0; n < nomes.length; n++) {
        const idx = chaves.indexOf(nomes[n]);
        if (idx !== -1) { col[c.k] = idx + 1; pontos++; break; }
      }
    });
    if (pontos > melhor.pontos) melhor = { linha: i + 1, pontos: pontos, col: col };
  });

  return {
    linhaCab: melhor.pontos >= 2 ? melhor.linha : 0,
    col: melhor.pontos >= 2 ? melhor.col : {},
    faltando: def.campos.filter(function (c) { return !(melhor.pontos >= 2 && melhor.col[c.k]); })
      .map(function (c) { return c.nome; })
  };
}

function lerAba_(ss, id, tz) {
  const def = ABAS[id];
  const sheet = getAba_(ss, def.nome, false);
  const base = {
    id: id, aba: def.nome, editavel: !!CONFIG.EDITAVEL[id], sinal: 1,
    campos: def.campos.map(function (c) { return { k: c.k, nome: c.nome, tipo: c.tipo }; }),
    linhas: [], dic: {}, faltando: [], linhaCab: 0, erro: ''
  };
  if (!sheet) { base.erro = 'Aba "' + def.nome + '" não encontrada.'; return base; }

  const mapa = mapear_(sheet, def);
  base.linhaCab = mapa.linhaCab;
  base.faltando = mapa.faltando;
  base.aba = sheet.getName();
  if (!mapa.linhaCab) { base.erro = 'Cabeçalho não encontrado na aba "' + def.nome + '".'; return base; }

  const ini = mapa.linhaCab + 1;
  const n = sheet.getLastRow() - mapa.linhaCab;
  if (n <= 0) return base;

  // Lê só as colunas usadas (a aba pode ter dezenas de colunas).
  const colunas = def.campos.map(function (c) {
    if (!mapa.col[c.k]) return null;
    return sheet.getRange(ini, mapa.col[c.k], n, 1).getValues();
  });

  // Sinal: se a maioria dos valores for negativa, inverte.
  const iValor = def.campos.map(function (c) { return c.tipo; }).indexOf('valor');
  let sinal = 1;
  if (CONFIG.AJUSTAR_SINAL && colunas[iValor]) {
    let neg = 0, pos = 0;
    colunas[iValor].forEach(function (r) { const x = parseValor_(r[0]); if (x > 0) pos++; else if (x < 0) neg++; });
    if (neg > pos) sinal = -1;
  }
  base.sinal = sinal;

  const dics = {}, dicIdx = {};
  def.campos.forEach(function (c) { if (c.dic) { dics[c.k] = []; dicIdx[c.k] = {}; } });

  for (let r = 0; r < n; r++) {
    let vazia = true;
    const linha = [ini + r];
    def.campos.forEach(function (c, j) {
      let v = colunas[j] ? normalizar_(colunas[j][r][0], c.tipo, tz, sinal) : (c.tipo === 'valor' ? null : '');
      if (v !== null && v !== '') vazia = false;
      if (c.dic) {
        const s = v === null ? '' : String(v);
        if (!(s in dicIdx[c.k])) { dicIdx[c.k][s] = dics[c.k].length; dics[c.k].push(s); }
        v = dicIdx[c.k][s];
      }
      linha.push(v);
    });
    if (!vazia) base.linhas.push(linha);
  }
  base.dic = dics;
  return base;
}

function lerJustificativas_(ss, tz) {
  const sheet = getAba_(ss, CONFIG.ABA_JUSTIFICATIVAS, false);
  const out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, CAB_JUST.length).getValues();
  dados.forEach(function (l) {
    if (!l[0]) return;
    out[l[0]] = {
      usina: String(l[1]), cc: String(l[2]), status: String(l[3]), comentario: String(l[4]),
      acao: String(l[5]), responsavel: String(l[6]),
      em: l[7] instanceof Date ? Utilities.formatDate(l[7], tz, 'dd/MM/yyyy HH:mm') : String(l[7]),
      por: String(l[8])
    };
  });
  return out;
}

/** Chamado pelo painel ao abrir e no botão "Atualizar". */
function carregarDados() {
  const ss = getSS_();
  const tz = ss.getSpreadsheetTimeZone();
  return {
    geradoEm: Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm'),
    usuario: Session.getActiveUser().getEmail() || '',
    planilha: ss.getName(),
    urlPlanilha: ss.getUrl(),
    cfg: {
      ATENCAO: CONFIG.ATENCAO, ESTOURO: CONFIG.ESTOURO,
      REALIZADO_SOMA_SEMANA: CONFIG.REALIZADO_SOMA_SEMANA, EMPRESA: CONFIG.EMPRESA,
      PROJETADO_SO_EM_ABERTO: CONFIG.PROJETADO_SO_EM_ABERTO
    },
    abas: { orc: lerAba_(ss, 'orc', tz), real: lerAba_(ss, 'real', tz), fluxo: lerAba_(ss, 'fluxo', tz) },
    just: lerJustificativas_(ss, tz)
  };
}

/* ------------------------------------------------------------------ */
/* Gravação                                                            */
/* ------------------------------------------------------------------ */

function prepararGravacao_(id) {
  const def = ABAS[id];
  if (!def) throw new Error('Aba inválida.');
  if (!CONFIG.EDITAVEL[id]) throw new Error('A aba "' + def.nome + '" está travada para edição pelo painel.');
  const ss = getSS_();
  const sheet = getAba_(ss, def.nome, true);
  const mapa = mapear_(sheet, def);
  if (!mapa.linhaCab) throw new Error('Cabeçalho não encontrado na aba "' + def.nome + '".');
  return { ss: ss, tz: ss.getSpreadsheetTimeZone(), sheet: sheet, def: def, mapa: mapa };
}

function paraCelula_(v, tipo, tz, sinal) {
  if (v === null || v === undefined || v === '') return '';
  if (tipo === 'valor') {
    const n = parseValor_(v);
    return n === null ? '' : n * sinal;
  }
  if (tipo === 'data') {
    const iso = parseData_(v, tz);
    return iso ? Utilities.parseDate(iso, tz, 'yyyy-MM-dd') : '';
  }
  return String(v);
}

/** Confere se a linha ainda é a mesma que o painel mostrou. */
function conferirLinha_(ctx, linha, antes, sinal) {
  if (linha <= ctx.mapa.linhaCab || linha > ctx.sheet.getLastRow()) {
    throw new Error('Essa linha não existe mais na planilha. Clique em Atualizar.');
  }
  ctx.def.campos.forEach(function (c) {
    const col = ctx.mapa.col[c.k];
    if (!col || !(c.k in antes)) return;
    const atual = normalizar_(ctx.sheet.getRange(linha, col).getValue(), c.tipo, ctx.tz, sinal);
    if (!iguais_(atual, antes[c.k], c.tipo)) {
      throw new Error('Essa linha foi alterada na planilha depois que o painel abriu ("' + c.nome +
        '"). Clique em Atualizar e tente de novo.');
    }
  });
}

function lerLinha_(ctx, linha, sinal) {
  const out = { _r: linha };
  ctx.def.campos.forEach(function (c) {
    const col = ctx.mapa.col[c.k];
    out[c.k] = col ? normalizar_(ctx.sheet.getRange(linha, col).getValue(), c.tipo, ctx.tz, sinal)
                   : (c.tipo === 'valor' ? null : '');
  });
  return out;
}

function sinalValido_(s) { return Number(s) === -1 ? -1 : 1; }

/** p = { aba, linha, sinal, antes:{campo:valor}, depois:{campo:valor} } */
function salvarLinha(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ctx = prepararGravacao_(p.aba);
    const sinal = sinalValido_(p.sinal);
    conferirLinha_(ctx, Number(p.linha), p.antes || {}, sinal);
    ctx.def.campos.forEach(function (c) {
      if (!(c.k in (p.depois || {}))) return;
      const col = ctx.mapa.col[c.k];
      if (!col) return;
      const cel = ctx.sheet.getRange(Number(p.linha), col);
      if (cel.getFormula()) throw new Error('A coluna "' + c.nome + '" tem fórmula nessa linha e não pode ser editada pelo painel.');
      cel.setValue(paraCelula_(p.depois[c.k], c.tipo, ctx.tz, sinal));
    });
    SpreadsheetApp.flush();
    return lerLinha_(ctx, Number(p.linha), sinal);
  } finally {
    lock.releaseLock();
  }
}

/** p = { aba, sinal, valores:{campo:valor} } — grava na primeira linha livre. */
function novaLinha(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ctx = prepararGravacao_(p.aba);
    const sinal = sinalValido_(p.sinal);
    const cols = ctx.def.campos.map(function (c) { return ctx.mapa.col[c.k]; }).filter(Boolean);

    // Última linha com dado nas colunas do painel (ignora fórmulas "arrastadas" em outras colunas).
    let ultima = ctx.mapa.linhaCab;
    const total = ctx.sheet.getLastRow();
    if (total > ctx.mapa.linhaCab) {
      cols.forEach(function (col) {
        const vals = ctx.sheet.getRange(ctx.mapa.linhaCab + 1, col, total - ctx.mapa.linhaCab, 1).getValues();
        for (let i = vals.length - 1; i >= 0; i--) {
          if (vals[i][0] !== '' && vals[i][0] !== null) { ultima = Math.max(ultima, ctx.mapa.linhaCab + 1 + i); break; }
        }
      });
    }
    const nova = ultima + 1;
    if (nova > ctx.sheet.getMaxRows()) ctx.sheet.insertRowsAfter(ctx.sheet.getMaxRows(), 1);
    if (ultima > ctx.mapa.linhaCab) {
      const largura = ctx.sheet.getLastColumn();
      ctx.sheet.getRange(ultima, 1, 1, largura)
        .copyTo(ctx.sheet.getRange(nova, 1, 1, largura), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    }
    ctx.def.campos.forEach(function (c) {
      const col = ctx.mapa.col[c.k];
      if (!col || !(c.k in (p.valores || {}))) return;
      ctx.sheet.getRange(nova, col).setValue(paraCelula_(p.valores[c.k], c.tipo, ctx.tz, sinal));
    });
    SpreadsheetApp.flush();
    return lerLinha_(ctx, nova, sinal);
  } finally {
    lock.releaseLock();
  }
}

/** p = { aba, linha, sinal, antes:{...} } */
function excluirLinha(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ctx = prepararGravacao_(p.aba);
    conferirLinha_(ctx, Number(p.linha), p.antes || {}, sinalValido_(p.sinal));
    ctx.sheet.deleteRow(Number(p.linha));
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** p = { chave, usina, cc, status, comentario, acao, responsavel } */
function salvarJustificativa(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = getSS_();
    const tz = ss.getSpreadsheetTimeZone();
    let sheet = getAba_(ss, CONFIG.ABA_JUSTIFICATIVAS, false);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.ABA_JUSTIFICATIVAS);
      sheet.getRange(1, 1, 1, CAB_JUST.length).setValues([CAB_JUST])
        .setFontWeight('bold').setBackground('#0A0F14').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 60);
      sheet.hideColumns(1);
      sheet.setColumnWidths(2, 2, 220);
      sheet.setColumnWidths(5, 2, 360);
    }
    const agora = new Date();
    const usuario = Session.getActiveUser().getEmail() || '';
    const linhaNova = [p.chave, p.usina, p.cc, p.status || '', p.comentario || '', p.acao || '',
      p.responsavel || '', agora, usuario];

    let alvo = 0;
    if (sheet.getLastRow() > 1) {
      const chaves = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < chaves.length; i++) if (chaves[i][0] === p.chave) { alvo = i + 2; break; }
    }
    if (!alvo) alvo = sheet.getLastRow() + 1;
    sheet.getRange(alvo, 1, 1, CAB_JUST.length).setValues([linhaNova]);
    sheet.getRange(alvo, 8).setNumberFormat('dd/MM/yyyy HH:mm');
    return {
      usina: p.usina, cc: p.cc, status: p.status || '', comentario: p.comentario || '', acao: p.acao || '',
      responsavel: p.responsavel || '', em: Utilities.formatDate(agora, tz, 'dd/MM/yyyy HH:mm'), por: usuario
    };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Diagnóstico — rode pelo editor para conferir se tudo foi encontrado */
/* ------------------------------------------------------------------ */

function diagnosticar() {
  const d = carregarDados();
  Logger.log('Planilha: ' + d.planilha);
  Object.keys(d.abas).forEach(function (id) {
    const a = d.abas[id];
    Logger.log('— Aba "' + a.aba + '": ' + (a.erro || ('cabeçalho na linha ' + a.linhaCab + ', ' +
      a.linhas.length + ' linhas com dados' + (a.sinal === -1 ? ', valores negativos (sinal invertido no painel)' : ''))));
    if (a.faltando.length) Logger.log('   Colunas NÃO encontradas: ' + a.faltando.join(' | '));
  });
  Logger.log('Justificativas salvas: ' + Object.keys(d.just).length);
}
