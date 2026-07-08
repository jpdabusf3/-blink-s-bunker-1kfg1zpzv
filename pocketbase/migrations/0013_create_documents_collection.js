migrate(
  (app) => {
    var documents = new Collection({
      name: 'documents',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'",
      updateRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'",
      deleteRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor' || @request.auth.job_title = 'Gestor' || @request.auth.job_title = 'Gerente' || @request.auth.job_title = 'Manager'",
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'file',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
          ],
        },
        { name: 'category', type: 'text' },
        {
          name: 'min_access_level',
          type: 'select',
          values: ['CEO', 'Diretor', 'Gestor', 'Gerente', 'Manager', 'Vendedor', 'Comum'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_documents_category ON documents (category)'],
    })
    app.save(documents)

    var notifCol = app.findCollectionByNameOrId('notifications')
    if (!notifCol.fields.getByName('userId')) {
      notifCol.fields.add(
        new RelationField({
          name: 'userId',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }
    if (!notifCol.fields.getByName('targetId')) {
      var targetsCol = app.findCollectionByNameOrId('targets')
      notifCol.fields.add(
        new RelationField({
          name: 'targetId',
          collectionId: targetsCol.id,
          maxSelect: 1,
        }),
      )
    }
    if (!notifCol.fields.getByName('milestone')) {
      notifCol.fields.add(new TextField({ name: 'milestone' }))
    }
    if (!notifCol.fields.getByName('isRead')) {
      notifCol.fields.add(new BoolField({ name: 'isRead' }))
    }
    app.save(notifCol)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('documents'))
    } catch (_) {}
  },
)
