migrate(
  (app) => {
    // 1. Atualizar documents: adicionar campo nome_original se ainda não existir
    try {
      const docCol = app.findCollectionByNameOrId('documents')
      if (!docCol.fields.getByName('nome_original')) {
        docCol.fields.add(
          new TextField({
            name: 'nome_original',
            required: false,
          }),
        )
        app.save(docCol)
      }
    } catch (e) {
      console.log('Error updating documents collection:', e)
    }

    // 2. Atualizar dashboard_preferences: adicionar campo last_automation_update se ainda não existir
    try {
      const dashCol = app.findCollectionByNameOrId('dashboard_preferences')
      if (!dashCol.fields.getByName('last_automation_update')) {
        dashCol.fields.add(
          new TextField({
            name: 'last_automation_update',
            required: false,
          }),
        )
      }
      if (!dashCol.fields.getByName('last_automation_period')) {
        dashCol.fields.add(
          new TextField({
            name: 'last_automation_period',
            required: false,
          }),
        )
      }
      app.save(dashCol)
    } catch (e) {
      console.log('Error updating dashboard_preferences collection:', e)
    }

    // 3. Criar collection de cache do funil e automações se não existir
    try {
      app.findCollectionByNameOrId('automation_cache')
    } catch (_) {
      const cacheCol = new Collection({
        name: 'automation_cache',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'cache_key', type: 'text', required: true },
          { name: 'data', type: 'json' },
          { name: 'periodo', type: 'text' },
          { name: 'expires_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_automation_cache_key ON automation_cache (cache_key)'],
      })
      app.save(cacheCol)
    }
  },
  (app) => {
    try {
      const cacheCol = app.findCollectionByNameOrId('automation_cache')
      app.delete(cacheCol)
    } catch (_) {}

    try {
      const docCol = app.findCollectionByNameOrId('documents')
      if (docCol.fields.getByName('nome_original')) {
        docCol.fields.removeByName('nome_original')
        app.save(docCol)
      }
    } catch (_) {}

    try {
      const dashCol = app.findCollectionByNameOrId('dashboard_preferences')
      if (dashCol.fields.getByName('last_automation_update')) {
        dashCol.fields.removeByName('last_automation_update')
      }
      if (dashCol.fields.getByName('last_automation_period')) {
        dashCol.fields.removeByName('last_automation_period')
      }
      app.save(dashCol)
    } catch (_) {}
  },
)
