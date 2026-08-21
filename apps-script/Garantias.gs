/**
 * IMPORTAÇÃO DE TAREFAS DO ASANA (projeto de Garantias) — backend
 *
 * Modo INCREMENTAL: a planilha funciona como um registro congelado no
 * tempo. A cada execução, o script busca as tarefas do Asana criadas a
 * partir da DATA_CORTE e só ACRESCENTA no final da aba "Asana" as que
 * ainda não têm uma linha lá (comparando pelo Task ID). Linhas já
 * existentes nunca são apagadas, sobrescritas ou atualizadas — mesmo que
 * o card correspondente tenha mudado no Asana.
 *
 * Isso é proposital: o fluxo futuro é o inverso (planilha -> Asana), então
 * a planilha não pode ficar recebendo atualizações do card por cima do que
 * já foi registrado.
 *
 * Ao final, as tarefas novas que tiverem um código SCGAR ainda não
 * cadastrado na aba "Controle Acionamento" são copiadas automaticamente
 * para lá (ver transferirNovosParaControleAcionamento_).
 *
 * O token de acesso do Asana não fica no código: configure-o uma vez em
 * Extensões > Apps Script > Configurações do projeto > Propriedades do script,
 * com a chave ASANA_ACCESS_TOKEN.
 */

function rodarAutomaçãoCompleta() {
  var ASANA_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("ASANA_ACCESS_TOKEN");
  if (!ASANA_ACCESS_TOKEN) {
    SpreadsheetApp.getUi().alert("Configure a propriedade do script ASANA_ACCESS_TOKEN antes de rodar (Extensões > Apps Script > Configurações do projeto > Propriedades do script).");
    return;
  }
  var PROJECT_ID = "1214318804635619";
  // Data de corte: só entram tarefas criadas a partir de 21/08/2026.
  var DATA_CORTE = new Date("2026-08-21T00:00:00Z");

  // Campos personalizados do Asana que não devem entrar na planilha
  // (só é usado na primeira execução, quando os cabeçalhos ainda não existem).
  var CAMPOS_EXCLUIDOS = [
    "UFVs",
    "UFVs (CSC)",
    "Centro de Custo - Material/Despesas.",
    "Data de Necessidade Obra (Prévia)",
    "UFV's ( CSC ) revisado",
    "Fornecedor",
    "Severidade/Impacto",
    "Prioridade",
    "Setores da SolarGrid",
    "Tipos SC Serviços",
    "MAC (OBSOLETO)",
    "NS (OBSOLETO)"
  ];

  // Campos nativos do Asana que sempre trazemos, além dos personalizados
  var CAMPOS_NATIVOS = ["Task ID", "Data de Criação", "Status", "Link"];

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Asana");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Asana");
  }

  var options = {
    "method": "get",
    "headers": { "Authorization": "Bearer " + ASANA_ACCESS_TOKEN },
    "muteHttpExceptions": true
  };

  var idxTaskIdCabecalho = -1;
  var cabecalhos;
  var linhasExistentes = sheet.getLastRow();

  if (linhasExistentes > 0) {
    // Já existem cabeçalhos: respeita a ordem de colunas que já está na planilha
    // (inclusive se você reorganizou manualmente).
    cabecalhos = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    idxTaskIdCabecalho = cabecalhos.indexOf("Task ID");
    if (idxTaskIdCabecalho === -1) {
      SpreadsheetApp.getUi().alert("Erro: não encontrei a coluna 'Task ID' no cabeçalho da aba Asana.");
      return;
    }
  } else {
    // Primeira execução: mapeia dinamicamente os campos personalizados do
    // projeto (menos os excluídos) e cria o cabeçalho do zero.
    var urlCampos = "https://app.asana.com/api/1.0/projects/" + PROJECT_ID + "/custom_field_settings";
    var responseCampos = UrlFetchApp.fetch(urlCampos, options);
    if (responseCampos.getResponseCode() !== 200) {
      SpreadsheetApp.getUi().alert("Erro ao buscar campos: " + responseCampos.getContentText());
      return;
    }

    var configuracoesCampos = JSON.parse(responseCampos.getContentText()).data;
    var camposCustomizadosProjeto = [];
    configuracoesCampos.forEach(function(config) {
      if (config.custom_field) {
        var nomeCampo = config.custom_field.name.trim();
        if (camposCustomizadosProjeto.indexOf(nomeCampo) === -1 && CAMPOS_EXCLUIDOS.indexOf(nomeCampo) === -1) {
          camposCustomizadosProjeto.push(nomeCampo);
        }
      }
    });

    cabecalhos = CAMPOS_NATIVOS.concat(camposCustomizadosProjeto);
    idxTaskIdCabecalho = cabecalhos.indexOf("Task ID");
    sheet.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]).setFontWeight("bold");
    linhasExistentes = 1;
  }

  // Guarda os Task IDs que já estão na planilha, para não duplicar nem tocar neles.
  var taskIdsExistentes = {};
  if (linhasExistentes > 1) {
    var colunaTaskId = sheet.getRange(2, idxTaskIdCabecalho + 1, linhasExistentes - 1, 1).getValues();
    colunaTaskId.forEach(function(row) {
      var id = row[0].toString().replace(/^'/, "").trim();
      if (id) taskIdsExistentes[id] = true;
    });
  }

  var novasLinhas = [];
  var nextPageToken = "";
  var executarLoop = true;

  var optFields = [
    "name", "created_at", "completed", "custom_fields", "permalink_url"
  ].join(",");

  // Busca as tarefas do projeto, página por página
  while (executarLoop) {
    var url = "https://app.asana.com/api/1.0/projects/" + PROJECT_ID +
              "/tasks?limit=100" +
              "&opt_fields=" + optFields;

    if (nextPageToken) {
      url += "&offset=" + nextPageToken;
    }

    var response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      SpreadsheetApp.getUi().alert("Erro na API: " + response.getContentText());
      return;
    }

    var respostaJson = JSON.parse(response.getContentText());
    var tarefas = respostaJson.data;

    for (var j = 0; j < tarefas.length; j++) {
      var tarefa = tarefas[j];
      var taskId = tarefa.gid.toString().trim();

      // Já está na planilha: pula, para não sobrescrever o que já foi registrado.
      if (taskIdsExistentes[taskId]) continue;

      var dataCriacao = new Date(tarefa.created_at);

      // Filtro estrito: ignora tarefas anteriores à data de corte
      if (dataCriacao < DATA_CORTE) continue;

      var status = tarefa.completed ? "Concluído" : "Em andamento";
      var linkAsana = tarefa.permalink_url || "";

      var valoresPorNomeDeCampo = {
        "Task ID": "'" + taskId,
        "Data de Criação": dataCriacao,
        "Status": status,
        "Link": linkAsana
      };

      if (tarefa.custom_fields) {
        tarefa.custom_fields.forEach(function(campo) {
          var valor = campo.display_value;
          if (valor === null || valor === undefined || valor === "") {
            valor = campo.text_value || campo.number_value || "";
          }
          var nomeFormatado = campo.name.toLowerCase();
          if (nomeFormatado.indexOf("data") !== -1 && valor && typeof valor === "string" && valor.indexOf("T") !== -1 && valor.indexOf("Z") !== -1) {
            valor = new Date(valor);
          } else if (valor !== "" && valor !== undefined && nomeFormatado.indexOf("data") === -1) {
            valor = "'" + valor;
          }
          valoresPorNomeDeCampo[campo.name.trim()] = valor;
        });
      }

      var linha = cabecalhos.map(function(nomeColuna) {
        var valor = valoresPorNomeDeCampo[nomeColuna];
        return valor !== undefined ? valor : "";
      });

      novasLinhas.push(linha);
      taskIdsExistentes[taskId] = true;
    }

    if (respostaJson.next_page && respostaJson.next_page.offset) {
      nextPageToken = respostaJson.next_page.offset;
    } else {
      executarLoop = false;
    }
  }

  // Só acrescenta as tarefas novas no final da planilha — nada é apagado ou reescrito.
  if (novasLinhas.length > 0) {
    var proximaLinha = sheet.getLastRow() + 1;
    sheet.getRange(proximaLinha, 1, novasLinhas.length, cabecalhos.length).setValues(novasLinhas);

    // Formatações de data brasileiras (dd/MM/yyyy) nas colunas de data das linhas novas
    cabecalhos.forEach(function(cabecalho, index) {
      if (cabecalho.toLowerCase().indexOf("data") !== -1) {
        sheet.getRange(proximaLinha, index + 1, novasLinhas.length, 1).setNumberFormat("dd/MM/yyyy");
      }
    });

    SpreadsheetApp.getUi().alert("Sucesso! " + novasLinhas.length + " tarefa(s) nova(s) adicionada(s).");

    transferirNovosParaControleAcionamento_(novasLinhas, cabecalhos);
  } else {
    SpreadsheetApp.getUi().alert("Nenhuma tarefa nova encontrada a partir de 21/08/2026.");
  }
}

/**
 * Copia para a aba "Controle Acionamento" as tarefas recém-importadas da
 * aba "Asana" cujo código SCGAR ainda não existe lá. O cabeçalho da aba
 * Controle Acionamento fica na linha 6; nunca sobrescreve linhas
 * existentes, só acrescenta no final.
 */
function transferirNovosParaControleAcionamento_(novasLinhasAsana, cabecalhosAsana) {
  var LINHA_CABECALHO_CONTROLE = 6;

  var abaControle = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Controle Acionamento");
  if (!abaControle) {
    SpreadsheetApp.getUi().alert("Aviso: a aba 'Controle Acionamento' não foi encontrada — as tarefas novas não foram copiadas para lá.");
    return;
  }

  var cabecalhosControle = abaControle.getRange(LINHA_CABECALHO_CONTROLE, 1, 1, abaControle.getLastColumn())
    .getValues()[0]
    .map(function(c) { return c.toString().trim().toLowerCase(); });

  function idxControle(nome) { return cabecalhosControle.indexOf(nome.trim().toLowerCase()); }
  function idxAsana(nome) { return cabecalhosAsana.indexOf(nome); }

  var idxScgarControle = idxControle("SCGAR");
  var idxScgarAsana = idxAsana("SCGAR");
  if (idxScgarControle === -1) {
    SpreadsheetApp.getUi().alert("Erro: coluna 'SCGAR' não encontrada na linha " + LINHA_CABECALHO_CONTROLE + " da aba Controle Acionamento.");
    return;
  }
  if (idxScgarAsana === -1) {
    SpreadsheetApp.getUi().alert("Erro: coluna 'SCGAR' não encontrada na aba Asana.");
    return;
  }

  // De-Para: coluna de origem na aba Asana -> coluna de destino na aba Controle Acionamento
  var MAPEAMENTO = [
    { de: "SCGAR", para: "SCGAR" },
    { de: "Data de Criação", para: "Data de Solicitação" },
    { de: "Tipo Acionamento Garantia", para: "Tipo de Acionamento" },
    { de: "Link", para: "Link do Card" },
    { de: "UFV (Supply)", para: "UFV de Origem" },
    { de: "Fornecedor (Garantia)", para: "Fornecedor" },
    { de: "Material Para Garantia", para: "Material/Equipamento" },
    { de: "Quantidade", para: "Qtd" },
    { de: "MAC", para: "MAC" },
    { de: "NS", para: "NS" },
    { de: "Relato do ocorrido / Falha do equipamento", para: "Motivo Inicial" }
  ];

  // Guarda os SCGAR que já existem no Controle Acionamento, para não duplicar.
  var scgarExistentes = {};
  var ultimaLinhaControle = abaControle.getLastRow();
  if (ultimaLinhaControle > LINHA_CABECALHO_CONTROLE) {
    var colunaScgarControle = abaControle
      .getRange(LINHA_CABECALHO_CONTROLE + 1, idxScgarControle + 1, ultimaLinhaControle - LINHA_CABECALHO_CONTROLE, 1)
      .getValues();
    colunaScgarControle.forEach(function(row) {
      var codigo = row[0].toString().replace(/^'/, "").trim();
      if (codigo) scgarExistentes[codigo] = true;
    });
  }

  var novasLinhasControle = [];
  novasLinhasAsana.forEach(function(linhaAsana) {
    var scgarBruto = linhaAsana[idxScgarAsana];
    var scgar = scgarBruto ? scgarBruto.toString().replace(/^'/, "").trim() : "";
    if (!scgar || scgarExistentes[scgar]) return;

    var dadosMapeados = {};
    MAPEAMENTO.forEach(function(vinculo) {
      var indiceOrigem = idxAsana(vinculo.de);
      dadosMapeados[vinculo.para] = indiceOrigem !== -1 ? linhaAsana[indiceOrigem] : "";
    });

    novasLinhasControle.push(dadosMapeados);
    scgarExistentes[scgar] = true;
  });

  if (novasLinhasControle.length === 0) return;

  var proximaLinha = abaControle.getLastRow() + 1;
  var colunasParaGravar = MAPEAMENTO.map(function(m) { return m.para; });

  colunasParaGravar.forEach(function(nomeColunaDestino) {
    var indiceColunaDestino = idxControle(nomeColunaDestino);
    if (indiceColunaDestino === -1) return;

    var valoresColuna = novasLinhasControle.map(function(linha) { return [linha[nomeColunaDestino]]; });
    var rangeDestino = abaControle.getRange(proximaLinha, indiceColunaDestino + 1, valoresColuna.length, 1);
    rangeDestino.setValues(valoresColuna);

    if (nomeColunaDestino.toLowerCase().indexOf("data") !== -1) {
      rangeDestino.setNumberFormat("dd/MM/yyyy");
    }
  });

  SpreadsheetApp.getUi().alert(novasLinhasControle.length + " tarefa(s) também adicionada(s) na aba Controle Acionamento.");
}
