/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('maestro_uploads')
    } catch (_) {
      const usersId = '_pb_users_auth_'
      const uploadsCol = new Collection({
        name: 'maestro_uploads',
        type: 'base',
        listRule: "@request.auth.id != '' && user_id = @request.auth.id",
        viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
        fields: [
          {
            name: 'arquivo',
            type: 'file',
            maxSelect: 1,
            maxSize: 20971520, // 20MB
            mimeTypes: [
              'application/pdf',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.ms-excel',
              'text/csv',
              'text/plain',
              'application/csv',
            ],
            required: true,
          },
          { name: 'nome_original', type: 'text' },
          { name: 'tamanho', type: 'number' },
          { name: 'mime_type', type: 'text' },
          { name: 'user_id', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_maestro_uploads_user ON maestro_uploads (user_id)',
          'CREATE INDEX idx_maestro_uploads_created ON maestro_uploads (created DESC)',
        ],
      })
      app.save(uploadsCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('maestro_uploads')
      app.delete(col)
    } catch (_) {}
  },
)
