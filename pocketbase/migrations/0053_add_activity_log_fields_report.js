// Adds structured fields to activity_logs so the per-client history dialog
// (Funil & Funil de Vendas) can record/show: tipo de ação, próximo passo,
// status antigo/novo e origem. Also adds a `client_reports` collection that
// stores generated .docx Word reports per client, served from the Relatórios tab.
migrate(
  (app) => {
    // --- 1. Extend activity_logs with structured fields ---
    const logCol = app.findCollectionByNameOrId('activity_logs')

    if (!logCol.fields.getByName('tipo')) {
      logCol.fields.add(
        new SelectField({
          name: 'tipo',
          values: ['status', 'acao', 'nota', 'proximo_passo', 'outro'],
        }),
      )
    }
    if (!logCol.fields.getByName('proximo_passo')) {
      logCol.fields.add(new TextField({ name: 'proximo_passo' }))
    }
    if (!logCol.fields.getByName('status_anterior')) {
      logCol.fields.add(new TextField({ name: 'status_anterior' }))
    }
    if (!logCol.fields.getByName('status_novo')) {
      logCol.fields.add(new TextField({ name: 'status_novo' }))
    }
    if (!logCol.fields.getByName('origem')) {
      logCol.fields.add(
        new SelectField({
          name: 'origem',
          values: ['manual', 'funil', 'funil_vendas', 'painel'],
        }),
      )
    }
    app.save(logCol)

    // index for per-client listing (recordId + target_collection + created)
    logCol.addIndex(
      'idx_activity_logs_record_collection',
      false,
      'recordId, target_collection, created',
      '',
    )
    app.save(logCol)

    // --- 2. Create client_reports collection (Word .docx files) ---
    const factoriesId = app.findCollectionByNameOrId('factories').id
    const usersId = '_pb_users_auth_'

    const reportsCol = new Collection({
      name: 'client_reports',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule:
        "@request.auth.email = 'joaopedro_zoo@hotmail.com' || @request.auth.job_title = 'CEO' || @request.auth.job_title = 'Diretor'",
      fields: [
        {
          name: 'client_id',
          type: 'relation',
          required: true,
          collectionId: factoriesId,
          maxSelect: 1,
        },
        { name: 'client_name', type: 'text', required: true },
        {
          name: 'generated_by',
          type: 'relation',
          required: false,
          collectionId: usersId,
          maxSelect: 1,
        },
        { name: 'generated_by_name', type: 'text', required: false },
        { name: 'title', type: 'text', required: true },
        {
          name: 'file',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/octet-stream',
            'application/pdf',
          ],
        },
        { name: 'periodo_inicio', type: 'date', required: false },
        { name: 'periodo_fim', type: 'date', required: false },
        { name: 'total_acoes', type: 'number', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_client_reports_client_id ON client_reports (client_id)',
        'CREATE INDEX idx_client_reports_created ON client_reports (created DESC)',
      ],
    })
    app.save(reportsCol)
  },
  (app) => {
    // down: remove client_reports collection
    try {
      const reportsCol = app.findCollectionByNameOrId('client_reports')
      app.delete(reportsCol)
    } catch (_) {}

    // down: remove added activity_logs fields + index
    try {
      const logCol = app.findCollectionByNameOrId('activity_logs')
      ;['tipo', 'proximo_passo', 'status_anterior', 'status_novo', 'origem'].forEach((n) => {
        const f = logCol.fields.getByName(n)
        if (f) logCol.fields.remove(f)
      })
      logCol.removeIndex('idx_activity_logs_record_collection')
      app.save(logCol)
    } catch (_) {}
  },
)
