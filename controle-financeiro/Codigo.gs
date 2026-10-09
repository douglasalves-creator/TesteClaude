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
 * Controle de acesso por setor (opcional): quando a aba "Acessos" existir, cada
 * pessoa só recebe os centros de custo dos setores liberados para o e-mail dela.
 *   - Aba "Setores":  Setor | Centro de Custo   (um centro de custo por linha)
 *   - Aba "Acessos":  E-mail | Setor            (uma pessoa pode ter várias linhas)
 *   - Setor "TODOS" libera tudo. O dono do script sempre vê tudo.
 * O filtro é feito aqui no servidor: o que a pessoa não pode ver nem chega ao navegador.
 * Para funcionar, publique como App da Web com "Executar como: Eu" e NÃO compartilhe
 * a planilha com quem só pode ver o próprio setor.
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

  // Controle de acesso por setor (ver explicação no topo do arquivo).
  ABA_ACESSOS: 'Acessos',
  ABA_SETORES: 'Setores',
  SETOR_TOTAL: 'TODOS',

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
      { k: 'tipo', nome: 'Real S / Acumulado', tipo: 'texto', dic: true, alias: ['Real / Acumulado', 'Real/Acumulado'] },
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


/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Controle Financeiro')
    .addItem('Abrir painel', 'abrirPainel')
    .addItem('Link para a Diretoria (tela cheia)', 'mostrarLink')
    .addSeparator()
    .addItem('Criar abas de acesso (Setores e Acessos)', 'prepararAcessos')
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

/* Converter data é lento no Apps Script; as mesmas datas se repetem muito, então guardamos o resultado. */
const CACHE_DATAS_ = {};

/** Devolve a data como 'aaaa-mm-dd' (ou '' se não for data). */
function parseData_(v, tz) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    const t = v.getTime();
    if (isNaN(t)) return '';
    const k = tz + t;
    if (!(k in CACHE_DATAS_)) CACHE_DATAS_[k] = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return CACHE_DATAS_[k];
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

function lerAba_(ss, id, tz, filtro) {
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
    const vals = {};
    def.campos.forEach(function (c, j) {
      const v = colunas[j] ? normalizar_(colunas[j][r][0], c.tipo, tz, sinal) : (c.tipo === 'valor' ? null : '');
      if (v !== null && v !== '') vazia = false;
      vals[c.k] = v;
    });
    if (vazia || (filtro && !filtro(vals))) continue;
    const linha = [ini + r];
    def.campos.forEach(function (c) {
      let v = vals[c.k];
      if (c.dic) {
        const s = v === null ? '' : String(v);
        if (!(s in dicIdx[c.k])) { dicIdx[c.k][s] = dics[c.k].length; dics[c.k].push(s); }
        v = dicIdx[c.k][s];
      }
      linha.push(v);
    });
    base.linhas.push(linha);
  }
  base.dic = dics;
  return base;
}

/* ------------------------------------------------------------------ */
/* Controle de acesso por setor                                         */
/* ------------------------------------------------------------------ */

/** Mesma normalização do painel: minúsculas, sem acento, só letras/números separados por espaço. */
function nk_(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Índice código/descrição/nome completo → centro de custo, a partir do Realizado (igual ao painel). */
function indiceCC_(ss) {
  const idx = {};
  const def = ABAS.real;
  const sheet = getAba_(ss, def.nome, false);
  if (!sheet) return idx;
  const mapa = mapear_(sheet, def);
  const n = sheet.getLastRow() - mapa.linhaCab;
  if (!mapa.linhaCab || n <= 0) return idx;
  const ler = function (k) { return mapa.col[k] ? sheet.getRange(mapa.linhaCab + 1, mapa.col[k], n, 1).getDisplayValues() : null; };
  const cod = ler('ccCod'), desc = ler('ccDesc'), full = ler('ccFull');
  for (let r = 0; r < n; r++) {
    const c = cod ? String(cod[r][0]).trim() : '', d = desc ? String(desc[r][0]).trim() : '';
    const f = (full ? String(full[r][0]).trim() : '') || [c, d].filter(String).join(' - ');
    if (!f) continue;
    const alvo = nk_(f);
    [f, c, d].forEach(function (x) { const k = nk_(x); if (k && !(k in idx)) idx[k] = alvo; });
  }
  return idx;
}

/** Chave do centro de custo de um texto qualquer (código, nome ou "código - nome"). */
function chaveCC_(texto, idx) {
  const t = String(texto || '').trim();
  if (!t) return '';
  if (idx[nk_(t)]) return idx[nk_(t)];
  const m = t.match(/^([0-9][0-9.\-\/]*)/);
  if (m && idx[nk_(m[1])]) return idx[nk_(m[1])];
  const desc = t.replace(/^[0-9][0-9.\-\/]*\s*[-–—:|]?\s*/, '');
  if (desc && idx[nk_(desc)]) return idx[nk_(desc)];
  return nk_(t);
}

function lerTabela_(ss, nome) {
  const sh = getAba_(ss, nome, false);
  if (!sh || sh.getLastRow() < 2) return sh ? [] : null;
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues()
    .map(function (l) { return [String(l[0]).trim(), String(l[1]).trim()]; })
    .filter(function (l) { return l[0] && l[1]; });
}

/**
 * O que o e-mail de quem abriu pode ver.
 * { restrito:false } quando não há aba "Acessos" ou a pessoa tem o setor TODOS.
 */
function permissao_(ss, email) {
  const acessos = lerTabela_(ss, CONFIG.ABA_ACESSOS);
  if (acessos === null) return { restrito: false };
  const dono = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const eu = String(email || '').toLowerCase();
  if (eu && eu === dono) return { restrito: false, setores: [CONFIG.SETOR_TOTAL] };
  const setores = acessos.filter(function (l) { return l[0].toLowerCase() === eu; }).map(function (l) { return l[1]; });
  if (setores.some(function (st) { return nk_(st) === nk_(CONFIG.SETOR_TOTAL); })) return { restrito: false, setores: [CONFIG.SETOR_TOTAL] };
  const idx = indiceCC_(ss);
  const quer = {};
  setores.forEach(function (st) { quer[nk_(st)] = true; });
  const ccs = {};
  (lerTabela_(ss, CONFIG.ABA_SETORES) || []).forEach(function (l) {
    if (quer[nk_(l[0])]) { const k = chaveCC_(l[1], idx); if (k) ccs[k] = true; }
  });
  return { restrito: true, setores: setores, ccs: ccs, idx: idx, semAcesso: !Object.keys(ccs).length };
}

/** Cria as abas "Setores" e "Acessos" (se ainda não existirem). O dono entra com acesso TODOS. */
function prepararAcessos() {
  const ss = getSS_();
  const cria = function (nome, cab, linhas) {
    if (getAba_(ss, nome, false)) return false;
    const sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, 2).setValues([cab]).setFontWeight('bold').setBackground('#0A0F14').setFontColor('#ffffff');
    if (linhas.length) sh.getRange(2, 1, linhas.length, 2).setValues(linhas);
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, 2, 320);
    return true;
  };
  const dono = Session.getEffectiveUser().getEmail() || '';
  const a = cria(CONFIG.ABA_SETORES, ['Setor', 'Centro de Custo'], []);
  const b = cria(CONFIG.ABA_ACESSOS, ['E-mail', 'Setor'], dono ? [[dono, CONFIG.SETOR_TOTAL]] : []);
  const msg = (a || b) ? 'Abas criadas. Preencha "' + CONFIG.ABA_SETORES + '" (Setor | Centro de Custo) e "' +
    CONFIG.ABA_ACESSOS + '" (E-mail | Setor). Use o setor TODOS para quem pode ver tudo.' : 'As abas já existiam.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/** Chamado pelo painel ao abrir e no botão "Atualizar". */
function carregarDados() {
  const ss = getSS_();
  const tz = ss.getSpreadsheetTimeZone();
  const email = Session.getActiveUser().getEmail() || '';
  const geradoEm = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm');
  const ac = permissao_(ss, email);
  if (ac.restrito && ac.semAcesso) return { semAcesso: true, usuario: email, geradoEm: geradoEm };
  const filtro = ac.restrito ? {
    orc: function (v) { return ac.ccs[chaveCC_(v.cc, ac.idx)]; },
    fluxo: function (v) { return ac.ccs[chaveCC_(v.cc, ac.idx)]; },
    real: function (v) { return ac.ccs[chaveCC_(v.ccFull || [v.ccCod, v.ccDesc].filter(String).join(' - '), ac.idx)]; }
  } : {};
  return {
    geradoEm: geradoEm,
    usuario: email,
    acesso: { restrito: ac.restrito, setores: ac.setores || [] },
    planilha: ss.getName(),
    urlPlanilha: ac.restrito ? '' : ss.getUrl(),
    cfg: {
      ATENCAO: CONFIG.ATENCAO, ESTOURO: CONFIG.ESTOURO,
      REALIZADO_SOMA_SEMANA: CONFIG.REALIZADO_SOMA_SEMANA, EMPRESA: CONFIG.EMPRESA,
      PROJETADO_SO_EM_ABERTO: CONFIG.PROJETADO_SO_EM_ABERTO
    },
    abas: { orc: lerAba_(ss, 'orc', tz, filtro.orc), real: lerAba_(ss, 'real', tz, filtro.real), fluxo: lerAba_(ss, 'fluxo', tz, filtro.fluxo) }
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

/* ------------------------------------------------------------------ */
/* Diagnóstico — rode pelo editor para conferir se tudo foi encontrado */
/* ------------------------------------------------------------------ */

function diagnosticar() {
  const d = carregarDados();
  if (d.semAcesso) { Logger.log('O e-mail ' + d.usuario + ' não tem nenhum centro de custo liberado na aba "' + CONFIG.ABA_ACESSOS + '".'); return; }
  Logger.log('Planilha: ' + d.planilha);
  Object.keys(d.abas).forEach(function (id) {
    const a = d.abas[id];
    Logger.log('— Aba "' + a.aba + '": ' + (a.erro || ('cabeçalho na linha ' + a.linhaCab + ', ' +
      a.linhas.length + ' linhas com dados' + (a.sinal === -1 ? ', valores negativos (sinal invertido no painel)' : ''))));
    if (a.faltando.length) Logger.log('   Colunas NÃO encontradas: ' + a.faltando.join(' | '));
  });
  verificarSetores_(getSS_());
}

/** Lista os centros de custo da aba "Setores" que não aparecem em nenhuma das três abas (grafia diferente). */
function verificarSetores_(ss) {
  const setores = lerTabela_(ss, CONFIG.ABA_SETORES);
  const acessos = lerTabela_(ss, CONFIG.ABA_ACESSOS);
  if (acessos === null) { Logger.log('Controle de acesso: desligado (não existe a aba "' + CONFIG.ABA_ACESSOS + '").'); return; }
  Logger.log('Controle de acesso: ligado. ' + acessos.length + ' liberações na aba "' + CONFIG.ABA_ACESSOS + '".');
  const idx = indiceCC_(ss), tz = ss.getSpreadsheetTimeZone();
  const existe = {};
  Object.keys(idx).forEach(function (k) { existe[idx[k]] = true; });
  ['orc', 'fluxo'].forEach(function (id) {
    lerAba_(ss, id, tz, function (v) { existe[chaveCC_(v.cc, idx)] = true; return false; });
  });
  const faltam = (setores || []).filter(function (l) { return !existe[chaveCC_(l[1], idx)]; });
  if (faltam.length) Logger.log('Centros de custo da aba "' + CONFIG.ABA_SETORES + '" que NÃO foram encontrados nos dados: ' +
    faltam.map(function (l) { return l[0] + ' → ' + l[1]; }).join(' | '));
  else Logger.log('Todos os centros de custo da aba "' + CONFIG.ABA_SETORES + '" foram encontrados nos dados.');
}
