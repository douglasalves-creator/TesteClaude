/**
 * INTEGRAÇÃO ASANA ⇄ PLANILHA — CSC - Pagamento / Adiantamento - Billing
 *
 * Menu "Conexão c/ Asana" na planilha:
 *   - Importar Novas Solicitações: traz do Asana as tarefas criadas a partir de
 *     CONFIG.DATA_INICIO que ainda não estão na aba (chave: coluna "Task ID").
 *     Linhas já existentes não são alteradas.
 *   - Atualizar Requisições no Asana: para cada linha com Task ID, envia as
 *     colunas listadas em CONFIG.COLUNAS_ENVIAR_ASANA. Só envia células
 *     preenchidas e que estejam diferentes do Asana.
 *   - Ativar/Desativar importação automática: cria/remove um gatilho que roda
 *     a importação a cada CONFIG.INTERVALO_MINUTOS.
 *   - testarConexao (sem item no menu; rodar pelo editor): confere o token e
 *     mostra quais cabeçalhos casaram com campos do projeto.
 *
 * Os cabeçalhos da aba precisam ter o mesmo nome dos campos do Asana
 * (maiúsculas, acentos, espaços e pontuação são ignorados na comparação).
 *
 * O token NÃO fica no código: Configurações do projeto → Propriedades do
 * script → propriedade ASANA_TOKEN.
 */

const CONFIG = {
  PLANILHA_ID: '1oeReZeG0D8FiOBwgPn8r6oYYWALRyDxRxtVqy2cef68',
  ABA: 'Asana',
  PROJETO_GID: '1217461344794017',

  // Só importa tarefas criadas a partir desta data (horário de Brasília).
  DATA_INICIO: '2026-10-01',

  COLUNA_ID: 'Task ID',

  // Coluna preenchida com a data de criação da tarefa no Asana.
  COLUNA_DATA_CRIACAO: 'Data de Solicitação',

  // Colunas que a planilha "manda" no Asana. Coloque aqui, com o nome exato
  // do cabeçalho, os campos que serão preenchidos na planilha.
  // Ex.: ['Data de Pagamento', 'Valor a Pagar']
  COLUNAS_ENVIAR_ASANA: [],

  INTERVALO_MINUTOS: 15,
};

const ASANA_API = 'https://app.asana.com/api/1.0';
const FUSO = 'America/Sao_Paulo';

const CAMPOS_TAREFA = [
  'gid', 'created_at',
  'custom_fields.gid', 'custom_fields.name', 'custom_fields.resource_subtype',
  'custom_fields.display_value', 'custom_fields.text_value',
  'custom_fields.number_value', 'custom_fields.date_value',
  'custom_fields.enum_value.gid', 'custom_fields.multi_enum_values.gid',
  'custom_fields.enum_options.gid', 'custom_fields.enum_options.name',
  'custom_fields.enum_options.enabled',
].join(',');

// ---------------------------------------------------------------- menu

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔗 Conexão c/ Asana')
    .addItem('📥 Importar Novas Solicitações', 'importarTarefas')
    .addItem('📤 Atualizar Requisições no Asana', 'enviarParaAsana')
    .addSeparator()
    .addItem('▶️ Ativar Importação Automática', 'ativarAutomatico')
    .addItem('⏸️ Desativar Importação Automática', 'desativarAutomatico')
    .addToUi();
}

// ---------------------------------------------------------------- importação

function importarTarefas() {
  comTrava_(() => {
    const aba = abrirAba_();
    const cab = lerCabecalho_(aba);
    const colId = colunaId_(cab);

    const existentes = new Set(lerIds_(aba, colId));
    const inicio = new Date(CONFIG.DATA_INICIO + 'T00:00:00-03:00');

    const novas = listarTarefasProjeto_()
      .filter(t => new Date(t.created_at) >= inicio && !existentes.has(t.gid))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (novas.length) {
      const linhas = novas.map(t => montarLinha_(t, cab, colId));
      const primeira = aba.getLastRow() + 1;
      aba.getRange(primeira, colId + 1, linhas.length, 1).setNumberFormat('@');
      aba.getRange(primeira, 1, linhas.length, cab.length).setValues(linhas);
      formatarDatas_(aba, cab, novas, primeira);
    }

    avisar_(novas.length
      ? `${novas.length} tarefa(s) importada(s).`
      : 'Nenhuma tarefa nova.');
  });
}

function montarLinha_(tarefa, cab, colId) {
  const campos = indexarCampos_(tarefa);
  return cab.map((nome, i) => {
    if (i === colId) return tarefa.gid;
    if (ehColunaCriacao_(nome)) return new Date(tarefa.created_at);
    const cf = campos[normalizar_(nome)];
    return cf ? valorDoAsana_(cf) : '';
  });
}

function valorDoAsana_(cf) {
  switch (cf.resource_subtype) {
    case 'number':
      return cf.number_value == null ? '' : cf.number_value;
    case 'date':
      return cf.date_value && cf.date_value.date ? dataIso_(cf.date_value.date) : '';
    default:
      return cf.display_value == null ? '' : cf.display_value;
  }
}

// Aplica dd/mm/yyyy nas colunas que vieram de campos de data do Asana.
function formatarDatas_(aba, cab, tarefas, primeira) {
  const campos = indexarCampos_(tarefas[0]);
  cab.forEach((nome, i) => {
    const cf = campos[normalizar_(nome)];
    if (ehColunaCriacao_(nome) || (cf && cf.resource_subtype === 'date')) {
      aba.getRange(primeira, i + 1, tarefas.length, 1).setNumberFormat('dd/mm/yyyy');
    }
  });
}

// ---------------------------------------------------------------- envio

function enviarParaAsana() {
  comTrava_(() => {
    if (!CONFIG.COLUNAS_ENVIAR_ASANA.length) {
      avisar_('Nenhuma coluna configurada para envio. Preencha CONFIG.COLUNAS_ENVIAR_ASANA no código.');
      return;
    }

    const aba = abrirAba_();
    const cab = lerCabecalho_(aba);
    const colId = colunaId_(cab);

    const colunas = CONFIG.COLUNAS_ENVIAR_ASANA.map(nome => {
      const i = cab.findIndex(h => normalizar_(h) === normalizar_(nome));
      if (i < 0) throw new Error(`Coluna "${nome}" não encontrada na aba ${CONFIG.ABA}.`);
      return { nome, i };
    });

    const tarefas = {};
    listarTarefasProjeto_().forEach(t => { tarefas[t.gid] = t; });

    const dados = aba.getLastRow() > 1
      ? aba.getRange(2, 1, aba.getLastRow() - 1, cab.length).getValues()
      : [];

    let atualizadas = 0;
    const erros = [];

    dados.forEach((linha, n) => {
      const gid = String(linha[colId]).trim();
      if (!gid) return;
      const tarefa = tarefas[gid];
      if (!tarefa) { erros.push(`Linha ${n + 2}: tarefa ${gid} não está no projeto.`); return; }

      const campos = indexarCampos_(tarefa);
      const alteracoes = {};

      colunas.forEach(({ nome, i }) => {
        const celula = linha[i];
        if (celula === '' || celula == null) return;
        const cf = campos[normalizar_(nome)];
        if (!cf) { erros.push(`Linha ${n + 2}: campo "${nome}" não existe na tarefa.`); return; }
        try {
          const valor = valorParaAsana_(cf, celula);
          if (!igualAoAsana_(cf, valor)) alteracoes[cf.gid] = valor;
        } catch (e) {
          erros.push(`Linha ${n + 2}, "${nome}": ${e.message}`);
        }
      });

      if (Object.keys(alteracoes).length) {
        try {
          asana_('put', `/tasks/${gid}`, { data: { custom_fields: alteracoes } });
          atualizadas++;
        } catch (e) {
          erros.push(`Linha ${n + 2}: ${e.message}`);
        }
      }
    });

    let msg = `${atualizadas} tarefa(s) atualizada(s) no Asana.`;
    if (erros.length) {
      msg += `\n\n${erros.length} problema(s):\n` + erros.slice(0, 15).join('\n');
      if (erros.length > 15) msg += `\n... (ver registros de execução)`;
      console.warn(erros.join('\n'));
    }
    avisar_(msg);
  });
}

function valorParaAsana_(cf, celula) {
  switch (cf.resource_subtype) {
    case 'text':
      return celula instanceof Date
        ? Utilities.formatDate(celula, FUSO, 'dd/MM/yyyy')
        : String(celula).trim();

    case 'number': {
      if (typeof celula === 'number') return celula;
      const n = Number(String(celula).replace(/[R$\s.]/g, '').replace(',', '.'));
      if (isNaN(n)) throw new Error(`"${celula}" não é um número.`);
      return n;
    }

    case 'date': {
      let d = celula;
      if (!(d instanceof Date)) {
        const m = String(celula).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) throw new Error(`"${celula}" não é uma data (dd/mm/aaaa).`);
        d = new Date(+m[3], +m[2] - 1, +m[1]);
      }
      return { date: Utilities.formatDate(d, FUSO, 'yyyy-MM-dd') };
    }

    case 'enum':
      return opcaoEnum_(cf, celula);

    case 'multi_enum':
      return String(celula).split(',').map(s => s.trim()).filter(Boolean)
        .map(s => opcaoEnum_(cf, s));

    default:
      throw new Error(`tipo de campo "${cf.resource_subtype}" não suportado para envio.`);
  }
}

function opcaoEnum_(cf, texto) {
  const alvo = normalizar_(texto);
  const op = (cf.enum_options || []).find(o => o.enabled !== false && normalizar_(o.name) === alvo);
  if (!op) throw new Error(`opção "${texto}" não existe no Asana.`);
  return op.gid;
}

function igualAoAsana_(cf, valor) {
  switch (cf.resource_subtype) {
    case 'text':       return (cf.text_value || '') === valor;
    case 'number':     return cf.number_value === valor;
    case 'date':       return !!cf.date_value && cf.date_value.date === valor.date;
    case 'enum':       return !!cf.enum_value && cf.enum_value.gid === valor;
    case 'multi_enum': {
      const atual = (cf.multi_enum_values || []).map(o => o.gid).sort().join();
      return atual === valor.slice().sort().join();
    }
    default:           return false;
  }
}

// ---------------------------------------------------------------- automático

function ativarAutomatico() {
  desativarAutomatico_(true);
  ScriptApp.newTrigger('importarTarefas')
    .timeBased()
    .everyMinutes(CONFIG.INTERVALO_MINUTOS)
    .create();
  avisar_(`Importação automática ativada (a cada ${CONFIG.INTERVALO_MINUTOS} min).`);
}

function desativarAutomatico() {
  desativarAutomatico_(false);
}

function desativarAutomatico_(silencioso) {
  let n = 0;
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'importarTarefas')
    .forEach(t => { ScriptApp.deleteTrigger(t); n++; });
  if (!silencioso) avisar_(n ? 'Importação automática desativada.' : 'Não havia importação automática ativa.');
}

// ---------------------------------------------------------------- diagnóstico

function testarConexao() {
  const eu = asana_('get', '/users/me?opt_fields=name,email').data;
  const proj = asana_('get', `/projects/${CONFIG.PROJETO_GID}` +
    '?opt_fields=name,custom_field_settings.custom_field.name').data;

  const camposAsana = proj.custom_field_settings.map(s => s.custom_field.name);
  const chaves = new Set(camposAsana.map(normalizar_));

  const cab = lerCabecalho_(abrirAba_());
  const semPar = cab.filter(h => h && normalizar_(h) !== normalizar_(CONFIG.COLUNA_ID)
    && !ehColunaCriacao_(h) && !chaves.has(normalizar_(h)));

  let msg = `Conectado como ${eu.name} (${eu.email}).\nProjeto: ${proj.name}.\n\n`;
  msg += semPar.length
    ? `Cabeçalhos SEM campo correspondente no Asana:\n- ${semPar.join('\n- ')}\n\n` +
      `Campos do projeto:\n- ${camposAsana.join('\n- ')}`
    : 'Todos os cabeçalhos casaram com campos do Asana.';
  avisar_(msg);
}

// ---------------------------------------------------------------- Asana

function listarTarefasProjeto_() {
  const tarefas = [];
  let offset = null;
  do {
    let url = `/tasks?project=${CONFIG.PROJETO_GID}&limit=100&opt_fields=${CAMPOS_TAREFA}`;
    if (offset) url += `&offset=${offset}`;
    const resp = asana_('get', url);
    tarefas.push(...resp.data);
    offset = resp.next_page ? resp.next_page.offset : null;
  } while (offset);
  return tarefas;
}

function asana_(metodo, caminho, corpo) {
  const token = PropertiesService.getScriptProperties().getProperty('ASANA_TOKEN');
  if (!token) throw new Error('Propriedade ASANA_TOKEN não configurada no script.');

  const opcoes = {
    method: metodo,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    muteHttpExceptions: true,
  };
  if (corpo) {
    opcoes.contentType = 'application/json';
    opcoes.payload = JSON.stringify(corpo);
  }

  for (let tentativa = 1; ; tentativa++) {
    const resp = UrlFetchApp.fetch(ASANA_API + caminho, opcoes);
    const codigo = resp.getResponseCode();
    if (codigo < 300) return JSON.parse(resp.getContentText());

    // Limite de requisições ou instabilidade do Asana: espera e tenta de novo.
    if ((codigo === 429 || codigo >= 500) && tentativa < 4) {
      const espera = Number(resp.getHeaders()['Retry-After']) || tentativa * 5;
      Utilities.sleep(espera * 1000);
      continue;
    }

    let detalhe = resp.getContentText();
    try { detalhe = JSON.parse(detalhe).errors.map(e => e.message).join('; '); } catch (e) {}
    if (codigo === 401) detalhe = 'token inválido ou revogado (ASANA_TOKEN).';
    throw new Error(`Asana respondeu ${codigo}: ${detalhe}`);
  }
}

// ---------------------------------------------------------------- planilha

function abrirAba_() {
  const aba = SpreadsheetApp.openById(CONFIG.PLANILHA_ID).getSheetByName(CONFIG.ABA);
  if (!aba) throw new Error(`Aba "${CONFIG.ABA}" não encontrada.`);
  return aba;
}

function lerCabecalho_(aba) {
  return aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
    .map(h => String(h).trim());
}

function colunaId_(cab) {
  const i = cab.findIndex(h => normalizar_(h) === normalizar_(CONFIG.COLUNA_ID));
  if (i < 0) throw new Error(`Coluna "${CONFIG.COLUNA_ID}" não encontrada.`);
  return i;
}

function lerIds_(aba, colId) {
  if (aba.getLastRow() < 2) return [];
  return aba.getRange(2, colId + 1, aba.getLastRow() - 1, 1).getValues()
    .map(r => String(r[0]).trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- utilitários

function ehColunaCriacao_(nome) {
  return normalizar_(nome) === normalizar_(CONFIG.COLUNA_DATA_CRIACAO);
}

function indexarCampos_(tarefa) {
  const mapa = {};
  (tarefa.custom_fields || []).forEach(cf => { mapa[normalizar_(cf.name)] = cf; });
  return mapa;
}

// "N° de Requisição" e "nº de requisicao" viram a mesma chave.
function normalizar_(texto) {
  return String(texto)
    .replace(/[°º]/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function dataIso_(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function comTrava_(fn) {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(30000)) {
    avisar_('Outra sincronização está em andamento. Tente de novo em instantes.');
    return;
  }
  try {
    fn();
  } catch (e) {
    avisar_('Erro: ' + e.message);
    throw e;
  } finally {
    trava.releaseLock();
  }
}

// Mostra alerta quando rodado pelo menu; nos gatilhos só registra no log.
function avisar_(msg) {
  console.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // Sem interface (execução por gatilho).
  }
}
