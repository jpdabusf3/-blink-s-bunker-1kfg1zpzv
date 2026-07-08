migrate(
  (app) => {
    var invitations = new Collection({
      name: 'invitations',
      type: 'base',
      listRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO'",
      viewRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO'",
      createRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO'",
      updateRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO'",
      deleteRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO'",
      fields: [
        { name: 'email', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['CEO', 'Diretor', 'Gestor', 'Gerente', 'Manager', 'Vendedor', 'Comum'],
          maxSelect: 1,
        },
        { name: 'geographicArea', type: 'text' },
        { name: 'country', type: 'text' },
        { name: 'token', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'accepted', 'expired'],
          maxSelect: 1,
        },
        { name: 'expiresAt', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_invitations_email ON invitations (email)',
        'CREATE INDEX idx_invitations_token ON invitations (token)',
        'CREATE INDEX idx_invitations_status ON invitations (status)',
      ],
    })
    app.save(invitations)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('invitations'))
    } catch (_) {}
  },
)
