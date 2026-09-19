migrate(
  (app) => {
    // 1. Criar collection import_history com acesso irrestrito para usuários autenticados
    const collection = new Collection({
      name: 'import_history',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'file_name',
          type: 'text',
          required: false,
        },
        {
          name: 'file_type',
          type: 'text',
          required: false,
        },
        {
          name: 'imported_at',
          type: 'date',
          required: false,
        },
        {
          name: 'total_rows',
          type: 'number',
          onlyInt: true,
          required: false,
        },
        {
          name: 'imported_rows',
          type: 'number',
          onlyInt: true,
          required: false,
        },
        {
          name: 'error_rows',
          type: 'number',
          onlyInt: true,
          required: false,
        },
        {
          name: 'status',
          type: 'text',
          required: false,
        },
        {
          name: 'details',
          type: 'text',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_import_history_created ON import_history (created DESC)',
        'CREATE INDEX idx_import_history_imported_at ON import_history (imported_at DESC)',
        'CREATE INDEX idx_import_history_status ON import_history (status)',
      ],
    })

    app.save(collection)

    // 2. Migrar retroativamente os registros existentes de activity_logs relacionados a importação de faturamento
    try {
      const logs = app.findRecordsByFilter(
        'activity_logs',
        'action ~ "Import" || target_collection = "faturamento"',
        'created',
        500,
        0,
      )

      if (logs && logs.length > 0) {
        for (let i = 0; i < logs.length; i++) {
          const log = logs[i]
          const rawDetails = log.getString ? log.getString('details') : log.details || ''
          const createdStr = log.getString ? log.getString('created') : log.created || ''

          // Extrair nome do arquivo
          const fileMatch = rawDetails.match(/\[(.*?)\]/)
          let fileName = fileMatch ? fileMatch[1] : ''
          if (!fileName) {
            const quoteMatch = rawDetails.match(/"(.*?)"/)
            fileName = quoteMatch ? quoteMatch[1] : 'faturamento_importacao.xlsx'
          }

          // Extensão / tipo
          const parts = fileName.split('.')
          const fileType = parts.length > 1 ? parts.pop().toLowerCase() : 'xlsx'

          // Extrair quantidade de importados
          const countMatch = rawDetails.match(/(\d+)\s+registros importados/i)
          let importedRows = countMatch ? parseInt(countMatch[1], 10) : 0
          if (importedRows === 0) {
            const pedidosMatch = rawDetails.match(
              /(\d+)\s+(?:pedidos criados|novas metas|valor\(es\) gravado\(s\))/i,
            )
            if (pedidosMatch) {
              importedRows = parseInt(pedidosMatch[1], 10)
            }
          }

          // Duplicados ignorados
          const dupMatch = rawDetails.match(/(\d+)\s+duplicad/i)
          const dupRows = dupMatch ? parseInt(dupMatch[1], 10) : 0

          // Linhas com erro
          const errMatch = rawDetails.match(/(\d+)\s+linha\(s\)\s+com erro/i)
          let errorRows = errMatch ? parseInt(errMatch[1], 10) : 0

          const totalRows = importedRows + dupRows + errorRows

          // Status mapeado ("sucesso", "parcial" ou "erro")
          const nextStep = (
            log.getString ? log.getString('proximo_passo') : log.proximo_passo || ''
          ).toLowerCase()
          let status = 'sucesso'
          if (
            nextStep === 'erro' ||
            rawDetails.toLowerCase().includes('status: erro') ||
            (importedRows === 0 && totalRows > 0)
          ) {
            status = 'erro'
          } else if (
            nextStep === 'parcial' ||
            rawDetails.toLowerCase().includes('status: parcial') ||
            errorRows > 0 ||
            rawDetails.toLowerCase().includes('linhas que não puderam')
          ) {
            status = 'parcial'
          } else {
            status = 'sucesso'
          }

          const rec = new Record(collection)
          rec.set('file_name', fileName)
          rec.set('file_type', fileType)
          rec.set('imported_at', createdStr)
          rec.set('total_rows', totalRows)
          rec.set('imported_rows', importedRows)
          rec.set('error_rows', errorRows)
          rec.set('status', status)
          rec.set('details', rawDetails)
          app.save(rec)
        }
      }
    } catch (migErr) {
      console.log('Aviso ao migrar logs para import_history:', migErr)
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('import_history')
      app.delete(collection)
    } catch (_) {}
  },
)
