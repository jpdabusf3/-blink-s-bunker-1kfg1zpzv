/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('maestro_conversations')
    } catch (_) {
      const usersId = '_pb_users_auth_'
      const conversationsCol = new Collection({
        name: 'maestro_conversations',
        type: 'base',
        listRule: "@request.auth.id != '' && user_id = @request.auth.id",
        viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'titulo', type: 'text' },
          { name: 'conversation_id', type: 'text' },
          { name: 'messages', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_maestro_conversations_user ON maestro_conversations (user_id)',
          'CREATE INDEX idx_maestro_conversations_updated ON maestro_conversations (updated DESC)',
        ],
      })
      app.save(conversationsCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('maestro_conversations')
      app.delete(col)
    } catch (_) {}
  },
)
