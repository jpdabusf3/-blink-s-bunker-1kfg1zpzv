routerAdd(
  'GET',
  '/backend/v1/team-performance',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    if (
      auth.email !== 'joaopedro_zoo@hotmail.com' &&
      auth.getString('job_title') !== 'CEO' &&
      auth.getString('job_title') !== 'Diretor'
    ) {
      return e.forbiddenError('CEO or Diretor only')
    }

    var query = e.requestInfo().query || {}
    var startDate = query.startDate || ''
    var endDate = query.endDate || ''

    var filter = "id != ''"
    if (startDate) filter += " && created >= '" + startDate + " 00:00:00'"
    if (endDate) filter += " && created <= '" + endDate + " 23:59:59'"

    var logs = $app.findRecordsByFilter('activity_logs', filter, '-created', 0, 0)
    var users = $app.findRecordsByFilter('users', "id != ''", '-created', 0, 0)

    var usersById = {}
    for (var i = 0; i < users.length; i++) {
      usersById[users[i].id] = {
        name: users[i].getString('name') || users[i].getString('email'),
        email: users[i].getString('email'),
      }
    }

    var actionsPerUser = {}
    for (var j = 0; j < logs.length; j++) {
      var uid = logs[j].getString('user')
      actionsPerUser[uid] = (actionsPerUser[uid] || 0) + 1
    }

    var actionsPerUserData = []
    for (var key in actionsPerUser) {
      var info = usersById[key] || { name: 'Unknown', email: 'unknown' }
      actionsPerUserData.push({ user: info.name, email: info.email, actions: actionsPerUser[key] })
    }
    actionsPerUserData.sort(function (a, b) {
      return b.actions - a.actions
    })

    var actionTypes = {}
    for (var k = 0; k < logs.length; k++) {
      var action = logs[k].getString('action')
      actionTypes[action] = (actionTypes[action] || 0) + 1
    }

    var actionTypeData = []
    for (var type in actionTypes) {
      actionTypeData.push({ name: type, value: actionTypes[type] })
    }
    actionTypeData.sort(function (a, b) {
      return b.value - a.value
    })

    return e.json(200, {
      actionsPerUser: actionsPerUserData,
      actionTypeDistribution: actionTypeData,
      totalLogs: logs.length,
    })
  },
  $apis.requireAuth(),
)
