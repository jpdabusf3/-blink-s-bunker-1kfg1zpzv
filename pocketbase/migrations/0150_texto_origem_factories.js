/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0150: completa o suporte a mensagens de TEXTO no robô de WhatsApp.
 *
 * A 0149 adicionou "texto" em `atividades.origem`, mas o gravador também atualiza
 * `factories.ultima_edicao_origem`, que é outro select e ainda aceitava apenas
 * manual/audio/excel — por isso o registro vindo de texto falhava com 500.
 *
 * Idempotente: se o valor já existir, não altera nada.
 */

migrate(
  (app) => {
    var alvos = [
      { col: 'factories', field: 'ultima_edicao_origem' },
      { col: 'atividades', field: 'origem' },
    ]

    for (var a = 0; a < alvos.length; a++) {
      var alvo = alvos[a]
      try {
        var col = app.findCollectionByNameOrId(alvo.col)
        var campo = null
        for (var i = 0; i < col.fields.length; i++) {
          if (col.fields[i].name === alvo.field) {
            campo = col.fields[i]
            break
          }
        }
        if (!campo) {
          console.log('[0150] ' + alvo.col + '.' + alvo.field + ' não encontrado')
          continue
        }
        var valores = campo.values || []
        var tem = false
        for (var v = 0; v < valores.length; v++) {
          if (valores[v] === 'texto') tem = true
        }
        if (!tem) {
          valores.push('texto')
          campo.values = valores
          app.save(col)
          console.log(
            '[0150] ' + alvo.col + '.' + alvo.field + ' agora aceita: ' + valores.join(', '),
          )
        } else {
          console.log('[0150] ' + alvo.col + '.' + alvo.field + ' já aceita texto')
        }
      } catch (e) {
        console.log('[0150] erro em ' + alvo.col + '.' + alvo.field + ': ' + String(e))
      }
    }
  },
  (app) => {
    // Rollback: remove "texto" das opções (não apaga registros existentes).
    var alvos = [
      { col: 'factories', field: 'ultima_edicao_origem' },
      { col: 'atividades', field: 'origem' },
    ]
    for (var a = 0; a < alvos.length; a++) {
      try {
        var col = app.findCollectionByNameOrId(alvos[a].col)
        for (var i = 0; i < col.fields.length; i++) {
          if (col.fields[i].name === alvos[a].field) {
            var valores = col.fields[i].values || []
            var novos = []
            for (var v = 0; v < valores.length; v++) {
              if (valores[v] !== 'texto') novos.push(valores[v])
            }
            col.fields[i].values = novos
            app.save(col)
            break
          }
        }
      } catch (_) {}
    }
  },
)
