migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    const collection = new Collection({
      name: 'funnel_activity_log',
      type: 'base',
      // Only the owner (creator) can read/write/delete their own activity entries.
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != "" && user = @request.auth.id',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'action_type',
          type: 'select',
          required: true,
          values: ['create', 'update', 'delete', 'move', 'assign', 'status_change'],
          maxSelect: 1,
        },
        {
          name: 'entity_type',
          type: 'select',
          required: true,
          values: ['deal', 'client', 'action_plan', 'goal', 'team_member'],
          maxSelect: 1,
        },
        { name: 'entity_id', type: 'text', required: true },
        { name: 'entity_name', type: 'text' },
        { name: 'old_value', type: 'text' },
        { name: 'new_value', type: 'text' },
        { name: 'description', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_funnel_activity_log_user ON funnel_activity_log (user)',
        'CREATE INDEX idx_funnel_activity_log_entity_type ON funnel_activity_log (entity_type)',
        'CREATE INDEX idx_funnel_activity_log_entity_id ON funnel_activity_log (entity_id)',
        'CREATE INDEX idx_funnel_activity_log_created ON funnel_activity_log (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('funnel_activity_log')
    app.delete(collection)
  },
)
