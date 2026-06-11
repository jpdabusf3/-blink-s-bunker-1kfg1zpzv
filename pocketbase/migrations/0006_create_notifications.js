migrate(
  (app) => {
    const collection = new Collection({
      name: 'notifications',
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
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'message', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['success', 'warning', 'info', 'error'],
          maxSelect: 1,
        },
        { name: 'isRead', type: 'bool', required: false },
        {
          name: 'targetId',
          type: 'relation',
          required: false,
          collectionId: 'targets',
          maxSelect: 1,
        },
        { name: 'milestone', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_notifications_userId ON notifications (userId)',
        "CREATE UNIQUE INDEX idx_notifications_target_user_milestone ON notifications (userId, targetId, milestone) WHERE targetId != '' AND milestone != ''",
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('notifications')
    app.delete(collection)
  },
)
