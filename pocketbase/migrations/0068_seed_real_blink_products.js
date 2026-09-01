migrate(
  (app) => {
    const produtos = app.findCollectionByNameOrId('produtos')

    const realBlinkProdutos = [
      {
        codigo: 'BPMI.OR035',
        nome: 'Blink Zinc 22 - SC',
        linha: 'Minerais Orgânicos',
        unidade_medida: 'KG',
        preco_base: 16.03,
        especie_padrao: 'BOVINO',
        ativo: true,
      },
      {
        codigo: 'BPMI.OR027',
        nome: 'Blink Manganese 22 - SC',
        linha: 'Minerais Orgânicos',
        unidade_medida: 'KG',
        preco_base: 14.64,
        especie_padrao: 'BOVINO',
        ativo: true,
      },
      {
        codigo: 'BPMI.OR019',
        nome: 'Blink Iron 22 - SC',
        linha: 'Minerais Orgânicos',
        unidade_medida: 'KG',
        preco_base: 13.31,
        especie_padrao: 'BOVINO',
        ativo: true,
      },
      {
        codigo: 'BPMI.OR015',
        nome: 'Blink Copper 22 - SC',
        linha: 'Minerais Orgânicos',
        unidade_medida: 'KG',
        preco_base: 25.89,
        especie_padrao: 'BOVINO',
        ativo: true,
      },
      {
        codigo: 'BPMI.OR007',
        nome: 'Blink Chromium 20 - SC',
        linha: 'Minerais Orgânicos',
        unidade_medida: 'KG',
        preco_base: 41.0,
        especie_padrao: 'BOVINO',
        ativo: true,
      },
      {
        codigo: 'BPMI.OR031',
        nome: 'Blink Selenium 6.0 - SC',
        linha: 'Minerais Orgânicos',
        unidade_medida: 'KG',
        preco_base: 15.8,
        especie_padrao: 'BOVINO',
        ativo: true,
      },
    ]

    for (const prod of realBlinkProdutos) {
      try {
        app.findFirstRecordByData('produtos', 'codigo', prod.codigo)
        // already exists
      } catch (_) {
        const record = new Record(produtos)
        record.set('codigo', prod.codigo)
        record.set('nome', prod.nome)
        record.set('linha', prod.linha)
        record.set('unidade_medida', prod.unidade_medida)
        record.set('preco_base', prod.preco_base)
        record.set('especie_padrao', prod.especie_padrao)
        record.set('ativo', prod.ativo)
        app.save(record)
      }
    }
  },
  (app) => {
    const codigos = [
      'BPMI.OR035',
      'BPMI.OR027',
      'BPMI.OR019',
      'BPMI.OR015',
      'BPMI.OR007',
      'BPMI.OR031',
    ]
    for (const cod of codigos) {
      try {
        const rec = app.findFirstRecordByData('produtos', 'codigo', cod)
        app.delete(rec)
      } catch (_) {}
    }
  },
)
