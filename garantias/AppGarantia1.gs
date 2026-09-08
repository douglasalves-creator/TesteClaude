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

/* ==================================================================
   TUDO DESTE SISTEMA FICA DENTRO DA "CAIXA" GAR_GARANTIAS.
   Isso evita conflito com outros códigos que já existam neste projeto
   do Apps Script: nada aqui vaza para fora, exceto as poucas funções
   com o prefixo gar_ que ficam no final do arquivo.
   ================================================================== */
var GAR_GARANTIAS = (function () {

/* ================================================================== */
/* CONFIGURAÇÃO — é só aqui que se mexe no dia a dia                   */
/* ================================================================== */

const CONFIG = {
  // Deixe '' para usar a planilha em que este script está instalado.
  // Para apontar para outra planilha, cole o ID dela aqui.
  // (o ID é o trecho entre /d/ e /edit no endereço da planilha)
  SPREADSHEET_ID: '',

  SHEET_NAME: 'Controle Acionamento',

  // Aba que recebe o registro de tudo que foi criado ou alterado.
  // Deixe '' para desligar o registro.
  ABA_AUDITORIA: 'Auditoria',
  AUDITORIA_HEADER_ROW: 1,

  // Linha onde estão os títulos das colunas. Os dados começam na linha seguinte.
  HEADER_ROW: 6,

  // Só e-mails deste domínio conseguem entrar.
  DOMINIO_PERMITIDO: 'solargrid.com.br',

  // Recebe um aviso a cada nova solicitação. Deixe '' para desligar.
  EMAIL_NOVA_SOLICITACAO: 'procurement.eng@solargrid.com.br',

  // Formato do código gerado automaticamente na abertura.
  SCGAR_PREFIXO: 'SCGAR-',
  SCGAR_DIGITOS: 4,

  // A numeração continua a partir daqui. O último código em uso é o
  // SCGAR-5211, então o próximo sai SCGAR-5212, depois 5213, e assim por
  // diante. O sistema guarda o último número entregue, então códigos maiores
  // que existam na planilha por herança de outros sistemas não interferem.
  // Para reiniciar a contagem: mude o número aqui e apague a propriedade
  // gar_ultimo_scgar em Configurações do projeto > Propriedades do script.
  SCGAR_MINIMO: 5211,

  // Segundos que a lista fica guardada em memória (deixa a tela rápida).
  CACHE_LISTA_SEG: 180,
  CACHE_OPCOES_SEG: 21600,

  // Endereço de uma imagem do logo (PNG/SVG público). Vazio = usa o nome escrito.
  LOGO_URL: '',

  // ---------------- Anexos no Google Drive ----------------
  // Pasta-mãe onde será criada uma subpasta por solicitação, com o nome do
  // SCGAR (ex.: SCGAR-5212). É o trecho depois de /folders/ no endereço.
  PASTA_DRIVE_ID: '1IUG089u2h0i3VEHRADwY_HuZTT9pRIVc',

  // Anexar arquivo é obrigatório para abrir a solicitação.
  ANEXO_OBRIGATORIO: true,

  // Limite somado de todos os anexos de uma solicitação, em MB.
  ANEXO_MAX_MB: 25
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
  // Ordem aqui = ordem em que os campos aparecem na tela.
  { cab: 'SCGAR',                 tipo: 'texto',  grupo: 'Identificação', lista: true, auto: true , filtro: true },
  { cab: 'Data de Solicitação',   tipo: 'data',   grupo: 'Identificação', lista: true, auto: true, sol: true , filtro: true },
  { cab: 'RMA / OS (Nº)',         tipo: 'texto',  grupo: 'Identificação', lista: true, sol: true, obrig: true , filtro: true },
  { cab: 'Tipo de Acionamento',   tipo: 'select', grupo: 'Identificação', lista: true, sol: true, obrig: true, opcoesDaValidacao: true, listaFechada: true , filtro: true },
  { cab: 'UFV de Origem',         tipo: 'select', grupo: 'Identificação', lista: true, sol: true, opcoesDaValidacao: true, listaFechada: true , filtro: true },
  { cab: 'Fornecedor',            tipo: 'select', grupo: 'Identificação', lista: true, sol: true, opcoesDaValidacao: true, listaFechada: true , filtro: true },
  { cab: 'Material/Equipamento',  tipo: 'select', grupo: 'Identificação', lista: true, sol: true, opcoesDaValidacao: true, listaFechada: true },
  { cab: 'Qtd',                   tipo: 'inteiro', grupo: 'Identificação', lista: true, sol: true },
  { cab: 'Motivo Inicial',        tipo: 'area',   grupo: 'Identificação', sol: true },
  { cab: 'Equipamento Principal', tipo: 'select', grupo: 'Identificação', sol: true, opcoesDaValidacao: true, listaFechada: true },
  { cab: 'MAC',                   tipo: 'codigo', grupo: 'Identificação', sol: true },
  { cab: 'NS',                    tipo: 'codigo', grupo: 'Identificação', lista: true, sol: true },
  { cab: 'CÓD MXM (FÓRMULA)',     tipo: 'formula', grupo: 'Identificação' },

  // --- Triagem -------------------------------------------------------
  { cab: 'Status Geral do Acionamento', tipo: 'select', opcoes: STATUS_GERAL, grupo: 'Triagem', lista: true },
  { cab: 'Responsável Atual',     tipo: 'select', grupo: 'Triagem', lista: true, opcoesDaColuna: true , filtro: true },
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
  { cab: 'Aprov Marcella (Envio)',                      tipo: 'data', grupo: 'Envio' },
  { cab: 'Aprov Felipe (Envio)',                        tipo: 'data', grupo: 'Envio' },
  { cab: 'Data  envio/Coleta',            tipo: 'data',   grupo: 'Envio' },
  { cab: 'Codigo Rastreio / Romaneio RFQ', ocor: 1, tipo: 'texto', grupo: 'Envio', rotulo: 'Código Rastreio / Romaneio RFQ (envio)' },
  { cab: 'Data Chegada no Fornecedor',    tipo: 'data',   grupo: 'Envio' },
  { cab: 'Comentarios',                   tipo: 'area',   grupo: 'Envio' },

  // --- Análise / Reparo ----------------------------------------------
  { cab: 'Coberto em Garantia',      tipo: 'select', opcoes: SIM_NAO,   grupo: 'Análise / Reparo', lista: true },
  { cab: 'Valor Reparo',             tipo: 'moeda',  grupo: 'Análise / Reparo' },
  { cab: 'Aprov Marcella (Reparo)',                     tipo: 'data', grupo: 'Análise / Reparo' },
  { cab: 'Aprov Felipe (Reparo)',                       tipo: 'data', grupo: 'Análise / Reparo' },

  // --- Retorno -------------------------------------------------------
  { cab: 'Valor do Frete / Envio Estimado (Retorno)', tipo: 'moeda',  grupo: 'Retorno' },
  { cab: 'Via',                                tipo: 'texto',  grupo: 'Retorno' },
  { cab: 'Aprov Marcella (Retorno)',                    tipo: 'data', grupo: 'Retorno' },
  { cab: 'Aprov Felipe (Retorno)',                      tipo: 'data', grupo: 'Retorno' },
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
/* Auditoria — registro de tudo que foi criado ou alterado             */
/* ================================================================== */

/**
 * Cabeçalhos da aba de auditoria. Como no resto do sistema, tudo é localizado
 * pelo TEXTO do cabeçalho, então as colunas podem ser reordenadas na aba.
 */
const AUD = {
  DATA:    'Data / Hora',
  USUARIO: 'Usuário',
  ACAO:    'Ação',
  LINHA:   'Linha',
  SC:      'SC',
  CAMPO:   'Campo',
  DEPARA:  'De → Para'
};

/** Como o valor aparece no registro. Vazio vira "(vazio)". */
function _audValor(v) {
  const t = String(v == null ? '' : v).trim();
  return t === '' ? '(vazio)' : t;
}

/**
 * Grava as entradas na aba de auditoria, todas de uma vez.
 *
 * entradas = [{ linha, sc, campo, de, para }]
 *
 * Nunca derruba a operação principal: se o registro falhar, a gravação da
 * planilha continua valendo e o erro fica só no log do script.
 */
function _registrarAuditoria(acao, entradas) {
  if (!CONFIG.ABA_AUDITORIA || !entradas || !entradas.length) return;

  try {
    const ss = _abrirPlanilha();
    const aba = ss.getSheetByName(CONFIG.ABA_AUDITORIA);
    if (!aba) return;

    const linhaCab = CONFIG.AUDITORIA_HEADER_ROW || 1;
    const largura = Math.max(aba.getLastColumn(), 1);
    const titulos = aba.getRange(linhaCab, 1, 1, largura).getDisplayValues()[0];

    const onde = {};
    titulos.forEach(function (t, i) {
      const chave = _normalizar(t);
      if (chave && onde[chave] === undefined) onde[chave] = i;
    });

    function pos(nome) {
      const i = onde[_normalizar(nome)];
      return i === undefined ? -1 : i;
    }

    const cols = {
      data: pos(AUD.DATA),
      usuario: pos(AUD.USUARIO),
      acao: pos(AUD.ACAO),
      linha: pos(AUD.LINHA),
      sc: pos(AUD.SC) >= 0 ? pos(AUD.SC) : pos('SCGAR'),
      campo: pos(AUD.CAMPO),
      depara: pos(AUD.DEPARA) >= 0 ? pos(AUD.DEPARA) : pos('De -> Para')
    };

    const agora = new Date();
    const usuario = Session.getActiveUser().getEmail() || '';

    const bloco = entradas.map(function (e) {
      const linha = new Array(largura).fill('');
      if (cols.data >= 0) linha[cols.data] = agora;
      if (cols.usuario >= 0) linha[cols.usuario] = usuario;
      if (cols.acao >= 0) linha[cols.acao] = acao;
      if (cols.linha >= 0) linha[cols.linha] = e.linha || '';
      if (cols.sc >= 0) linha[cols.sc] = e.sc || '';
      if (cols.campo >= 0) linha[cols.campo] = e.campo || '';
      if (cols.depara >= 0) linha[cols.depara] = _audValor(e.de) + ' → ' + _audValor(e.para);
      return linha;
    });

    const inicio = Math.max(aba.getLastRow(), linhaCab) + 1;
    if (inicio + bloco.length - 1 > aba.getMaxRows()) {
      aba.insertRowsAfter(aba.getMaxRows(), bloco.length + 100);
    }
    aba.getRange(inicio, 1, bloco.length, largura).setValues(bloco);
  } catch (erro) {
    console.error('Auditoria não registrada: ' + erro.message);
  }
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

  const opcoes = _opcoesDeCampos(aba, mapa);

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
      fixo: c.opcoes ? true : ((opcoes[_idCampo(c)] || {}).fixo || false),
      opcoes: c.opcoes || ((opcoes[_idCampo(c)] || {}).vals || null)
    };
  });

  return {
    usuario: Session.getActiveUser().getEmail(),
    campos: campos,
    grupos: GRUPOS,
    status: STATUS_GERAL,
    faltando: faltando,
    logoUrl: CONFIG.LOGO_URL,
    anexoObrigatorio: !!CONFIG.ANEXO_OBRIGATORIO,
    anexoMaxMb: CONFIG.ANEXO_MAX_MB
  };
}

/**
 * Monta as listas suspensas de cada campo.
 *
 * Para os campos marcados com opcoesDaValidacao, lê a REGRA DE VALIDAÇÃO DE
 * DADOS da própria coluna — é assim que as mesmas opções que você vê ao
 * preencher a planilha (inclusive as que vêm de outra aba) chegam à tela.
 * Se a coluna não tiver regra, cai para os valores já digitados nela.
 */
function _opcoesDeCampos(aba, mapa) {
  const chave = 'gar_opcoes_v2';
  const guardado = _cacheLer(chave);
  if (guardado) {
    try { return JSON.parse(guardado); } catch (e) { /* segue e recalcula */ }
  }

  const primeira = CONFIG.HEADER_ROW + 1;
  const ultima = aba.getLastRow();
  const resultado = {};

  CAMPOS.filter(function (c) { return c.opcoesDaValidacao || c.opcoesDaColuna; }).forEach(function (c) {
    const col = _coluna(mapa, c);
    if (!col) return;

    let vals = null;
    if (c.opcoesDaValidacao) vals = _opcoesDaValidacao(aba, col, primeira, ultima);

    if (vals && vals.length) {
      resultado[_idCampo(c)] = { vals: vals, fixo: true };
    } else {
      // Sem regra de validação: usa o que já existe na coluna. Os campos
      // marcados com listaFechada continuam sendo lista fechada, para que
      // todos tenham a mesma aparência na tela.
      resultado[_idCampo(c)] = {
        vals: _valoresJaUsados(aba, col, primeira, ultima),
        fixo: !!c.listaFechada
      };
    }
  });

  _cacheGravar(chave, JSON.stringify(resultado), CONFIG.CACHE_OPCOES_SEG);
  return resultado;
}

/** Lê a lista suspensa configurada na coluna, seja fixa ou vinda de outra aba. */
function _opcoesDaValidacao(aba, col, primeira, ultima) {
  // A regra costuma estar aplicada nas linhas de dados. Testa algumas.
  const candidatas = [];
  if (ultima >= primeira) {
    candidatas.push(ultima, ultima - 1, Math.floor((primeira + ultima) / 2), primeira);
  }
  candidatas.push(CONFIG.HEADER_ROW + 1);

  for (let i = 0; i < candidatas.length; i++) {
    const linha = candidatas[i];
    if (linha <= CONFIG.HEADER_ROW) continue;

    let regra = null;
    try { regra = aba.getRange(linha, col).getDataValidation(); } catch (e) { regra = null; }
    if (!regra) continue;

    const criterio = regra.getCriteriaType();
    const args = regra.getCriteriaValues();

    if (criterio === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      return _limparLista(args[0] || []);
    }
    if (criterio === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
      try {
        const planos = args[0].getDisplayValues().map(function (l) { return l[0]; });
        return _limparLista(planos);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

/** Tira vazios e repetidos, preservando a ordem original da lista. */
function _limparLista(bruta) {
  const vistos = {};
  const saida = [];
  (bruta || []).forEach(function (v) {
    const t = String(v == null ? '' : v).trim();
    if (!t || vistos[t]) return;
    vistos[t] = true;
    saida.push(t);
  });
  return saida;
}

/** Valores já digitados na coluna, em ordem alfabética. Usado como reserva. */
function _valoresJaUsados(aba, col, primeira, ultima) {
  if (ultima < primeira) return [];
  const valores = aba.getRange(primeira, col, ultima - primeira + 1, 1).getDisplayValues();
  const vistos = {};
  valores.forEach(function (l) {
    const v = String(l[0] || '').trim();
    if (v) vistos[v] = true;
  });
  return Object.keys(vistos).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
}

/* ================================================================== */
/* Módulo Processos — lista                                            */
/* ================================================================== */

/**
 * ÍNDICE LEVE de todos os acionamentos.
 *
 * Devolve só o necessário para filtrar, contar e paginar na tela — nunca as 49
 * colunas de 840 linhas de uma vez. O conteúdo completo de cada página é
 * buscado depois, por paginaProcessos(), já filtrado.
 */
function listarProcessos(forcar) {
  const chave = 'gar_lista_v3';
  if (!forcar) {
    const guardado = _cacheLer(chave);
    if (guardado) {
      try { return JSON.parse(guardado); } catch (e) { /* segue e recalcula */ }
    }
  }

  const aba = _aba();
  const mapa = _mapaCabecalhos(aba);
  const ativos = _camposAtivos(mapa);
  const primeira = CONFIG.HEADER_ROW + 1;
  const ultima = aba.getLastRow();

  // Todas as colunas da aba viram colunas da tabela, na ordem definida em CAMPOS
  const colunas = ativos.map(function (i) {
    return { id: _idCampo(i.campo), rotulo: i.campo.rotulo || i.campo.cab, tipo: i.campo.tipo };
  });

  const filtraveis = ativos.filter(function (i) { return i.campo.filtro; });
  const colStatus = _coluna(mapa, { cab: CAB_STATUS });
  const colScgar = _coluna(mapa, { cab: CAB_SCGAR });

  const saida = {
    colunas: colunas,
    filtros: filtraveis.map(function (i) {
      return { id: _idCampo(i.campo), rotulo: i.campo.rotulo || i.campo.cab, tipo: i.campo.tipo };
    }),
    opcoes: {},
    itens: []
  };

  if (ultima < primeira) {
    _cacheGravar(chave, JSON.stringify(saida), CONFIG.CACHE_LISTA_SEG);
    return saida;
  }

  const bloco = aba.getRange(primeira, 1, ultima - primeira + 1, aba.getLastColumn()).getDisplayValues();
  const vistos = {};
  filtraveis.forEach(function (i) { vistos[_idCampo(i.campo)] = {}; });

  bloco.forEach(function (linha, idx) {
    const vazia = linha.every(function (v) { return String(v).trim() === ''; });
    if (vazia) return;

    const item = {
      linha: primeira + idx,
      scgar: colScgar ? String(linha[colScgar - 1] || '').trim() : '',
      status: colStatus ? String(linha[colStatus - 1] || '').trim() : '',
      f: {},
      busca: ''
    };

    filtraveis.forEach(function (i) {
      const id = _idCampo(i.campo);
      const v = String(linha[i.col - 1] || '').trim();
      item.f[id] = v;
      if (v && i.campo.tipo !== 'data' && i.campo.tipo !== 'texto') vistos[id][v] = true;
      if (v && i.campo.tipo === 'select') vistos[id][v] = true;
    });

    // Texto usado pela busca livre: toda a linha
    item.busca = linha.join(' ').toLowerCase();
    saida.itens.push(item);
  });

  // Opções que existem de fato, para as caixinhas de filtro
  filtraveis.forEach(function (i) {
    const id = _idCampo(i.campo);
    if (i.campo.tipo === 'data' || i.campo.tipo === 'texto') return;
    saida.opcoes[id] = Object.keys(vistos[id]).sort(function (a, b) {
      return a.localeCompare(b, 'pt-BR');
    });
  });

  const contagem = {};
  saida.itens.forEach(function (i) { contagem[i.status] = (contagem[i.status] || 0) + 1; });
  saida.contagemStatus = contagem;

  saida.itens.reverse(); // mais recentes primeiro
  _cacheGravar(chave, JSON.stringify(saida), CONFIG.CACHE_LISTA_SEG);
  return saida;
}

/**
 * Conteúdo completo (todas as colunas) das linhas de UMA página.
 * Lê um único intervalo, do menor ao maior número de linha pedido.
 */
function paginaProcessos(linhas) {
  const pedidas = (linhas || []).map(Number).filter(function (n) {
    return n > CONFIG.HEADER_ROW;
  });
  if (!pedidas.length) return {};

  let min = pedidas[0], max = pedidas[0];
  pedidas.forEach(function (n) { if (n < min) min = n; if (n > max) max = n; });

  const aba = _aba();
  const ultima = aba.getLastRow();
  if (max > ultima) max = ultima;
  if (min > max) return {};

  const mapa = _mapaCabecalhos(aba);
  const ativos = _camposAtivos(mapa);
  const bloco = aba.getRange(min, 1, max - min + 1, aba.getLastColumn()).getDisplayValues();

  const saida = {};
  pedidas.forEach(function (n) {
    const linha = bloco[n - min];
    if (!linha) return;
    const o = {};
    ativos.forEach(function (i) { o[_idCampo(i.campo)] = String(linha[i.col - 1] || ''); });
    saida[n] = o;
  });
  return saida;
}

/**
 * EDIÇÃO EM LOTE — aplica os mesmos valores a várias linhas.
 *
 * Grava uma coluna por vez, em um único movimento, preservando o conteúdo e as
 * fórmulas das linhas que NÃO foram selecionadas. Passa pelas mesmas regras da
 * edição individual (data só aceita data, Qtd só inteiro, valor em número).
 */
function salvarLote(linhas, alteracoes) {
  const pedidas = (linhas || []).map(Number).filter(function (n) {
    return n > CONFIG.HEADER_ROW;
  });
  if (!pedidas.length) throw new Error('Nenhum acionamento selecionado.');

  const trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    const aba = _aba();
    const ultima = aba.getLastRow();
    const mapa = _mapaCabecalhos(aba);

    const alvo = {};
    let min = 0, max = 0;
    pedidas.forEach(function (n) {
      if (n > ultima) return;
      alvo[n] = true;
      if (!min || n < min) min = n;
      if (n > max) max = n;
    });
    if (!min) throw new Error('As linhas selecionadas não existem mais. Atualize a lista.');

    const porId = {};
    _camposAtivos(mapa).forEach(function (item) { porId[_idCampo(item.campo)] = item; });

    const altura = max - min + 1;
    let campos = 0, celulas = 0;
    const registro = [];

    // Códigos SCGAR das linhas atingidas, para o registro de auditoria
    const colScgar = _coluna(mapa, { cab: CAB_SCGAR });
    const scgarPorLinha = {};
    if (colScgar) {
      aba.getRange(min, colScgar, altura, 1).getDisplayValues().forEach(function (l, r) {
        scgarPorLinha[min + r] = String(l[0] || '').trim();
      });
    }

    Object.keys(alteracoes || {}).forEach(function (id) {
      const item = porId[id];
      if (!item) return;
      if (item.campo.tipo === 'formula' || item.campo.auto) return;

      const valor = _paraPlanilha(item.campo, alteracoes[id]);
      const faixa = aba.getRange(min, item.col, altura, 1);
      const valores = faixa.getValues();
      const formulas = faixa.getFormulas();
      const antes = faixa.getDisplayValues();
      const rotulo = (item.campo.rotulo || item.campo.cab).toUpperCase();

      const novos = [];
      for (let r = 0; r < altura; r++) {
        if (alvo[min + r]) {
          novos.push([valor === null ? '' : valor]);
          celulas++;
        } else {
          // Linha não selecionada: devolve exatamente o que já estava lá,
          // inclusive fórmula, para nada ser perdido.
          novos.push([formulas[r][0] ? formulas[r][0] : valores[r][0]]);
        }
      }

      if (item.campo.tipo === 'codigo') faixa.setNumberFormat('@');
      faixa.setValues(novos);
      campos++;

      const depois = faixa.getDisplayValues();
      for (let r = 0; r < altura; r++) {
        if (!alvo[min + r]) continue;
        registro.push({
          linha: min + r,
          sc: scgarPorLinha[min + r] || '',
          campo: rotulo,
          de: antes[r][0],
          para: depois[r][0]
        });
      }
    });

    if (celulas) _cacheLimpar('gar_lista_v3');
    SpreadsheetApp.flush();
    _registrarAuditoria('Edição em lote', registro);
    return { ok: true, campos: campos, celulas: celulas, linhas: Object.keys(alvo).length };
  } finally {
    trava.releaseLock();
  }
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
  if (campo.tipo === 'codigo') return String(mostrado == null ? '' : mostrado);
  if (campo.tipo === 'inteiro') {
    if (typeof bruto === 'number') return String(Math.round(bruto));
    return String(mostrado || '').replace(/[^0-9]/g, '');
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

  const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const d = new Date(ano, mes - 1, dia);
  // Recusa datas que "viram o mês" (31/02, 45/13 e afins)
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
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

    const scgarLinha = colScgar
      ? String(aba.getRange(linha, colScgar).getDisplayValue() || '').trim()
      : String(scgarEsperado || '');

    let gravados = 0;
    const registro = [];

    Object.keys(alteracoes || {}).forEach(function (id) {
      const item = porId[id];
      if (!item) return;                       // cabeçalho não existe: ignora
      if (item.campo.tipo === 'formula') return; // coluna de fórmula: não toca
      if (item.campo.auto) return;               // SCGAR e data de abertura: não toca

      const celula = aba.getRange(linha, item.col);
      const antes = String(celula.getDisplayValue() || '');

      const valor = _paraPlanilha(item.campo, alteracoes[id]);
      if (valor === null) {
        celula.clearContent();
      } else {
        if (item.campo.tipo === 'codigo') celula.setNumberFormat('@');
        celula.setValue(valor);
      }
      gravados++;

      registro.push({
        linha: linha,
        sc: scgarLinha,
        campo: (item.campo.rotulo || item.campo.cab).toUpperCase(),
        de: antes,
        para: String(celula.getDisplayValue() || '')
      });
    });

    if (gravados) _cacheLimpar('gar_lista_v3');
    SpreadsheetApp.flush();
    _registrarAuditoria('Edição', registro);
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
    if (!d) {
      throw new Error('O campo "' + (campo.rotulo || campo.cab) + '" aceita apenas data.');
    }
    return d;
  }
  if (campo.tipo === 'inteiro') {
    if (!/^[0-9]+$/.test(txt)) {
      throw new Error('O campo "' + (campo.rotulo || campo.cab) +
        '" aceita apenas números inteiros — sem vírgula, ponto, letra ou espaço.');
    }
    return Number(txt);
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

function criarSolicitacao(dados, arquivos) {
  arquivos = arquivos || [];

  if (CONFIG.ANEXO_OBRIGATORIO && !arquivos.length) {
    throw new Error('Anexe ao menos um arquivo para abrir a solicitação.');
  }
  _conferirTamanhoAnexos(arquivos);

  const trava = LockService.getScriptLock();
  trava.waitLock(120000);
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

    // Os anexos vão para o Drive ANTES de a linha ser criada. Se algo falhar
    // aqui, nada é gravado na planilha e o usuário pode tentar de novo.
    const pasta = arquivos.length ? _guardarAnexos(scgar, arquivos) : null;

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

    // MAC e NS entram como texto puro, para não perder zero à esquerda
    ativos.forEach(function (item) {
      if (item.campo.tipo === 'codigo') aba.getRange(linhaNova, item.col).setNumberFormat('@');
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
    _cacheLimpar('gar_lista_v3');
    _cacheLimpar('gar_opcoes_v2');

    // Registra a abertura: uma entrada por campo preenchido pelo solicitante
    const registro = [{
      linha: linhaNova,
      sc: scgar,
      campo: 'ABERTURA DA SOLICITAÇÃO',
      de: '',
      para: scgar + (arquivos.length
        ? ' · ' + arquivos.length + (arquivos.length === 1 ? ' anexo' : ' anexos')
        : '')
    }];
    ativos.forEach(function (item) {
      const c = item.campo;
      if (!c.sol || c.auto) return;
      const v = String((dados || {})[_idCampo(c)] || '').trim();
      if (!v) return;
      registro.push({
        linha: linhaNova,
        sc: scgar,
        campo: (c.rotulo || c.cab).toUpperCase(),
        de: '',
        para: v
      });
    });
    _registrarAuditoria('Solicitação', registro);

    _avisarPorEmail(scgar, dados, ativos, linhaNova, pasta, arquivos);

    return {
      ok: true,
      scgar: scgar,
      linha: linhaNova,
      pastaUrl: pasta ? pasta.url : '',
      anexos: arquivos.length
    };
  } finally {
    trava.releaseLock();
  }
}

/** Barra o envio quando a soma dos anexos passa do limite. */
function _conferirTamanhoAnexos(arquivos) {
  let bytes = 0;
  arquivos.forEach(function (a) {
    // base64 ocupa 4 caracteres a cada 3 bytes de arquivo
    bytes += Math.floor(String(a.dados || '').length * 3 / 4);
  });
  const limite = CONFIG.ANEXO_MAX_MB * 1024 * 1024;
  if (bytes > limite) {
    throw new Error('Os anexos somam ' + (bytes / 1048576).toFixed(1) +
      ' MB e o limite é ' + CONFIG.ANEXO_MAX_MB + ' MB. Envie arquivos menores.');
  }
}

/**
 * Cria (ou reaproveita) a pasta com o nome do SCGAR dentro da pasta-mãe e
 * grava os anexos lá dentro.
 */
function _guardarAnexos(scgar, arquivos) {
  if (!CONFIG.PASTA_DRIVE_ID) {
    throw new Error('A pasta do Drive não está configurada (CONFIG.PASTA_DRIVE_ID).');
  }

  let mae;
  try {
    mae = DriveApp.getFolderById(CONFIG.PASTA_DRIVE_ID);
  } catch (e) {
    throw new Error('Não foi possível abrir a pasta do Drive. Confira o CONFIG.PASTA_DRIVE_ID e se você tem acesso a ela.');
  }

  // Se a pasta do SCGAR já existir, usa a que existe em vez de duplicar
  let pasta;
  const iguais = mae.getFoldersByName(scgar);
  pasta = iguais.hasNext() ? iguais.next() : mae.createFolder(scgar);

  const salvos = [];
  arquivos.forEach(function (a) {
    const nome = _nomeSeguro(a.nome);
    try {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(a.dados),
        a.tipo || 'application/octet-stream',
        nome
      );
      const arq = pasta.createFile(blob);
      salvos.push({ nome: arq.getName(), url: arq.getUrl() });
    } catch (e) {
      throw new Error('Falha ao gravar o anexo "' + nome + '": ' + e.message);
    }
  });

  return { id: pasta.getId(), nome: pasta.getName(), url: pasta.getUrl(), arquivos: salvos };
}

/** Tira do nome do arquivo o que o Drive não aceita bem. */
function _nomeSeguro(nome) {
  const limpo = String(nome || 'arquivo')
    .replace(/[\\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return limpo.substring(0, 120) || 'arquivo';
}

/** Monta o código no formato SCGAR-0001 a partir do número. */
function _formatarScgar(numero) {
  const txt = String(numero);
  const zeros = Math.max(0, CONFIG.SCGAR_DIGITOS - txt.length);
  return CONFIG.SCGAR_PREFIXO + new Array(zeros + 1).join('0') + txt;
}

/**
 * Próximo código da sequência.
 *
 * A contagem parte de CONFIG.SCGAR_MINIMO e avança de um em um, guardando o
 * último número entregue nas propriedades do script. Assim a sequência é
 * SCGAR-5212, SCGAR-5213, SCGAR-5214... independentemente de existirem na
 * planilha códigos antigos com numeração mais alta, herdados de outros
 * sistemas. Antes de entregar, confere se o código já está em uso na coluna
 * SCGAR e pula para o seguinte se estiver.
 */
function _proximoScgar(aba, mapa) {
  const props = PropertiesService.getScriptProperties();
  let ultimo = Number(props.getProperty('gar_ultimo_scgar') || 0);
  if (!ultimo || ultimo < CONFIG.SCGAR_MINIMO) ultimo = CONFIG.SCGAR_MINIMO;

  const usados = {};
  const col = _coluna(mapa, { cab: CAB_SCGAR });
  if (col) {
    const primeira = CONFIG.HEADER_ROW + 1;
    const ultima = aba.getLastRow();
    if (ultima >= primeira) {
      aba.getRange(primeira, col, ultima - primeira + 1, 1)
        .getDisplayValues()
        .forEach(function (l) {
          const v = String(l[0] || '').trim();
          if (v) usados[v.toUpperCase()] = true;
        });
    }
  }

  let numero = ultimo + 1;
  let codigo = _formatarScgar(numero);
  let voltas = 0;
  while (usados[codigo.toUpperCase()] && voltas < 100000) {
    numero++;
    codigo = _formatarScgar(numero);
    voltas++;
  }

  props.setProperty('gar_ultimo_scgar', String(numero));
  return codigo;
}

function _avisarPorEmail(scgar, dados, ativos, linhaNova, pasta, arquivos) {
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

    let blocoPasta = '';
    if (pasta) {
      const nomes = (pasta.arquivos || []).map(function (a) {
        return '<li style="margin:2px 0">' + a.nome + '</li>';
      }).join('');
      blocoPasta =
        '<div style="padding:14px 12px 0">' +
          '<a href="' + pasta.url + '" style="display:inline-block;background:#EC6E2D;color:#fff;' +
          'text-decoration:none;font-weight:600;font-size:13px;padding:10px 18px;border-radius:8px">' +
          'Abrir a pasta ' + pasta.nome + ' no Drive</a>' +
          '<ul style="margin:12px 0 0;padding-left:20px;font-size:12.5px;color:#5b6670">' + nomes + '</ul>' +
        '</div>';
    }

    const html =
      '<div style="font-family:Montserrat,Arial,sans-serif;color:#0A0F14;max-width:620px">' +
        '<div style="background:#EC6E2D;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0">' +
          '<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">SolarGrid — Garantias</div>' +
          '<div style="font-size:19px;font-weight:700;margin-top:2px">Nova solicitação ' + scgar + '</div>' +
        '</div>' +
        '<div style="border:1px solid #D8D8D8;border-top:none;border-radius:0 0 12px 12px;padding:8px 0 14px">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px">' + linhas + '</table>' +
          blocoPasta +
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

/* ================================================================== */
/* Fim da caixa — o que a tela pode chamar                             */
/* ================================================================== */

  return {
    doGet: doGet,
    carregarInicio: carregarInicio,
    listarProcessos: listarProcessos,
    paginaProcessos: paginaProcessos,
    salvarLote: salvarLote,
    obterProcesso: obterProcesso,
    salvarProcesso: salvarProcesso,
    criarSolicitacao: criarSolicitacao
  };

})();

/* ==================================================================
   PONTES GLOBAIS
   São as únicas funções deste arquivo visíveis para o resto do projeto.
   Todas levam o prefixo gar_ justamente para não colidir com nada.
   A única sem prefixo é a doGet, exigida pelo Google para abrir o link
   do app da Web. Se este projeto JÁ tiver outra função chamada doGet,
   me avise — nesse caso as duas precisam ser unificadas em uma só.
   ================================================================== */

function doGet(e) {
  return GAR_GARANTIAS.doGet(e);
}

function gar_carregarInicio() {
  return GAR_GARANTIAS.carregarInicio();
}

function gar_listarProcessos(forcar) {
  return GAR_GARANTIAS.listarProcessos(forcar);
}

function gar_paginaProcessos(linhas) {
  return GAR_GARANTIAS.paginaProcessos(linhas);
}

function gar_salvarLote(linhas, alteracoes) {
  return GAR_GARANTIAS.salvarLote(linhas, alteracoes);
}

function gar_obterProcesso(linha) {
  return GAR_GARANTIAS.obterProcesso(linha);
}

function gar_salvarProcesso(linha, scgarEsperado, alteracoes) {
  return GAR_GARANTIAS.salvarProcesso(linha, scgarEsperado, alteracoes);
}

function gar_criarSolicitacao(dados, arquivos) {
  return GAR_GARANTIAS.criarSolicitacao(dados, arquivos);
}
