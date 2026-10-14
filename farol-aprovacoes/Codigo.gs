/**
 * FAROL DE APROVAÇÕES — requisições de pagamento (MXM)
 *
 * Fonte: aba "Relatório de Aprovações", com o export do MXM colado como veio
 * (linha 1 com "Data: dd/mm/aaaa Hora: hh:mm:ss", cabeçalho logo abaixo).
 *
 * Como o painel decide "com quem está":
 *   - Cada requisição tem uma linha por nível de aprovação (e por rateio).
 *   - Nível já aprovado = linha com data na coluna "Aprovação".
 *   - A ordem dos níveis é aprendida do próprio relatório: nas requisições já
 *     aprovadas, a data de cada aprovação mostra quem aprova antes de quem.
 *     Quando um par de níveis nunca apareceu junto no histórico, vale a ordem
 *     das linhas do relatório.
 *   - Aprovador atual = primeiro nível, nessa ordem, ainda sem aprovação.
 *
 * Prazo: dias úteis até a Prog. Pagto, sem fins de semana e sem feriados
 * nacionais. Feriados locais podem ser listados numa aba "Feriados" (coluna A).
 */

const CONFIG = {
  SHEET_NAME: 'Relatório de Aprovações',
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
  // Se o resultado já estiver em cache, vai junto com a página (abre sem esperar).
  let json = 'null';
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(ss, CONFIG.SHEET_NAME);
    if (sheet) json = lerCache_(chaveCache_(sheet)) || 'null';
  } catch (e) { json = 'null'; }
  t.dadosJson = json.replace(/</g, '\\u003c');
  return t;
}

/** Chamado pelo HTML. Usa o cache quando o relatório não mudou. */
function getFarol(forcar) {
  return JSON.parse(getFarolJson_(forcar));
}

function getFarolJson_(forcar) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('Não encontrei a aba "' + CONFIG.SHEET_NAME + '". Abas disponíveis: ' +
      ss.getSheets().map(function (s) { return s.getName(); }).join(' | '));
  }
  const chave = chaveCache_(sheet);
  if (!forcar) {
    const emCache = lerCache_(chave);
    if (emCache) return emCache;
  }
  const data = sheet.getDataRange().getValues();
  const feriados = lerFeriadosExtras_(ss);
  const json = JSON.stringify(processarRelatorio_(data, hojeSP_(), feriados));
  gravarCache_(chave, json);
  return json;
}

/**
 * Gatilho simples: ao colar um relatório novo na aba, já processa e guarda no
 * cache, para o farol abrir rápido depois.
 */
function onEdit(e) {
  try {
    if (!e || !e.range || norm_(e.range.getSheet().getName()) !== norm_(CONFIG.SHEET_NAME)) return;
    getFarolJson_(true);
  } catch (err) { /* o farol processa ao abrir */ }
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

const CACHE_VERSAO = 'v2';
const CACHE_TTL = 21600;       // 6 h (máximo do CacheService)
const CACHE_PEDACO = 30000;    // caracteres por chave (limite de 100 KB por valor)

/** Muda quando o relatório muda (linha 1 do MXM, tamanho da aba) ou o dia vira. */
function chaveCache_(sheet) {
  const a1 = txt_(sheet.getRange(1, 1).getDisplayValue());
  const assinatura = [CACHE_VERSAO, hojeSP_(), sheet.getLastRow(), sheet.getLastColumn(), a1].join('|');
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
  const r = getFarol(true);
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
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
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

function detectHeaderRow_(data) {
  const limite = Math.min(data.length, CONFIG.HEADER_SCAN_ROWS);
  for (let r = 0; r < limite; r++) {
    const cels = data[r].map(norm_);
    if (cels.indexOf('reqpagto') !== -1 && cels.indexOf('strequisicao') !== -1) return r;
  }
  return -1;
}

function mapColunas_(headerRow) {
  const h = headerRow.map(norm_);
  const faltando = [];
  const find = function (nome, obrigatoria) {
    const idx = h.indexOf(norm_(nome));
    if (idx === -1 && obrigatoria) faltando.push(nome);
    return idx;
  };
  const col = {
    empresa: find('Cd.Empresa'),
    status: find('St.Requisição', true),
    centroCusto: find('Centro de Custo'),
    liquidoTitulos: find('Líquido - Títulos', true),
    numeroTitulo: find('Número do Título'),
    cdCat: find('Cd.Cat.Func.', true),
    progPagto: find('Prog.Pagto.', true),
    cdEst: find('Cd.Est.Func.', true),
    req: find('Req.Pagto', true),
    requisitante: find('Requisitante'),
    projeto: find('Projeto'),
    dataRequisicao: find('Requisição'),
    tipo: find('Tip. Requisição'),
    setor: find('Setor'),
    vencimento: find('Data Vencimento'),
    valorApr: find('Valor líquido - Apr'),
    foraPrazo: find('Fora do Prazo'),
    aprovadorAlocado: find('Aprovador alocado', true),
    aprovador: find('Aprovador'),
    fornecedor: find('Fornecedor'),
    descCat: find('Desc.Cat.Func.'),
    descEst: find('Desc.Est.Func.')
  };
  // "Aprovação" aparece duas vezes no export; a que tem a data é a que vem
  // depois de "Aprovador alocado".
  col.dataAprovacao = -1;
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i] === 'aprovacao' && (col.aprovadorAlocado === -1 || i > col.aprovadorAlocado)) { col.dataAprovacao = i; break; }
  }
  if (col.dataAprovacao === -1) faltando.push('Aprovação (data)');
  return { col: col, faltando: faltando };
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
function processarRelatorio_(data, hojeIso, feriadosExtras) {
  const headerRow = detectHeaderRow_(data);
  if (headerRow === -1) {
    throw new Error('Não encontrei o cabeçalho do relatório (colunas "Req.Pagto" e "St.Requisição") nas primeiras ' +
      CONFIG.HEADER_SCAN_ROWS + ' linhas da aba "' + CONFIG.SHEET_NAME + '".');
  }
  const mapa = mapColunas_(data[headerRow]);
  const col = mapa.col;
  if (mapa.faltando.length) throw new Error('Colunas não encontradas no relatório: ' + mapa.faltando.join(', '));
  const cel = function (row, idx) { return idx === -1 ? '' : row[idx]; };

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
        fornecedor: txt_(cel(row, col.fornecedor)),
        setor: txt_(cel(row, col.setor)),
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
    if (!(tit in q.titulos)) q.titulos[tit] = num_(cel(row, col.liquidoTitulos));

    const cdCat = txt_(cel(row, col.cdCat));
    const cdEst = txt_(cel(row, col.cdEst));
    if (!cdCat && !cdEst) continue;
    const chave = cdCat ? 'CAT ' + cdCat : 'EST ' + cdEst;
    let nv = q.niveis[chave];
    if (!nv) {
      nv = q.niveis[chave] = {
        chave: chave,
        tipo: cdCat ? 'categoria' : 'estrutura',
        cargo: txt_(cel(row, cdCat ? col.descCat : col.descEst)) || txt_(cel(row, col.descEst)),
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
  const antes = function (a, b) { return (prec[a + '>' + b] || 0) > (prec[b + '>' + a] || 0); };
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
    const pendentes = ordenar(pendentesRelatorio);
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
      return [
        txt_(cel(row, col.empresa)), txt_(cel(row, col.status)), txt_(cel(row, col.centroCusto)),
        txt_(cel(row, col.numeroTitulo)), id, num_(cel(row, col.valorApr)), txt_(cel(row, col.projeto)),
        txt_(cel(row, col.setor)), iso_(parseData_(cel(row, col.vencimento))), txt_(cel(row, col.foraPrazo)),
        txt_(cel(row, col.aprovadorAlocado)), txt_(cel(row, col.fornecedor))
      ];
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
