/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const factoriesCol = app.findCollectionByNameOrId('factories')

    // 1. orders: atualizar/garantir campos requeridos, regras e índice
    let ordersCol
    try {
      ordersCol = app.findCollectionByNameOrId('orders')
    } catch (_) {
      ordersCol = null
    }

    if (!ordersCol) {
      ordersCol = new Collection({
        name: 'orders',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'client_name',
            type: 'text',
            required: false,
          },
          {
            name: 'product',
            type: 'text',
            required: false,
          },
          {
            name: 'quantity',
            type: 'number',
            required: false,
          },
          {
            name: 'unit_value',
            type: 'number',
            required: false,
          },
          {
            name: 'total_value',
            type: 'number',
            required: false,
          },
          {
            name: 'status',
            type: 'text',
            required: false,
          },
          {
            name: 'order_date',
            type: 'date',
            required: false,
          },
          {
            name: 'notes',
            type: 'text',
            required: false,
          },
          {
            name: 'factoryId',
            type: 'relation',
            required: false,
            collectionId: factoriesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'line',
            type: 'text',
            required: false,
          },
          {
            name: 'unitValue',
            type: 'number',
            required: false,
          },
          {
            name: 'totalValue',
            type: 'number',
            required: false,
          },
          {
            name: 'orderDate',
            type: 'date',
            required: false,
          },
          {
            name: 'region',
            type: 'text',
            required: false,
          },
          {
            name: 'country',
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
        indexes: ['CREATE INDEX idx_orders_order_date ON orders (order_date)'],
      })
      app.save(ordersCol)
    } else {
      // Ajustar regras de acesso
      ordersCol.listRule = "@request.auth.id != ''"
      ordersCol.viewRule = "@request.auth.id != ''"
      ordersCol.createRule = "@request.auth.id != ''"
      ordersCol.updateRule = "@request.auth.id != ''"
      ordersCol.deleteRule = "@request.auth.id != ''"

      // Adicionar campos se ausentes
      if (!ordersCol.fields.getByName('user_id')) {
        ordersCol.fields.add(
          new RelationField({
            name: 'user_id',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
      }
      if (!ordersCol.fields.getByName('client_name')) {
        ordersCol.fields.add(new TextField({ name: 'client_name', required: false }))
      }
      if (!ordersCol.fields.getByName('status')) {
        ordersCol.fields.add(new TextField({ name: 'status', required: false }))
      }
      if (!ordersCol.fields.getByName('unit_value')) {
        ordersCol.fields.add(new NumberField({ name: 'unit_value', required: false }))
      }
      if (!ordersCol.fields.getByName('total_value')) {
        ordersCol.fields.add(new NumberField({ name: 'total_value', required: false }))
      }
      if (!ordersCol.fields.getByName('order_date')) {
        ordersCol.fields.add(new DateField({ name: 'order_date', required: false }))
      }
      if (!ordersCol.fields.getByName('notes')) {
        ordersCol.fields.add(new TextField({ name: 'notes', required: false }))
      }

      // Adicionar índice em order_date
      ordersCol.addIndex('idx_orders_order_date', false, 'order_date', '')
      app.save(ordersCol)

      // Backfill user_id para registros existentes caso haja ordens sem user_id
      try {
        const firstUser = app.findRecordsByFilter('_pb_users_auth_', '', 'created', 1, 0)
        if (firstUser && firstUser.length > 0) {
          app
            .db()
            .newQuery("UPDATE orders SET user_id = {:uid} WHERE user_id IS NULL OR user_id = ''")
            .bind({ uid: firstUser[0].id })
            .execute()
        }
      } catch (err) {
        console.log('[Migration 0124] Aviso no backfill de user_id em orders:', err)
      }
    }

    // 2. tasks: fields user_id relation to users required, title text required, description text,
    // due_date date, status text, priority text, related_factory_id relation to factories optional.
    // Rules: list, view, create, update, delete for auth users.
    // Indexes on due_date and status.
    let tasksCol
    try {
      tasksCol = app.findCollectionByNameOrId('tasks')
    } catch (_) {
      tasksCol = null
    }

    if (!tasksCol) {
      tasksCol = new Collection({
        name: 'tasks',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'description',
            type: 'text',
            required: false,
          },
          {
            name: 'due_date',
            type: 'date',
            required: false,
          },
          {
            name: 'status',
            type: 'text',
            required: false,
          },
          {
            name: 'priority',
            type: 'text',
            required: false,
          },
          {
            name: 'related_factory_id',
            type: 'relation',
            required: false,
            collectionId: factoriesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
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
          'CREATE INDEX idx_tasks_due_date ON tasks (due_date)',
          'CREATE INDEX idx_tasks_status ON tasks (status)',
        ],
      })
      app.save(tasksCol)
    }

    // 3. visits: fields user_id relation to users required, factory_id relation to factories required,
    // visit_date date, notes text, potential_value number, outcome text. Same rules. Index on visit_date.
    let visitsCol
    try {
      visitsCol = app.findCollectionByNameOrId('visits')
    } catch (_) {
      visitsCol = null
    }

    if (!visitsCol) {
      visitsCol = new Collection({
        name: 'visits',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'factory_id',
            type: 'relation',
            required: true,
            collectionId: factoriesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'visit_date',
            type: 'date',
            required: false,
          },
          {
            name: 'notes',
            type: 'text',
            required: false,
          },
          {
            name: 'potential_value',
            type: 'number',
            required: false,
          },
          {
            name: 'outcome',
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
        indexes: ['CREATE INDEX idx_visits_visit_date ON visits (visit_date)'],
      })
      app.save(visitsCol)
    }
  },
  (app) => {
    try {
      const visitsCol = app.findCollectionByNameOrId('visits')
      app.delete(visitsCol)
    } catch (_) {}
    try {
      const tasksCol = app.findCollectionByNameOrId('tasks')
      app.delete(tasksCol)
    } catch (_) {}
  },
)
