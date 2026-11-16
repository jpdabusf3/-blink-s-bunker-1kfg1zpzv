/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0149: habilita o robô de WhatsApp multiusuário.
 *
 * 1. `atividades.origem` passa a aceitar "texto" (mensagens digitadas no WhatsApp), além
 *    de audio/manual/excel. Sem isso, uma atividade criada a partir de texto é rejeitada.
 * 2. Índice em `users.whatsapp`: o webhook identifica o vendedor pelo telefone a cada
 *    mensagem recebida, e a busca precisa ser rápida.
 */

migrate(
  (app) => {
    // ---- 1. atividades.origem += "texto" ----
    var atividades = app.findCollectionByNameOrId('atividades')
    var origemField = null
    for (var i = 0; i < atividades.fields.length; i++) {
      if (atividades.fields[i].name === 'origem') {
        origemField = atividades.fields[i]
        break
      }
    }
    if (origemField) {
      var valores = origemField.values || []
      var temTexto = false
      for (var v = 0; v < valores.length; v++) {
        if (valores[v] === 'texto') temTexto = true
      }
      if (!temTexto) {
        valores.push('texto')
        origemField.values = valores
        app.save(atividades)
        console.log('[0149] atividades.origem agora aceita: ' + valores.join(', '))
      } else {
        console.log('[0149] atividades.origem já aceita "texto" — nada a fazer')
      }
    } else {
      console.log('[0149] campo atividades.origem não encontrado')
    }

    // ---- 2. Índice em users.whatsapp ----
    try {
      var users = app.findCollectionByNameOrId('users')
      var indexes = users.indexes || []
      var temIndice = false
      for (var k = 0; k < indexes.length; k++) {
        if (String(indexes[k]).indexOf('idx_users_whatsapp') !== -1) temIndice = true
      }
      if (!temIndice) {
        indexes.push('CREATE INDEX `idx_users_whatsapp` ON `users` (`whatsapp`)')
        users.indexes = indexes
        app.save(users)
        console.log('[0149] índice idx_users_whatsapp criado')
      } else {
        console.log('[0149] índice idx_users_whatsapp já existe')
      }
    } catch (e) {
      console.log('[0149] não foi possível criar o índice em users.whatsapp: ' + String(e))
    }
  },
  (app) => {
    // Rollback: remove "texto" das opções de origem (sem apagar registros).
    try {
      var atividades = app.findCollectionByNameOrId('atividades')
      for (var i = 0; i < atividades.fields.length; i++) {
        if (atividades.fields[i].name === 'origem') {
          var valores = atividades.fields[i].values || []
          var novos = []
          for (var v = 0; v < valores.length; v++) {
            if (valores[v] !== 'texto') novos.push(valores[v])
          }
          atividades.fields[i].values = novos
          app.save(atividades)
          break
        }
      }
    } catch (_) {}
  },
)
