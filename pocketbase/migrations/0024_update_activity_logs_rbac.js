migrate(
  (app) => {
    var superAdminClause = "@request.auth.email = 'joaopedro_zoo@hotmail.com'"
    var leadershipClause =
      "@request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'"

    var activityLogs = app.findCollectionByNameOrId('activity_logs')
    var logListRule = leadershipClause + ' || ' + superAdminClause + ' || user = @request.auth.id'
    activityLogs.listRule = logListRule
    activityLogs.viewRule = logListRule
    activityLogs.updateRule = leadershipClause + ' || ' + superAdminClause
    activityLogs.deleteRule = leadershipClause + ' || ' + superAdminClause
    app.save(activityLogs)
  },
  (app) => {
    var leadershipClause =
      "@request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'"
    var activityLogs = app.findCollectionByNameOrId('activity_logs')
    var logListRule = leadershipClause + ' || user = @request.auth.id'
    activityLogs.listRule = logListRule
    activityLogs.viewRule = logListRule
    activityLogs.updateRule = leadershipClause
    activityLogs.deleteRule = leadershipClause
    app.save(activityLogs)
  },
)
