/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('deal_activities')
      return // Já existe
    } catch (_) {}

    const usersId = '_pb_users_auth_'
    const factoriesId = app.findCollectionByNameOrId('factories').id

    const collection = new Collection({
      name: 'deal_activities',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'deal_id',
          type: 'relation',
          collectionId: factoriesId,
          required: true,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: usersId,
          required: false,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'activity_text',
          type: 'text',
          required: true,
        },
        {
          name: 'created_at',
          type: 'date',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_deal_activities_deal_id ON deal_activities (deal_id)',
        'CREATE INDEX idx_deal_activities_user_id ON deal_activities (user_id)',
        'CREATE INDEX idx_deal_activities_created ON deal_activities (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('deal_activities')
      app.delete(col)
    } catch (_) {}
  },
)
