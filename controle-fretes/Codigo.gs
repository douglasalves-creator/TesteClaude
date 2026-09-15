/**
 * CONTROLE DE FRETES — backend (Google Apps Script)
 *
 * Projeto separado do Painel de Aprovação, mas lendo e gravando na MESMA aba
 * de controle que a equipe já usa: "Controle de Frete 2024_2025_2026".
 *
 * Três módulos dentro de um único HTML:
 *   1. Formulário — abre uma nova RFQ (linha nova na aba, status "Solicitado").
 *   2. Processos  — lista tudo, filtra e atualiza cotação, datas e status.
 *   3. Painel     — indicadores de volume, custo, prazo e gargalos.
 *
 * REGRAS DE CONVIVÊNCIA COM A PLANILHA:
 *   - Nenhuma coluna é criada, renomeada ou reordenada. O script procura as
 *     colunas pelo nome do cabeçalho (ignorando acento, espaço e maiúscula).
 *   - O cabeçalho real está na 2ª linha (a 1ª linha é o agrupamento visual):
 *     o script localiza sozinho a linha do cabeçalho.
 *   - A única aba criada é a de histórico (CF_CONFIG.SHEET_HIST), usada para
 *     registrar quem mudou o quê. Se você não quiser, deixe o nome em branco.
 *
 * Tudo aqui usa o prefixo cf/CF_ para nunca conflitar com o script do painel
 * de aprovação, caso os dois acabem no mesmo projeto do Apps Script.
 */

const CF_CONFIG = {
  // Planilha de controle. Deixe '' para usar a planilha à qual o script está
  // vinculado (necessário se você colar este código dentro da própria planilha).
  SPREADSHEET_ID: '1qpdy4YIP3i981Ds-MNsjADZF0NaTm4LE4Q6pAsxgveE',

  SHEET_NAME: 'Controle de Frete 2024_2025_2026',

  // Aba de histórico das alterações feitas pelo sistema. '' desliga o registro.
  SHEET_HIST: 'Histórico do Controle',

  // Nomes possíveis do arquivo HTML dentro do projeto.
  HTML_FILES: ['ControleFretes', 'Controle de Fretes', 'App'],

  EMPRESA_NOME: 'SolarGrid',

  // E-mail avisado a cada nova solicitação. '' desativa.
  EMAIL_AVISO: '',

  // Quantas linhas procurar até achar o cabeçalho real.
  HEADER_SCAN_ROWS: 20,

  // Status considerados encerrados (saem da carteira em aberto).
  STATUS_FINAIS: ['Concluído', 'Cancelado', 'CANCELADO'],

  // Status gravado em uma solicitação nova.
  STATUS_INICIAL: 'Solicitado',

  // Uma solicitação em aberto sem transportadora definida há este nº de dias
  // aparece em "Parados" no painel.
  DIAS_PARADO: 7,

  /* ---------------- Listas dos campos de seleção ---------------- */
  // Vieram da própria planilha (abas "Tipos" e histórico da aba de controle).
  STATUS: ['Solicitado', 'Em cotação', 'Ag Aprovação', 'Em programação',
    'Pendente Atualização do responsável', 'Pendente Solicitar Pagamento',
    'Concluído', 'Cancelado'],

  SETORES: ['O&M', 'Supply', 'Compras', 'Site', 'Engenharia', 'Obras'],

  MOTIVOS: ['Coleta Fornecedor (COMPRA FOB)', 'Transferências entre usinas (COM FRETE)',
    'Transferências entre usinas (SEM FRETE)', 'Compra', 'Frete de Garantia - ENVIO',
    'Frete de Garantia - RETORNO', 'Frete de Garantia', 'Envio para Conserto',
    'Retorno de Conserto', 'Devolução', 'Locação', 'Sinistro', 'Outro'],

  MODALIDADES: ['Rodoviário', 'Aéreo', 'Marítimo', 'Postagem / Correio'],

  TIPOS_FRETE: ['Frete', 'Dedicado', 'Fracionado', 'FOB', 'CIF', 'Transferência'],

  TIPOS_VOLUME: ['Caixa', 'Pallet', 'Bobina', 'und', 'M', 'Fardo', 'Contêiner',
    'Carga solta', 'Carga projetada'],

  VEICULOS: ['A definir', 'Fiorino', 'Kangoo', 'Saveiro', 'Strada', 'Van', 'Furgão',
    'Vuc', 'Bongo', '3/4', 'Toco', 'Truck', '8.150E DELIVERY', 'Carreta',
    'Prancha', 'Munck', 'Aéreo', 'postagem'],

  PRIORIDADES: ['Normal', 'Urgente', 'Crítica (parada de obra)'],

  STATUS_PAGAMENTO: ['', 'A solicitar', 'Solicitado', 'Pago', 'Não se aplica']
};

/**
 * De/para entre as chaves usadas no sistema e os nomes reais das colunas.
 * Se um dia o cabeçalho da planilha mudar, ajuste SÓ o texto da direita.
 */
const CF_CAMPOS = {
  rfq: 'RFQ',
  rota: 'Rota',
  dataSolicitacao: 'Data de Solicitação',
  ano: 'Ano',
  status: 'Status da SC',
  setor: 'Setor Solicitante',
  motivo: 'Motivo do Frete',
  modalidade: 'Modalidade',
  tipoFrete: 'Tipo de Frete',
  rfqAgrupadas: 'RFQ Agrupadas',
  empresa: 'Empresa',
  material: 'Material',
  qtde: 'Qtde solicitada',
  especificacao: 'Especificação/Serie',
  dimensoes: 'Dimensões Unitaria',
  m3: 'M3 Total',
  peso: 'Peso Total ( KG)',
  ncm: 'NCM',
  tipoVolume: 'Tipo de Volume',
  qtdeVolume: 'Qtde de volume',
  valorUnitario: 'Valor Unitário',
  valorNF: 'Valor da NF.',
  nf: 'NF/ TIQUETE / RMA',
  origem: 'Origem',
  cnpjOrigem: 'CNPJ de Origem',
  enderecoOrigem: 'Endereço da Origem',
  linkOrigem: 'Link Coordenadas Origem',
  destino: 'Destino',
  cnpjDestino: 'CNPJ de Destino',
  enderecoDestino: 'Endereço de Destino',
  linkDestino: 'Link Coordenadas Destino',
  km: 'Total KM a percorrer',
  transportadora: 'Transportadora Aprovada',
  valorAprovado: 'Valor (All In)',
  aprovacao: 'Aprovação da Cotação',
  aprovador: 'Aprovador',
  justificativa: 'Justificativa de frete',
  dataColeta: 'Data de Coleta',
  previsaoEntrega: 'Previsão de Entrega',
  dataEntrega: 'Data da entrega',
  motorista: 'Nome Motorista',
  placa: 'Placa',
  veiculo: 'Veiculo',
  cte: 'CTE',
  centroCusto: 'Centro de Custo',
  statusPagamento: 'Status de pagamento',
  trajeto: 'Trajeto'
};

/** Campos que o formulário de solicitação grava. */
const CF_CAMPOS_FORM = ['setor', 'motivo', 'modalidade', 'tipoFrete', 'empresa',
  'material', 'qtde', 'especificacao', 'dimensoes', 'm3', 'peso', 'ncm',
  'tipoVolume', 'qtdeVolume', 'valorUnitario', 'valorNF', 'nf',
  'origem', 'cnpjOrigem', 'enderecoOrigem', 'linkOrigem',
  'destino', 'cnpjDestino', 'enderecoDestino', 'linkDestino', 'km',
  'previsaoEntrega', 'centroCusto', 'justificativa'];

/** Campos que o módulo Processos pode atualizar. */
const CF_CAMPOS_PROC = ['status', 'transportadora', 'valorAprovado', 'veiculo',
  'dataColeta', 'previsaoEntrega', 'dataEntrega', 'motorista', 'placa', 'cte',
  'centroCusto', 'statusPagamento', 'justificativa', 'rota'];

const CF_COLUNAS_HIST = ['RFQ', 'Data/Hora', 'Usuário', 'Campo', 'De', 'Para', 'Comentário'];

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

/**
 * Menu da planilha. Se este código estiver no MESMO projeto do painel de
 * aprovação (que já tem um onOpen), apague a função abaixo e chame
 * cfMenu() de dentro do onOpen que já existe.
 */
function onOpen() {
  cfMenu();
}

function cfMenu() {
  SpreadsheetApp.getUi()
    .createMenu('Controle de Fretes')
    .addItem('Abrir sistema', 'cfAbrirApp')
    .addSeparator()
    .addItem('Diagnosticar', 'cfDiagnosticar')
    .addToUi();
}

function cfAbrirApp() {
  const html = cfTemplate_().evaluate().setWidth(1280).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Controle de Fretes');
}

/** Usado quando o projeto é publicado como App da Web (link próprio). */
function doGet() {
  return cfTemplate_().evaluate()
    .setTitle('Controle de Fretes')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function cfTemplate_() {
  const tentados = [];
  for (let i = 0; i < CF_CONFIG.HTML_FILES.length; i++) {
    try {
      return HtmlService.createTemplateFromFile(CF_CONFIG.HTML_FILES[i]);
    } catch (e) {
      tentados.push(CF_CONFIG.HTML_FILES[i]);
    }
  }
  throw new Error('Não encontrei o arquivo HTML do sistema. Procurei por: ' +
    tentados.join(', ') + '. Crie um arquivo HTML chamado "ControleFretes".');
}

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function cfNorm_(str) {
  return String(str === null || str === undefined ? '' : str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function cfTxt_(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

/** "R$ 4.993,15", 4993.15, "" -> número ou null. */
function cfNum_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const raw = cfTxt_(v);
  if (!raw || cfNorm_(raw) === 'naoinf' || cfNorm_(raw) === 'naolocinf') return null;
  const cleaned = raw.replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Date, "2026-03-14", "14/03/2026" -> Date ou null. */
function cfData_(v) {
  if (!v && v !== 0) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? null : v;
  }
  const s = cfTxt_(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const ano = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(ano, Number(m[2]) - 1, Number(m[1]));
  }
  return null;
}

/** Date -> "2026-03-14" (formato do <input type="date">). */
function cfIso_(v) {
  const d = cfData_(v);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}

function cfHoje_() {
  const a = new Date();
  return new Date(a.getFullYear(), a.getMonth(), a.getDate());
}

function cfDias_(de, ate) {
  const d1 = cfData_(de), d2 = cfData_(ate);
  if (!d1 || !d2) return null;
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function cfUsuario_() {
  const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '';
  return {
    email: email,
    nome: email ? email.split('@')[0].replace(/[._]/g, ' ') : ''
  };
}

function cfFinalizado_(status) {
  const s = cfNorm_(status);
  return CF_CONFIG.STATUS_FINAIS.some(function (f) { return cfNorm_(f) === s; });
}

/* ------------------------------------------------------------------ */
/* Planilha, cabeçalho e colunas                                       */
/* ------------------------------------------------------------------ */

function cfPlanilha_() {
  if (CF_CONFIG.SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(CF_CONFIG.SPREADSHEET_ID);
    } catch (e) {
      const ativa = SpreadsheetApp.getActiveSpreadsheet();
      if (ativa) return ativa;
      throw new Error('Não consegui abrir a planilha pelo ID configurado em ' +
        'CF_CONFIG.SPREADSHEET_ID. Detalhe: ' + e);
    }
  }
  const ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (!ativa) throw new Error('Preencha CF_CONFIG.SPREADSHEET_ID com o ID da planilha.');
  return ativa;
}

function cfAba_(ss, nome) {
  const direto = ss.getSheetByName(nome);
  if (direto) return direto;
  const alvo = cfNorm_(nome);
  const achou = ss.getSheets().filter(function (s) { return cfNorm_(s.getName()) === alvo; });
  return achou.length ? achou[0] : null;
}

function cfSheet_() {
  const ss = cfPlanilha_();
  const sheet = cfAba_(ss, CF_CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('Não encontrei a aba "' + CF_CONFIG.SHEET_NAME + '". Abas disponíveis: ' +
      ss.getSheets().map(function (s) { return s.getName(); }).join(' | '));
  }
  return sheet;
}

const CF_HINTS = ['rfq', 'rota', 'statusdasc', 'setorsolicitante', 'motivodofrete',
  'modalidade', 'tipodefrete', 'material', 'qtdesolicitada', 'tipodevolume',
  'valorunitario', 'valordanf', 'origem', 'destino', 'datadecoleta'];

/**
 * Descobre em qual linha está o cabeçalho real (na planilha atual é a 2ª,
 * porque a 1ª é o agrupamento) e devolve { linha, mapa: {chave: coluna} }.
 */
function cfCabecalho_(sheet) {
  const largura = sheet.getLastColumn();
  const alturaBusca = Math.min(CF_CONFIG.HEADER_SCAN_ROWS, sheet.getLastRow() || 1);
  if (!largura || !alturaBusca) throw new Error('A aba "' + sheet.getName() + '" está vazia.');

  const bloco = sheet.getRange(1, 1, alturaBusca, largura).getValues();
  let melhor = { linha: 1, pontos: -1 };
  bloco.forEach(function (linha, i) {
    const chaves = linha.map(cfNorm_);
    const pontos = CF_HINTS.filter(function (h) { return chaves.indexOf(h) !== -1; }).length;
    if (pontos > melhor.pontos) melhor = { linha: i + 1, pontos: pontos };
  });
  if (melhor.pontos <= 0) {
    throw new Error('Não achei a linha de cabeçalho na aba "' + sheet.getName() +
      '". Confira se as colunas RFQ, Status da SC, Material etc. existem.');
  }

  const head = bloco[melhor.linha - 1];
  const mapa = {};
  head.forEach(function (h, i) {
    const k = cfNorm_(h);
    if (k && !mapa[k]) mapa[k] = i + 1;
  });
  return { linha: melhor.linha, mapa: mapa };
}

/** Número da coluna de um campo do sistema (0 = não existe na planilha). */
function cfCol_(mapa, chave) {
  const nome = CF_CAMPOS[chave];
  return nome ? (mapa[cfNorm_(nome)] || 0) : 0;
}

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

function cfLer_() {
  const sheet = cfSheet_();
  const cab = cfCabecalho_(sheet);
  const primeira = cab.linha + 1;
  const ultima = sheet.getLastRow();
  if (ultima < primeira) return { sheet: sheet, cab: cab, itens: [] };

  const valores = sheet.getRange(primeira, 1, ultima - primeira + 1, sheet.getLastColumn()).getValues();
  const hoje = cfHoje_();
  const itens = [];

  valores.forEach(function (linha, i) {
    const pega = function (chave) {
      const c = cfCol_(cab.mapa, chave);
      return c ? linha[c - 1] : '';
    };

    const rfq = cfTxt_(pega('rfq'));
    const material = cfTxt_(pega('material'));
    if (!rfq && !material) return; // linha em branco / rodapé

    const status = cfTxt_(pega('status'));
    const finalizado = cfFinalizado_(status);
    const previsao = cfIso_(pega('previsaoEntrega'));
    const entrega = cfIso_(pega('dataEntrega'));

    let atraso = null;
    if (previsao) {
      const ref = entrega ? cfData_(entrega) : (finalizado ? null : hoje);
      if (ref) atraso = cfDias_(previsao, ref);
    }

    const it = {
      linha: primeira + i,
      rfq: rfq,
      rota: cfTxt_(pega('rota')),
      dataSolicitacao: cfIso_(pega('dataSolicitacao')),
      ano: cfTxt_(pega('ano')),
      status: status || '(sem status)',
      setor: cfTxt_(pega('setor')),
      motivo: cfTxt_(pega('motivo')),
      modalidade: cfTxt_(pega('modalidade')),
      tipoFrete: cfTxt_(pega('tipoFrete')),
      empresa: cfTxt_(pega('empresa')),
      material: material,
      qtde: cfTxt_(pega('qtde')),
      especificacao: cfTxt_(pega('especificacao')),
      dimensoes: cfTxt_(pega('dimensoes')),
      m3: cfTxt_(pega('m3')),
      peso: cfNum_(pega('peso')),
      ncm: cfTxt_(pega('ncm')),
      tipoVolume: cfTxt_(pega('tipoVolume')),
      qtdeVolume: cfTxt_(pega('qtdeVolume')),
      valorUnitario: cfNum_(pega('valorUnitario')),
      valorNF: cfNum_(pega('valorNF')),
      nf: cfTxt_(pega('nf')),
      origem: cfTxt_(pega('origem')),
      cnpjOrigem: cfTxt_(pega('cnpjOrigem')),
      enderecoOrigem: cfTxt_(pega('enderecoOrigem')),
      destino: cfTxt_(pega('destino')),
      cnpjDestino: cfTxt_(pega('cnpjDestino')),
      enderecoDestino: cfTxt_(pega('enderecoDestino')),
      km: cfNum_(pega('km')),
      transportadora: cfTxt_(pega('transportadora')),
      valorAprovado: cfNum_(pega('valorAprovado')),
      aprovacao: cfTxt_(pega('aprovacao')),
      aprovador: cfTxt_(pega('aprovador')),
      justificativa: cfTxt_(pega('justificativa')),
      dataColeta: cfIso_(pega('dataColeta')),
      previsaoEntrega: previsao,
      dataEntrega: entrega,
      motorista: cfTxt_(pega('motorista')),
      placa: cfTxt_(pega('placa')),
      veiculo: cfTxt_(pega('veiculo')),
      cte: cfTxt_(pega('cte')),
      centroCusto: cfTxt_(pega('centroCusto')),
      statusPagamento: cfTxt_(pega('statusPagamento')),
      trajeto: cfTxt_(pega('trajeto')),
      finalizado: finalizado,
      atraso: atraso
    };
    it.diasAberto = finalizado ? null : cfDias_(it.dataSolicitacao, hoje);
    itens.push(it);
  });

  return { sheet: sheet, cab: cab, itens: itens };
}

/** Chamado pelo HTML ao abrir. */
function cfCarregarTudo() {
  const base = cfLer_();
  const faltando = Object.keys(CF_CAMPOS)
    .filter(function (k) { return !cfCol_(base.cab.mapa, k); })
    .map(function (k) { return CF_CAMPOS[k]; });

  return {
    usuario: cfUsuario_(),
    empresa: CF_CONFIG.EMPRESA_NOME,
    aba: base.sheet.getName(),
    hoje: cfIso_(new Date()),
    colunasFaltando: faltando,
    opcoes: cfOpcoes_(base.itens),
    itens: base.itens,
    resumo: cfResumo_(base.itens)
  };
}

/** Recarrega só a lista (botão Atualizar). */
function cfListar() {
  const base = cfLer_();
  return {
    itens: base.itens,
    resumo: cfResumo_(base.itens),
    opcoes: cfOpcoes_(base.itens)
  };
}

/** Listas dos campos de seleção: o configurado + o que já existe na planilha. */
function cfOpcoes_(itens) {
  const juntar = function (base, chave) {
    const vistos = {};
    base.forEach(function (v) { if (cfTxt_(v)) vistos[cfTxt_(v)] = true; });
    itens.forEach(function (it) {
      const v = cfTxt_(it[chave]);
      if (v && v !== '(sem status)' && !vistos[v]) vistos[v] = true;
    });
    return Object.keys(vistos).sort(function (a, b) {
      const ia = base.indexOf(a), ib = base.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'pt-BR');
    });
  };

  return {
    status: juntar(CF_CONFIG.STATUS, 'status'),
    setores: juntar(CF_CONFIG.SETORES, 'setor'),
    motivos: juntar(CF_CONFIG.MOTIVOS, 'motivo'),
    modalidades: juntar(CF_CONFIG.MODALIDADES, 'modalidade'),
    tiposFrete: juntar(CF_CONFIG.TIPOS_FRETE, 'tipoFrete'),
    tiposVolume: juntar(CF_CONFIG.TIPOS_VOLUME, 'tipoVolume'),
    veiculos: juntar(CF_CONFIG.VEICULOS, 'veiculo'),
    empresas: juntar([], 'empresa'),
    transportadoras: juntar([], 'transportadora'),
    statusPagamento: juntar(CF_CONFIG.STATUS_PAGAMENTO, 'statusPagamento'),
    statusFinais: CF_CONFIG.STATUS_FINAIS,
    statusInicial: CF_CONFIG.STATUS_INICIAL
  };
}

/* ------------------------------------------------------------------ */
/* Módulo 1 — Formulário (nova solicitação)                            */
/* ------------------------------------------------------------------ */

/** Próxima RFQ: maior número já usado + 1. */
function cfProximaRfq_(sheet, cab) {
  const c = cfCol_(cab.mapa, 'rfq');
  const primeira = cab.linha + 1;
  const ultima = sheet.getLastRow();
  if (!c || ultima < primeira) return 1;
  const vals = sheet.getRange(primeira, c, ultima - primeira + 1, 1).getValues();
  let maior = 0;
  vals.forEach(function (v) {
    const n = parseInt(cfTxt_(v[0]).replace(/\D/g, ''), 10);
    if (!isNaN(n)) maior = Math.max(maior, n);
  });
  return maior + 1;
}

/**
 * Grava uma nova solicitação. Devolve { ok, rfq, itens, resumo, opcoes }.
 * Nada é gravado se faltar campo obrigatório.
 */
function cfCriarSolicitacao(dados) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sheet = cfSheet_();
    const cab = cfCabecalho_(sheet);

    const obrigatorios = [
      ['setor', 'Setor solicitante'], ['motivo', 'Motivo do frete'],
      ['modalidade', 'Modalidade'], ['material', 'Material'],
      ['qtde', 'Qtde solicitada'], ['origem', 'Origem'], ['destino', 'Destino']
    ];
    const faltando = obrigatorios
      .filter(function (p) { return !cfTxt_(dados[p[0]]); })
      .map(function (p) { return p[1]; });
    if (faltando.length) {
      throw new Error('Preencha os campos obrigatórios: ' + faltando.join(', ') + '.');
    }

    const rfq = cfProximaRfq_(sheet, cab);
    const agora = new Date();
    const linha = sheet.getLastRow() + 1;

    // Grava célula a célula (só nas colunas mapeadas) para não apagar as
    // fórmulas arrastadas que existem em outras colunas da mesma linha.
    const aGravar = {};
    const por = function (chave, valor) {
      const c = cfCol_(cab.mapa, chave);
      if (c && valor !== null && valor !== undefined && valor !== '') aGravar[c] = valor;
    };

    por('rfq', rfq);
    por('dataSolicitacao', agora);
    por('ano', agora.getFullYear());
    por('status', CF_CONFIG.STATUS_INICIAL);

    CF_CAMPOS_FORM.forEach(function (chave) {
      const bruto = dados[chave];
      if (bruto === undefined || bruto === null || cfTxt_(bruto) === '') return;
      if (chave === 'previsaoEntrega') { por(chave, cfData_(bruto)); return; }
      if (['peso', 'm3', 'valorUnitario', 'valorNF', 'km', 'qtdeVolume'].indexOf(chave) !== -1) {
        const n = cfNum_(bruto);
        por(chave, n === null ? cfTxt_(bruto) : n);
        return;
      }
      por(chave, cfTxt_(bruto));
    });

    // Trajeto no mesmo padrão das linhas antigas: "RFQ 43 - ORIGEM x DESTINO".
    if (!cfTxt_(dados.trajeto)) {
      por('trajeto', 'RFQ ' + rfq + ' - ' + cfTxt_(dados.origem) + ' x ' + cfTxt_(dados.destino));
    } else {
      por('trajeto', cfTxt_(dados.trajeto));
    }

    Object.keys(aGravar).forEach(function (c) {
      sheet.getRange(linha, Number(c)).setValue(aGravar[c]);
    });

    const u = cfUsuario_();
    cfHistorico_(rfq, u, 'Status da SC', '', CF_CONFIG.STATUS_INICIAL,
      'Solicitação criada pelo formulário' +
      (cfTxt_(dados.solicitante) ? ' — ' + cfTxt_(dados.solicitante) : ''));
    cfAvisar_(rfq, dados);

    const base = cfLer_();
    return {
      ok: true, rfq: String(rfq),
      itens: base.itens, resumo: cfResumo_(base.itens), opcoes: cfOpcoes_(base.itens)
    };
  } finally {
    lock.releaseLock();
  }
}

function cfAvisar_(rfq, d) {
  if (!CF_CONFIG.EMAIL_AVISO) return;
  try {
    const corpo = [
      'Nova solicitação de frete registrada na planilha de controle.', '',
      'RFQ: ' + rfq,
      'Solicitante: ' + cfTxt_(d.solicitante) + ' (' + cfTxt_(d.setor) + ')',
      'Motivo: ' + cfTxt_(d.motivo),
      'Material: ' + cfTxt_(d.material) + ' — Qtde: ' + cfTxt_(d.qtde) + ' ' + cfTxt_(d.tipoVolume),
      'Trecho: ' + cfTxt_(d.origem) + ' → ' + cfTxt_(d.destino),
      'Modalidade: ' + cfTxt_(d.modalidade) + ' — Tipo: ' + cfTxt_(d.tipoFrete),
      'Previsão de entrega desejada: ' + (cfIso_(d.previsaoEntrega) || '—'),
      '', 'Planilha: ' + cfPlanilha_().getUrl()
    ].join('\n');
    MailApp.sendEmail(CF_CONFIG.EMAIL_AVISO, '[Frete] Nova solicitação RFQ ' + rfq, corpo);
  } catch (e) {
    console.error('Falha ao enviar aviso: ' + e);
  }
}

/* ------------------------------------------------------------------ */
/* Módulo 2 — Processos (atualização)                                  */
/* ------------------------------------------------------------------ */

/**
 * Atualiza uma linha existente. `campos` traz só o que o usuário mexeu.
 * Campos enviados como string vazia são gravados como vazio (permite limpar).
 */
function cfAtualizarProcesso(linhaPlanilha, campos, comentario) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sheet = cfSheet_();
    const cab = cfCabecalho_(sheet);
    const linha = parseInt(linhaPlanilha, 10);
    if (!linha || linha <= cab.linha || linha > sheet.getLastRow()) {
      throw new Error('Linha inválida (' + linhaPlanilha + '). Clique em Atualizar e tente de novo.');
    }

    const cRfq = cfCol_(cab.mapa, 'rfq');
    const rfq = cRfq ? cfTxt_(sheet.getRange(linha, cRfq).getValue()) : '(sem RFQ)';

    if (campos.status !== undefined && cfNorm_(campos.status) === cfNorm_('Concluído')
      && !cfData_(campos.dataEntrega)) {
      throw new Error('Para concluir, informe a Data da entrega.');
    }

    const u = cfUsuario_();
    const mudancas = [];

    CF_CAMPOS_PROC.forEach(function (chave) {
      if (!(chave in campos)) return;
      const c = cfCol_(cab.mapa, chave);
      if (!c) return;

      let novo = campos[chave];
      if (['dataColeta', 'previsaoEntrega', 'dataEntrega'].indexOf(chave) !== -1) {
        novo = cfTxt_(novo) ? cfData_(novo) : '';
      } else if (chave === 'valorAprovado') {
        const n = cfNum_(novo);
        novo = n === null ? '' : n;
      } else {
        novo = cfTxt_(novo);
      }

      const cel = sheet.getRange(linha, c);
      const antes = cel.getValue();
      const iguais = (novo instanceof Date)
        ? cfIso_(antes) === cfIso_(novo)
        : cfTxt_(antes) === cfTxt_(novo) ||
          (cfNum_(antes) !== null && cfNum_(antes) === cfNum_(novo));
      if (iguais) return;

      cel.setValue(novo === '' ? '' : novo);
      mudancas.push({
        campo: CF_CAMPOS[chave],
        de: (antes instanceof Date) ? cfIso_(antes) : cfTxt_(antes),
        para: (novo instanceof Date) ? cfIso_(novo) : cfTxt_(novo)
      });
    });

    if (!mudancas.length && !cfTxt_(comentario)) {
      const base0 = cfLer_();
      return { ok: true, semMudanca: true, itens: base0.itens,
        resumo: cfResumo_(base0.itens), opcoes: cfOpcoes_(base0.itens) };
    }

    if (mudancas.length) {
      mudancas.forEach(function (m) {
        cfHistorico_(rfq, u, m.campo, m.de, m.para, cfTxt_(comentario));
      });
    } else {
      cfHistorico_(rfq, u, '(comentário)', '', '', cfTxt_(comentario));
    }

    const base = cfLer_();
    return {
      ok: true, mudancas: mudancas.length,
      itens: base.itens, resumo: cfResumo_(base.itens), opcoes: cfOpcoes_(base.itens)
    };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Histórico                                                           */
/* ------------------------------------------------------------------ */

function cfAbaHistorico_() {
  if (!CF_CONFIG.SHEET_HIST) return null;
  const ss = cfPlanilha_();
  let hist = cfAba_(ss, CF_CONFIG.SHEET_HIST);
  if (!hist) {
    hist = ss.insertSheet(CF_CONFIG.SHEET_HIST);
    hist.getRange(1, 1, 1, CF_COLUNAS_HIST.length).setValues([CF_COLUNAS_HIST]);
    hist.getRange(1, 1, 1, CF_COLUNAS_HIST.length)
      .setFontWeight('bold').setBackground('#16191c').setFontColor('#ffffff');
    hist.setFrozenRows(1);
  }
  return hist;
}

function cfHistorico_(rfq, usuario, campo, de, para, obs) {
  try {
    const hist = cfAbaHistorico_();
    if (!hist) return;
    hist.appendRow([String(rfq), new Date(), usuario.email || usuario.nome || '',
      campo || '', de || '', para || '', obs || '']);
  } catch (e) {
    console.error('Falha ao registrar histórico: ' + e);
  }
}

function cfGetHistorico(rfq) {
  const ss = cfPlanilha_();
  const hist = CF_CONFIG.SHEET_HIST ? cfAba_(ss, CF_CONFIG.SHEET_HIST) : null;
  if (!hist || hist.getLastRow() < 2) return [];
  const vals = hist.getRange(2, 1, hist.getLastRow() - 1, CF_COLUNAS_HIST.length).getValues();
  const alvo = cfTxt_(rfq);
  return vals
    .filter(function (l) { return cfTxt_(l[0]) === alvo; })
    .map(function (l) {
      return {
        quando: l[1] ? Utilities.formatDate(cfData_(l[1]) || new Date(l[1]),
          Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : '',
        quem: cfTxt_(l[2]),
        campo: cfTxt_(l[3]),
        de: cfTxt_(l[4]),
        para: cfTxt_(l[5]),
        obs: cfTxt_(l[6])
      };
    })
    .reverse();
}

/* ------------------------------------------------------------------ */
/* Módulo 3 — Painel                                                   */
/* ------------------------------------------------------------------ */

function cfResumo_(itens) {
  const hoje = cfHoje_();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const anoAtual = hoje.getFullYear();

  const porStatus = {}, porSetor = {}, porMotivo = {}, porModalidade = {};
  const porRota = {}, porMes = {}, porTransportadora = {};

  let emAberto = 0, concluidos = 0, cancelados = 0, criadasMes = 0, entreguesMes = 0;
  let gastoTotal = 0, gastoAno = 0, gastoMes = 0, comValor = 0;
  let somaCiclo = 0, ciclos = 0, noPrazo = 0, foraPrazo = 0;
  const atrasadas = [], paradas = [], semTransportadora = [];

  itens.forEach(function (it) {
    porStatus[it.status] = (porStatus[it.status] || 0) + 1;
    if (it.setor) porSetor[it.setor] = (porSetor[it.setor] || 0) + 1;
    if (it.motivo) porMotivo[it.motivo] = (porMotivo[it.motivo] || 0) + 1;
    if (it.modalidade) porModalidade[it.modalidade] = (porModalidade[it.modalidade] || 0) + 1;

    if (it.origem && it.destino) {
      const rota = it.origem + ' → ' + it.destino;
      if (!porRota[rota]) porRota[rota] = { rota: rota, qtd: 0, valor: 0 };
      porRota[rota].qtd++;
      porRota[rota].valor += it.valorAprovado || 0;
    }

    const dSol = cfData_(it.dataSolicitacao);
    if (dSol) {
      const chave = Utilities.formatDate(dSol, Session.getScriptTimeZone(), 'yyyy-MM');
      porMes[chave] = (porMes[chave] || 0) + 1;
      if (dSol.getTime() >= inicioMes.getTime()) criadasMes++;
    }

    const cancelado = cfNorm_(it.status).indexOf('cancel') === 0;
    if (cancelado) cancelados++;
    else if (it.finalizado) concluidos++;
    else emAberto++;

    if (it.valorAprovado && !cancelado) {
      gastoTotal += it.valorAprovado;
      comValor++;
      if (it.transportadora) {
        porTransportadora[it.transportadora] =
          (porTransportadora[it.transportadora] || 0) + it.valorAprovado;
      }
      const ref = cfData_(it.dataEntrega) || cfData_(it.dataColeta) || dSol;
      if (ref) {
        if (ref.getFullYear() === anoAtual) gastoAno += it.valorAprovado;
        if (ref.getTime() >= inicioMes.getTime()) gastoMes += it.valorAprovado;
      }
    }

    const dEnt = cfData_(it.dataEntrega);
    if (dEnt) {
      if (dEnt.getTime() >= inicioMes.getTime()) entreguesMes++;
      const ciclo = cfDias_(it.dataSolicitacao, it.dataEntrega);
      if (ciclo !== null && ciclo >= 0 && ciclo < 400) { somaCiclo += ciclo; ciclos++; }
      if (it.previsaoEntrega) {
        if (it.atraso !== null && it.atraso > 0) foraPrazo++; else noPrazo++;
      }
    }

    if (!it.finalizado && it.atraso !== null && it.atraso > 0) {
      atrasadas.push({ rfq: it.rfq, linha: it.linha, material: it.material,
        destino: it.destino, status: it.status, dias: it.atraso });
    }
    if (!it.finalizado && !it.transportadora && it.diasAberto !== null &&
        it.diasAberto >= CF_CONFIG.DIAS_PARADO) {
      paradas.push({ rfq: it.rfq, linha: it.linha, material: it.material,
        status: it.status, dias: it.diasAberto });
    }
    if (!it.finalizado && !it.transportadora) semTransportadora.push(it.rfq);
  });

  atrasadas.sort(function (a, b) { return b.dias - a.dias; });
  paradas.sort(function (a, b) { return b.dias - a.dias; });

  const topRotas = Object.keys(porRota).map(function (k) { return porRota[k]; })
    .sort(function (a, b) { return b.qtd - a.qtd || b.valor - a.valor; })
    .slice(0, 6);

  const topTransp = Object.keys(porTransportadora)
    .map(function (k) { return { nome: k, valor: porTransportadora[k] }; })
    .sort(function (a, b) { return b.valor - a.valor; })
    .slice(0, 6);

  const meses = Object.keys(porMes).sort().slice(-8)
    .map(function (k) { return { mes: k, qtd: porMes[k] }; });

  return {
    total: itens.length,
    emAberto: emAberto,
    concluidos: concluidos,
    cancelados: cancelados,
    criadasMes: criadasMes,
    entreguesMes: entreguesMes,
    gastoTotal: gastoTotal,
    gastoAno: gastoAno,
    gastoMes: gastoMes,
    anoAtual: anoAtual,
    ticketMedio: comValor ? gastoTotal / comValor : 0,
    cicloMedio: ciclos ? somaCiclo / ciclos : null,
    noPrazo: noPrazo,
    foraPrazo: foraPrazo,
    percNoPrazo: (noPrazo + foraPrazo) ? (noPrazo / (noPrazo + foraPrazo)) * 100 : null,
    porStatus: cfOrdenar_(porStatus),
    porSetor: cfOrdenar_(porSetor).slice(0, 8),
    porMotivo: cfOrdenar_(porMotivo).slice(0, 8),
    porModalidade: cfOrdenar_(porModalidade).slice(0, 6),
    topRotas: topRotas,
    topTransportadoras: topTransp,
    porMes: meses,
    atrasadas: atrasadas.slice(0, 10),
    qtdAtrasadas: atrasadas.length,
    paradas: paradas.slice(0, 10),
    qtdParadas: paradas.length,
    semTransportadora: semTransportadora.length,
    diasParado: CF_CONFIG.DIAS_PARADO
  };
}

function cfOrdenar_(obj) {
  return Object.keys(obj)
    .map(function (k) { return { nome: k, qtd: obj[k] }; })
    .sort(function (a, b) { return b.qtd - a.qtd; });
}

/* ------------------------------------------------------------------ */
/* Diagnóstico                                                         */
/* ------------------------------------------------------------------ */

function cfDiagnosticar() {
  const sheet = cfSheet_();
  const cab = cfCabecalho_(sheet);
  const base = cfLer_();
  const faltando = Object.keys(CF_CAMPOS)
    .filter(function (k) { return !cfCol_(cab.mapa, k); })
    .map(function (k) { return CF_CAMPOS[k]; });

  const linhas = [
    'Planilha: ' + cfPlanilha_().getName(),
    'Aba: ' + sheet.getName(),
    'Linha do cabeçalho: ' + cab.linha,
    'Solicitações lidas: ' + base.itens.length,
    'Em aberto: ' + base.itens.filter(function (i) { return !i.finalizado; }).length,
    'Colunas não encontradas: ' + (faltando.length ? faltando.join(', ') : 'nenhuma')
  ];
  console.log(linhas.join('\n'));
  try { SpreadsheetApp.getUi().alert(linhas.join('\n')); } catch (e) {}
  return linhas.join('\n');
}
