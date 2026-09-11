/**
 * RNC — Registro de Não Conformidade.
 * Tudo preso ao NOME do cabeçalho (linha 9), nunca à ordem das colunas.
 * Namespace próprio, para não brigar com os outros scripts do projeto.
 */
var GAR_RNC = (function () {

  var CFG = {
    SPREADSHEET_ID: '10XC9wnG3g9oaZVcja77ogyVVnLtKUBTLLoGQZgSQ1tE',
    ABA: 'Lista EP ( Para conciliação)',
    HEADER_ROW: 9,
    CACHE_SEG: 600
  };

  // Campos do formulário, na ordem em que aparecem na tela.
  var CAMPOS = [
    { cab: 'Nº Documento',          tipo: 'texto' },
    { cab: 'Nº RNC',                tipo: 'texto' },
    { cab: 'UFV',                   tipo: 'select' },
    { cab: 'Etapa',                 tipo: 'select' },
    { cab: 'Nome do Fornecedor',    tipo: 'select' },
    { cab: 'Resumo da Ocorrência',  tipo: 'area'  },
    { cab: 'Status - RNC',          tipo: 'select' },
    { cab: 'RNC',                   tipo: 'texto' },
    { cab: 'Data de Emissão',       tipo: 'data'  },
    { cab: 'Status Tratativa',      tipo: 'select' },
    { cab: 'Data de Conclusão',     tipo: 'data'  },
    { cab: 'ATUALIZAÇÃO',           tipo: 'area'  }
  ];

  function _norm(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function _aba() {
    var ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    var aba = ss.getSheetByName(CFG.ABA);
    if (!aba) throw new Error('A aba "' + CFG.ABA + '" não foi encontrada.');
    return aba;
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

  /** Campos que existem mesmo na aba + as colunas extras que houver. */
  function _ativos(aba, mapa) {
    var usados = {}, saida = [];
    CAMPOS.forEach(function (c) {
      var achou = mapa[_norm(c.cab)];
      if (!achou) return;
      usados[_norm(c.cab)] = true;
      saida.push({ id: _norm(c.cab), rotulo: achou.cab, tipo: c.tipo, col: achou.col });
    });
    Object.keys(mapa).forEach(function (n) {
      if (usados[n]) return;
      saida.push({ id: n, rotulo: mapa[n].cab, tipo: 'texto', col: mapa[n].col, extra: true });
    });
    return saida;
  }

  /** Opções das listas: a validação da própria planilha; senão, o que já foi usado. */
  function _opcoes(aba, campos, linhas) {
    var fim = aba.getLastRow();
    var op = {};
    campos.forEach(function (c) {
      if (c.tipo !== 'select') return;
      var lista = [];
      try {
        var v = aba.getRange(CFG.HEADER_ROW + 1, c.col).getDataValidation();
        if (v) {
          var tipo = v.getCriteriaType(), vals = v.getCriteriaValues();
          if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
            lista = vals[0] || [];
          } else if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
            lista = (vals[0].getDisplayValues() || []).map(function (l) { return l[0]; });
          }
        }
      } catch (e) { /* sem validação */ }

      if (!lista.length) {
        var vistos = {};
        linhas.forEach(function (l) {
          var t = String(l.v[c.id] || '').trim();
          if (t) vistos[t] = true;
        });
        lista = Object.keys(vistos);
      }
      op[c.id] = lista.filter(function (x) { return String(x).trim(); })
                      .sort(function (a, b) { return String(a).localeCompare(String(b), 'pt-BR'); });
    });
    return op;
  }

  function _ler() {
    var aba = _aba();
    var mapa = _mapa(aba);
    var campos = _ativos(aba, mapa);
    var primeira = CFG.HEADER_ROW + 1;
    var ultima = aba.getLastRow();
    var linhas = [];

    if (ultima >= primeira) {
      var dados = aba.getRange(primeira, 1, ultima - primeira + 1, aba.getLastColumn()).getDisplayValues();
      dados.forEach(function (l, i) {
        var temAlgo = l.some(function (c) { return String(c).trim() !== ''; });
        if (!temAlgo) return;
        var v = {};
        campos.forEach(function (c) { v[c.id] = String(l[c.col - 1] || '').trim(); });
        linhas.push({ linha: primeira + i, v: v, busca: l.join(' ').toLowerCase() });
      });
    }
    return { aba: aba, mapa: mapa, campos: campos, linhas: linhas };
  }

  function inicio() {
    var r = _ler();
    return {
      usuario: Session.getActiveUser().getEmail() || '',
      campos: r.campos.map(function (c) {
        return { id: c.id, rotulo: c.rotulo, tipo: c.tipo, extra: !!c.extra };
      }),
      opcoes: _opcoes(r.aba, r.campos, r.linhas)
    };
  }

  function listar() {
    var r = _ler();
    return {
      campos: r.campos.map(function (c) { return { id: c.id, rotulo: c.rotulo, tipo: c.tipo }; }),
      linhas: r.linhas
    };
  }

  function _paraCelula(campo, valor) {
    var t = String(valor == null ? '' : valor).trim();
    if (!t) return '';
    if (campo.tipo === 'data') {
      var m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    return t;
  }

  function criar(dados) {
    var trava = LockService.getScriptLock();
    trava.waitLock(20000);
    try {
      var r = _ler();
      var aba = r.aba;
      var largura = aba.getLastColumn();
      var nova = Math.max(aba.getLastRow() + 1, CFG.HEADER_ROW + 1);
      if (nova > aba.getMaxRows()) aba.insertRowsAfter(aba.getMaxRows(), 1);

      var valores = new Array(largura).fill('');
      r.campos.forEach(function (c) {
        if (!(c.id in dados)) return;
        valores[c.col - 1] = _paraCelula(c, dados[c.id]);
      });

      // devolve as fórmulas que já existirem na linha, em vez de apagá-las
      var faixa = aba.getRange(nova, 1, 1, largura);
      var formulas = faixa.getFormulas()[0];
      for (var i = 0; i < largura; i++) {
        if (valores[i] === '' && formulas[i]) valores[i] = formulas[i];
      }
      faixa.setValues([valores]);
      SpreadsheetApp.flush();
      return { ok: true, linha: nova };
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
      var campos = _ativos(aba, mapa);
      var n = 0;
      campos.forEach(function (c) {
        if (!(c.id in alteracoes)) return;
        aba.getRange(linha, c.col).setValue(_paraCelula(c, alteracoes[c.id]));
        n++;
      });
      SpreadsheetApp.flush();
      return { ok: true, gravados: n };
    } finally {
      trava.releaseLock();
    }
  }

  return { inicio: inicio, listar: listar, criar: criar, salvar: salvar };
})();

/* Pontes para a tela */
function rnc_inicio() { return GAR_RNC.inicio(); }
function rnc_listar() { return GAR_RNC.listar(); }
function rnc_criar(dados) { return GAR_RNC.criar(dados); }
function rnc_salvar(linha, alteracoes) { return GAR_RNC.salvar(linha, alteracoes); }
