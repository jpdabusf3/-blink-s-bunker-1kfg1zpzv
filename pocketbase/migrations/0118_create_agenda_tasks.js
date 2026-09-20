/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('agenda_tasks')
      return // Já existe
    } catch (_) {}

    const usersId = '_pb_users_auth_'
    const factoriesId = app.findCollectionByNameOrId('factories').id

    const collection = new Collection({
      name: 'agenda_tasks',
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
          collectionId: usersId,
          required: true,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'task_type',
          type: 'select',
          values: ['reuniao', 'visita', 'evento', 'ligacao', 'outro'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'client_name',
          type: 'text',
          required: false,
        },
        {
          name: 'deal_id',
          type: 'relation',
          collectionId: factoriesId,
          required: false,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'task_date',
          type: 'date',
          required: true,
        },
        {
          name: 'start_time',
          type: 'text',
          required: false,
        },
        {
          name: 'end_time',
          type: 'text',
          required: false,
        },
        {
          name: 'status',
          type: 'select',
          values: ['agendada', 'concluida', 'cancelada'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'notes',
          type: 'text',
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
        'CREATE INDEX idx_agenda_tasks_user_id ON agenda_tasks (user_id)',
        'CREATE INDEX idx_agenda_tasks_task_date ON agenda_tasks (task_date)',
        'CREATE INDEX idx_agenda_tasks_deal_id ON agenda_tasks (deal_id)',
        'CREATE INDEX idx_agenda_tasks_status ON agenda_tasks (status)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('agenda_tasks')
      app.delete(col)
    } catch (_) {}
  },
)
