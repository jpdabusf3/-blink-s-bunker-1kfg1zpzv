migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('historico_vendas')

    // Atualizar regras de acesso para garantir que apenas o usuário autenticado dono acesse/veja/edite
    col.listRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.viewRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.deleteRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"

    // 1. Remover campos antigos se existirem ou preparar novos
    // Campos requeridos:
    // id (automático)
    // origem (TEXT: 'nf' ou 'pedido')
    // numero_documento (TEXT)
    // data_documento (DATE)
    // mes (TEXT: janeiro, fevereiro, ...)
    // ano (INTEGER)
    // trimestre (TEXT: T1, T2, T3, T4)
    // destinatario_nome (TEXT)
    // destinatario_uf (TEXT)
    // pais (TEXT: Brasil, Paraguai, Chile)
    // especie_destino (TEXT: PET, AVES, SUINOS, RUMINANTES, AQUA, DISTRIBUICAO)
    // canal_vendas (TEXT: Direto, Distribuidor, Industria, etc.)
    // gestor_tecnico (TEXT)
    // vendedor (TEXT)
    // produto_codigo (TEXT)
    // produto_descricao (TEXT)
    // produto_familia (TEXT: Adsorventes, Minerais Organicos, Prebioticos, Blends, Ingredientes, Inovacao)
    // produto_quantidade (NUMERIC)
    // produto_valor_unitario (NUMERIC)
    // produto_valor_total (NUMERIC)
    // valor_total_nota (NUMERIC)
    // frete_modalidade (TEXT)
    // status (TEXT: 'realizado' ou 'projetado')
    // user_id (UUID FK para usuários)

    // Adicionar novos campos se não existirem
    var addTextField = (name) => {
      if (!col.fields.getByName(name)) {
        col.fields.add(new TextField({ name: name }))
      }
    }
    var addNumberField = (name, onlyInt = false) => {
      if (!col.fields.getByName(name)) {
        col.fields.add(new NumberField({ name: name, onlyInt: onlyInt }))
      }
    }
    var addDateField = (name) => {
      if (!col.fields.getByName(name)) {
        col.fields.add(new DateField({ name: name }))
      }
    }

    addTextField('origem')
    addTextField('numero_documento')
    addDateField('data_documento')
    addTextField('mes')
    addNumberField('ano', true)
    addTextField('trimestre')
    addTextField('destinatario_nome')
    addTextField('destinatario_uf')
    addTextField('pais')
    addTextField('especie_destino')
    addTextField('canal_vendas')
    addTextField('gestor_tecnico')
    addTextField('vendedor')
    addTextField('produto_codigo')
    addTextField('produto_descricao')
    addTextField('produto_familia')
    addNumberField('produto_quantidade', false)
    addNumberField('produto_valor_unitario', false)
    addNumberField('produto_valor_total', false)
    addNumberField('valor_total_nota', false)
    addTextField('frete_modalidade')
    addTextField('status')

    if (!col.fields.getByName('user_id')) {
      col.fields.add(
        new RelationField({
          name: 'user_id',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    // Índices em user_id, data_documento, ano, gestor_tecnico, vendedor, destinatario_nome
    col.addIndex('idx_historico_vendas_user_id', false, 'user_id', '')
    col.addIndex('idx_historico_vendas_data_doc', false, 'data_documento', '')
    col.addIndex('idx_historico_vendas_ano', false, 'ano', '')
    col.addIndex('idx_historico_vendas_gestor_tec', false, 'gestor_tecnico', '')
    col.addIndex('idx_historico_vendas_vendedor', false, 'vendedor', '')
    col.addIndex('idx_historico_vendas_dest_nome', false, 'destinatario_nome', '')
    col.addIndex('idx_historico_vendas_status', false, 'status', '')
    col.addIndex('idx_historico_vendas_origem', false, 'origem', '')

    app.save(col)
  },
  (app) => {
    try {
      var col = app.findCollectionByNameOrId('historico_vendas')
      col.removeIndex('idx_historico_vendas_user_id')
      col.removeIndex('idx_historico_vendas_data_doc')
      col.removeIndex('idx_historico_vendas_ano')
      col.removeIndex('idx_historico_vendas_gestor_tec')
      col.removeIndex('idx_historico_vendas_vendedor')
      col.removeIndex('idx_historico_vendas_dest_nome')
      col.removeIndex('idx_historico_vendas_status')
      col.removeIndex('idx_historico_vendas_origem')
      app.save(col)
    } catch (_) {}
  },
)
