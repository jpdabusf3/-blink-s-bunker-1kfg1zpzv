/// <reference path="../pb_data/types.d.ts" />

/**
 * Migracao 0157 - corrige 5 contas cujo endereco foi gravado com municipio/UF divergente.
 *
 * Nas migracoes 0155/0156 o CNPJ encontrado era de outro municipio (ou de outro grupo).
 * Aqui a conta volta ao municipio/UF originais e perde CEP/logradouro, para o vendedor
 * completar manualmente. Nao mexe em nenhuma outra conta.
 *
 * Formato: id|municipio_original|uf_original
 */

migrate(
  (app) => {
    var RAW =
      'lrjq4bivmv7pugo|Maringá|Paraná;r3y04nrwnqsaue8|Porto Velho|RO;8tfliog1b99625y||TO;id8cz942zbbgvq8|Formosa-GO (expansao TO/PA)|TO;wuuplnig1m63iea|Manaus|AM'
    var LINHAS = RAW.split(';')

    var logCol = null
    try {
      logCol = app.findCollectionByNameOrId('entity_change_logs')
    } catch (e) {
      console.log('[0157] entity_change_logs indisponivel: ' + e)
    }

    var revertidos = 0

    for (var i = 0; i < LINHAS.length; i++) {
      var f = LINHAS[i].split('|')
      if (f.length < 3) continue
      var id = f[0]
      var cidade = f[1]
      var uf = f[2]

      var rec = null
      try {
        rec = app.findRecordById('factories', id)
      } catch (e) {
        continue
      }
      if (!rec) continue

      var nome = rec.getString('name') || id

      app.runInTransaction((txApp) => {
        rec.set('city', cidade)
        rec.set('state', uf)
        rec.set('cep', '')
        rec.set('logradouro', '')
        rec.set('numero', '')
        rec.set('bairro', '')
        rec.set('address', '')
        rec.set('standardized_address', '')
        rec.set('address_status', 'partial')
        rec.set('precisao', 'sem-localizacao')
        txApp.save(rec)

        if (logCol) {
          var log = new Record(logCol)
          log.set('entity_type', 'factories')
          log.set('entity_id', id)
          log.set('entity_name', nome)
          log.set('user_name', 'Sistema (Migracao 0157)')
          log.set('field', 'city')
          log.set('old_value', '')
          log.set('new_value', cidade)
          log.set('action', 'update')
          log.set(
            'change_summary',
            'Endereco revertido: o CNPJ encontrado era de outro municipio/grupo. Cadastro manual pendente.',
          )
          txApp.save(log)
        }
      })

      revertidos++
    }

    console.log('[0157] revertidos=' + revertidos)
  },
  (app) => {
    // Rollback no-op.
  },
)
