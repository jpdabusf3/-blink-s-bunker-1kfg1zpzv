migrate(
  (app) => {
    const emailsToDelete = [
      'komixao@hotmail.com',
      'felipe.leao@blinkbiotech.com',
      'joao.figueiredo@blinkbiotech.com',
      'jpdabusf3@blinkbiotech.com',
      'welington.alvares@blinkbiotech.com',
    ]

    emailsToDelete.forEach((email) => {
      try {
        const record = app.findAuthRecordByEmail('_pb_users_auth_', email)
        app.delete(record)
      } catch (_) {
        // usuário já não existe — ignora
      }
    })
  },
  (app) => {
    // exclusão permanente — sem reversão
  },
)
