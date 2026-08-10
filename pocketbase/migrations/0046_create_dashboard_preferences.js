migrate(
  (app) => {
    var usersId = '_pb_users_auth_'

    var collection = new Collection({
      name: 'dashboard_preferences',
      type: 'base',
      listRule: "@request.auth.id != '' && userId = @request.auth.id",
      viewRule: "@request.auth.id != '' && userId = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && userId = @request.auth.id",
      deleteRule: "@request.auth.id != '' && userId = @request.auth.id",
      fields: [
        {
          name: 'userId',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          required: true,
        },
        { name: 'blocks', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_dashboard_preferences_userId ON dashboard_preferences (userId)'],
    })

    app.save(collection)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('dashboard_preferences'))
    } catch (_) {}
  },
)
