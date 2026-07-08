routerAdd(
  'GET',
  '/backend/v1/users',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    if (auth.email !== 'joaopedro_zoo@hotmail.com' && auth.getString('job_title') !== 'CEO') {
      return e.forbiddenError('master or CEO only')
    }

    var users = $app.findRecordsByFilter('users', "id != ''", '-created', 0, 0)

    var result = []
    for (var i = 0; i < users.length; i++) {
      var u = users[i]
      result.push({
        id: u.id,
        name: u.getString('name'),
        email: u.getString('email'),
        job_title: u.getString('job_title'),
        geographicArea: u.getString('geographicArea'),
        country: u.getString('country'),
        created: u.getString('created'),
      })
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
