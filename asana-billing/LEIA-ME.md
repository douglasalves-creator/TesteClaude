# Asana ⇄ Planilha — CSC - Pagamento / Adiantamento - Billing

## Instalação

1. **Token do Asana:** em *Meus aplicativos → Tokens de acesso pessoal → Criar novo token*,
   dê um nome (ex.: `Planilha Billing`), aceite os termos e **copie o token**
   (ele aparece uma única vez).
2. Na planilha: **Extensões → Apps Script**. Cole o conteúdo de `Codigo.gs` e salve.
3. No Apps Script: **Configurações do projeto (engrenagem) → Propriedades do script →
   Adicionar propriedade**: nome `ASANA_TOKEN`, valor = token copiado.
4. Recarregue a planilha. Aparece o menu **🔗 Conexão c/ Asana**.
5. No editor do Apps Script, selecione a função `testarConexao` e clique em **Executar** (na 1ª vez, autorize o script).

## Menu

| Item | O que faz |
|---|---|
| 📥 Importar Novas Solicitações | Traz tarefas criadas desde `DATA_INICIO` que ainda não estão na aba. Não altera linhas existentes. |
| 📤 Atualizar Requisições no Asana | Envia as colunas de `COLUNAS_ENVIAR_ASANA`, só células preenchidas e diferentes do Asana. |
| ▶️ / ⏸️ Ativar / Desativar Importação Automática | Roda a importação a cada `INTERVALO_MINUTOS`. |

## Configuração (topo do `Codigo.gs`)

- `DATA_INICIO`: data mínima de criação das tarefas importadas.
- `COLUNAS_ENVIAR_ASANA`: cabeçalhos que a planilha atualiza no Asana. Ex.: `['Data de Pagamento', 'Valor a Pagar']`.
- `INTERVALO_MINUTOS`: 1, 5, 10, 15 ou 30.

Tipos de campo aceitos no envio: texto, número, data, lista suspensa e múltipla escolha.
Campos de pessoa não são enviados.
