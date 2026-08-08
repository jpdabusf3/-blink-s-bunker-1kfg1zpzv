migrate(
  (app) => {
    var gestaoTecnicaId = app.findCollectionByNameOrId('gestao_tecnica').id
    var col = app.findCollectionByNameOrId('matriz_vendas')

    if (!col.fields.getByName('gestor_tecnico_id')) {
      col.fields.add(
        new RelationField({
          name: 'gestor_tecnico_id',
          collectionId: gestaoTecnicaId,
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('vendedor_id')) {
      col.fields.add(
        new RelationField({
          name: 'vendedor_id',
          collectionId: gestaoTecnicaId,
          maxSelect: 1,
        }),
      )
    }

    col.addIndex('idx_matriz_vendas_gestor_tecnico_id', false, 'gestor_tecnico_id', '')
    col.addIndex('idx_matriz_vendas_vendedor_id', false, 'vendedor_id', '')

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('matriz_vendas')
    if (col.fields.getByName('gestor_tecnico_id')) {
      col.fields.removeByName('gestor_tecnico_id')
    }
    if (col.fields.getByName('vendedor_id')) {
      col.fields.removeByName('vendedor_id')
    }
    col.removeIndex('idx_matriz_vendas_gestor_tecnico_id')
    col.removeIndex('idx_matriz_vendas_vendedor_id')
    app.save(col)
  },
)
