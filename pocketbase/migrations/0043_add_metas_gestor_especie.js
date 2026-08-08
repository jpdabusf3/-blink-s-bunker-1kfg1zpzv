migrate(
  (app) => {
    var metasCol = app.findCollectionByNameOrId('metas')
    var gestaoTecnicaId = app.findCollectionByNameOrId('gestao_tecnica').id

    if (!metasCol.fields.getByName('gestor_tecnico_id')) {
      metasCol.fields.add(
        new RelationField({
          name: 'gestor_tecnico_id',
          collectionId: gestaoTecnicaId,
          maxSelect: 1,
        }),
      )
    }

    if (!metasCol.fields.getByName('especie')) {
      metasCol.fields.add(
        new SelectField({
          name: 'especie',
          values: ['BOVINO', 'SUINO', 'AVE', 'PET', 'AQUA'],
          maxSelect: 1,
        }),
      )
    }

    metasCol.addIndex('idx_metas_gestor_tecnico_id', false, 'gestor_tecnico_id', '')
    metasCol.addIndex('idx_metas_especie', false, 'especie', '')
    metasCol.addIndex('idx_metas_periodo', false, 'periodo', '')

    app.save(metasCol)
  },
  (app) => {
    var metasCol = app.findCollectionByNameOrId('metas')
    try {
      metasCol.removeIndex('idx_metas_gestor_tecnico_id')
    } catch (_) {}
    try {
      metasCol.removeIndex('idx_metas_especie')
    } catch (_) {}
    try {
      metasCol.removeIndex('idx_metas_periodo')
    } catch (_) {}
    try {
      metasCol.fields.removeByName('gestor_tecnico_id')
    } catch (_) {}
    try {
      metasCol.fields.removeByName('especie')
    } catch (_) {}
    app.save(metasCol)
  },
)
