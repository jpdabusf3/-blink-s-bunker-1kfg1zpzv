migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('historico_vendas')

    // Garantir campos para faturamento completo:
    // cliente_cnpj: CNPJ do cliente/destinatário
    // filial_unidade: Unidade fabril / filial de faturamento
    // factory_id: relação opcional com o cliente vinculado
    if (!col.fields.getByName('cliente_cnpj')) {
      col.fields.add(new TextField({ name: 'cliente_cnpj' }))
    }
    if (!col.fields.getByName('filial_unidade')) {
      col.fields.add(new TextField({ name: 'filial_unidade' }))
    }

    try {
      const factoriesCol = app.findCollectionByNameOrId('factories')
      if (!col.fields.getByName('factory_id')) {
        col.fields.add(
          new RelationField({
            name: 'factory_id',
            collectionId: factoriesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          }),
        )
      }
    } catch (_) {}

    // Índices para otimizar busca por cliente, CNPJ, número do documento e data
    col.addIndex('idx_historico_vendas_cliente_cnpj', false, 'cliente_cnpj', '')
    col.addIndex('idx_historico_vendas_numero_doc', false, 'numero_documento', '')
    col.addIndex('idx_historico_vendas_cliente_nome', false, 'cliente', '')

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('historico_vendas')
      col.removeIndex('idx_historico_vendas_cliente_cnpj')
      col.removeIndex('idx_historico_vendas_numero_doc')
      col.removeIndex('idx_historico_vendas_cliente_nome')
      app.save(col)
    } catch (_) {}
  },
)
