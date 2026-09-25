/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('agenda_tasks')
      col.listRule = "@request.auth.id != ''"
      col.viewRule = "@request.auth.id != ''"
      col.createRule = "@request.auth.id != ''"
      col.updateRule = "@request.auth.id != '' && user_id = @request.auth.id"
      col.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
      app.save(col)
      console.log(
        "[Migration 0120] agenda_tasks listRule e viewRule atualizadas para @request.auth.id != ''",
      )
    } catch (err) {
      console.log('[Migration 0120] Erro ao atualizar regras de agenda_tasks:', err)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('agenda_tasks')
      col.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
      col.viewRule = "@request.auth.id != '' && user_id = @request.auth.id"
      col.createRule = "@request.auth.id != ''"
      col.updateRule = "@request.auth.id != '' && user_id = @request.auth.id"
      col.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
      app.save(col)
    } catch (_) {}
  },
)
