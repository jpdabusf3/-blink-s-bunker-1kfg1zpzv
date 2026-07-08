migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      return
    } catch (_) {}

    const record = new Record(users)
    record.setEmail('joaopedro_zoo@hotmail.com')
    record.setPassword('Skip@Pass')
    record.setVerified(true)
    record.set('name', 'Admin')
    record.set('job_title', 'CEO')
    record.set('geographicArea', '')
    record.set('country', 'Brasil')
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      app.delete(record)
    } catch (_) {}
  },
)
