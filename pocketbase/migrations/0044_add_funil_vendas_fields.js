migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('factories')

    if (!col.fields.getByName('valor_medio')) {
      col.fields.add(new NumberField({ name: 'valor_medio' }))
    }
    if (!col.fields.getByName('valor_atual')) {
      col.fields.add(new NumberField({ name: 'valor_atual' }))
    }
    if (!col.fields.getByName('status_funil')) {
      col.fields.add(
        new SelectField({
          name: 'status_funil',
          values: ['Inativo', 'Mensal', 'Ativo'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('ultimo_pedido')) {
      col.fields.add(new DateField({ name: 'ultimo_pedido' }))
    }
    if (!col.fields.getByName('proximos_passos')) {
      col.fields.add(new TextField({ name: 'proximos_passos' }))
    }
    if (!col.fields.getByName('acao')) {
      col.fields.add(new TextField({ name: 'acao' }))
    }
    if (!col.fields.getByName('data_importacao')) {
      col.fields.add(new DateField({ name: 'data_importacao' }))
    }

    col.addIndex('idx_factories_status_funil', false, 'status_funil', '')
    col.addIndex('idx_factories_animalSpecies', false, 'animalSpecies', '')

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('factories')
    try {
      col.removeIndex('idx_factories_status_funil')
    } catch (_) {}
    try {
      col.removeIndex('idx_factories_animalSpecies')
    } catch (_) {}
    try {
      col.fields.removeByName('valor_medio')
    } catch (_) {}
    try {
      col.fields.removeByName('valor_atual')
    } catch (_) {}
    try {
      col.fields.removeByName('status_funil')
    } catch (_) {}
    try {
      col.fields.removeByName('ultimo_pedido')
    } catch (_) {}
    try {
      col.fields.removeByName('proximos_passos')
    } catch (_) {}
    try {
      col.fields.removeByName('acao')
    } catch (_) {}
    try {
      col.fields.removeByName('data_importacao')
    } catch (_) {}
    app.save(col)
  },
)
