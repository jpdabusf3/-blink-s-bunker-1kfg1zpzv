migrate(
  (app) => {
    var factoriesCol = app.findCollectionByNameOrId('factories')
    if (!factoriesCol.fields.getByName('carteira')) {
      factoriesCol.fields.add(
        new SelectField({
          name: 'carteira',
          values: ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA'],
          maxSelect: 1,
        }),
      )
    }
    if (!factoriesCol.fields.getByName('grupo_cliente')) {
      factoriesCol.fields.add(new TextField({ name: 'grupo_cliente' }))
    }
    app.save(factoriesCol)

    var atividadesCol = app.findCollectionByNameOrId('atividades')
    atividadesCol.fields.removeByName('tipo_atividade')
    atividadesCol.fields.add(
      new SelectField({
        name: 'tipo_atividade',
        values: ['visita', 'ligacao', 'proposta', 'follow_up', 'reuniao', 'pedido', 'outro'],
        maxSelect: 1,
      }),
    )
    if (!atividadesCol.fields.getByName('carteira')) {
      atividadesCol.fields.add(
        new SelectField({
          name: 'carteira',
          values: ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA'],
          maxSelect: 1,
        }),
      )
    }
    if (!atividadesCol.fields.getByName('grupo_cliente')) {
      atividadesCol.fields.add(new TextField({ name: 'grupo_cliente' }))
    }
    app.save(atividadesCol)
  },
  (app) => {
    var factoriesCol = app.findCollectionByNameOrId('factories')
    if (factoriesCol.fields.getByName('carteira')) {
      factoriesCol.fields.removeByName('carteira')
    }
    if (factoriesCol.fields.getByName('grupo_cliente')) {
      factoriesCol.fields.removeByName('grupo_cliente')
    }
    app.save(factoriesCol)

    var atividadesCol = app.findCollectionByNameOrId('atividades')
    atividadesCol.fields.removeByName('tipo_atividade')
    atividadesCol.fields.add(
      new SelectField({
        name: 'tipo_atividade',
        values: ['visita', 'ligacao', 'proposta', 'follow_up', 'reuniao'],
        maxSelect: 1,
      }),
    )
    if (atividadesCol.fields.getByName('carteira')) {
      atividadesCol.fields.removeByName('carteira')
    }
    if (atividadesCol.fields.getByName('grupo_cliente')) {
      atividadesCol.fields.removeByName('grupo_cliente')
    }
    app.save(atividadesCol)
  },
)
