migrate(
  (app) => {
    // 1. Remover duplicatas caso existam antes de criar o índice UNIQUE
    // Agrupa por (data_documento, cliente_codigo, produto_codigo, valor_brl)
    // e mantém apenas a linha de menor id (ou mais antiga).
    try {
      const duplicateCountResult = {}
      app
        .db()
        .newQuery(
          `SELECT COUNT(*) as total_duplicatas FROM faturamento WHERE id NOT IN (
            SELECT MIN(id) FROM faturamento GROUP BY data_documento, cliente_codigo, produto_codigo, valor_brl
          )`,
        )
        .one(duplicateCountResult)

      const dupCount = Number(duplicateCountResult.total_duplicatas || 0)
      if (dupCount > 0) {
        app
          .db()
          .newQuery(
            `DELETE FROM faturamento WHERE id NOT IN (
              SELECT MIN(id) FROM faturamento GROUP BY data_documento, cliente_codigo, produto_codigo, valor_brl
            )`,
          )
          .execute()
        console.log(
          `[0098_add_faturamento_indexes] Removidas ${dupCount} duplicatas da coleção faturamento.`,
        )
      } else {
        console.log(
          '[0098_add_faturamento_indexes] Nenhuma duplicata encontrada na coleção faturamento.',
        )
      }
    } catch (err) {
      console.log('[0098_add_faturamento_indexes] Verificação/remoção de duplicatas:', err)
    }

    // 2. Adicionar os dois índices faltantes à coleção faturamento
    const col = app.findCollectionByNameOrId('faturamento')

    // Índice 1: idx_faturamento_produto ON faturamento (produto_codigo)
    try {
      col.addIndex('idx_faturamento_produto', false, 'produto_codigo', '')
    } catch (e) {
      console.log('[0098_add_faturamento_indexes] idx_faturamento_produto:', e)
    }

    // Índice 2: idx_faturamento_dedupe UNIQUE ON faturamento (data_documento, cliente_codigo, produto_codigo, valor_brl)
    try {
      col.addIndex(
        'idx_faturamento_dedupe',
        true,
        'data_documento, cliente_codigo, produto_codigo, valor_brl',
        '',
      )
    } catch (e) {
      console.log('[0098_add_faturamento_indexes] idx_faturamento_dedupe:', e)
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('faturamento')

      try {
        col.removeIndex('idx_faturamento_produto')
      } catch (_) {}

      try {
        col.removeIndex('idx_faturamento_dedupe')
      } catch (_) {}

      app.save(col)
    } catch (e) {
      console.log('[0098_add_faturamento_indexes] rollback error:', e)
    }
  },
)
