migrate(
  (app) => {
    // Idempotência: a collection `notifications` já existe nesta base (criada fora do
    // controle de migrações). Recriá-la faz o lote inteiro falhar com
    // "Collection name must be unique". Se já existe, nada a fazer.
    let existsByName = false
    try {
      app.findCollectionByNameOrId('notifications')
      existsByName = true
    } catch (_) {
      existsByName = false
    }
    if (existsByName) {
      console.log('[0006] collection notifications já existe — nada a criar.')
      return
    }

    const targetsCollection = app.findCollectionByNameOrId('targets')

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
          collectionId: targetsCollection.id,
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
    // No-op de propósito: esta migração agora apenas garante a existência da collection
    // quando ela ainda não existe. Apagar `notifications` no rollback destruiria dados
    // reais da aplicação.
    console.log('[0006] rollback ignorado (collection gerenciada fora desta migração).')
  },
)
