migrate(
  (app) => {
    // Coleção: matriz_fiscal
    const matrizFiscal = new Collection({
      name: 'matriz_fiscal',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'estado',
          type: 'select',
          values: ['Parana', 'Outros Estados'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'especie',
          type: 'select',
          values: ['PET', 'AVES', 'SUINOS', 'RUMINANTES', 'DISTRIBUICAO'],
          maxSelect: 1,
          required: true,
        },
        { name: 'aliquota_icms', type: 'number', required: false },
        { name: 'aliquota_pis', type: 'number', required: false },
        { name: 'aliquota_cofins', type: 'number', required: false },
        { name: 'frete_fob_percent', type: 'number', required: false },
        { name: 'frete_cif_percent', type: 'number', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_matriz_fiscal_estado ON matriz_fiscal (estado)',
        'CREATE INDEX idx_matriz_fiscal_especie ON matriz_fiscal (especie)',
        'CREATE INDEX idx_matriz_fiscal_estado_especie ON matriz_fiscal (estado, especie)',
      ],
    })
    app.save(matrizFiscal)

    // Coleção opcional: pedidos (se ainda não existir para registrar novos pedidos gerados)
    try {
      app.findCollectionByNameOrId('pedidos')
    } catch (_) {
      const usersId = '_pb_users_auth_'
      const produtosId = app.findCollectionByNameOrId('produtos').id
      const equipeId = app.findCollectionByNameOrId('equipe').id

      const pedidosCol = new Collection({
        name: 'pedidos',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'cliente_nome', type: 'text', required: true },
          { name: 'cliente_email', type: 'text', required: true },
          { name: 'cliente_documento', type: 'text' },
          { name: 'cliente_endereco', type: 'text' },
          { name: 'solicitante', type: 'text' },
          { name: 'gestor_tecnico_id', type: 'relation', collectionId: equipeId, maxSelect: 1 },
          { name: 'vendedor_id', type: 'relation', collectionId: equipeId, maxSelect: 1 },
          { name: 'produto_id', type: 'relation', collectionId: produtosId, maxSelect: 1 },
          { name: 'produto_codigo', type: 'text' },
          { name: 'produto_nome', type: 'text' },
          { name: 'produto_linha', type: 'text' },
          { name: 'quantidade', type: 'number' },
          { name: 'preco_liquido', type: 'number' },
          { name: 'desconto_percent', type: 'number' },
          { name: 'estado', type: 'text' },
          { name: 'especie', type: 'text' },
          { name: 'modalidade_frete', type: 'text' },
          { name: 'frete_percentual', type: 'number' },
          { name: 'frete_valor', type: 'number' },
          { name: 'aliquota_icms', type: 'number' },
          { name: 'aliquota_pis', type: 'number' },
          { name: 'aliquota_cofins', type: 'number' },
          { name: 'impostos_adicionais', type: 'number' },
          { name: 'canal_vendas', type: 'text' },
          { name: 'especie_destino', type: 'text' },
          { name: 'observacoes', type: 'text' },
          { name: 'preco_base', type: 'number' },
          { name: 'icms_valor', type: 'number' },
          { name: 'pis_valor', type: 'number' },
          { name: 'cofins_valor', type: 'number' },
          { name: 'preco_fob', type: 'number' },
          { name: 'preco_cif', type: 'number' },
          { name: 'total_geral', type: 'number' },
          { name: 'user_id', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_pedidos_cliente ON pedidos (cliente_nome)',
          'CREATE INDEX idx_pedidos_created ON pedidos (created DESC)',
        ],
      })
      app.save(pedidosCol)
    }

    // Seed matriz_fiscal
    const fiscalEntries = [
      // Paraná
      { estado: 'Parana', especie: 'PET', icms: 12.0, pis: 1.65, cofins: 7.6, fob: 0, cif: 5.0 },
      { estado: 'Parana', especie: 'AVES', icms: 7.0, pis: 0.65, cofins: 3.0, fob: 0, cif: 4.5 },
      { estado: 'Parana', especie: 'SUINOS', icms: 7.0, pis: 0.65, cofins: 3.0, fob: 0, cif: 4.5 },
      {
        estado: 'Parana',
        especie: 'RUMINANTES',
        icms: 7.0,
        pis: 0.65,
        cofins: 3.0,
        fob: 0,
        cif: 4.5,
      },
      {
        estado: 'Parana',
        especie: 'DISTRIBUICAO',
        icms: 12.0,
        pis: 1.65,
        cofins: 7.6,
        fob: 0,
        cif: 4.0,
      },

      // Outros Estados
      {
        estado: 'Outros Estados',
        especie: 'PET',
        icms: 12.0,
        pis: 1.65,
        cofins: 7.6,
        fob: 0,
        cif: 6.5,
      },
      {
        estado: 'Outros Estados',
        especie: 'AVES',
        icms: 4.0,
        pis: 0.65,
        cofins: 3.0,
        fob: 0,
        cif: 5.5,
      },
      {
        estado: 'Outros Estados',
        especie: 'SUINOS',
        icms: 4.0,
        pis: 0.65,
        cofins: 3.0,
        fob: 0,
        cif: 5.5,
      },
      {
        estado: 'Outros Estados',
        especie: 'RUMINANTES',
        icms: 4.0,
        pis: 0.65,
        cofins: 3.0,
        fob: 0,
        cif: 5.5,
      },
      {
        estado: 'Outros Estados',
        especie: 'DISTRIBUICAO',
        icms: 4.0,
        pis: 1.65,
        cofins: 7.6,
        fob: 0,
        cif: 5.0,
      },
    ]

    const col = app.findCollectionByNameOrId('matriz_fiscal')
    for (let i = 0; i < fiscalEntries.length; i++) {
      const item = fiscalEntries[i]
      try {
        const existing = app.findRecordsByFilter(
          'matriz_fiscal',
          "estado = '" + item.estado + "' && especie = '" + item.especie + "'",
          '',
          1,
          0,
        )
        if (existing.length > 0) continue
      } catch (_) {}

      const r = new Record(col)
      r.set('estado', item.estado)
      r.set('especie', item.especie)
      r.set('aliquota_icms', item.icms)
      r.set('aliquota_pis', item.pis)
      r.set('aliquota_cofins', item.cofins)
      r.set('frete_fob_percent', item.fob)
      r.set('frete_cif_percent', item.cif)
      app.save(r)
    }
  },
  (app) => {
    try {
      const ped = app.findCollectionByNameOrId('pedidos')
      app.delete(ped)
    } catch (_) {}
    try {
      const mf = app.findCollectionByNameOrId('matriz_fiscal')
      app.delete(mf)
    } catch (_) {}
  },
)
