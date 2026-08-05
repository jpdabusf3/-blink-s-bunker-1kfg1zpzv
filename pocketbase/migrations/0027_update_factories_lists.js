migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('factories')

    const speciesField = col.fields.getByName('animalSpecies')
    if (speciesField) {
      speciesField.values = [
        'Ruminantes',
        'Aves',
        'Suinos',
        'Pet',
        'Aqua',
        'Equinos',
        'Outros',
        'Multi espécie',
      ]
    }

    if (!col.fields.getByName('profile_type')) {
      col.fields.add(new TextField({ name: 'profile_type' }))
    }

    if (!col.fields.getByName('salesOwner')) {
      col.fields.add(
        new RelationField({
          name: 'salesOwner',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('technicalManager')) {
      col.fields.add(
        new RelationField({
          name: 'technicalManager',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    // Revert migration if needed
  },
)
