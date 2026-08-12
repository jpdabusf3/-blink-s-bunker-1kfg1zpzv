migrate(
  (app) => {
    // --- metas: acrescimo_percentual, decrecimo_percentual, canal_vendas ---
    var metasCol = app.findCollectionByNameOrId('metas')

    if (!metasCol.fields.getByName('acrescimo_percentual')) {
      metasCol.fields.add(new NumberField({ name: 'acrescimo_percentual' }))
    }
    if (!metasCol.fields.getByName('decrecimo_percentual')) {
      metasCol.fields.add(new NumberField({ name: 'decrecimo_percentual' }))
    }
    if (!metasCol.fields.getByName('canal_vendas')) {
      metasCol.fields.add(
        new SelectField({
          name: 'canal_vendas',
          values: ['Direto', 'Distribuidor', 'Indústria', 'Premixera', 'Cooperativa', 'Online'],
          maxSelect: 1,
        }),
      )
    }
    metasCol.addIndex('idx_metas_canal_vendas', false, 'canal_vendas', '')
    app.save(metasCol)

    // --- gestao_tecnica: new funcao options + subclassificacao + canal_vendas ---
    // The `funcao` select field already exists — replace its values by removing
    // and re-adding the field with the expanded value set.
    var gtCol = app.findCollectionByNameOrId('gestao_tecnica')

    var existingFuncao = gtCol.fields.getByName('funcao')
    if (existingFuncao) {
      gtCol.fields.removeByName('funcao')
    }
    gtCol.fields.add(
      new SelectField({
        name: 'funcao',
        required: true,
        values: [
          'gestor_tecnico',
          'vendedor',
          'gestor_comercial',
          'gestor_especie',
          'diretor',
          'ceo',
        ],
        maxSelect: 1,
      }),
    )

    if (!gtCol.fields.getByName('subclassificacao')) {
      gtCol.fields.add(
        new SelectField({
          name: 'subclassificacao',
          values: ['indiretos', 'diretos'],
          maxSelect: 1,
        }),
      )
    }
    if (!gtCol.fields.getByName('canal_vendas')) {
      gtCol.fields.add(
        new SelectField({
          name: 'canal_vendas',
          values: ['indireto', 'direto'],
          maxSelect: 1,
        }),
      )
    }

    app.save(gtCol)
  },
  (app) => {
    var metasCol = app.findCollectionByNameOrId('metas')
    try {
      metasCol.removeIndex('idx_metas_canal_vendas')
    } catch (_) {}
    try {
      metasCol.fields.removeByName('acrescimo_percentual')
    } catch (_) {}
    try {
      metasCol.fields.removeByName('decrecimo_percentual')
    } catch (_) {}
    try {
      metasCol.fields.removeByName('canal_vendas')
    } catch (_) {}
    app.save(metasCol)

    var gtCol = app.findCollectionByNameOrId('gestao_tecnica')
    try {
      gtCol.fields.removeByName('subclassificacao')
    } catch (_) {}
    try {
      gtCol.fields.removeByName('canal_vendas')
    } catch (_) {}
    try {
      gtCol.fields.removeByName('funcao')
    } catch (_) {}
    gtCol.fields.add(
      new SelectField({
        name: 'funcao',
        required: true,
        values: ['gestor_tecnico', 'vendedor'],
        maxSelect: 1,
      }),
    )
    app.save(gtCol)
  },
)
