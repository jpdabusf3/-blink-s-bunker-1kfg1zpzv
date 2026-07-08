migrate(
  (app) => {
    var leadershipClause =
      "@request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'"

    var factories = app.findCollectionByNameOrId('factories')
    var factoryListRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      ' || stateRegion = @request.auth.geographicArea || region = @request.auth.geographicArea)'
    factories.listRule = factoryListRule
    factories.viewRule = factoryListRule
    var factoryCreateRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      ' || @request.body.stateRegion = @request.auth.geographicArea || @request.body.region = @request.auth.geographicArea)'
    factories.createRule = factoryCreateRule
    factories.updateRule = factoryCreateRule
    factories.deleteRule = factoryListRule
    app.save(factories)

    var orders = app.findCollectionByNameOrId('orders')
    var orderListRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      ' || region = @request.auth.geographicArea)'
    orders.listRule = orderListRule
    orders.viewRule = orderListRule
    var orderCreateRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      ' || @request.body.region = @request.auth.geographicArea)'
    orders.createRule = orderCreateRule
    orders.updateRule = orderCreateRule
    orders.deleteRule = orderListRule
    app.save(orders)

    var targets = app.findCollectionByNameOrId('targets')
    var targetListRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      " || categoryType = 'General' || (categoryType = 'Region' && categoryValue = @request.auth.geographicArea))"
    targets.listRule = targetListRule
    targets.viewRule = targetListRule
    var targetCreateRule =
      "@request.auth.id != '' && (" +
      leadershipClause +
      " || @request.body.categoryType = 'General' || (@request.body.categoryType = 'Region' && @request.body.categoryValue = @request.auth.geographicArea))"
    targets.createRule = targetCreateRule
    targets.updateRule = targetCreateRule
    targets.deleteRule = targetListRule
    app.save(targets)

    var activityLogs = app.findCollectionByNameOrId('activity_logs')
    var logListRule = leadershipClause + ' || user = @request.auth.id'
    activityLogs.listRule = logListRule
    activityLogs.viewRule = logListRule
    activityLogs.createRule = "@request.auth.id != ''"
    activityLogs.updateRule = leadershipClause
    activityLogs.deleteRule = leadershipClause
    app.save(activityLogs)
  },
  (app) => {
    var oldLeadershipClause =
      "@request.auth.job_title = 'Manager' || @request.auth.job_title = 'Gestor'"

    var factories = app.findCollectionByNameOrId('factories')
    var factoryRule =
      "@request.auth.id != '' && (" +
      oldLeadershipClause +
      ' || stateRegion = @request.auth.geographicArea)'
    factories.listRule = factoryRule
    factories.viewRule = factoryRule
    factories.createRule = factoryRule
    factories.updateRule = factoryRule
    factories.deleteRule = factoryRule
    app.save(factories)

    var orders = app.findCollectionByNameOrId('orders')
    var orderRule =
      "@request.auth.id != '' && (" +
      oldLeadershipClause +
      ' || region = @request.auth.geographicArea)'
    orders.listRule = orderRule
    orders.viewRule = orderRule
    orders.createRule = orderRule
    orders.updateRule = orderRule
    orders.deleteRule = orderRule
    app.save(orders)

    var targets = app.findCollectionByNameOrId('targets')
    var targetRule =
      "@request.auth.id != '' && (" +
      oldLeadershipClause +
      " || categoryType != 'Region' || (categoryType = 'Region' && categoryValue = @request.auth.geographicArea))"
    targets.listRule = targetRule
    targets.viewRule = targetRule
    targets.createRule = targetRule
    targets.updateRule = targetRule
    targets.deleteRule = targetRule
    app.save(targets)

    var activityLogs = app.findCollectionByNameOrId('activity_logs')
    activityLogs.listRule = oldLeadershipClause + ' || user = @request.auth.id'
    activityLogs.viewRule = activityLogs.listRule
    activityLogs.createRule = "@request.auth.id != ''"
    activityLogs.updateRule = oldLeadershipClause
    activityLogs.deleteRule = oldLeadershipClause
    app.save(activityLogs)
  },
)
