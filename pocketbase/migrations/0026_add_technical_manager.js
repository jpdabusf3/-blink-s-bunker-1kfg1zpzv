migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('factories')
    if (!col.fields.getByName('technicalManager')) {
      col.fields.add(
        new RelationField({
          name: 'technicalManager',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }
    col.addIndex('idx_factories_technicalManager', false, 'technicalManager', '')
    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('factories')
    if (col.fields.getByName('technicalManager')) {
      col.fields.removeByName('technicalManager')
    }
    col.removeIndex('idx_factories_technicalManager')
    app.save(col)
  },
)
