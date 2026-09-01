migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('nfe_pedidos')

    // Dados da nota adicionais
    if (!col.fields.getByName('natureza_operacao')) {
      col.fields.add(new TextField({ name: 'natureza_operacao' }))
    }
    if (!col.fields.getByName('protocolo_autorizacao')) {
      col.fields.add(new TextField({ name: 'protocolo_autorizacao' }))
    }
    if (!col.fields.getByName('data_entrada_saida')) {
      col.fields.add(new DateField({ name: 'data_entrada_saida' }))
    }
    if (!col.fields.getByName('hora_saida')) {
      col.fields.add(new TextField({ name: 'hora_saida' }))
    }

    // Emitente
    if (!col.fields.getByName('emitente_inscricao_estadual')) {
      col.fields.add(new TextField({ name: 'emitente_inscricao_estadual' }))
    }
    if (!col.fields.getByName('emitente_endereco')) {
      col.fields.add(new TextField({ name: 'emitente_endereco' }))
    }

    // Destinatário/Cliente
    if (!col.fields.getByName('cliente_bairro_distrito')) {
      col.fields.add(new TextField({ name: 'cliente_bairro_distrito' }))
    }
    if (!col.fields.getByName('cliente_cep')) {
      col.fields.add(new TextField({ name: 'cliente_cep' }))
    }
    if (!col.fields.getByName('cliente_inscricao_estadual')) {
      col.fields.add(new TextField({ name: 'cliente_inscricao_estadual' }))
    }
    if (!col.fields.getByName('cliente_fone')) {
      col.fields.add(new TextField({ name: 'cliente_fone' }))
    }

    // Impostos e valores adicionais
    if (!col.fields.getByName('impostos_icms_st_base')) {
      col.fields.add(new NumberField({ name: 'impostos_icms_st_base' }))
    }
    if (!col.fields.getByName('impostos_icms_st_valor')) {
      col.fields.add(new NumberField({ name: 'impostos_icms_st_valor' }))
    }
    if (!col.fields.getByName('valor_seguro')) {
      col.fields.add(new NumberField({ name: 'valor_seguro' }))
    }
    if (!col.fields.getByName('desconto')) {
      col.fields.add(new NumberField({ name: 'desconto' }))
    }
    if (!col.fields.getByName('outras_despesas')) {
      col.fields.add(new NumberField({ name: 'outras_despesas' }))
    }
    if (!col.fields.getByName('valor_aproximado_tributos')) {
      col.fields.add(new NumberField({ name: 'valor_aproximado_tributos' }))
    }

    // Fatura / Duplicatas
    if (!col.fields.getByName('fatura_numero')) {
      col.fields.add(new TextField({ name: 'fatura_numero' }))
    }
    if (!col.fields.getByName('fatura_vencimento')) {
      col.fields.add(new DateField({ name: 'fatura_vencimento' }))
    }
    if (!col.fields.getByName('fatura_valor')) {
      col.fields.add(new NumberField({ name: 'fatura_valor' }))
    }

    // Frete / Transporte
    if (!col.fields.getByName('volumes')) {
      col.fields.add(new TextField({ name: 'volumes' }))
    }
    if (!col.fields.getByName('peso_bruto')) {
      col.fields.add(new NumberField({ name: 'peso_bruto' }))
    }
    if (!col.fields.getByName('peso_liquido')) {
      col.fields.add(new NumberField({ name: 'peso_liquido' }))
    }

    // Observações adicionais
    if (!col.fields.getByName('ordem_compra')) {
      col.fields.add(new TextField({ name: 'ordem_compra' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('nfe_pedidos')
    const fieldNames = [
      'natureza_operacao',
      'protocolo_autorizacao',
      'data_entrada_saida',
      'hora_saida',
      'emitente_inscricao_estadual',
      'emitente_endereco',
      'cliente_bairro_distrito',
      'cliente_cep',
      'cliente_inscricao_estadual',
      'cliente_fone',
      'impostos_icms_st_base',
      'impostos_icms_st_valor',
      'valor_seguro',
      'desconto',
      'outras_despesas',
      'valor_aproximado_tributos',
      'fatura_numero',
      'fatura_vencimento',
      'fatura_valor',
      'volumes',
      'peso_bruto',
      'peso_liquido',
      'ordem_compra',
    ]
    fieldNames.forEach((name) => {
      const f = col.fields.getByName(name)
      if (f) col.fields.remove(f)
    })
    app.save(col)
  },
)
