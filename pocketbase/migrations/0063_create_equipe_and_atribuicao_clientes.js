migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    // Coleção 1: equipe
    const equipe = new Collection({
      name: 'equipe',
      type: 'base',
      listRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      viewRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      deleteRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'cargo',
          type: 'select',
          values: ['Gestor Tecnico', 'Vendedor'],
          maxSelect: 1,
          required: true,
        },
        { name: 'email', type: 'text' },
        { name: 'regiao', type: 'text' },
        { name: 'ativo', type: 'bool' },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_equipe_user_id ON equipe (user_id)',
        'CREATE INDEX idx_equipe_cargo ON equipe (cargo)',
      ],
    })
    app.save(equipe)

    const equipeId = app.findCollectionByNameOrId('equipe').id

    // Coleção 2: atribuicao_clientes
    const atribuicaoClientes = new Collection({
      name: 'atribuicao_clientes',
      type: 'base',
      listRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      viewRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      deleteRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      fields: [
        { name: 'cliente_nome', type: 'text', required: true },
        {
          name: 'gestor_tecnico_id',
          type: 'relation',
          collectionId: equipeId,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        },
        {
          name: 'vendedor_id',
          type: 'relation',
          collectionId: equipeId,
          maxSelect: 1,
          cascadeDelete: false,
          required: false,
        },
        { name: 'observacoes', type: 'text' },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_atribuicao_clientes_user_id ON atribuicao_clientes (user_id)'],
    })
    app.save(atribuicaoClientes)

    // Seed dos 8 membros em equipe
    const membros = [
      { nome: 'Rodrigo Garginal', cargo: 'Gestor Tecnico', email: '', regiao: '', ativo: true },
      { nome: 'Jessica Dilkin', cargo: 'Gestor Tecnico', email: '', regiao: '', ativo: true },
      { nome: 'Tais Fauro', cargo: 'Gestor Tecnico', email: '', regiao: '', ativo: true },
      { nome: 'Wagner Zacatei', cargo: 'Gestor Tecnico', email: '', regiao: '', ativo: true },
      { nome: 'Felipe Leao', cargo: 'Vendedor', email: '', regiao: '', ativo: true },
      { nome: 'Rafael Bellusci', cargo: 'Vendedor', email: '', regiao: '', ativo: true },
      { nome: 'Welington Alvares', cargo: 'Vendedor', email: '', regiao: '', ativo: true },
      { nome: 'João Pedro', cargo: 'Vendedor', email: '', regiao: '', ativo: true },
    ]

    const equipeCol = app.findCollectionByNameOrId('equipe')
    for (let i = 0; i < membros.length; i++) {
      const m = membros[i]
      try {
        app.findFirstRecordByData('equipe', 'nome', m.nome)
      } catch (_) {
        const record = new Record(equipeCol)
        record.set('nome', m.nome)
        record.set('cargo', m.cargo)
        if (m.email) record.set('email', m.email)
        if (m.regiao) record.set('regiao', m.regiao)
        record.set('ativo', m.ativo)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const atriCol = app.findCollectionByNameOrId('atribuicao_clientes')
      app.delete(atriCol)
    } catch (_) {}

    try {
      const equipeCol = app.findCollectionByNameOrId('equipe')
      app.delete(equipeCol)
    } catch (_) {}
  },
)
