migrate(
  (app) => {
    var gestaoTecnica = new Collection({
      name: 'gestao_tecnica',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'funcao',
          type: 'select',
          values: ['gestor_tecnico', 'vendedor'],
          maxSelect: 1,
          required: true,
        },
        { name: 'regiao', type: 'text' },
        {
          name: 'carteira',
          type: 'select',
          values: ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA'],
          maxSelect: 1,
        },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_gestao_tecnica_funcao ON gestao_tecnica (funcao)'],
    })
    app.save(gestaoTecnica)

    var gestaoTecnicaId = app.findCollectionByNameOrId('gestao_tecnica').id

    var factoriesCol = app.findCollectionByNameOrId('factories')
    if (!factoriesCol.fields.getByName('gestor_tecnico_id')) {
      factoriesCol.fields.add(
        new RelationField({
          name: 'gestor_tecnico_id',
          collectionId: gestaoTecnicaId,
          maxSelect: 1,
        }),
      )
    }
    if (!factoriesCol.fields.getByName('vendedor_id')) {
      factoriesCol.fields.add(
        new RelationField({
          name: 'vendedor_id',
          collectionId: gestaoTecnicaId,
          maxSelect: 1,
        }),
      )
    }
    factoriesCol.addIndex('idx_factories_gestor_tecnico_id', false, 'gestor_tecnico_id', '')
    factoriesCol.addIndex('idx_factories_vendedor_id', false, 'vendedor_id', '')
    app.save(factoriesCol)

    var metasCol = app.findCollectionByNameOrId('metas')
    metasCol.removeIndex('idx_metas_vendedor_id')
    metasCol.removeIndex('idx_metas_vendedor_id_periodo')
    metasCol.fields.removeByName('vendedor_id')
    app.save(metasCol)

    app.db().newQuery('DELETE FROM metas').execute()

    metasCol = app.findCollectionByNameOrId('metas')
    metasCol.fields.add(
      new RelationField({
        name: 'vendedor_id',
        collectionId: gestaoTecnicaId,
        maxSelect: 1,
      }),
    )
    if (!metasCol.fields.getByName('atualizado_em')) {
      metasCol.fields.add(new DateField({ name: 'atualizado_em' }))
    }
    metasCol.addIndex('idx_metas_vendedor_id', false, 'vendedor_id', '')
    metasCol.addIndex('idx_metas_vendedor_id_periodo', false, 'vendedor_id, periodo', '')
    app.save(metasCol)
  },
  (app) => {
    var factoriesCol = app.findCollectionByNameOrId('factories')
    if (factoriesCol.fields.getByName('gestor_tecnico_id')) {
      factoriesCol.fields.removeByName('gestor_tecnico_id')
    }
    if (factoriesCol.fields.getByName('vendedor_id')) {
      factoriesCol.fields.removeByName('vendedor_id')
    }
    factoriesCol.removeIndex('idx_factories_gestor_tecnico_id')
    factoriesCol.removeIndex('idx_factories_vendedor_id')
    app.save(factoriesCol)

    var metasCol = app.findCollectionByNameOrId('metas')
    metasCol.removeIndex('idx_metas_vendedor_id')
    metasCol.removeIndex('idx_metas_vendedor_id_periodo')
    metasCol.fields.removeByName('vendedor_id')
    metasCol.fields.removeByName('atualizado_em')
    app.save(metasCol)

    metasCol = app.findCollectionByNameOrId('metas')
    metasCol.fields.add(
      new RelationField({
        name: 'vendedor_id',
        collectionId: '_pb_users_auth_',
        maxSelect: 1,
      }),
    )
    metasCol.addIndex('idx_metas_vendedor_id', false, 'vendedor_id', '')
    metasCol.addIndex('idx_metas_vendedor_id_periodo', false, 'vendedor_id, periodo', '')
    app.save(metasCol)

    try {
      app.delete(app.findCollectionByNameOrId('gestao_tecnica'))
    } catch (_) {}
  },
)
