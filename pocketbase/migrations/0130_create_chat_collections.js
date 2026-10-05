migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Atualizar notificações com campos opcionais se ainda não existirem (context_type, context_id, context_link)
    try {
      const notifCol = app.findCollectionByNameOrId('notifications')
      let changed = false
      if (!notifCol.fields.getByName('context_type')) {
        notifCol.fields.add(new TextField({ name: 'context_type', required: false }))
        changed = true
      }
      if (!notifCol.fields.getByName('context_id')) {
        notifCol.fields.add(new TextField({ name: 'context_id', required: false }))
        changed = true
      }
      if (!notifCol.fields.getByName('context_link')) {
        notifCol.fields.add(new TextField({ name: 'context_link', required: false }))
        changed = true
      }
      if (changed) {
        app.save(notifCol)
      }
    } catch (e) {
      console.warn('Erro ao verificar/atualizar collection notifications:', e)
    }

    // 2. Criar coleção conversas
    if (!app.hasTable('conversas')) {
      const conversasCol = new Collection({
        name: 'conversas',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'tipo',
            type: 'select',
            required: false,
            values: ['direta', 'grupo'],
            maxSelect: 1,
          },
          {
            name: 'titulo',
            type: 'text',
            required: false,
          },
          {
            name: 'participantes',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 100,
          },
          {
            name: 'criador_id',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'ultima_mensagem_texto',
            type: 'text',
            required: false,
          },
          {
            name: 'ultima_mensagem_data',
            type: 'date',
            required: false,
          },
          {
            name: 'context_type',
            type: 'text',
            required: false,
          },
          {
            name: 'context_id',
            type: 'text',
            required: false,
          },
          {
            name: 'context_titulo',
            type: 'text',
            required: false,
          },
          {
            name: 'context_link',
            type: 'text',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_conversas_ultima_msg ON conversas (ultima_mensagem_data DESC)',
          'CREATE INDEX idx_conversas_created ON conversas (created DESC)',
        ],
      })
      app.save(conversasCol)
    }

    const conversasSaved = app.findCollectionByNameOrId('conversas')

    // 3. Criar coleção mensagens
    if (!app.hasTable('mensagens')) {
      const mensagensCol = new Collection({
        name: 'mensagens',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'conversa_id',
            type: 'relation',
            required: true,
            collectionId: conversasSaved.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'autor_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'autor_nome',
            type: 'text',
            required: false,
          },
          {
            name: 'texto',
            type: 'text',
            required: true,
          },
          {
            name: 'context_type',
            type: 'text',
            required: false,
          },
          {
            name: 'context_id',
            type: 'text',
            required: false,
          },
          {
            name: 'context_titulo',
            type: 'text',
            required: false,
          },
          {
            name: 'context_link',
            type: 'text',
            required: false,
          },
          {
            name: 'context_extra',
            type: 'json',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE INDEX idx_mensagens_conversa_created ON mensagens (conversa_id, created ASC)',
          'CREATE INDEX idx_mensagens_autor ON mensagens (autor_id)',
        ],
      })
      app.save(mensagensCol)
    }

    const mensagensSaved = app.findCollectionByNameOrId('mensagens')

    // 4. Criar coleção leituras_mensagens
    if (!app.hasTable('leituras_mensagens')) {
      const leiturasCol = new Collection({
        name: 'leituras_mensagens',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'mensagem_id',
            type: 'relation',
            required: true,
            collectionId: mensagensSaved.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'conversa_id',
            type: 'relation',
            required: true,
            collectionId: conversasSaved.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'lida_em',
            type: 'date',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
          {
            name: 'updated',
            type: 'autodate',
            onCreate: true,
            onUpdate: true,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_leituras_msg_user ON leituras_mensagens (mensagem_id, user_id)',
          'CREATE INDEX idx_leituras_conversa_user ON leituras_mensagens (conversa_id, user_id)',
        ],
      })
      app.save(leiturasCol)
    }
  },
  (app) => {
    try {
      const lm = app.findCollectionByNameOrId('leituras_mensagens')
      app.delete(lm)
    } catch (_) {}
    try {
      const m = app.findCollectionByNameOrId('mensagens')
      app.delete(m)
    } catch (_) {}
    try {
      const c = app.findCollectionByNameOrId('conversas')
      app.delete(c)
    } catch (_) {}
  },
)
