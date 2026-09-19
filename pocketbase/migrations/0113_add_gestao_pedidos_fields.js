migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pedidos')
    const factoriesCol = app.findCollectionByNameOrId('factories')
    const produtosCol = app.findCollectionByNameOrId('produtos')

    // 1. Tornar cliente_nome e cliente_email opcionais caso ainda sejam obrigatórios
    const cliNome = col.fields.getByName('cliente_nome')
    if (cliNome) {
      cliNome.required = false
    }
    const cliEmail = col.fields.getByName('cliente_email')
    if (cliEmail) {
      cliEmail.required = false
    }

    // 2. Adicionar campo clienteId (relation -> factories, obrigatório)
    if (!col.fields.getByName('clienteId')) {
      col.fields.add(
        new RelationField({
          name: 'clienteId',
          collectionId: factoriesCol.id,
          maxSelect: 1,
          required: false, // para permitir compatibilidade com registros existentes, validado na UI/app
        }),
      )
    }

    // 3. Adicionar campo produtoId (relation -> produtos)
    if (!col.fields.getByName('produtoId')) {
      col.fields.add(
        new RelationField({
          name: 'produtoId',
          collectionId: produtosCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 4. Adicionar campo quantidade se não existir
    if (!col.fields.getByName('quantidade')) {
      col.fields.add(
        new NumberField({
          name: 'quantidade',
          required: false,
        }),
      )
    }

    // 5. Adicionar campo valorUnitario
    if (!col.fields.getByName('valorUnitario')) {
      col.fields.add(
        new NumberField({
          name: 'valorUnitario',
          required: false,
        }),
      )
    }

    // 6. Adicionar campo valorTotal
    if (!col.fields.getByName('valorTotal')) {
      col.fields.add(
        new NumberField({
          name: 'valorTotal',
          required: false,
        }),
      )
    }

    // 7. Adicionar campo status (select: ABERTO, FATURADO, CANCELADO)
    if (!col.fields.getByName('status')) {
      col.fields.add(
        new SelectField({
          name: 'status',
          values: ['ABERTO', 'FATURADO', 'CANCELADO'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 8. Adicionar campo dataPedido (date)
    if (!col.fields.getByName('dataPedido')) {
      col.fields.add(
        new DateField({
          name: 'dataPedido',
          required: false,
        }),
      )
    }

    // 9. Adicionar campo dataEntregaPrevista (date)
    if (!col.fields.getByName('dataEntregaPrevista')) {
      col.fields.add(
        new DateField({
          name: 'dataEntregaPrevista',
          required: false,
        }),
      )
    }

    // 10. Adicionar campo nfNumero (text)
    if (!col.fields.getByName('nfNumero')) {
      col.fields.add(
        new TextField({
          name: 'nfNumero',
          required: false,
        }),
      )
    }

    // Garantir regras de acesso irrestrito para usuários autenticados
    col.listRule = "@request.auth.id != ''"
    col.viewRule = "@request.auth.id != ''"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    col.deleteRule = "@request.auth.id != ''"

    col.addIndex('idx_pedidos_clienteId', false, 'clienteId', '')
    col.addIndex('idx_pedidos_produtoId', false, 'produtoId', '')
    col.addIndex('idx_pedidos_status', false, 'status', '')
    col.addIndex('idx_pedidos_dataPedido', false, 'dataPedido', '')

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('pedidos')
      col.removeIndex('idx_pedidos_clienteId')
      col.removeIndex('idx_pedidos_produtoId')
      col.removeIndex('idx_pedidos_status')
      col.removeIndex('idx_pedidos_dataPedido')
      // Deixar campos intocados no down para evitar perda de dados
      app.save(col)
    } catch (_) {}
  },
)
