migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    try {
      const sectorField = col.fields.getByName('sector')
      if (sectorField) {
        col.fields.removeByName('sector')
      }
    } catch (_) {}

    try {
      if (col.fields.getByName('region')) {
        col.fields.removeByName('region')
      }
      col.fields.add(
        new SelectField({
          name: 'region',
          values: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'],
          maxSelect: 5,
        }),
      )
    } catch (_) {}

    try {
      if (col.fields.getByName('animalSpecies')) {
        col.fields.removeByName('animalSpecies')
      }
      col.fields.add(
        new SelectField({
          name: 'animalSpecies',
          values: [
            'Ruminantes',
            'Aves',
            'Suinos',
            'Pet',
            'Aqua',
            'Equinos',
            'Outros',
            'Multi espécie',
          ],
          maxSelect: 8,
        }),
      )
    } catch (_) {}

    try {
      if (col.fields.getByName('profile_type')) {
        col.fields.removeByName('profile_type')
      }
      col.fields.add(
        new SelectField({
          name: 'profile_type',
          values: [
            'Indústria',
            'Industria',
            'Produtor',
            'Representantes',
            'Distribuidores',
            'Revendas',
            'Cooperativas',
            'Indústrias',
            'Integradora',
            'Premixeira',
            'Produtores',
            'Outros',
            'Distribuidor',
          ],
          maxSelect: 13,
        }),
      )
    } catch (_) {}

    try {
      if (col.fields.getByName('productLineAffinity')) {
        col.fields.removeByName('productLineAffinity')
      }
      col.fields.add(
        new SelectField({
          name: 'productLineAffinity',
          values: ['Adsorventes', 'Prebióticos', 'Minerais Orgânicos', 'Blends', 'Ingredientes'],
          maxSelect: 5,
        }),
      )
    } catch (_) {}

    try {
      if (col.fields.getByName('status')) {
        col.fields.removeByName('status')
      }
      col.fields.add(
        new SelectField({
          name: 'status',
          values: ['Atendido', 'Não atendido', 'Prospeção'],
          maxSelect: 3,
        }),
      )
    } catch (_) {}

    try {
      if (col.fields.getByName('priority')) {
        col.fields.removeByName('priority')
      }
      col.fields.add(
        new SelectField({
          name: 'priority',
          values: ['High', 'Medium', 'Low'],
          maxSelect: 3,
        }),
      )
    } catch (_) {}

    app.save(col)
  },
  (app) => {
    // down migration
  },
)
