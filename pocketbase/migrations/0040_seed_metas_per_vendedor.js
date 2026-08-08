migrate(
  (app) => {
    var metasCol = app.findCollectionByNameOrId('metas')
    var PERIODO = 'Agosto 2026'
    var META_VALOR = 181519.41
    var ATUALIZADO_EM = '2026-08-07 00:00:00.000Z'

    var vendedores = app.findRecordsByFilter(
      'gestao_tecnica',
      "funcao = 'vendedor'",
      'nome',
      100,
      0,
    )

    for (var i = 0; i < vendedores.length; i++) {
      var v = vendedores[i]
      var existing = []
      try {
        existing = app.findRecordsByFilter(
          'metas',
          'vendedor_id = "' + v.id + '" && periodo = "' + PERIODO + '"',
          '-created',
          1,
          0,
        )
      } catch (_) {}

      var rec
      if (existing.length > 0) {
        rec = existing[0]
      } else {
        rec = new Record(metasCol)
      }
      rec.set('vendedor_id', v.id)
      rec.set('periodo', PERIODO)
      rec.set('meta_valor', META_VALOR)
      rec.set('valor_realizado', 0)
      rec.set('atualizado_em', ATUALIZADO_EM)
      app.save(rec)
    }
  },
  (app) => {
    try {
      var records = app.findRecordsByFilter('metas', 'periodo = "Agosto 2026"', '-created', 100, 0)
      for (var i = 0; i < records.length; i++) {
        app.delete(records[i])
      }
    } catch (_) {}
  },
)
