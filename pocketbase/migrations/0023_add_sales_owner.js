migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('factories')
    if (!col.fields.getByName('salesOwner')) {
      col.fields.add(
        new RelationField({
          name: 'salesOwner',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }
    col.addIndex('idx_factories_salesOwner', false, 'salesOwner', '')
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('factories')
    if (col.fields.getByName('salesOwner')) {
      col.fields.removeByName('salesOwner')
    }
    col.removeIndex('idx_factories_salesOwner')
    app.save(col)
  },
)
