migrate(
  (app) => {
    var superAdminClause = "@request.auth.email = 'joaopedro_zoo@hotmail.com'"
    var leadershipClause =
      "@request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'"

    var users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.updateRule = 'id = @request.auth.id || ' + superAdminClause
    users.deleteRule = superAdminClause
    app.save(users)

    var notifications = app.findCollectionByNameOrId('notifications')
    notifications.listRule = "@request.auth.id != ''"
    notifications.viewRule = "@request.auth.id != ''"
    notifications.createRule = "@request.auth.id != ''"
    notifications.updateRule =
      "@request.auth.id != '' && (userId = @request.auth.id || " +
      leadershipClause +
      ' || ' +
      superAdminClause +
      ')'
    notifications.deleteRule = superAdminClause + " || @request.auth.job_title = 'CEO'"
    app.save(notifications)
  },
  (app) => {
    var users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)

    var notifications = app.findCollectionByNameOrId('notifications')
    notifications.updateRule = null
    notifications.deleteRule = null
    app.save(notifications)
  },
)
