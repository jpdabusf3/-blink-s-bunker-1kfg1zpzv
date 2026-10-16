migrate(
  (app) => {
    // 1. Criar coleção 'distribuidores'
    const distribuidores = new Collection({
      name: 'distribuidores',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'cnpj', type: 'text', required: false },
        { name: 'contato_nome', type: 'text', required: false },
        { name: 'contato_email', type: 'text', required: false },
        { name: 'contato_telefone', type: 'text', required: false },
        { name: 'ufs_atuacao', type: 'json', required: false }, // array de strings ex: ["GO", "MG", "SP"]
        { name: 'contrato_inicio', type: 'date', required: false },
        { name: 'contrato_fim', type: 'date', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_distribuidores_nome ON distribuidores (nome)',
        'CREATE INDEX idx_distribuidores_status ON distribuidores (status)',
      ],
    })
    app.save(distribuidores)

    const distribuidoresId = distribuidores.id

    // 2. Criar coleção 'compras_distribuidor'
    const compras = new Collection({
      name: 'compras_distribuidor',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'distribuidor_id',
          type: 'relation',
          required: true,
          collectionId: distribuidoresId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'produto', type: 'text', required: true },
        {
          name: 'linha_produto',
          type: 'select',
          required: true,
          values: ['MY-CO', 'MO-BE', 'MI-OR', 'MY-ST', 'MI-XS', 'Outros'],
          maxSelect: 1,
        },
        { name: 'toneladas', type: 'number', required: false },
        { name: 'valor_brl', type: 'number', required: false },
        { name: 'valor_usd', type: 'number', required: false },
        { name: 'nf', type: 'text', required: false },
        { name: 'observacoes', type: 'text', required: false },
        { name: 'origem', type: 'text', required: false }, // 'manual' ou 'faturamento_importado'
        { name: 'faturamento_id', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_compras_dist_id ON compras_distribuidor (distribuidor_id)',
        'CREATE INDEX idx_compras_data ON compras_distribuidor (data)',
        'CREATE INDEX idx_compras_linha ON compras_distribuidor (linha_produto)',
      ],
    })
    app.save(compras)

    // 3. Criar coleção 'clientes_distribuidor'
    const clientes = new Collection({
      name: 'clientes_distribuidor',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'distribuidor_id',
          type: 'relation',
          required: true,
          collectionId: distribuidoresId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome_cliente', type: 'text', required: true },
        { name: 'uf', type: 'text', required: false },
        { name: 'municipio', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          values: ['ativo', 'inativo', 'prospeccao'],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text', required: false },
        { name: 'factory_id', type: 'text', required: false }, // vínculo opcional com factories
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_clientes_dist_id ON clientes_distribuidor (distribuidor_id)',
        'CREATE INDEX idx_clientes_dist_uf ON clientes_distribuidor (uf)',
        'CREATE INDEX idx_clientes_dist_nome ON clientes_distribuidor (nome_cliente)',
      ],
    })
    app.save(clientes)
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('clientes_distribuidor')
      app.delete(c)
    } catch (_) {}
    try {
      const co = app.findCollectionByNameOrId('compras_distribuidor')
      app.delete(co)
    } catch (_) {}
    try {
      const d = app.findCollectionByNameOrId('distribuidores')
      app.delete(d)
    } catch (_) {}
  },
)
