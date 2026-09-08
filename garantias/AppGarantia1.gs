/**
 * ACIONAMENTO DE GARANTIAS — SolarGrid
 * Backend do aplicativo web (Google Apps Script).
 *
 * REGRA DE OURO DESTE PROJETO
 * ---------------------------
 * Nada aqui depende da ORDEM ou da LETRA das colunas. Toda leitura e toda
 * gravação passam pelo TEXTO DO CABEÇALHO (linha 6 da aba). A comparação
 * ignora maiúsculas, acentos e espaços repetidos, então a planilha pode ser
 * reorganizada, limpa ou ter colunas removidas sem quebrar o sistema.
 * Se um cabeçalho esperado não existir, o campo simplesmente não aparece na
 * tela e o aviso é mostrado ao usuário — nunca se grava no lugar errado.
 */

/* ================================================================== */
/* CONFIGURAÇÃO — é só aqui que se mexe no dia a dia                   */
/* ================================================================== */

const CONFIG = {
  // Deixe '' para usar a planilha em que este script está instalado.
  // Para apontar para outra planilha, cole o ID dela aqui.
  // (o ID é o trecho entre /d/ e /edit no endereço da planilha)
  SPREADSHEET_ID: '',

  SHEET_NAME: 'Controle Acionamento',

  // Linha onde estão os títulos das colunas. Os dados começam na linha seguinte.
  HEADER_ROW: 6,

  // Só e-mails deste domínio conseguem entrar.
  DOMINIO_PERMITIDO: 'solargrid.com.br',

  // Recebe um aviso a cada nova solicitação. Deixe '' para desligar.
  EMAIL_NOVA_SOLICITACAO: 'procurement.eng@solargrid.com.br',

  // Formato do código gerado automaticamente na abertura.
  SCGAR_PREFIXO: 'SCGAR-',
  SCGAR_DIGITOS: 4,

  // Segundos que a lista fica guardada em memória (deixa a tela rápida).
  CACHE_LISTA_SEG: 180,
  CACHE_OPCOES_SEG: 21600,

  // Endereço de uma imagem do logo (PNG/SVG público). Vazio = usa o nome escrito.
  LOGO_URL: ''
};

/** Lista oficial de status. Para mudar, edite aqui. */
const STATUS_GERAL = [
  'Pendente',
  'Em aprov . Orçamento',
  'Em andamento análise',
  'Em Trânsito',
  'Em prog. de retorno',
  'Em confirm. de conclusão',
  'Concluído',
  'Cancelado',
  'Ag envio OEM',
  'Em andamento para Envio'
];

const SIM_NAO = ['Sim', 'Não'];
const APROVACAO = ['Aprovado', 'Reprovado', 'Pendente'];

/**
 * MAPA DE CAMPOS
 * Cada item liga um campo da tela a um CABEÇALHO da planilha.
 *   cab   = texto do cabeçalho (é a chave de tudo)
 *   ocor  = qual ocorrência usar, quando o mesmo título aparece 2x na aba
 *   tipo  = texto | area | data | numero | moeda | select | link | formula
 *   grupo = em que bloco da tela o campo aparece
 *   sol   = true  -> campo do formulário de Nova Solicitação
 *   lista = true  -> aparece como coluna na tabela de Processos
 */
const CAMPOS = [
  // --- Identificação -------------------------------------------------
  { cab: 'SCGAR',                 tipo: 'texto',  grupo: 'Identificação', lista: true,  auto: true },
  { cab: 'Data de Solicitação',   tipo: 'data',   grupo: 'Identificação', lista: true,  auto: true },
  { cab: 'RMA / OS (Nº)',         tipo: 'texto',  grupo: 'Identificação', lista: true,  sol: true },
  { cab: 'Tipo de Acionamento',   tipo: 'select', grupo: 'Identificação', lista: true,  sol: true, opcoesDaColuna: true, obrig: true },
  { cab: 'UFV de Origem',         tipo: 'select', grupo: 'Identificação', lista: true,  sol: true, opcoesDaColuna: true, obrig: true },
  { cab: 'Fornecedor',            tipo: 'select', grupo: 'Identificação', lista: true,  sol: true, opcoesDaColuna: true, obrig: true },
  { cab: 'Material/Equipamento',  tipo: 'texto',  grupo: 'Identificação', lista: true,  sol: true, obrig: true },
  { cab: 'Qtd',                   tipo: 'numero', grupo: 'Identificação', lista: true,  sol: true, obrig: true },
  { cab: 'Equipamento Principal', tipo: 'select', grupo: 'Identificação', sol: true, opcoesDaColuna: true },
  { cab: 'MAC',                   tipo: 'texto',  grupo: 'Identificação', sol: true },
  { cab: 'NS',                    tipo: 'texto',  grupo: 'Identificação', lista: true, sol: true },
  { cab: 'Motivo Inicial',        tipo: 'area',   grupo: 'Identificação', sol: true, obrig: true },
  { cab: 'CÓD MXM (FÓRMULA)',     tipo: 'formula', grupo: 'Identificação' },

  // --- Triagem -------------------------------------------------------
  { cab: 'Status Geral do Acionamento', tipo: 'select', opcoes: STATUS_GERAL, grupo: 'Triagem', lista: true },
  { cab: 'Responsável Atual',     tipo: 'select', grupo: 'Triagem', lista: true, opcoesDaColuna: true },
  { cab: 'Tipo',                  tipo: 'select', grupo: 'Triagem', opcoesDaColuna: true },
  { cab: 'Chamado',               tipo: 'texto',  grupo: 'Triagem' },
  { cab: 'Data Abertura',         tipo: 'data',   grupo: 'Triagem' },
  { cab: 'Status',                tipo: 'select', grupo: 'Triagem', opcoesDaColuna: true },
  { cab: 'Ação Processos STI',    tipo: 'area',   grupo: 'Triagem' },
  { cab: 'Historico (resumo)',    tipo: 'area',   grupo: 'Triagem' },
  { cab: 'Link do Card',          tipo: 'link',   grupo: 'Triagem' },
  { cab: 'Link',                  tipo: 'link',   grupo: 'Triagem' },

  // --- Garantia ------------------------------------------------------
  { cab: 'Vigencia da Garantia',      tipo: 'data',  grupo: 'Garantia' },
  { cab: 'Data Emissão Declaração',   tipo: 'data',  grupo: 'Garantia' },
  { cab: 'NS FINAL',                  tipo: 'texto', grupo: 'Garantia' },
  { cab: 'Nota Fiscal Retorno',       tipo: 'texto', grupo: 'Garantia' },

  // --- Envio ---------------------------------------------------------
  { cab: 'Valor do Frete / Envio Estimado (Envio)', tipo: 'moeda',  grupo: 'Envio' },
  { cab: 'Via / Veiculo',                 tipo: 'texto',  grupo: 'Envio' },
  { cab: 'Aprov Marcella (Envio)',        tipo: 'select', opcoes: APROVACAO, grupo: 'Envio' },
  { cab: 'Aprov Felipe (Envio)',          tipo: 'select', opcoes: APROVACAO, grupo: 'Envio' },
  { cab: 'Data  envio/Coleta',            tipo: 'data',   grupo: 'Envio' },
  { cab: 'Codigo Rastreio / Romaneio RFQ', ocor: 1, tipo: 'texto', grupo: 'Envio', rotulo: 'Código Rastreio / Romaneio RFQ (envio)' },
  { cab: 'Data Chegada no Fornecedor',    tipo: 'data',   grupo: 'Envio' },
  { cab: 'Comentarios',                   tipo: 'area',   grupo: 'Envio' },

  // --- Análise / Reparo ----------------------------------------------
  { cab: 'Coberto em Garantia',      tipo: 'select', opcoes: SIM_NAO,   grupo: 'Análise / Reparo', lista: true },
  { cab: 'Valor Reparo',             tipo: 'moeda',  grupo: 'Análise / Reparo' },
  { cab: 'Aprov Marcella (Reparo)',  tipo: 'select', opcoes: APROVACAO, grupo: 'Análise / Reparo' },
  { cab: 'Aprov Felipe (Reparo)',    tipo: 'select', opcoes: APROVACAO, grupo: 'Análise / Reparo' },

  // --- Retorno -------------------------------------------------------
  { cab: 'Valor do Frete / Envio Estimado (Retorno)', tipo: 'moeda',  grupo: 'Retorno' },
  { cab: 'Via',                                tipo: 'texto',  grupo: 'Retorno' },
  { cab: 'Aprov Marcella (Retorno)',           tipo: 'select', opcoes: APROVACAO, grupo: 'Retorno' },
  { cab: 'Aprov Felipe (Retorno)',             tipo: 'select', opcoes: APROVACAO, grupo: 'Retorno' },
  { cab: 'Data Saida / Coleta  Fornecedor (Real)', tipo: 'data', grupo: 'Retorno' },
  { cab: 'Codigo Rastreio / Romaneio RFQ', ocor: 2, tipo: 'texto', grupo: 'Retorno', rotulo: 'Código Rastreio / Romaneio RFQ (retorno)' },
  { cab: 'Data Chegada na usina',              tipo: 'data',   grupo: 'Retorno' },

  // --- Acompanhamento ------------------------------------------------
  { cab: 'FUP - Comentarios',                       tipo: 'area', grupo: 'Acompanhamento' },
  { cab: 'FUP -  Ações Futuras (TROCA EM AVANÇO)',  tipo: 'area', grupo: 'Acompanhamento' },
  { cab: 'Ação',                                    tipo: 'area', grupo: 'Acompanhamento' }
];

const GRUPOS = ['Identificação', 'Triagem', 'Garantia', 'Envio', 'Análise / Reparo', 'Retorno', 'Acompanhamento'];

/** Cabeçalho da coluna usada como status principal. */
const CAB_STATUS = 'Status Geral do Acionamento';
const CAB_SCGAR = 'SCGAR';
const CAB_DATA_SOL = 'Data de Solicitação';

/* ================================================================== */
/* Entrada do aplicativo web                                           */
/* ================================================================== */

function doGet() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const dominio = email.split('@')[1] || '';

  if (dominio !== CONFIG.DOMINIO_PERMITIDO.toLowerCase()) {
    return HtmlService.createTemplateFromFile('SemAcesso')
      .evaluate()
      .setTitle('Acesso restrito — SolarGrid')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createTemplateFromFile('AppGarantia2')
    .evaluate()
    .setTitle('Acionamento de Garantias — SolarGrid')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function incluir(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

/* ================================================================== */
/* Planilha e mapa de cabeçalhos                                       */
/* ================================================================== */

function _abrirPlanilha() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function _aba() {
  const ss = _abrirPlanilha();
  const aba = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!aba) {
    throw new Error('A aba "' + CONFIG.SHEET_NAME + '" não foi encontrada na planilha.');
  }
  return aba;
}

/** Deixa o texto comparável: sem acento, sem maiúscula, sem espaço sobrando. */
function _normalizar(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Lê a linha de cabeçalho e devolve { 'nome normalizado': [col1, col2, ...] }.
 * As posições são 1-based (1 = coluna A).
 */
function _mapaCabecalhos(aba) {
  const largura = aba.getLastColumn();
  const titulos = aba.getRange(CONFIG.HEADER_ROW, 1, 1, largura).getDisplayValues()[0];
  const mapa = {};
  titulos.forEach(function (titulo, i) {
    const chave = _normalizar(titulo);
    if (!chave) return;
    if (!mapa[chave]) mapa[chave] = [];
    mapa[chave].push(i + 1);
  });
  return mapa;
}

/** Posição da coluna de um campo, ou 0 se o cabeçalho não existir. */
function _coluna(mapa, campo) {
  const posicoes = mapa[_normalizar(campo.cab)];
  if (!posicoes || !posicoes.length) return 0;
  const indice = (campo.ocor || 1) - 1;
  return posicoes[indice] || 0;
}

/** Identificador estável de um campo, usado entre tela e planilha. */
function _idCampo(campo) {
  return _normalizar(campo.cab) + (campo.ocor && campo.ocor > 1 ? '#' + campo.ocor : '');
}

/** Só os campos cujo cabeçalho realmente existe na aba hoje. */
function _camposAtivos(mapa) {
  return CAMPOS.map(function (campo) {
    return { campo: campo, col: _coluna(mapa, campo) };
  }).filter(function (item) {
    return item.col > 0;
  });
}

/* ================================================================== */
/* Cache (o que deixa a tela rápida)                                   */
/* ================================================================== */

const _TAM_PEDACO = 90000;

function _cacheGravar(chave, texto, segundos) {
  const cache = CacheService.getScriptCache();
  const pedacos = [];
  for (let i = 0; i < texto.length; i += _TAM_PEDACO) {
    pedacos.push(texto.substring(i, i + _TAM_PEDACO));
  }
  const lote = { };
  pedacos.forEach(function (p, i) { lote[chave + '::' + i] = p; });
  lote[chave + '::n'] = String(pedacos.length);
  cache.putAll(lote, segundos);
}

function _cacheLer(chave) {
  const cache = CacheService.getScriptCache();
  const total = Number(cache.get(chave + '::n') || 0);
  if (!total) return null;
  const nomes = [];
  for (let i = 0; i < total; i++) nomes.push(chave + '::' + i);
  const partes = cache.getAll(nomes);
  let texto = '';
  for (let i = 0; i < total; i++) {
    const p = partes[chave + '::' + i];
    if (p == null) return null;
    texto += p;
  }
  return texto;
}

function _cacheLimpar(chave) {
  const cache = CacheService.getScriptCache();
  const total = Number(cache.get(chave + '::n') || 0);
  const nomes = [chave + '::n'];
  for (let i = 0; i < total; i++) nomes.push(chave + '::' + i);
  cache.removeAll(nomes);
}

/* ================================================================== */
/* Carga inicial da tela                                               */
/* ================================================================== */

function carregarInicio() {
  const aba = _aba();
  const mapa = _mapaCabecalhos(aba);
  const ativos = _camposAtivos(mapa);
  const encontrados = {};
  ativos.forEach(function (item) { encontrados[_idCampo(item.campo)] = true; });

  const faltando = CAMPOS.filter(function (campo) {
    return !encontrados[_idCampo(campo)];
  }).map(function (campo) { return campo.cab; });

  const opcoes = _opcoesDeColunas(aba, mapa);

  const campos = ativos.map(function (item) {
    const c = item.campo;
    return {
      id: _idCampo(c),
      cab: c.cab,
      rotulo: c.rotulo || c.cab,
      tipo: c.tipo,
      grupo: c.grupo,
      sol: !!c.sol,
      lista: !!c.lista,
      auto: !!c.auto,
      obrig: !!c.obrig,
      fixo: !!c.opcoes,
      opcoes: c.opcoes || (c.opcoesDaColuna ? (opcoes[_idCampo(c)] || []) : null)
    };
  });

  return {
    usuario: Session.getActiveUser().getEmail(),
    campos: campos,
    grupos: GRUPOS,
    status: STATUS_GERAL,
    faltando: faltando,
    logoUrl: CONFIG.LOGO_URL
  };
}

/** Valores já usados nas colunas marcadas com opcoesDaColuna, para sugestão. */
function _opcoesDeColunas(aba, mapa) {
  const chave = 'gar_opcoes_v1';
  const guardado = _cacheLer(chave);
  if (guardado) {
    try { return JSON.parse(guardado); } catch (e) { /* segue e recalcula */ }
  }

  const primeira = CONFIG.HEADER_ROW + 1;
  const ultima = aba.getLastRow();
  const resultado = {};

  if (ultima >= primeira) {
    CAMPOS.filter(function (c) { return c.opcoesDaColuna; }).forEach(function (c) {
      const col = _coluna(mapa, c);
      if (!col) return;
      const valores = aba.getRange(primeira, col, ultima - primeira + 1, 1).getDisplayValues();
      const vistos = {};
      valores.forEach(function (linha) {
        const v = String(linha[0] || '').trim();
        if (v) vistos[v] = true;
      });
      resultado[_idCampo(c)] = Object.keys(vistos).sort(function (a, b) {
        return a.localeCompare(b, 'pt-BR');
      });
    });
  }

  _cacheGravar(chave, JSON.stringify(resultado), CONFIG.CACHE_OPCOES_SEG);
  return resultado;
}

/* ================================================================== */
/* Módulo Processos — lista                                            */
/* ================================================================== */

function listarProcessos(forcar) {
  const chave = 'gar_lista_v1';
  if (!forcar) {
    const guardado = _cacheLer(chave);
    if (guardado) {
      try { return JSON.parse(guardado); } catch (e) { /* segue e recalcula */ }
    }
  }

  const aba = _aba();
  const mapa = _mapaCabecalhos(aba);
  const primeira = CONFIG.HEADER_ROW + 1;
  const ultima = aba.getLastRow();

  const doLista = CAMPOS.filter(function (c) { return c.lista; })
    .map(function (c) { return { campo: c, col: _coluna(mapa, c) }; })
    .filter(function (i) { return i.col > 0; });

  const colStatus = _coluna(mapa, { cab: CAB_STATUS });
  const colScgar = _coluna(mapa, { cab: CAB_SCGAR });

  const saida = { colunas: [], itens: [] };
  doLista.forEach(function (i) {
    saida.colunas.push({ id: _idCampo(i.campo), rotulo: i.campo.rotulo || i.campo.cab, tipo: i.campo.tipo });
  });

  if (ultima < primeira) {
    _cacheGravar(chave, JSON.stringify(saida), CONFIG.CACHE_LISTA_SEG);
    return saida;
  }

  const largura = aba.getLastColumn();
  const bloco = aba.getRange(primeira, 1, ultima - primeira + 1, largura).getDisplayValues();

  bloco.forEach(function (linha, idx) {
    const vazia = linha.every(function (v) { return String(v).trim() === ''; });
    if (vazia) return;

    const item = {
      linha: primeira + idx,
      scgar: colScgar ? String(linha[colScgar - 1] || '').trim() : '',
      status: colStatus ? String(linha[colStatus - 1] || '').trim() : '',
      v: {}
    };
    doLista.forEach(function (i) {
      item.v[_idCampo(i.campo)] = String(linha[i.col - 1] || '');
    });
    saida.itens.push(item);
  });

  saida.itens.reverse(); // mais recentes primeiro
  _cacheGravar(chave, JSON.stringify(saida), CONFIG.CACHE_LISTA_SEG);
  return saida;
}

/* ================================================================== */
/* Módulo Processos — abrir e salvar um acionamento                     */
/* ================================================================== */

function obterProcesso(linha) {
  linha = Number(linha);
  const aba = _aba();
  if (linha <= CONFIG.HEADER_ROW || linha > aba.getLastRow()) {
    throw new Error('Linha inválida.');
  }

  const mapa = _mapaCabecalhos(aba);
  const largura = aba.getLastColumn();
  const valores = aba.getRange(linha, 1, 1, largura).getValues()[0];
  const exibicao = aba.getRange(linha, 1, 1, largura).getDisplayValues()[0];

  const fuso = _abrirPlanilha().getSpreadsheetTimeZone();
  const dados = {};

  _camposAtivos(mapa).forEach(function (item) {
    const bruto = valores[item.col - 1];
    const mostrado = exibicao[item.col - 1];
    dados[_idCampo(item.campo)] = _paraTela(item.campo, bruto, mostrado, fuso);
  });

  const colScgar = _coluna(mapa, { cab: CAB_SCGAR });
  return {
    linha: linha,
    scgar: colScgar ? String(exibicao[colScgar - 1] || '').trim() : '',
    dados: dados
  };
}

function _paraTela(campo, bruto, mostrado, fuso) {
  if (campo.tipo === 'data') {
    if (bruto instanceof Date) return Utilities.formatDate(bruto, fuso, 'yyyy-MM-dd');
    return _textoParaISO(String(mostrado || ''));
  }
  if (campo.tipo === 'numero' || campo.tipo === 'moeda') {
    if (typeof bruto === 'number') return String(bruto);
    const limpo = String(mostrado || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return limpo === '' ? '' : limpo;
  }
  if (campo.tipo === 'formula') return String(mostrado || '');
  return String(mostrado == null ? '' : mostrado);
}

/** Aceita 31/12/2026, 31-12-2026 e 2026-12-31. */
function _textoParaISO(texto) {
  const t = String(texto).trim();
  if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let ano = m[3].length === 2 ? '20' + m[3] : m[3];
    return ano + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  return '';
}

function _isoParaData(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Grava só o que mudou, célula por célula. Nunca reescreve a aba inteira.
 * Confere o SCGAR antes de gravar, para não escrever na linha errada caso
 * alguém tenha apagado ou inserido linhas no meio.
 */
function salvarProcesso(linha, scgarEsperado, alteracoes) {
  linha = Number(linha);
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const aba = _aba();
    if (linha <= CONFIG.HEADER_ROW || linha > aba.getLastRow()) {
      throw new Error('Esta linha não existe mais na planilha. Atualize a lista.');
    }

    const mapa = _mapaCabecalhos(aba);
    const colScgar = _coluna(mapa, { cab: CAB_SCGAR });
    if (colScgar) {
      const atual = String(aba.getRange(linha, colScgar).getDisplayValue() || '').trim();
      if (scgarEsperado && atual && atual !== String(scgarEsperado).trim()) {
        throw new Error('A planilha mudou de posição desde que você abriu este acionamento. Atualize a lista e tente de novo.');
      }
    }

    const porId = {};
    _camposAtivos(mapa).forEach(function (item) {
      porId[_idCampo(item.campo)] = item;
    });

    let gravados = 0;
    Object.keys(alteracoes || {}).forEach(function (id) {
      const item = porId[id];
      if (!item) return;                       // cabeçalho não existe: ignora
      if (item.campo.tipo === 'formula') return; // coluna de fórmula: não toca
      if (item.campo.auto) return;               // SCGAR e data de abertura: não toca

      const valor = _paraPlanilha(item.campo, alteracoes[id]);
      const celula = aba.getRange(linha, item.col);
      if (valor === null) {
        celula.clearContent();
      } else {
        celula.setValue(valor);
      }
      gravados++;
    });

    if (gravados) _cacheLimpar('gar_lista_v1');
    SpreadsheetApp.flush();
    return { ok: true, gravados: gravados };
  } finally {
    trava.releaseLock();
  }
}

function _paraPlanilha(campo, valor) {
  const txt = String(valor == null ? '' : valor).trim();
  if (txt === '') return null;

  if (campo.tipo === 'data') {
    const d = _isoParaData(txt);
    return d || txt;
  }
  if (campo.tipo === 'numero' || campo.tipo === 'moeda') {
    const n = Number(txt.replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? txt : n;
  }
  return txt;
}

/* ================================================================== */
/* Módulo Solicitação — criar novo acionamento                          */
/* ================================================================== */

function criarSolicitacao(dados) {
  const trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    const aba = _aba();
    const mapa = _mapaCabecalhos(aba);
    const ativos = _camposAtivos(mapa);

    // Confere os obrigatórios que existem na aba
    const faltou = [];
    ativos.forEach(function (item) {
      const c = item.campo;
      if (!c.sol || !c.obrig) return;
      const v = String((dados || {})[_idCampo(c)] || '').trim();
      if (!v) faltou.push(c.rotulo || c.cab);
    });
    if (faltou.length) {
      throw new Error('Preencha: ' + faltou.join(', ') + '.');
    }

    const linhaAnterior = Math.max(aba.getLastRow(), CONFIG.HEADER_ROW);
    const linhaNova = linhaAnterior + 1;
    const largura = aba.getLastColumn();

    if (linhaNova > aba.getMaxRows()) {
      aba.insertRowsAfter(aba.getMaxRows(), 20);
    }

    const scgar = _proximoScgar(aba, mapa);
    const hoje = new Date();

    // Monta a linha inteira em memória e grava de uma só vez (rápido)
    const linhaValores = new Array(largura).fill('');
    const colFormula = [];

    ativos.forEach(function (item) {
      const c = item.campo;
      if (c.tipo === 'formula') { colFormula.push(item.col); return; }

      let valor = '';
      if (_normalizar(c.cab) === _normalizar(CAB_SCGAR)) {
        valor = scgar;
      } else if (_normalizar(c.cab) === _normalizar(CAB_DATA_SOL)) {
        valor = hoje;
      } else if (_normalizar(c.cab) === _normalizar(CAB_STATUS)) {
        valor = STATUS_GERAL[0];
      } else if (c.sol) {
        const bruto = _paraPlanilha(c, (dados || {})[_idCampo(c)]);
        valor = bruto === null ? '' : bruto;
      } else {
        return;
      }
      linhaValores[item.col - 1] = valor;
    });

    aba.getRange(linhaNova, 1, 1, largura).setValues([linhaValores]);

    // Puxa as fórmulas da linha de cima (ex.: CÓD MXM)
    colFormula.forEach(function (col) {
      if (linhaAnterior <= CONFIG.HEADER_ROW) return;
      const acima = aba.getRange(linhaAnterior, col);
      if (acima.getFormula()) {
        acima.copyTo(aba.getRange(linhaNova, col), { contentsOnly: false });
      }
    });

    SpreadsheetApp.flush();
    _cacheLimpar('gar_lista_v1');
    _cacheLimpar('gar_opcoes_v1');

    _avisarPorEmail(scgar, dados, ativos, linhaNova);

    return { ok: true, scgar: scgar, linha: linhaNova };
  } finally {
    trava.releaseLock();
  }
}

/** Próximo código no formato SCGAR-0001, olhando o maior já existente. */
function _proximoScgar(aba, mapa) {
  const col = _coluna(mapa, { cab: CAB_SCGAR });
  let maior = 0;

  if (col) {
    const primeira = CONFIG.HEADER_ROW + 1;
    const ultima = aba.getLastRow();
    if (ultima >= primeira) {
      const valores = aba.getRange(primeira, col, ultima - primeira + 1, 1).getDisplayValues();
      valores.forEach(function (l) {
        const m = String(l[0] || '').match(/(\d+)\s*$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maior) maior = n;
        }
      });
    }
  }

  const numero = String(maior + 1);
  const zeros = Math.max(0, CONFIG.SCGAR_DIGITOS - numero.length);
  return CONFIG.SCGAR_PREFIXO + new Array(zeros + 1).join('0') + numero;
}

function _avisarPorEmail(scgar, dados, ativos, linhaNova) {
  if (!CONFIG.EMAIL_NOVA_SOLICITACAO) return;
  try {
    const solicitante = Session.getActiveUser().getEmail() || '(não identificado)';
    const linhas = ativos
      .filter(function (i) { return i.campo.sol; })
      .map(function (i) {
        const rotulo = i.campo.rotulo || i.campo.cab;
        const valor = String((dados || {})[_idCampo(i.campo)] || '—');
        return '<tr><td style="padding:6px 12px;border-bottom:1px solid #D8D8D8;color:#5b6670">' + rotulo +
               '</td><td style="padding:6px 12px;border-bottom:1px solid #D8D8D8;font-weight:600">' + valor + '</td></tr>';
      }).join('');

    const html =
      '<div style="font-family:Montserrat,Arial,sans-serif;color:#0A0F14;max-width:620px">' +
        '<div style="background:#EC6E2D;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0">' +
          '<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">SolarGrid — Garantias</div>' +
          '<div style="font-size:19px;font-weight:700;margin-top:2px">Nova solicitação ' + scgar + '</div>' +
        '</div>' +
        '<div style="border:1px solid #D8D8D8;border-top:none;border-radius:0 0 12px 12px;padding:8px 0 14px">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px">' + linhas + '</table>' +
          '<p style="padding:12px 12px 0;margin:0;font-size:12px;color:#5b6670">Aberta por ' + solicitante +
          ' — linha ' + linhaNova + ' da aba ' + CONFIG.SHEET_NAME + '.</p>' +
        '</div>' +
      '</div>';

    MailApp.sendEmail({
      to: CONFIG.EMAIL_NOVA_SOLICITACAO,
      subject: '[Garantias] Nova solicitação ' + scgar,
      htmlBody: html
    });
  } catch (e) {
    // O e-mail não pode impedir a abertura da solicitação.
    console.error('Falha ao enviar o aviso: ' + e.message);
  }
}
