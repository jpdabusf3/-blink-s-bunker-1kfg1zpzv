// Adds support for:
//  - Persisted "Modelo Visual" report preference per user (dashboard_preferences.modelo_visual_relatorio)
//  - Batch report export tracking on `atividades`:
//      * new tipo_atividade value "exportacao_relatorio"
//      * new json field `detalhes_exportacao` (data, usuario solicitante, qtd clientes, modelo)
migrate(
  (app) => {
    // 1) dashboard_preferences.modelo_visual_relatorio (per-user preference)
    var dp = app.findCollectionByNameOrId('dashboard_preferences')
    if (!dp.fields.getByName('modelo_visual_relatorio')) {
      dp.fields.add(new TextField({ name: 'modelo_visual_relatorio' }))
    }
    app.save(dp)

    // 2) atividades: add "exportacao_relatorio" to tipo_atividade select + json detalhes_exportacao
    var at = app.findCollectionByNameOrId('atividades')
    var tipoField = at.fields.getByName('tipo_atividade')
    if (tipoField) {
      var vals = (tipoField.values && tipoField.values.slice()) || []
      if (vals.indexOf('exportacao_relatorio') === -1) {
        vals.push('exportacao_relatorio')
      }
      tipoField.values = vals
    }
    if (!at.fields.getByName('detalhes_exportacao')) {
      at.fields.add(new JSONField({ name: 'detalhes_exportacao' }))
    }
    app.save(at)
  },
  (app) => {
    try {
      var dp = app.findCollectionByNameOrId('dashboard_preferences')
      if (dp.fields.getByName('modelo_visual_relatorio')) {
        dp.fields.removeByName('modelo_visual_relatorio')
        app.save(dp)
      }
    } catch (_) {}

    try {
      var at = app.findCollectionByNameOrId('atividades')
      var tipoField = at.fields.getByName('tipo_atividade')
      if (tipoField && tipoField.values) {
        tipoField.values = tipoField.values.filter(function (v) {
          return v !== 'exportacao_relatorio'
        })
      }
      if (at.fields.getByName('detalhes_exportacao')) {
        at.fields.removeByName('detalhes_exportacao')
      }
      app.save(at)
    } catch (_) {}
  },
)
