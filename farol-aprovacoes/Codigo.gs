/**
 * FAROL DE APROVAÇÕES — requisições do MXM (Pagamentos e Adiantamentos)
 *
 * Fontes (uma aba por tipo, ver CONFIG.RELATORIOS), com o export do MXM colado
 * como veio (linha 1 com "Data: dd/mm/aaaa Hora: hh:mm:ss", cabeçalho logo abaixo).
 *
 * Como o painel decide "com quem está":
 *   - Cada requisição tem uma linha por nível de aprovação (e por rateio).
 *   - Nível já aprovado = linha com data na coluna "Aprovação".
 *   - A ordem dos níveis é aprendida do próprio relatório: nas requisições já
 *     aprovadas, a data de cada aprovação mostra quem aprova antes de quem
 *     (também por transitividade: se A vem antes de B e B antes de C, A vem
 *     antes de C). Sem nenhum histórico entre dois níveis, vale a ordem das
 *     linhas do relatório.
 *   - Cada tipo de relatório tem seu mapa de colunas (LAYOUTS), porque o MXM
 *     usa nomes diferentes em Pagamentos e em Adiantamentos.
 *   - Aprovador atual = primeiro nível, nessa ordem, ainda sem aprovação.
 *
 * Prazo: dias úteis até a Prog. Pagto, sem fins de semana e sem feriados
 * nacionais. Feriados locais podem ser listados numa aba "Feriados" (coluna A).
 */

const CONFIG = {
  // Uma aba por tipo de requisição. "ordem" define como achar com quem está:
  //   'historico' = ordem aprendida das aprovações já feitas no próprio relatório;
  //   'relatorio' = ordem das linhas do relatório.
  RELATORIOS: {
    pagamentos: { aba: 'Relatório de Aprovações - Pagamentos', ordem: 'historico' },
    adiantamentos: { aba: 'Relatório de Aprovações - Adiantamentos', ordem: 'historico' }
  },
  FERIADOS_SHEET: 'Feriados',
  HTML_FILE: 'Farol',

  STATUS_PENDENTE: 'Em Aprovação',

  // Carnaval (segunda e terça) e Corpus Christi são ponto facultativo.
  // Deixe true se a empresa não trabalha nesses dias.
  CONTAR_CARNAVAL_COMO_FERIADO: true,
  CONTAR_CORPUS_CHRISTI_COMO_FERIADO: true,

  // Faixas do farol, em dias úteis até a Prog. Pagto.
  FAIXAS: [
    { id: 'critico', ate: 3, rotulo: 'Até 3 dias' },
    { id: 'alto', ate: 6, rotulo: '4 a 6 dias' },
    { id: 'medio', ate: 10, rotulo: '7 a 10 dias' },
    { id: 'ok', ate: Infinity, rotulo: 'Acima de 10 dias' }
  ],

  // Link público da imagem do logo (PNG/SVG). Vazio = usa o texto "SolarGrid".
  LOGO_URL: '',

  HEADER_SCAN_ROWS: 15
};

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Farol de Aprovações')
    .addItem('Abrir farol', 'abrirFarol')
    .addToUi();
}

function abrirFarol() {
  const html = buildTemplate_().evaluate().setWidth(1400).setHeight(860);
  SpreadsheetApp.getUi().showModalDialog(html, 'Farol de Aprovações');
}

/** Para abrir por link: Implantar > Nova implantação > App da Web. */
function doGet() {
  return buildTemplate_().evaluate()
    .setTitle('Farol de Aprovações | SolarGrid')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function buildTemplate_() {
  const t = HtmlService.createTemplateFromFile(CONFIG.HTML_FILE);
  t.logoUrl = CONFIG.LOGO_URL;
  // O que já estiver em cache vai junto com a página (abre sem esperar).
  const iniciais = [];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(CONFIG.RELATORIOS).forEach(function (tipo) {
      const sheet = getSheet_(ss, CONFIG.RELATORIOS[tipo].aba);
      const json = sheet ? lerCache_(chaveCache_(sheet, tipo)) : null;
      if (json) iniciais.push(JSON.stringify(tipo) + ':' + json);
    });
  } catch (e) { iniciais.length = 0; }
  t.dadosJson = ('{' + iniciais.join(',') + '}').replace(/</g, '\\u003c');
  return t;
}

/** Chamado pelo HTML. Usa o cache quando o relatório não mudou. */
function getFarol(tipo, forcar) {
  if (typeof tipo === 'boolean' || tipo === undefined) { forcar = tipo; tipo = 'pagamentos'; }
  return JSON.parse(getFarolJson_(tipo, forcar));
}

function getFarolJson_(tipo, forcar) {
  const rel = CONFIG.RELATORIOS[tipo];
  if (!rel) throw new Error('Tipo de relatório desconhecido: ' + tipo);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, rel.aba);
  if (!sheet) {
    throw new Error('Não encontrei a aba "' + rel.aba + '". Abas disponíveis: ' +
      ss.getSheets().map(function (s) { return s.getName(); }).join(' | '));
  }
  if (sheet.getLastRow() < 2) {
    return JSON.stringify({ vazio: true, aba: rel.aba, hoje: hojeSP_() });
  }
  const chave = chaveCache_(sheet, tipo);
  if (!forcar) {
    const emCache = lerCache_(chave);
    if (emCache) return emCache;
  }
  FUSO_PLANILHA_ = ss.getSpreadsheetTimeZone();
  const data = sheet.getDataRange().getValues();
  const feriados = lerFeriadosExtras_(ss);
  const json = JSON.stringify(processarRelatorio_(data, hojeSP_(), feriados, { ordem: rel.ordem, aba: rel.aba, layout: tipo }));
  gravarCache_(chave, json);
  return json;
}

function tipoDaAba_(nome) {
  const alvo = norm_(nome);
  return Object.keys(CONFIG.RELATORIOS).filter(function (t) { return norm_(CONFIG.RELATORIOS[t].aba) === alvo; })[0] || null;
}

/**
 * Gatilho simples: ao colar um relatório novo na aba, já processa e guarda no
 * cache, para o farol abrir rápido depois.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const tipo = tipoDaAba_(e.range.getSheet().getName());
    if (tipo) getFarolJson_(tipo, true);
  } catch (err) { /* o farol processa ao abrir */ }
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

const CACHE_VERSAO = 'v7';

// Fuso da planilha; definido antes de processar (vazio nos testes fora do Apps Script).
let FUSO_PLANILHA_ = '';
const CACHE_TTL = 21600;       // 6 h (máximo do CacheService)
const CACHE_PEDACO = 30000;    // caracteres por chave (limite de 100 KB por valor)

/** Muda quando o relatório muda (linha 1 do MXM, tamanho da aba) ou o dia vira. */
function chaveCache_(sheet, tipo) {
  const a1 = txt_(sheet.getRange(1, 1).getDisplayValue());
  const assinatura = [CACHE_VERSAO, tipo, CONFIG.RELATORIOS[tipo].ordem, hojeSP_(), sheet.getLastRow(), sheet.getLastColumn(), a1].join('|');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, assinatura, Utilities.Charset.UTF_8);
  return 'farol_' + bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function lerCache_(chave) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(chave + '_n'));
  if (!n) return null;
  const chaves = [];
  for (let i = 0; i < n; i++) chaves.push(chave + '_' + i);
  const partes = cache.getAll(chaves);
  let json = '';
  for (let i = 0; i < n; i++) {
    if (partes[chaves[i]] === undefined || partes[chaves[i]] === null) return null;
    json += partes[chaves[i]];
  }
  return json;
}

function gravarCache_(chave, json) {
  try {
    const valores = {};
    let n = 0;
    for (let i = 0; i < json.length; i += CACHE_PEDACO) valores[chave + '_' + (n++)] = json.slice(i, i + CACHE_PEDACO);
    valores[chave + '_n'] = String(n);
    CacheService.getScriptCache().putAll(valores, CACHE_TTL);
  } catch (e) { /* sem cache: o farol só demora mais para abrir */ }
}

/** Rode pelo editor (Executar) para conferir a leitura em Ver > Registros de execução. */
function diagnosticar() {
  Object.keys(CONFIG.RELATORIOS).forEach(function (tipo) {
    Logger.log('===== ' + CONFIG.RELATORIOS[tipo].aba + ' =====');
    try { diagnosticarTipo_(tipo); } catch (e) { Logger.log('ERRO: ' + e.message); }
  });
}

function diagnosticarTipo_(tipo) {
  const r = getFarol(tipo, true);
  if (r.vazio) { Logger.log('Aba vazia.'); return; }
  Logger.log('Atualização do relatório: ' + (r.atualizacao || '(não encontrada na linha 1)'));
  Logger.log('Linhas lidas: ' + r.diag.linhas + ' | requisições: ' + r.diag.requisicoes);
  Logger.log('Status encontrados: ' + JSON.stringify(r.diag.status));
  Logger.log('Em aprovação: ' + r.requisicoes.length + ' | valor: ' + r.diag.valorTotal.toFixed(2));
  Logger.log('Pares de níveis aprendidos do histórico: ' + r.diag.paresAprendidos);
  Logger.log('Requisições em que o histórico corrigiu a ordem do relatório: ' + r.diag.ordemCorrigida.join(', '));
  if (r.diag.faltando.length) Logger.log('COLUNAS NÃO ENCONTRADAS: ' + r.diag.faltando.join(', '));
}

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function norm_(str) {
  return String(str === null || str === undefined ? '' : str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function txt_(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function num_(v) {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = txt_(v).replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const n = s.indexOf(',') !== -1 ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function getSheet_(ss, nome) {
  const sheet = ss.getSheetByName(nome);
  if (sheet) return sheet;
  const alvo = norm_(nome);
  return ss.getSheets().filter(function (s) { return norm_(s.getName()) === alvo; })[0] || null;
}

/**
 * Aceita Date, número de série do Sheets, "dd/mm/aaaa[ hh:mm[:ss]]" ou "aaaa-mm-dd...".
 * Retorna Date ou null.
 */
function parseData_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    // Lê a data exatamente como aparece na planilha (fuso da planilha), para
    // não virar o dia anterior se o fuso do script for outro.
    if (!FUSO_PLANILHA_) return v;
    v = Utilities.formatDate(v, FUSO_PLANILHA_, 'yyyy-MM-dd HH:mm:ss');
  }
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000) + new Date(0).getTimezoneOffset() * 60000);
  const s = txt_(v);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(ano, Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  return null;
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

/** Date -> "aaaa-mm-dd" (dia de calendário, sem fuso). */
function iso_(d) {
  return d ? d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate()) : '';
}

function isoHora_(d) {
  return d ? iso_(d) + ' ' + pad2_(d.getHours()) + ':' + pad2_(d.getMinutes()) : '';
}

function hojeSP_() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
}

/* ------------------------------------------------------------------ */
/* Dias úteis                                                          */
/* ------------------------------------------------------------------ */

function pascoa_(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function feriadosNacionais_(ano) {
  const fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']
    .map(function (md) { return ano + '-' + md; });
  const p = pascoa_(ano);
  const desloc = function (dias) { return new Date(p.getTime() + dias * 86400000).toISOString().slice(0, 10); };
  fixos.push(desloc(-2)); // Sexta-feira Santa
  if (CONFIG.CONTAR_CARNAVAL_COMO_FERIADO) { fixos.push(desloc(-48)); fixos.push(desloc(-47)); }
  if (CONFIG.CONTAR_CORPUS_CHRISTI_COMO_FERIADO) fixos.push(desloc(60));
  return fixos;
}

function lerFeriadosExtras_(ss) {
  FUSO_PLANILHA_ = FUSO_PLANILHA_ || ss.getSpreadsheetTimeZone();
  const sh = getSheet_(ss, CONFIG.FERIADOS_SHEET);
  if (!sh || sh.getLastRow() === 0) return [];
  return sh.getRange(1, 1, sh.getLastRow(), 1).getValues()
    .map(function (r) { return iso_(parseData_(r[0])); })
    .filter(Boolean);
}

/**
 * Cria a função de contagem: dias úteis de hoje até a data alvo.
 * Futuro: úteis em (hoje, alvo]. Passado: negativo, úteis em (alvo, hoje].
 */
function criarContadorDiasUteis_(feriadosExtras) {
  const feriados = {};
  (feriadosExtras || []).forEach(function (d) { feriados[d] = true; });
  const anosCarregados = {};
  const ehUtil = function (t) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) return false;
    const ano = d.getUTCFullYear();
    if (!anosCarregados[ano]) {
      feriadosNacionais_(ano).forEach(function (f) { feriados[f] = true; });
      anosCarregados[ano] = true;
    }
    return !feriados[d.toISOString().slice(0, 10)];
  };
  const toUTC = function (isoStr) {
    const p = isoStr.split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  };
  return function (hojeIso, alvoIso) {
    if (!alvoIso) return null;
    let a = toUTC(hojeIso), b = toUTC(alvoIso);
    if (a === b) return 0;
    const sinal = b > a ? 1 : -1;
    if (sinal < 0) { const t = a; a = b; b = t; }
    let n = 0;
    for (let t = a + 86400000; t <= b; t += 86400000) if (ehUtil(t)) n++;
    return sinal * n;
  };
}

/* ------------------------------------------------------------------ */
/* Leitura do relatório                                                */
/* ------------------------------------------------------------------ */

// Mapa de colunas de cada relatório do MXM. Cada campo aceita uma lista de
// nomes: quando o MXM renomeia uma coluna, o nome novo vem primeiro e o antigo
// continua aceito. A ordem das colunas no relatório não importa.
const LAYOUTS = {
  pagamentos: {
    colunas: {
      req: { nomes: ['Número Req. Pagto', 'Req.Pagto'], obrigatoria: true },
      status: { nomes: ['St.Requisição'], obrigatoria: true },
      empresa: { nomes: ['Cd.Empresa'] },
      centroCusto: { nomes: ['Centro de Custo'] },
      valorTitulo: { nomes: ['Líquido - Títulos'], obrigatoria: true },
      numeroTitulo: { nomes: ['Número do Título'] },
      cdCat: { nomes: ['Cd.Cat.Func.'], obrigatoria: true },
      descCat: { nomes: ['Desc.Cat.Func.'] },
      cdEst: { nomes: ['Cd.Est.Func.'], obrigatoria: true },
      descEst: { nomes: ['Desc.Est.Func.'] },
      progPagto: { nomes: ['Data Prog.Pagto.', 'Prog.Pagto.'], obrigatoria: true },
      requisitante: { nomes: ['Requisitante'] },
      projeto: { nomes: ['Projeto'] },
      dataRequisicao: { nomes: ['Data Requisição', 'Requisição'] },
      tipo: { nomes: ['Tip. Requisição'] },
      setor: { nomes: ['Setor'] },
      vencimento: { nomes: ['Data Vencimento'] },
      aprovadorAlocado: { nomes: ['Aprovador alocado'], obrigatoria: true },
      aprovador: { nomes: ['Aprovador'] },
      fornecedor: { nomes: ['Fornecedor'] },
      dataAprovacao: { nomes: ['Data Aprovação'] }   // se não houver, usa a 2ª "Aprovação"
    },
    rotuloTitulo: 'Título',
    extras: [],
    // Colunas do Excel por aprovador (pedido do CSC), na ordem do relatório.
    arquivo: [
      { campo: 'empresa' }, { campo: 'status' }, { campo: 'centroCusto' }, { campo: 'numeroTitulo', tipo: 'num' },
      { campo: 'req', tipo: 'num' }, { nomes: ['Valor líquido - Apr'], tipo: 'valor' }, { campo: 'projeto' },
      { campo: 'setor' }, { campo: 'vencimento', tipo: 'data' }, { nomes: ['Fora do Prazo'] },
      { campo: 'aprovadorAlocado' }, { campo: 'fornecedor' }
    ]
  },

  adiantamentos: {
    colunas: {
      req: { nomes: ['Número Requisição'], obrigatoria: true },
      status: { nomes: ['Status'], obrigatoria: true },
      empresa: { nomes: ['Cd.Empresa'] },
      centroCusto: { nomes: ['Centro de Custo'] },
      valorTitulo: { nomes: ['Valor Adiantamento'], obrigatoria: true },
      numeroTitulo: { nomes: ['Doc. Antecipação'] },
      cdCat: { nomes: ['Cd.Cat.Func.'], obrigatoria: true },
      descCat: { nomes: ['Categoria Funcional'] },
      cdEst: { nomes: ['Cd.Est.Func.'], obrigatoria: true },
      descEst: { nomes: ['Estrutura Funcional'] },
      progPagto: { nomes: ['Data Prog. Pag.', 'Data Prog.Pagto.'], obrigatoria: true },
      requisitante: { nomes: ['Requisitante'] },
      projeto: { nomes: ['Código Projeto'] },
      dataRequisicao: { nomes: ['Data Requisição'] },
      tipo: { nomes: ['Tip. Requisição'] },
      cdSetor: { nomes: ['Cd.Setor', 'Cd. Setor'] },
      setor: { nomes: ['Descrição Setor'] },
      aprovadorAlocado: { nomes: ['Aprovador Alocado'], obrigatoria: true },
      aprovador: { nomes: ['Aprovador'] },
      cdFornecedor: { nomes: ['Cd. Fornecedor'] },
      fornecedor: { nomes: ['Fornecedor'] },
      dataAprovacao: { nomes: ['Data Aprovação'], obrigatoria: true }
    },
    rotuloTitulo: 'Doc. Antecipação',
    extras: [
      { rotulo: 'Justificativa', nomes: ['Justificativa'] },
      { rotulo: 'Grupo de pagamento', nomes: ['Grupo de Pagamento'] }
    ],
    arquivo: [
      { campo: 'empresa' }, { campo: 'status' }, { campo: 'centroCusto' }, { campo: 'projeto' },
      { campo: 'numeroTitulo' }, { campo: 'req', tipo: 'num' }, { nomes: ['Vlr Grp. Antecipação'], tipo: 'valor' },
      { campo: 'valorTitulo', tipo: 'valor' }, { campo: 'setor' }, { campo: 'progPagto', tipo: 'data' },
      { campo: 'aprovadorAlocado' }, { campo: 'fornecedor' }, { nomes: ['Justificativa'] }
    ]
  }
};

function acharColuna_(cabecalhoNorm, nomes) {
  for (let i = 0; i < nomes.length; i++) {
    const idx = cabecalhoNorm.indexOf(norm_(nomes[i]));
    if (idx !== -1) return idx;
  }
  return -1;
}

function detectHeaderRow_(data, layout) {
  const limite = Math.min(data.length, CONFIG.HEADER_SCAN_ROWS);
  for (let r = 0; r < limite; r++) {
    const cels = data[r].map(norm_);
    if (acharColuna_(cels, layout.colunas.req.nomes) !== -1 && acharColuna_(cels, layout.colunas.status.nomes) !== -1) return r;
  }
  return -1;
}

function mapColunas_(headerRow, layout) {
  const h = headerRow.map(norm_);
  const faltando = [];
  const col = {};
  Object.keys(layout.colunas).forEach(function (campo) {
    const def = layout.colunas[campo];
    col[campo] = acharColuna_(h, def.nomes);
    if (col[campo] === -1 && def.obrigatoria) faltando.push(def.nomes.join(' ou '));
  });
  // Pagamentos: "Aprovação" aparece duas vezes; a que tem a data vem depois
  // de "Aprovador alocado".
  if (col.dataAprovacao === -1) {
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i] === 'aprovacao' && (col.aprovadorAlocado === -1 || i > col.aprovadorAlocado)) { col.dataAprovacao = i; break; }
    }
    if (col.dataAprovacao === -1) faltando.push('Aprovação (data)');
  }
  const extras = layout.extras.map(function (x) { return { rotulo: x.rotulo, idx: acharColuna_(h, x.nomes) }; })
    .filter(function (x) { return x.idx !== -1; });
  const arquivo = layout.arquivo.map(function (a) {
    const idx = a.campo ? col[a.campo] : acharColuna_(h, a.nomes);
    const nome = idx !== -1 ? txt_(headerRow[idx]) : (a.campo ? layout.colunas[a.campo].nomes[0] : a.nomes[0]);
    return { idx: idx, nome: nome, tipo: a.tipo || 'texto' };
  });
  return { col: col, faltando: faltando, extras: extras, arquivo: arquivo };
}

/** "código  -  nome", como o relatório de Pagamentos já traz (sem repetir o código). */
function juntar_(codigo, nome) {
  const c = txt_(codigo), n = txt_(nome);
  if (!c || n.indexOf(c) === 0) return n;
  return n ? c + '  -  ' + n : c;
}

/** Tira o código do começo da descrição ("0023 - DIRETORIA" -> "DIRETORIA"). */
function semCodigo_(desc, codigo) {
  const d = txt_(desc);
  const c = txt_(codigo);
  if (c && d.indexOf(c) === 0) return d.slice(c.length).replace(/^\s*-\s*/, '');
  return d;
}

function lerAtualizacao_(data, headerRow) {
  for (let r = 0; r < headerRow; r++) {
    const s = data[r].map(txt_).join(' ');
    const m = s.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})\s*Hora:\s*(\d{2}:\d{2})/i);
    if (m) return m[1] + ' ' + m[2];
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Processamento                                                       */
/* ------------------------------------------------------------------ */

/**
 * Função pura (sem SpreadsheetApp): recebe a matriz da aba, a data de hoje
 * ("aaaa-mm-dd") e feriados extras; devolve o que o HTML precisa.
 */
function processarRelatorio_(data, hojeIso, feriadosExtras, opcoes) {
  opcoes = opcoes || {};
  const ordemHistorico = (opcoes.ordem || 'historico') === 'historico';
  const layout = LAYOUTS[opcoes.layout || 'pagamentos'];
  const headerRow = detectHeaderRow_(data, layout);
  if (headerRow === -1) {
    throw new Error('Não encontrei o cabeçalho do relatório (colunas "' + layout.colunas.req.nomes.join('" ou "') + '" e "' +
      layout.colunas.status.nomes.join('" ou "') + '") nas primeiras ' + CONFIG.HEADER_SCAN_ROWS + ' linhas da aba "' + (opcoes.aba || '') + '".');
  }
  const mapa = mapColunas_(data[headerRow], layout);
  const col = mapa.col;
  if (mapa.faltando.length) throw new Error('Colunas não encontradas no relatório: ' + mapa.faltando.join(', '));
  const cel = function (row, idx) { return idx === -1 || idx === undefined ? '' : row[idx]; };

  const reqs = {};
  const ordemReqs = [];
  const contagemStatus = {};
  let linhas = 0;

  for (let r = headerRow + 1; r < data.length; r++) {
    const row = data[r];
    const id = txt_(cel(row, col.req));
    if (!id) continue;
    linhas++;
    const status = txt_(cel(row, col.status));
    contagemStatus[status] = (contagemStatus[status] || 0) + 1;

    let q = reqs[id];
    if (!q) {
      q = reqs[id] = {
        id: id, status: status, niveis: {}, ordem: [], titulos: {},
        empresa: txt_(cel(row, col.empresa)),
        fornecedor: juntar_(cel(row, col.cdFornecedor), cel(row, col.fornecedor)),
        setor: juntar_(cel(row, col.cdSetor), cel(row, col.setor)),
        extras: mapa.extras.map(function (x) { return [x.rotulo, txt_(cel(row, x.idx))]; })
          .filter(function (x) { return x[1]; }),
        requisitante: txt_(cel(row, col.requisitante)),
        tipo: txt_(cel(row, col.tipo)),
        dataRequisicao: parseData_(cel(row, col.dataRequisicao)),
        vencimento: parseData_(cel(row, col.vencimento)),
        progPagto: null, centros: [], projetos: []
      };
      ordemReqs.push(id);
    }

    const prog = parseData_(cel(row, col.progPagto));
    if (prog && (!q.progPagto || prog < q.progPagto)) q.progPagto = prog;
    const cc = txt_(cel(row, col.centroCusto));
    if (cc && q.centros.indexOf(cc) === -1) q.centros.push(cc);
    const pj = txt_(cel(row, col.projeto));
    if (pj && q.projetos.indexOf(pj) === -1) q.projetos.push(pj);
    const tit = txt_(cel(row, col.numeroTitulo)) || '-';
    if (!(tit in q.titulos)) q.titulos[tit] = num_(cel(row, col.valorTitulo));

    const cdCat = txt_(cel(row, col.cdCat));
    const cdEst = txt_(cel(row, col.cdEst));
    if (!cdCat && !cdEst) continue;
    const chave = cdCat ? 'CAT ' + cdCat : 'EST ' + cdEst;
    let nv = q.niveis[chave];
    if (!nv) {
      nv = q.niveis[chave] = {
        chave: chave,
        tipo: cdCat ? 'categoria' : 'estrutura',
        cargo: cdCat ? (semCodigo_(cel(row, col.descCat), cdCat) || semCodigo_(cel(row, col.descEst), cdEst))
                     : semCodigo_(cel(row, col.descEst), cdEst),
        alocado: '', aprovador: '', data: null, linhas: 0, aprovadas: 0, idx: []
      };
      q.ordem.push(chave);
    }
    nv.linhas++;
    nv.idx.push(r);
    if (!nv.alocado) nv.alocado = txt_(cel(row, col.aprovadorAlocado));
    const dt = parseData_(cel(row, col.dataAprovacao));
    if (dt) {
      nv.aprovadas++;
      if (!nv.data || dt < nv.data) nv.data = dt;
      if (!nv.aprovador) nv.aprovador = txt_(cel(row, col.aprovador));
    }
  }

  // Aprende a precedência entre níveis pelas datas de aprovação do histórico,
  // e quem costuma aprovar cada nível (para níveis sem aprovador alocado).
  const prec = {};
  const usual = {};
  let paresAprendidos = 0;
  ordemReqs.forEach(function (id) {
    const q = reqs[id];
    const feitos = q.ordem.map(function (k) { return q.niveis[k]; }).filter(function (n) { return n.data; });
    feitos.forEach(function (n) {
      const quem = n.alocado || n.aprovador;
      if (!quem) return;
      usual[n.chave] = usual[n.chave] || {};
      usual[n.chave][quem] = (usual[n.chave][quem] || 0) + 1;
    });
    for (let i = 0; i < feitos.length; i++) {
      for (let j = 0; j < feitos.length; j++) {
        if (i === j || feitos[i].data.getTime() >= feitos[j].data.getTime()) continue;
        const k = feitos[i].chave + '>' + feitos[j].chave;
        if (!prec[k]) paresAprendidos++;
        prec[k] = (prec[k] || 0) + 1;
      }
    }
  });
  // a vem antes de b: pela maioria das vezes em que aparecem juntos; se nunca
  // apareceram juntos, por transitividade (a antes de x, x antes de b...).
  const depois = {};
  Object.keys(prec).forEach(function (k) {
    const p = k.split('>');
    if ((prec[k] || 0) > (prec[p[1] + '>' + p[0]] || 0)) (depois[p[0]] = depois[p[0]] || []).push(p[1]);
  });
  const alcancaMemo = {};
  const alcanca = function (a, b) {
    const k = a + '>' + b;
    if (k in alcancaMemo) return alcancaMemo[k];
    const visto = {}; const fila = [a]; let achou = false;
    while (fila.length && !achou) {
      const x = fila.shift();
      (depois[x] || []).forEach(function (y) { if (y === b) achou = true; if (!visto[y]) { visto[y] = true; fila.push(y); } });
    }
    return (alcancaMemo[k] = achou);
  };
  const antes = function (a, b) {
    const ab = prec[a + '>' + b] || 0, ba = prec[b + '>' + a] || 0;
    if (ab || ba) return ab > ba;
    return alcanca(a, b) && !alcanca(b, a);
  };
  const ordenar = function (chaves) {
    const resto = chaves.slice();
    const out = [];
    while (resto.length) {
      let idx = 0;
      for (let i = 0; i < resto.length; i++) {
        const livre = resto.every(function (o) { return o === resto[i] || !antes(o, resto[i]); });
        if (livre) { idx = i; break; }
      }
      out.push(resto.splice(idx, 1)[0]);
    }
    return out;
  };
  const usualDe = function (chave) {
    const u = usual[chave];
    if (!u) return '';
    return Object.keys(u).sort(function (a, b) { return u[b] - u[a]; })[0];
  };

  const contarDias = criarContadorDiasUteis_(feriadosExtras);
  const alvoStatus = norm_(CONFIG.STATUS_PENDENTE);
  const ordemCorrigida = [];
  let valorTotal = 0;

  const saida = [];
  ordemReqs.forEach(function (id) {
    const q = reqs[id];
    if (norm_(q.status) !== alvoStatus) return;

    const aprovado = function (n) { return n.linhas > 0 && n.aprovadas === n.linhas; };
    const feitos = q.ordem.filter(function (k) { return aprovado(q.niveis[k]); })
      .sort(function (a, b) { return q.niveis[a].data - q.niveis[b].data; });
    const pendentesRelatorio = q.ordem.filter(function (k) { return !aprovado(q.niveis[k]); });
    const pendentes = ordemHistorico ? ordenar(pendentesRelatorio) : pendentesRelatorio;
    if (pendentes.length && pendentes[0] !== pendentesRelatorio[0]) ordemCorrigida.push(id);

    const etapas = feitos.concat(pendentes).map(function (k, i) {
      const n = q.niveis[k];
      const feito = aprovado(n);
      return {
        nivel: k.replace(/^(CAT|EST) /, ''),
        tipo: n.tipo,
        cargo: n.cargo,
        aprovador: feito ? (n.aprovador || n.alocado) : n.alocado,
        usual: !n.alocado ? usualDe(k) : '',
        data: feito ? isoHora_(n.data) : '',
        situacao: feito ? 'aprovado' : (i === feitos.length ? 'atual' : 'proximo')
      };
    });
    const atual = etapas[feitos.length] || null;

    // Linhas do relatório do nível atual (uma por rateio), para o arquivo do aprovador.
    const linhasAtual = !pendentes.length ? [] : q.niveis[pendentes[0]].idx.map(function (r) {
      const row = data[r];
      return mapa.arquivo.map(function (a) {
        const v = cel(row, a.idx);
        if (a.tipo === 'valor') return num_(v);
        if (a.tipo === 'data') return iso_(parseData_(v));
        return txt_(v);
      });
    });

    const valor = Object.keys(q.titulos).reduce(function (s, t) { return s + q.titulos[t]; }, 0);
    valorTotal += valor;
    const progIso = iso_(q.progPagto);
    const dias = contarDias(hojeIso, progIso);
    const faixa = dias === null ? null : CONFIG.FAIXAS.filter(function (f) { return dias <= f.ate; })[0].id;

    saida.push({
      id: id,
      empresa: q.empresa,
      fornecedor: q.fornecedor,
      setor: q.setor,
      requisitante: q.requisitante,
      tipo: q.tipo,
      extras: q.extras,
      centros: q.centros,
      projetos: q.projetos,
      titulos: Object.keys(q.titulos).filter(function (t) { return t !== '-'; }),
      valor: Math.round(valor * 100) / 100,
      dataRequisicao: iso_(q.dataRequisicao),
      vencimento: iso_(q.vencimento),
      progPagto: progIso,
      dias: dias,
      faixa: faixa,
      faltam: pendentes.length,
      totalNiveis: etapas.length,
      aprovadorAtual: atual ? (atual.aprovador || atual.cargo || atual.nivel) : '',
      cargoAtual: atual ? atual.cargo : '',
      atualSemNome: !!(atual && !atual.aprovador),
      usualAtual: atual ? atual.usual : '',
      etapas: etapas,
      linhasAtual: linhasAtual
    });
  });

  return {
    atualizacao: lerAtualizacao_(data, headerRow),
    ordem: ordemHistorico ? 'historico' : 'relatorio',
    nomeColunaReq: txt_(data[headerRow][col.req]),
    rotuloTitulo: layout.rotuloTitulo,
    arquivo: mapa.arquivo.map(function (a) { return { nome: a.nome, tipo: a.tipo }; }),
    hoje: hojeIso,
    faixas: CONFIG.FAIXAS.map(function (f) { return { id: f.id, rotulo: f.rotulo, ate: f.ate === Infinity ? null : f.ate }; }),
    requisicoes: saida,
    diag: {
      linhas: linhas,
      requisicoes: ordemReqs.length,
      status: contagemStatus,
      valorTotal: valorTotal,
      paresAprendidos: paresAprendidos,
      ordemCorrigida: ordemCorrigida,
      faltando: mapa.faltando
    }
  };
}
