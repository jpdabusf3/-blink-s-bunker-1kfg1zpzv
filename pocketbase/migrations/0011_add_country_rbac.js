migrate(
  (app) => {
    var lead =
      "@request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'"

    var factories = app.findCollectionByNameOrId('factories')
    if (!factories.fields.getByName('country')) {
      factories.fields.add(new TextField({ name: 'country' }))
    }
    var fList =
      "@request.auth.id != '' && (" +
      lead +
      " || (country = @request.auth.country && (@request.auth.geographicArea = '' || stateRegion = @request.auth.geographicArea || region = @request.auth.geographicArea)))"
    var fCreate =
      "@request.auth.id != '' && (" +
      lead +
      " || (@request.body.country = @request.auth.country && (@request.auth.geographicArea = '' || @request.body.stateRegion = @request.auth.geographicArea || @request.body.region = @request.auth.geographicArea)))"
    factories.listRule = fList
    factories.viewRule = fList
    factories.createRule = fCreate
    factories.updateRule = fCreate
    factories.deleteRule = fList
    app.save(factories)

    var orders = app.findCollectionByNameOrId('orders')
    if (!orders.fields.getByName('country')) {
      orders.fields.add(new TextField({ name: 'country' }))
    }
    var oList =
      "@request.auth.id != '' && (" +
      lead +
      " || (country = @request.auth.country && (@request.auth.geographicArea = '' || region = @request.auth.geographicArea)))"
    var oCreate =
      "@request.auth.id != '' && (" +
      lead +
      " || (@request.body.country = @request.auth.country && (@request.auth.geographicArea = '' || @request.body.region = @request.auth.geographicArea)))"
    orders.listRule = oList
    orders.viewRule = oList
    orders.createRule = oCreate
    orders.updateRule = oCreate
    orders.deleteRule = oList
    app.save(orders)

    app
      .db()
      .newQuery("UPDATE factories SET country = 'Brasil' WHERE country IS NULL OR country = ''")
      .execute()
    app
      .db()
      .newQuery("UPDATE orders SET country = 'Brasil' WHERE country IS NULL OR country = ''")
      .execute()
    app
      .db()
      .newQuery("UPDATE users SET country = 'Brasil' WHERE country IS NULL OR country = ''")
      .execute()
  },
  (app) => {
    var lead =
      "@request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'"

    var factories = app.findCollectionByNameOrId('factories')
    factories.fields.removeByName('country')
    var fList =
      "@request.auth.id != '' && (" +
      lead +
      ' || stateRegion = @request.auth.geographicArea || region = @request.auth.geographicArea)'
    var fCreate =
      "@request.auth.id != '' && (" +
      lead +
      ' || @request.body.stateRegion = @request.auth.geographicArea || @request.body.region = @request.auth.geographicArea)'
    factories.listRule = fList
    factories.viewRule = fList
    factories.createRule = fCreate
    factories.updateRule = fCreate
    factories.deleteRule = fList
    app.save(factories)

    var orders = app.findCollectionByNameOrId('orders')
    orders.fields.removeByName('country')
    var oList = "@request.auth.id != '' && (" + lead + ' || region = @request.auth.geographicArea)'
    var oCreate =
      "@request.auth.id != '' && (" +
      lead +
      ' || @request.body.region = @request.auth.geographicArea)'
    orders.listRule = oList
    orders.viewRule = oList
    orders.createRule = oCreate
    orders.updateRule = oCreate
    orders.deleteRule = oList
    app.save(orders)
  },
)
