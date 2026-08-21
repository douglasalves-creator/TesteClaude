/**
 * IMPORTAÇÃO DE TAREFAS DO ASANA (projeto de Garantias) — backend
 *
 * Traz para a aba "Asana" as tarefas do projeto criadas a partir da
 * DATA_CORTE, com os campos nativos do Asana e os campos personalizados
 * do projeto — exceto os listados em CAMPOS_EXCLUIDOS.
 *
 * A função copiarNovosAcionamentos foi removida deste arquivo por ora —
 * será tratada em uma etapa separada.
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

  // Campos personalizados do Asana que não devem entrar na planilha.
  var CAMPOS_EXCLUIDOS = [
    "UFVs",
    "UFVs (CSC)",
    "Centro de Custo - Material/Despesas.",
    "Data de Necessidade Obra (Prévia)",
    "UFV's ( CSC ) revisado",
    "Fornecedor",
    "MAC (OBSOLETO)",
    "NS (OBSOLETO)"
  ];

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Asana");
  if (!sheet) {
    SpreadsheetApp.getActiveSpreadsheet().insertSheet("Asana");
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Asana");
  }

  // Limpa tudo para garantir que nenhuma tarefa suma ou fique de fora
  sheet.clear();

  var options = {
    "method": "get",
    "headers": { "Authorization": "Bearer " + ASANA_ACCESS_TOKEN },
    "muteHttpExceptions": true
  };

  // 1. Mapeia dinamicamente os campos personalizados do projeto (menos os excluídos)
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

  // Campos nativos do Asana que sempre trazemos, além dos personalizados
  var camposNativos = [
    "Task ID",
    "Data de Criação",
    "Status",
    "Link"
  ];

  var cabecalhos = camposNativos.concat(camposCustomizadosProjeto);

  // Cria os cabeçalhos na planilha limpa
  sheet.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]).setFontWeight("bold");

  var novasLinhas = [];
  var nextPageToken = "";
  var executarLoop = true;

  var optFields = [
    "name", "created_at", "completed", "custom_fields", "permalink_url"
  ].join(",");

  // 2. Busca TODAS as tarefas do projeto
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

      var dataCriacao = new Date(tarefa.created_at);

      // Filtro estrito: ignora tarefas anteriores à data de corte
      if (dataCriacao < DATA_CORTE) continue;

      var status = tarefa.completed ? "Concluído" : "Em andamento";
      var linkAsana = tarefa.permalink_url || "";

      var c = {};
      if (tarefa.custom_fields) {
        tarefa.custom_fields.forEach(function(campo) {
          var valor = campo.display_value;
          if (valor === null || valor === undefined || valor === "") {
            valor = campo.text_value || campo.number_value || "";
          }
          var nomeFormatado = campo.name.toLowerCase();
          if (nomeFormatado.indexOf("data") !== -1 && valor && typeof valor === "string" && valor.indexOf("T") !== -1 && valor.indexOf("Z") !== -1) {
            valor = new Date(valor);
          }
          c[campo.name.trim()] = valor;
        });
      }

      var linha = [
        "'" + taskId,
        dataCriacao,
        status,
        linkAsana
      ];

      camposCustomizadosProjeto.forEach(function(nomeCampo) {
        var valorCampo = c[nomeCampo];

        if (!(nomeCampo.toLowerCase().indexOf("data") !== -1) && valorCampo !== "" && valorCampo !== undefined) {
          linha.push("'" + valorCampo);
        } else {
          linha.push(valorCampo || "");
        }
      });

      novasLinhas.push(linha);
    }

    if (respostaJson.next_page && respostaJson.next_page.offset) {
      nextPageToken = respostaJson.next_page.offset;
    } else {
      executarLoop = false;
    }
  }

  // 3. Grava tudo do zero na planilha
  if (novasLinhas.length > 0) {
    sheet.getRange(2, 1, novasLinhas.length, novasLinhas[0].length).setValues(novasLinhas);

    // Formatações de data brasileiras (dd/MM/yyyy) em todas as colunas de data
    cabecalhos.forEach(function(cabecalho, index) {
      if (cabecalho.toLowerCase().indexOf("data") !== -1) {
        sheet.getRange(2, index + 1, sheet.getLastRow() - 1, 1).setNumberFormat("dd/MM/yyyy");
      }
    });

    SpreadsheetApp.getUi().alert("Sucesso! " + novasLinhas.length + " tarefas importadas de forma completa.");
  } else {
    SpreadsheetApp.getUi().alert("Nenhuma tarefa encontrada a partir de 10/08/2026.");
  }
}
