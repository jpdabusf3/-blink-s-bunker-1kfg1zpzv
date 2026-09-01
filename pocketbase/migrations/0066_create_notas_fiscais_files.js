migrate(
  (app) => {
    // 1. Storage bucket / collection for notas-fiscais PDF files
    try {
      app.findCollectionByNameOrId('notas_fiscais_files')
    } catch (_) {
      const usersId = '_pb_users_auth_'
      const filesCol = new Collection({
        name: 'notas_fiscais_files',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'arquivo',
            type: 'file',
            maxSelect: 1,
            maxSize: 15728640, // 15MB
            mimeTypes: ['application/pdf'],
            required: true,
          },
          { name: 'nome_original', type: 'text' },
          { name: 'tamanho', type: 'number' },
          { name: 'user_id', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_notas_fiscais_files_user ON notas_fiscais_files (user_id)',
          'CREATE INDEX idx_notas_fiscais_files_created ON notas_fiscais_files (created DESC)',
        ],
      })
      app.save(filesCol)
    }

    // 2. Adjust notas_fiscais schema if needed:
    // Ensure notas_fiscais, nf_itens, and nf_lotes have appropriate open/user access rules
    try {
      const nfCol = app.findCollectionByNameOrId('notas_fiscais')
      nfCol.listRule = "@request.auth.id != ''"
      nfCol.viewRule = "@request.auth.id != ''"
      nfCol.createRule = "@request.auth.id != ''"
      nfCol.updateRule = "@request.auth.id != ''"
      nfCol.deleteRule = "@request.auth.id != ''"
      app.save(nfCol)
    } catch (_) {}

    try {
      const itensCol = app.findCollectionByNameOrId('nf_itens')
      itensCol.listRule = "@request.auth.id != ''"
      itensCol.viewRule = "@request.auth.id != ''"
      itensCol.createRule = "@request.auth.id != ''"
      itensCol.updateRule = "@request.auth.id != ''"
      itensCol.deleteRule = "@request.auth.id != ''"
      app.save(itensCol)
    } catch (_) {}

    try {
      const lotesCol = app.findCollectionByNameOrId('nf_lotes')
      lotesCol.listRule = "@request.auth.id != ''"
      lotesCol.viewRule = "@request.auth.id != ''"
      lotesCol.createRule = "@request.auth.id != ''"
      lotesCol.updateRule = "@request.auth.id != ''"
      lotesCol.deleteRule = "@request.auth.id != ''"
      app.save(lotesCol)
    } catch (_) {}
  },
  (app) => {
    try {
      const filesCol = app.findCollectionByNameOrId('notas_fiscais_files')
      app.delete(filesCol)
    } catch (_) {}
  },
)
