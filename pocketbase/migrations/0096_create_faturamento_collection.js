migrate(
  (app) => {
    const collection = new Collection({
      name: 'faturamento',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'country', type: 'text' },
        { name: 'nf_ano', type: 'number' },
        { name: 'nf_ano_mes', type: 'text' },
        { name: 'cliente_codigo', type: 'text' },
        { name: 'cliente_nome', type: 'text' },
        { name: 'familia_produto', type: 'text' },
        { name: 'data_documento', type: 'date' },
        { name: 'produto_codigo', type: 'text' },
        { name: 'produto_descricao', type: 'text' },
        { name: 'valor_usd', type: 'number' },
        { name: 'valor_brl', type: 'number' },
        { name: 'semana_iso', type: 'number' },
        { name: 'mes', type: 'number' },
        { name: 'ano', type: 'number' },
        { name: 'semestre', type: 'text' },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_faturamento_data ON faturamento (data_documento)',
        'CREATE INDEX idx_faturamento_semana ON faturamento (semana_iso)',
        'CREATE INDEX idx_faturamento_ano_mes ON faturamento (ano, mes)',
        'CREATE INDEX idx_faturamento_cliente ON faturamento (cliente_codigo)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('faturamento')
      app.delete(collection)
    } catch (_) {}
  },
)
