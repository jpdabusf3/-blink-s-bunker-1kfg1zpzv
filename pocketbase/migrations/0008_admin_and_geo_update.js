migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('geographicArea')) {
      users.fields.add(new TextField({ name: 'geographicArea' }))
    }
    if (!users.fields.getByName('country')) {
      users.fields.add(new TextField({ name: 'country' }))
    }
    app.save(users)

    const orders = app.findCollectionByNameOrId('orders')
    if (!orders.fields.getByName('region')) {
      orders.fields.add(new TextField({ name: 'region' }))
    }
    app.save(orders)

    const activityLogs = new Collection({
      name: 'activity_logs',
      type: 'base',
      listRule:
        "@request.auth.job_title = 'Manager' || @request.auth.job_title = 'Gestor' || user = @request.auth.id",
      viewRule:
        "@request.auth.job_title = 'Manager' || @request.auth.job_title = 'Gestor' || user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.job_title = 'Manager' || @request.auth.job_title = 'Gestor'",
      deleteRule: "@request.auth.job_title = 'Manager' || @request.auth.job_title = 'Gestor'",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'action', type: 'text', required: true },
        { name: 'details', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_activity_logs_user ON activity_logs (user)',
        'CREATE INDEX idx_activity_logs_created ON activity_logs (created DESC)',
      ],
    })
    app.save(activityLogs)

    const factories = app.findCollectionByNameOrId('factories')
    const factoryRule =
      "@request.auth.id != '' && (@request.auth.job_title = 'Manager' || @request.auth.job_title = 'Gestor' || stateRegion = @request.auth.geographicArea)"
    factories.listRule = factoryRule
    factories.viewRule = factoryRule
    factories.createRule = factoryRule
    factories.updateRule = factoryRule
    factories.deleteRule = factoryRule
    app.save(factories)

    const orderRule =
      "@request.auth.id != '' && (@request.auth.job_title = 'Manager' || @request.auth.job_title = 'Gestor' || region = @request.auth.geographicArea)"
    orders.listRule = orderRule
    orders.viewRule = orderRule
    orders.createRule = orderRule
    orders.updateRule = orderRule
    orders.deleteRule = orderRule
    app.save(orders)

    const targets = app.findCollectionByNameOrId('targets')
    const targetRule =
      "@request.auth.id != '' && (@request.auth.job_title = 'Manager' || @request.auth.job_title = 'Gestor' || categoryType != 'Region' || (categoryType = 'Region' && categoryValue = @request.auth.geographicArea))"
    targets.listRule = targetRule
    targets.viewRule = targetRule
    targets.createRule = targetRule
    targets.updateRule = targetRule
    targets.deleteRule = targetRule
    app.save(targets)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.fields.removeByName('geographicArea')
    users.fields.removeByName('country')
    app.save(users)

    const orders = app.findCollectionByNameOrId('orders')
    orders.fields.removeByName('region')
    orders.listRule = ''
    orders.viewRule = ''
    orders.createRule = ''
    orders.updateRule = ''
    orders.deleteRule = ''
    app.save(orders)

    const factories = app.findCollectionByNameOrId('factories')
    factories.listRule = ''
    factories.viewRule = ''
    factories.createRule = ''
    factories.updateRule = ''
    factories.deleteRule = ''
    app.save(factories)

    const targets = app.findCollectionByNameOrId('targets')
    targets.listRule = "@request.auth.id != ''"
    targets.viewRule = "@request.auth.id != ''"
    targets.createRule = "@request.auth.id != ''"
    targets.updateRule = "@request.auth.id != ''"
    targets.deleteRule = "@request.auth.id != ''"
    app.save(targets)

    try {
      app.delete(app.findCollectionByNameOrId('activity_logs'))
    } catch (_) {}
  },
)
