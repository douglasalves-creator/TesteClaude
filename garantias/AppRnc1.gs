/**
 * RNC — Relatório de Não-Conformidade.
 * Formulário com as perguntas do modelo em Word; gera o PDF no mesmo layout,
 * cria a pasta no Drive com as evidências e grava na planilha as colunas que
 * já existem lá (sempre pelo NOME do cabeçalho, linha 9).
 */
var GAR_RNC = (function () {

  var CFG = {
    SPREADSHEET_ID: '10XC9wnG3g9oaZVcja77ogyVVnLtKUBTLLoGQZgSQ1tE',
    ABA: 'Lista EP ( Para conciliação)',
    HEADER_ROW: 6,
    PASTA_DRIVE_ID: '1TjVagrbktvQwpTy0GO94M91Hhwvky-hR',
    ANEXO_MAX_MB: 25,
    NUMERO_MINIMO: 254,          // a última RNC emitida; a próxima será 255
    COL_LINK_PASTA: 'RNC',       // coluna que recebe o link da pasta no Drive
    COL_STATUS: 'Status - RNC',  // coluna que recebe "Emitida"
    STATUS_NOVO: 'Emitida',
    EMAIL_NOVA_RNC: 'supplychain.eng@solargrid.com.br',

    // Aba só com as listas suspensas, na mesma planilha: título da lista na
    // linha 1 e os valores abaixo, uma coluna por lista. '' desliga.
    ABA_LISTAS: 'Listas',

    // Qual coluna da aba Listas alimenta cada campo do formulário.
    // O que não existir na aba é simplesmente ignorado.
    LISTAS: {
      ufv:            'UFV',
      assunto:        'ASSUNTO RELACIONADO',
      tipo:           'TIPO DE OCORRÊNCIA',
      fase:           'FASE DO PROJETO',
      fornecedor:     'FORNECEDOR',
      descricao_item: 'DESCRIÇÃO DO ITEM',
      elaborador:     'ELABORADOR',
      revisao:        'REVISÃO'
    }
  };

  var ASSUNTOS = ['QUALIDADE', 'MEIO AMBIENTE', 'SAÚDE E SEG. TRABALHO'];
  var TIPOS    = ['Não Conformidade', 'Oportunidade de Melhoria', 'Não Conformidade Potencial'];
  var FASES    = ['Operacional', 'Em Construção'];

  /**
   * As perguntas do documento, na ordem em que aparecem nele.
   *   bloco    = seção do PDF
   *   planilha = cabeçalho da aba que recebe esse valor (quando houver)
   *   daColuna = de onde vêm as opções da lista, quando a lista é da planilha
   */
  var PERGUNTAS = [
    { id: 'data_rnc',    rotulo: 'Data de Emissão',        tipo: 'data',   bloco: 'topo',      planilha: 'Data de Emissão', auto: true },
    { id: 'n_rnc',       rotulo: 'N° RNC',                 tipo: 'texto',  bloco: 'topo',      planilha: 'Nº RNC',          auto: true },
    { id: 'ufv',         rotulo: 'UFV',                    tipo: 'select', bloco: 'topo',      planilha: 'UFV',             daColuna: 'UFV', obrig: true },

    { id: 'assunto',     rotulo: 'Assunto relacionado',    tipo: 'select', bloco: 'marcar',    opcoes: ASSUNTOS, obrig: true },
    { id: 'tipo',        rotulo: 'Tipo de ocorrência',     tipo: 'select', bloco: 'marcar',    opcoes: TIPOS,    obrig: true },
    { id: 'fase',        rotulo: 'Fase do projeto',        tipo: 'select', bloco: 'marcar',    opcoes: FASES,    planilha: 'Etapa', obrig: true },

    { id: 'resumo',      rotulo: 'Resumo da ocorrência',   tipo: 'area',   bloco: 'resumo',    planilha: 'Resumo da Ocorrência', obrig: true },

    { id: 'fornecedor',  rotulo: 'Fornecedor / Prestador', tipo: 'select', bloco: 'dados',     planilha: 'Nome do Fornecedor', daColuna: 'Nome do Fornecedor', obrig: true },
    { id: 'descricao_item', rotulo: 'Descrição do item',   tipo: 'area',   bloco: 'dados' },
    { id: 'qtd_recebida',   rotulo: 'Quantidade recebida', tipo: 'inteiro', bloco: 'dados' },

    { id: 'descricao_nc', rotulo: 'Descrição da não conformidade / causas da não conformidade',
      tipo: 'area', bloco: 'nc', obrig: true },

    { id: 'acao_imediata', rotulo: 'Ação imediata', tipo: 'area', bloco: 'acao' },
    { id: 'causa_raiz',    rotulo: 'Análise da causa raiz da não conformidade e/ou análise da oportunidade de melhoria',
      tipo: 'area', bloco: 'causa' },

    { id: 'elaborador', rotulo: 'Elaborador', tipo: 'texto', bloco: 'assinaturas' },
    { id: 'revisao',    rotulo: 'Revisão',    tipo: 'texto', bloco: 'assinaturas' }
  ];

  var BLOCOS = [
    { id: 'topo',        titulo: 'Identificação' },
    { id: 'marcar',      titulo: 'Classificação' },
    { id: 'resumo',      titulo: 'Resumo da ocorrência' },
    { id: 'dados',       titulo: 'Dados iniciais' },
    { id: 'nc',          titulo: '1. Descrição da não conformidade / causas' },
    { id: 'acao',        titulo: '3. Ação imediata' },
    { id: 'causa',       titulo: '4. Análise da causa raiz' },
    { id: 'assinaturas', titulo: 'Assinaturas' }
  ];

  function _norm(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function _esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * A planilha é grande e abri-la custa caro. Abre uma vez por execução e
   * reaproveita — era o que mais demorava para a tela aparecer.
   */
  var _SS = null;
  function _planilha() {
    if (!_SS) _SS = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    return _SS;
  }

  function _aba() {
    var aba = _planilha().getSheetByName(CFG.ABA);
    if (!aba) throw new Error('A aba "' + CFG.ABA + '" não foi encontrada.');
    return aba;
  }

  /* ---------------- cache ---------------- */

  var _TAM_PEDACO = 90000;

  /** Marca do conteúdo: se o formato mudar, a chave muda e o velho é ignorado. */
  function _digital(texto) {
    var h = 5381, t = String(texto);
    for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  var CHAVE_INICIO = 'rnc_inicio_' + _digital(
    JSON.stringify(CFG.LISTAS) + CFG.ABA_LISTAS + CFG.ABA + CFG.HEADER_ROW +
    PERGUNTAS.map(function (p) { return p.id + p.rotulo + p.tipo; }).join('|')
  );
  var CHAVE_LISTA = 'rnc_lista_' + _digital(CFG.ABA + '#' + CFG.HEADER_ROW);

  function _cacheLer(chave) {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get(chave + '::n') || 0);
    if (!n) return null;
    var nomes = [];
    for (var i = 0; i < n; i++) nomes.push(chave + '::' + i);
    var partes = cache.getAll(nomes);
    var texto = '';
    for (var j = 0; j < n; j++) {
      if (partes[chave + '::' + j] == null) return null;   // pedaço venceu
      texto += partes[chave + '::' + j];
    }
    return texto;
  }

  function _cacheGravar(chave, texto, segundos) {
    var cache = CacheService.getScriptCache();
    var lote = {}, n = 0;
    for (var i = 0; i < texto.length; i += _TAM_PEDACO) {
      lote[chave + '::' + n] = texto.substring(i, i + _TAM_PEDACO);
      n++;
    }
    lote[chave + '::n'] = String(n);
    cache.putAll(lote, segundos);
  }

  function _cacheLimpar(chave) {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get(chave + '::n') || 0);
    var nomes = [chave + '::n'];
    for (var i = 0; i < n; i++) nomes.push(chave + '::' + i);
    cache.removeAll(nomes);
  }

  function _limparCaches() {
    _cacheLimpar(CHAVE_INICIO);
    _cacheLimpar(CHAVE_LISTA);
  }

  function _mapa(aba) {
    var titulos = aba.getRange(CFG.HEADER_ROW, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    var m = {};
    titulos.forEach(function (t, i) {
      var n = _norm(t);
      if (n && !m[n]) m[n] = { col: i + 1, cab: String(t).trim() };
    });
    return m;
  }

  /** Colunas da aba, para a tela de Processos. */
  function _colunas(mapa) {
    return Object.keys(mapa)
      .map(function (n) { return { id: n, rotulo: mapa[n].cab, col: mapa[n].col }; })
      .sort(function (a, b) { return a.col - b.col; });
  }

  function _ler() {
    var aba = _aba();
    var mapa = _mapa(aba);
    var colunas = _colunas(mapa);
    var primeira = CFG.HEADER_ROW + 1;
    var ultima = aba.getLastRow();
    var linhas = [];

    if (ultima >= primeira) {
      var dados = aba.getRange(primeira, 1, ultima - primeira + 1, aba.getLastColumn()).getDisplayValues();
      dados.forEach(function (l, i) {
        if (!l.some(function (c) { return String(c).trim() !== ''; })) return;
        var v = {};
        colunas.forEach(function (c) { v[c.id] = String(l[c.col - 1] || '').trim(); });
        linhas.push({ linha: primeira + i, v: v, busca: l.join(' ').toLowerCase() });
      });
    }
    return { aba: aba, mapa: mapa, colunas: colunas, linhas: linhas };
  }

  /** Opções vindas da planilha: validação da coluna ou o que já foi usado nela. */
  function _opcoesDaColuna(aba, mapa, cabecalho, linhas) {
    var achou = mapa[_norm(cabecalho)];
    if (!achou) return [];
    var lista = [];
    try {
      var v = aba.getRange(CFG.HEADER_ROW + 1, achou.col).getDataValidation();
      if (v) {
        var tipo = v.getCriteriaType(), vals = v.getCriteriaValues();
        if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) lista = vals[0] || [];
        else if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
          lista = (vals[0].getDisplayValues() || []).map(function (l) { return l[0]; });
        }
      }
    } catch (e) { /* sem validação */ }

    if (!lista.length) {
      var vistos = {};
      linhas.forEach(function (l) {
        var t = String(l.v[_norm(cabecalho)] || '').trim();
        if (t) vistos[t] = true;
      });
      lista = Object.keys(vistos);
    }
    return lista.filter(function (x) { return String(x).trim(); })
                .sort(function (a, b) { return String(a).localeCompare(String(b), 'pt-BR'); });
  }

  /**
   * As opções de cada campo. Ordem de prioridade:
   *   1º a aba Listas, 2º a coluna da planilha, 3º a lista fixa do documento.
   */
  /**
   * `lerTudo` só é chamado se algum campo ainda depender da planilha — com a
   * aba Listas cobrindo tudo, a tela abre sem ler as linhas.
   */
  function _opcoesDosCampos(lerTudo) {
    var daAba = _listasDaAba();
    var r = null;
    var opcoes = {};
    PERGUNTAS.forEach(function (p) {
      var lista = _listaDaAba(daAba, p);
      if (!lista && p.daColuna) {
        if (!r) r = lerTudo();
        lista = _opcoesDaColuna(r.aba, r.mapa, p.daColuna, r.linhas);
      }
      if (!lista && p.opcoes) lista = p.opcoes;
      if (lista && lista.length) opcoes[p.id] = lista;
    });
    return opcoes;
  }

  function inicio() {
    var guardado = _cacheLer(CHAVE_INICIO);
    if (guardado) {
      try {
        var pronto = JSON.parse(guardado);
        // o que muda a cada abertura não vem do cache. O fuso vem guardado
        // junto, para nem precisar abrir a planilha.
        pronto.usuario = Session.getActiveUser().getEmail() || '';
        pronto.hoje = Utilities.formatDate(new Date(), pronto.fuso || 'America/Sao_Paulo', 'yyyy-MM-dd');
        pronto.proximoNumero = _verProximoNumero();
        return pronto;
      } catch (e) { /* segue e recalcula */ }
    }

    var opcoes = _opcoesDosCampos(_ler);
    var saida = _montarInicio(opcoes);
    _cacheGravar(CHAVE_INICIO, JSON.stringify(saida), 1800);
    return saida;
  }

  function _montarInicio(opcoes) {
    return {
      usuario: Session.getActiveUser().getEmail() || '',
      blocos: BLOCOS,
      perguntas: PERGUNTAS.map(function (p) {
        // campo com lista vira lista suspensa, mesmo que fosse texto
        var tipo = (opcoes[p.id] && opcoes[p.id].length && p.tipo !== 'data') ? 'select' : p.tipo;
        return { id: p.id, rotulo: p.rotulo, tipo: tipo, bloco: p.bloco,
                 obrig: !!p.obrig, auto: !!p.auto };
      }),
      fuso: _fuso(),
      hoje: Utilities.formatDate(new Date(), _fuso(), 'yyyy-MM-dd'),
      proximoNumero: _verProximoNumero(),
      opcoes: opcoes,
      anexoMaxMb: CFG.ANEXO_MAX_MB
    };
  }

  function listar(forcar) {
    // "Atualizar" também refaz as listas suspensas
    if (forcar) _cacheLimpar(CHAVE_INICIO);
    if (!forcar) {
      var guardado = _cacheLer(CHAVE_LISTA);
      if (guardado) {
        try { return JSON.parse(guardado); } catch (e) { /* segue e recalcula */ }
      }
    }
    var r = _ler();
    var saida = {
      campos: r.colunas.map(function (c) { return { id: c.id, rotulo: c.rotulo, tipo: 'texto' }; }),
      linhas: r.linhas
    };
    _cacheGravar(CHAVE_LISTA, JSON.stringify(saida), 600);
    return saida;
  }

  /* ---------------- aba própria de listas ---------------- */

  /**
   * Lê a aba Listas: título na linha 1, valores abaixo.
   * Devolve { 'título normalizado': [valores] } — uma entrada por coluna.
   */
  function _listasDaAba() {
    var porTitulo = {};
    if (!CFG.ABA_LISTAS) return porTitulo;

    var aba;
    try { aba = _planilha().getSheetByName(CFG.ABA_LISTAS); }
    catch (e) { aba = null; }
    if (!aba) return porTitulo;

    var ultima = aba.getLastRow(), largura = aba.getLastColumn();
    if (ultima < 2 || largura < 1) return porTitulo;

    var dados = aba.getRange(1, 1, ultima, largura).getDisplayValues();
    dados[0].forEach(function (titulo, i) {
      var t = _norm(titulo);
      if (!t) return;
      var vals = [], vistos = {};
      for (var l = 1; l < dados.length; l++) {
        var v = String(dados[l][i] || '').trim();
        if (v && !vistos[v]) { vistos[v] = true; vals.push(v); }
      }
      if (vals.length) porTitulo[t] = vals;
    });
    return porTitulo;
  }

  /**
   * A lista daquele campo. Procura, nesta ordem:
   *   1) o título apontado em CFG.LISTAS;
   *   2) uma coluna com o mesmo nome do rótulo do campo.
   * Assim, acrescentar uma coluna na aba Listas já basta.
   */
  function _listaDaAba(porTitulo, p) {
    var apontado = (CFG.LISTAS || {})[p.id];
    if (apontado && porTitulo[_norm(apontado)]) return porTitulo[_norm(apontado)];
    return porTitulo[_norm(p.rotulo)] || null;
  }

  /* ---------------- número da RNC ---------------- */

  function _fuso() {
    try { return _planilha().getSpreadsheetTimeZone() || 'America/Sao_Paulo'; }
    catch (e) { return 'America/Sao_Paulo'; }
  }

  /** Só para mostrar na tela; quem vale é o _proximoNumero() da gravação. */
  function _verProximoNumero() {
    var ultimo = Number(PropertiesService.getScriptProperties().getProperty('rnc_ultimo_numero') || 0);
    if (!ultimo || ultimo < CFG.NUMERO_MINIMO) ultimo = CFG.NUMERO_MINIMO;
    return String(ultimo + 1);
  }

  /**
   * Contador próprio, guardado no projeto. Nunca repete, mesmo com duas
   * pessoas enviando ao mesmo tempo, e pula o que já existir na planilha.
   */
  function _proximoNumero(linhas, mapa) {
    var props = PropertiesService.getScriptProperties();
    var ultimo = Number(props.getProperty('rnc_ultimo_numero') || 0);
    if (!ultimo || ultimo < CFG.NUMERO_MINIMO) ultimo = CFG.NUMERO_MINIMO;

    var usados = {};
    var idNum = _norm('Nº RNC');
    (linhas || []).forEach(function (l) {
      var t = String(l.v[idNum] || '').trim();
      var n = Number(t.replace(/[^0-9]/g, ''));
      if (n) usados[n] = true;
    });

    var numero = ultimo + 1;
    while (usados[numero]) numero++;
    props.setProperty('rnc_ultimo_numero', String(numero));
    return String(numero);
  }

  /* ---------------- PDF no layout do modelo em Word ---------------- */

  function _marcar(valor, opcao) {
    return '( ' + (_norm(valor) === _norm(opcao) ? 'X' : '&nbsp;') + ' ) ' + _esc(opcao);
  }

  function _dataBR(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || '');
  }

  function _quebras(t) {
    return _esc(t).replace(/\r?\n/g, '<br>');
  }

  function _htmlDoDocumento(d, arquivos, listas) {
    listas = listas || {};
    var BASE = 'border:1px solid #000;padding:4px 6px;font-size:9pt;vertical-align:top;';
    var TAB = ' style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:6px"';

    // uma única propriedade style por célula, senão o navegador ignora a segunda
    function td(css, txt, attrs) {
      return '<td' + (attrs ? ' ' + attrs : '') + ' style="' + BASE + (css || '') + '">' +
             (txt == null ? '' : txt) + '</td>';
    }
    function rot(txt, largura) {
      return td('font-weight:bold;' + (largura ? 'width:' + largura + ';' : ''), _esc(txt));
    }
    function barra(txt) {
      return '<table' + TAB + '><tr>' +
        td('font-weight:bold;background:#D9D9D9;text-align:center;', _esc(txt)) + '</tr></table>';
    }
    function caixa(txt) {
      return '<table' + TAB + '><tr>' + td('', _quebras(txt)) + '</tr></table>';
    }
    // três opções por linha, como no modelo em Word; se houver mais, continua
    // nas linhas de baixo, com o rótulo só na primeira
    function linhasMarcar(rotulo, valor, opcoes) {
      var fora = [];
      for (var i = 0; i < opcoes.length; i += 3) {
        var pedaco = opcoes.slice(i, i + 3);
        var cels = pedaco.map(function (o) { return td('', _marcar(valor, o)); });
        while (cels.length < 3) cels.push(td('', ''));
        fora.push('<tr>' + rot(i === 0 ? rotulo : '', '25%') + cels.join('') + '</tr>');
      }
      return fora.join('');
    }

    var fotos = (arquivos || []).filter(function (a) {
      return String(a.tipo || '').indexOf('image/') === 0;
    });

    var blocoFotos;
    if (fotos.length) {
      var linhas = [];
      for (var i = 0; i < fotos.length; i += 3) {
        var cel = [];
        for (var j = i; j < i + 3; j++) {
          if (j < fotos.length) {
            cel.push(td('width:33.33%;padding:6px;text-align:center;',
              '<img src="data:' + fotos[j].tipo + ';base64,' + fotos[j].dados +
              '" style="width:100%;max-height:300px">' +
              '<div style="font-size:8pt;margin-top:4px">Evidência ' + (j + 1) + ' — ' +
              _esc(fotos[j].nome) + '</div>'));
          } else {
            cel.push(td('width:33.33%;', ''));
          }
        }
        linhas.push('<tr>' + cel.join('') + '</tr>');
      }
      blocoFotos = '<table' + TAB + '>' + linhas.join('') + '</table>';
    } else {
      blocoFotos = '<table' + TAB + '><tr>' +
        td('padding:14px;text-align:center;', 'Sem evidências anexadas.') + '</tr></table>';
    }

    var outros = (arquivos || []).filter(function (a) {
      return String(a.tipo || '').indexOf('image/') !== 0;
    });
    var listaOutros = outros.length
      ? '<table' + TAB + '><tr>' + td('', '<b>Outros arquivos anexados:</b> ' +
          outros.map(function (a) { return _esc(a.nome); }).join(' · ')) + '</tr></table>'
      : '';

    return '' +
    '<html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:Arial,Helvetica,sans-serif;color:#000;margin:26px">' +

    '<table' + TAB + '>' +
      '<tr>' +
        td('width:20%;text-align:center;vertical-align:middle;color:#E36C0A;font-weight:bold;font-size:15pt;',
           'SolarGrid', 'rowspan="2"') +
        td('text-align:center;font-weight:bold;', 'INFORMAÇÃO DOCUMENTADA', 'colspan="2"') +
      '</tr>' +
      '<tr>' +
        td('font-size:8pt;', 'RNC - Relatório de Não Conformidade, Oportunidade de Melhoria e ' +
           'Não Conformidade Potencial') +
        td('width:16%;font-size:8pt;', 'Página: 1 de 1') +
      '</tr>' +
    '</table>' +

    '<table' + TAB + '>' +
      '<tr>' +
        rot('DATA DA RNC:', '16%') + td('width:17%;', _dataBR(d.data_rnc)) +
        rot('N° RNC:', '12%')      + td('width:17%;', _esc(d.n_rnc)) +
        rot('UFV', '10%')          + td('', _esc(d.ufv)) +
      '</tr>' +
    '</table>' +

    '<table' + TAB + '>' +
      linhasMarcar('ASSUNTO RELACIONADO:', d.assunto, listas.assunto || ASSUNTOS) +
      linhasMarcar('TIPO DE OCORRÊNCIA?',  d.tipo,    listas.tipo    || TIPOS) +
      linhasMarcar('FASE DO PROJETO:',     d.fase,    listas.fase    || FASES) +
    '</table>' +

    '<table' + TAB + '><tr>' + rot('RESUMO DA OCORRÊNCIA:', '25%') +
      td('', _quebras(d.resumo)) + '</tr></table>' +

    barra('DADOS INICIAIS') +
    '<table' + TAB + '>' +
      '<tr>' + rot('Fornecedor / Prestador:', '25%') + td('', _esc(d.fornecedor)) + '</tr>' +
      '<tr>' + rot('Descrição do Item:', '25%') + td('', _quebras(d.descricao_item)) + '</tr>' +
      '<tr>' + rot('Quantidade Recebida:', '25%') + td('', _esc(d.qtd_recebida)) + '</tr>' +
    '</table>' +

    barra('1. DESCRIÇÃO DA NÃO CONFORMIDADE / CAUSAS DA NÃO CONFORMIDADE') +
    caixa(d.descricao_nc) +

    barra('2. EVIDÊNCIAS DA NÃO CONFORMIDADE') +
    blocoFotos + listaOutros +

    barra('3. AÇÃO IMEDIATA') + caixa(d.acao_imediata) +

    barra('4. ANÁLISE DA CAUSA RAIZ DA NÃO CONFORMIDADE E/OU ANÁLISE DA OPORTUNIDADE DE MELHORIA') +
    caixa(d.causa_raiz) +

    barra('ASSINATURAS') +
    '<table' + TAB + '>' +
      '<tr>' + rot('Elaborador:', '25%') + td('', _esc(d.elaborador)) + '</tr>' +
      '<tr>' + rot('Revisão:', '25%') + td('', _esc(d.revisao)) + '</tr>' +
    '</table>' +

    '</body></html>';
  }

  /* ---------------- Drive ---------------- */

  function _nomeSeguro(nome) {
    return String(nome || 'arquivo').replace(/[\\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ').trim().substring(0, 120) || 'arquivo';
  }

  function _pasta(nome, arquivos) {
    var mae = DriveApp.getFolderById(CFG.PASTA_DRIVE_ID);
    var iguais = mae.getFoldersByName(nome);
    var pasta = iguais.hasNext() ? iguais.next() : mae.createFolder(nome);
    var salvos = [];
    (arquivos || []).forEach(function (a) {
      var n = _nomeSeguro(a.nome);
      var blob = Utilities.newBlob(Utilities.base64Decode(a.dados), a.tipo || 'application/octet-stream', n);
      var arq = pasta.createFile(blob);
      salvos.push({ nome: arq.getName(), url: arq.getUrl() });
    });
    return { pasta: pasta, id: pasta.getId(), nome: pasta.getName(), url: pasta.getUrl(), arquivos: salvos };
  }

  function _conferirTamanho(arquivos) {
    var bytes = 0;
    (arquivos || []).forEach(function (a) { bytes += Math.ceil((String(a.dados || '').length * 3) / 4); });
    if (bytes > CFG.ANEXO_MAX_MB * 1048576) {
      throw new Error('Os anexos somam ' + (bytes / 1048576).toFixed(1) +
        ' MB. O limite é ' + CFG.ANEXO_MAX_MB + ' MB por envio.');
    }
  }

  /* ---------------- aviso por e-mail ---------------- */

  function _avisarPorEmail(dados, pasta) {
    if (!CFG.EMAIL_NOVA_RNC) return;
    try {
      var quem = Session.getActiveUser().getEmail() || '(não identificado)';
      var html =
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#0A0F14;max-width:660px">' +
          '<div style="background:#EC6E2D;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0">' +
            '<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">SolarGrid — RNC</div>' +
            '<div style="font-size:19px;font-weight:700;margin-top:2px">Nova RNC ' + _esc(dados.n_rnc) + '</div>' +
          '</div>' +
          '<div style="border:1px solid #D8D8D8;border-top:none;border-radius:0 0 12px 12px;padding:14px">' +
            _quadroDaSolicitacao(dados) +
            (pasta ? '<div style="padding:14px 0 0">' +
              '<a href="' + pasta.url + '" style="display:inline-block;background:#EC6E2D;color:#fff;' +
              'text-decoration:none;font-weight:600;font-size:13px;padding:10px 18px;border-radius:8px">' +
              'Abrir a pasta ' + _esc(pasta.nome) + ' no Drive</a>' +
              '<ul style="margin:12px 0 0;padding-left:20px;font-size:12.5px;color:#5b6670">' +
              (pasta.arquivos || []).map(function (a) {
                return '<li style="margin:2px 0">' + _esc(a.nome) + '</li>';
              }).join('') + '</ul></div>' : '') +
            '<p style="margin:14px 0 0;font-size:12px;color:#5b6670">Aberta por ' + _esc(quem) + '.</p>' +
          '</div>' +
        '</div>';

      var envio = {
        to: CFG.EMAIL_NOVA_RNC,
        subject: '[RNC] Nova RNC ' + dados.n_rnc + ' — ' + quem,
        htmlBody: html,
        name: quem
      };
      if (quem.indexOf('@') > 0) envio.replyTo = quem;
      MailApp.sendEmail(envio);
    } catch (e) {
      console.error('Falha ao enviar o aviso da RNC: ' + e.message);
    }
  }

  /** Tabelinha com o que foi preenchido, para o corpo do e-mail. */
  function _quadroDaSolicitacao(dados) {
    return '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      PERGUNTAS.map(function (p) {
        var v = String(dados[p.id] == null ? '' : dados[p.id]).trim();
        if (!v) return '';
        if (p.tipo === 'data') v = _dataBR(v);
        return '<tr><td style="padding:6px 10px;border-bottom:1px solid #E6E6E6;color:#5b6670;width:38%">' +
               _esc(p.rotulo) + '</td><td style="padding:6px 10px;border-bottom:1px solid #E6E6E6;font-weight:600">' +
               _quebras(v) + '</td></tr>';
      }).join('') + '</table>';
  }

  /* ---------------- evidências de uma RNC já aberta ---------------- */

  /**
   * Fotos da pasta daquela linha. Devolve só os endereços das miniaturas —
   * quem baixa a imagem é o navegador, direto do Drive, então a tela não
   * carrega nada pesado pelo Apps Script.
   */
  function evidencias(linha) {
    try {
      var aba = _aba();
      var mapa = _mapa(aba);
      var colLink = mapa[_norm(CFG.COL_LINK_PASTA)];
      var colNum = mapa[_norm('Nº RNC')];
      var link = colLink ? String(aba.getRange(linha, colLink.col).getDisplayValue() || '').trim() : '';
      var numero = colNum ? String(aba.getRange(linha, colNum.col).getDisplayValue() || '').trim() : '';

      var pasta = null;
      var m = link.match(/folders\/([A-Za-z0-9_-]+)/);
      if (m) {
        try { pasta = DriveApp.getFolderById(m[1]); } catch (e) { pasta = null; }
      }
      if (!pasta && numero) {
        // linha antiga, sem o link: procura a pasta pelo número da RNC
        var mae = DriveApp.getFolderById(CFG.PASTA_DRIVE_ID);
        var it = mae.getFolders();
        while (it.hasNext()) {
          var f = it.next();
          if (_norm(f.getName()).indexOf(_norm(numero)) >= 0) { pasta = f; break; }
        }
      }
      if (!pasta) return { ok: false, motivo: 'sem pasta', arquivos: [] };

      var arquivos = [];
      var fs = pasta.getFiles();
      while (fs.hasNext() && arquivos.length < 40) {
        var arq = fs.next();
        var tipo = String(arq.getMimeType() || '');
        var id = arq.getId();
        arquivos.push({
          id: id,
          nome: arq.getName(),
          imagem: tipo.indexOf('image/') === 0,
          mini: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w800',
          url: arq.getUrl()
        });
      }
      return { ok: true, pastaUrl: pasta.getUrl(), pastaNome: pasta.getName(), arquivos: arquivos };
    } catch (e) {
      return { ok: false, motivo: e.message, arquivos: [] };
    }
  }

  /* ---------------- gravação ---------------- */

  function _paraCelula(tipo, valor) {
    var t = String(valor == null ? '' : valor).trim();
    if (!t) return '';
    if (tipo === 'data') {
      var m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    return t;
  }

  function criar(dados, arquivos) {
    dados = dados || {};
    arquivos = arquivos || [];

    var faltou = PERGUNTAS.filter(function (p) {
      return p.obrig && !String(dados[p.id] || '').trim();
    }).map(function (p) { return p.rotulo; });
    if (faltou.length) throw new Error('Preencha: ' + faltou.join(', ') + '.');
    if (!arquivos.length) throw new Error('Anexe ao menos uma evidência.');
    _conferirTamanho(arquivos);

    // O número e a data são do sistema, não do formulário.
    var r0 = _ler();
    var opcoes = _opcoesDosCampos(function () { return r0; });
    dados.n_rnc = _proximoNumero(r0.linhas, r0.mapa);
    dados.data_rnc = Utilities.formatDate(new Date(), _fuso(), 'yyyy-MM-dd');

    // Pasta e arquivos primeiro: assim nenhuma linha fica sem as evidências.
    var nomePasta = _nomeSeguro('RNC ' + dados.n_rnc);
    var pasta = _pasta(nomePasta, arquivos);

    try {
      var pdf = Utilities.newBlob(_htmlDoDocumento(dados, arquivos, opcoes), 'text/html', nomePasta + '.html')
        .getAs('application/pdf').setName(nomePasta + ' - RNC.pdf');
      var arq = pasta.pasta.createFile(pdf);
      pasta.arquivos.push({ nome: arq.getName(), url: arq.getUrl() });
    } catch (e) {
      console.error('Falha ao gerar o PDF da RNC: ' + e.message);
    }

    var trava = LockService.getScriptLock();
    trava.waitLock(20000);
    try {
      var aba = _aba();
      var mapa = _mapa(aba);
      var largura = aba.getLastColumn();
      var nova = Math.max(aba.getLastRow() + 1, CFG.HEADER_ROW + 1);
      if (nova > aba.getMaxRows()) aba.insertRowsAfter(aba.getMaxRows(), 1);

      var valores = new Array(largura).fill('');
      PERGUNTAS.forEach(function (p) {
        if (!p.planilha) return;
        var alvo = mapa[_norm(p.planilha)];
        if (!alvo) return;
        valores[alvo.col - 1] = _paraCelula(p.tipo, dados[p.id]);
      });

      // link da pasta das evidências e status inicial
      var colLink = mapa[_norm(CFG.COL_LINK_PASTA)];
      if (colLink) valores[colLink.col - 1] = pasta.url;
      var colStatus = mapa[_norm(CFG.COL_STATUS)];
      if (colStatus) valores[colStatus.col - 1] = CFG.STATUS_NOVO;

      var faixa = aba.getRange(nova, 1, 1, largura);
      var formulas = faixa.getFormulas()[0];
      for (var i = 0; i < largura; i++) {
        if (valores[i] === '' && formulas[i]) valores[i] = formulas[i];
      }
      faixa.setValues([valores]);
      SpreadsheetApp.flush();
      _limparCaches();

      _avisarPorEmail(dados, pasta);

      return { ok: true, linha: nova, numero: dados.n_rnc, pastaUrl: pasta.url,
               pastaNome: pasta.nome, anexos: arquivos.length };
    } finally {
      trava.releaseLock();
    }
  }

  function salvar(linha, alteracoes) {
    var trava = LockService.getScriptLock();
    trava.waitLock(20000);
    try {
      var aba = _aba();
      var mapa = _mapa(aba);
      var n = 0;
      Object.keys(alteracoes).forEach(function (id) {
        var alvo = mapa[id];
        if (!alvo) return;
        aba.getRange(linha, alvo.col).setValue(_paraCelula('texto', alteracoes[id]));
        n++;
      });
      SpreadsheetApp.flush();
      _limparCaches();
      return { ok: true, gravados: n };
    } finally {
      trava.releaseLock();
    }
  }

  return { inicio: inicio, listar: listar, criar: criar, salvar: salvar, evidencias: evidencias };
})();

/* Pontes para a tela */
function rnc_inicio() { return GAR_RNC.inicio(); }
function rnc_listar(forcar) { return GAR_RNC.listar(forcar); }
function rnc_criar(dados, arquivos) { return GAR_RNC.criar(dados, arquivos); }
function rnc_salvar(linha, alteracoes) { return GAR_RNC.salvar(linha, alteracoes); }
function rnc_evidencias(linha) { return GAR_RNC.evidencias(linha); }
