/**
 * SOLARGRID — CONSULTA (só leitura)
 * Projeto INDEPENDENTE do Supply Chain — não compartilha nada com ele.
 *
 * ▸ ANTES DE USAR:
 *   1) Preencha SPREADSHEET_ID abaixo com o ID da planilha (o trecho da URL
 *      entre "/d/" e "/edit").
 *   2) Ligue a API do Sheets: Editor → "Serviços" (ícone +) → Google Sheets
 *      API → Adicionar. (Mesmo passo que fizemos no projeto principal.)
 *
 * ▸ Depois de qualquer alteração:
 *   Implantar → Gerenciar implantações → lápis → Nova versão → Implantar.
 */

const SPREADSHEET_ID = '1fdLa4JnrCvmaGTf7gT83bRcARX5KKzeNkpyk4ZXmTO8';

// ══════════════════════════════════════════════════════════════
//  CONFIG — um "conjunto" por módulo de consulta
// ══════════════════════════════════════════════════════════════

const CONJUNTOS = {

  compras: {
    TITULO: 'Compras',
    ABA_DADOS: 'Compras + Logística',
    LINHA_CABECALHO: 1,

    COLUNAS_LISTA: [
      'SC', 'TIPO DA COMPRA', 'CLASSIFICAÇÃO', 'UFV', 'STATUS - PEDIDO DE COMPRA',
      'SETOR RESPONSÁVEL', 'CENTRO DE CUSTO', 'CÓD. MXM', 'DESCRIÇÃO COMPLETA',
      'CRITICIDADE DA COMPRA', 'QUANTIDADE SOLICITADA', 'QUANTIDADE COMPRADA',
      'QUANTIDADE TRANSFERENCIA REALIZADA',   // pedido como "QUANTIDADE A SER TRANSFERIDA" — não existe esse
                                                // nome na planilha; esta é a coluna de transferência mais próxima
      'MEDIDA', 'COMPRADOR', 'FORNECEDOR', 'VALOR UNITARIO (BRL)', 'N. PEDIDO DE COMPRA',
      'INCOTERMS - FRETE', 'COMENTÁRIOS COMPRADOR', 'SOLICITAÇÃO DE COMPRA',
      'LIBERAÇÃO PARA COMPRA', 'NECESSIDADE PRELIMINAR', 'BASELINE',
      'DATA EMISSÃO PEDIDO DE COMPRA (MXM)', 'DATA DA APROVAÇÃO DO PEDIDO DE COMPRA (MXM)',
      'DATA FORMALIZAÇÃO PEDIDO DE COMPRA E/OU CANCELAMENTO SC',
      'PREVISAO DE ENTREGA CIF (USINA) (PÓS COMPRA)',
      'FUP - ÚLTIMO CONTATO COM FORNECEDOR', 'FUP - DATA DE ENTREGA CONFIRMADA PELO FORNECEDOR',
      'DATA DE ENTREGA REAL'
    ],

    // Não foi pedido explicitamente — escolhi as colunas mais "categóricas" da
    // lista acima, no mesmo padrão de filtro que já usamos no sistema principal.
    // Fácil de ajustar: é só editar este array.
    FILTROS: [
      'SC', 'TIPO DA COMPRA', 'CLASSIFICAÇÃO', 'UFV', 'STATUS - PEDIDO DE COMPRA',
      'SETOR RESPONSÁVEL', 'CENTRO DE CUSTO', 'CRITICIDADE DA COMPRA', 'DESCRIÇÃO COMPLETA',
      'FORNECEDOR', 'N. PEDIDO DE COMPRA'
    ],

    COLUNA_ESQUERDA: 'DESCRIÇÃO COMPLETA',
    MAX_TEXTO: 45,
    MAX_OPCOES_FILTRO: 400,
    // Estes sempre mostram a lista suspensa com busca dentro, mesmo tendo
    // muitas opções (os outros caem pra "contém..." simples acima do limite).
    FORCAR_LISTA_FILTRO: ['SC', 'DESCRIÇÃO COMPLETA', 'N. PEDIDO DE COMPRA'],
    CACHE_HORAS: 6,
    CACHE_VERSAO: 'c2'
  },

  servicos: {
    TITULO: 'Serviços',
    ABA_DADOS: 'Serviços',
    LINHA_CABECALHO: 1,

    COLUNAS_LISTA: [
      'SC', 'STATUS - ORDEM DE SERVIÇO', 'UFV', 'CLUSTER', 'TIPO DO SERVIÇO',
      'CENTRO DE CUSTO (O&M)', 'CÓD. MXM', 'DESCRIÇÃO COMPLETA', 'QUANTIDADE SOLICITADA',
      'QUANTIDADE APROV.', 'MEDIDA', 'COMENTÁRIOS SOLICITANTE', 'COMENTÁRIOS COMPRADOR',
      'VALOR UNITARIO (BRL)', 'N. PEDIDO DE COMPRA', 'INCOTERMS - FRETE', 'DATA SCSERV',
      'NECESSIDADE', 'APROVAÇÃO DE COMPRA GA (FELIPE TAVEIRA)', 'APROVAÇÃO DE COMPRA OEM (MARCELLA)',
      'DATA EMISSÃO PEDIDO DE COMPRA (MXM)', 'DATA DA APROVAÇÃO DO PEDIDO DE COMPRA (MXM)',
      'DATA FORMALIZAÇÃO PEDIDO DE COMPRA', 'DATA PREVISTA REALIZAÇÃO DO SERVIÇO (COLETA)',
      'DATA DA COLETA REAL', 'DATA RETORNO EQUIP'
    ],

    FILTROS: [
      'SC', 'STATUS - ORDEM DE SERVIÇO', 'UFV', 'CLUSTER', 'TIPO DO SERVIÇO',
      'CENTRO DE CUSTO (O&M)', 'DESCRIÇÃO COMPLETA', 'FORNECEDOR', 'N. PEDIDO DE COMPRA'
    ],

    COLUNA_ESQUERDA: 'DESCRIÇÃO COMPLETA',
    MAX_TEXTO: 45,
    MAX_OPCOES_FILTRO: 400,
    FORCAR_LISTA_FILTRO: ['SC', 'DESCRIÇÃO COMPLETA', 'N. PEDIDO DE COMPRA'],
    CACHE_HORAS: 6,
    CACHE_VERSAO: 'c2'
  },

  // ── Valor Praticado ──────────────────────────────────────────
  // Não é uma listagem crua como os outros dois: aqui cada material
  // aparece UMA vez só, com o valor unitário da data de formalização
  // mais próxima do dia de hoje. Quem faz esse resumo é o
  // construirIndiceAgregado_() lá embaixo (TIPO: 'agregado'); daí pra
  // frente (filtros, busca, ordenação, larguras) é tudo o mesmo
  // caminho dos outros módulos.
  valor: {
    TITULO: 'Valor Praticado',
    TIPO: 'agregado',
    ABA_DADOS: 'Compras + Logística',
    LINHA_CABECALHO: 1,

    COL_DESCRICAO: 'DESCRIÇÃO COMPLETA',
    COL_VALOR: 'VALOR UNITARIO (BRL)',
    COL_DATA: 'DATA FORMALIZAÇÃO PEDIDO DE COMPRA E/OU CANCELAMENTO SC',

    // Ordem das colunas na tela. DESCRIÇÃO/VALOR/DATA são as que mandam no
    // cálculo; as outras (UFV, MEDIDA, FORNECEDOR) vêm de carona, sempre da
    // mesma linha que deu o valor — ou seja, descrevem essa última compra.
    COLUNAS_LISTA: [
      'UFV',
      'DESCRIÇÃO COMPLETA',
      'MEDIDA',
      'VALOR UNITARIO (BRL)',
      'DATA FORMALIZAÇÃO PEDIDO DE COMPRA E/OU CANCELAMENTO SC',
      'FORNECEDOR'
    ],

    // Nomes só de tela — na planilha as colunas continuam com o nome original.
    ROTULOS: {
      'VALOR UNITARIO (BRL)': 'ÚLTIMO VALOR PRATICADO',
      'DATA FORMALIZAÇÃO PEDIDO DE COMPRA E/OU CANCELAMENTO SC': 'DATA DA COMPRA'
    },

    FILTROS: ['DESCRIÇÃO COMPLETA'],

    COLUNA_ESQUERDA: 'DESCRIÇÃO COMPLETA',
    MAX_TEXTO: 45,
    MAX_OPCOES_FILTRO: 400,
    FORCAR_LISTA_FILTRO: ['DESCRIÇÃO COMPLETA'],
    CACHE_HORAS: 6,
    CACHE_VERSAO: 'c2'
  }
};

const SEP_CAMPO = '\u0001';
const SEP_LINHA = '\u0002';

function nrm_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toUpperCase(); }

function conjunto_(id) {
  const c = CONJUNTOS[id];
  if (!c) throw new Error('Módulo de consulta desconhecido: ' + id);
  return c;
}

function planilha_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf('COLE_AQUI') === 0) {
    throw new Error('Configure SPREADSHEET_ID no topo do Codigo.gs antes de usar.');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function aba_(nomeAba) {
  const s = planilha_().getSheetByName(nomeAba);
  if (!s) throw new Error('Aba "' + nomeAba + '" não encontrada.');
  return s;
}


// ══════════════════════════════════════════════════════════════
//  ENTRADA
// ══════════════════════════════════════════════════════════════

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('SolarGrid | Consulta')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

function getSessao() {
  // Ferramenta só de leitura: o controle de quem acessa fica na implantação
  // (Implantar → Gerenciar implantações → "Quem pode acessar"), não aqui no
  // código. Se um dia precisar restringir por e-mail, é só me pedir.
  const titulos = {};
  Object.keys(CONJUNTOS).forEach(function (id) { titulos[id] = CONJUNTOS[id].TITULO; });
  return {
    email: (Session.getActiveUser().getEmail() || '').toLowerCase().trim(),
    titulos: titulos
  };
}


// ══════════════════════════════════════════════════════════════
//  LARGURAS DE COLUNA — por pessoa e por módulo (Compras/Serviços não se
//  misturam, senão um ajuste num afetaria o outro)
// ══════════════════════════════════════════════════════════════

function chaveLarguras_(email, id) {
  return 'larg_' + String(email || 'anon').toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + id;
}

function lerLarguras_(email, id) {
  try {
    const v = PropertiesService.getScriptProperties().getProperty(chaveLarguras_(email, id));
    return v ? JSON.parse(v) : {};
  } catch (e) { return {}; }
}

function salvarLarguras(obj, id) {
  const email = Session.getActiveUser().getEmail();
  try {
    const limpo = {};
    Object.keys(obj || {}).forEach(function (k) {
      const n = parseInt(obj[k], 10);
      if (n >= 50 && n <= 900) limpo[k] = n;
    });
    PropertiesService.getScriptProperties()
      .setProperty(chaveLarguras_(email, id), JSON.stringify(limpo));
    return true;
  } catch (e) { return false; }
}

function limparLarguras(id) {
  const email = Session.getActiveUser().getEmail();
  try {
    PropertiesService.getScriptProperties().deleteProperty(chaveLarguras_(email, id));
    return true;
  } catch (e) { return false; }
}


// ══════════════════════════════════════════════════════════════
//  LEITURA EM MASSA (mesma técnica do sistema principal)
// ══════════════════════════════════════════════════════════════

function colLetra_(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function agruparColunas_(cols) {
  const ord = cols.slice().sort((a, b) => a - b);
  const grupos = [];
  let atual = { ini: ord[0], fim: ord[0] };
  for (let i = 1; i < ord.length; i++) {
    if (ord[i] - atual.fim <= 4) atual.fim = ord[i];
    else { grupos.push(atual); atual = { ini: ord[i], fim: ord[i] }; }
  }
  grupos.push(atual);
  return grupos;
}

function lerBlocos_(sh, primeira, nLinhas, grupos) {
  const ultima = primeira + nLinhas - 1;
  try {
    if (typeof Sheets !== 'undefined' && Sheets.Spreadsheets && Sheets.Spreadsheets.Values) {
      const nome = "'" + sh.getName().replace(/'/g, "''") + "'";
      const ranges = grupos.map(g => nome + '!' + colLetra_(g.ini) + primeira + ':' + colLetra_(g.fim) + ultima);
      const resp = Sheets.Spreadsheets.Values.batchGet(sh.getParent().getId(), {
        ranges: ranges, majorDimension: 'ROWS',
        valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING'
      });
      return grupos.map(function (g, i) {
        const largura = g.fim - g.ini + 1;
        const vals = (resp.valueRanges && resp.valueRanges[i] && resp.valueRanges[i].values) || [];
        const m = new Array(nLinhas);
        for (let r = 0; r < nLinhas; r++) {
          const orig = vals[r] || [];
          const norm = new Array(largura);
          for (let c = 0; c < largura; c++) norm[c] = orig[c] == null ? '' : orig[c];
          m[r] = norm;
        }
        return m;
      });
    }
  } catch (e) {
    console.warn('API do Sheets indisponível (' + e.message + '). Usando o método lento.');
  }
  return grupos.map(g => sh.getRange(primeira, g.ini, nLinhas, g.fim - g.ini + 1).getValues());
}


// ══════════════════════════════════════════════════════════════
//  ESTRUTURA + ÍNDICE (leitura só; sem travas, sem máscaras de edição)
// ══════════════════════════════════════════════════════════════

// A chave do cache carrega uma assinatura da configuração (aba, linha de
// cabeçalho, colunas e filtros). Assim, quando alguém mexe em COLUNAS_LISTA,
// a chave muda sozinha e a estrutura velha some na hora — sem isso, a lista
// de colunas antiga continuava sendo servida do cache por até 6 horas, mesmo
// com o código novo já implantado.
function assinaturaConfig_(cfg) {
  const txt = JSON.stringify([cfg.ABA_DADOS, cfg.LINHA_CABECALHO, cfg.COLUNAS_LISTA, cfg.FILTROS]);
  let h = 0;
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function chaveCache_(id, sufixo) {
  const cfg = conjunto_(id);
  return 'consulta_' + id + '_' + sufixo + '_' + cfg.CACHE_VERSAO + assinaturaConfig_(cfg);
}

function gravarCacheGrande_(chave, texto, seg) {
  try {
    const cache = CacheService.getScriptCache();
    const TAM = 90000;
    const n = Math.ceil(texto.length / TAM);
    if (n > 160) { console.warn('Índice grande demais para o cache (' + n + ' fatias).'); return; }
    const partes = {};
    for (let i = 0; i < n; i++) partes[chave + '_' + i] = texto.substring(i * TAM, (i + 1) * TAM);
    cache.putAll(partes, seg);
    cache.put(chave + '_n', String(n), seg);
  } catch (e) { console.warn('Cache não gravado: ' + e.message); }
}

function lerCacheGrande_(chave) {
  try {
    const cache = CacheService.getScriptCache();
    const n = parseInt(cache.get(chave + '_n'), 10);
    if (!n) return null;
    const nomes = [];
    for (let i = 0; i < n; i++) nomes.push(chave + '_' + i);
    const partes = cache.getAll(nomes);
    let texto = '';
    for (let i = 0; i < n; i++) {
      if (partes[chave + '_' + i] == null) return null;
      texto += partes[chave + '_' + i];
    }
    return texto;
  } catch (e) { return null; }
}

function limparCache_(chave) {
  try {
    const cache = CacheService.getScriptCache();
    const n = parseInt(cache.get(chave + '_n'), 10);
    const nomes = [chave + '_n'];
    for (let i = 0; i < (n || 0); i++) nomes.push(chave + '_' + i);
    cache.removeAll(nomes);
  } catch (e) {}
}

function construirEstrutura_(id) {
  const cfg = conjunto_(id);
  const sh = aba_(cfg.ABA_DADOS);
  const nCols = sh.getLastColumn();
  const cabecalhos = sh.getRange(cfg.LINHA_CABECALHO, 1, 1, nCols).getValues()[0]
                       .map(h => String(h == null ? '' : h).trim());

  const porNome = {};
  cabecalhos.forEach((nome, i) => { if (nome) porNome[nrm_(nome)] = { nome: nome, col: i + 1 }; });

  // "Carregar" = colunas da tabela + colunas que só servem de filtro (ex.: no
  // Serviços, FORNECEDOR é filtro mas não aparece como coluna visível). Tudo
  // isso entra no índice; só "listaCols" decide o que vira coluna na tela.
  const vistos = {};
  const nomesCarregar = [];
  cfg.COLUNAS_LISTA.concat(cfg.FILTROS).forEach(function (n) {
    const N = nrm_(n);
    if (!vistos[N]) { vistos[N] = 1; nomesCarregar.push(n); }
  });
  const colunasCarregar = nomesCarregar.map(n => porNome[nrm_(n)]).filter(Boolean);

  const nomesReais = {};
  colunasCarregar.forEach(c => { nomesReais[nrm_(c.nome)] = c.nome; });

  const leve = {
    colunasCarregar: colunasCarregar,
    listaCols: cfg.COLUNAS_LISTA.map(n => nomesReais[nrm_(n)]).filter(Boolean),
    filtros: cfg.FILTROS.map(n => nomesReais[nrm_(n)]).filter(Boolean),
    colEsquerda: nomesReais[nrm_(cfg.COLUNA_ESQUERDA)] || cfg.COLUNA_ESQUERDA,
    totalLinhas: Math.max(0, sh.getLastRow() - cfg.LINHA_CABECALHO)
  };

  gravarCacheGrande_(chaveCache_(id, 'est'), JSON.stringify(leve), cfg.CACHE_HORAS * 3600);
  return leve;
}

function estrutura_(id, forcar) {
  if (!forcar) {
    const salvo = lerCacheGrande_(chaveCache_(id, 'est'));
    if (salvo) return JSON.parse(salvo);
  }
  return construirEstrutura_(id);
}

function getEstrutura(id) {
  const cfg = conjunto_(id);
  const est = estrutura_(id, false);

  const problemas = [];
  const existentes = {};
  est.colunasCarregar.forEach(c => { existentes[nrm_(c.nome)] = true; });
  cfg.COLUNAS_LISTA.concat(cfg.FILTROS).forEach(n => {
    if (!existentes[nrm_(n)]) problemas.push('Coluna não encontrada na aba "' + cfg.ABA_DADOS + '": ' + n);
  });

  return {
    titulo: cfg.TITULO,
    listaCols: est.listaCols,
    filtros: est.filtros,
    colEsquerda: est.colEsquerda,
    maxOpcoesFiltro: cfg.MAX_OPCOES_FILTRO,
    totalLinhas: est.totalLinhas,
    problemas: problemas,
    larguras: lerLarguras_(Session.getActiveUser().getEmail(), id),
    forcarLista: cfg.FORCAR_LISTA_FILTRO || [],
    rotulos: cfg.ROTULOS || {}
  };
}

function construirIndice_(id) {
  const cfg = conjunto_(id);
  if (cfg.TIPO === 'agregado') return construirIndiceAgregado_(id);
  const sh = aba_(cfg.ABA_DADOS);
  const est = estrutura_(id, false);
  const primeira = cfg.LINHA_CABECALHO + 1;
  const nLinhas = Math.max(0, sh.getLastRow() - cfg.LINHA_CABECALHO);

  const resultado = { colunas: est.colunasCarregar.map(c => c.nome), dados: '', n: 0, doCache: false };

  if (nLinhas > 0 && est.colunasCarregar.length) {
    const grupos = agruparColunas_(est.colunasCarregar.map(c => c.col));
    const blocos = lerBlocos_(sh, primeira, nLinhas, grupos);

    const rota = est.colunasCarregar.map(function (c) {
      for (let g = 0; g < grupos.length; g++) {
        if (c.col >= grupos[g].ini && c.col <= grupos[g].fim) return { b: g, off: c.col - grupos[g].ini };
      }
      return { b: 0, off: 0 };
    });

    // Além da coluna principal, DESCRIÇÃO COMPLETA e qualquer COMENTÁRIOS
    // também não cortam — são campos de texto longo por natureza, e cortados
    // em 45 caracteres perdiam informação de verdade, não só visualmente.
    const RE_TEXTO_LONGO = /(DESCRIÇÃO COMPLETA|COMENTÁRIOS)/i;
    const semCorte = est.colunasCarregar.map(c =>
      nrm_(c.nome) === nrm_(est.colEsquerda) || RE_TEXTO_LONGO.test(c.nome)
    );
    const MAXT = cfg.MAX_TEXTO;
    const nC = rota.length;
    const partes = [];
    const campos = new Array(nC + 1);

    for (let i = 0; i < nLinhas; i++) {
      campos[0] = primeira + i;
      let vazia = true;
      for (let k = 0; k < nC; k++) {
        const bruto = blocos[rota[k].b][i][rota[k].off];
        let v;
        if (bruto === '' || bruto === null || bruto === undefined) v = '';
        else if (typeof bruto === 'string') {
          if (bruto.charCodeAt(0) === 35) v = '';
          else if (!semCorte[k] && bruto.length > MAXT) v = bruto.substring(0, MAXT) + '…';
          else v = bruto;
          if (v.indexOf(SEP_CAMPO) > -1 || v.indexOf(SEP_LINHA) > -1) v = v.replace(/[\u0001\u0002]/g, ' ');
        }
        else if (typeof bruto === 'number') v = String(bruto);
        else if (bruto instanceof Date) v = dataBR_(bruto);
        else v = String(bruto);
        if (v !== '') vazia = false;
        campos[k + 1] = v;
      }
      if (!vazia) partes.push(campos.join(SEP_CAMPO));
    }

    resultado.dados = partes.join(SEP_LINHA);
    resultado.n = partes.length;
  }

  gravarCacheGrande_(chaveCache_(id, 'indice'), JSON.stringify(resultado), cfg.CACHE_HORAS * 3600);
  return resultado;
}


// ══════════════════════════════════════════════════════════════
//  VALOR PRATICADO — um material por linha, com o último valor
// ══════════════════════════════════════════════════════════════
//
//  Regra combinada:
//   • percorre TODO o intervalo da coluna de data de formalização;
//   • linhas sem descrição, sem data válida ou sem valor numérico
//     ficam de fora (campo em branco não entra na análise);
//   • de cada material sobra a data mais próxima do dia de hoje —
//     em empate de distância vale a data já passada, e em empate de
//     data vale a linha mais embaixo na planilha (o registro mais
//     recente).

function paraData_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const t = String(v == null ? '' : v).trim();
  if (!t) return null;

  let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);   // 31/12/2025
  if (m) {
    let ano = parseInt(m[3], 10);
    if (ano < 100) ano += (ano < 50 ? 2000 : 1900);
    const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10) - 1;
    const d = new Date(ano, mes, dia);
    return (d.getMonth() === mes && d.getDate() === dia) ? d : null;
  }

  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                        // 2025-12-31
  if (m) {
    const ano = parseInt(m[1], 10), mes = parseInt(m[2], 10) - 1, dia = parseInt(m[3], 10);
    const d = new Date(ano, mes, dia);
    return (d.getMonth() === mes && d.getDate() === dia) ? d : null;
  }

  return null;
}

function paraNumero_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let t = String(v == null ? '' : v).trim();
  if (!t || t.charCodeAt(0) === 35) return null;        // vazio ou erro de fórmula (#N/D, #REF!…)
  t = t.replace(/[^\d,.\-]/g, '');                      // tira "R$", espaço fino, etc.
  if (!t || !/\d/.test(t)) return null;
  if (t.indexOf(',') > -1) t = t.replace(/\./g, '').replace(',', '.');   // 1.234,56 → 1234.56
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

function moedaBR_(n) {
  const neg = n < 0;
  const p = Math.abs(n).toFixed(2).split('.');
  return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1];
}

function construirIndiceAgregado_(id) {
  const cfg = conjunto_(id);
  const sh = aba_(cfg.ABA_DADOS);
  const est = estrutura_(id, false);
  const primeira = cfg.LINHA_CABECALHO + 1;
  const nLinhas = Math.max(0, sh.getLastRow() - cfg.LINHA_CABECALHO);

  const porNome = {};
  est.colunasCarregar.forEach(c => { porNome[nrm_(c.nome)] = c.col; });

  // Colunas de saída, na ordem de COLUNAS_LISTA (as que existem de verdade).
  const saida = est.listaCols.filter(n => porNome[nrm_(n)]);
  const resultado = { colunas: saida, dados: '', n: 0, doCache: false };

  const iDesc = saida.map(nrm_).indexOf(nrm_(cfg.COL_DESCRICAO));
  const iVal  = saida.map(nrm_).indexOf(nrm_(cfg.COL_VALOR));
  const iData = saida.map(nrm_).indexOf(nrm_(cfg.COL_DATA));

  if (nLinhas > 0 && iDesc > -1 && iVal > -1 && iData > -1) {
    const cols = saida.map(n => porNome[nrm_(n)]);
    const grupos = agruparColunas_(cols);
    const blocos = lerBlocos_(sh, primeira, nLinhas, grupos);
    const rota = cols.map(function (col) {
      for (let g = 0; g < grupos.length; g++) {
        if (col >= grupos[g].ini && col <= grupos[g].fim) return { b: g, off: col - grupos[g].ini };
      }
      return { b: 0, off: 0 };
    });
    const celula = function (i, k) { return blocos[rota[k].b][i][rota[k].off]; };

    const hoje = new Date();
    const hojeTs = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();

    const melhor = {};   // chave = descrição normalizada
    for (let i = 0; i < nLinhas; i++) {
      const brutoDesc = celula(i, iDesc);
      const desc = String(brutoDesc == null ? '' : brutoDesc).replace(/\s+/g, ' ').trim();
      if (!desc || desc.charCodeAt(0) === 35) continue;

      const valor = paraNumero_(celula(i, iVal));
      if (valor === null) continue;

      const data = paraData_(celula(i, iData));
      if (!data) continue;

      const ts = new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
      const dist = Math.abs(ts - hojeTs);
      const chave = nrm_(desc);
      const atual = melhor[chave];

      // Mais perto de hoje ganha; empatou na distância, a data passada ganha;
      // empatou na data, a linha de baixo (registro mais novo) ganha.
      if (atual &&
          !(dist < atual.dist ||
            (dist === atual.dist && ts <= hojeTs && atual.ts > hojeTs) ||
            (dist === atual.dist && ts === atual.ts))) continue;

      // A linha vencedora leva junto as colunas de contexto (UFV, MEDIDA,
      // FORNECEDOR…): elas descrevem essa compra, não o material em geral.
      const campos = new Array(saida.length);
      for (let k = 0; k < saida.length; k++) {
        if (k === iDesc)      campos[k] = desc;
        else if (k === iVal)  campos[k] = moedaBR_(valor);
        else if (k === iData) campos[k] = dataBR_(data);
        else {
          const b = celula(i, k);
          let v = (b instanceof Date) ? dataBR_(b)
                : (b == null ? '' : String(b).replace(/\s+/g, ' ').trim());
          if (v.charCodeAt(0) === 35) v = '';   // erro de fórmula vira branco
          campos[k] = v;
        }
        campos[k] = campos[k].replace(/[\u0001\u0002]/g, ' ');
      }

      melhor[chave] = { desc: desc, ts: ts, dist: dist, linha: primeira + i, campos: campos };
    }

    const partes = [];
    Object.keys(melhor)
      .map(k => melhor[k])
      .sort((a, b) => a.desc.localeCompare(b.desc, 'pt-BR'))
      .forEach(function (m) { partes.push([m.linha].concat(m.campos).join(SEP_CAMPO)); });

    resultado.dados = partes.join(SEP_LINHA);
    resultado.n = partes.length;
  }

  gravarCacheGrande_(chaveCache_(id, 'indice'), JSON.stringify(resultado), cfg.CACHE_HORAS * 3600);
  return resultado;
}

function dataBR_(d) {
  const dia = d.getDate(), mes = d.getMonth() + 1;
  return (dia < 10 ? '0' + dia : dia) + '/' + (mes < 10 ? '0' + mes : mes) + '/' + d.getFullYear();
}

function getIndice(id, forcar) {
  if (!forcar) {
    const salvo = lerCacheGrande_(chaveCache_(id, 'indice'));
    if (salvo) { const o = JSON.parse(salvo); o.doCache = true; return o; }
  }
  return construirIndice_(id);
}

function recarregar(id) {
  limparCache_(chaveCache_(id, 'est'));
  limparCache_(chaveCache_(id, 'indice'));
  construirEstrutura_(id);
  return construirIndice_(id);
}


// ══════════════════════════════════════════════════════════════
//  DIAGNÓSTICO
// ══════════════════════════════════════════════════════════════

function diagnostico() {
  const log = [];
  log.push('SPREADSHEET_ID configurado: ' + (SPREADSHEET_ID && SPREADSHEET_ID.indexOf('COLE_AQUI') !== 0));
  log.push('API do Sheets ligada: ' + (typeof Sheets !== 'undefined'));
  log.push('');

  Object.keys(CONJUNTOS).forEach(function (id) {
    try {
      const t = Date.now();
      const ix = getIndice(id, true);
      log.push('[' + id + '] "' + CONJUNTOS[id].TITULO + '": ' + ix.n + ' linhas em ' + (Date.now() - t) + ' ms');
      const e = getEstrutura(id);
      if (e.problemas.length) {
        log.push('   PROBLEMAS:');
        e.problemas.forEach(p => log.push('     - ' + p));
      }
    } catch (err) {
      log.push('[' + id + '] ERRO: ' + err.message);
    }
  });

  const txt = log.join('\n');
  console.log(txt);
  try { SpreadsheetApp.getUi().alert('Diagnóstico\n\n' + txt); } catch (e) {}
  return txt;
}