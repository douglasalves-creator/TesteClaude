/**
 * CONTROLE FINANCEIRO — Orçado × Projeções × Realizado, por Setor, Usina e Centro de Custo
 *
 * Cada setor tem uma aba no topo do painel (Supply, Projetos, EP e GA).
 * Fontes de dados:
 *   - Orçamento                    → ORÇADO     (cabeçalho na linha 1)
 *   - Projeções - <Setor>          → PROJEÇÃO ANTERIOR e PROJEÇÃO ATUAL (por "Data do Fluxo")
 *   - Realizado Controladoria      → REALIZADO  (Projeto e C. Custo só com o código)
 *
 * Usinas e centros de custo são ligados pelo CÓDIGO (ex.: usina "A0162-4", centro de custo "801"),
 * porque as descrições não são iguais em todas as abas. Os nomes mostrados vêm das abas
 * "Usinas" e "Setores / CCs".
 *
 * As colunas são encontradas pelo NOME do cabeçalho (a posição não importa).
 * Só as abas de Projeções podem ser alteradas pelo painel; Orçamento e Realizado
 * são imutáveis. Toda alteração fica registrada na aba "Auditoria".
 *
 * Controle de acesso (quando a aba "Acessos" existir):
 *   - Aba "Setores / CCs":  Setor | Centro de Custo   → quais centros de custo são de cada setor
 *                                                  (usado no Orçado, nas Projeções e no Realizado)
 *   - Aba "Acessos":  E-mail | Setor | Edita     → quais abas de setor cada pessoa vê
 *   - Setor "TODOS" libera tudo. O dono do script sempre vê e edita tudo.
 * O filtro é feito aqui no servidor: o que a pessoa não pode ver nem chega ao navegador.
 * Publique como App da Web com "Executar como: Eu" e NÃO compartilhe a planilha com
 * quem só pode ver o próprio setor.
 */

const CONFIG = {
  // Deixe '' para usar a planilha onde o script foi instalado (recomendado).
  PLANILHA_ID: '',

  // Nome do arquivo HTML dentro do projeto do Apps Script.
  HTML_FILE: 'Painel',

  EMPRESA: 'SolarGrid',

  // Abas de setor do painel, na ordem em que aparecem no topo.
  // "projecoes" = nome da aba de projeções daquele setor ('' = ainda em construção).
  SETORES: [
    { nome: 'Supply', projecoes: 'Projeções - Supply' },
    { nome: 'Projetos', projecoes: '' },
    { nome: 'EP', projecoes: '' },
    { nome: 'GA', projecoes: '' }
  ],

  ABA_ORCAMENTO: 'Orçamento',
  ABA_REALIZADO: 'Realizado Controladoria',
  // Lista de usinas (coluna A): dá o nome padrão de cada código de usina.
  ABA_USINAS: 'Usinas',

  // Toda alteração feita pelo painel é registrada nesta aba (criada se não existir).
  ABA_AUDITORIA: 'Auditoria',

  // Saídas sempre aparecem positivas no painel. Se uma aba guardar os pagamentos
  // como número negativo, o painel percebe sozinho e inverte o sinal na tela
  // (e desinverte ao gravar).
  AJUSTAR_SINAL: true,

  // Controle de acesso (ver explicação no topo do arquivo).
  ABA_ACESSOS: 'Acessos',
  ABA_SETORES: 'Setores / CCs',
  SETOR_TOTAL: 'TODOS',

  // Por quantos minutos os dados lidos ficam guardados (o painel abre bem mais rápido).
  // O botão "Atualizar" do painel sempre busca os dados novos. Use 0 para desligar.
  CACHE_MINUTOS: 10,

  LINHAS_PROCURA_CABECALHO: 15
};

/* Colunas usadas de cada tipo de aba. "nome" é o cabeçalho na planilha; "alias" são
 * outros nomes aceitos. tipo: texto | data | valor. dic: texto que se repete muito
 * (vai compactado). opcional: se não existir, o painel funciona sem ela. */
const CAMPOS = {
  orc: [
    { k: 'projeto', nome: 'PROJETO', tipo: 'texto', dic: true },
    { k: 'cc', nome: 'CENTRO DE CUSTO', tipo: 'texto', dic: true },
    { k: 'valor', nome: 'VALOR A PAGAR', tipo: 'valor' },
    { k: 'venc', nome: 'DATA DE VENCIMENTO', tipo: 'data', alias: ['VENCIMENTO'] }
  ],
  real: [
    { k: 'pagto', nome: 'Pagto.', tipo: 'data', alias: ['Pagto', 'Data Pagto', 'Data de Pagamento'] },
    { k: 'valor', nome: 'Pagamentos', tipo: 'valor' },
    // Há duas colunas "Projeto": a primeira (código da usina) é a usada.
    { k: 'projeto', nome: 'Projeto', tipo: 'texto', dic: true },
    { k: 'cc', nome: 'C. Custo', tipo: 'texto', dic: true, alias: ['Cod. Custo', 'C.Custo'] },
    { k: 'favorecido', nome: 'Favorecido', tipo: 'texto', dic: true, opcional: true, alias: ['Fornecedor'] },
    { k: 'doc', nome: 'Documento', tipo: 'texto', opcional: true },
    { k: 'obs', nome: 'Consolidado', tipo: 'texto', opcional: true }
  ],
  proj: [
    { k: 'projeto', nome: 'Projeto Padrão', tipo: 'texto', dic: true },
    { k: 'cc', nome: 'Centro de Custo Padrão', tipo: 'texto', dic: true },
    { k: 'valor', nome: 'Valor', tipo: 'valor' },
    { k: 'dataProg', nome: 'Data programada de pgto', tipo: 'data', alias: ['Data programada de pagamento', 'Data programada'] },
    { k: 'dataFluxo', nome: 'Data do Fluxo', tipo: 'data', dic: true },
    { k: 'fornecedor', nome: 'Fornecedor', tipo: 'texto', dic: true, opcional: true },
    { k: 'coment', nome: 'Comentário', tipo: 'texto', opcional: true, alias: ['Comentarios', 'Comentários'] }
  ]
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

/** Minúsculas, sem acento e só letras/números — para comparar nomes de colunas e abas. */
function chave_(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Mesma normalização do painel: minúsculas, sem acento, só letras/números separados por espaço. */
function nk_(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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

function letraColuna_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/* ------------------------------------------------------------------ */
/* Abas lidas                                                          */
/* ------------------------------------------------------------------ */

/** Código interno da aba de projeções de um setor (ex.: "p_supply"). */
function idProj_(setor) { return 'p_' + nk_(setor).replace(/ /g, '_'); }

/** Definição de uma aba lida: nome na planilha, colunas e se pode ser editada. */
function defAba_(id) {
  if (id === 'orc') return { id: id, nome: CONFIG.ABA_ORCAMENTO, campos: CAMPOS.orc, editavel: false };
  if (id === 'real') return { id: id, nome: CONFIG.ABA_REALIZADO, campos: CAMPOS.real, editavel: false };
  const st = CONFIG.SETORES.filter(function (s) { return s.projecoes && idProj_(s.nome) === id; })[0];
  if (!st) return null;
  return { id: id, nome: st.projecoes, campos: CAMPOS.proj, editavel: true, setor: st.nome };
}

/** Todas as abas que o painel lê. */
function idsAbas_() {
  return ['orc', 'real'].concat(CONFIG.SETORES.filter(function (s) { return s.projecoes; })
    .map(function (s) { return idProj_(s.nome); }));
}

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

/** Acha a linha de cabeçalho e a coluna de cada campo. */
function mapear_(sheet, def) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const todos = def.campos.map(function (c) { return c.nome; });
  if (lastRow < 1 || lastCol < 1) return { linhaCab: 0, col: {}, faltando: todos, ausentes: def.campos.map(function (c) { return c.k; }) };

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

  const ok = melhor.pontos >= 2;
  const falta = def.campos.filter(function (c) { return !(ok && melhor.col[c.k]); });
  return {
    linhaCab: ok ? melhor.linha : 0,
    col: ok ? melhor.col : {},
    faltando: falta.filter(function (c) { return !c.opcional; }).map(function (c) { return c.nome; }),
    ausentes: falta.map(function (c) { return c.k; })
  };
}

const BLOCOS_ = {};
/**
 * Lê de uma vez todas as colunas usadas da aba (uma chamada à planilha por aba, que é o que
 * mais pesa no tempo). O resultado fica guardado durante a execução para ser reaproveitado.
 */
function bloco_(sheet, def) {
  const chave = sheet.getName();
  if (BLOCOS_[chave]) return BLOCOS_[chave];
  const mapa = mapear_(sheet, def);
  const n = mapa.linhaCab ? sheet.getLastRow() - mapa.linhaCab : 0;
  const cols = def.campos.map(function (c) { return mapa.col[c.k]; }).filter(Boolean);
  let vals = [], c0 = 1;
  if (n > 0 && cols.length) {
    c0 = Math.min.apply(null, cols);
    vals = sheet.getRange(mapa.linhaCab + 1, c0, n, Math.max.apply(null, cols) - c0 + 1).getValues();
  }
  const coluna = function (k) {
    if (!mapa.col[k]) return null;
    const j = mapa.col[k] - c0;
    return vals.map(function (l) { return [l[j]]; });
  };
  BLOCOS_[chave] = { mapa: mapa, n: n, coluna: coluna };
  return BLOCOS_[chave];
}

/* Descrição → código, das abas Usinas e Setores / CCs. Serve para quem escreveu só a descrição, sem o código. */
const DESC_ = { u: {}, cc: {} };

/** Texto sem o código do começo ("A0162-4 - CEEE - SÃO PEDRO I" → "ceee sao pedro i"). */
function semCodigo_(t, re) { return nk_(String(t === null || t === undefined ? '' : t).replace(re, '')); }
const RE_USINA_ = /^\s*[A-Za-z]\d{3,}-\d+\s*[-–—]?\s*/;
const RE_CC_ = /^\s*\d+\s*[-–—]?\s*/;

/**
 * Código da usina ("A0162-4  -  CEEE - SÃO PEDRO I", "A0162-4-CEEE..." ou "a0162-4" → "A0162-4").
 * Sem código: procura a descrição na aba Usinas; se não achar, usa o próprio nome.
 */
function codUsina_(t) {
  const m = String(t === null || t === undefined ? '' : t).match(/^\s*([A-Za-z]\d{3,}-\d+)/);
  return m ? m[1].toUpperCase() : (DESC_.u[nk_(t)] || nk_(t));
}

/**
 * Código do centro de custo ("801  -  BOP ENG- ATERRAMENTO", "801-BOP..." ou "801" → "801").
 * Sem código: procura a descrição na aba Setores / CCs; se não achar, usa o próprio nome.
 */
function codCC_(t) {
  const m = String(t === null || t === undefined ? '' : t).match(/^\s*0*(\d+)(?!\d)/);
  return m ? m[1] : (DESC_.cc[nk_(t)] || nk_(t));
}

/** Monta descrição → código. Descrição repetida em códigos diferentes é ignorada (não dá para saber qual é). */
function mapaDesc_(nomes, cod, re) {
  const out = {}, dup = {};
  nomes.forEach(function (n) {
    const c = cod(n), d = semCodigo_(n, re);
    if (!d || c === nk_(n)) return;
    if (d in out && out[d] !== c) dup[d] = true; else out[d] = c;
  });
  Object.keys(dup).forEach(function (d) { delete out[d]; });
  return out;
}

function prepararDesc_(ss) {
  DESC_.u = {}; DESC_.cc = {};
  const us = lerUsinas_(ss);
  DESC_.u = mapaDesc_(Object.keys(us).map(function (k) { return us[k]; }), codUsina_, RE_USINA_);
  DESC_.cc = mapaDesc_((lerTabela_(ss, CONFIG.ABA_SETORES) || []).map(function (l) { return l[1]; }), codCC_, RE_CC_);
}

function lerAba_(ss, id, tz) {
  const def = defAba_(id);
  const sheet = getAba_(ss, def.nome, false);
  const base = {
    id: id, aba: def.nome, editavel: def.editavel, setor: def.setor || '', sinal: 1,
    campos: def.campos.map(function (c) { return { k: c.k, nome: c.nome, tipo: c.tipo }; }),
    linhas: [], dic: {}, faltando: [], ausentes: [], linhaCab: 0, erro: ''
  };
  if (!sheet) { base.erro = 'Aba "' + def.nome + '" não encontrada.'; return base; }

  const t0 = Date.now();
  const bl = bloco_(sheet, def);
  const mapa = bl.mapa;
  base.linhaCab = mapa.linhaCab;
  base.faltando = mapa.faltando;
  base.ausentes = mapa.ausentes;
  base.colunas = def.campos.filter(function (c) { return mapa.col[c.k]; })
    .map(function (c) { return c.nome + ' → coluna ' + letraColuna_(mapa.col[c.k]); });
  base.aba = sheet.getName();
  if (!mapa.linhaCab) { base.erro = 'Cabeçalho não encontrado na aba "' + def.nome + '".'; return base; }

  const ini = mapa.linhaCab + 1;
  const n = bl.n;
  if (n <= 0) return base;

  const colunas = def.campos.map(function (c) { return bl.coluna(c.k); });
  const tLeitura = Date.now();

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
    if (vazia) continue;
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
  base.tempo = { leitura: tLeitura - t0, processamento: Date.now() - tLeitura,
    colunas: sheet.getLastColumn(), linhas: n };
  return base;
}

/** Lê uma linha já compactada de volta para { campo: valor }. */
function abrirLinha_(aba, l) {
  const v = {};
  aba.campos.forEach(function (c, j) { let x = l[j + 1]; if (aba.dic[c.k]) x = aba.dic[c.k][x]; v[c.k] = x; });
  return v;
}

/** Mantém só as linhas que a pessoa pode ver e refaz a compactação (nada de outro setor fica no resultado). */
function refazAba_(aba, pode) {
  const dics = {}, dicIdx = {};
  Object.keys(aba.dic).forEach(function (k) { dics[k] = []; dicIdx[k] = {}; });
  const linhas = [];
  aba.linhas.forEach(function (l) {
    const v = abrirLinha_(aba, l);
    if (!pode(v)) return;
    const nova = [l[0]];
    aba.campos.forEach(function (c) {
      let x = v[c.k];
      if (dics[c.k]) {
        const s = x === null ? '' : String(x);
        if (!(s in dicIdx[c.k])) { dicIdx[c.k][s] = dics[c.k].length; dics[c.k].push(s); }
        x = dicIdx[c.k][s];
      }
      nova.push(x);
    });
    linhas.push(nova);
  });
  const out = {};
  Object.keys(aba).forEach(function (k) { out[k] = aba[k]; });
  out.linhas = linhas; out.dic = dics; delete out.tempo;
  return out;
}

/* ------------------------------------------------------------------ */
/* Controle de acesso por setor                                         */
/* ------------------------------------------------------------------ */

const TABELAS_ = {};
/** Lê as colunas A:C de uma aba simples (Setores, Acessos). null = a aba não existe. */
function lerTabela_(ss, nome) {
  if (nome in TABELAS_) return TABELAS_[nome];
  // A aba de setores também é aceita com o nome antigo "Setores".
  const sh = getAba_(ss, nome, false) || (nome === CONFIG.ABA_SETORES ? getAba_(ss, 'Setores', false) : null);
  let out = null;
  if (sh) {
    out = [];
    if (sh.getLastRow() >= 2) {
      const larg = Math.max(2, Math.min(3, sh.getLastColumn()));
      out = sh.getRange(2, 1, sh.getLastRow() - 1, larg).getDisplayValues()
        .map(function (l) { return [String(l[0]).trim(), String(l[1]).trim(), String(l[2] || '').trim()]; })
        .filter(function (l) { return l[0] && l[1]; });
    }
  }
  TABELAS_[nome] = out;
  return out;
}

function ehSim_(v) { const n = nk_(v); return n === 'sim' || n === 's' || n === 'x' || n === 'edita' || n === 'editar'; }
function ehTotal_(s) { return nk_(s) === nk_(CONFIG.SETOR_TOTAL); }

/**
 * O que o e-mail de quem abriu pode ver e editar.
 * { tudo, ver:{setor:true}, edita:{setor:true} } — setores pela chave nk_.
 * Sem a aba "Acessos": todos veem tudo e só o dono edita.
 */
function acesso_(ss, email) {
  const todos = {};
  CONFIG.SETORES.forEach(function (s) { todos[nk_(s.nome)] = true; });
  const eu = String(email || '').toLowerCase();
  const dono = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (eu && eu === dono) return { tudo: true, ver: todos, edita: todos };
  const acessos = lerTabela_(ss, CONFIG.ABA_ACESSOS);
  if (acessos === null) return { tudo: true, ver: todos, edita: {} };
  const minhas = eu ? acessos.filter(function (l) { return l[0].toLowerCase() === eu; }) : [];
  const ver = {}, edita = {};
  let tudo = false;
  minhas.forEach(function (l) {
    const alvos = ehTotal_(l[1]) ? Object.keys(todos) : [nk_(l[1])];
    if (ehTotal_(l[1])) tudo = true;
    alvos.forEach(function (k) {
      if (!todos[k]) return;
      ver[k] = true;
      if (ehSim_(l[2])) edita[k] = true;
    });
  });
  return { tudo: tudo, ver: ver, edita: edita };
}

/** Centros de custo de cada setor (aba Setores / CCs): { setor: { código: nome } }. */
function ccsDosSetores_(ss) {
  const out = {};
  (lerTabela_(ss, CONFIG.ABA_SETORES) || []).forEach(function (l) {
    const s = nk_(l[0]), c = codCC_(l[1]);
    if (!s || !c) return;
    (out[s] = out[s] || {})[c] = l[1];
  });
  return out;
}

/** Nome padrão de cada usina (aba Usinas, coluna A): { código: nome }. */
function lerUsinas_(ss) {
  const sh = getAba_(ss, CONFIG.ABA_USINAS, false);
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach(function (l) {
    const nome = String(l[0]).trim();
    const c = codUsina_(nome);
    if (nome && c && !(c in out)) out[c] = nome;
  });
  return out;
}

/**
 * Centros de custo de cada setor (Orçado, Projeções e Realizado): os da aba Setores / CCs.
 * Se o setor ainda não tiver nenhum na aba Setores, usa os que aparecem na aba de projeções dele.
 */
function ccsPorSetor_(ss, abas) {
  const tab = ccsDosSetores_(ss);
  const out = {};
  CONFIG.SETORES.forEach(function (s) {
    const k = nk_(s.nome);
    if (tab[k] && Object.keys(tab[k]).length) { out[k] = { ccs: tab[k], origem: 'setores' }; return; }
    const ccs = {};
    const p = s.projecoes ? abas[idProj_(s.nome)] : null;
    if (p && p.linhas) p.linhas.forEach(function (l) { const t = abrirLinha_(p, l).cc, c = codCC_(t); if (c && !(c in ccs)) ccs[c] = t; });
    out[k] = { ccs: ccs, origem: Object.keys(ccs).length ? 'projecoes' : 'nenhum' };
  });
  return out;
}

/** Cria as abas "Setores" e "Acessos" (se ainda não existirem). O dono entra com acesso TODOS. */
function prepararAcessos() {
  const ss = getSS_();
  const cria = function (nome, cab, linhas) {
    if (getAba_(ss, nome, false)) return false;
    const sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#0A0F14').setFontColor('#ffffff');
    if (linhas.length) sh.getRange(2, 1, linhas.length, cab.length).setValues(linhas);
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, 2, 320);
    return true;
  };
  const dono = Session.getEffectiveUser().getEmail() || '';
  const a = cria(CONFIG.ABA_SETORES, ['Setor', 'Centro de Custo'], []);
  const b = cria(CONFIG.ABA_ACESSOS, ['E-mail', 'Setor', 'Edita'], dono ? [[dono, CONFIG.SETOR_TOTAL, 'Sim']] : []);
  const msg = (a || b) ? 'Abas criadas. Preencha "' + CONFIG.ABA_SETORES + '" (Setor | Centro de Custo) e "' +
    CONFIG.ABA_ACESSOS + '" (E-mail | Setor | Edita). Setores: ' +
    CONFIG.SETORES.map(function (s) { return s.nome; }).join(', ') + '. Use TODOS para quem pode ver tudo.' : 'As abas já existiam.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/** Chamado pelo painel ao abrir e no botão "Atualizar". */
function carregarDados(forcar) {
  const ss = getSS_();
  const tz = ss.getSpreadsheetTimeZone();
  const email = Session.getActiveUser().getEmail() || '';
  prepararDesc_(ss);

  // Dados completos: do que está guardado ou, se não houver (ou "Atualizar"), lidos da planilha.
  let base = forcar ? null : cacheLer_();
  if (!base) {
    const abas = {};
    idsAbas_().forEach(function (id) { abas[id] = lerAba_(ss, id, tz); });
    base = { geradoEm: Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm'), abas: abas };
    cacheGravar_(base);
  }

  // Cada pessoa recebe só as abas de setor que pode ver.
  const ac = acesso_(ss, email);
  const meus = CONFIG.SETORES.filter(function (s) { return ac.ver[nk_(s.nome)]; });
  if (!meus.length) return { semAcesso: true, usuario: email, geradoEm: base.geradoEm };

  const porSetor = ccsPorSetor_(ss, base.abas);
  const setores = meus.map(function (s) {
    const k = nk_(s.nome);
    return {
      nome: s.nome, id: s.projecoes ? idProj_(s.nome) : '', pronto: !!s.projecoes,
      ccs: Object.keys(porSetor[k].ccs), ccNomes: porSetor[k].ccs, origemCC: porSetor[k].origem, edita: !!ac.edita[k]
    };
  });

  const abas = {};
  setores.forEach(function (s) { if (s.id && base.abas[s.id]) abas[s.id] = base.abas[s.id]; });
  if (ac.tudo) {
    abas.orc = base.abas.orc;
    abas.real = base.abas.real;
  } else {
    // Orçado e Realizado: só os centros de custo dos setores liberados.
    const ok = {};
    setores.forEach(function (s) { s.ccs.forEach(function (c) { ok[c] = true; }); });
    const pode = function (v) { return ok[codCC_(v.cc)]; };
    abas.orc = refazAba_(base.abas.orc, pode);
    abas.real = refazAba_(base.abas.real, pode);
  }
  return {
    geradoEm: base.geradoEm,
    usuario: email,
    acesso: { tudo: ac.tudo, setores: setores.map(function (s) { return s.nome; }) },
    setores: setores,
    planilha: ss.getName(),
    urlPlanilha: ac.tudo ? ss.getUrl() : '',
    usinas: lerUsinas_(ss),
    abas: abas
  };
}

/* ------------------------------------------------------------------ */
/* Dados guardados por alguns minutos (CacheService)                   */
/* ------------------------------------------------------------------ */

const CACHE_TAM_ = 90000;
const CACHE_PREFIXO_ = 'painel2_';

function cacheLer_() {
  if (!CONFIG.CACHE_MINUTOS) return null;
  try {
    const c = CacheService.getScriptCache();
    const meta = c.get(CACHE_PREFIXO_ + 'meta');
    if (!meta) return null;
    const partes = JSON.parse(meta).partes, chaves = [];
    for (let i = 0; i < partes; i++) chaves.push(CACHE_PREFIXO_ + i);
    const got = c.getAll(chaves);
    if (chaves.some(function (k) { return !got[k]; })) return null;
    const bytes = Utilities.base64Decode(chaves.map(function (k) { return got[k]; }).join(''));
    return JSON.parse(Utilities.ungzip(Utilities.newBlob(bytes, 'application/x-gzip')).getDataAsString('UTF-8'));
  } catch (e) {
    return null;
  }
}

function cacheGravar_(dados) {
  if (!CONFIG.CACHE_MINUTOS) return;
  try {
    const gz = Utilities.gzip(Utilities.newBlob(JSON.stringify(dados), 'application/json'));
    const b64 = Utilities.base64Encode(gz.getBytes());
    const mapa = {};
    const partes = Math.ceil(b64.length / CACHE_TAM_);
    for (let i = 0; i < partes; i++) mapa[CACHE_PREFIXO_ + i] = b64.substr(i * CACHE_TAM_, CACHE_TAM_);
    mapa[CACHE_PREFIXO_ + 'meta'] = JSON.stringify({ partes: partes });
    CacheService.getScriptCache().putAll(mapa, Math.min(21600, CONFIG.CACHE_MINUTOS * 60));
  } catch (e) {
    // Dados grandes demais para guardar: o painel segue funcionando, só sem a aceleração.
  }
}

/** Depois de gravar, os dados guardados ficam velhos: descarta para a próxima abertura ler de novo. */
function cacheLimpar_() {
  try { CacheService.getScriptCache().remove(CACHE_PREFIXO_ + 'meta'); } catch (e) { /* sem cache */ }
}

/* ------------------------------------------------------------------ */
/* Gravação (só nas abas de Projeções)                                 */
/* ------------------------------------------------------------------ */

function prepararGravacao_(id) {
  const def = defAba_(id);
  if (!def) throw new Error('Aba inválida.');
  if (!def.editavel) throw new Error('A aba "' + def.nome + '" não pode ser alterada pelo painel.');
  const ss = getSS_();
  const email = Session.getActiveUser().getEmail() || '';
  if (!acesso_(ss, email).edita[nk_(def.setor)]) {
    throw new Error('O seu e-mail não tem permissão para editar as projeções de ' + def.setor +
      '. Peça a liberação (coluna "Edita" da aba Acessos).');
  }
  const sheet = getAba_(ss, def.nome, true);
  const mapa = mapear_(sheet, def);
  if (!mapa.linhaCab) throw new Error('Cabeçalho não encontrado na aba "' + def.nome + '".');
  const cols = def.campos.map(function (c) { return mapa.col[c.k]; }).filter(Boolean);
  const c0 = Math.min.apply(null, cols), c1 = Math.max.apply(null, cols);
  return { ss: ss, tz: ss.getSpreadsheetTimeZone(), sheet: sheet, def: def, mapa: mapa, id: id, email: email, c0: c0, larg: c1 - c0 + 1 };
}

/** Texto começando com "=" ou "+" viraria fórmula na planilha: grava como texto. */
function textoSeguro_(s) { s = String(s); return /^[=+@]/.test(s) ? "'" + s : s; }

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
  return textoSeguro_(v);
}

/** Lê a linha inteira de uma vez e devolve { campo: valor } no formato do painel. */
function lerLinha_(ctx, linha, sinal) {
  const l = ctx.sheet.getRange(linha, ctx.c0, 1, ctx.larg).getValues()[0];
  const out = { _r: linha };
  ctx.def.campos.forEach(function (c) {
    const col = ctx.mapa.col[c.k];
    out[c.k] = col ? normalizar_(l[col - ctx.c0], c.tipo, ctx.tz, sinal) : (c.tipo === 'valor' ? null : '');
  });
  return out;
}

/** Confere se a linha ainda é a mesma que o painel mostrou. Devolve os valores atuais. */
function conferirLinha_(ctx, linha, antes, sinal) {
  if (linha <= ctx.mapa.linhaCab || linha > ctx.sheet.getLastRow()) {
    throw new Error('Essa linha não existe mais na planilha. Clique em Atualizar.');
  }
  const atual = lerLinha_(ctx, linha, sinal);
  ctx.def.campos.forEach(function (c) {
    if (!ctx.mapa.col[c.k] || !(c.k in antes)) return;
    if (!iguais_(atual[c.k], antes[c.k], c.tipo)) {
      throw new Error('Essa linha foi alterada na planilha depois que o painel abriu ("' + c.nome +
        '"). Clique em Atualizar e tente de novo.');
    }
  });
  return atual;
}

function sinalValido_(s) { return Number(s) === -1 ? -1 : 1; }

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

const CAB_AUDITORIA = ['Data e hora', 'E-mail', 'Aba', 'Linha', 'Ação', 'Campo', 'Antes', 'Depois'];

function txtAuditoria_(v, tipo) {
  if (v === null || v === undefined) return '';
  if (tipo === 'data' && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) { const t = String(v); return t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + t.slice(0, 4); }
  return typeof v === 'number' ? v : textoSeguro_(v);
}

/** mudancas = [{ campo, tipo, antes, depois }] → uma linha por campo na aba Auditoria. */
function auditar_(ctx, linha, acao, mudancas) {
  if (!mudancas.length) return;
  let sh = getAba_(ctx.ss, CONFIG.ABA_AUDITORIA, false);
  if (!sh) sh = ctx.ss.insertSheet(CONFIG.ABA_AUDITORIA);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, CAB_AUDITORIA.length).setValues([CAB_AUDITORIA])
      .setFontWeight('bold').setBackground('#0A0F14').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  const agora = new Date();
  const linhas = mudancas.map(function (m) {
    return [agora, ctx.email || '(não identificado)', ctx.sheet.getName(), linha, acao, m.campo,
      txtAuditoria_(m.antes, m.tipo), txtAuditoria_(m.depois, m.tipo)];
  });
  const ini = sh.getLastRow() + 1;
  sh.getRange(ini, 1, linhas.length, CAB_AUDITORIA.length).setValues(linhas);
  sh.getRange(ini, 1, linhas.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

/* ------------------------------------------------------------------ */
/* Editar, incluir e excluir (chamados pelo "Detalhar" do painel)      */
/* ------------------------------------------------------------------ */

/** p = { aba, linha, sinal, antes:{campo:valor}, depois:{campo:valor} } */
function salvarLinha(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ctx = prepararGravacao_(p.aba);
    const sinal = sinalValido_(p.sinal), linha = Number(p.linha), depois = p.depois || {};
    const atual = conferirLinha_(ctx, linha, p.antes || {}, sinal);
    const mudancas = [];
    ctx.def.campos.forEach(function (c) {
      if (!(c.k in depois)) return;
      const col = ctx.mapa.col[c.k];
      if (!col) return;
      const cel = ctx.sheet.getRange(linha, col);
      if (cel.getFormula()) throw new Error('A coluna "' + c.nome + '" tem fórmula nessa linha e não pode ser editada pelo painel.');
      if (iguais_(atual[c.k], depois[c.k], c.tipo)) return;
      cel.setValue(paraCelula_(depois[c.k], c.tipo, ctx.tz, sinal));
      mudancas.push({ campo: c.nome, tipo: c.tipo, antes: atual[c.k], depois: depois[c.k] });
    });
    SpreadsheetApp.flush();
    const r = lerLinha_(ctx, linha, sinal);
    auditar_(ctx, linha, 'Edição', mudancas);
    cacheLimpar_();
    return r;
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
    const sinal = sinalValido_(p.sinal), valores = p.valores || {};
    // Última linha com dado nas colunas do painel (ignora fórmulas "arrastadas" em outras colunas).
    const bl = bloco_(ctx.sheet, ctx.def);
    let ultima = ctx.mapa.linhaCab;
    ctx.def.campos.forEach(function (c) {
      const col = bl.coluna(c.k);
      if (!col) return;
      for (let i = col.length - 1; i >= 0; i--) {
        if (col[i][0] !== '' && col[i][0] !== null) { ultima = Math.max(ultima, ctx.mapa.linhaCab + 1 + i); break; }
      }
    });
    const nova = ultima + 1;
    if (nova > ctx.sheet.getMaxRows()) ctx.sheet.insertRowsAfter(ctx.sheet.getMaxRows(), 1);
    if (ultima > ctx.mapa.linhaCab) {
      const largura = ctx.sheet.getLastColumn();
      ctx.sheet.getRange(ultima, 1, 1, largura)
        .copyTo(ctx.sheet.getRange(nova, 1, 1, largura), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    }
    const mudancas = [];
    ctx.def.campos.forEach(function (c) {
      const col = ctx.mapa.col[c.k];
      if (!col || !(c.k in valores)) return;
      ctx.sheet.getRange(nova, col).setValue(paraCelula_(valores[c.k], c.tipo, ctx.tz, sinal));
      if (valores[c.k] !== '' && valores[c.k] !== null) mudancas.push({ campo: c.nome, tipo: c.tipo, antes: '', depois: valores[c.k] });
    });
    SpreadsheetApp.flush();
    const r = lerLinha_(ctx, nova, sinal);
    auditar_(ctx, nova, 'Inclusão', mudancas);
    cacheLimpar_();
    return r;
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
    const linha = Number(p.linha);
    const atual = conferirLinha_(ctx, linha, p.antes || {}, sinalValido_(p.sinal));
    ctx.sheet.deleteRow(linha);
    auditar_(ctx, linha, 'Exclusão', ctx.def.campos.filter(function (c) { return ctx.mapa.col[c.k] && atual[c.k] !== '' && atual[c.k] !== null; })
      .map(function (c) { return { campo: c.nome, tipo: c.tipo, antes: atual[c.k], depois: '' }; }));
    cacheLimpar_();
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Diagnóstico — rode pelo editor para conferir se tudo foi encontrado */
/* ------------------------------------------------------------------ */

function diagnosticar() {
  const t0 = Date.now();
  const ss = getSS_(), tz = ss.getSpreadsheetTimeZone();
  prepararDesc_(ss);
  const abas = {};
  idsAbas_().forEach(function (id) { abas[id] = lerAba_(ss, id, tz); });
  Logger.log('Tempo de leitura da planilha: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  Logger.log('Planilha: ' + ss.getName());
  Object.keys(abas).forEach(function (id) {
    const a = abas[id];
    Logger.log('— Aba "' + a.aba + '": ' + (a.erro || ('cabeçalho na linha ' + a.linhaCab + ', ' +
      a.linhas.length + ' linhas usadas' + (a.sinal === -1 ? ', valores negativos (sinal invertido no painel)' : ''))));
    if (a.tempo) Logger.log('   Tempo: leitura ' + (a.tempo.leitura / 1000).toFixed(1) +
      ' s · processamento ' + (a.tempo.processamento / 1000).toFixed(1) + ' s (' + a.tempo.linhas + ' linhas × ' + a.tempo.colunas + ' colunas na aba)');
    if (a.colunas && a.colunas.length) Logger.log('   Lendo: ' + a.colunas.join(' · '));
    if (a.faltando.length) Logger.log('   Colunas NÃO encontradas: ' + a.faltando.join(' | '));
    if (a.dic && a.dic.dataFluxo) {
      const datas = a.dic.dataFluxo.filter(String).sort();
      Logger.log('   Datas do Fluxo: ' + datas.length + (datas.length ? ' (de ' + datas[0] + ' até ' + datas[datas.length - 1] + ')' : ''));
    }
  });
  verificarSetores_(ss, abas);
}

/** Mostra quantos centros de custo cada setor tem e os da aba "Setores" que não aparecem nos dados. */
function verificarSetores_(ss, abas) {
  const acessos = lerTabela_(ss, CONFIG.ABA_ACESSOS);
  Logger.log(acessos === null
    ? 'Controle de acesso: desligado (não existe a aba "' + CONFIG.ABA_ACESSOS + '"). Todos veem tudo.'
    : 'Controle de acesso: ligado. ' + acessos.length + ' liberações na aba "' + CONFIG.ABA_ACESSOS + '".');
  const existe = {};
  Object.keys(abas).forEach(function (id) {
    const a = abas[id];
    a.linhas.forEach(function (l) { existe[codCC_(abrirLinha_(a, l).cc)] = true; });
  });
  const porSetor = ccsPorSetor_(ss, abas);
  CONFIG.SETORES.forEach(function (s) {
    const p = porSetor[nk_(s.nome)];
    const n = Object.keys(p.ccs).length;
    Logger.log('Setor ' + s.nome + ': ' + (p.origem === 'setores' ? n + ' centros de custo na aba "' + CONFIG.ABA_SETORES + '"'
      : p.origem === 'projecoes' ? 'nenhum centro de custo na aba "' + CONFIG.ABA_SETORES + '"; usando os ' + n + ' da aba de projeções'
      : 'nenhum centro de custo cadastrado') + (s.projecoes ? '' : ' (aba em construção)'));
  });
  const faltam = (lerTabela_(ss, CONFIG.ABA_SETORES) || []).filter(function (l) { return !existe[codCC_(l[1])]; });
  if (faltam.length) Logger.log('Centros de custo da aba "' + CONFIG.ABA_SETORES + '" que NÃO aparecem em nenhuma aba de dados: ' +
    faltam.map(function (l) { return l[0] + ' → ' + l[1]; }).join(' | '));
  // Projeções em centros de custo que não estão na lista do setor: não entram no painel.
  CONFIG.SETORES.forEach(function (s) {
    const p = s.projecoes ? abas[idProj_(s.nome)] : null;
    if (!p || !p.linhas) return;
    const lista = porSetor[nk_(s.nome)].ccs, fora = {};
    p.linhas.forEach(function (l) { const v = abrirLinha_(p, l); if (!(codCC_(v.cc) in lista)) fora[v.cc || '(vazio)'] = (fora[v.cc || '(vazio)'] || 0) + (v.valor || 0); });
    const ks = Object.keys(fora);
    if (ks.length) Logger.log('Projeções de ' + s.nome + ' em centros de custo fora da lista do setor (não entram no painel): ' +
      ks.map(function (k) { return k + ' (R$ ' + fora[k].toFixed(2) + ')'; }).join(' | '));
  });
  // Códigos de usina que aparecem nos dados e não estão na aba Usinas.
  const us = lerUsinas_(ss), semNome = {};
  Object.keys(abas).forEach(function (id) {
    abas[id].linhas.forEach(function (l) { const c = codUsina_(abrirLinha_(abas[id], l).projeto); if (c && !(c in us)) semNome[c] = true; });
  });
  if (Object.keys(semNome).length) Logger.log('Códigos de usina que não estão na aba "' + CONFIG.ABA_USINAS + '": ' + Object.keys(semNome).join(', '));
}
