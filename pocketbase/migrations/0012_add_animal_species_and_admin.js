migrate(
  (app) => {
    var factories = app.findCollectionByNameOrId('factories')
    if (!factories.fields.getByName('animalSpecies')) {
      factories.fields.add(
        new SelectField({
          name: 'animalSpecies',
          values: [
            'Bovinos',
            'Suínos',
            'Aves',
            'Aqua',
            'PET',
            'Equinos',
            'Caprinos',
            'Ovinos',
            'Multiespécie',
          ],
        }),
      )
    }
    app.save(factories)

    try {
      var admin = app.findAuthRecordByEmail('_pb_users_auth_', 'joaopedro_zoo@hotmail.com')
      admin.set('job_title', 'CEO')
      app.save(admin)
    } catch (_) {}

    var users = app.findCollectionByNameOrId('_pb_users_auth_')
    var superAdminClause = "@request.auth.email = 'joaopedro_zoo@hotmail.com'"
    users.listRule = 'id = @request.auth.id || ' + superAdminClause
    users.viewRule = 'id = @request.auth.id || ' + superAdminClause
    app.save(users)
  },
  (app) => {
    var factories = app.findCollectionByNameOrId('factories')
    if (factories.fields.getByName('animalSpecies')) {
      factories.fields.removeByName('animalSpecies')
    }
    app.save(factories)

    var users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    app.save(users)
  },
)
